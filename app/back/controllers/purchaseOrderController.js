const { executeQuery, executeQueryWithParams, getConnection } = require('../services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('../services/dbConfig.cjs');

const purchaseOrderController = {
  /**
   * Search Providers (Suppliers) with Email
   * Only returns providers (isproveedor = 1) that have a valid email
   */
  searchProveedores: async (req, res) => {
    try {
      const { search = '', limit = 20 } = req.query;
      if (String(search).trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Ingrese al menos 2 caracteres' });
      }

      const like = `%${search}%`;
      const query = `
        SELECT TOP (@limit)
          id,
          codter as numeroDocumento,
          nomter as razonSocial,
          apl1 as primerApellido,
          apl2 as segundoApellido,
          nom1 as primerNombre,
          nom2 as segundoNombre,
          dirter as direccion,
          TELTER as telefono,
          CELTER as celular,
          EMAIL as email,
          ciudad,
          plazo,
          regimen_tributario,
          isproveedor
        FROM con_terceros
        WHERE activo = 1 
          AND isproveedor = 1 
          AND EMAIL IS NOT NULL 
          AND LTRIM(RTRIM(EMAIL)) <> ''
          AND (nomter LIKE @like OR codter LIKE @like)
        ORDER BY nomter`;

      const data = await executeQueryWithParams(query, { like, limit: Number(limit) });
      
      const processedData = data.map(c => ({
        ...c,
        nombreCompleto: c.razonSocial || [c.primerNombre, c.segundoNombre, c.primerApellido, c.segundoApellido].filter(Boolean).join(' ').trim() || 'Sin Nombre'
      }));

      res.json({ success: true, data: processedData });
    } catch (error) {
      console.error('Error searching providers:', error);
      res.status(500).json({ success: false, message: 'Error buscando proveedores', error: error.message });
    }
  },

  /**
   * Get All Purchase Orders
   */
  getAllOrders: async (req, res) => {
    try {
      const { page = 1, pageSize = 50, search = '', codalm } = req.query;
      const offset = (page - 1) * pageSize;
      const searchTerm = `%${search}%`;

      let whereClause = "WHERE 1=1";
      const queryParams = { offset, pageSize: Number(pageSize), search: searchTerm };

      if (codalm) {
        whereClause += " AND m.codalm = @codalm";
        queryParams.codalm = codalm;
      }

      if (search) {
        whereClause += ` AND (
          CAST(m.numcom AS VARCHAR) LIKE @search OR 
          t.nomter LIKE @search OR
          m.codter LIKE @search
        )`;
      }

      // Main query for com_maeocompra joined with provider info
      const query = `
        SELECT 
          m.id,
          m.numcom as numeroOrden,
          m.codalm as almacen,
          m.feccom as fecha,
          m.valcom as valorBruto,
          m.ivacom as valorIva,
          m.netcom as total,
          m.estcom as estado,
          m.observaciones,
          t.nomter as proveedorNombre,
          t.codter as proveedorDocumento,
          t.EMAIL as proveedorEmail
        FROM ${TABLE_NAMES.ordenes_compra} m
        LEFT JOIN ${TABLE_NAMES.clientes} t ON m.codter = t.codter
        ${whereClause}
        ORDER BY m.numcom DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `;
      
      console.log('🔍 [DEBUG] Executing Query on Table:', TABLE_NAMES.ordenes_compra);
      console.log('🔍 [DEBUG] Full Query:', query);


      const countQuery = `
        SELECT COUNT(*) as total 
        FROM ${TABLE_NAMES.ordenes_compra} m
        LEFT JOIN ${TABLE_NAMES.clientes} t ON m.codter = t.codter
        ${whereClause}
      `;

      const [orders, countResult] = await Promise.all([
        executeQueryWithParams(query, queryParams),
        executeQueryWithParams(countQuery, queryParams)
      ]);

      res.json({
        success: true,
        data: orders,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: countResult[0].total
        }
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo órdenes de compra', error: error.message });
    }
  },

  /**
   * Get Order by ID (Detail)
   */
  getOrderById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const maeoQuery = `
        SELECT 
          m.*,
          t.nomter as proveedorNombre,
          t.dirter as proveedorDireccion,
          t.TELTER as proveedorTelefono,
          t.EMAIL as proveedorEmail
        FROM ${TABLE_NAMES.ordenes_compra} m
        LEFT JOIN ${TABLE_NAMES.clientes} t ON m.codter = t.codter
        WHERE m.id = @id
      `;

      const itemsQuery = `
        SELECT 
          d.*,
          p.id as id_insumo,
          p.nomins as productoNombre,
          p.referencia as productoReferencia,
          p.undins as unidadMedida
        FROM ${TABLE_NAMES.ordenes_compra_detalle} d
        LEFT JOIN ${TABLE_NAMES.productos} p ON LTRIM(RTRIM(d.codins)) = LTRIM(RTRIM(p.codins))
        WHERE d.id_maecompra = @id
      `;

      const [maeoResult, itemsResult] = await Promise.all([
        executeQueryWithParams(maeoQuery, { id }),
        executeQueryWithParams(itemsQuery, { id })
      ]);

      if (maeoResult.length === 0) {
        return res.status(404).json({ success: false, message: 'Orden de compra no encontrada' });
      }

      res.json({
        success: true,
        data: {
          ...maeoResult[0],
          items: itemsResult
        }
      });
    } catch (error) {
      console.error('Error fetching order detail:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo detalle de orden', error: error.message });
    }
  },

  /**
   * Get Order by Number (Detail)
   */
  getOrderByNumber: async (req, res) => {
    try {
      const { number } = req.params;
      const { codalm } = req.query; // Extract codalm from query string

      console.log('🔍 [DEBUG] Searching Order By Number:', number, 'in Warehouse:', codalm);
      
      const maeoQuery = `
        SELECT 
          m.*,
          t.nomter as proveedorNombre,
          t.dirter as proveedorDireccion,
          t.TELTER as proveedorTelefono,
          t.EMAIL as proveedorEmail,
          t.codter as proveedorDocumento
        FROM ${TABLE_NAMES.ordenes_compra} m
        LEFT JOIN ${TABLE_NAMES.clientes} t ON m.codter = t.codter
        WHERE LTRIM(RTRIM(m.numcom)) = @number 
          ${codalm ? 'AND m.codalm = @codalm' : ''} -- Optional filter but highly recommended
      `;

      // Get the ID first to fetch items
      const maeoResult = await executeQueryWithParams(maeoQuery, { 
        number: String(number).trim(),
        codalm 
      });
      
      console.log('🔍 [DEBUG] Order Search Result Type:', typeof maeoResult);
      // Handle case where result might be single object or array
      const orderHeader = Array.isArray(maeoResult) ? maeoResult[0] : maeoResult;

      if (!orderHeader || (Array.isArray(maeoResult) && maeoResult.length === 0)) {
        return res.status(404).json({ success: false, message: 'Orden de compra no encontrada' });
      }

      const orderId = orderHeader.id;
      console.log('🔍 [DEBUG] Order ID found:', orderId);

      const itemsQuery = `
        SELECT 
          d.*,
          p.id as id_insumo,
          p.nomins as productoNombre,
          p.referencia as productoReferencia,
          p.undins as unidadMedida
        FROM ${TABLE_NAMES.ordenes_compra_detalle} d
        LEFT JOIN ${TABLE_NAMES.productos} p ON LTRIM(RTRIM(d.codins)) = LTRIM(RTRIM(p.codins))
        WHERE d.id_maecompra = @orderId
      `;

      const itemsResult = await executeQueryWithParams(itemsQuery, { orderId });
      console.log('🔍 [DEBUG] Order Items Count:', itemsResult?.length);

      res.json({
        success: true,
        data: {
          ...maeoResult[0],
          items: itemsResult
        }
      });
    } catch (error) {
      console.error('Error fetching order by number:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo detalle de orden por número', error: error.message });
    }
  },

  /**
   * Create Purchase Order
   */
  createOrder: async (req, res) => {
    try {
      const { 
        codalm = '001', 
        codter, 
        feccom, 
        observaciones,
        items,
        usuario, 
        totals,
        numcom // Allow manual override if needed
      } = req.body;

      if (!codter || !items || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Datos incompletos (proveedor o items)' });
      }

      let finalNumCom = numcom;

      // 1. Calculate next number if not provided
      if (!finalNumCom) {
        const numComQuery = `
          SELECT ISNULL(MAX(numcom), 0) + 1 as nextNum 
          FROM ${TABLE_NAMES.ordenes_compra} 
          WHERE codalm = @codalm
        `;
        const numResult = await executeQueryWithParams(numComQuery, { codalm });
        finalNumCom = numResult[0].nextNum;
      }

      // 2. Anti-duplicate validation check (Critical per user request)
      const maxCheckQuery = `
        SELECT count(*) as count 
        FROM ${TABLE_NAMES.ordenes_compra}
        WHERE numcom = @numcom AND codalm = @codalm
      `;
      const [checkResult] = await executeQueryWithParams(maxCheckQuery, { numcom: finalNumCom, codalm });
      
      if (checkResult && checkResult.count > 0) {
        return res.status(400).json({ 
          success: false, 
          message: `El número de orden ${finalNumCom} ya existe en el almacén ${codalm}. Por favor verifique o intente nuevamente.` 
        });
      }

      // 3. Use finalNumCom for insertion
      const nextNum = finalNumCom;

      // 2. Insert Header (com_maeocompra)
      // Mapping fields based on user request schema
      // 2. Insert Header (com_maeocompra)
      // Updated to match EXACT user schema
      const insertMaeoQuery = `
        INSERT INTO ${TABLE_NAMES.ordenes_compra} (
          codalm, numcom, codter, feccom, 
          valcom, ivacom, descom, valfletes, valret, 
          VALRETEIVA, VALRETEICA, AJUSTE_PESO,
          netcom, valfac, valant, aboant,
          codusu, fecsys, estcom, okcom, observaciones
        ) VALUES (
          @codalm, @numcom, @codter, @feccom,
          @valcom, @ivacom, @descom, @valfletes, @valret, 
          @valreteiva, @valreteica, @ajuste_peso,
          @netcom, 0, 0, 0,
          @codusu, GETDATE(), 'P', 0, @observaciones
        );
        SELECT SCOPE_IDENTITY() as id;
      `;

      // Extract retentions from body if available
      const retenciones = req.body.retenciones || {};

      const maeoParams = {
        codalm,
        numcom: nextNum,
        codter,
        feccom: feccom ? new Date(feccom) : new Date(),
        valcom: totals.subtotal || 0,
        ivacom: totals.iva || 0,
        descom: totals.descuentos || req.body.valdescuentos || 0,
        valfletes: req.body.valfletes || 0, 
        valret: req.body.valret || 0, // This is Total Retenciones (Source)
        valreteiva: retenciones.reteivaValor || 0,
        valreteica: retenciones.reteicaValor || 0,
        ajuste_peso: req.body.valajuste || 0,
        netcom: totals.total || 0, // This is Total Orden
        codusu: usuario || 'SYSTEM',
        observaciones: observaciones || ''
      };

      const maeoResult = await executeQueryWithParams(insertMaeoQuery, maeoParams);
      const maeoId = maeoResult[0].id;

      // 3. Insert Items (com_ocompra)
      for (const item of items) {
        // Calculate item discount value if not provided
        const itemQty = Number(item.cantidad) || 0;
        const itemPrice = Number(item.precioUnitario) || 0;
        const itemDescPct = Number(item.descuentoPorcentaje) || 0;
        const calcDescVal = (itemQty * itemPrice * itemDescPct) / 100;

        const insertItemQuery = `
          INSERT INTO ${TABLE_NAMES.ordenes_compra_detalle} (
             id_maecompra, codalm, numcom, feccom, codter,
             codins, cancom, vuncom, 
             cpecom, crecom, cfacom,
             ivains, ivacom,
             desins, descom, 
             valant, estcom, numfac, remision, saberRadicacion, diasgar,
             okcom, codusu, fecsys, 
             codlab, lote, VENCE_lote, ajuste_peso, qtydev, id_factura,
             tasa_retencion, tasa_reteica, tasa_reteiva
          ) VALUES (
             @id_maecompra, @codalm, @numcom, @feccom, @codter,
             @codins, @cancom, @vuncom,
             @cancom, 0, 0, -- cpecom (pend), crecom (recib), cfacom (fact)
             @ivains, @ivacomItem,
             @desins, @descomItem, 
             0, 'P', 0, 0, 0, 0, -- valant, estcom, numfac, rem, rad, dias
             0, @codusu, GETDATE(),
             '', '', NULL, 0, 0, 0, -- codlab, lote, vence, ajuste, qtydev, id_fac
             0, 0, 0 -- tasas det.
          )
        `;
        
        await executeQueryWithParams(insertItemQuery, {
          id_maecompra: maeoId,
          codalm,
          numcom: nextNum,
          feccom: feccom ? new Date(feccom) : new Date(),
          codter,
          codins: String(item.productoId), 
          cancom: itemQty,
          vuncom: itemPrice,
          ivains: item.ivaPorcentaje || 0, 
          ivacomItem: item.valorIva || 0, 
          desins: itemDescPct, 
          descomItem: req.body.descom || calcDescVal, // Use calc if not provided 
          codusu: usuario || 'SYSTEM'
        });
      }

      res.json({ 
        success: true, 
        message: 'Orden de compra creada exitosamente',
        data: { id: maeoId, numcom: nextNum }
      });

    } catch (error) {
      console.error('Error creating purchase order:', error);
      res.status(500).json({ success: false, message: 'Error creando orden de compra', error: error.message });
    }
  }
};

module.exports = purchaseOrderController;
