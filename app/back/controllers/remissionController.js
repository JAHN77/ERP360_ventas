const sql = require('mssql');
const { getConnection, executeQuery, executeQueryWithParams } = require('../services/sqlServerClient.cjs');
const { QUERIES, TABLE_NAMES } = require('../services/dbConfig.cjs');
const { mapEstadoToDb, mapEstadoFromDb } = require('../utils/helpers');
const InventoryService = require('../services/inventoryService.js');

// Obtener todas las remisiones
const getAllRemissions = async (req, res) => {
  try {
    const { page = '1', pageSize = '20', search, pedidoId, fechaInicio, fechaFin, estado } = req.query;
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(5, parseInt(String(pageSize), 10) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    let whereClauses = [];
    const params = { offset, pageSize: pageSizeNum };

    if (search && typeof search === 'string' && search.trim()) {
      whereClauses.push('(r.numrem LIKE @search OR r.observacion LIKE @search)');
      params.search = `%${search.trim()}%`;
    }

    if (pedidoId) {
      // ven_remisiones no tiene pedido_id, se filtra por 1=0 si se pide para evitar errores
      // O si se conoce la columna equivalente, se usa. Por ahora 1=0.
      whereClauses.push('1=0');
    }

    if (estado && estado.trim()) {
      const dbEstado = mapEstadoToDb(estado);
      whereClauses.push('r.estado = @estado');
      params.estado = dbEstado;
    }

    if (fechaInicio) {
      whereClauses.push('r.fecrem >= @fechaInicio');
      params.fechaInicio = fechaInicio;
    }

    if (fechaFin) {
      whereClauses.push('r.fecrem <= @fechaFin');
      params.fechaFin = fechaFin;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Usamos la query base pero necesitamos añadir paginación y filtrado dinámico
    // La query en dbConfig tiene ORDER BY incluido, así que lo removemos para construir la nuestra
    // O mejor, construimos una query similar basada en esa estructura
    const baseQuery = `
      SELECT 
        r.id,
        LTRIM(RTRIM(COALESCE(r.numrem, ''))) as numeroRemision,
        LTRIM(RTRIM(COALESCE(r.codalm, ''))) as codalm,
        CAST(r.fecrem AS DATE) as fechaRemision,
        NULL as pedidoId,
        LTRIM(RTRIM(COALESCE(r.codter, ''))) as clienteId,
        LTRIM(RTRIM(COALESCE(r.codven, ''))) as vendedorId,
        LTRIM(RTRIM(COALESCE(r.estado, 'BORRADOR'))) as estado,
        LTRIM(RTRIM(COALESCE(r.observacion, ''))) as observaciones,
        LTRIM(RTRIM(COALESCE(r.usuario, ''))) as codUsuario,
        COALESCE(r.fecrem, GETDATE()) as fechaCreacion,
        NULL as facturaId,
        r.total as total
      FROM ${TABLE_NAMES.remisiones} r
      ${whereClause}
      ORDER BY r.fecrem DESC, r.id DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `;

    const remisiones = await executeQueryWithParams(baseQuery, params, req.db_name);

    // Mapear estados y datos adicionales
    const remisionesMapeadas = remisiones.map(r => ({
      ...r,
      estado: mapEstadoFromDb(r.estado)
    }));

    // Obtener total para paginación
    const countQuery = `SELECT COUNT(*) as total FROM ${TABLE_NAMES.remisiones} r ${whereClause}`;
    const countResult = await executeQueryWithParams(countQuery, params, req.db_name);
    const totalRecords = countResult[0]?.total || 0;

    res.json({
      success: true,
      data: remisionesMapeadas,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        totalRecords,
        totalPages: Math.ceil(totalRecords / pageSizeNum)
      }
    });

  } catch (error) {
    console.error('Error getting remissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo remisiones',
      error: error.message
    });
  }
};

