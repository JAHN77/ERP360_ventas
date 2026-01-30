const { executeQueryWithParams } = require('../services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('../services/dbConfig.cjs');

/**
 * Controller for Product related operations
 */
const productController = {
  /**
   * Get all products with pagination, sorting, and filtering
   */
  getAllProducts: async (req, res) => {
    try {
      const { codalm, page = '1', pageSize = '50', search, sortColumn, sortDirection } = req.query;
      const codalmFormatted = codalm ? String(codalm).padStart(3, '0') : null;

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

      // Query optimizada SIN GROUP BY masivo
      // Usamos subconsultas para stock y medidas/precios si es necesario, aunque los joins 1:1 de medidas y precios suelen ser seguros sin group by si la relación es correcta.
      // Asumimos inv_invent puede tener múltiples registros (bodegas), por eso el stock requiere SUM en subconsulta.
      let query = `
        SELECT 
            ins.id,
            ins.codins                 AS codigo,
            ins.nomins                 AS nombre,
            ins.codigo_linea           AS codigoLinea,
            ins.codigo_sublinea        AS codigoSublinea,
            ins.Codigo_Medida          AS idMedida,
            COALESCE(
                CASE 
                    WHEN LTRIM(RTRIM(ins.Codigo_Medida)) = '001' THEN 'HORA'
                    WHEN LTRIM(RTRIM(ins.Codigo_Medida)) = '002' THEN 'DIA'
                    WHEN LTRIM(RTRIM(ins.Codigo_Medida)) = '003' THEN 'UNIDAD'
                    ELSE NULL 
                END,
                m.nommed, 
                ins.undins, 
                ''
            ) AS unidadMedida,
            ins.tasa_iva               AS tasaIva,
            COALESCE(
                CAST(dp.valins / (1 + (ins.tasa_iva * 0.01)) AS DECIMAL(18,2)),
                ins.ultimo_costo
            )                          AS ultimoCosto,
            ins.ultimo_costo           AS ultimoCostoCompra,
            ins.costo_promedio         AS costoPromedio,
            ins.referencia,
            ins.karins                 AS controlaExistencia,
            COALESCE(
              (SELECT SUM(inv.caninv) FROM inv_invent inv WHERE inv.codins = ins.codins AND (@codalm IS NULL OR inv.codalm = @codalm)),
              0
            ) AS stock,
            ins.activo,
            ins.precio_publico         AS precioPublico,
            ins.precio_mayorista       AS precioMayorista,
            dp.valins                  AS precioConIva
        FROM ${TABLE_NAMES.productos} ins
        LEFT JOIN inv_medidas m ON LTRIM(RTRIM(m.codmed)) = LTRIM(RTRIM(ins.Codigo_Medida))
        LEFT JOIN inv_detaprecios dp ON dp.codins = ins.codins AND dp.Codtar = '07'
        WHERE ins.activo = 1
      `;

      if (searchTerm) {
        query += ` AND (ins.nomins LIKE @search OR ins.referencia LIKE @search OR ins.codins LIKE @search)`;
      }

      // NO GROUP BY needed now

      let orderByClause = 'ORDER BY ins.nomins ASC';
      if (sortColumn && sortDirection) {
        const direction = sortDirection === 'desc' ? 'DESC' : 'ASC';
        const validColumns = {
          'nombre': 'ins.nomins',
          'referencia': 'ins.referencia',
          'ultimoCosto': 'ins.ultimoCosto', // Basic sort, computed sort is tricky without alias support in all SQL versions
          'stock': 'stock' // This might fail if alias not supported in ORDER BY in older SQL
        };

        if (sortColumn === 'stock') {
          // Sort by subquery directly for safety
          orderByClause = `ORDER BY COALESCE((SELECT SUM(inv.caninv) FROM inv_invent inv WHERE inv.codins = ins.codins AND (@codalm IS NULL OR inv.codalm = @codalm)), 0) ${direction}`;
        } else if (sortColumn === 'ultimoCosto') {
          orderByClause = `ORDER BY COALESCE(CAST(dp.valins / (1 + (ins.tasa_iva * 0.01)) AS DECIMAL(18,2)), ins.ultimo_costo) ${direction}`;
        } else if (validColumns[sortColumn]) {
          orderByClause = `ORDER BY ${validColumns[sortColumn]} ${direction}`;
        }
      }
      query += ` ${orderByClause}`;

      query += ` OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`;

      const queryParams = {
        codalm: codalmFormatted,
        offset,
        pageSize: pageSizeNum
      };
      if (searchTerm) {
        queryParams.search = `%${searchTerm}%`;
      }

      const data = await executeQueryWithParams(query, queryParams, req.db_name);

      let countQuery = `
        SELECT COUNT(*) as total
        FROM ${TABLE_NAMES.productos} ins
        WHERE ins.activo = 1
      `;
      if (searchTerm) {
        countQuery += ` AND (ins.nomins LIKE @search OR ins.referencia LIKE @search OR ins.codins LIKE @search)`;
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
            CAST(9999 AS decimal(18,2))                AS stock,
            CAST(s.valser AS decimal(18,2))            AS precioPublico,
            CAST((s.valser * (1 + (s.ivaser / 100.0))) AS decimal(18,2)) AS precioConIva,
            1                                          AS activo
        FROM ${TABLE_NAMES.servicios} s
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
   */
  createProduct: async (req, res) => {
    try {
      const {
        nombre,
        idTipoProducto, // 1 = Producto, 2 = Servicio
        precio,
        unidadMedida,
        aplicaIva,
        referencia,
        descripcion,
        controlaExistencia,
        idSublineas,
        idCategoria
      } = req.body;

      const isService = Number(idTipoProducto) === 2;
      const tableName = isService ? TABLE_NAMES.servicios : TABLE_NAMES.productos;
      const idCol = isService ? 'codser' : 'codins';

      const { getConnectionForDb } = require('../services/sqlServerClient.cjs');
      const sql = require('mssql');
      const pool = await getConnectionForDb(req.db_name);

      // Simple generation of next code (max + 1)
      let nextCode = '001';
      try {
        const maxQuery = `SELECT MAX(CAST(${idCol} AS BIGINT)) as maxCode FROM ${tableName} WHERE ISNUMERIC(${idCol}) = 1`;
        const maxRes = await pool.request().query(maxQuery);
        const maxVal = maxRes.recordset[0].maxCode || 0;
        nextCode = String(maxVal + 1).padStart(3, '0');
      } catch (e) {
        console.warn('Error generating code, fallback to timestamp', e);
        nextCode = String(Date.now()).substring(6);
      }

      // Map Unit
      let codMedida = '003'; // Default Unidad
      const uLimit = String(unidadMedida || '').toUpperCase();
      if (uLimit.includes('HORA')) codMedida = '001';
      else if (uLimit.includes('DIA') || uLimit.includes('DÍA')) codMedida = '002';
      else codMedida = '003';

      const tasaIvaVal = aplicaIva ? 19 : 0;
      const precioVal = parseFloat(precio || 0);

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        const request = new sql.Request(transaction);

        if (isService) {
          // Insert Service
          // Note: ven_servicios columns inferred from getAllServices select list
          const query = `
            INSERT INTO ${TABLE_NAMES.servicios} 
            (codser, nomser, ivaser, valser, REFSER, Codigo_medida, CODSUBLINEA)
            VALUES
            (@code, @nombre, @iva, @precio, @referencia, @medida, @sublinea)
          `;
          request.input('code', sql.VarChar(20), nextCode);
          request.input('nombre', sql.VarChar(255), nombre || 'Nuevo Servicio');
          request.input('iva', sql.Decimal(5, 2), tasaIvaVal);
          request.input('precio', sql.Decimal(18, 2), precioVal);
          request.input('referencia', sql.VarChar(50), referencia || '');
          request.input('medida', sql.VarChar(5), codMedida);
          request.input('sublinea', sql.VarChar(5), idSublineas ? String(idSublineas) : '01');

          await request.query(query);

        } else {
          // Insert Product
          const query = `
            INSERT INTO ${TABLE_NAMES.productos}
            (codins, nomins, tasa_iva, ultimo_costo, referencia, Codigo_Medida, karins, activo, codigo_linea, codigo_sublinea, costo_promedio, precio_publico)
            VALUES
            (@code, @nombre, @iva, @precio, @referencia, @medida, @karins, 1, '01', @sublinea, @precio, @precio)
          `;
          request.input('code', sql.VarChar(20), nextCode);
          request.input('nombre', sql.VarChar(255), nombre || 'Nuevo Producto');
          request.input('iva', sql.Decimal(5, 2), tasaIvaVal);
          request.input('precio', sql.Decimal(18, 2), precioVal);
          request.input('referencia', sql.VarChar(50), referencia || '');
          request.input('medida', sql.VarChar(5), codMedida);
          request.input('karins', sql.Bit, controlaExistencia ? 1 : 0);
          request.input('sublinea', sql.VarChar(5), idSublineas ? String(idSublineas) : '01');

          await request.query(query);

          // Initial stock record? (inv_invent)
          // Usually separate process, but we might want an empty record
        }

        await transaction.commit();
        res.json({ success: true, message: `${isService ? 'Servicio' : 'Producto'} creado correctamente`, data: { id: nextCode, codigo: nextCode } });

      } catch (err) {
        await transaction.rollback();
        throw err;
      }

    } catch (error) {
      console.error('Error creating product/service:', error);
      res.status(500).json({ success: false, message: 'Error al crear', error: error.message });
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
                WHEN LTRIM(RTRIM(ins.Codigo_Medida)) = '001' THEN 'HORA'
                WHEN LTRIM(RTRIM(ins.Codigo_Medida)) = '002' THEN 'DIA'
                WHEN LTRIM(RTRIM(ins.Codigo_Medida)) = '003' THEN 'UNIDAD'
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
        GROUP BY ins.id, ins.codins, ins.nomins, ins.referencia, ins.ultimo_costo, ins.undins, m.nommed, ins.tasa_iva, dp.valins
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
          -- Control de existencia (servicios no suelen tener stock, pero retornamos 9999 para que no bloquee)
          9999 AS stock
        FROM ven_servicios ins
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
      const { precioBase, tasaIva } = req.body;

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
  }
};

module.exports = productController;
