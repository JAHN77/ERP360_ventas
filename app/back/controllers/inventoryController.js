const sql = require('mssql');
const { getConnection, executeQueryWithParams } = require('../services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('../services/dbConfig.cjs');
const InventoryService = require('../services/inventoryService.js');

const inventoryController = {
  // GET /api/inventario/kardex/:productoId
  getKardex: async (req, res) => {
    try {
      const { productoId } = req.params;
      const { codalm, fechaInicio, fechaFin, page = '1', pageSize = '20' } = req.query;

      if (!productoId) {
        return res.status(400).json({ success: false, message: 'Producto ID requerido' });
      }

      // 1. Obtener codins del producto
      const prodQuery = `SELECT codins, nomins FROM ${TABLE_NAMES.productos} WHERE id = @id`;
      const prodResult = await executeQueryWithParams(prodQuery, { id: parseInt(productoId) });

      if (prodResult.length === 0) {
        return res.status(404).json({ success: false, message: 'Producto no encontrado' });
      }

      const { codins, nomins } = prodResult[0];

      // 2. Construir query del Kardex
      let whereClauses = ['k.codins = @codins'];
      const params = { codins };

      if (codalm) {
        whereClauses.push('k.codalm = @codalm');
        params.codalm = String(codalm).padStart(3, '0');
      }

      if (fechaInicio && fechaFin) {
        whereClauses.push('k.feckar BETWEEN @fechaInicio AND @fechaFin');
        params.fechaInicio = new Date(fechaInicio);
        params.fechaFin = new Date(fechaFin);
      }

      const pageNum = Math.max(1, parseInt(page) || 1);
      const pageSizeNum = Math.min(200, Math.max(5, parseInt(pageSize) || 20));
      const offset = (pageNum - 1) * pageSizeNum;
      
      params.offset = offset;
      params.pageSize = pageSizeNum;

      // Map tipkar codes to readable names (E=Entrada, S=Salida, etc.)
      const query = `
        SELECT 
          k.id,
          k.codalm,
          k.feckar as fecha,
          k.tipkar as tipoMovimiento,
          CASE k.tipkar
            WHEN 'E' THEN 'Entrada'
            WHEN 'S' THEN 'Salida'
            WHEN 'A' THEN 'Ajuste'
            WHEN 'I' THEN 'Inventario Inicial'
            ELSE k.tipkar
          END as tipoMovimientoNombre,
          k.dockar as documentoRef,
          k.cankar as cantidad,
          k.coskar as costo,
          k.observa as observaciones,
          k.codusu as usuario,
          k.fecsys as fechaRegistro
        FROM inv_kardex k
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY k.feckar DESC, k.fecsys DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `;

      const countQuery = `
        SELECT COUNT(*) as total 
        FROM inv_kardex k
        WHERE ${whereClauses.join(' AND ')}
      `;

      const [movimientos, countResult] = await Promise.all([
        executeQueryWithParams(query, params),
        executeQueryWithParams(countQuery, params) // Reusing params is safe here
      ]);

      const total = countResult[0]?.total || 0;

      res.json({
        success: true,
        data: {
          producto: { id: productoId, codins, nombre: nomins },
          movimientos
        },
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total,
          totalPages: Math.ceil(total / pageSizeNum)
        }
      });

    } catch (error) {
      console.error('Error getting Kardex:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo Kardex', error: error.message });
    }
  },

  // POST /api/inventario/entrada
  createInventoryEntry: async (req, res) => {
    const body = req.body || {};
    console.log('📦 [INVENTORY] createInventoryEntry called with body:', JSON.stringify(body));

    try {
      const { 
        productoId, cantidad, costoUnitario, 
        documentoRef, motivo, codalm = '001', codusu = 'SISTEMA',
        codcon, 
        numComprobante, numRemision, clienteId 
      } = body;

      // Validación básica
      if (!productoId || !cantidad || !costoUnitario) {
        console.log('❌ [INVENTORY] Missing required fields');
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios: productoId, cantidad, costoUnitario' });
      }

      const cantidadNum = parseFloat(cantidad);
      const costoNum = parseFloat(costoUnitario);
      
      if (isNaN(cantidadNum) || cantidadNum <= 0) return res.status(400).json({ success: false, message: 'La cantidad debe ser mayor a 0' });
      if (isNaN(costoNum) || costoNum < 0) return res.status(400).json({ success: false, message: 'El costo debe ser mayor o igual a 0' });

      // Determine movement type from Concept
      let tipoMovimiento = 'EN'; // Default
      let isSalida = false;

      if (codcon) {
        const conceptQuery = `SELECT tipcon FROM inv_conceptos WHERE codcon = @codcon`;
        const conceptResult = await executeQueryWithParams(conceptQuery, { codcon });
        
        if (conceptResult.length > 0) {
          const { tipcon } = conceptResult[0];
          isSalida = tipcon === 'S';
          tipoMovimiento = isSalida ? 'SA' : 'EN';
        }
      }

      const pool = await getConnection();
      const tx = new sql.Transaction(pool);
      await tx.begin();

      try {
        const docInt = parseInt(String(documentoRef).replace(/\D/g, '')) || 0;
        
        const commonParams = {
          transaction: tx,
          productoId,
          cantidad: cantidadNum,
          bodega: codalm,
          numeroDocumentoInt: docInt,
          tipoMovimiento: isSalida ? 'SA' : 'EN', 
          costo: costoNum,
          observaciones: motivo || (isSalida ? 'Salida manual' : 'Entrada manual'),
          codUsuario: codusu,
          clienteId: clienteId || '', // Use passed clienteId
          numComprobante: parseInt(numComprobante) || 0,
          numRemision: parseInt(numRemision) || 0
        };

        if (isSalida) {
             await InventoryService.registrarSalida(commonParams);
        } else {
             await InventoryService.registrarEntrada(commonParams);
        }

        await tx.commit();
        res.json({ success: true, message: isSalida ? 'Salida de inventario registrada' : 'Entrada de inventario registrada' });

      } catch (inner) {
        await tx.rollback();
        throw inner;
      }
    } catch (error) {
      console.error('Error creating inventory entry:', error);
      res.status(500).json({ success: false, message: 'Error creando movimiento', error: error.message });
    }
  },
  // GET /api/inventario/stock/:productoId
  // GET /api/inventario/movimientos - Obtener todos los movimientos de inventario (Global)
  getInventoryMovements: async (req, res) => {
    try {
      const { page = '1', pageSize = '20', search = '', sortBy = 'fecha', sortOrder = 'desc', codalm, tipo } = req.query;
      const pageNum = Math.max(1, parseInt(page) || 1);
      const pageSizeNum = Math.min(200, Math.max(5, parseInt(pageSize) || 20));
      const offset = (pageNum - 1) * pageSizeNum;

      let whereClause = '1=1';
      const params = { offset, pageSize: pageSizeNum };

      if (search) {
        whereClause += ` AND (p.nomins LIKE @search OR k.codins LIKE @search OR k.observa LIKE @search OR k.codusu LIKE @search)`;
        params.search = `%${search}%`;
      }

      if (codalm) {
        whereClause += ` AND k.codalm = @codalm`;
        params.codalm = codalm;
      }

      if (tipo) {
        if (tipo === 'ENTRADA') {
             // User requested only standard entries (EN) for the Inventory Entry section
             whereClause += ` AND k.tipkar = 'EN'`; 
        } else if (tipo === 'SALIDA') {
             whereClause += ` AND k.tipkar IN ('S', 'SA', 'SD')`;
        } else {
             whereClause += ` AND k.tipkar = @tipo`;
             params.tipo = tipo;
        }
      }

      // Mapping frontend sort keys to DB columns
      const sortMapping = {
        'fecha': 'k.feckar',
        'nombreProducto': 'p.nomins',
        'tipoMovimientoNombre': 'k.tipkar', // Approximate, as mapping happens in SELECT
        'cantidad': 'k.cankar',
        'costo': 'k.coskar',
        'precioVenta': 'k.venkar', // Actually logic is calculated, but venkar is the column
        'usuario': 'k.codusu',
        'referencia': 'k.observa',
        'fecsys': 'k.fecsys'
      };

      const dbSortCol = sortMapping[sortBy] || 'k.feckar';
      const dbSortDir = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      const query = `
        SELECT 
          k.id,
          k.codalm,
          k.feckar as fecha,
          k.tipkar as tipoMovimiento,
          CASE k.tipkar
            WHEN 'E' THEN 'Entrada'
            WHEN 'S' THEN 'Salida'
            WHEN 'A' THEN 'Ajuste'
            WHEN 'I' THEN 'Inventario Inicial'
            WHEN 'SA' THEN 'Salida'
            WHEN 'EN' THEN 'Entrada'
            ELSE k.tipkar
          END as tipoMovimientoNombre,
          k.dockar, 
          k.numrem, 
          k.numcom,
          k.cankar as cantidad,
          k.coskar as costo,
          k.venkar as precioVenta,
          k.observa as observaciones,
          k.codusu as usuario,
          p.nomins as nombreProducto,
          p.codins as codigoProducto
        FROM inv_kardex k
        LEFT JOIN inv_insumos p ON k.codins = p.codins
        WHERE ${whereClause}
        ORDER BY ${dbSortCol} ${dbSortDir}, k.id DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `;

      const countQuery = `
        SELECT COUNT(*) as total 
        FROM inv_kardex k
        LEFT JOIN inv_insumos p ON k.codins = p.codins
        WHERE ${whereClause}
      `;

      const [movimientos, countResult] = await Promise.all([
        executeQueryWithParams(query, params),
        executeQueryWithParams(countQuery, params)
      ]);

      const total = countResult[0]?.total || 0;

      res.json({
        success: true,
        data: movimientos,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total,
          totalPages: Math.ceil(total / pageSizeNum)
        }
      });

    } catch (error) {
      console.error('Error getting inventory movements:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo movimientos', error: error.message });
    }
  },

  getStock: async (req, res) => {
    try {
      const { productoId } = req.params;
      const { codalm } = req.query;

      if (!productoId || !codalm) {
        return res.status(400).json({ success: false, message: 'Producto ID y Código de Almacén requeridos' });
      }

      // Obtener codins del producto primero
      const prodQuery = `SELECT codins FROM ${TABLE_NAMES.productos} WHERE id = @id`;
      const prodResult = await executeQueryWithParams(prodQuery, { id: parseInt(productoId) });

      if (prodResult.length === 0) {
        return res.status(404).json({ success: false, message: 'Producto no encontrado' });
      }

      const { codins } = prodResult[0];

      // Consultar stock en inv_invent
      // Correction: Use 'caninv' instead of 'exiinv'
      const stockQuery = `
        SELECT caninv as stock 
        FROM inv_invent 
        WHERE codins = @codins AND codalm = @codalm
      `;
      
      const stockResult = await executeQueryWithParams(stockQuery, { 
        codins, 
        codalm: String(codalm).padStart(3, '0') 
      });

      const stock = stockResult.length > 0 ? stockResult[0].stock : 0;

      res.json({
        success: true,
        data: {
          stock: parseFloat(stock) || 0,
          codalm,
          productoId
        }
      });

    } catch (error) {
      console.error('Error getting stock:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo stock', error: error.message });
    }
  }
};

module.exports = inventoryController;
