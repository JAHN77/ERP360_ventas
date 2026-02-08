const { executeQueryWithParams } = require('../services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('../services/dbConfig.cjs');

/**
 * Controller for Product related operations
 */
const productController = {
  /**
   * Get all products with pagination, sorting, and filtering
   * Uses fn_obtener_insumos_servicios to get products with correct pricing based on customer tariff
   */
  getAllProducts: async (req, res) => {
    try {
      const { codalm, page = '1', pageSize = '50', search, sortColumn, sortDirection, tarifa = '01' } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const pageSizeNum = Math.min(10000, Math.max(10, parseInt(String(pageSize), 10) || 50));
      const offset = (pageNum - 1) * pageSizeNum;

      let searchTerm = null;
      if (search) {
        const rawSearch = Array.isArray(search) ? String(search[0]) : typeof search === 'object' ? String(Object.values(search)[0]) : String(search);
        const trimmed = rawSearch.trim();
        if (trimmed && trimmed !== '[object Object]') {
          searchTerm = trimmed;
        }
      }

      // Get parameters from inv_listaprecios
      const tarifaCode = tarifa || '01'; // Default to MAYORISTA
      
      const query = `
        -- Obtener parámetros de la tarifa
        DECLARE @margen_minimo DECIMAL(10,2) = 0.10
        DECLARE @almacen CHAR(3)
        DECLARE @Tarifa CHAR(2) = @tarifaParam
        DECLARE @Incluir_Iva BIT
        
        SELECT @margen_minimo = lismargen, @almacen = codalm 
        FROM inv_listaprecios 
        WHERE codtar = @Tarifa
        
        SELECT @Incluir_Iva = ISNULL(IvaIncluido, 0) FROM ven_parametros
        
        -- Obtener productos usando la función
        SELECT 
          p.*,
          @Incluir_Iva as Precio_Iva,
          -- Mapeos adicionales para el frontend
          p.codins as codigo,
          p.nomins as nombre,
          CAST(p.costo_producto AS DECIMAL(18,2)) as ultimoCostoCompra,
          CAST(p.Precio_Venta AS DECIMAL(18,2)) as ultimoCosto,
          CAST(p.precio_lista AS DECIMAL(18,2)) as precioConIva,
          CAST(p.precio_lista AS DECIMAL(18,2)) as precioPublico,
          p.caninv as stock,
          p.undins as unidadMedidaCodigo,
          p.nommedida as unidadMedidaNombre,
          p.tasa_iva as tasaIva,
          CASE 
            WHEN LTRIM(RTRIM(p.undins)) = 'UND' THEN 'UNIDAD'
            WHEN LTRIM(RTRIM(p.undins)) = 'HORA' THEN 'HORA'
            WHEN LTRIM(RTRIM(p.undins)) = 'DIA' THEN 'DIA'
            ELSE p.nommedida
          END as unidadMedida
        FROM dbo.fn_obtener_insumos_servicios(@margen_minimo, @almacen, @Tarifa) p
        WHERE 1=1
        ${searchTerm ? "AND (p.nomins LIKE @search OR p.codins LIKE @search OR p.referencia LIKE @search)" : ""}
        ORDER BY p.nomins ASC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
      `;

      const queryParams = {
        tarifaParam: tarifaCode,
        offset,
        pageSize: pageSizeNum
      };

      if (searchTerm) {
        queryParams.search = `%${searchTerm}%`;
      }

      const data = await executeQueryWithParams(query, queryParams, req.db_name);

      // Count query
      const countQuery = `
        DECLARE @margen_minimo DECIMAL(10,2) = 0.10
        DECLARE @almacen CHAR(3)
        DECLARE @Tarifa CHAR(2) = @tarifaParam
        
        SELECT @margen_minimo = lismargen, @almacen = codalm 
        FROM inv_listaprecios 
        WHERE codtar = @Tarifa
        
        SELECT COUNT(*) as total
        FROM dbo.fn_obtener_insumos_servicios(@margen_minimo, @almacen, @Tarifa) p
        WHERE 1=1
        ${searchTerm ? "AND (p.nomins LIKE @search OR p.codins LIKE @search OR p.referencia LIKE @search)" : ""}
      `;

      const countResult = await executeQueryWithParams(
        countQuery, 
        searchTerm ? { tarifaParam: tarifaCode, search: `%${searchTerm}%` } : { tarifaParam: tarifaCode }, 
        req.db_name
      );
      const totalRecords = countResult[0]?.total || 0;

      res.json({
        success: true,
        data,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total: totalRecords,
          totalPages: Math.ceil(totalRecords / pageSizeNum)
        }
      });

    } catch (error) {
      console.error('Error in getAllProducts:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener productos',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },


  /**
   * Get all services with pagination
   */
  getAllServices: async (req, res) => {
    try {
      const { page = '1', pageSize = '50', search, sortColumn, sortDirection } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const pageSizeNum = Math.min(10000, Math.max(10, parseInt(String(pageSize), 10) || 50));
      const offset = (pageNum - 1) * pageSizeNum;

      let searchTerm = null;
      if (search) {
        const rawSearch = Array.isArray(search) ? String(search[0]) : typeof search === 'object' ? String(Object.values(search)[0]) : String(search);
        const trimmed = rawSearch.trim();
        if (trimmed && trimmed !== '[object Object]') {
          searchTerm = trimmed;
        }
      }

      // No GROUP BY needed for Services usually, unless duplicate codser exist
      let query = `
        SELECT 
            -- Generar ID ficticio para el frontend
            CAST((ROW_NUMBER() OVER (ORDER BY s.codser)) + 2000000 AS bigint) AS id,
            LTRIM(RTRIM(s.codser))                     AS codigo, 
            LTRIM(RTRIM(s.nomser))                     AS nombre,
            s.CODSUBLINEA                              AS codigoSublinea,
            COALESCE(
              CASE 
                  WHEN LTRIM(RTRIM(s.Codigo_medida)) = '001' THEN 'HORA'
                  WHEN LTRIM(RTRIM(s.Codigo_medida)) = '002' THEN 'DIA'
                  WHEN LTRIM(RTRIM(s.Codigo_medida)) = '003' THEN 'UNIDAD'
                  ELSE NULL 
              END,
              'UND'
            ) AS unidadMedida,
            CAST(s.ivaser AS decimal(18,2))            AS tasaIva,
            CAST(s.valser AS decimal(18,2))            AS ultimoCosto,
            LTRIM(RTRIM(COALESCE(s.REFSER, '')))       AS referencia,
            CAST(0 AS decimal(18,2))                   AS stock,
            COALESCE(RTRIM(l.nomline), 'Servicios')    AS categoriaNombre,
            COALESCE(RTRIM(m.nommed), 'Servicio')      AS unidadMedidaNombre,
            LTRIM(RTRIM(s.Codigo_medida))              AS unidadMedidaCodigo,
            LTRIM(RTRIM(s.CODSUBLINEA))                AS idSublineas,
            LTRIM(RTRIM(sl.codline))                   AS idCategoria,
            CAST(s.valser AS decimal(18,2))            AS precioPublico,
            CAST((s.valser * (1 + (s.ivaser / 100.0))) AS decimal(18,2)) AS precioConIva,
            1                                          AS activo
        FROM ${TABLE_NAMES.servicios} s
        LEFT JOIN inv_medidas m ON LTRIM(RTRIM(m.codmed)) = LTRIM(RTRIM(s.Codigo_medida))
        LEFT JOIN inv_sublinea sl ON LTRIM(RTRIM(sl.codsub)) = LTRIM(RTRIM(s.CODSUBLINEA))
        LEFT JOIN inv_lineas l ON LTRIM(RTRIM(l.codline)) = LTRIM(RTRIM(sl.codline))
        WHERE 1=1
      `;

      if (searchTerm) {
        query += ` AND (s.nomser LIKE @search OR s.REFSER LIKE @search OR s.codser LIKE @search)`;
      }

      let orderByClause = 'ORDER BY s.nomser ASC';
      if (sortColumn && sortDirection) {
        const direction = sortDirection === 'desc' ? 'DESC' : 'ASC';
        const validColumns = {
          'nombre': 's.nomser',
          'referencia': 's.REFSER',
          'ultimoCosto': 's.valser'
        };
        if (validColumns[sortColumn]) {
          orderByClause = `ORDER BY ${validColumns[sortColumn]} ${direction}`;
        }
      }
      query += ` ${orderByClause}`;

      query += ` OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`;

      const queryParams = {
        offset,
        pageSize: pageSizeNum
      };
      if (searchTerm) {
        queryParams.search = `%${searchTerm}%`;
      }

      const data = await executeQueryWithParams(query, queryParams, req.db_name);

      let countQuery = `
        SELECT COUNT(*) as total
        FROM ${TABLE_NAMES.servicios} s
        WHERE 1=1
      `;
      if (searchTerm) {
        countQuery += ` AND (s.nomser LIKE @search OR s.REFSER LIKE @search OR s.codser LIKE @search)`;
      }

      const countResult = await executeQueryWithParams(countQuery, searchTerm ? { search: `%${searchTerm}%` } : {}, req.db_name);
      const totalRecords = countResult[0]?.total || 0;

      res.json({
        success: true,
        data,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total: totalRecords,
          totalPages: Math.ceil(totalRecords / pageSizeNum)
        }
      });
    } catch (error) {
      console.error('Error in getAllServices:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener servicios',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },
  /**
   * Create a new product or service
   * Validates all required fields for fn_obtener_insumos_servicios
   */
  createProduct: async (req, res) => {
    try {
      const {
        nombre,
        idTipoProducto, // 1 = Producto, 2 = Servicio
        precio,
        costo,  // CAMPO OBLIGATORIO
        stock,  // CAMPO OBLIGATORIO para productos con inventario
        unidadMedida,
        aplicaIva,
        referencia,
        descripcion,
        controlaExistencia,
        idSublineas,
        idCategoria
      } = req.body;

      // ===== VALIDACIONES DE CAMPOS REQUERIDOS =====
      const errors = [];
      
      if (!nombre || nombre.trim() === '') {
        errors.push('El nombre del producto es obligatorio');
      }
      
      if (!costo || parseFloat(costo) <= 0) {
        errors.push('El costo del producto es obligatorio y debe ser mayor a 0');
      }
      
      if (!precio || parseFloat(precio) <= 0) {
        errors.push('El precio del producto es obligatorio y debe ser mayor a 0');
      }

      const isService = Number(idTipoProducto) === 2;
      
      if (!isService && (!stock || parseFloat(stock) <= 0)) {
        errors.push('El stock inicial es obligatorio para productos con inventario y debe ser mayor a 0');
      }

      // La referencia es opcional, se generará automáticamente si no se proporciona

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios',
          errors: errors
        });
      }

      const tableName = isService ? TABLE_NAMES.servicios : TABLE_NAMES.productos;
      const idCol = isService ? 'codser' : 'codins';

      const { getConnectionForDb } = require('../services/sqlServerClient.cjs');
      const sql = require('mssql');
      const pool = await getConnectionForDb(req.db_name);

      // Generate next code (max + 1) handling leading zeros
      let nextCode = '001';
      try {
        // Get max code, removing leading zeros for numeric comparison
        const maxQuery = `
          SELECT MAX(
            CASE 
              WHEN ISNUMERIC(${idCol}) = 1 THEN CAST(${idCol} AS INT)
              ELSE 0
            END
          ) as maxCode 
          FROM ${tableName}
        `;
        const maxRes = await pool.request().query(maxQuery);
        const maxVal = maxRes.recordset[0].maxCode || 0;
        nextCode = String(maxVal + 1).padStart(8, '0');
        console.log(`[ProductController] Generated next code for ${tableName}: ${nextCode} (max was ${maxVal})`);
      } catch (e) {
        console.warn('[ProductController] Error generating code:', e);
        // Fallback: use timestamp-based code
        nextCode = String(Date.now()).substring(5).padStart(8, '0');
      }

      // Map Unit
      // El frontend envía unidadMedidaCodigo directamente (001, 002, 003, etc.)
      let codMedida = unidadMedida || '003'; // Default Unidad
      
      // Si unidadMedida es un código válido (001, 002, 003), usarlo directamente
      // Sino, intentar mapear por nombre
      if (!/^\d{3}$/.test(codMedida)) {
        const uLimit = String(unidadMedida || '').toUpperCase();
        if (uLimit.includes('HORA')) codMedida = '001';
        else if (uLimit.includes('DIA') || uLimit.includes('DÍA')) codMedida = '002';
        else codMedida = '003';
      }

      const tasaIvaVal = aplicaIva ? 19 : 0;
      const precioVal = parseFloat(precio);
      const costoVal = parseFloat(costo);
      const stockVal = parseFloat(stock || 0);

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        const request = new sql.Request(transaction);

        if (isService) {
          // Insert Service
          const autoRef = referencia || `S-SER${nextCode}`;

          // Default accounting code for services
          const codCue = '42201001';
          const codigoInterfase = '04';

          const query = `
            INSERT INTO ${TABLE_NAMES.servicios} 
            (codser, nomser, codcue, valser, ivaser, tasacomis, codins, REFSER, concesion, CODSUBLINEA, CODIGO_INTERFASE, Codigo_medida)
            VALUES
            (@code, @nombre, @codcue, @precio, @iva, @tasacomis, @codins, @referencia, @concesion, @sublinea, @interfase, @medida)
          `;
          request.input('code', sql.VarChar(3), nextCode);
          request.input('nombre', sql.VarChar(100), nombre);
          request.input('codcue', sql.VarChar(8), codCue);
          request.input('precio', sql.Decimal(18, 4), precioVal);
          request.input('iva', sql.Decimal(6, 2), tasaIvaVal);
          request.input('tasacomis', sql.Decimal(6, 2), 0);
          request.input('codins', sql.VarChar(8), autoRef);
          request.input('referencia', sql.VarChar(15), autoRef);
          request.input('concesion', sql.Bit, 0);
          const sublineaFormatted = idSublineas ? `SS${String(idSublineas).padStart(2, '0')}` : 'SS01';
          request.input('sublinea', sql.VarChar(4), sublineaFormatted);
          request.input('interfase', sql.VarChar(2), codigoInterfase);
          request.input('medida', sql.VarChar(3), codMedida);

          await request.query(query);

        } else {
          // ===== INSERT PRODUCT =====
          const undinsVal = codMedida === '001' ? 'HORA' : (codMedida === '002' ? 'DIA' : 'UND');
          
          // Calcular margen: ((Precio - Costo) / Precio) * 100
          const marginVal = ((precioVal - costoVal) / precioVal) * 100;
          
          console.log('[ProductController] Creando producto:', {
            code: nextCode,
            nombre,
            costo: costoVal,
            precio: precioVal,
            margen: marginVal,
            stock: stockVal,
            referencia
          });
          
          const query = `
            INSERT INTO ${TABLE_NAMES.productos}
            (codins, nomins, tasa_iva, ultimo_costo, referencia, Codigo_Medida, undins, karins, activo, 
             codigo_linea, codigo_sublinea, costo_promedio, precio_publico, margen_venta, 
             INSUMO_VENTA, ACTIVO_EMPRESA, precio_minorista, precio_mayorista)
            VALUES
            (@code, @nombre, @iva, @costo, @referencia, @medida, @undins, @karins, 1, 
             '01', @sublinea, @costo, @precio, @margen, 1, 1, @precio, @precio)
          `;
          
          request.input('code', sql.VarChar(20), nextCode);
          request.input('nombre', sql.VarChar(255), nombre);
          request.input('iva', sql.Decimal(5, 2), tasaIvaVal);
          request.input('costo', sql.Decimal(18, 2), costoVal);
          request.input('precio', sql.Decimal(18, 2), precioVal);
          request.input('margen', sql.Decimal(18, 2), marginVal);
          request.input('referencia', sql.VarChar(50), referencia || nextCode); // Usar código si no hay referencia
          request.input('medida', sql.VarChar(5), codMedida);
          request.input('undins', sql.VarChar(10), undinsVal);
          request.input('karins', sql.Bit, 1); // Siempre controla existencia
          request.input('sublinea', sql.VarChar(5), idSublineas ? String(idSublineas) : '01');

          await request.query(query);

          // ===== INSERT INVENTORY (inv_invent) =====
          // OBLIGATORIO: Debe tener stock > 0 para aparecer en fn_obtener_insumos_servicios
          const reqStock = new sql.Request(transaction);
          reqStock.input('codins', sql.VarChar(20), nextCode);
          reqStock.input('cantidad', sql.Decimal(18, 2), stockVal);
          reqStock.input('codalm', sql.VarChar(5), '001'); // Bodega principal
          reqStock.input('costo', sql.Decimal(18, 2), costoVal);

          await reqStock.query(`
            INSERT INTO inv_invent (codalm, codins, caninv, ucoins)
            VALUES (@codalm, @codins, @cantidad, @costo)
          `);

          console.log(`[ProductController] Inventario creado: ${stockVal} unidades en bodega 001`);

          // ===== INSERT PRICES (inv_detaprecios) =====
          // CRÍTICO: Debe tener precios para TODAS las tarifas
          const reqPrice = new sql.Request(transaction);
          
          // Obtener todas las tarifas activas
          const tarifasResult = await reqPrice.query(`
            SELECT codtar, lismargen FROM inv_listaprecios WHERE vigente = 1
          `);

          if (tarifasResult.recordset.length === 0) {
            throw new Error('No hay tarifas activas en el sistema');
          }

          // Determinar costo final
          let costoFinalcalculado = costoVal;
          const { calculationMode, tarifaReferencia } = req.body;

          // Si viene en modo precio, calcular el costo basado en el precio deseado
          if (calculationMode === 'price' && tarifaReferencia) {
            const tarifaRef = tarifasResult.recordset.find(t => t.codtar === tarifaReferencia);
            if (!tarifaRef) {
              throw new Error(`Tarifa de referencia '${tarifaReferencia}' no encontrada`);
            }
            
            // Quitar IVA si aplica
            const precioSinIva = aplicaIva ? precioVal / 1.19 : precioVal;
            // Calcular costo: precio_sin_iva * (1 - margen/100)
            costoFinalcalculado = precioSinIva * (1 - tarifaRef.lismargen / 100);
            
            console.log('[ProductController] Modo precio activado:', {
              precioDeseado: precioVal,
              tarifaReferencia,
              margen: tarifaRef.lismargen,
              costoCalculado: costoFinalcalculado
            });
          }

          // Calcular precio para cada tarifa según su margen
          const priceInserts = tarifasResult.recordset.map(tarifa => {
            // Para modo precio, si es la tarifa de referencia, usar el precio exacto ingresado
            let precioParaTarifa;
            
            if (calculationMode === 'price' && tarifa.codtar === tarifaReferencia) {
              // Usar precio exacto ingresado por el usuario
              precioParaTarifa = precioVal;
            } else {
              // Calcular precio: (costo / (1 - margen/100)) * (1 + IVA)
              const precioSinIva = costoFinalcalculado / (1 - (tarifa.lismargen / 100));
              precioParaTarifa = aplicaIva ? precioSinIva * 1.19 : precioSinIva;
            }
            
            return `('${nextCode}', '${tarifa.codtar}', ${precioParaTarifa.toFixed(2)}, ${tarifa.lismargen})`;
          }).join(',\n            ');

          const priceQuery = `
            INSERT INTO inv_detaprecios (codins, Codtar, valins, margen)
            VALUES 
            ${priceInserts}
          `;

          await reqPrice.query(priceQuery);

          console.log(`[ProductController] Precios creados para ${tarifasResult.recordset.length} tarifas`);
          
          // Actualizar costo en inv_invent con el costo calculado si fue modo precio
          if (calculationMode === 'price') {
            const reqUpdateCost = new sql.Request(transaction);
            await reqUpdateCost.query(`
              UPDATE inv_invent 
              SET ucoins = ${costoFinalcalculado.toFixed(2)}
              WHERE codins = '${nextCode}' AND codalm = '001'
            `);
            console.log('[ProductController] Costo actualizado en inventario:', costoFinalcalculado);
          }
        }

        await transaction.commit();
        
        res.json({ 
          success: true, 
          message: `${isService ? 'Servicio' : 'Producto'} creado correctamente`, 
          data: { 
            id: nextCode, 
            codigo: nextCode,
            nombre,
            precio: precioVal,
            costo: costoVal,
            stock: stockVal
          } 
        });

      } catch (err) {
        console.error('[ProductController] Error en transacción SQL:', err);
        await transaction.rollback();
        throw err;
      }


    } catch (error) {
      console.error('Error creating product/service:', error);
      res.status(500).json({ success: false, message: 'Error al crear: ' + error.message, error: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
    }
  },

  searchProducts: async (req, res) => {
    try {
      const { search = '', limit = 20, codalm = null } = req.query;
      if (String(search).trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Ingrese al menos 2 caracteres' });
      }

      const query = `
        SELECT TOP (@limit)
          ins.id,
          ins.codins,
          ins.nomins AS nombre,
          LTRIM(RTRIM(COALESCE(ins.referencia, ''))) AS referencia,
          COALESCE(
             CAST(dp.valins / (1 + (ins.tasa_iva * 0.01)) AS DECIMAL(10,2)),
             ins.ultimo_costo
          ) AS ultimoCosto,
          ins.ultimo_costo AS ultimoCostoCompra, -- Raw cost for Inventory Entry
          COALESCE(MAX(inv.ucoins), 0) AS costoInventario,
          COALESCE(SUM(inv.caninv), 0) AS stock,
          ins.undins AS unidadMedidaCodigo,
          m.nommed AS unidadMedidaNombre,
          -- Prioritize code checks (001,002,003), then Measure Name, then internal code
          COALESCE(
            CASE 
                WHEN LTRIM(RTRIM(ins.undins)) = 'UND' THEN 'UNIDAD'
                WHEN LTRIM(RTRIM(ins.undins)) = 'HORA' THEN 'HORA'
                WHEN LTRIM(RTRIM(ins.undins)) = 'DIA' THEN 'DIA'
                ELSE NULL 
            END,
            m.nommed, 
            ins.undins, 
            ''
          ) AS unidadMedida,
          ins.tasa_iva AS tasaIva,
          dp.valins AS precioConIva
        FROM ${TABLE_NAMES.productos} ins
        LEFT JOIN inv_invent inv ON inv.codins = ins.codins AND (@codalm IS NULL OR inv.codalm = @codalm)
        LEFT JOIN inv_medidas m ON LTRIM(RTRIM(m.codmed)) = LTRIM(RTRIM(ins.Codigo_Medida))
        LEFT JOIN inv_detaprecios dp ON dp.codins = ins.codins AND dp.Codtar = '07'
        WHERE ins.activo = 1 AND (ins.nomins LIKE @like OR ins.referencia LIKE @like OR ins.codins LIKE @like)
        GROUP BY ins.id, ins.codins, ins.nomins, ins.referencia, ins.ultimo_costo, ins.undins, m.nommed, ins.tasa_iva, dp.valins, ins.Codigo_Medida
        ORDER BY ins.nomins
      `;

      const data = await executeQueryWithParams(query, {
        like: `%${search}%`,
        limit: Math.min(parseInt(limit) || 20, 100),
        codalm: codalm || null
      }, req.db_name);

      res.json({ success: true, data });

    } catch (error) {
      console.error('Error in searchProducts:', error);
      res.status(500).json({ success: false, message: 'Error en búsqueda de productos', error: error.message });
    }
  },
  searchProductsCustom: async (req, res) => {
    try {
      const { search = '', limit = 20, codtar } = req.query;
      if (String(search).trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Ingrese al menos 2 caracteres' });
      }

      const query = `
        SELECT TOP (@limit) 
          CAST(i.codins AS VARCHAR(50)) as codins,
          CAST(i.nomins AS VARCHAR(255)) as nomins,
          CAST(i.tasa_iva AS DECIMAL(18,2)) as tasa_iva,
          CAST(i.undins AS VARCHAR(10)) as undins,
          COALESCE((SELECT SUM(caninv) FROM inv_invent WHERE codins = i.codins), 0) as caninv,
          0 as Valinv,
          -- Usar precio de la tarifa del cliente si está disponible
          CAST(COALESCE(dp.valins, i.precio_publico) AS DECIMAL(18,2)) as Precio_Venta,
          CAST(i.margen_venta AS DECIMAL(18,2)) as margen_venta,
          0 as tasa_descuento,
          CAST(i.ultimo_costo AS DECIMAL(18,2)) as precio_base,
          CAST(COALESCE(dp.valins, i.precio_publico) AS DECIMAL(18,2)) as precio_lista,
          CAST(i.referencia AS VARCHAR(100)) as referencia,
          CAST(i.undins AS VARCHAR(10)) as unimedida,
          '' as padre,
          1 as canmed,
          CAST(i.undins AS VARCHAR(10)) as abreviatura,
          CASE WHEN i.tipo_producto = 'Servicio' THEN 1 ELSE 0 END as servicio,
          i.karins,
          CAST(i.ultimo_costo AS DECIMAL(18,2)) as costo_producto,
          (SELECT TOP 1 nommed FROM inv_medidas WHERE codmed = i.Codigo_Medida) as nommedida,
          
          -- Mapeos para compatibilidad con Frontend
          i.codins as codigo,
          i.nomins as nombre,
          CAST(i.ultimo_costo AS DECIMAL(18,2)) as ultimoCostoCompra,
          -- Usar precio de lista del cliente
          CAST(COALESCE(dp.valins, i.precio_publico) AS DECIMAL(18,2)) as ultimoCosto,
          CAST(COALESCE(dp.valins, i.precio_publico) AS DECIMAL(18,2)) as precioConIva,
          CAST(COALESCE(dp.valins, i.precio_publico) AS DECIMAL(18,2)) as precioPublico,
          COALESCE((SELECT SUM(caninv) FROM inv_invent WHERE codins = i.codins), 0) as stock,
          i.Codigo_Medida as unidadMedidaCodigo,
          (SELECT TOP 1 nommed FROM inv_medidas WHERE codmed = i.Codigo_Medida) as unidadMedidaNombre,
          CAST(i.tasa_iva AS DECIMAL(18,2)) as tasaIva,
          -- Siempre usar el nombre real de inv_medidas
          COALESCE((SELECT TOP 1 nommed FROM inv_medidas WHERE codmed = i.Codigo_Medida), 'UNIDAD') as unidadMedida,
          i.id

        FROM inv_insumos i
        -- JOIN con inv_detaprecios para obtener precio según tarifa del cliente
        LEFT JOIN inv_detaprecios dp ON i.codins = dp.codins 
          AND (@codtar IS NULL OR dp.codtar = @codtar)
        WHERE i.activo = 1 
          AND (i.nomins LIKE @search OR i.codins LIKE @search OR i.referencia LIKE @search)
        ORDER BY i.nomins
      `;

      const data = await executeQueryWithParams(query, {
        search: `%${search}%`,
        limit: Math.min(parseInt(limit) || 20, 100),
        codtar: codtar || null
      }, req.db_name);

      res.json({ success: true, data });

    } catch (error) {
      console.error('Error in searchProductsCustom:', error);
      res.status(500).json({ success: false, message: 'Error en búsqueda personalizada de productos', error: error.message });
    }
  },
  /**
   * Search services (ven_servicios)
   */
  searchServices: async (req, res) => {
    try {
      const { search = '', limit = 20 } = req.query;
      if (String(search).trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Ingrese al menos 2 caracteres' });
      }

      const query = `
        SELECT TOP (@limit)
          LTRIM(RTRIM(ins.codser)) AS codins,      -- Mapeado a 'codins' para compatibilidad frontend
          LTRIM(RTRIM(ins.codser)) AS codigo,
          LTRIM(RTRIM(ins.nomser)) AS nombre,
          LTRIM(RTRIM(COALESCE(ins.REFSER, ''))) AS referencia,
          ins.valser AS ultimoCosto,
          ins.valser AS precioBase,
          ins.ivaser AS tasaIva,
          ins.Codigo_medida AS unidadMedidaCodigo,
          COALESCE(
              CASE 
                  WHEN LTRIM(RTRIM(ins.Codigo_medida)) = '001' THEN 'HORA'
                  WHEN LTRIM(RTRIM(ins.Codigo_medida)) = '002' THEN 'DIA'
                  WHEN LTRIM(RTRIM(ins.Codigo_medida)) = '003' THEN 'UNIDAD'
                  ELSE NULL 
              END,
              'UND'
          ) AS unidadMedidaNombre, 
          COALESCE(
              CASE 
                  WHEN LTRIM(RTRIM(ins.Codigo_medida)) = '001' THEN 'HORA'
                  WHEN LTRIM(RTRIM(ins.Codigo_medida)) = '002' THEN 'DIA'
                  WHEN LTRIM(RTRIM(ins.Codigo_medida)) = '003' THEN 'UNIDAD'
                  ELSE NULL 
              END,
              'UND'
          ) AS unidadMedida,
          -- Precio con IVA calculado (aunque valser parece ser precio base)
          (ins.valser * (1 + (ins.ivaser / 100.0))) AS precioConIva,
          -- Control de existencia (servicios no tienen stock)
          0 AS stock,
          COALESCE(RTRIM(l.nomline), 'Servicios') AS categoriaNombre,
          COALESCE(RTRIM(m.nommed), 'Servicio') AS unidadMedidaNombre,
          LTRIM(RTRIM(ins.Codigo_medida)) AS unidadMedidaCodigo,
          LTRIM(RTRIM(ins.CODSUBLINEA)) AS idSublineas,
          LTRIM(RTRIM(sl.codline)) AS idCategoria
        FROM ven_servicios ins
        LEFT JOIN inv_medidas m ON LTRIM(RTRIM(m.codmed)) = LTRIM(RTRIM(ins.Codigo_medida))
        LEFT JOIN inv_sublinea sl ON LTRIM(RTRIM(sl.codsub)) = LTRIM(RTRIM(ins.CODSUBLINEA))
        LEFT JOIN inv_lineas l ON LTRIM(RTRIM(l.codline)) = LTRIM(RTRIM(sl.codline))
        WHERE (ins.nomser LIKE @like OR ins.codser LIKE @like OR ins.REFSER LIKE @like)
        ORDER BY ins.nomser
      `;

      const data = await executeQueryWithParams(query, {
        like: `%${search}%`,
        limit: Math.min(parseInt(limit) || 20, 100)
      }, req.db_name);

      // Mapeo adicional si es necesario para asegurar compatibilidad total
      const mappedData = data.map(item => ({
        ...item,
        id: item.codigo, // Usar codigo como ID ya que no tenemos ID numérico garantizado
        isService: true
      }));

      res.json({ success: true, data: mappedData });

    } catch (error) {
      console.error('Error in searchServices:', error);
      res.status(500).json({ success: false, message: 'Error en búsqueda de servicios', error: error.message });
    }
  },
  /**
   * Get product stock breakdown by warehouse
   */
  getProductStockDetails: async (req, res) => {
    try {
      const { id } = req.params;

      const query = `
        SELECT 
            LTRIM(RTRIM(i.codalm)) as codalm,
            LTRIM(RTRIM(COALESCE(a.nomalm, 'Bodega ' + i.codalm))) as nombreBodega,
            i.caninv as cantidad
        FROM inv_invent i
        LEFT JOIN inv_almacen a ON a.codalm = i.codalm
        WHERE i.codins = (SELECT codins FROM ${TABLE_NAMES.productos} WHERE id = @id)
        ORDER BY i.codalm
      `;

      const data = await executeQueryWithParams(query, { id: parseInt(id, 10) }, req.db_name);

      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting product stock details:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo stock por bodega', error: error.message });
    }
  },

  /**
   * Update product details (specifically price for now)
   */
  updateProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const { precioBase, tasaIva, stock } = req.body;

      if (precioBase === undefined) {
        return res.status(400).json({ success: false, message: 'El costo base es requerido' });
      }

      const idNum = parseInt(id, 10);
      const baseNum = parseFloat(precioBase);
      const ivaNum = parseFloat(tasaIva || 0);

      // Calcular precio con IVA
      const precioConIva = baseNum * (1 + (ivaNum / 100));

      const { getConnectionForDb } = require('../services/sqlServerClient.cjs');
      const sql = require('mssql');
      const pool = await getConnectionForDb(req.db_name);
      const transaction = new sql.Transaction(pool);

      await transaction.begin();

      try {
        // 1. Obtener codins del producto
        const reqCod = new sql.Request(transaction);
        reqCod.input('id', sql.Int, idNum);
        const prodRes = await reqCod.query(`SELECT codins FROM ${TABLE_NAMES.productos} WHERE id = @id`);

        if (prodRes.recordset.length === 0) {
          throw new Error('Producto no encontrado');
        }
        const codins = prodRes.recordset[0].codins;

        // 2. Actualizar inv_insumos (ultimo_costo)
        const reqInsumos = new sql.Request(transaction);
        reqInsumos.input('id', sql.Int, idNum);
        reqInsumos.input('precioBase', sql.Decimal(18, 2), baseNum);
        await reqInsumos.query(`UPDATE ${TABLE_NAMES.productos} SET ultimo_costo = @precioBase WHERE id = @id`);

        // 3. Actualizar inv_detaprecios (Tarifa 07)
        const reqPrecios = new sql.Request(transaction);
        reqPrecios.input('codins', sql.VarChar(8), codins);
        reqPrecios.input('precioConIva', sql.Decimal(18, 2), precioConIva);

        // Verificar si existe la tarifa 07
        const checkTarifa = await reqPrecios.query(`SELECT 1 FROM inv_detaprecios WHERE codins = @codins AND Codtar = '07'`);

        if (checkTarifa.recordset.length > 0) {
          await reqPrecios.query(`UPDATE inv_detaprecios SET valins = @precioConIva WHERE codins = @codins AND Codtar = '07'`);
        } else {
          // Si no existe, se podría insertar, pero por ahora solo actualizamos si existe
          console.warn(`Tarifa 07 no encontrada para el producto ${codins}`);
        }

        // 4. Actualizar Stock (inv_invent) si se proporciona
        if (stock !== undefined && stock !== null && stock !== '') {
          const stockNum = parseFloat(stock);
          const reqStock = new sql.Request(transaction);
          reqStock.input('codins', sql.VarChar(8), codins);
          reqStock.input('cantidad', sql.Decimal(18, 2), stockNum);

          // Asumimos bodega '01' por defecto
          const codalm = '01';
          reqStock.input('codalm', sql.VarChar(5), codalm);

          // Verificar existencia en inv_invent para bodega 01
          const checkInvent = await reqStock.query(`SELECT 1 FROM inv_invent WHERE codins = @codins AND codalm = @codalm`);

          if (checkInvent.recordset.length > 0) {
            await reqStock.query(`UPDATE inv_invent SET caninv = @cantidad WHERE codins = @codins AND codalm = @codalm`);
          } else {
            // Insertar si no existe
            await reqStock.query(`
                    INSERT INTO inv_invent (codalm, codins, caninv, ucoins, invfis)
                    VALUES (@codalm, @codins, @cantidad, 0, 0)
                 `);
          }
        }

        await transaction.commit();
        res.json({ success: true, message: 'Producto actualizado correctamente' });

      } catch (innerError) {
        await transaction.rollback();
        throw innerError;
      }

    } catch (error) {
      console.error('Error in updateProduct:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar el producto',
        error: error.message
      });
    }
  },

  /**
   * Delete a product or service
   */
  deleteProduct: async (req, res) => {
    try {
      const { id } = req.params;

      const { getConnectionForDb } = require('../services/sqlServerClient.cjs');
      const sql = require('mssql');
      const pool = await getConnectionForDb(req.db_name);

      // First, check if the product exists and determine if it's a service or product
      // Try products table first
      let isService = false;
      let exists = false;

      const checkProductQuery = `SELECT codins FROM ${TABLE_NAMES.productos} WHERE codins = @id`;
      const productCheck = await pool.request()
        .input('id', sql.VarChar(20), String(id))
        .query(checkProductQuery);

      if (productCheck.recordset.length > 0) {
        exists = true;
        isService = false;
      } else {
        // Check services table
        const checkServiceQuery = `SELECT codser FROM ${TABLE_NAMES.servicios} WHERE codser = @id`;
        const serviceCheck = await pool.request()
          .input('id', sql.VarChar(20), String(id))
          .query(checkServiceQuery);

        if (serviceCheck.recordset.length > 0) {
          exists = true;
          isService = true;
        }
      }

      if (!exists) {
        return res.status(404).json({
          success: false,
          message: 'Producto o servicio no encontrado'
        });
      }

      // Delete from the appropriate table
      const tableName = isService ? TABLE_NAMES.servicios : TABLE_NAMES.productos;
      const idCol = isService ? 'codser' : 'codins';

      const deleteQuery = `DELETE FROM ${tableName} WHERE ${idCol} = @id`;
      await pool.request()
        .input('id', sql.VarChar(20), String(id))
        .query(deleteQuery);

      res.json({
        success: true,
        message: `${isService ? 'Servicio' : 'Producto'} eliminado correctamente`
      });

    } catch (error) {
      console.error('Error deleting product/service:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar',
        error: error.message
      });
    }
  },

  /**
   * Get all active price lists (tarifas)
   */
  getTarifas: async (req, res) => {
    try {
      const query = `
        SELECT 
          codtar,
          nomtar,
          lismargen,
          codalm,
          vigente
        FROM inv_listaprecios
        WHERE vigente = 1
        ORDER BY codtar ASC
      `;

      const result = await executeQueryWithParams(query, {}, req.db_name);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[ProductController] Error getting tarifas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener listas de precios',
        error: error.message
      });
    }
  }
};

module.exports = productController;
