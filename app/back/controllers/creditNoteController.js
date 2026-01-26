const sql = require('mssql');
const { getConnection, executeQuery, executeQueryWithParams } = require('../services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('../services/dbConfig.cjs');
const DIANService = require('../services/dian-service.cjs');
const InventoryService = require('../services/inventoryService.js');

// --- Helper Functions ---

const mapNotaCreditoHeader = (row) => ({
  id: row.id,
  numero: row.numero,
  facturaId: row.facturaId,
  clienteId: row.clienteId,
  fechaEmision: row.fechaEmision,
  subtotal: Number(row.subtotal) || 0,
  iva: Number(row.iva) || 0,
  total: Number(row.total) || 0,
  motivo: row.motivo,
  estadoDian: row.estadoDian,
  cufe: row.cufe,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  cufe: row.cufe
});

const generateNumeroNotaCredito = async (transaction) => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const baseNumero = `NC-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;

  const req = new sql.Request(transaction);
  req.input('numero', sql.VarChar(50), baseNumero);
  const existing = await req.query(`
    SELECT id 
    FROM gen_movimiento_notas 
    WHERE comprobante = @numero
  `);

  if (existing.recordset.length === 0) {
    return baseNumero;
  }

  return `${baseNumero}-${Math.floor(Math.random() * 9000) + 1000}`;
};

const sanitizeNumber = (value, precision = 2) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(value.toFixed(precision));
  }
  const parsed = parseFloat(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Number(parsed.toFixed(precision));
};

const toPositiveNumber = (value, precision = 2) => {
  const num = sanitizeNumber(value, precision);
  return num < 0 ? 0 : num;
};

const buildNotaDetallePayload = (item) => {
  const productoIdNum = typeof item.productoId === 'number'
    ? item.productoId
    : parseInt(String(item.productoId).trim(), 10);

  if (!Number.isFinite(productoIdNum)) {
    throw new Error(`Producto inválido: ${item.productoId}`);
  }

  const cantidad = toPositiveNumber(item.cantidad, 4);
  const precioUnitario = toPositiveNumber(item.precioUnitario, 4);
  const descuentoPorcentaje = toPositiveNumber(item.descuentoPorcentaje, 4);
  const ivaPorcentaje = toPositiveNumber(item.ivaPorcentaje, 4);

  const base = Number((precioUnitario * cantidad).toFixed(4));
  const descuentoValor = Number((base * (descuentoPorcentaje / 100)).toFixed(4));
  const subtotal = Number((base - descuentoValor).toFixed(4));
  const valorIva = Number((subtotal * (ivaPorcentaje / 100)).toFixed(4));
  const total = Number((subtotal + valorIva).toFixed(4));

  if (cantidad <= 0) {
    throw new Error(`La cantidad debe ser mayor que cero para el producto ${productoIdNum}`);
  }

  return {
    productoId: productoIdNum,
    cantidad,
    precioUnitario,
    descuentoPorcentaje,
    ivaPorcentaje,
    subtotal: Number(subtotal.toFixed(2)),
    valorIva: Number(valorIva.toFixed(2)),
    total: Number(total.toFixed(2))
  };
};

const fetchNotaCreditoById = async (connection, notaId, transaction = null) => {
  const runner = transaction ? new sql.Request(transaction) : connection.request();
  runner.input('notaId', sql.Int, notaId);
  const notaResult = await runner.query(`
    SELECT 
      id,
      consecutivo AS numero,
      id_factura AS facturaId,
      codter AS clienteId,
      fecha AS fechaEmision,
      valor_nota AS subtotal,
      iva_nota AS iva,
      total_nota AS total,
      detalle AS motivo,
      CASE WHEN estado_envio = 1 THEN '1' ELSE '0' END AS estadoDian,
      fecsys AS createdAt,
      fecsys AS updatedAt,
      cufe
    FROM gen_movimiento_notas
    WHERE id = @notaId
  `);

  if (notaResult.recordset.length === 0) {
    return null;
  }

  const detalleRunner = transaction ? new sql.Request(transaction) : connection.request();
  detalleRunner.input('notaId', sql.Int, notaId);
  const detalleResult = await detalleRunner.query(`
    SELECT 
      id_nota,
      Codins AS productoId, -- Ojo: esto devuelve el código, no el ID numérico
      QTYDEV AS cantidad,
      Venta AS precioUnitario,
      desins AS descuentoPorcentaje,
      Iva AS ivaPorcentaje,
      (QTYDEV * Venta) AS subtotal, -- Calculado
      (QTYDEV * Venta * (Iva/100)) AS valorIva, -- Calculado
      ((QTYDEV * Venta) + (QTYDEV * Venta * (Iva/100))) AS total -- Calculado
    FROM Ven_Devolucion
    WHERE id_nota = @notaId
  `);

  // Mapeo manual de los items ya que la estructura es diferente
  const itemsDevueltos = (detalleResult.recordset || []).map(row => ({
    productoId: row.productoId, // Es string (codins)
    cantidad: Number(row.cantidad),
    precioUnitario: Number(row.precioUnitario),
    descuentoPorcentaje: Number(row.descuentoPorcentaje),
    ivaPorcentaje: Number(row.ivaPorcentaje),
    subtotal: Number(row.subtotal),
    valorIva: Number(row.valorIva),
    total: Number(row.total)
  }));

  return {
    ...mapNotaCreditoHeader(notaResult.recordset[0]),
    itemsDevueltos
  };
};

const TOLERANCIA_CANTIDADES = 0.0001;

// --- Controller Methods ---

const creditNoteController = {
  // GET /api/devoluciones/clientes-con-facturas-aceptadas
  getClientsWithAcceptedInvoices: async (req, res) => {
    try {
      const query = `
        SELECT 
          t.id AS clienteId,
          t.codter AS numeroDocumento,
          t.nomter AS razonSocial,
          t.nom1 AS primerNombre,
          t.nom2 AS segundoNombre,
          t.apl1 AS primerApellido,
          t.apl2 AS segundoApellido,
          t.EMAIL as email,
          t.TELTER as telefono,
          f.id AS facturaId,
          f.numfact AS numeroFactura,
          f.fecfac AS fechaFactura,
          f.netfac AS total,
          f.codalm AS codalm,
          f.CUFE as cufe
        FROM ven_facturas f
        INNER JOIN con_terceros t ON t.codter = f.codter
        WHERE f.estfac = 'A'
        AND EXISTS (
            SELECT 1
            FROM ven_detafact df
            WHERE df.id_factura = f.id
            AND df.qtyins > ISNULL((
                SELECT SUM(d.QTYDEV)
                FROM Ven_Devolucion d
                INNER JOIN gen_movimiento_notas n ON n.id = d.id_nota
                WHERE n.id_factura = f.id
                AND (n.estado IS NULL OR n.estado != 'RE')
                AND LTRIM(RTRIM(d.Codins)) = LTRIM(RTRIM(df.codins))
            ), 0) + 0.0001 -- Tolerancia pequeña para flotantes
        )
        ORDER BY t.nomter, f.fecfac DESC
      `;

      const result = await executeQuery(query, req.db_name);

      // Agrupar resultados por cliente
      const clientesMap = new Map();

      result.forEach(row => {
        const clienteId = row.clienteId;
        if (!clientesMap.has(clienteId)) {
          // Construir nombre completo
          let nombreCompleto = row.razonSocial;
          if (!nombreCompleto) {
            const nombres = [row.primerNombre, row.segundoNombre].filter(Boolean).join(' ');
            const apellidos = [row.primerApellido, row.segundoApellido].filter(Boolean).join(' ');
            nombreCompleto = [nombres, apellidos].filter(Boolean).join(' ').trim();
          }

          clientesMap.set(clienteId, {
            id: String(clienteId),
            numeroDocumento: row.numeroDocumento,
            nombreCompleto: nombreCompleto || 'Sin Nombre',
            telefono: row.telefono,
            email: row.email,
            facturasAceptadas: []
          });
        }

        const cliente = clientesMap.get(clienteId);
        cliente.facturasAceptadas.push({
          id: String(row.facturaId),
          numeroFactura: row.numeroFactura,
          fechaFactura: row.fechaFactura,
          total: row.total,
          codalm: row.codalm,
          cufe: row.cufe
        });
      });

      const clientes = Array.from(clientesMap.values());
      res.json({ success: true, data: clientes });
    } catch (error) {
      console.error('❌ Error obteniendo clientes para devolución:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo clientes para devolución',
        error: error.message
      });
    }
  },

  // GET /api/notas-credito
  getAllCreditNotes: async (req, res) => {
    try {
      const { page = '1', pageSize = '100', facturaId, clienteId } = req.query;
      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const pageSizeNum = Math.min(500, Math.max(10, parseInt(String(pageSize), 10) || 100)); // Máximo 500
      const offset = (pageNum - 1) * pageSizeNum;

      const pool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);

      // Construir WHERE
      let whereClauses = [];
      const params = { offset, pageSize: pageSizeNum };

      if (facturaId) {
        whereClauses.push('factura_id = @facturaId');
        params.facturaId = parseInt(facturaId, 10);
      }

      if (clienteId) {
        whereClauses.push('cliente_id = @clienteId');
        params.clienteId = parseInt(clienteId, 10) || String(clienteId).trim();
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      console.log('🔍 [DEBUG] Executing getAllCreditNotes query on gen_movimiento_notas');
      // Query principal con paginación
      const query = `
        SELECT 
          id,
          consecutivo AS numero,
          id_factura AS facturaId,
          LTRIM(RTRIM(codter)) AS clienteId,
          fecha AS fechaEmision,
          valor_nota AS subtotal,
          iva_nota AS iva,
          total_nota AS total,
          detalle AS motivo,
          CASE WHEN estado_envio = 1 THEN '1' ELSE '0' END AS estadoDian,
          fecsys AS createdAt,
          fecsys AS updatedAt,
          cufe
        FROM gen_movimiento_notas
        ${whereClause.replace('factura_id', 'id_factura').replace('cliente_id', 'codter')}
        ORDER BY fecha DESC, id DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `;

      // Query para contar total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM gen_movimiento_notas
        ${whereClause.replace('factura_id', 'id_factura').replace('cliente_id', 'codter')}
      `;

      const [notasResult, countResult] = await Promise.all([
        executeQueryWithParams(query, params, req.db_name),
        executeQueryWithParams(countQuery, facturaId || clienteId ? { ...(facturaId && { facturaId: params.facturaId }), ...(clienteId && { clienteId: params.clienteId }) } : {}, req.db_name)
      ]);

      const notas = notasResult || [];
      const total = countResult[0]?.total || 0;
      const totalPages = Math.ceil(total / pageSizeNum);

      let detalleMap = new Map();

      // Solo cargar detalles si hay notas
      if (notas.length > 0 && notas.length <= 100) {
        const idsList = notas.map((nota) => nota.id).filter(Boolean);
        if (idsList.length > 0) {
          const request = pool.request();
          const placeholders = idsList.map((_, i) => `@id${i}`).join(',');
          idsList.forEach((id, i) => {
            request.input(`id${i}`, sql.Int, id);
          });

          const detallesQuery = `
            SELECT 
              g.id AS notaId,
              LTRIM(RTRIM(d.Codins)) AS productoId,
              d.QTYDEV AS cantidad,
              d.Venta AS precioUnitario,
              d.desins AS descuentoPorcentaje,
              d.Iva AS ivaPorcentaje,
              ROUND((d.QTYDEV * d.Venta), 0) AS subtotal,
              ROUND((d.QTYDEV * d.Venta * (d.Iva/100)), 0) AS valorIva,
              ROUND(((d.QTYDEV * d.Venta) + (d.QTYDEV * d.Venta * (d.Iva/100))), 0) AS total,
              LTRIM(RTRIM(COALESCE(i.nomins, ''))) as descripcion,
              d.id_nota,
              d.Numdev,
              g.consecutivo
            FROM gen_movimiento_notas g
            INNER JOIN Ven_Devolucion d ON (d.id_nota = g.id OR (g.consecutivo IS NOT NULL AND d.Numdev = g.consecutivo))
            LEFT JOIN inv_insumos i ON LTRIM(RTRIM(i.codins)) = LTRIM(RTRIM(d.Codins))
            WHERE g.id IN (${placeholders})
          `;
          
          console.log('🔍 Executing detallesQuery for credit notes...');
          const detallesResult = await request.query(detallesQuery);
          console.log(`✅ Detalles found: ${detallesResult.recordset.length}`);

          detalleMap = (detallesResult.recordset || []).reduce((acc, detalle) => {
            const key = detalle.notaId;
            if (!acc.has(key)) {
              acc.set(key, []);
            }
            acc.get(key).push({
              productoId: detalle.productoId,
              cantidad: Number(detalle.cantidad),
              precioUnitario: Number(detalle.precioUnitario),
              descuentoPorcentaje: Number(detalle.descuentoPorcentaje),
              ivaPorcentaje: Number(detalle.ivaPorcentaje),
              subtotal: Number(detalle.subtotal),
              valorIva: Number(detalle.valorIva),
              total: Number(detalle.total),
              descripcion: detalle.descripcion || ''
            });
            return acc;
          }, new Map());
        }
      }

      const data = notas.map((nota) => ({
        ...mapNotaCreditoHeader(nota),
        itemsDevueltos: detalleMap.get(nota.id) || []
      }));

      res.json({
        success: true,
        data,
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
      console.error('❌ Error obteniendo notas de crédito:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo notas de crédito',
        error: error.message
      });
    }
  },

  // POST /api/notas-credito
  createCreditNote: async (req, res) => {
    console.log('📥 Recibida solicitud POST /api/notas-credito');
    console.log('📥 Recibida solicitud POST /api/notas-credito');
    const body = req.body || {};
    console.log('📦 Payload:', JSON.stringify(body, null, 2));

    try {
      const {
        facturaId,
        clienteId,
        motivo,
        items = [],
        fechaEmision,
        numero,
        estadoDian,
        tipoNota,
        codalm: codalmreq, // Extraer codalm del body
        testMode, // Flag para modo de prueba
        usuario
      } = body;

      const usuarioFinal = String(usuario || 'SISTEMA').substring(0, 10).toUpperCase();

      // Determinar codalm final: prioridad request > factura > '001'
      // NOTA: Se debe usar después de obtener 'factura'


      if (!facturaId) {
        return res.status(400).json({
          success: false,
          message: 'facturaId es obligatorio para registrar una nota de crédito'
        });
      }

      if (!motivo || !String(motivo).trim()) {
        return res.status(400).json({
          success: false,
          message: 'motivo es obligatorio para registrar una nota de crédito'
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Debe incluir al menos un item devuelto'
        });
      }

      const pool = await require('../services/sqlServerClient.cjs').getConnectionForDb(req.db_name);
      // Si es testMode, no iniciamos transacción real aun, o usamos una dummy/rollback al final
      // Pero mejor: Para testMode, solo leemos datos.

      let tx;
      if (!testMode) {
        tx = new sql.Transaction(pool);
        await tx.begin();
        console.log('🔄 Transacción iniciada');
      } else {
        console.log('🧪 MODO DE PRUEBA: No se iniciará transacción de escritura');
      }

      const safeRollback = async () => { if (tx) await tx.rollback(); };
      const createRequest = () => testMode ? pool.request() : new sql.Request(tx);

      try {
        const facturaRequest = createRequest();
        let factura;
        const facturaIdNum = typeof facturaId === 'number' ? facturaId : parseInt(String(facturaId).trim(), 10);

        if (!Number.isNaN(facturaIdNum)) {
          facturaRequest.input('facturaId', sql.Int, facturaIdNum);
          const facturaResult = await facturaRequest.query(`
            SELECT 
              id AS id,
              numfact AS numeroFactura,
              codter AS clienteId,
              valvta AS subtotal,
              netfac AS total,
              CUFE,
              estado_envio,
              estfac AS estado,
              codalm,
              tipfac AS tipoFactura
            FROM ven_facturas
            WHERE id = @facturaId
          `);

          if (facturaResult.recordset.length === 0) {
            await safeRollback();
            return res.status(404).json({
              success: false,
              message: `Factura con ID ${facturaId} no encontrada`
            });
          }
          factura = facturaResult.recordset[0];
        } else {
          const facturaNumero = String(facturaId).trim();
          if (!facturaNumero) {
            await safeRollback();
            return res.status(400).json({
              success: false,
              message: 'facturaId inválido. Debe ser un número de ID o el número de factura'
            });
          }

          const facturaNumeroRequest = createRequest();
          facturaNumeroRequest.input('numeroFactura', sql.VarChar(50), facturaNumero);
          const facturaResult = await facturaNumeroRequest.query(`
            SELECT 
              id AS id,
              numfact AS numeroFactura,
              codter AS clienteId,
              valvta AS subtotal,
              netfac AS total,
              CUFE,
              estado_envio,
              estfac AS estado,
              codalm,
              tipfac AS tipoFactura
            FROM ven_facturas
            WHERE numfact = @numeroFactura
          `);

          if (facturaResult.recordset.length === 0) {
            await safeRollback();
            return res.status(404).json({
              success: false,
              message: `Factura con número ${facturaNumero} no encontrada`
            });
          }
          factura = facturaResult.recordset[0];
        }

        const cufe = factura.CUFE ? String(factura.CUFE).trim() : null;
        if (!cufe || cufe === '' || cufe === 'null' || cufe === 'undefined') {
          await safeRollback();
          return res.status(400).json({
            success: false,
            message: `No se puede crear una devolución desde una factura que no está timbrada en la DIAN.`,
            error: 'FACTURA_NO_TIMBRADA'
          });
        }

        const clienteFacturaId = String(factura.clienteId || '').trim();
        const clienteFinal = clienteFacturaId || String(clienteId || '').trim();

        if (!clienteFinal) {
          await safeRollback();
          return res.status(400).json({
            success: false,
            message: 'No se pudo determinar el cliente asociado a la nota de crédito'
          });
        }

        if (clienteId && String(clienteId).trim() && clienteFacturaId && clienteFacturaId !== String(clienteId).trim()) {
          await safeRollback();
          return res.status(400).json({
            success: false,
            message: `El cliente proporcionado (${clienteId}) no coincide con el cliente de la factura (${clienteFacturaId})`
          });
        }

        const detalleFacturaRequest = createRequest();
        detalleFacturaRequest.input('facturaId', sql.Int, factura.id);
        const detalleFacturaResult = await detalleFacturaRequest.query(`
          SELECT 
            codins AS productoId,
            qtyins AS cantidad
          FROM ven_detafact
          WHERE id_factura = @facturaId
        `);

        if (detalleFacturaResult.recordset.length === 0) {
          await safeRollback();
          return res.status(400).json({
            success: false,
            message: 'La factura seleccionada no tiene detalles registrados'
          });
        }

        const detalleFactura = detalleFacturaResult.recordset.map((row) => ({
          key: String(row.productoId).trim().toLowerCase(),
          cantidad: Number(row.cantidad) || 0
        }));

        const devolucionesPreviasRequest = createRequest();
        devolucionesPreviasRequest.input('facturaId', sql.Int, factura.id);
        const devolucionesPreviasResult = await devolucionesPreviasRequest.query(`
          SELECT 
            d.Codins AS productoId,
            d.QTYDEV AS cantidad
          FROM Ven_Devolucion d
          INNER JOIN gen_movimiento_notas n ON n.id = d.id_nota
          WHERE n.id_factura = @facturaId 
          AND (n.estado = 'OK' OR n.estado_envio = 1)
        `);

        const devolucionesPrevias = (devolucionesPreviasResult.recordset || []).reduce((acc, row) => {
          const key = String(row.productoId).trim().toLowerCase();
          const cantidad = Number(row.cantidad) || 0;
          acc.set(key, (acc.get(key) || 0) + cantidad);
          return acc;
        }, new Map());

        const productosCache = new Map();
        const devolucionesActuales = new Map();
        const detallesNormalizados = [];

        for (const rawItem of items) {
          const normalizado = buildNotaDetallePayload(rawItem);

          if (!productosCache.has(normalizado.productoId)) {
            const reqProducto = createRequest();
            reqProducto.input('productoId', sql.Int, normalizado.productoId);
            const productoResult = await reqProducto.query(`
              SELECT TOP 1 id, codins, referencia 
              FROM inv_insumos
              WHERE id = @productoId
            `);

            if (productoResult.recordset.length === 0) {
              await safeRollback();
              return res.status(400).json({
                success: false,
                message: `Producto con ID ${normalizado.productoId} no existe en inv_insumos`
              });
            }

            productosCache.set(normalizado.productoId, {
              id: productoResult.recordset[0].id,
              codins: productoResult.recordset[0].codins ? String(productoResult.recordset[0].codins).trim().toLowerCase() : null,
              referencia: productoResult.recordset[0].referencia ? String(productoResult.recordset[0].referencia).trim() : null
            });
          }

          const productoInfo = productosCache.get(normalizado.productoId);
          const posiblesKeys = [String(normalizado.productoId).trim().toLowerCase()];
          if (productoInfo.codins) posiblesKeys.push(productoInfo.codins);

          const detalleFacturaMatch = detalleFactura.find((detalle) => posiblesKeys.includes(detalle.key));

          if (!detalleFacturaMatch) {
            await safeRollback();
            return res.status(400).json({
              success: false,
              message: `El producto ${normalizado.productoId} no pertenece a la factura seleccionada`
            });
          }

          const cantidadFactura = detalleFacturaMatch.cantidad || 0;
          const keyDetalle = detalleFacturaMatch.key;
          const cantidadDevueltaAnterior = devolucionesPrevias.get(keyDetalle) || 0;
          const cantidadDevueltaActual = devolucionesActuales.get(keyDetalle) || 0;
          const cantidadNuevaTotal = cantidadDevueltaAnterior + cantidadDevueltaActual + normalizado.cantidad;

          if (cantidadNuevaTotal - cantidadFactura > TOLERANCIA_CANTIDADES) {
            await safeRollback();
            return res.status(400).json({
              success: false,
              message: `La cantidad devuelta para el producto ${normalizado.productoId} excede la cantidad facturada.`
            });
          }

          devolucionesActuales.set(keyDetalle, cantidadDevueltaActual + normalizado.cantidad);
          detallesNormalizados.push({ 
            ...normalizado, 
            matchKey: keyDetalle, 
            referencia: productoInfo.referencia 
          });
        }

        const subtotalTotal = detallesNormalizados.reduce((acc, item) => acc + item.subtotal, 0);
        const ivaTotal = detallesNormalizados.reduce((acc, item) => acc + item.valorIva, 0);
        const totalTotal = detallesNormalizados.reduce((acc, item) => acc + item.total, 0);

        const fechaNota = fechaEmision ? new Date(fechaEmision) : new Date();

        let numeroNota = String(numero || '').trim();

        // SI ES MODO DE PRUEBA: Generar JSON y retornar sin guardar
        if (testMode) {
          console.log('🧪 Generando JSON para previsualización (Test Mode)');
          const facturaData = await DIANService.getFacturaCompleta(factura.id);
          const resolution = await DIANService.getDIANCreditNoteResolution();
          const dianParams = await DIANService.getDIANParameters();

          let nextNum;
          if (numeroNota) {
            nextNum = parseInt(numeroNota, 10);
            console.log(`🧪 Usando número proporcionado para prueba: ${nextNum}`);
          } else {
            // Calcular consecutivo numérico simulado para que el JSON no tenga number: null
            const consecutivoRequest = createRequest();
            // Modified to exclude the erroneous record 51 so we resume from 6
            // Also consolidated variable usage to avoid redeclaration error

            // Modified to exclude the erroneous record 51 so we resume from 6
            const maxNumResult = await consecutivoRequest.query(`
                    SELECT MAX(consecutivo) as maxNum 
                    FROM gen_movimiento_notas 
                    WHERE consecutivo < 100000 AND consecutivo <> 51
                `);

            const maxNum = maxNumResult.recordset[0]?.maxNum;
            if (maxNum) {
              nextNum = Number(maxNum) + 1;
            } else {
              nextNum = 1;
            }

            // Check if calculated number exists (handling the skip from 50 -> 52 over 51)
            let exists = true;
            while(exists) {
               const checkReq = createRequest();
               checkReq.input('checkNum', sql.Int, nextNum);
               const checkRes = await checkReq.query('SELECT 1 FROM gen_movimiento_notas WHERE consecutivo = @checkNum');
               if(checkRes.recordset.length > 0) {
                 nextNum++;
               } else {
                 exists = false;
               }
            }
            console.log(`🧪 Consecutivo simulado para prueba: ${nextNum}`);
          }

          // Construir objeto nota temporal para la transformación
          const notaTemp = {
            id: 0,
            numero: nextNum, // Número real para que parseInt no de NaN
            facturaId: factura.id,
            clienteId: clienteFinal,
            fechaEmision: fechaNota,
            subtotal: subtotalTotal,
            iva: ivaTotal,
            total: totalTotal,
            motivo: motivo,
            estadoDian: '0',
            cufe: null,
            itemsDevueltos: detallesNormalizados.map(d => ({
              ...d,
              descripcion: d.descripcion || `Producto ${d.productoId}`
            }))
          };

          // Completar descripciones si faltan
          for (const item of notaTemp.itemsDevueltos) {
            if (!item.descripcion || item.descripcion.startsWith('Producto')) {
              try {
                const descReq = pool.request();
                descReq.input('pid', sql.Int, item.productoId);
                const descRes = await descReq.query('SELECT nomins FROM inv_insumos WHERE id = @pid');
                if (descRes.recordset.length > 0) {
                  item.descripcion = descRes.recordset[0].nomins;
                }
              } catch (e) { }
            }
          }

          const notaData = {
            nota: { ...notaTemp, tipo_nota: tipoNota },
            detalles: notaTemp.itemsDevueltos,
            facturaOriginal: facturaData.factura,
            cliente: facturaData.cliente
          };

          const notaJson = await DIANService.transformNotaCreditoForDIAN(notaData, resolution, dianParams);

          return res.json({
            success: true,
            isTest: true,
            message: 'JSON generado exitosamente (Modo Prueba)',
            data: notaJson,
            notaPreview: notaTemp
          });
        }
        let isUpdate = false;
        let nextConsecutivo;

        if (!numeroNota) {
          numeroNota = await generateNumeroNotaCredito(tx);
        } else {
          const numeroReq = new sql.Request(tx);
          numeroReq.input('numero', sql.VarChar(50), numeroNota);
          const numeroResult = await numeroReq.query(`
            SELECT id, estado FROM gen_movimiento_notas WHERE comprobante = @numero
          `);

          if (numeroResult.recordset.length > 0) {
            const existingNote = numeroResult.recordset[0];
            // Check if existing note is Rejected/Error
            if (existingNote.estado === 'RE' || existingNote.estado === 'AN') {
              console.log(`♻️ Modificando nota existente ${numeroNota} (ID: ${existingNote.id})`);
              isUpdate = true;
              nuevaNotaId = existingNote.id;
              // We need to fetch 'consecutivo' and 'comprobante' from DB as they weren't in the initial SELECT above
              // Actually they weren't selected in line 751. Let's fix that too by assuming we need to fetch them or updating the SELECT in a separate step?
              // Wait, I can't update line 751 easily here.
              // I will fetch them now.
              const detailsReq = new sql.Request(tx);
              detailsReq.input('eid', sql.Int, existingNote.id);
              const detailsRes = await detailsReq.query(`SELECT consecutivo, comprobante FROM gen_movimiento_notas WHERE id = @eid`);
              const fullExisting = detailsRes.recordset[0];

              nextConsecutivo = fullExisting.consecutivo;

              // 1. REVERSE INVENTORY (Void previous return impact)
              // Fetch old items to reverse their inventory movement
              const oldItemsReq = new sql.Request(tx);
              oldItemsReq.input('oldId', sql.Int, existingNote.id);
              const oldItemsResult = await oldItemsReq.query(`SELECT * FROM Ven_Devolucion WHERE id_nota = @oldId`);

              for (const item of oldItemsResult.recordset) {
                console.log(`↩️ Reversando inventario para item ${item.Codins} (Qty: ${item.QTYDEV})`);
                // Find product ID from Codins (best effort)
                const prodLookup = new sql.Request(tx);
                prodLookup.input('codins', sql.Char(8), item.Codins);
                const prodRes = await prodLookup.query(`SELECT id FROM inv_insumos WHERE codins = @codins`);
                const prodId = prodRes.recordset[0]?.id;

                if (prodId) {
                  // Register SALIDA to cancel the previous ENTRADA
                  await InventoryService.registrarSalida({
                    transaction: tx,
                    productoId: prodId,
                    cantidad: item.QTYDEV, // Reverse the quantity returned
                    bodega: item.Codalm,
                    numeroDocumentoInt: nextConsecutivo,
                    tipoMovimiento: 'SA', // Salida por corrección de devolución
                    observaciones: `Corrección Devolución ${fullExisting.comprobante} (Reverso)`,
                    codUsuario: usuarioFinal,
                    clienteId: clienteFinal,
                    numComprobante: nextConsecutivo
                  });
                }
              }

              // 2. CLEAR OLD DETAILS
              const deleteReq = new sql.Request(tx);
              deleteReq.input('oldId', sql.Int, existingNote.id);
              await deleteReq.query(`DELETE FROM Ven_Devolucion WHERE id_nota = @oldId`);

              // 3. UPDATE HEADER
              const updateHeaderReq = new sql.Request(tx);
              updateHeaderReq.input('id', sql.Int, existingNote.id);
              updateHeaderReq.input('fecha', sql.Date, fechaNota);
              updateHeaderReq.input('detalle', sql.VarChar(100), String(motivo).trim().substring(0, 100));
              updateHeaderReq.input('valor_nota', sql.Decimal(18, 2), Number(subtotalTotal.toFixed(2)));
              updateHeaderReq.input('iva_nota', sql.Decimal(18, 2), Number(ivaTotal.toFixed(2)));
              updateHeaderReq.input('total_nota', sql.Decimal(18, 2), Number(totalTotal.toFixed(2)));

              // Reset status to allow processing
              updateHeaderReq.input('estado', sql.Char(2), '');
              updateHeaderReq.input('estado_envio', sql.Bit, 0);

              await updateHeaderReq.query(`
                    UPDATE gen_movimiento_notas 
                    SET fecha = @fecha, detalle = @detalle, 
                        valor_nota = @valor_nota, iva_nota = @iva_nota, total_nota = @total_nota,
                        estado = @estado, estado_envio = @estado_envio, fecsys = GETDATE()
                    WHERE id = @id
                 `);

            } else {
              await tx.rollback();
              return res.status(409).json({
                success: false,
                message: `Ya existe una nota de crédito ACTIVA con el número ${numeroNota}`
              });
            }
          }
        }

        // Declare variable outside block to ensure access after commit
        let nuevaNotaId;

        // INSERT LOGIC (if not test mode)
        // Note: The original code seems to have 'if (!testMode)' wrapping this, but it was not fully visible. 
        // Based on indentation, we assume the block ending at line 927 corresponded to that.

        // Fix: Use provided number if available, otherwise calculate
        // Fix: Use provided number if available, otherwise calculate
        let comprobante;
        const codalmFinal = codalmreq || factura.codalm || '001';

        if (!isUpdate) {
          if (req.body.numero) {
            nextConsecutivo = parseInt(req.body.numero, 10);
            console.log('🔢 Usando consecutivo proporcionado (Retry):', nextConsecutivo);
          } else {
            const consecutivoRequest = new sql.Request(tx);
            // Get MAX consecutivo from gen_movimiento_notas directly to ensure continuity
            // Filtering < 100000 to avoid test numbers if any, AND excluding 51
            const maxNumResult = await consecutivoRequest.query(`
                  SELECT MAX(consecutivo) as maxNum 
                  FROM gen_movimiento_notas 
                  WHERE consecutivo < 100000 AND consecutivo <> 51
                `);

            const maxNum = maxNumResult.recordset[0]?.maxNum;
            if (maxNum) {
              nextConsecutivo = Number(maxNum) + 1;
            } else {
              nextConsecutivo = 1;
            }

            // Loop to skip existing numbers (e.g. skip 51 when we reach 50)
            let exists = true;
            while(exists) {
               const checkReq = new sql.Request(tx);
               checkReq.input('checkNum', sql.Int, nextConsecutivo);
               const checkRes = await checkReq.query('SELECT 1 FROM gen_movimiento_notas WHERE consecutivo = @checkNum');
               if(checkRes.recordset.length > 0) {
                 nextConsecutivo++;
               } else {
                 exists = false;
               }
            }

            console.log('🔢 Consecutivo generado desde gen_movimiento_notas (skip 51):', nextConsecutivo);
          }

          const year = fechaNota.getFullYear();
          const month = String(fechaNota.getMonth() + 1).padStart(2, '0');
          const paddedNum = String(nextConsecutivo).padStart(4, '0');
          // Format based on successful examples: YYYY-MM-XXXX (e.g., 2025-09-0005)
          comprobante = `${year}-${month}-${paddedNum}`;

          const insertNotaRequest = new sql.Request(tx);
          insertNotaRequest.input('id_factura', sql.BigInt, factura.id);
          insertNotaRequest.input('codalm', sql.Char(3), codalmFinal);
          insertNotaRequest.input('consecutivo', sql.Int, nextConsecutivo);
          insertNotaRequest.input('comprobante', sql.VarChar(12), comprobante);
          insertNotaRequest.input('fecha', sql.Date, fechaNota);
          insertNotaRequest.input('codter', sql.VarChar(15), clienteFinal);
          insertNotaRequest.input('tipo_nota', sql.Char(2), 'NC');
          insertNotaRequest.input('clase', sql.Int, 2);
          insertNotaRequest.input('codcon', sql.VarChar(3), '002');
          insertNotaRequest.input('detalle', sql.VarChar(100), String(motivo).trim().substring(0, 100));
          insertNotaRequest.input('valor_nota', sql.Decimal(18, 2), Number(subtotalTotal.toFixed(2)));
          insertNotaRequest.input('iva_nota', sql.Decimal(18, 2), Number(ivaTotal.toFixed(2)));
          insertNotaRequest.input('retencion_nota', sql.Decimal(18, 2), 0);
          insertNotaRequest.input('reteica_nota', sql.Decimal(18, 2), 0);
          insertNotaRequest.input('reteiva_nota', sql.Decimal(18, 2), 0);
          insertNotaRequest.input('total_nota', sql.Decimal(18, 2), Number(totalTotal.toFixed(2)));
          insertNotaRequest.input('usuario', sql.VarChar(10), usuarioFinal);
          insertNotaRequest.input('estado', sql.Char(2), '');
          insertNotaRequest.input('valor_descuento', sql.Decimal(18, 2), 0);
          insertNotaRequest.input('estado_envio', sql.Bit, 0);

          const insertNotaResult = await insertNotaRequest.query(`
              INSERT INTO gen_movimiento_notas (
                id_factura, codalm, consecutivo, comprobante, fecha, codter, 
                tipo_nota, clase, codcon, detalle, valor_nota, iva_nota, 
                retencion_nota, reteica_nota, reteiva_nota, total_nota, 
                usuario, estado, fecsys, valor_descuento, estado_envio
              )
              OUTPUT INSERTED.id
              VALUES (
                @id_factura, @codalm, @consecutivo, @comprobante, @fecha, @codter,
                @tipo_nota, @clase, @codcon, @detalle, @valor_nota, @iva_nota,
                @retencion_nota, @reteica_nota, @reteiva_nota, @total_nota,
                @usuario, @estado, GETDATE(), @valor_descuento, @estado_envio
              );
            `);

          console.log('✅ Resultado INSERT gen_movimiento_notas:', insertNotaResult);
          nuevaNotaId = insertNotaResult.recordset[0]?.id; // Assign to outer variable
          console.log('🆔 ID Nueva Nota:', nuevaNotaId);

        } else {
          // Update mode: Fetch comprobante for existing note
          const cRes = await new sql.Request(tx).query(`SELECT comprobante FROM gen_movimiento_notas WHERE id = ${nuevaNotaId}`);
          comprobante = cRes.recordset[0].comprobante;
        }

        if (!nuevaNotaId) {
          await tx.rollback();
          return res.status(500).json({
            success: false,
            message: 'No se pudo registrar la nota de crédito en gen_movimiento_notas'
          });
        }

        for (const detalle of detallesNormalizados) {
          const productoInfo = productosCache.get(detalle.productoId);
          const codins = productoInfo?.codins || String(detalle.productoId);

          let unidadMedida = 'UND';
          try {
            const undReq = new sql.Request(tx);
            undReq.input('pid', sql.Int, detalle.productoId);
            const undRes = await undReq.query('SELECT undins FROM inv_insumos WHERE id = @pid');
            if (undRes.recordset.length > 0) {
              unidadMedida = undRes.recordset[0].undins;
            }
          } catch (e) { console.warn('No se pudo obtener unidad medida', e); }

          const insertDetalleRequest = new sql.Request(tx);
          insertDetalleRequest.input('Codalm', sql.Char(3), codalmFinal);
          insertDetalleRequest.input('Numdev', sql.Int, nextConsecutivo);
          insertDetalleRequest.input('Numfac', sql.Char(8), String(factura.numeroFactura).substring(0, 8));
          insertDetalleRequest.input('Codins', sql.Char(8), String(codins).substring(0, 8));
          insertDetalleRequest.input('Costo', sql.Decimal(18, 2), 0);
          insertDetalleRequest.input('Venta', sql.Decimal(18, 0), Math.round(detalle.precioUnitario));
          insertDetalleRequest.input('Iva', sql.Decimal(18, 0), Math.round(detalle.ivaPorcentaje));
          insertDetalleRequest.input('Fecdev', sql.DateTime, fechaNota);
          insertDetalleRequest.input('comprobante', sql.VarChar(12), comprobante);
          insertDetalleRequest.input('Estreg', sql.Char(1), '');
          insertDetalleRequest.input('Codusu', sql.VarChar(10), usuarioFinal);
          insertDetalleRequest.input('PC', sql.VarChar(30), 'SISTEMA');
          insertDetalleRequest.input('QTYDEV', sql.Decimal(10, 4), detalle.cantidad);
          insertDetalleRequest.input('TIPFAC', sql.Char(2), String(factura.tipoFactura || 'FV').substring(0, 2));
          insertDetalleRequest.input('desins', sql.Decimal(8, 5), detalle.descuentoPorcentaje || 0);
          insertDetalleRequest.input('unddev', sql.VarChar(3), String(unidadMedida).substring(0, 3));
          insertDetalleRequest.input('id_nota', sql.Int, nuevaNotaId);

          try {
            await insertDetalleRequest.query(`
              INSERT INTO Ven_Devolucion (
                Codalm, Numdev, Numfac, Codins, Costo, Venta, Iva, Fecdev,
                comprobante, Estreg, Codusu, Fecsys, PC, QTYDEV, TIPFAC,
                desins, unddev, id_nota
              )
              VALUES (
                @Codalm, @Numdev, @Numfac, @Codins, @Costo, @Venta, @Iva, @Fecdev,
                @comprobante, @Estreg, @Codusu, GETDATE(), @PC, @QTYDEV, @TIPFAC,
                @desins, @unddev, @id_nota
              );
            `);
          } catch (insertErr) {
            console.error('❌ Error insertando detalle Ven_Devolucion:', {
               msg: insertErr.message,
               code: insertErr.code,
               producto: detalle.productoId,
               notaId: nuevaNotaId
            });
            throw insertErr; // Re-throw to trigger rollback
          }

          // KARDEX: Registrar Entrada (Devolución)
          await InventoryService.registrarEntrada({
            transaction: tx,
            productoId: detalle.productoId,
            cantidad: detalle.cantidad,
            bodega: codalmFinal,
            numeroDocumentoInt: nextConsecutivo, // Usamos el consecutivo interno de la nota
            tipoMovimiento: 'EN', // Entrada por devolución
            costo: 0, // Si no se tiene costo exacto de devolución, el servicio usará el último costo
            precioVenta: detalle.precioUnitario,
            observaciones: `Devolución NC ${comprobante}`,
            codUsuario: usuarioFinal,
            clienteId: clienteFinal,
            numComprobante: nextConsecutivo
          });
        }




        console.log('💾 Haciendo COMMIT de la transacción...');
        if (tx) await tx.commit();
        console.log('✅ COMMIT exitoso');

        const notaCreada = await fetchNotaCreditoById(pool, nuevaNotaId);

        try {
          console.log('🚀 Iniciando proceso de envío a DIAN para Nota de Crédito:', notaCreada.numero);
          const facturaData = await DIANService.getFacturaCompleta(notaCreada.facturaId);
          const resolution = await DIANService.getDIANCreditNoteResolution();
          const dianParams = await DIANService.getDIANParameters();

          const notaData = {
            nota: { ...notaCreada, tipo_nota: tipoNota },
            detalles: notaCreada.itemsDevueltos,
            facturaOriginal: facturaData.factura,
            cliente: facturaData.cliente
          };

          const notaJson = await DIANService.transformNotaCreditoForDIAN(notaData, resolution, dianParams);
          const dianResponse = await DIANService.sendInvoiceToDIAN(notaJson, dianParams.testSetID, dianParams.url_base);

          if (dianResponse.success) {
            const updateDianReq = new sql.Request(pool);
            updateDianReq.input('notaId', sql.Int, nuevaNotaId);
            updateDianReq.input('cufe', sql.VarChar(100), dianResponse.cufe);
            updateDianReq.input('estadoEnvio', sql.Bit, 1);
            updateDianReq.input('estado', sql.Char(2), 'OK');
            await updateDianReq.query(`UPDATE gen_movimiento_notas SET cufe = @cufe, estado_envio = @estadoEnvio, estado = @estado, fecsys = GETDATE() WHERE id = @notaId`);

            notaCreada.estadoDian = '1';
            notaCreada.cufe = dianResponse.cufe;
            notaCreada.estado = 'OK';
          } else {
            const updateDianReq = new sql.Request(pool);
            updateDianReq.input('notaId', sql.Int, nuevaNotaId);
            updateDianReq.input('estadoEnvio', sql.Bit, 0);
            updateDianReq.input('estado', sql.Char(2), 'RE');
            await updateDianReq.query(`UPDATE gen_movimiento_notas SET estado_envio = @estadoEnvio, estado = @estado, fecsys = GETDATE() WHERE id = @notaId`);
            notaCreada.estadoDian = '0';
            notaCreada.estado = 'RE';
          }
        } catch (errorDian) { console.error('❌ Error en envío a DIAN (No bloqueante):', errorDian); }

        res.json({ success: true, message: 'Nota de crédito creada exitosamente', data: notaCreada });
      } catch (innerError) {
        console.error('❌ Error interno en transacción, haciendo ROLLBACK:', innerError);
        await safeRollback();
        throw innerError;
      }
    } catch (error) {
      console.error('❌ Error general creando nota de crédito:', error);
      res.status(500).json({ success: false, message: 'Error creando nota de crédito', error: error.message });
    }
  },

  // PUT /api/notas-credito/:id
  updateCreditNote: async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};

    try {
      const notaId = parseInt(String(id).trim(), 10);
      if (Number.isNaN(notaId)) {
        return res.status(400).json({ success: false, message: 'ID de nota de crédito inválido' });
      }

      if (body.items) {
        return res.status(400).json({ success: false, message: 'La actualización de los ítems devueltos no está permitida con esta ruta' });
      }

      const requestPayload = new Map();
      const pixelPerfectCampos = [];
      if (body.motivo !== undefined) { pixelPerfectCampos.push('detalle = @motivo'); requestPayload.set('motivo', { type: sql.Text, value: String(body.motivo).trim() }); }
      if (body.estadoDian !== undefined) { pixelPerfectCampos.push('estado_envio = @estadoDian'); requestPayload.set('estadoDian', { type: sql.Bit, value: body.estadoDian === '1' || body.estadoDian === 'true' || body.estadoDian === 1 ? 1 : 0 }); }
      if (body.fechaEmision !== undefined) {
        const fecha = new Date(body.fechaEmision);
        if (Number.isNaN(fecha.getTime())) return res.status(400).json({ success: false, message: 'fechaEmision inválida' });
        pixelPerfectCampos.push('fecha = @fechaEmision');
        requestPayload.set('fechaEmision', { type: sql.Date, value: fecha });
      }
      if (body.numero !== undefined) {
        const numeroNota = String(body.numero).trim();
        if (!numeroNota) return res.status(400).json({ success: false, message: 'numero no puede estar vacío' });
        pixelPerfectCampos.push('comprobante = @numero');
        requestPayload.set('numero', { type: sql.VarChar(50), value: numeroNota });
      }

      if (pixelPerfectCampos.length === 0) {
        return res.status(400).json({ success: false, message: 'No se proporcionaron campos para actualizar' });
      }

      const pool = await getConnection();
      const tx = new sql.Transaction(pool);
      await tx.begin();

      try {
        if (requestPayload.has('numero')) {
          const numeroReq = new sql.Request(tx);
          numeroReq.input('notaId', sql.Int, notaId);
          numeroReq.input('numero', requestPayload.get('numero').value);
          const numeroResult = await numeroReq.query(`SELECT id FROM gen_movimiento_notas WHERE comprobante = @numero AND id <> @notaId`);
          if (numeroResult.recordset.length > 0) {
            await tx.rollback();
            return res.status(409).json({ success: false, message: `Ya existe otra nota de crédito con el número ${requestPayload.get('numero').value}` });
          }
        }

        const updateReq = new sql.Request(tx);
        updateReq.input('notaId', sql.Int, notaId);
        requestPayload.forEach((payload, key) => updateReq.input(key, payload.type, payload.value));

        const updateQuery = `UPDATE gen_movimiento_notas SET ${pixelPerfectCampos.join(', ')}, fecsys = GETDATE() WHERE id = @notaId`;
        const updateResult = await updateReq.query(updateQuery);

        if (updateResult.rowsAffected[0] === 0) {
          await tx.rollback();
          return res.status(404).json({ success: false, message: `Nota de crédito con ID ${notaId} no encontrada` });
        }

        await tx.commit();
        const notaActualizada = await fetchNotaCreditoById(pool, notaId);
        res.json({ success: true, data: notaActualizada });
      } catch (innerError) {
        await tx.rollback();
        throw innerError;
      }
    } catch (error) {
      console.error('❌ Error general en PUT /api/notas-credito/:id', error);
      res.status(500).json({ success: false, message: error.message || 'Error actualizando nota de crédito' });
    }
  },
  getNextCreditNoteNumber: async (req, res) => {
    try {
      const pool = await getConnection();

      const consecutivoRequest = new sql.Request(pool);
      // Modified to use MAX(Numdev) from Ven_Devolucion logic but excluding 51
      const maxNumResult = await consecutivoRequest.query(`
        SELECT MAX(consecutivo) as maxNum 
        FROM gen_movimiento_notas 
        WHERE consecutivo < 100000 AND consecutivo <> 51
      `);

      let nextConsecutivo;
      const maxNum = maxNumResult.recordset[0]?.maxNum;

      if (maxNum) {
        nextConsecutivo = Number(maxNum) + 1;
      } else {
        nextConsecutivo = 1;
      }

      // Check existence loop
      let exists = true;
      while(exists) {
          const checkReq = new sql.Request(pool);
          checkReq.input('checkNum', sql.Int, nextConsecutivo);
          const checkRes = await checkReq.query('SELECT 1 FROM gen_movimiento_notas WHERE consecutivo = @checkNum');
          if(checkRes.recordset.length > 0) {
            nextConsecutivo++;
          } else {
            exists = false;
          }
      }

      const nextNumber = String(nextConsecutivo);

      res.json({ success: true, data: { nextNumber } });
    } catch (error) {
      console.error('Error getting next credit note number:', error);
      res.status(500).json({ success: false, message: 'Error interno al obtener el consecutivo' });
    }
  },

  // POST /api/notas-credito/:id/email
  sendCreditNoteEmail: async (req, res) => {
    try {
      const { id } = req.params;
      const { destinatario, asunto, mensaje, pdfBase64 } = req.body;

      const pool = await getConnection();
      const idNum = parseInt(id, 10);

      // 1. Obtener Datos de Nota Crédito
      const notaQuery = `
        SELECT 
          n.consecutivo, 
          n.fecha, 
          n.total_nota,
          n.detalle as motivo,
          f.numfact as facturaNumero,
          c.nomter, 
          c.EMAIL 
        FROM gen_movimiento_notas n
        LEFT JOIN con_terceros c ON LTRIM(RTRIM(c.codter)) = LTRIM(RTRIM(n.codter))
        LEFT JOIN ${TABLE_NAMES.facturas} f ON f.id = n.id_factura
        WHERE n.id = @id
      `;
      const notaRes = await executeQueryWithParams(notaQuery, { id: idNum });

      if (notaRes.length === 0) {
        return res.status(404).json({ success: false, message: 'Nota de crédito no encontrada' });
      }

      const nota = notaRes[0];
      const clienteEmail = destinatario || nota.EMAIL;

      if (!clienteEmail) {
        return res.status(400).json({ success: false, message: 'El cliente no tiene email registrado.' });
      }

      // 2. Preparar PDF
      let pdfBuffer;
      if (pdfBase64) {
        pdfBuffer = pdfBase64;
      } else {
        return res.status(400).json({ success: false, message: 'Se requiere el PDF generado.' });
      }

      // 3. Preparar Detalles
      const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(val);
      const documentDetails = [
        { label: 'Total Nota', value: formatCurrency(nota.total_nota || 0) },
        { label: 'Fecha Emisión', value: new Date(nota.fecha).toLocaleDateString('es-CO') },
        { label: 'Factura Afectada', value: nota.facturaNumero || 'N/A' }
      ];

      // 4. Enviar Correo
      const { sendDocumentEmail } = require('../services/emailService.cjs');
      await sendDocumentEmail({
        to: clienteEmail,
        customerName: nota.nomter,
        documentNumber: nota.consecutivo,
        documentType: 'Nota Crédito',
        pdfBuffer,
        subject: asunto,
        body: mensaje,
        documentDetails,
        processSteps: `
            <p>Hemos generado esta Nota Crédito para aplicar el ajuste correspondiente a la factura <strong>${nota.facturaNumero || 'N/A'}</strong> debido a: <strong>${nota.motivo || 'Ajuste administrativo'}</strong>. El saldo a favor ha sido aplicado.</p>
          `
      });

      res.json({ success: true, message: 'Correo de nota de crédito enviado exitosamente' });

    } catch (error) {
      console.error('Error enviando correo de nota de crédito:', error);
      res.status(500).json({ success: false, message: 'Error enviando correo', error: error.message });
    }
  }
};

module.exports = creditNoteController;
