const sql = require('mssql');
const { executeQueryWithParams, getConnection } = require('../services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('../services/dbConfig.cjs');
const {
  mapEstadoToDb,
  mapEstadoFromDb,
  validateDecimal18_2,
  validateDecimal5_2
} = require('../utils/helpers');
const { generateQuotePdfBuffer } = require('../services/pdfService.cjs');
// sendCotizacionEmail removed (using sendDocumentEmail directly)
const { getCompanyLogo } = require('../utils/imageUtils.cjs');

const getAllQuotes = async (req, res) => {
  try {
    const { page = '1', pageSize = '100', search, estado } = req.query;
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const pageSizeNum = Math.min(10000, Math.max(10, parseInt(String(pageSize), 10) || 100)); // Máximo 10000, mínimo 10
    const offset = (pageNum - 1) * pageSizeNum;

    // Normalizar búsqueda y estado
    let searchTerm = null;
    if (search && typeof search === 'string' && search.trim() && search !== '[object Object]') {
      searchTerm = String(search).trim();
    }

    let estadoDb = null;
    if (estado && typeof estado === 'string' && estado.trim()) {
      estadoDb = mapEstadoToDb(estado.trim());
    }

    // Construir WHERE
    let whereClauses = [];
    const params = { offset, pageSize: pageSizeNum };

    if (estadoDb) {
      whereClauses.push('c.estado = @estado');
      params.estado = estadoDb;
    }

    if (searchTerm) {
      whereClauses.push('(c.numcot LIKE @search OR c.codter LIKE @search OR c.observa LIKE @search)');
      params.search = `%${searchTerm}%`;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Query principal con paginación
    const query = `
      SELECT 
        c.numcot               AS id,
        c.numcot               AS numeroCotizacion,
        c.feccot               AS fechaCotizacion,
        c.fecven               AS fechaVencimiento,
        c.codter               AS codter,
        COALESCE(cli.id, NULL) AS clienteId,
        CASE 
          WHEN cli.nomter IS NOT NULL AND LTRIM(RTRIM(cli.nomter)) != '' 
          THEN LTRIM(RTRIM(cli.nomter))
          ELSE NULL
        END AS clienteNombre,
        cli.TELTER             AS clienteTelefono,
        cli.CELTER             AS clienteCelular,
        cli.EMAIL              AS clienteEmail,
        LTRIM(RTRIM(c.codven)) AS vendedorId,
        LTRIM(RTRIM(c.codven)) AS codVendedor,
        c.codalm               AS codalm,
        c.codalm               AS empresaId,
        COALESCE(totals.subtotal, 0) AS subtotal,
        COALESCE(totals.descuentoValor, 0) AS descuentoValor,
        COALESCE(totals.ivaValor, 0) AS ivaValor,
        COALESCE(totals.total, 0) AS total,
        c.observa              AS observaciones,
        c.estcot               AS estado,
        '01' AS formaPago,
        COALESCE(c.abono, 0)   AS valorAnticipo,
        c.numsol               AS numOrdenCompra,
        NULL                   AS fechaAprobacion,
        c.codusu               AS codUsuario,
        NULL                   AS idUsuario,
        NULL                   AS codTarifa,
        NULL                   AS firmaVendedor,
        c.fecsys               AS fechaCreacion,
        NULL                   AS observacionesInternas,
        NULL                   AS listaPrecioId,
        NULL                   AS descuentoPorcentaje,
        NULL                   AS ivaPorcentaje,
        NULL                   AS domicilios,
        NULL                   AS approvedItems
    FROM ${TABLE_NAMES.cotizaciones} c
      LEFT JOIN ${TABLE_NAMES.clientes} cli ON RTRIM(LTRIM(cli.codter)) = RTRIM(LTRIM(c.codter))
      LEFT JOIN (
        SELECT 
          numcot, 
          SUM(candet * vundet) as subtotal,
          SUM((candet * vundet) * (COALESCE(dctdet, 0) / 100.0)) as descuentoValor,
          SUM(((candet * vundet) * (1 - (COALESCE(dctdet, 0) / 100.0))) * (COALESCE(ivadet, 0) / 100.0)) as ivaValor,
          SUM(((candet * vundet) * (1 - (COALESCE(dctdet, 0) / 100.0))) * (1 + (COALESCE(ivadet, 0) / 100.0))) as total
        FROM ven_detacotiz
        GROUP BY numcot
      ) totals ON totals.numcot = c.numcot
      ${whereClause}
      ORDER BY c.feccot DESC, c.numcot DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `;

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${TABLE_NAMES.cotizaciones} c
      ${whereClause}
    `;

    const [cotizaciones, countResult] = await Promise.all([
      executeQueryWithParams(query, params, req.db_name),
      executeQueryWithParams(countQuery, estadoDb || searchTerm ? { ...(estadoDb && { estado: estadoDb }), ...(searchTerm && { search: `%${searchTerm}%` }) } : {}, req.db_name)
    ]);

    // Mapear estados de BD a frontend
    const cotizacionesMapeadas = cotizaciones.map(c => ({
      ...c,
      estado: mapEstadoFromDb(c.estado)
    }));

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / pageSizeNum);

    res.json({
      success: true,
      data: cotizacionesMapeadas,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total: total,
        totalPages: totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Error fetching cotizaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo cotizaciones',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

const getQuoteDetails = async (req, res) => {
  try {
    const { cotizacionId, page = '1', pageSize = '500' } = req.query;
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const pageSizeNum = Math.min(1000, Math.max(50, parseInt(String(pageSize), 10) || 500));
    const offset = (pageNum - 1) * pageSizeNum;

    const params = { offset, pageSize: pageSizeNum };
    let whereClause = '';

    // Si se especifica cotizacionId, filtrar solo esos detalles (optimización importante)
    if (cotizacionId) {
      whereClause = 'WHERE d.id_cotizacion = @cotizacionId';
      // id_cotizacion es BIGINT en ven_detacotizacion, asegurar conversión correcta
      const cotizacionIdNum = typeof cotizacionId === 'number' ? cotizacionId : parseInt(String(cotizacionId).trim(), 10);
      if (isNaN(cotizacionIdNum)) {
        return res.status(400).json({
          success: false,
          message: 'cotizacionId inválido'
        });
      }
      params.cotizacionId = cotizacionIdNum;
    }

    // Query optimizado
    const query = `
      SELECT 
        CAST(d.numcot AS VARCHAR) + '-' + LTRIM(RTRIM(d.coddet)) AS id,
        d.numcot                  AS cotizacionId,
        COALESCE(p.id, NULL)      AS productoId,
        LTRIM(RTRIM(d.coddet))    AS codProducto,
        d.candet                  AS cantidad,
        COALESCE(d.canfac, 0)     AS cantFacturada,
        d.candet                  AS qtycot,
        COALESCE(d.vundet, 0)     AS precioUnitario,
        COALESCE(d.dctdet, 0)     AS descuentoPorcentaje,
        COALESCE(d.ivadet, 0)     AS ivaPorcentaje,
        NULL                      AS codigoMedida,
        'Unidad'                  AS unidadMedida,
        LTRIM(RTRIM(d.coddet))    AS referencia,
        d.estado                  AS estado,
        NULL                      AS numFactura,
        (d.candet * d.vundet)     AS subtotal,
        ((d.candet * d.vundet) * (1 - (COALESCE(d.dctdet, 0) / 100.0))) * (COALESCE(d.ivadet, 0) / 100.0) AS valorIva,
        ((d.candet * d.vundet) * (1 - (COALESCE(d.dctdet, 0) / 100.0))) * (1 + (COALESCE(d.ivadet, 0) / 100.0)) AS total,
        COALESCE(p.nomins, LTRIM(RTRIM(d.nomdet)), '') AS descripcion
      FROM ${TABLE_NAMES.cotizaciones_detalle} d
      LEFT JOIN ${TABLE_NAMES.productos} p ON LTRIM(RTRIM(p.codins)) = LTRIM(RTRIM(d.coddet))
      ${whereClause}
      ORDER BY d.numcot, d.coddet
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `;

    const detalles = await executeQueryWithParams(query, params, req.db_name);

    res.json({
      success: true,
      data: detalles,
      ...(cotizacionId ? {} : {
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          hasNextPage: detalles.length === pageSizeNum
        }
      })
    });
  } catch (error) {
    console.error('Error fetching cotizaciones detalle:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo detalles de cotizaciones',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

const createQuote = async (req, res) => {
  try {
    const {
      clienteId,
      fechaCotizacion,
      fechaVencimiento,
      vendedorId,
      observaciones,
      items,
      subtotal,
      descuentoValor,
      ivaValor,
      formaPago,
      empresaId
    } = req.body;

    // Helper to validate SQL Date
    const getValidDate = (dateStr, defaultDate = new Date()) => {
      if (!dateStr) return defaultDate;
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? defaultDate : d;
    };

    console.log('📝 [createQuote] Raw Body:', JSON.stringify(req.body, null, 2));

    if (!clienteId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: clienteId e items son obligatorios.'
      });
    }

    const pool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);
    const tx = new sql.Transaction(pool);

    try {
      await tx.begin();

      // 1. Cliente Lookup (Flexible: Try ID first, then codter)
      const reqCliente = new sql.Request(tx);
      const clienteIdStr = String(clienteId).trim();
      let clienteData = null;

      // Try by ID first (SAFE CHECK for potentially numeric ID)
      if (/^\d+$/.test(clienteIdStr)) {
        const resById = await tx.request()
          .input('cid', sql.Int, parseInt(clienteIdStr))
          .query(`SELECT codter, nomter, codven FROM ${TABLE_NAMES.clientes} WHERE id = @cid`);

        if (resById.recordset.length > 0) {
          clienteData = resById.recordset[0];
          console.log(`✅ Cliente encontrado por ID internal: ${clienteIdStr} -> ${clienteData.codter}`);
        }
      }

      // If not found by ID (or not numeric), try by codter (documento)
      if (!clienteData) {
        const resByCod = await tx.request()
          .input('ccod', sql.VarChar(20), clienteIdStr)
          .query(`SELECT codter, nomter, codven FROM ${TABLE_NAMES.clientes} WHERE LTRIM(RTRIM(codter)) = @ccod`);

        if (resByCod.recordset.length > 0) {
          clienteData = resByCod.recordset[0];
          console.log(`✅ Cliente encontrado por CODTER: ${clienteIdStr}`);
        }
      }

      if (!clienteData) {
        throw new Error(`Cliente no encontrado: ${clienteId}`);
      }

      const codTerFinal = clienteData.codter;

      // 2. Vendedor Lookup
      let codVendedorFinal = clienteData.codven || '001';
      if (vendedorId) {
        let vendedorIdStr = String(vendedorId).trim();
        // Check if it's a code or ID
        const reqVen = new sql.Request(tx);
        reqVen.input('vcod', sql.VarChar(20), vendedorIdStr);
        const resVen = await reqVen.query(`SELECT codven FROM ${TABLE_NAMES.vendedores} WHERE LTRIM(RTRIM(codven)) = @vcod`);
        if (resVen.recordset.length > 0) {
          codVendedorFinal = resVen.recordset[0].codven;
        } else {
          codVendedorFinal = vendedorIdStr;
        }
      }

      // 3. Generar Consecutivo (numcot)
      const reqUltimoNum = new sql.Request(tx);
      const ultimoNumResult = await reqUltimoNum.query(`
        SELECT TOP 1 numcot 
        FROM ${TABLE_NAMES.cotizaciones} 
        WHERE ISNUMERIC(numcot) = 1 
        ORDER BY CAST(numcot AS BIGINT) DESC
      `);

      let nuevoNumero = '000001';
      if (ultimoNumResult.recordset.length > 0) {
        const ultimoNum = ultimoNumResult.recordset[0].numcot;
        const consecutivo = parseInt(ultimoNum, 10);
        if (!isNaN(consecutivo)) {
          nuevoNumero = String(consecutivo + 1).padStart(6, '0');
        }
      }

      // 3. Insertar Header (ven_cotizacion) - Schema Actualizado (Legacy)
      // Columns: numcot, feccot, fecven, codter, codven, codalm, observa, estcot, formapago, fecsys, codusu
      const reqInsertHeader = new sql.Request(tx);
      reqInsertHeader.input('numcot', sql.VarChar(8), nuevoNumero);
      reqInsertHeader.input('feccot', sql.Date, getValidDate(fechaCotizacion));
      reqInsertHeader.input('fecven', sql.Date, getValidDate(fechaVencimiento, new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)));

      reqInsertHeader.input('codter', sql.VarChar(15), String(codTerFinal).substring(0, 15));
      reqInsertHeader.input('codven', sql.VarChar(3), String(codVendedorFinal || '001').substring(0, 3));

      let codAlmFinal = '001';
      if (empresaId) codAlmFinal = String(empresaId).trim().substring(0, 3);
      reqInsertHeader.input('codalm', sql.VarChar(3), codAlmFinal);

      reqInsertHeader.input('observa', sql.VarChar(200), String(observaciones || '').substring(0, 200));
      reqInsertHeader.input('estcot', sql.VarChar(1), 'B');

      let formaPagoFinal = '01';
      if (formaPago) {
        const fpStr = String(formaPago).trim();
        // Basic Mapping
        if (fpStr === '1' || fpStr.toLowerCase() === 'contado') formaPagoFinal = '01';
        else if (fpStr === '2' || fpStr.toLowerCase().includes('credito')) formaPagoFinal = '02';
        else formaPagoFinal = fpStr.substring(0, 2);
      }
      reqInsertHeader.input('formapago', sql.NChar(2), formaPagoFinal);

      reqInsertHeader.input('fecsys', sql.Date, new Date());
      reqInsertHeader.input('codusu', sql.VarChar(10), 'ADMIN');

      // Schema specific insertion
      const insertHeaderQuery = `
        INSERT INTO ${TABLE_NAMES.cotizaciones} (
          numcot, feccot, fecven, codter, codven, codalm,
          observa, estcot, formapago, fecsys, codusu
        ) VALUES (
          @numcot, @feccot, @fecven, @codter, @codven, @codalm,
          @observa, @estcot, @formapago, @fecsys, @codusu
        );
      `;
      // NO SCOPE_IDENTITY()
      await reqInsertHeader.query(insertHeaderQuery);

      // 4. Insertar Detalles (ven_detacotiz)
      for (const item of items) {
        if (!item.productoId && !item.codProducto) continue;

        const reqDetail = new sql.Request(tx);
        reqDetail.input('numcot', sql.VarChar(8), nuevoNumero);
        reqDetail.input('codalm', sql.VarChar(3), codAlmFinal);

        let codProductoStr = String(item.codProducto || '').trim();
        let descripcionItem = item.descripcion || null;

        // Fallback lookup
        if ((!codProductoStr || !descripcionItem) && item.productoId) {
          const reqProd = new sql.Request(tx);
          reqProd.input('pid', sql.Int, item.productoId);
          try {
            const resProd = await reqProd.query(`SELECT codins, nomins FROM ${TABLE_NAMES.productos} WHERE id = @pid`);
            if (resProd.recordset.length > 0) {
              if (!codProductoStr) codProductoStr = resProd.recordset[0].codins;
              if (!descripcionItem) descripcionItem = resProd.recordset[0].nomins;
            }
          } catch (e) { }
        }

        reqDetail.input('coddet', sql.VarChar(8), codProductoStr.substring(0, 8));
        reqDetail.input('nomdet', sql.VarChar(40), String(descripcionItem || '').substring(0, 40));

        const cant = validateDecimal18_2(item.cantidad, 'cantidad');
        const precio = validateDecimal18_2(item.precioUnitario, 'precio');

        // CORRECTION: Store PERCENTAGES in dctdet and ivadet as per schema (numeric(4,2) can only store percentages)
        let tasaDcto = parseFloat(item.descuentoPorcentaje || 0);
        let tasaIva = parseFloat(item.ivaPorcentaje || 0);

        // STRICT VALIDATION FOR SCHEMA LIMITS
        if (tasaDcto >= 100 || tasaDcto <= -100) {
          throw new Error(`El porcentaje de descuento (${tasaDcto}%) excede el límite permitido (99.99%).`);
        }
        if (tasaIva >= 100 || tasaIva <= -100) {
          throw new Error(`El porcentaje de IVA (${tasaIva}%) excede el límite permitido (99.99%).`);
        }

        // candet is numeric(9, 2) -> Max 9,999,999.99
        if (cant > 9999999.99) {
          throw new Error(`La cantidad (${cant}) excede el límite permitido (9,999,999.99).`);
        }

        // vundet is numeric(14, 2) -> Max 999,999,999,999.99
        if (precio > 999999999999.99) {
          throw new Error(`El precio unitario (${precio}) excede el límite permitido.`);
        }

        // Ensure we don't pass values that JS float precision messed up (e.g. 99.990000001)
        tasaDcto = Math.min(99.99, Math.max(-99.99, tasaDcto));
        tasaIva = Math.min(99.99, Math.max(-99.99, tasaIva));

        // Schema limits: 
        // candet: numeric(9,2)
        // vundet: numeric(14,2)
        // dctdet: numeric(4,2) -> Percentage
        // ivadet: numeric(4,2) -> Percentage

        reqDetail.input('candet', sql.Decimal(9, 2), cant);
        reqDetail.input('vundet', sql.Decimal(14, 2), precio);
        reqDetail.input('dctdet', sql.Decimal(4, 2), tasaDcto);
        reqDetail.input('ivadet', sql.Decimal(4, 2), tasaIva);

        reqDetail.input('estado', sql.VarChar(1), 'P');

        await reqDetail.query(`
          INSERT INTO ${TABLE_NAMES.cotizaciones_detalle} (
            numcot, codalm, coddet, nomdet, candet, vundet,
            dctdet, ivadet, estado
          ) VALUES (
            @numcot, @codalm, @coddet, @nomdet, @candet, @vundet,
            @dctdet, @ivadet, @estado
          )
        `);
      }

      await tx.commit();

      res.status(201).json({
        success: true,
        message: 'Cotización creada exitosamente',
        data: {
          id: nuevoNumero,
          numeroCotizacion: nuevoNumero
        }
      });

    } catch (err) {
      if (tx) await tx.rollback();
      throw err;
    }

  } catch (error) {
    console.error('❌ [createQuote] Error creating quote:', error);
    console.error('Stack:', error.stack);
    if (error.originalError) {
      console.error('Original SQL Error:', error.originalError);
    }

    res.status(500).json({
      success: false,
      message: 'Error creando cotización',
      error: error.message,
      details: error.originalError ? error.originalError.message : null
    });
  }
};

const updateQuote = async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  // Allow alphanumeric IDs (numcot)
  const idStr = String(id).trim();

  const pool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    // Verificar estado actual
    const reqCheck = new sql.Request(tx);
    reqCheck.input('id', sql.VarChar(20), idStr);
    const checkRes = await reqCheck.query(`SELECT estcot, numcot, codter FROM ${TABLE_NAMES.cotizaciones} WHERE numcot = @id`);

    if (checkRes.recordset.length === 0) {
      await tx.rollback();
      return res.status(404).json({ success: false, message: 'Cotización no encontrada' });
    }

    const currentState = checkRes.recordset[0];
    const currentStatusMapped = mapEstadoFromDb(currentState.estcot);

    // Preparar updates dinámicos
    let updates = [];
    const reqUpdate = new sql.Request(tx);
    reqUpdate.input('id', sql.VarChar(20), idStr);

    if (body.estado) {
      const estadoDb = mapEstadoToDb(body.estado);
      updates.push('estcot = @estado');
      reqUpdate.input('estado', sql.VarChar(10), estadoDb);

      // Si se aprueba, actualizar fecha_aprobacion
      if (body.estado === 'APROBADA' && currentStatusMapped !== 'APROBADA') {
        // updates.push('fecha_aprobacion = GETDATE()'); // No existe en tabla base
      }
    }

    if (body.fechaCotizacion) {
      updates.push('feccot = @fecha');
      reqUpdate.input('fecha', sql.Date, body.fechaCotizacion);
    }

    if (body.fechaVencimiento) {
      updates.push('fecven = @fecha_vence');
      reqUpdate.input('fecha_vence', sql.Date, body.fechaVencimiento);
    }

    if (body.observaciones !== undefined) {
      updates.push('observa = @observa');
      reqUpdate.input('observa', sql.VarChar(500), body.observaciones);
    }

    if (body.formaPago) {
      let fp = '01';
      const fps = String(body.formaPago).toLowerCase();
      if (fps === '1' || fps === 'contado' || fps === '01') fp = '01';
      else if (fps === '2' || fps === 'credito' || fps === '02') fp = '02';
      else fp = fps.substring(0, 2);

      updates.push('formapago = @formapago');
      reqUpdate.input('formapago', sql.NChar(2), fp);
    }

    if (updates.length > 0) {
      const updateQuery = `UPDATE ${TABLE_NAMES.cotizaciones} SET ${updates.join(', ')} WHERE numcot = @id`;
      await reqUpdate.query(updateQuery);
    }

    // Nota: Lógica de creación automática de pedido
    let pedidoCreado = null;
    if (body.estado === 'APROBADA' && currentStatusMapped !== 'APROBADA') {
      try {
        // 1. Obtener items de la cotización
        // 1. Obtener items de la cotización usando numcot (la relación legacy)
        const reqItems = new sql.Request(tx);
        // Usar numcot (que es igual a idStr en este contexto)
        reqItems.input('numCot', sql.VarChar(20), idStr);
        const itemsRes = await reqItems.query(`
                SELECT 
                    d.coddet as codProducto, 
                    d.candet as cantidad, 
                    d.vundet as precioUnitario, 
                    d.dctdet as descuentoPorcentaje, 
                    d.ivadet as ivaPorcentaje, 
                    ((d.candet * d.vundet) * (1 - (d.dctdet/100)) * (1 + (d.ivadet/100))) as total,
                    d.coddet as codigoMedida,
                    (SELECT TOP 1 id FROM inv_insumos WHERE codins = d.coddet) as productoId
                FROM ${TABLE_NAMES.cotizaciones_detalle} d 
                WHERE d.numcot = @numCot
            `);

        const itemsCotizacion = itemsRes.recordset;

        if (itemsCotizacion.length > 0) {
          // 2. Preparar payload para pedido
          // Necesitamos datos completos de la cotización header para mapear
          const cotHeader = currentState; // ya tenemos numcot, codter, etc.

          // Necesitamos más datos del header que tal vez no trajimos en el check inicial (solo trajimos estado, numcot, codter)
          // Vamos a traer todo el header actualizado
          const reqFullHeader = new sql.Request(tx);
          reqFullHeader.input('id', sql.VarChar(20), idStr);
          const fullHeaderRes = await reqFullHeader.query(`SELECT * FROM ${TABLE_NAMES.cotizaciones} WHERE numcot = @id`);
          const fullHeader = fullHeaderRes.recordset[0];

          // Función helper local para asegurar 2 decimales
          const rnd = (val) => Math.round((val || 0) * 100) / 100;

          const orderPayload = {
            clienteId: fullHeader.codter, // createOrderInternal maneja codter como string
            fechaPedido: new Date(),
            fechaEntregaEstimada: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 días
            vendedorId: fullHeader.cod_vendedor,
            observaciones: fullHeader.observa ? `Desde Cotización ${fullHeader.numcot}: ${fullHeader.observa}` : `Basado en Cotización ${fullHeader.numcot}`,
            items: itemsCotizacion.map(i => {
              const precio = rnd(i.precioUnitario);
              const cant = rnd(i.cantidad);
              const ivaPorc = rnd(i.ivaPorcentaje);

              // Calcular valor IVA individual: (Precio * Cantidad) * (%IVA / 100)
              const base = precio * cant;
              const valorIvaCalc = rnd(base * (ivaPorc / 100));
              const totalCalc = rnd(base + valorIvaCalc); // Total simple por línea

              return {
                productoId: i.productoId,
                codProducto: i.codProducto,
                cantidad: cant,
                precioUnitario: precio,
                descuentoPorcentaje: i.descuentoPorcentaje,
                ivaPorcentaje: ivaPorc,
                valorIva: valorIvaCalc, // CORRECCIÓN: Pasar el valor del IVA calculado
                total: totalCalc // Asegurar total consistente
              };
            }),
            subtotal: fullHeader.subtotal,
            descuentoValor: fullHeader.val_descuento,
            ivaValor: fullHeader.val_iva,
            total: fullHeader.subtotal - fullHeader.val_descuento + fullHeader.val_iva, // Recalcular simple
            formaPago: fullHeader.formapago,
            cotizacionId: idNum,
            empresaId: fullHeader.codalm,
            numeroPedido: 'AUTO',
            estado: 'B' // Asegurar explícitamente estado Borrador
          };

          const { createOrderInternal } = require('./orderController');
          pedidoCreado = await createOrderInternal(tx, orderPayload);

          // Actualizar cotización con ID de pedido si existiera campo (no existe explícitamente en cotización, pero pedido tiene cotizacion_id)
        }
      } catch (errPedido) {
        console.error('Error creando pedido automático:', errPedido);
        // No fallamos la aprobación si falla el pedido, pero retornamos warning (o podríamos fallar todo, decisión de diseño: mejor fallar para consistencia)
        throw new Error(`Error creando pedido automático: ${errPedido.message}`);
      }
    }

    // Obtener cotización actualizada para devolver al frontend
    const reqFinal = new sql.Request(tx);
    reqFinal.input('finalId', sql.VarChar(20), idStr);
    const finalRes = await reqFinal.query(`SELECT * FROM ${TABLE_NAMES.cotizaciones} WHERE numcot = @finalId`);
    const finalCotizacion = finalRes.recordset[0] ? {
      ...finalRes.recordset[0],
      estado: mapEstadoFromDb(finalRes.recordset[0].estado) // Mapear estado para frontend
    } : null;

    await tx.commit();
    res.json({
      success: true,
      message: 'Cotización actualizada' + (pedidoCreado ? ' y pedido creado' : ''),
      data: finalCotizacion,
      pedido: pedidoCreado
    });

  } catch (error) {
    if (tx) await tx.rollback();
    console.error('Error actualizando cotización:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Envía una cotización por correo electrónico
 */
const sendQuoteEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { firmaVendedor, destinatario, asunto, mensaje, pdfBase64 } = req.body;

    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return res.status(400).json({ success: false, message: 'ID de cotización inválido' });
    }

    // 1. Obtener datos de la cotización con información completa del cliente y vendedor
    const pool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);
    const request = new sql.Request(pool);
    request.input('id', sql.Int, idNum);

    const cotizacionQuery = `
      SELECT 
        c.*,
        cli.nomter AS clienteNombre,
        cli.EMAIL AS clienteEmail,
        cli.dirter AS clienteDireccion,
        cli.telter AS clienteTelefono,
        cli.ciudad AS clienteCiudad,
        v.nomven AS vendedorNombre
      FROM ${TABLE_NAMES.cotizaciones} c
      LEFT JOIN ${TABLE_NAMES.clientes} cli ON RTRIM(LTRIM(cli.codter)) = RTRIM(LTRIM(c.codter))
      LEFT JOIN ${TABLE_NAMES.vendedores} v ON LTRIM(RTRIM(v.codven)) = LTRIM(RTRIM(c.cod_vendedor))
      WHERE c.id = @id
    `;

    const cotizacionResult = await request.query(cotizacionQuery);


    if (cotizacionResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Cotización no encontrada' });
    }

    const cotizacion = cotizacionResult.recordset[0];

    // Validar que el cliente tenga email
    if (!cotizacion.clienteEmail || cotizacion.clienteEmail.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El cliente no tiene un correo electrónico registrado'
      });
    }


    // 2. Obtener detalles de la cotización
    const detallesRequest = new sql.Request(pool);
    detallesRequest.input('cotizacionId', sql.BigInt, idNum);

    const detallesQuery = `
      SELECT 
        d.*,
        p.nomins AS descripcion,
        p.referencia,
        p.id AS productoId,
        COALESCE(m.codmed, p.undins, 'UND') AS unidadMedida
      FROM ${TABLE_NAMES.cotizaciones_detalle} d
      LEFT JOIN ${TABLE_NAMES.productos} p ON LTRIM(RTRIM(p.codins)) = LTRIM(RTRIM(d.cod_producto))
      LEFT JOIN inv_medidas m ON m.codmed = d.codigo_medida
      WHERE d.id_cotizacion = @cotizacionId
      ORDER BY d.id
    `;

    const detallesResult = await detallesRequest.query(detallesQuery);

    // 3. Obtener datos de la empresa
    const empresaRequest = new sql.Request(pool);
    const empresaQuery = `
      SELECT TOP 1 
        LTRIM(RTRIM(razemp)) as razonSocial,
        LTRIM(RTRIM(nitemp)) as nit,
        LTRIM(RTRIM(diremp)) as direccion,
        LTRIM(RTRIM(telemp)) as telefono,
        LTRIM(RTRIM(email)) as email,
        LTRIM(RTRIM(Slogan)) as slogan
      FROM gen_empresa
    `;
    const empresaResult = await empresaRequest.query(empresaQuery);
    const datosEmpresa = empresaResult.recordset[0] || {};

    // 4. Preparar datos para el componente PDF
    // Obtener logo como base64
    const logoBase64 = getCompanyLogo();

    const pdfComponentProps = {
      cotizacion: {
        numeroCotizacion: cotizacion.numcot,
        fechaCotizacion: cotizacion.fecha,
        fechaVencimiento: cotizacion.fecha_vence,
        observaciones: cotizacion.observa,
        subtotal: cotizacion.subtotal,
        descuentoValor: cotizacion.val_descuento,
        ivaValor: cotizacion.val_iva,
        total: cotizacion.subtotal - cotizacion.val_descuento + cotizacion.val_iva,
        // Move items here
        items: detallesResult.recordset.map(item => ({
          codProducto: item.cod_producto,
          productoId: item.productoId,
          descripcion: item.descripcion,
          referencia: item.referencia,
          cantidad: item.cantidad,
          precioUnitario: item.preciound,
          descuentoPorcentaje: item.tasa_descuento,
          ivaPorcentaje: item.tasa_iva,
          subtotal: item.valor - (item.valor * (item.tasa_iva / 100)),
          valorIva: item.valor * (item.tasa_iva / 100),
          total: item.valor,
          unidadMedida: item.unidadMedida,
        })),
      },
      cliente: {
        nombreCompleto: cotizacion.clienteNombre || '',
        numeroDocumento: cotizacion.codter || '',
        id: cotizacion.codter || '',
        direccion: cotizacion.clienteDireccion || '',
        telefono: cotizacion.clienteTelefono || '',
        email: cotizacion.clienteEmail || '',
        ciudad: cotizacion.clienteCiudad || '',
      },
      vendedor: {
        nombreCompleto: cotizacion.vendedorNombre || '',
      },
      firmaVendedor: firmaVendedor || null, // Usar la firma enviada desde el frontend

      // Rename to empresa to match component expectation
      empresa: {
        nombre: datosEmpresa.razonSocial,
        razonSocial: datosEmpresa.razonSocial,
        nit: datosEmpresa.nit,
        direccion: datosEmpresa.direccion,
        telefono: datosEmpresa.telefono,
        email: datosEmpresa.email,
        slogan: datosEmpresa.slogan,
        // Usar logo en base64
        logoExt: logoBase64,
      },
    };

    // Generar el PDF    // 2. Preparar PDF
    let pdfBuffer;
    if (pdfBase64) {
      // Enviar string base64 directamente a emailService para limpieza centralizada
      pdfBuffer = pdfBase64;
    } else {
      pdfBuffer = await generateQuotePdfBuffer(pdfComponentProps);
    }

    // Helper para formatear moneda en el backend
    const formatCurrencyCO = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
    const formatDateCO = (date) => new Date(date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

    // Preparar detalles para el documento
    const documentDetails = [
      { label: 'Total Propuesta', value: formatCurrencyCO(cotizacion.subtotal - cotizacion.val_descuento + cotizacion.val_iva) },
      { label: 'Válida Hasta', value: formatDateCO(cotizacion.fecha_vence) },
      { label: 'Fecha Emisión', value: formatDateCO(cotizacion.fecha) },
      { label: 'Asesor Comercial', value: cotizacion.vendedorNombre || 'Asesor Comercial' }
    ];

    // Calcular días de validez
    const diasValidez = Math.ceil((new Date(cotizacion.fecha_vence) - new Date(cotizacion.fecha)) / (1000 * 60 * 60 * 24));

    // Enviar el correo usando sendDocumentEmail
    const { sendDocumentEmail } = require('../services/emailService.cjs');
    await sendDocumentEmail({
      to: destinatario || cotizacion.clienteEmail,
      customerName: cotizacion.clienteNombre,
      documentNumber: cotizacion.numcot,
      documentType: 'Cotización',
      pdfBuffer: pdfBuffer,
      subject: asunto, // Puede venir nulo, sendDocumentEmail maneja el default
      body: mensaje, // Mensaje adicional del usuario (opcional)
      documentDetails: documentDetails,
      processSteps: `
          <p>Esta propuesta tiene una validez de <strong>${diasValidez}</strong> días. Estamos listos para iniciar con el proyecto tan pronto recibamos su aprobación o la orden de compra respectiva.</p>
      `
    });

    res.json({
      success: true,
      message: `Cotización enviada exitosamente a ${cotizacion.clienteEmail}`,
    });
  } catch (error) {
    console.error('Error enviando cotización por correo:', error);
    res.status(500).json({
      success: false,
      message: 'Error enviando cotización por correo',
      error: error.message,
    });
  }
};

const getNextQuoteNumber = async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT TOP 1 numcot 
      FROM ${TABLE_NAMES.cotizaciones} 
      WHERE ISNUMERIC(numcot) = 1
      ORDER BY CAST(numcot AS BIGINT) DESC
    `);

    let nextNum = '000001';
    if (result.recordset.length > 0) {
      const lastNum = result.recordset[0].numcot;
      console.log('🔍 [DEBUG] getNextQuoteNumber - Found lastNum:', lastNum);

      const soloDigitos = lastNum.replace(/\D/g, '');
      const consecutivo = parseInt(soloDigitos, 10);
      console.log('🔍 [DEBUG] getNextQuoteNumber - Parsed consecutive:', consecutivo);

      if (!isNaN(consecutivo)) {
        nextNum = String(consecutivo + 1).padStart(6, '0');
        console.log('🔍 [DEBUG] getNextQuoteNumber - Calculated next:', nextNum);
      }
    } else {
      console.log('🔍 [DEBUG] getNextQuoteNumber - No existing quotes found, defaulting to 000001');
    }

    res.json({ success: true, data: { nextNumber: nextNum } });
  } catch (error) {
    console.error('Error getting next quote number:', error);
    res.status(500).json({ success: false, message: 'Error interno al obtener el consecutivo' });
  }
};

/**
 * Convierte una cotización aprobada a pedido
 * POST /api/cotizaciones/:id/convert-to-order
 */
const convertToOrder = async (req, res) => {
  const { id } = req.params;
  const idStr = String(id).trim();

  const pool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    // 1. Verificar que la cotización existe y está aprobada
    const reqCheck = new sql.Request(tx);
    reqCheck.input('id', sql.VarChar(20), idStr);
    const checkRes = await reqCheck.query(`
      SELECT * FROM ${TABLE_NAMES.cotizaciones} WHERE numcot = @id
    `);

    if (checkRes.recordset.length === 0) {
      await tx.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Cotización no encontrada' 
      });
    }

    const cotizacion = checkRes.recordset[0];
    const estadoMapped = mapEstadoFromDb(cotizacion.estcot);

    // Validar que está aprobada
    if (estadoMapped !== 'APROBADA') {
      await tx.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'La cotización debe estar aprobada para convertirla a pedido' 
      });
    }

    // Verificar si ya tiene un pedido asociado (opcional, depende de tu lógica)
    // Por ahora, permitimos múltiples pedidos de la misma cotización

    // 2. Obtener items de la cotización
    const reqItems = new sql.Request(tx);
    reqItems.input('numCot', sql.VarChar(20), idStr);
    const itemsRes = await reqItems.query(`
      SELECT 
        d.coddet as codProducto, 
        d.candet as cantidad, 
        d.vundet as precioUnitario, 
        d.dctdet as descuentoPorcentaje, 
        d.ivadet as ivaPorcentaje,
        d.nomdet as descripcion,
        (SELECT TOP 1 id FROM ${TABLE_NAMES.productos} WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(d.coddet))) as productoId
      FROM ${TABLE_NAMES.cotizaciones_detalle} d 
      WHERE d.numcot = @numCot
    `);

    const itemsCotizacion = itemsRes.recordset;

    if (itemsCotizacion.length === 0) {
      await tx.rollback();
      console.error(`❌ Cotización ${cotizacion.numcot} no tiene items en ven_detacotiz`);
      return res.status(400).json({ 
        success: false, 
        message: `La cotización ${cotizacion.numcot} no tiene items válidos para generar el pedido. Por favor, agregue productos a la cotización antes de aprobarla.`
      });
    }

    // 3. Calcular totales
    const rnd = (val) => Math.round((val || 0) * 100) / 100;
    
    let subtotalCalculado = 0;
    let descuentoCalculado = 0;
    let ivaCalculado = 0;

    const itemsParaPedido = itemsCotizacion.map(i => {
      const precio = rnd(i.precioUnitario);
      const cant = rnd(i.cantidad);
      const descPorc = rnd(i.descuentoPorcentaje);
      const ivaPorc = rnd(i.ivaPorcentaje);

      const subtotalItem = precio * cant;
      const descuentoItem = rnd(subtotalItem * (descPorc / 100));
      const baseImponible = subtotalItem - descuentoItem;
      const ivaItem = rnd(baseImponible * (ivaPorc / 100));
      const totalItem = rnd(baseImponible + ivaItem);

      subtotalCalculado += subtotalItem;
      descuentoCalculado += descuentoItem;
      ivaCalculado += ivaItem;

      return {
        productoId: i.productoId,
        codProducto: i.codProducto,
        descripcion: i.descripcion,
        cantidad: cant,
        precioUnitario: precio,
        descuentoPorcentaje: descPorc,
        ivaPorcentaje: ivaPorc,
        valorIva: ivaItem,
        total: totalItem
      };
    });

    const totalCalculado = rnd(subtotalCalculado - descuentoCalculado + ivaCalculado);

    // 4. Preparar payload para pedido
    const orderPayload = {
      clienteId: cotizacion.codter,
      fechaPedido: new Date(),
      fechaEntregaEstimada: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      vendedorId: cotizacion.codven,
      observaciones: cotizacion.observa ? `Desde Cotización ${cotizacion.numcot}: ${cotizacion.observa}` : `Basado en Cotización ${cotizacion.numcot}`,
      items: itemsParaPedido,
      subtotal: rnd(subtotalCalculado),
      descuentoValor: rnd(descuentoCalculado),
      ivaValor: rnd(ivaCalculado),
      total: totalCalculado,
      formaPago: cotizacion.formapago,
      cotizacionId: idStr,
      empresaId: cotizacion.codalm,
      numeroPedido: 'AUTO'
    };

    // 5. Crear pedido usando createOrderInternal
    const { createOrderInternal } = require('./orderController');
    const pedidoCreado = await createOrderInternal(tx, orderPayload);

    await tx.commit();

    res.status(201).json({
      success: true,
      message: 'Pedido creado exitosamente desde cotización',
      data: {
        pedido: pedidoCreado,
        cotizacionId: idStr
      }
    });

  } catch (error) {
    if (tx) await tx.rollback();
    console.error('Error convirtiendo cotización a pedido:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error convirtiendo cotización a pedido',
      error: error.message 
    });
  }
};

module.exports = {
  getAllQuotes,
  getQuoteDetails,
  createQuote,
  updateQuote,
  sendQuoteEmail,
  getNextQuoteNumber,
  convertToOrder

};