// Obtener detalles de una remisión
const getRemissionDetails = async (req, res) => {
  try {
    const { remisionId } = req.query; // Para /api/remisiones-detalle?remisionId=X
    const { id } = req.params; // Para /api/remisiones/:id/detalle

    const targetId = id || remisionId;

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'ID de remisión requerido' });
    }

    // Usamos la query de dbConfig que ya tiene lógica compleja para precios
    // Pero necesitamos filtrar por ID

    // Extraer la query base de dbConfig y añadir WHERE
    // Nota: QUERIES.GET_REMISIONES_DETALLE tiene "WHERE rd.remision_id IS NOT NULL" al final
    // Podemos anexar "AND rd.remision_id = @id"

    const query = `${QUERIES.GET_REMISIONES_DETALLE} AND rd.remision_id = @id`;

    const detalles = await executeQueryWithParams(query, { id: parseInt(targetId, 10) }, req.db_name);

    res.json({
      success: true,
      data: detalles
    });

  } catch (error) {
    console.error('Error getting remission details:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo detalles de remisión',
      error: error.message
    });
  }
};

// Actualizar remisión (Solo PUT /api/remisiones/:id)
const updateRemission = async (req, res) => {
  console.log(`✅ Endpoint PUT /api/remisiones/:id alcanzado`);
  const { id } = req.params;
  const body = req.body || {};
  const idNum = parseInt(id, 10);

  if (isNaN(idNum)) {
    return res.status(400).json({
      success: false,
      message: `ID de remisión inválido: ${id}`,
      error: 'INVALID_ID'
    });
  }

  console.log(`📥 Recibida solicitud PUT /api/remisiones/${idNum} con body:`, JSON.stringify(body, null, 2));

  try {
    const pool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const reqUpdate = new sql.Request(tx);
      const updates = [];

      if (body.estado !== undefined) {
        const estadoMapeado = mapEstadoToDb(body.estado);
        updates.push('estado = @estado');
        reqUpdate.input('estado', sql.VarChar(20), estadoMapeado);
        console.log(`🔄 Actualizando estado: ${body.estado} → ${estadoMapeado} (BD)`);
      }

      if (body.observaciones !== undefined) {
        updates.push('observacion = @observacion');
        reqUpdate.input('observacion', sql.VarChar(500), body.observaciones || '');
      }

      if (body.codalm !== undefined) {
        updates.push('codalm = @codalm');
        reqUpdate.input('codalm', sql.VarChar(10), body.codalm);
      }

      if (body.codven !== undefined) {
        updates.push('codven = @codven');
        reqUpdate.input('codven', sql.VarChar(20), body.codven || null);
      }

      if (updates.length === 0) {
        await tx.rollback();
        return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
      }

      // Verificar existencia
      const reqCheck = new sql.Request(tx);
      reqCheck.input('remisionId', sql.Int, idNum);
      const checkResult = await reqCheck.query(`
        SELECT id, numrem, estado, pedido_id, codter
        FROM ${TABLE_NAMES.remisiones} 
        WHERE id = @remisionId
      `);

      if (checkResult.recordset.length === 0) {
        await tx.rollback();
        return res.status(404).json({
          success: false,
          message: `Remisión con ID ${idNum} no existe`,
          error: 'REMISION_NOT_FOUND'
        });
      }

      const remisionActual = checkResult.recordset[0];
      const estadoActualMapeado = mapEstadoFromDb(remisionActual.estado);

      // Validaciones de negocio
      if (body.estado === 'ENTREGADO' || body.estado === 'ENTREGADA') {
        if (estadoActualMapeado !== 'BORRADOR' && estadoActualMapeado !== 'EN_TRANSITO') {
          await tx.rollback();
          return res.status(400).json({
            success: false,
            message: `No se puede marcar como entregada una remisión en estado '${estadoActualMapeado}'`,
            error: 'ESTADO_INVALIDO'
          });
        }
      }

      reqUpdate.input('remisionId', sql.Int, idNum);
      const query = `
        UPDATE ${TABLE_NAMES.remisiones} 
        SET ${updates.join(', ')}
        WHERE id = @remisionId;
        SELECT * FROM ${TABLE_NAMES.remisiones} WHERE id = @remisionId;
      `;

      const result = await reqUpdate.query(query);

      if (result.recordset.length === 0) {
        await tx.rollback();
        throw new Error('Error actualizando remisión (optimistic locking failed?)');
      }

      await tx.commit();

      const updatedRemision = result.recordset[0];
      res.json({
        success: true,
        data: {
          id: updatedRemision.id,
          numeroRemision: updatedRemision.numero_remision,
          estado: mapEstadoFromDb(updatedRemision.estado),
          observaciones: updatedRemision.observaciones,
          codalm: updatedRemision.codalm,
          fechaRemision: updatedRemision.fecha_remision
        }
      });

    } catch (innerError) {
      await tx.rollback();
      throw innerError;
    }
  } catch (error) {
    console.error('Error updating remission:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando remisión',
      error: error.message
    });
  }
};

