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
      whereClauses.push(`p.estado = '${estadoDb}'`);
    }
    if (codter) {
      // Usar codter (estructura real)
      whereClauses.push(`LTRIM(RTRIM(p.codter)) = LTRIM(RTRIM('${codter}'))`);
    }
    if (search && search.trim() !== '' && search !== '[object Object]') {
      const searchTerm = search.trim().replace(/'/g, "''");
      whereClauses.push(`(
        p.numped LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(p.codter)) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(COALESCE(p.observa, ''))) LIKE '%${searchTerm}%'
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
        p.numero_pedido as numeroPedido,
        p.fecha_pedido as fechaPedido,
        LTRIM(RTRIM(COALESCE(p.codter, ''))) as clienteId,
        CASE 
          WHEN cli.nomter IS NOT NULL AND LTRIM(RTRIM(cli.nomter)) != '' 
          THEN LTRIM(RTRIM(cli.nomter))
          ELSE NULL
        END as clienteNombre,
        LTRIM(RTRIM(COALESCE(p.codven, ''))) as vendedorId,
        CAST(COALESCE(p.cotizacion_id, NULL) AS VARCHAR(50)) as cotizacionId,
        LTRIM(RTRIM(COALESCE(c.numcot, ''))) as numeroCotizacionOrigen,
        COALESCE(p.subtotal, 0) as subtotal,
        COALESCE(p.descuento_valor, 0) as descuentoValor,
        COALESCE(p.iva_valor, 0) as ivaValor,
        COALESCE(p.total, 0) as total,
        LTRIM(RTRIM(COALESCE(p.observaciones, ''))) as observaciones,
        p.estado,
        COALESCE(p.empresa_id, 1) as empresaId,
        p.fecha_entrega_estimada as fechaEntregaEstimada,
        NULL as listaPrecioId,
        COALESCE(p.descuento_porcentaje, 0) as descuentoPorcentaje,
        COALESCE(p.iva_porcentaje, 0) as ivaPorcentaje,
        COALESCE(p.impoconsumo_valor, 0) as impoconsumoValor,
        LTRIM(RTRIM(COALESCE(p.instrucciones_entrega, ''))) as instruccionesEntrega,
        LTRIM(RTRIM(COALESCE(p.formapago, '01'))) as formaPago,
        u.firma as firmaVendedor
      FROM ${TABLE_NAMES.pedidos} p
      LEFT JOIN ven_cotizacion c ON c.id = p.cotizacion_id
      LEFT JOIN ${TABLE_NAMES.clientes} cli ON RTRIM(LTRIM(cli.codter)) = RTRIM(LTRIM(p.codter)) AND cli.activo = 1
      LEFT JOIN ${TABLE_NAMES.usuarios} u ON LTRIM(RTRIM(u.codusu)) = LTRIM(RTRIM(p.codven))
      ${where}
      ORDER BY p.fecha_pedido DESC, p.id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${size} ROWS ONLY
    `;

    // Obtener pedidos
    const pedidos = await executeQuery(pedidosQuery, {}, req.db_name);

    // Sincronizar estados de pedidos basándose en remisiones existentes
    const pedidosParaSincronizar = pedidos.filter(p => {
      const estadoMapeado = mapEstadoFromDb(p.estado);
      return estadoMapeado === 'CONFIRMADO' ||
        estadoMapeado === 'EN_PROCESO' ||
        estadoMapeado === 'PARCIALMENTE_REMITIDO' ||
        estadoMapeado === 'RECHAZADA' ||
        estadoMapeado === 'REMITIDO';
    });

    if (pedidosParaSincronizar.length > 0) {
      for (const pedido of pedidosParaSincronizar) {
        try {
          const pedidoId = pedido.id;
          const estadoActual = mapEstadoFromDb(pedido.estado);

          const reqRemisiones = new sql.Request(pool);
          reqRemisiones.input('pedidoId', sql.Int, pedidoId);
          const remisionesResult = await reqRemisiones.query(`
            SELECT COUNT(*) as total
            FROM ${TABLE_NAMES.remisiones}
            WHERE pedido_id = @pedidoId
          `);

          const tieneRemisiones = remisionesResult.recordset[0].total > 0;

          if (tieneRemisiones) {
            let numeroPedidoStr = pedido.numeroPedido || pedido.numero_pedido || 'N/A';

            // Obtener items del pedido para calcular estado real
            const reqItemsPedido = new sql.Request(pool);
            reqItemsPedido.input('pedidoId', sql.Int, pedidoId);
            const pedidoNumResult = await reqItemsPedido.query(`SELECT numero_pedido FROM ${TABLE_NAMES.pedidos} WHERE id = @pedidoId`);
            const numeroPedido = pedidoNumResult.recordset[0]?.numero_pedido;

            let numpedPedido = null;
            if (numeroPedido) {
              const match = String(numeroPedido).match(/(\d+)/);
              if (match) {
                numpedPedido = 'PED' + match[1].padStart(5, '0');
              } else {
                numpedPedido = String(numeroPedido).replace(/-/g, '').substring(0, 8).padStart(8, '0');
              }
              numpedPedido = numpedPedido.substring(0, 8).padStart(8, '0');
            }

            const reqItemsPedido2 = new sql.Request(pool);
            let itemsPedidoResult;
            if (numpedPedido) {
              reqItemsPedido2.input('numped', sql.Char(8), numpedPedido);
              itemsPedidoResult = await reqItemsPedido2.query(`
                SELECT pd.codins, (SELECT TOP 1 id FROM inv_insumos WHERE codins = pd.codins) as producto_id, pd.canped as cantidad
                FROM ${TABLE_NAMES.pedidos_detalle} pd WHERE pd.numped = @numped
              `);
            } else {
              reqItemsPedido2.input('pedidoId', sql.Int, pedidoId);
              itemsPedidoResult = await reqItemsPedido2.query(`
                SELECT pd.codins, (SELECT TOP 1 id FROM inv_insumos WHERE codins = pd.codins) as producto_id, pd.canped as cantidad
                FROM ${TABLE_NAMES.pedidos_detalle} pd WHERE pd.pedido_id = @pedidoId
              `);
            }

            if (itemsPedidoResult.recordset.length === 0) continue;

            const reqItemsRemitidos = new sql.Request(pool);
            reqItemsRemitidos.input('pedidoId', sql.Int, pedidoId);
            const itemsRemitidosResult = await reqItemsRemitidos.query(`
              SELECT rd.codins, SUM(rd.cantidad_enviada) as cantidad_remitida
              FROM ${TABLE_NAMES.remisiones_detalle} rd
              INNER JOIN ${TABLE_NAMES.remisiones} r ON rd.remision_id = r.id
              WHERE r.pedido_id = @pedidoId
              GROUP BY rd.codins
            `);

            let todosRemitidos = true;
            let algunoRemitido = false;

            for (const itemPedido of itemsPedidoResult.recordset) {
              const itemRemitido = itemsRemitidosResult.recordset.find(
                ir => String(ir.codins || '').trim() === String(itemPedido.codins || '').trim()
              );
              const cantidadRemitida = itemRemitido ? parseFloat(itemRemitido.cantidad_remitida) : 0;
              const cantidadPedida = parseFloat(itemPedido.cantidad);

              if (cantidadRemitida > 0) algunoRemitido = true;
              if (Math.abs(cantidadRemitida - cantidadPedida) > 0.01) todosRemitidos = false;
            }

            let nuevoEstado = estadoActual;
            if (todosRemitidos && algunoRemitido) nuevoEstado = 'REMITIDO';
            else if (algunoRemitido && !todosRemitidos) nuevoEstado = 'PARCIALMENTE_REMITIDO';
            else if (estadoActual === 'CONFIRMADO' && algunoRemitido) nuevoEstado = 'EN_PROCESO';

            if (nuevoEstado !== estadoActual) {
              const reqUpdate = new sql.Request(pool);
              reqUpdate.input('pedidoId', sql.Int, pedidoId);
              const estadoDb = mapEstadoToDb(nuevoEstado);
              const estadoDbTruncado = String(estadoDb || 'B').substring(0, 1);
              reqUpdate.input('nuevoEstado', sql.Char(1), estadoDbTruncado);

              await reqUpdate.query(`UPDATE ${TABLE_NAMES.pedidos} SET estado = @nuevoEstado WHERE id = @pedidoId`);
              pedido.estado = estadoDbTruncado;
            }
          }
        } catch (syncError) {
          console.error(`⚠️ Error sincronizando pedido ${pedido.id}:`, syncError);
        }
      }
    }

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

    let whereClause = "WHERE pd.pedido_id IS NOT NULL OR (pd.numped IS NOT NULL AND LTRIM(RTRIM(pd.numped)) <> '')";
    const params = {};
    params.pageSize = pedidoId ? 1000 : pageSizeNum;

    if (pedidoId) {
      const pedidoIdNum = parseInt(pedidoId, 10);
      if (isFinite(pedidoIdNum)) {
        whereClause = "WHERE pd.pedido_id = @pedidoId";
        params.pedidoId = pedidoIdNum;

        // Verificar existencia (opcional, pero buena práctica)
        const check = await executeQueryWithParams(`SELECT COUNT(*) as total FROM ${TABLE_NAMES.pedidos_detalle} WHERE pedido_id = @pedidoId`, { pedidoId: pedidoIdNum }, req.db_name);
        if (check[0].total === 0) {
          // Intentar buscar por numped si pedido_id falla (legacy fallback)
          // Lógica omitida para simplificar, confiamos en pedido_id
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
        pd.pedido_id as pedidoId,
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
        (pd.canped * pd.valins) - pd.dctped + pd.ivaped as total,
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
    const check = await reqCheck.query(`SELECT id FROM ven_pedidos WHERE numero_pedido = @num`);
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
  reqHead.input('numero_pedido', sql.VarChar(50), numeroPedidoFinal);
  reqHead.input('fecha_pedido', sql.Date, fechaPedido || new Date());
  reqHead.input('fecha_entrega_estimada', sql.Date, fechaEntregaEstimada || null);
  reqHead.input('codter', sql.VarChar(20), codTerFinal);

  let codVendedorFinal = clienteData.codven;
  if (vendedorId) {
    const vendedorIdStr = String(vendedorId).trim();
    if (!isNaN(parseInt(vendedorIdStr)) && String(parseInt(vendedorIdStr)) === vendedorIdStr) {
      const reqVen = new sql.Request(tx);
      reqVen.input('vid', sql.Int, parseInt(vendedorIdStr));
      const resVen = await reqVen.query(`SELECT codven FROM ${TABLE_NAMES.vendedores} WHERE id = @vid`);
      if (resVen.recordset.length > 0) {
        codVendedorFinal = resVen.recordset[0].codven;
      } else {
          // Validar existencia
          const reqCheck = new sql.Request(tx);
          reqCheck.input('num', sql.VarChar(50), numeroPedido);
          const check = await reqCheck.query(`SELECT id FROM ${TABLE_NAMES.pedidos} WHERE numero_pedido = @num`);
          if (check.recordset.length > 0) throw new Error('Número de pedido duplicado');
      }
    } else {
      codVendedorFinal = vendedorIdStr;
    }
  }
  reqHead.input('codven', sql.VarChar(20), codVendedorFinal);

  reqHead.input('empresa_id', sql.Int, empresaIdValid);
  reqHead.input('cotizacion_id', sql.Int, cotizacionId || null);
  reqHead.input('subtotal', sql.Decimal(18, 2), subtotalFinal);
  reqHead.input('descuento_valor', sql.Decimal(18, 2), descuentoFinal);
  reqHead.input('descuento_porcentaje', sql.Decimal(5, 2), descPorcFinal);
  reqHead.input('iva_valor', sql.Decimal(18, 2), ivaValFinal);
  reqHead.input('iva_porcentaje', sql.Decimal(5, 2), ivaPorcFinal);
  reqHead.input('total', sql.Decimal(18, 2), totalFinal);
  reqHead.input('observaciones', sql.VarChar(500), observaciones || '');
  reqHead.input('estado', sql.VarChar(20), 'B'); // Borrador mapped

  let formaPagoFinal = '01';

  // Lógica de forma de pago mejorada:
  // 1. Si viene explícita en body, usarla.
  // 2. Si no viene, intentar usar la condición de pago del cliente.
  // 3. Fallback a '01' (Contado).

  if (formaPago) {
    const fpStr = String(formaPago).trim();
    if (fpStr === '1' || fpStr.toLowerCase() === 'contado') formaPagoFinal = '01';
    else if (fpStr === '2' || fpStr.toLowerCase() === 'credito' || fpStr.toLowerCase() === 'crédito') formaPagoFinal = '02';
    else formaPagoFinal = fpStr.substring(0, 2);
  } else {
    // Intentar obtener del cliente si no se especificó
    const reqCliFP = new sql.Request(tx);
    // Asumimos que clienteData ya se cargó arriba, pero necesitamos informacion extra (condicion_pago, dias_credito)
    // La consulta original arriba solo traía codter, nomter, codven. 
    // Hacemos una nueva consulta rápida o mejoramos la de arriba? 
    // Mejoramos la consulta independiente para no tocar demasiado código legacy arriba si no es necesario.
    try {
      const resCliFP = await reqCliFP.query(`SELECT condicion_pago, dias_credito FROM ${TABLE_NAMES.clientes} WHERE codter = '${codTerFinal}'`);
      if (resCliFP.recordset.length > 0) {
        const cliFP = resCliFP.recordset[0];
        if ((cliFP.dias_credito && cliFP.dias_credito > 0) ||
          (cliFP.condicion_pago && (cliFP.condicion_pago.toLowerCase().includes('crédito') || cliFP.condicion_pago === '2'))) {
          formaPagoFinal = '02'; // Crédito
        } else {
          formaPagoFinal = '01'; // Contado
        }
      }
    } catch (errFP) {
      console.warn('No se pudo obtener condición pago cliente, usando default Contado', errFP);
    }
  }
  reqHead.input('formapago', sql.NChar(4), formaPagoFinal);

      const headQuery = `
        INSERT INTO ${TABLE_NAMES.pedidos} (
          numero_pedido, fecha_pedido, fecha_entrega_estimada, codter, codven, empresa_id,
          cotizacion_id, subtotal, descuento_valor, descuento_porcentaje, iva_valor,
          iva_porcentaje, total, observaciones, estado, fec_creacion, fec_modificacion, formapago
        ) VALUES (
          @numero_pedido, @fecha_pedido, @fecha_entrega_estimada, @codter, @codven, @empresa_id,
          @cotizacion_id, @subtotal, @descuento_valor, @descuento_porcentaje, @iva_valor,
          @iva_porcentaje, @total, @observaciones, @estado, GETDATE(), GETDATE(), @formapago
        );
        SELECT SCOPE_IDENTITY() AS id;
      `;

          const cant = validateDecimal18_2(item.cantidad, 'cant');
          const prec = validateDecimal18_2(item.precioUnitario, 'prec');
          
          // Calcular descuentos por item correctamente
          let dctoVal = 0;
          if (item.descuentoValor) {
             dctoVal = validateDecimal18_2(item.descuentoValor, 'dctoVal');
          } else if (item.descuentoPorcentaje) {
             dctoVal = (cant * prec) * (parseFloat(item.descuentoPorcentaje)/100);
          }
          dctoVal = validateDecimal18_2(dctoVal, 'dcto');

          const ivaVal = validateDecimal18_2(item.valorIva || 0, 'iva');
          
          reqDet.input('numped', sql.Char(8), numpedLegacy.substring(0, 8).padStart(8, '0'));
          reqDet.input('codins', sql.Char(8), codIns.padStart(8, '0'));
          reqDet.input('valins', sql.Decimal(18, 2), prec);
          reqDet.input('canped', sql.Decimal(18, 2), cant);
          reqDet.input('ivaped', sql.Decimal(18, 2), ivaVal);
          reqDet.input('dctped', sql.Decimal(18, 2), dctoVal);
          reqDet.input('estped', sql.Char(1), 'B');
          reqDet.input('codalm', sql.Char(3), codAlmFinal.substring(0, 3).padStart(3, '0'));
          reqDet.input('pedido_id', sql.Int, pedidoId);
          reqDet.input('feccargo', sql.Date, fechaPedido || new Date());

          reqDet.input('codtec', sql.VarChar(20), ''); // Valor por defecto
          
          await reqDet.query(`
            INSERT INTO ${TABLE_NAMES.pedidos_detalle} (
               numped, codins, valins, canped, ivaped, dctped, estped, codalm, pedido_id, feccargo, Fecsys, codtec
            ) VALUES (
               @numped, @codins, @valins, @canped, @ivaped, @dctped, @estped, @codalm, @pedido_id, @feccargo, GETDATE(), @codtec
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
         SET estado = @estado, fec_modificacion = GETDATE()
         WHERE id = @id;
         
         SELECT 
           id, numero_pedido, estado 
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
      SELECT TOP 1 numero_pedido 
      FROM ${TABLE_NAMES.pedidos} 
      ORDER BY id DESC
    `);

    let nextNum = '000001';
    if (result.recordset.length > 0) {
      const lastNum = result.recordset[0].numero_pedido;
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

module.exports = {
  getAllOrders,
  getOrderDetails,
  createOrder,
  createOrderInternal,
  updateOrder,
  getNextOrderNumber,
  sendOrderEmail
};
