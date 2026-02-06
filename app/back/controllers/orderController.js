const sql = require('mssql');
const { executeQuery, executeQueryWithParams, getConnection } = require('../services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('../services/dbConfig.cjs');
const {
  mapEstadoToDb,
  mapEstadoFromDb,
  validateDecimal18_2,
  validateDecimal5_2,
  validatePedidoItems
} = require('../utils/helpers');

const getAllOrders = async (req, res) => {
  try {
    const { page, pageSize, search, estado, codter } = req.query;
    const pool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);

    // Construir WHERE dinámicamente
    let whereClauses = [];
    if (estado) {
      const estadoMap = {
        'BORRADOR': 'B',
        'CONFIRMADO': 'C',
        'EN_PROCESO': 'P',
        'PARCIALMENTE_REMITIDO': 'P',
        'REMITIDO': 'M',
        'CANCELADO': 'X'
      };
      const estadoDb = estadoMap[estado] || estado;
      whereClauses.push(`p.estped = '${estadoDb}'`);
    }
    if (codter) {
      // Usar codter (estructura real)
      whereClauses.push(`LTRIM(RTRIM(p.codter)) = LTRIM(RTRIM('${codter}'))`);
    }
    if (search && search.trim() !== '' && search !== '[object Object]') {
      const searchTerm = search.trim().replace(/'/g, "''");
      whereClauses.push(`(
        p.numero_pedido LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(p.codter)) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(COALESCE(p.observaciones, ''))) LIKE '%${searchTerm}%'
      )`);
    }
    let where = whereClauses.length > 0 ? "WHERE " + whereClauses.join(' AND ') : "";

    // Paginación
    const pageNum = parseInt(page) || 1;
    const size = parseInt(pageSize) || 50;
    const offset = (pageNum - 1) * size;

    // Query para contar total de registros
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${TABLE_NAMES.pedidos} p
      ${where}
    `;
    const countResult = await executeQuery(countQuery, {}, req.db_name);
    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / size);

    // Query principal con paginación
    const pedidosQuery = `
      SELECT 
        p.id,
        p.numped as numeroPedido,
        p.fecped as fechaPedido,
        LTRIM(RTRIM(COALESCE(p.codter, ''))) as clienteId,
        CASE 
          WHEN cli.nomter IS NOT NULL AND LTRIM(RTRIM(cli.nomter)) != '' 
          THEN LTRIM(RTRIM(cli.nomter))
          ELSE NULL
        END as clienteNombre,
        LTRIM(RTRIM(COALESCE(p.cod_vendedor, ''))) as vendedorId,
        CAST(COALESCE(p.numcot, NULL) AS VARCHAR(50)) as cotizacionId,
        LTRIM(RTRIM(COALESCE(c.numcot, ''))) as numeroCotizacionOrigen,
        COALESCE(p.subtotal, 0) as subtotal,
        0 as descuentoValor,
        COALESCE(p.valiva, 0) as ivaValor,
        COALESCE(p.valped, 0) as total,
        LTRIM(RTRIM(COALESCE(p.Observa, ''))) as observaciones,
        p.estped as estado,
        COALESCE(p.codalm, '001') as empresaId,
        NULL as fechaEntregaEstimada,
        NULL as listaPrecioId,
        0 as descuentoPorcentaje,
        0 as ivaPorcentaje,
        0 as impoconsumoValor,
        NULL as instrucciones_entrega,
        '01' as formaPago,
        u.firma as firmaVendedor
      FROM ${TABLE_NAMES.pedidos} p
      LEFT JOIN ven_cotizacion c ON c.numcot = p.numcot
      LEFT JOIN ${TABLE_NAMES.clientes} cli ON RTRIM(LTRIM(cli.codter)) = RTRIM(LTRIM(p.codter))
      LEFT JOIN ${TABLE_NAMES.usuarios} u ON LTRIM(RTRIM(u.codusu)) = LTRIM(RTRIM(p.cod_vendedor))
      ${where}
      ORDER BY p.fecped DESC, p.id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${size} ROWS ONLY
    `;

    // Obtener pedidos
    const pedidos = await executeQuery(pedidosQuery, {}, req.db_name);

    // Sincronización de estados (DESHABILITADA TEMPORALMENTE - ERROR DE SCHEMA pedido_id)
    // Se requiere refactorizar para usar numped en lugar de pedido_id en remisiones
    /*
    const pedidosParaSincronizar = pedidos.filter(p => {
       // ... existing logic ...
    });
    
    if (pedidosParaSincronizar.length > 0) { ... } 
    */

    const pedidosMapeados = pedidos.map(p => ({
      ...p,
      estado: mapEstadoFromDb(p.estado)
    }));

    res.json({
      success: true,
      data: pedidosMapeados,
      pagination: {
        page: pageNum,
        pageSize: size,
        total: total,
        totalPages: totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching pedidos:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo pedidos',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const { pedidoId, page = '1', pageSize = '500' } = req.query;
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const pageSizeNum = Math.min(1000, Math.max(50, parseInt(String(pageSize), 10) || 500));

    let whereClause = "WHERE (pd.numped IS NOT NULL AND LTRIM(RTRIM(pd.numped)) <> '')";
    const params = {};
    params.pageSize = pedidoId ? 1000 : pageSizeNum;

    if (pedidoId) {
      const pedidoIdNum = parseInt(pedidoId, 10);
      if (isFinite(pedidoIdNum)) {
        // Resolve numero_pedido from ID first directly
        const dbPool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);
        const resNum = await dbPool.request()
          .input('pid', require('mssql').Int, pedidoIdNum)
          .query(`SELECT numero_pedido FROM ${TABLE_NAMES.pedidos} WHERE id = @pid`);

        if (resNum.recordset.length > 0) {
          let numpedVal = resNum.recordset[0].numero_pedido;
          // Normalize logic: "123" -> "00000123"
          const match = String(numpedVal).match(/(\d+)/);
          if (match) {
            numpedVal = match[1].padStart(8, '0');
          }

          whereClause = "WHERE pd.numped = @numped";
          params.numped = numpedVal;
        } else {
          // ID not found, just filter nothing or invalid
          whereClause = "WHERE 1=0";
        }
      }
    }

    const offset = (pageNum - 1) * pageSizeNum;
    params.offset = offset;

    // Ajuste de query para usar offset en SQL Server
    // Si params.pedidoId existe, no usamos paginación severa
    // Pero el tool original usaba OFFSET siempre.

    const query = `
      SELECT 
        NULL as pedidoId,
        pd.numped,
        pd.codins as codProducto,
        COALESCE(i.id, NULL) as productoId,
        COALESCE(i.nomins, 'Producto no encontrado') as descripcion,
        pd.canped as cantidad,
        pd.valins as precioUnitario,
        pd.dctped as descuentoValor,
        pd.ivaped as valorIva,
        pd.estped as estado,
        pd.codalm as bodegaId,
        ((pd.canped * pd.valins) - pd.dctped + pd.ivaped) as total,
        COALESCE(i.referencia, '') as referencia,
        COALESCE(i.undins, 'UND') as unidadMedida,
        COALESCE(i.tasa_iva, 0) as productoTasaIva,
        0 as descuentoPorcentaje, 
        0 as ivaPorcentaje 
      FROM ${TABLE_NAMES.pedidos_detalle} pd
      LEFT JOIN inv_insumos i ON i.codins = pd.codins
      ${whereClause}
      ORDER BY pd.numped, pd.codins
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `;

    const result = await executeQueryWithParams(query, params, req.db_name);

    // Calcular porcentajes aproximados
    const detalles = result.map(d => {
      const subtotal = d.cantidad * d.precioUnitario;
      const baseForIva = subtotal - d.descuentoValor;

      // Calculate IVA percentage: 
      // 1. If stored IVA value exists (>0), calculate percentage from it (Historical accuracy)
      // 2. If stored IVA is 0, fallback to product's current tax rate (Fix for missing data)
      let calculatedIvaPct = 0;
      if (baseForIva > 0 && d.valorIva > 0) {
        calculatedIvaPct = (d.valorIva / baseForIva) * 100;
      } else {
        calculatedIvaPct = d.productoTasaIva || 0;
      }

      return {
        ...d,
        subtotal: subtotal,
        descuentoPorcentaje: subtotal > 0 ? (d.descuentoValor / subtotal) * 100 : 0,
        ivaPorcentaje: calculatedIvaPct
      };
    });

    res.json({
      success: true,
      data: detalles,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total: detalles.length // Aproximado
      }
    });

  } catch (error) {
    console.error('Error fetching pedidos detalle:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo detalles' });
  }
};

const createOrderInternal = async (tx, orderData) => {
  const {
    clienteId,
    fechaPedido,
    fechaEntregaEstimada,
    vendedorId,
    observaciones,
    items,
    subtotal,
    descuentoValor,
    ivaValor,
    total,
    ivaPorcentaje,
    impoconsumoValor,
    instruccionesEntrega,
    cotizacionId,
    empresaId, // codalm
    formaPago,
    numeroPedido // Opcional, si viene 'AUTO' se genera
  } = orderData;

  // Validación básica
  if (!clienteId || !items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Faltan campos requeridos (cliente, items)');
  }

  // 1. Validar Cliente
  const clienteIdStr = String(clienteId).trim();
  const reqCliente = new sql.Request(tx);
  let clienteQuery = `SELECT codter, nomter, codven FROM ${TABLE_NAMES.clientes} WHERE LTRIM(RTRIM(codter)) = @codter`;
  // Si es numérico, podría ser ID
  if (!isNaN(parseInt(clienteIdStr)) && String(parseInt(clienteIdStr)) === clienteIdStr) {
    // Intentar por ID también si fuese necesario, pero useremos codter normalmente
    // Asumimos clienteId es codter
  }
  reqCliente.input('codter', sql.VarChar(20), clienteIdStr);
  const clienteRes = await reqCliente.query(clienteQuery);

  if (clienteRes.recordset.length === 0) {
    // Fallback: buscar por ID
    const reqCliId = new sql.Request(tx);
    reqCliId.input('id', sql.Int, parseInt(clienteIdStr));
    const cliIdRes = await reqCliId.query(`SELECT codter, nomter, codven FROM ${TABLE_NAMES.clientes} WHERE id = @id`);
    if (cliIdRes.recordset.length === 0) {
      throw new Error('Cliente no encontrado');
    }
    // Encontrado por ID
  }


  const clienteData = clienteRes.recordset.length > 0 ? clienteRes.recordset[0] : (await new sql.Request(tx).query(`SELECT codter, nomter, codven FROM ${TABLE_NAMES.clientes} WHERE id = ${parseInt(clienteIdStr)}`)).recordset[0];
  const codTerFinal = clienteData.codter;

  // 2. Validar Empresa/Almacén
  let codAlmFinal = '001';
  let empresaIdValid = 1;
  // Lógica simplificada: usar '001' si no viene, o validar si viene.
  if (empresaId) codAlmFinal = String(empresaId).trim();

  // 3. Generar/Validar Número
  let numeroPedidoFinal = numeroPedido;
  if (!numeroPedido || numeroPedido === 'AUTO') {
    const reqUltimo = new sql.Request(tx);
    const ultimoRes = await reqUltimo.query(`
            SELECT TOP 1 numero_pedido FROM ${TABLE_NAMES.pedidos} 
            WHERE numero_pedido NOT LIKE 'B-%' 
            ORDER BY id DESC
          `);

    let nextNum = 1;
    if (ultimoRes.recordset.length > 0) {
      const lastNum = ultimoRes.recordset[0].numero_pedido;
      const soloDigitos = String(lastNum).replace(/\D/g, '');
      if (soloDigitos) nextNum = parseInt(soloDigitos, 10) + 1;
    }
    numeroPedidoFinal = String(nextNum).padStart(6, '0');
  } else {
    // Validar existencia
    const reqCheck = new sql.Request(tx);
    reqCheck.input('num', sql.VarChar(50), numeroPedido);
    const check = await reqCheck.query(`SELECT id FROM ${TABLE_NAMES.pedidos} WHERE numero_pedido = @num`);
    if (check.recordset.length > 0) throw new Error('Número de pedido duplicado');
  }

  // 4. Validar Totales
  const subtotalFinal = validateDecimal18_2(subtotal, 'subtotal');
  const descuentoFinal = validateDecimal18_2(descuentoValor || 0, 'descuentoValor');
  const ivaValFinal = validateDecimal18_2(ivaValor || 0, 'ivaValor');
  const totalFinal = validateDecimal18_2(total, 'total');
  const impoconsumoFinal = validateDecimal18_2(impoconsumoValor || 0, 'impoconsumoValor');

  const ivaPorcFinal = validateDecimal5_2(ivaPorcentaje || 19, 'ivaPorcentaje', true);
  const descPorcFinal = subtotalFinal > 0 ? validateDecimal5_2((descuentoFinal / subtotalFinal) * 100, 'descuentoPorcentaje') : 0;

  // 5. Insertar Encabezado
  const reqHead = new sql.Request(tx);
  reqHead.input('numped', sql.Char(8), numeroPedidoFinal.substring(0, 8).padStart(8, '0'));
  reqHead.input('fecped', sql.Date, fechaPedido || new Date());
  reqHead.input('codter', sql.VarChar(20), codTerFinal);
  
  let codVendedorFinal = clienteData.codven || '';
  if (vendedorId) {
    const vendedorIdStr = String(vendedorId).trim();
    if (!isNaN(parseInt(vendedorIdStr)) && String(parseInt(vendedorIdStr)) === vendedorIdStr) {
      codVendedorFinal = vendedorIdStr;
    } else {
      codVendedorFinal = vendedorIdStr;
    }
  }
  reqHead.input('codven', sql.VarChar(20), codVendedorFinal);
  reqHead.input('codalm', sql.Char(3), codAlmFinal);
  reqHead.input('numcot', sql.VarChar(50), cotizacionId ? String(cotizacionId) : null);
  reqHead.input('codusu', sql.VarChar(4), 'WEB'); // Default user

  reqHead.input('subtotal', sql.Decimal(18, 2), subtotalFinal);
  // reqHead.input('val_descuento', sql.Decimal(18, 2), descuentoFinal); // Not in legacy
  // reqHead.input('tasa_descuento', sql.Decimal(5, 2), descPorcFinal); // Not in legacy
  reqHead.input('valiva', sql.Decimal(18, 2), ivaValFinal);
  // reqHead.input('tasa_iva', sql.Decimal(5, 2), ivaPorcFinal); // Not in legacy
  reqHead.input('valped', sql.Decimal(18, 2), totalFinal);
  // reqHead.input('impoconsumo', sql.Decimal(18, 2), impoconsumoFinal); // Not in legacy
  reqHead.input('Observa', sql.VarChar(500), observaciones || '');
  // reqHead.input('instrucciones_entrega', sql.VarChar(500), instruccionesEntrega || ''); // Not in legacy
  reqHead.input('estped', sql.Char(1), 'B'); // Borrador
  // reqHead.input('lista_precio', sql.VarChar(50), null); // Not in legacy

  const headQuery = `
        INSERT INTO ${TABLE_NAMES.pedidos} (
          numped, fecped, codter, codven, codalm,
          numcot, codusu, subtotal, valiva,
          valped, Observa, estped, fecsys
        ) VALUES (
          @numped, @fecped, @codter, @codven, @codalm,
          @numcot, @codusu, @subtotal, @valiva,
          @valped, @Observa, @estped, GETDATE()
        );
        SELECT SCOPE_IDENTITY() AS id;
      `;

  const headRes = await reqHead.query(headQuery);
  const pedidoId = headRes.recordset[0].id;

  let numpedLegacy = numeroPedidoFinal;
  const match = String(numeroPedidoFinal).match(/(\d+)/);
  if (match) {
    numpedLegacy = match[1].padStart(8, '0');
  }

  // 6. Insertar Detalles (ven_detapedidos)
  for (const item of items) {
    const reqDet = new sql.Request(tx);

    // RESOLUCIÓN ROBUSTA DE CÓDIGO DE PRODUCTO
    // El frontend puede enviar 'productoId' (numérico) o 'codProducto' (string).
    // Si envía un ID, debemos buscar el código real (codins) en inv_insumos.
    // Si envía un código, verificamos si es el código real o si es un ID disfrazado.

    let realCodIns = String(item.codProducto || item.productoId || '').trim();

    // Intentar resolver código correcto desde BD si parece un ID numérico o para asegurar
    if (item.productoId || (realCodIns && !isNaN(realCodIns))) {
      try {
        const reqCode = new sql.Request(tx);
        // Buscar por ID si tenemos productoId explícito, o si realCodIns es numérico y no encontramos por codins
        let queryCode = `SELECT TOP 1 codins FROM ${TABLE_NAMES.productos} WHERE `;

        if (item.productoId) {
          queryCode += `id = @pid`;
          reqCode.input('pid', sql.Int, item.productoId);
        } else {
          // Caso raro: item.codProducto es "1004" (ID)
          queryCode += `id = @pcode OR codins = @pcodeStr`; // Prioridad ID si coincide numerico? No, mejor buscar exacto.
          // Simplificación: Si es numérico, intentamos buscar por ID primero.
          reqCode.input('pcode', sql.Int, parseInt(realCodIns));
          reqCode.input('pcodeStr', sql.VarChar(50), realCodIns);
          // Query ajustada: devolver codins si coincidencia por ID o por CODINS
          queryCode = `SELECT TOP 1 codins FROM ${TABLE_NAMES.productos} WHERE id = @pcode OR codins = @pcodeStr`;
        }

        const resCode = await reqCode.query(queryCode);
        if (resCode.recordset.length > 0) {
          realCodIns = resCode.recordset[0].codins; // USAR EL CÓDIGO REAL DE LA BD
        }
      } catch (errCode) {
        console.warn('Error resolviendo codins en createOrder:', errCode);
        // Fallback: usar lo que venía
      }
    }

    const codIns = String(realCodIns).trim();

    const cant = validateDecimal18_2(item.cantidad, 'cant');
    const prec = validateDecimal18_2(item.precioUnitario, 'prec');

    let dctoVal = 0;
    if (item.descuentoValor) dctoVal = validateDecimal18_2(item.descuentoValor, 'dctoVal');
    else if (item.descuentoPorcentaje) dctoVal = (cant * prec) * (parseFloat(item.descuentoPorcentaje) / 100);
    dctoVal = validateDecimal18_2(dctoVal, 'dcto');

    const ivaVal = validateDecimal18_2(item.valorIva || 0, 'iva');

    reqDet.input('numped', sql.Char(8), numpedLegacy.substring(0, 8).padStart(8, '0'));
    reqDet.input('codins', sql.Char(8), codIns.substring(0, 8));
    reqDet.input('valins', sql.Decimal(18, 2), prec);
    reqDet.input('canped', sql.Decimal(18, 2), cant);
    reqDet.input('ivaped', sql.Decimal(18, 2), ivaVal);
    reqDet.input('dctped', sql.Decimal(18, 2), dctoVal);
    reqDet.input('estped', sql.Char(1), 'B');
    reqDet.input('codalm', sql.Char(3), codAlmFinal); // Use codalm if available or mapping
    // REMOVED: reqDet.input('pedido_id', sql.Int, pedidoId);
    reqDet.input('feccargo', sql.Date, fechaPedido || new Date());

    reqDet.input('codtec', sql.VarChar(20), ''); // Legacy required param in our create_tables?
    // Table definition in create_orders_tables.cjs has: numped, codins, valins, canped, ivaped, dctped, estped, codalm, serial, reservado, usureserva, numfac, DiasGar, Numord, Fecsys, msisdn, imei, iccid, codplan, feccargo, codtec, pedido_id

    await reqDet.query(`
            INSERT INTO ${TABLE_NAMES.pedidos_detalle} (
               numped, codins, valins, canped, ivaped, dctped, estped, codalm, 
               feccargo, Fecsys, codtec
            ) VALUES (
               @numped, @codins, @valins, @canped, @ivaped, @dctped, @estped, @codalm, 
               @feccargo, GETDATE(), @codtec
            )
          `);
  }

  return { id: pedidoId, numeroPedido: numeroPedidoFinal };
};

const createOrder = async (req, res) => {
  try {
    const pool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);
    const tx = new sql.Transaction(pool);

    try {
      await tx.begin();
      const result = await createOrderInternal(tx, req.body);
      await tx.commit();

      res.status(201).json({
        success: true,
        message: 'Pedido creado',
        data: result
      });

    } catch (err) {
      if (tx) await tx.rollback();
      throw err;
    }

  } catch (error) {
    console.error('Error creando pedido:', error);
    res.status(500).json({ success: false, message: error.message || 'Error creando pedido' });
  }
};

const updateOrder = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, message: 'ID de pedido requerido' });
  }

  try {
    const pool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);

    // Si solo actualizamos estado
    if (estado) {
      const estadoDb = mapEstadoToDb(estado);
      const estadoDbTruncado = String(estadoDb || 'B').substring(0, 1);

      const query = `
         UPDATE ${TABLE_NAMES.pedidos} 
         SET estado = @estado, fecmod = GETDATE()
         WHERE id = @id;
         
         SELECT 
           id, numped, estado 
         FROM ${TABLE_NAMES.pedidos} 
         WHERE id = @id;
       `;

      const result = await executeQueryWithParams(query, {
        id: parseInt(id),
        estado: estadoDbTruncado
      }, req.db_name);

      if (result.length === 0) {
        return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
      }

      return res.json({
        success: true,
        message: 'Pedido actualizado',
        data: {
          ...result[0],
          estado: mapEstadoFromDb(result[0].estado)
        }
      });
    }

    // Si hay más campos por actualizar en el futuro, agregarlos aquí
    // Por ahora, devolver error si no hay nada que actualizar
    return res.status(400).json({ success: false, message: 'No se enviaron datos para actualizar' });

  } catch (error) {
    console.error('Error actualizando pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando pedido',
      error: error.message
    });
  }
};

const getNextOrderNumber = async (req, res) => {
  try {
    const pool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);
    const result = await pool.request().query(`
      SELECT TOP 1 numped 
      FROM ${TABLE_NAMES.pedidos} 
      ORDER BY id DESC
    `);

    let nextNum = '000001';
    if (result.recordset.length > 0) {
      const lastNum = result.recordset[0].numped;
      const soloDigitos = lastNum.replace(/\D/g, '');
      const consecutivo = parseInt(soloDigitos, 10);
      if (!isNaN(consecutivo)) {
        nextNum = String(consecutivo + 1).padStart(6, '0');
      }
    }

    res.json({ success: true, data: { nextNumber: nextNum } });
  } catch (error) {
    console.error('Error getting next order number:', error);
    res.status(500).json({ success: false, message: 'Error interno al obtener el consecutivo' });
  }
};

const { sendDocumentEmail } = require('../services/emailService.cjs');

const sendOrderEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { destinatario, asunto, mensaje, pdfBase64 } = req.body;

    const pool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);
    const idNum = parseInt(id, 10);

    // 1. Obtener Datos del Pedido
    const orderQuery = `
      SELECT 
        p.numero_pedido, 
        p.fecha_pedido, 
        p.total, 
        c.nomter, 
        c.EMAIL 
      FROM ${TABLE_NAMES.pedidos} p
      LEFT JOIN ${TABLE_NAMES.clientes} c ON LTRIM(RTRIM(c.codter)) = LTRIM(RTRIM(p.codter))
      WHERE p.id = @id
    `;
    const orderRes = await executeQueryWithParams(orderQuery, { id: idNum }, req.db_name);

    if (orderRes.length === 0) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    const pedido = orderRes[0];
    const clienteEmail = destinatario || pedido.EMAIL;

    if (!clienteEmail) {
      return res.status(400).json({ success: false, message: 'El cliente no tiene email registrado y no se proporcionó uno alternativo.' });
    }

    // 2. Preparar PDF
    let pdfBuffer;
    if (pdfBase64) {
      pdfBuffer = pdfBase64;
    } else {
      return res.status(400).json({ success: false, message: 'Se requiere el PDF generado para enviar el correo (pdfBase64).' });
    }

    // 3. Preparar Detalles para el Correo
    const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(val);
    const documentDetails = [
      { label: 'Total Pedido', value: formatCurrency(pedido.total || 0) },
      { label: 'Fecha', value: new Date(pedido.fecha_pedido).toLocaleDateString('es-CO') }
    ];

    // 4. Enviar Correo
    await sendDocumentEmail({
      to: clienteEmail,
      customerName: pedido.nomter,
      documentNumber: pedido.numero_pedido,
      documentType: 'Pedido',
      pdfBuffer,
      subject: asunto,
      body: mensaje,
      documentDetails,
      processSteps: `
            <p>Hemos recibido su orden correctamente. En este momento el equipo de almacén está preparando sus productos. Le notificaremos en cuanto el despacho sea realizado.</p>
        `
    });

    res.json({ success: true, message: 'Correo de pedido enviado exitosamente' });

  } catch (error) {
    console.error('Error enviando correo de pedido:', error);
    res.status(500).json({ success: false, message: 'Error enviando correo', error: error.message });
  }
};

/**
 * Convierte un pedido a remisión (parcial o total)
 * POST /api/pedidos/:id/convert-to-remission
 * Body: { items: [{ codins, cantidad }] } - opcional, si no se envía se toman todos los items pendientes
 */
const convertToRemission = async (req, res) => {
  const { id } = req.params;
  const { items: itemsSeleccionados } = req.body;

  const pool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    // 1. Verificar que el pedido existe
    const reqCheck = new sql.Request(tx);
    reqCheck.input('id', sql.Int, parseInt(id));
    const checkRes = await reqCheck.query(`
      SELECT * FROM ${TABLE_NAMES.pedidos} WHERE id = @id
    `);

    if (checkRes.recordset.length === 0) {
      await tx.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Pedido no encontrado' 
      });
    }

    const pedido = checkRes.recordset[0];
    const numeroPedido = pedido.numped;

    // Normalizar numped para consultas legacy
    let numpedLegacy = numeroPedido;
    const match = String(numeroPedido).match(/(\d+)/);
    if (match) {
      numpedLegacy = match[1].padStart(8, '0');
    }

    // 2. Obtener items del pedido con cantidades pendientes
    const reqItems = new sql.Request(tx);
    reqItems.input('numped', sql.Char(8), numpedLegacy);
    const itemsRes = await reqItems.query(`
      SELECT 
        pd.codins,
        pd.canped as cantidadPedida,
        COALESCE(pd.canent, 0) as cantidadEnviada,
        (pd.canped - COALESCE(pd.canent, 0)) as cantidadPendiente,
        pd.valins as precioUnitario,
        pd.dctped as descuentoValor,
        pd.ivaped as valorIva,
        i.nomins as descripcion,
        i.id as productoId
      FROM ${TABLE_NAMES.pedidos_detalle} pd
      LEFT JOIN ${TABLE_NAMES.productos} i ON LTRIM(RTRIM(i.codins)) = LTRIM(RTRIM(pd.codins))
      WHERE pd.numped = @numped
    `);

    const itemsPedido = itemsRes.recordset;

    if (itemsPedido.length === 0) {
      await tx.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'El pedido no tiene items' 
      });
    }

    // 3. Determinar items a remitir
    let itemsParaRemision = [];

    if (itemsSeleccionados && Array.isArray(itemsSeleccionados) && itemsSeleccionados.length > 0) {
      // Remisión parcial - validar cantidades
      for (const itemSel of itemsSeleccionados) {
        const itemPedido = itemsPedido.find(ip => 
          String(ip.codins).trim() === String(itemSel.codins).trim()
        );

        if (!itemPedido) {
          await tx.rollback();
          return res.status(400).json({ 
            success: false, 
            message: `Item ${itemSel.codins} no encontrado en el pedido` 
          });
        }

        const cantidadSolicitada = parseFloat(itemSel.cantidad);
        
        if (cantidadSolicitada <= 0) {
          await tx.rollback();
          return res.status(400).json({ 
            success: false, 
            message: `La cantidad para ${itemSel.codins} debe ser mayor a 0` 
          });
        }

        if (cantidadSolicitada > itemPedido.cantidadPendiente) {
          await tx.rollback();
          return res.status(400).json({ 
            success: false, 
            message: `La cantidad solicitada para ${itemSel.codins} (${cantidadSolicitada}) excede la cantidad pendiente (${itemPedido.cantidadPendiente})` 
          });
        }

        itemsParaRemision.push({
          ...itemPedido,
          cantidadARemitir: cantidadSolicitada
        });
      }
    } else {
      // Remisión total - tomar todos los items pendientes
      itemsParaRemision = itemsPedido
        .filter(ip => ip.cantidadPendiente > 0)
        .map(ip => ({
          ...ip,
          cantidadARemitir: ip.cantidadPendiente
        }));
    }

    if (itemsParaRemision.length === 0) {
      await tx.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'No hay items pendientes para remitir' 
      });
    }

    // 4. Generar número de remisión
    const reqUltimoNum = new sql.Request(tx);
    const ultimoNumResult = await reqUltimoNum.query(`
      SELECT TOP 1 numrem 
      FROM ${TABLE_NAMES.remisiones} 
      WHERE ISNUMERIC(numrem) = 1 
      ORDER BY CAST(numrem AS BIGINT) DESC
    `);

    let nuevoNumeroRemision = '000001';
    if (ultimoNumResult.recordset.length > 0) {
      const ultimoNum = ultimoNumResult.recordset[0].numrem;
      const consecutivo = parseInt(ultimoNum, 10);
      if (!isNaN(consecutivo)) {
        nuevoNumeroRemision = String(consecutivo + 1).padStart(6, '0');
      }
    }

    // 5. Insertar encabezado de remisión
    const reqRemHead = new sql.Request(tx);
    reqRemHead.input('numrem', sql.VarChar(50), nuevoNumeroRemision);
    reqRemHead.input('fecrem', sql.Date, new Date());
    reqRemHead.input('codter', sql.VarChar(20), pedido.codter);
    reqRemHead.input('codven', sql.VarChar(20), pedido.codven);
    reqRemHead.input('codalm', sql.VarChar(10), pedido.codalm || '001');
    reqRemHead.input('estado', sql.VarChar(20), 'ENVIADO');
    reqRemHead.input('observacion', sql.VarChar(500), `Remisión desde pedido ${numeroPedido}`);
    reqRemHead.input('usuario', sql.VarChar(20), 'ADMIN');

    const remHeadQuery = `
      INSERT INTO ${TABLE_NAMES.remisiones} (
        numrem, fecrem, codter, codven, codalm, estado, observacion, usuario
      ) VALUES (
        @numrem, @fecrem, @codter, @codven, @codalm, @estado, @observacion, @usuario
      );
      SELECT SCOPE_IDENTITY() AS id;
    `;

    const remHeadRes = await reqRemHead.query(remHeadQuery);
    const remisionId = remHeadRes.recordset[0].id;

    // 6. Insertar detalles de remisión y actualizar cantidades en pedido
    for (const item of itemsParaRemision) {
      // Insertar detalle de remisión
      const reqRemDet = new sql.Request(tx);
      reqRemDet.input('remision_id', sql.Int, remisionId);
      reqRemDet.input('codins', sql.VarChar(50), item.codins);
      reqRemDet.input('cantidad_enviada', sql.Decimal(18, 2), item.cantidadARemitir);
      reqRemDet.input('cantidad_facturada', sql.Decimal(18, 2), 0);
      reqRemDet.input('cantidad_devuelta', sql.Decimal(18, 2), 0);

      await reqRemDet.query(`
        INSERT INTO ${TABLE_NAMES.remisiones_detalle} (
          remision_id, codins, cantidad_enviada, cantidad_facturada, cantidad_devuelta
        ) VALUES (
          @remision_id, @codins, @cantidad_enviada, @cantidad_facturada, @cantidad_devuelta
        )
      `);

      // Actualizar cantidad enviada en el pedido
      const reqUpdatePed = new sql.Request(tx);
      reqUpdatePed.input('numped', sql.Char(8), numpedLegacy);
      reqUpdatePed.input('codins', sql.VarChar(50), item.codins);
      reqUpdatePed.input('cantidadARemitir', sql.Decimal(18, 2), item.cantidadARemitir);

      await reqUpdatePed.query(`
        UPDATE ${TABLE_NAMES.pedidos_detalle}
        SET canent = COALESCE(canent, 0) + @cantidadARemitir
        WHERE numped = @numped AND codins = @codins
      `);
    }

    // 7. Actualizar estado del pedido si está completamente remitido
    const reqCheckComplete = new sql.Request(tx);
    reqCheckComplete.input('numped', sql.Char(8), numpedLegacy);
    const checkCompleteRes = await reqCheckComplete.query(`
      SELECT 
        SUM(canped) as totalPedido,
        SUM(COALESCE(canent, 0)) as totalEnviado
      FROM ${TABLE_NAMES.pedidos_detalle}
      WHERE numped = @numped
    `);

    const totales = checkCompleteRes.recordset[0];
    if (totales.totalPedido <= totales.totalEnviado) {
      // Pedido completamente remitido
      const reqUpdateEstado = new sql.Request(tx);
      reqUpdateEstado.input('id', sql.Int, parseInt(id));
      await reqUpdateEstado.query(`
        UPDATE ${TABLE_NAMES.pedidos}
        SET estado = 'M', fec_modificacion = GETDATE()
        WHERE id = @id
      `);
    } else {
      // Pedido parcialmente remitido
      const reqUpdateEstado = new sql.Request(tx);
      reqUpdateEstado.input('id', sql.Int, parseInt(id));
      await reqUpdateEstado.query(`
        UPDATE ${TABLE_NAMES.pedidos}
        SET estado = 'P', fec_modificacion = GETDATE()
        WHERE id = @id
      `);
    }

    await tx.commit();

    res.status(201).json({
      success: true,
      message: 'Remisión creada exitosamente desde pedido',
      data: {
        remisionId: remisionId,
        numeroRemision: nuevoNumeroRemision,
        pedidoId: id,
        itemsRemitidos: itemsParaRemision.length,
        estadoPedido: totales.totalPedido <= totales.totalEnviado ? 'REMITIDO' : 'PARCIALMENTE_REMITIDO'
      }
    });

  } catch (error) {
    if (tx) await tx.rollback();
    console.error('Error convirtiendo pedido a remisión:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error convirtiendo pedido a remisión',
      error: error.message 
    });
  }
};

module.exports = {
  getAllOrders,
  getOrderDetails,
  createOrder,
  createOrderInternal,
  updateOrder,
  getNextOrderNumber,
  sendOrderEmail,
  convertToRemission

};