// Crear nueva remisión
const createRemission = async (req, res) => {
  const {
    pedidoId,
    clienteId,
    vendedorId,
    codalm = '001', // Valor por defecto
    items,
    observaciones,
    fechaRemision,
    codusu = 'SISTEMA'
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'La remisión debe tener al menos un ítem'
    });
  }

  /*
  // Validación estricta de pedidoId: comentado por flexibilidad
  if (!pedidoId) {
    return res.status(400).json({ success: false, message: 'El ID del pedido es obligatorio' });
  }
  */

  let transaction;
  try {
    const pool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const requestNum = new sql.Request(transaction);
    const numResult = await requestNum.query(`
      SELECT TOP 1 numero_remision 
      FROM ${TABLE_NAMES.remisiones} 
      ORDER BY id DESC
    `);

    let nextNum = 1;
    if (numResult.recordset.length > 0) {
      const lastNumStr = numResult.recordset[0].numero_remision;
      const soloDigitos = String(lastNumStr).replace(/\D/g, '');
      if (soloDigitos) {
        nextNum = parseInt(soloDigitos, 10) + 1;
      }
    }
    const numeroRemision = String(nextNum).padStart(6, '0');

    // 2. Insertar Encabezado
    const requestEnc = new sql.Request(transaction);
    requestEnc.input('numeroRemision', sql.VarChar(20), numeroRemision);
    requestEnc.input('fechaRemision', sql.DateTime, fechaRemision ? new Date(fechaRemision) : new Date());
    requestEnc.input('pedidoId', sql.Int, pedidoId || null);
    requestEnc.input('codter', sql.VarChar(20), clienteId || null);
    requestEnc.input('codven', sql.VarChar(20), vendedorId || null);
    requestEnc.input('codalm', sql.VarChar(10), codalm);
    requestEnc.input('estado', sql.VarChar(20), 'BORRADOR'); // Siempre inicia en borrador
    requestEnc.input('observaciones', sql.VarChar(500), observaciones || '');
    requestEnc.input('codusu', sql.VarChar(20), codusu);

    // Insertar y retornar ID
    const encResult = await requestEnc.query(`
      INSERT INTO ${TABLE_NAMES.remisiones} (
        numero_remision, fecha_remision, pedido_id, codter, codven, codalm, 
        estado, observaciones, codusu, fec_creacion
      ) VALUES (
        @numeroRemision, @fechaRemision, @pedidoId, @codter, @codven, @codalm,
        'BORRADOR', @observaciones, @codusu, GETDATE()
      );
      SELECT SCOPE_IDENTITY() as id;
    `);

    const remisionId = encResult.recordset[0].id;
    console.log(`✅ Remisión creada con ID: ${remisionId}, Número: ${numeroRemision}`);

    // 3. Insertar Detalles
    for (const item of items) {
      const requestDet = new sql.Request(transaction);
      requestDet.input('remisionId', sql.Int, remisionId);
      requestDet.input('detaPedidoId', sql.Int, item.detaPedidoId || null);
      requestDet.input('codProducto', sql.VarChar(20), item.codProducto || '');
      // Asegurar que cantidad enviada es la que el usuario definió (cantAEnviar en frontend -> cantidadEnviada en envio)
      const qty = parseFloat(item.cantidadEnviada || item.cantidad || 0);
      requestDet.input('cantidadEnviada', sql.Decimal(18, 2), qty);

      await requestDet.query(`
        INSERT INTO ${TABLE_NAMES.remisiones_detalle} (
          remision_id, deta_pedido_id, codins, cantidad_enviada, 
          cantidad_facturada, cantidad_devuelta
        ) VALUES (
          @remisionId, @detaPedidoId, @codProducto, @cantidadEnviada,
          0, 0
        );
      `);

      // KARDEX: Registrar Salida por Remisión
      // Obtener datos del producto (ID real y costo) Y PRECIO DE LISTA 07
      const reqProdId = new sql.Request(transaction);
      reqProdId.input('cprod', sql.VarChar(20), item.codProducto || '');

      // Query actualizada según requerimiento usuario:
      // Usar inv_detaprecios con codtar='07' para obtener el precio con IVA base
      const resProdId = await reqProdId.query(`
        SELECT TOP 1 
          i.id, 
          i.ultimo_costo, 
          0 as tasa_iva,
          dp.valins as precio_lista_07
        FROM ${TABLE_NAMES.productos} i
        LEFT JOIN inv_detaprecios dp ON dp.codins = i.codins AND dp.codtar = '07'
        WHERE i.codins = @cprod
      `);

      if (resProdId.recordset.length > 0) {
        const pInfo = resProdId.recordset[0];

        // Precio de venta real para la transacción (documento)
        let precioVentaTransaccion = 0;

        // 1. Intentar precio del pedido si existe
        if (item.detaPedidoId) {
          try {
            const reqPedPrice = new sql.Request(transaction);
            reqPedPrice.input('dpid', sql.Int, item.detaPedidoId);
            const resPedPrice = await reqPedPrice.query(`SELECT valins FROM ${TABLE_NAMES.pedidos_detalle} WHERE id = @dpid`);
            if (resPedPrice.recordset.length > 0) {
              precioVentaTransaccion = resPedPrice.recordset[0].valins;
            }
          } catch (errPrice) {
            console.warn('No se pudo obtener precio del pedido para Kardex', errPrice);
          }
        }

        // 2. Si no hay pedido, usar precio lista 07 como referencia de venta o 0
        if (!precioVentaTransaccion) {
          precioVentaTransaccion = pInfo.precio_lista_07 || 0;
        }

        // Parsear numeroRemision 'REM-00025' a entero 25 para dockar/numrem
        const remNumInt = parseInt(String(numeroRemision).replace(/\D/g, '')) || 0;

        // CALCULAR VENKAR (Precio Base) SEGÚN FÓRMULA USUARIO
        // Formula: precio_lista_07 / (1 + (tasa_iva * 0.01))
        const tasaIva = pInfo.tasa_iva || 0;
        const precioLista07 = parseFloat(pInfo.precio_lista_07) || 0;

        let precioBaseVal = 0; // Para venkar

        if (precioLista07 > 0) {
          precioBaseVal = precioLista07 / (1 + (tasaIva / 100));
        } else {
          // Fallback para venkar: ultimo_costo
          precioBaseVal = parseFloat(pInfo.ultimo_costo) || 0;
        }

        // DEFINIR COSKAR: Ultimo Costo (según solicitud usuario)
        const costoParaKardex = parseFloat(pInfo.ultimo_costo) || 0;

        await InventoryService.registrarSalida({
          transaction,
          productoId: pInfo.id,
          cantidad: qty,
          bodega: codalm,
          numeroDocumentoInt: remNumInt,
          tipoMovimiento: 'SA',
          precioVenta: precioVentaTransaccion,
          precioBase: precioBaseVal, // -> venkar
          costo: costoParaKardex,      // -> coskar (y valinv)
          observaciones: `Remisión ${numeroRemision}`,
          codUsuario: codusu,
          clienteId: clienteId,
          numRemision: remNumInt
        });
      }
    }

    // 4. Actualizar estado del Pedido
    if (pedidoId) {
      const requestStatus = new sql.Request(transaction);
      requestStatus.input('pid', sql.Int, pedidoId);

      // Calcular si todos los items han sido totalmente remitidos
      // Se compara cantidad pedida vs (suma de cantidades enviadas en remisiones no anuladas)
      // FIX: ven_detapedidos NO tiene columna 'id', se agrupa por codins
      const statusQuery = `
        WITH ItemStatus AS (
          SELECT 
            pd.codins,
            pd.canped as CantidadPedida,
            ISNULL(SUM(rd.cantidad_enviada), 0) as CantidadRemitida
          FROM ${TABLE_NAMES.pedidos_detalle} pd
          LEFT JOIN ${TABLE_NAMES.remisiones_detalle} rd ON rd.deta_pedido_id IS NULL 
               AND rd.remision_id IN (SELECT id FROM ${TABLE_NAMES.remisiones} WHERE pedido_id = @pid AND (estado IS NULL OR estado != 'ANULADA'))
               AND LTRIM(RTRIM(rd.codins)) = LTRIM(RTRIM(pd.codins))
          WHERE pd.pedido_id = @pid
          GROUP BY pd.codins, pd.canped
        )
        SELECT 
          CASE 
            WHEN COUNT(*) = 0 THEN 'C' -- CONFIRMADO -> 'C'
            WHEN MIN(CantidadRemitida - CantidadPedida) >= 0 THEN 'M' -- REMITIDO -> 'M'
            ELSE 'L' -- PARCIALMENTE_REMITIDO -> 'L' (FIXED collision with P/Timbrando)
          END as NuevoEstado
        FROM ItemStatus
      `;

      const statusResult = await requestStatus.query(statusQuery);

      if (statusResult.recordset.length > 0) {
        let nuevoEstado = statusResult.recordset[0].NuevoEstado;

        // Validar si el estado calculado es PARCIALMENTE_REMITIDO pero no se envió nada (caso raro)
        // O si ya estaba REMITIDO, no devolverlo a PARCIALMENTE si hay sobre-entrega (ya manejado por >= 0)

        const updatePed = new sql.Request(transaction);
        updatePed.input('nest', sql.VarChar(20), nuevoEstado);
        updatePed.input('pid', sql.Int, pedidoId);
        await updatePed.query(`UPDATE ${TABLE_NAMES.pedidos} SET estado = @nest WHERE id = @pid`);

        console.log(`🔄 Estado del pedido ${pedidoId} actualizado a: ${nuevoEstado}`);
      }
    }

    await transaction.commit();

    res.json({
      success: true,
      message: 'Remisión creada exitosamente',
      data: {
        id: remisionId,
        numeroRemision
      }
    });

  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Error al hacer rollback:', rollbackError);
      }
    }
    console.error('Error creating remission:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la remisión',
      error: error.message
    });
  }
};

