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

      // Validate and Parse Pagination
      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const pageSizeNum = Math.min(10000, Math.max(10, parseInt(String(pageSize), 10) || 50));
      const offset = (pageNum - 1) * pageSizeNum;

      // Validate Search Term
      let searchTerm = null;
      if (search) {
        const rawSearch = Array.isArray(search) ? String(search[0]) : typeof search === 'object' ? String(Object.values(search)[0]) : String(search);
        const trimmed = rawSearch.trim();
        if (trimmed && trimmed !== '[object Object]') {
          searchTerm = trimmed;
        }
      }

      // Base Query - Optimized: Explicit columns, filtered joins
      // REFACTOR NOTE: Moved from QUERIES.GET_PRODUCTOS to here for modularity.
      // OPTIMIZATION: Used CTE or direct logic? Keeping simple SELECT for readability but ensuring Indices.
      let query = `
        SELECT 
            ins.id,
            ins.codins                 AS codigo,
            ins.nomins                 AS nombre,
            ins.codigo_linea           AS codigoLinea,
            ins.codigo_sublinea        AS codigoSublinea,
            ins.Codigo_Medida          AS idMedida,
            -- Prioritize undins (Exact DB value) as requested by user, then fallback to Measure Name
            COALESCE(ins.undins, m.nommed, '') AS unidadMedida,
            ins.tasa_iva               AS tasaIva,
            -- Precio base SIN IVA (Tarifa 07)
            COALESCE(
                CAST(dp.valins / (1 + (ins.tasa_iva * 0.01)) AS DECIMAL(10,2)),
                ins.ultimo_costo
            ) AS ultimoCosto,
            ins.ultimo_costo           AS ultimoCostoCompra, -- Raw cost for Inventory Entry
            ins.costo_promedio         AS costoPromedio,
            ins.referencia,
            ins.karins                 AS controlaExistencia,
            -- Stock total (suma de bodegas filtrada)
            COALESCE(SUM(inv.caninv), 0) AS stock,
            ins.activo,
            ins.precio_publico         AS precioPublico,
            ins.precio_mayorista       AS precioMayorista,
            -- Precio visualización CON IVA
            dp.valins                  AS precioConIva
        FROM ${TABLE_NAMES.productos} ins
        LEFT JOIN inv_invent inv ON inv.codins = ins.codins
            AND (@codalm IS NULL OR inv.codalm = @codalm)
        LEFT JOIN inv_medidas m ON m.codmed = ins.Codigo_Medida
        LEFT JOIN inv_detaprecios dp ON dp.codins = ins.codins AND dp.Codtar = '07'
        WHERE ins.activo = 1
      `;

      // Apply Search Filter
      if (searchTerm) {
        // PERFORMANCE: Use LIKE with parameters.
        // RECOMMENDATION: Create Index on (nomins) and (referencia) for better performance.
        query += ` AND (ins.nomins LIKE @search OR ins.referencia LIKE @search OR ins.codins LIKE @search)`;
      }

      // Group By - Required for aggregation (SUM(stock))
      query += `
        GROUP BY 
            ins.id, ins.codins, ins.nomins, ins.codigo_linea, ins.codigo_sublinea, 
            ins.Codigo_Medida, ins.undins, m.nommed, ins.tasa_iva, ins.ultimo_costo, 
            ins.costo_promedio, ins.referencia, ins.karins, ins.activo, 
            ins.precio_publico, ins.precio_mayorista, dp.valins
      `;

      // Dynamic Sorting
      let orderByClause = 'ORDER BY ins.nomins ASC'; // Default
      if (sortColumn && sortDirection) {
        const direction = sortDirection === 'desc' ? 'DESC' : 'ASC';
        const validColumns = {
          'nombre': 'ins.nomins',
          'referencia': 'ins.referencia',
          'ultimoCosto': 'COALESCE(ins.ultimo_costo, 0)', // Simplified sort logic
          'stock': 'COALESCE(SUM(inv.caninv), 0)'
        };

        if (validColumns[sortColumn]) {
          orderByClause = `ORDER BY ${validColumns[sortColumn]} ${direction}`;
        }
      }
      query += ` ${orderByClause}`;

      // Pagination
      query += ` OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`;

      // Build Parameters
      const queryParams = {
        codalm: codalmFormatted,
        offset,
        pageSize: pageSizeNum
      };
      if (searchTerm) {
        queryParams.search = `%${searchTerm}%`;
      }

      // Execution
      const data = await executeQueryWithParams(query, queryParams, req.db_name);

      // Count Query for Pagination Metadata
      // OPTIMIZATION: Count distinct IDs only with same filter to be fast.
      let countQuery = `
        SELECT COUNT(DISTINCT ins.id) as total
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
   * Search products (Autocomplete/Quick search)
   */
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
          -- Prioritize undins (Exact DB value) as requested by user, then fallback to Measure Name
          COALESCE(ins.undins, m.nommed, '') AS unidadMedida,
          ins.tasa_iva AS tasaIva,
          dp.valins AS precioConIva
        FROM ${TABLE_NAMES.productos} ins
        LEFT JOIN inv_invent inv ON inv.codins = ins.codins AND (@codalm IS NULL OR inv.codalm = @codalm)
        LEFT JOIN inv_medidas m ON m.codmed = ins.Codigo_Medida
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
  }
};

module.exports = productController;