const { sendDocumentEmail } = require('../services/emailService.cjs');

const driveService = require('../services/driveService.js');

const sendRemissionEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { destinatario, asunto, mensaje, pdfBase64 } = req.body;

    const pool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);
    const idNum = parseInt(id, 10);

    // Obtener Datos de Remición
    const remQuery = `
      SELECT 
        r.numero_remision, 
        r.fecha_remision, 
        c.nomter, 
        c.EMAIL 
      FROM ${TABLE_NAMES.remisiones} r
      LEFT JOIN ${TABLE_NAMES.clientes} c ON LTRIM(RTRIM(c.codter)) = LTRIM(RTRIM(r.codter))
      WHERE r.id = @id
    `;
    const remRes = await executeQueryWithParams(remQuery, { id: idNum }, req.db_name);

    if (remRes.length === 0) {
      return res.status(404).json({ success: false, message: 'Remisión no encontrada' });
    }

    const remision = remRes[0];
    const clienteEmail = destinatario || remision.EMAIL;

    // --- NUEVA LÓGICA DE GOOGLE DRIVE ---
    // Convertir el PDF de Base64 a Buffer para poder subirlo
    const cleanBase64 = pdfBase64.split(',')[1] || pdfBase64;
    const pdfBuffer = Buffer.from(cleanBase64, 'base64');

    // --- PARALELIZACIÓN: Drive + Email ---
    // Ejecutamos ambas tareas simultáneamente para reducir el tiempo de espera del usuario

    // Tarea 1: Subir a Drive
    const driveTask = async () => {
      try {
        const fechaDoc = new Date(remision.fecha_remision);
        const folderId = await driveService.ensureHierarchy('Remisiones', fechaDoc);
        const safeRecipient = (remision.nomter || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
        const nombreArchivo = `REM-${remision.numero_remision}-${safeRecipient}.pdf`;

        const driveFile = await driveService.uploadFile(
          nombreArchivo, 'application/pdf', pdfBuffer, folderId, true
        );
        console.log('✅ Guardado en Drive OK:', driveFile.id);
        return { success: true, type: 'drive' };
      } catch (driveErr) {
        console.error('❌ Error Drive:', driveErr.message);
        return { success: false, type: 'drive', error: driveErr.message };
      }
    };

    // Tarea 2: Enviar Email
    const emailTask = async () => {
      const documentDetails = [
        { label: 'Fecha Remisión', value: new Date(remision.fecha_remision).toLocaleDateString('es-CO') }
      ];
      await sendDocumentEmail({
        to: clienteEmail,
        customerName: remision.nomter,
        documentNumber: remision.numero_remision,
        documentType: 'Remisión',
        pdfBuffer: pdfBuffer,
        subject: asunto,
        body: mensaje,
        documentDetails,
        processSteps: `<p>Le informamos que su pedido ha sido despachado. Adjuntamos la remisión para que pueda validar las cantidades físicas al momento de la recepción. Por favor, devuélvanos una copia firmada o confirme por este medio.</p>`
      });
      return { success: true, type: 'email' };
    };

    // Ejecutar en paralelo
    console.log('🚀 Iniciando envío paralelo (Drive + Email)...');
    const [driveResult, emailResult] = await Promise.all([driveTask(), emailTask()]);

    // Verificar si el email falló (que es lo crítico para el usuario)
    if (!emailResult.success) {
      throw new Error('El envío del correo falló.');
    }

    res.json({ success: true, message: 'Remisión guardada en Drive y correo enviado' });

  } catch (error) {
    console.error('Error general enviando remisión:', error);
    res.status(500).json({ success: false, message: 'Error en el proceso', error: error.message });
  }
};

/**
 * Convierte una remisión a factura
 * POST /api/remisiones/:id/convert-to-invoice
 */
const convertToInvoice = async (req, res) => {
  const { id } = req.params;

  const pool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    // 1. Verificar que la remisión existe y no tiene factura asociada
    const reqCheck = new sql.Request(tx);
    reqCheck.input('id', sql.Int, parseInt(id));
    const checkRes = await reqCheck.query(`
      SELECT * FROM ${TABLE_NAMES.remisiones} WHERE id = @id
    `);

    if (checkRes.recordset.length === 0) {
      await tx.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Remisión no encontrada' 
      });
    }

    const remision = checkRes.recordset[0];

    // Verificar si ya tiene factura asociada
    if (remision.factura_id) {
      await tx.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Esta remisión ya tiene una factura asociada',
        facturaId: remision.factura_id
      });
    }

    // 2. Obtener items de la remisión con precios
    const reqItems = new sql.Request(tx);
    reqItems.input('remisionId', sql.Int, parseInt(id));
    const itemsRes = await reqItems.query(`
      SELECT 
        rd.codins as codProducto,
        rd.cantidad_enviada as cantidad,
        i.nomins as descripcion,
        i.referencia,
        i.tasa_iva as ivaPorcentaje,
        i.ultimo_costo as precioUnitario,
        i.id as productoId,
        i.undins as unidadMedida
      FROM ${TABLE_NAMES.remisiones_detalle} rd
      LEFT JOIN ${TABLE_NAMES.productos} i ON LTRIM(RTRIM(i.codins)) = LTRIM(RTRIM(rd.codins))
      WHERE rd.remision_id = @remisionId
    `);

    const itemsRemision = itemsRes.recordset;

    if (itemsRemision.length === 0) {
      await tx.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'La remisión no tiene items para facturar' 
      });
    }

    // 3. Calcular totales
    const { validateDecimal18_2 } = require('../utils/helpers');
    const rnd = (val) => Math.round((val || 0) * 100) / 100;
    
    let subtotalCalculado = 0;
    let ivaCalculado = 0;

    const itemsParaFactura = itemsRemision.map(i => {
      const precio = rnd(i.precioUnitario);
      const cant = rnd(i.cantidad);
      const ivaPorc = rnd(i.ivaPorcentaje);

      const subtotalItem = precio * cant;
      const ivaItem = rnd(subtotalItem * (ivaPorc / 100));
      const totalItem = rnd(subtotalItem + ivaItem);

      subtotalCalculado += subtotalItem;
      ivaCalculado += ivaItem;

      return {
        productoId: i.productoId,
        codProducto: i.codProducto,
        descripcion: i.descripcion,
        referencia: i.referencia,
        cantidad: cant,
        precioUnitario: precio,
        ivaPorcentaje: ivaPorc,
        valorIva: ivaItem,
        subtotal: subtotalItem,
        total: totalItem,
        unidadMedida: i.unidadMedida
      };
    });

    const totalCalculado = rnd(subtotalCalculado + ivaCalculado);

    // 4. Generar número de factura
    const reqUltimoNum = new sql.Request(tx);
    const ultimoNumResult = await reqUltimoNum.query(`
      SELECT TOP 1 numfact 
      FROM ${TABLE_NAMES.facturas} 
      WHERE ISNUMERIC(numfact) = 1 
      ORDER BY CAST(numfact AS BIGINT) DESC
    `);

    let nuevoNumeroFactura = '000001';
    if (ultimoNumResult.recordset.length > 0) {
      const ultimoNum = ultimoNumResult.recordset[0].numfact;
      const consecutivo = parseInt(ultimoNum, 10);
      if (!isNaN(consecutivo)) {
        nuevoNumeroFactura = String(consecutivo + 1).padStart(6, '0');
      }
    }

    // 5. Insertar encabezado de factura
    const reqFactHead = new sql.Request(tx);
    reqFactHead.input('numfact', sql.VarChar(50), nuevoNumeroFactura);
    reqFactHead.input('fecfac', sql.Date, new Date());
    reqFactHead.input('venfac', sql.Date, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // 30 días
    reqFactHead.input('codter', sql.VarChar(20), remision.codter);
    reqFactHead.input('codven', sql.VarChar(20), remision.codven);
    reqFactHead.input('codalm', sql.VarChar(10), remision.codalm || '001');
    reqFactHead.input('valvta', sql.Decimal(18, 2), rnd(subtotalCalculado));
    reqFactHead.input('valiva', sql.Decimal(18, 2), rnd(ivaCalculado));
    reqFactHead.input('netfac', sql.Decimal(18, 2), totalCalculado);
    reqFactHead.input('estfac', sql.VarChar(1), 'B'); // Borrador
    reqFactHead.input('observa', sql.VarChar(500), `Factura desde remisión ${remision.numrem}`);
    reqFactHead.input('codusu', sql.VarChar(20), 'ADMIN');

    const factHeadQuery = `
      INSERT INTO ${TABLE_NAMES.facturas} (
        numfact, fecfac, venfac, codter, codven, codalm,
        valvta, valiva, netfac, estfac, observa, codusu, fecsys,
        tipfac, valdcto, valret, valrica, valriva, valotr, valant, valdev, abofac
      ) VALUES (
        @numfact, @fecfac, @venfac, @codter, @codven, @codalm,
        @valvta, @valiva, @netfac, @estfac, @observa, @codusu, GETDATE(),
        'V', 0, 0, 0, 0, 0, 0, 0, 0
      );
      SELECT SCOPE_IDENTITY() AS id;
    `;

    const factHeadRes = await reqFactHead.query(factHeadQuery);
    const facturaId = factHeadRes.recordset[0].id;

    // 6. Insertar detalles de factura
    for (const item of itemsParaFactura) {
      const reqFactDet = new sql.Request(tx);
      reqFactDet.input('id_factura', sql.Int, facturaId);
      reqFactDet.input('codins', sql.VarChar(50), item.codProducto);
      reqFactDet.input('qtyins', sql.Decimal(18, 2), item.cantidad);
      reqFactDet.input('valins', sql.Decimal(18, 2), item.precioUnitario);
      reqFactDet.input('ivains', sql.Decimal(18, 2), item.valorIva);
      reqFactDet.input('observa', sql.VarChar(500), item.descripcion || '');

      await reqFactDet.query(`
        INSERT INTO ${TABLE_NAMES.facturas_detalle} (
          id_factura, codins, qtyins, valins, ivains, observa, desins, valdescuento
        ) VALUES (
          @id_factura, @codins, @qtyins, @valins, @ivains, @observa, 0, 0
        )
      `);
    }

    // 7. Actualizar remisión con factura_id
    const reqUpdateRem = new sql.Request(tx);
    reqUpdateRem.input('facturaId', sql.Int, facturaId);
    reqUpdateRem.input('remisionId', sql.Int, parseInt(id));

    await reqUpdateRem.query(`
      UPDATE ${TABLE_NAMES.remisiones}
      SET factura_id = @facturaId
      WHERE id = @remisionId
    `);

    // 8. Actualizar cantidad_facturada en remisiones_detalle
    for (const item of itemsParaFactura) {
      const reqUpdateRemDet = new sql.Request(tx);
      reqUpdateRemDet.input('remisionId', sql.Int, parseInt(id));
      reqUpdateRemDet.input('codins', sql.VarChar(50), item.codProducto);
      reqUpdateRemDet.input('cantidad', sql.Decimal(18, 2), item.cantidad);

      await reqUpdateRemDet.query(`
        UPDATE ${TABLE_NAMES.remisiones_detalle}
        SET cantidad_facturada = @cantidad
        WHERE remision_id = @remisionId AND codins = @codins
      `);
    }

    // 9. Actualizar canfac en pedidos_detalle si la remisión tiene pedido asociado
    // Nota: ven_remisiones no tiene pedido_id directo en el esquema actual
    // Si se implementa en el futuro, agregar aquí la lógica

    await tx.commit();

    res.status(201).json({
      success: true,
      message: 'Factura creada exitosamente desde remisión',
      data: {
        facturaId: facturaId,
        numeroFactura: nuevoNumeroFactura,
        remisionId: id,
        itemsFacturados: itemsParaFactura.length,
        total: totalCalculado
      }
    });

  } catch (error) {
    if (tx) await tx.rollback();
    console.error('Error convirtiendo remisión a factura:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error convirtiendo remisión a factura',
      error: error.message 
    });
  }
};

module.exports = {
  getAllRemissions,
  getRemissionDetails,
  updateRemission,
  createRemission,
  sendRemissionEmail,
  convertToInvoice

};
