const sql = require('mssql');
const { executeQueryWithParams } = require('../services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('../services/dbConfig.cjs');
const { mapEstadoFromDb } = require('../utils/helpers');

const analyticsController = {
    // GET /api/analytics/general
    getGeneralStats: async (req, res) => {
        try {
            const {
                startDate,
                endDate,
                vendedorId,
                clienteId,
                productoId,
                period = 'month' // 'year', 'month', 'week'
            } = req.query;

            // 1. Construir filtros base
            let whereClauses = {
                cotizaciones: [],
                pedidos: [],
                remisiones: [],
                facturas: []
            };

            const params = {};

            // Filtro de Fechas
            if (startDate && endDate) {
                params.startDate = new Date(startDate);
                params.endDate = new Date(endDate);

                whereClauses.cotizaciones.push('c.fecha BETWEEN @startDate AND @endDate');
                whereClauses.pedidos.push('p.fecha_pedido BETWEEN @startDate AND @endDate');
                whereClauses.remisiones.push('r.fecha_remision BETWEEN @startDate AND @endDate');
                whereClauses.facturas.push('f.fecfac BETWEEN @startDate AND @endDate');
            }

            // Filtro de Vendedor
            if (vendedorId) {
                params.vendedorId = vendedorId;
                // Asumiendo que vendedorId es el código (codven) o ID. Ajustar según esquema real.
                // En controllers anteriores vimos que se usa codven o ideven.
                // Usaremos LIKE para ser flexibles o exacto si es ID.
                whereClauses.cotizaciones.push('(c.cod_vendedor = @vendedorId OR c.cod_usuario = @vendedorId)');
                whereClauses.pedidos.push('p.codven = @vendedorId');
                whereClauses.remisiones.push('r.codven = @vendedorId');
                whereClauses.facturas.push('f.codven = @vendedorId');
            }

            // Filtro de Cliente
            if (clienteId) {
                params.clienteId = clienteId;
                whereClauses.cotizaciones.push('c.codter = @clienteId');
                whereClauses.pedidos.push('p.codter = @clienteId');
                whereClauses.remisiones.push('r.codter = @clienteId');
                whereClauses.facturas.push('f.codter = @clienteId');
            }

            // Filtro de Producto (Más complejo, requiere JOINs con detalles)
            // Si se selecciona un producto, filtramos los encabezados que tengan ese producto en sus detalles
            let productJoin = {
                cotizaciones: '',
                pedidos: '',
                remisiones: '',
                facturas: ''
            };

            if (productoId) {
                params.productoId = productoId; // ID numérico de inv_insumos

                // Necesitamos obtener el codins primero para filtrar en tablas de detalle que usan codins
                const prodQuery = `SELECT codins FROM ${TABLE_NAMES.productos} WHERE id = @productoId`;
                const prodRes = await executeQueryWithParams(prodQuery, { productoId }, req.db_name);

                if (prodRes.length > 0) {
                    const codins = prodRes[0].codins;
                    params.codins = codins;

                    productJoin.cotizaciones = `INNER JOIN ${TABLE_NAMES.cotizaciones_detalle} cd ON cd.numcot = c.numcot AND cd.cod_producto = @codins`; // Ojo: numcot vs id
                    // Revisando dbConfig: ven_detacotiz usa numcot (string) que enlaza con ven_cotizacion.numcot

                    productJoin.pedidos = `INNER JOIN ${TABLE_NAMES.pedidos_detalle} pd ON pd.pedido_id = p.id AND pd.codins = @codins`;

                    productJoin.remisiones = `INNER JOIN ${TABLE_NAMES.remisiones_detalle} rd ON rd.remision_id = r.id AND rd.codins = @codins`;

                    productJoin.facturas = `INNER JOIN ${TABLE_NAMES.facturas_detalle} fd ON fd.id_factura = f.ID AND fd.codins = @codins`;
                }
            }

            // Helper para construir WHERE string
            const buildWhere = (clauses) => clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

            // 2. Consultas de Agregación
            // Necesitamos agrupar por periodo para las gráficas

            let dateFormat = '';
            if (period === 'year') dateFormat = "FORMAT(fecha, 'yyyy')";
            else if (period === 'week') dateFormat = "FORMAT(fecha, 'yyyy-MM-dd')"; // Simplificación, idealmente semana ISO
            else dateFormat = "FORMAT(fecha, 'yyyy-MM')"; // Default month

            // Query Cotizaciones
            const qCotizaciones = `
        SELECT 
          'Cotizaciones' as type,
          COUNT(*) as count,
          SUM(COALESCE(c.subtotal, 0) - COALESCE(c.val_descuento, 0) + COALESCE(c.val_iva, 0)) as totalValue,
          ${dateFormat.replace('fecha', 'c.fecha')} as period
        FROM ${TABLE_NAMES.cotizaciones} c
        ${productJoin.cotizaciones}
        ${buildWhere(whereClauses.cotizaciones)}
        GROUP BY ${dateFormat.replace('fecha', 'c.fecha')}
      `;

            // Query Pedidos
            const qPedidos = `
        SELECT 
          'Pedidos' as type,
          COUNT(*) as count,
          SUM(COALESCE(p.total, 0)) as totalValue,
          ${dateFormat.replace('fecha', 'p.fecha_pedido')} as period
        FROM ${TABLE_NAMES.pedidos} p
        ${productJoin.pedidos}
        ${buildWhere(whereClauses.pedidos)}
        GROUP BY ${dateFormat.replace('fecha', 'p.fecha_pedido')}
      `;

            // Query Remisiones
            // Remisiones no tienen total en encabezado siempre, a veces hay que calcularlo.
            // Usaremos una aproximación o subquery si es lento.
            // En dbConfig vimos que se calcula sumando detalles. Para analytics rápido, esto puede ser pesado.
            // Intentemos sumar detalles si no hay total.
            const qRemisiones = `
        SELECT 
          'Remisiones' as type,
          COUNT(DISTINCT r.id) as count,
          SUM(COALESCE(rem_totals.total, 0)) as totalValue,
          ${dateFormat.replace('fecha', 'r.fecha_remision')} as period
        FROM ${TABLE_NAMES.remisiones} r
        LEFT JOIN (
            SELECT remision_id, SUM(rd.cantidad_enviada * p.ultimo_costo) as total
            FROM ${TABLE_NAMES.remisiones_detalle} rd
            LEFT JOIN ${TABLE_NAMES.productos} p ON p.codins = rd.codins
            GROUP BY remision_id
        ) rem_totals ON rem_totals.remision_id = r.id
        ${productJoin.remisiones}
        ${buildWhere(whereClauses.remisiones)}
        GROUP BY ${dateFormat.replace('fecha', 'r.fecha_remision')}
      `;

            // Query Facturas
            const qFacturas = `
        SELECT 
          'Facturas' as type,
          COUNT(*) as count,
          SUM(COALESCE(f.netfac, 0)) as totalValue,
          ${dateFormat.replace('fecha', 'f.fecfac')} as period
        FROM ${TABLE_NAMES.facturas} f
        ${productJoin.facturas}
        ${buildWhere(whereClauses.facturas)}
        GROUP BY ${dateFormat.replace('fecha', 'f.fecfac')}
      `;

            // Ejecutar en paralelo
            const [resCot, resPed, resRem, resFac] = await Promise.all([
                executeQueryWithParams(qCotizaciones, params, req.db_name),
                executeQueryWithParams(qPedidos, params, req.db_name),
                executeQueryWithParams(qRemisiones, params, req.db_name),
                executeQueryWithParams(qFacturas, params, req.db_name)
            ]);

            // Unificar datos
            const allData = [...resCot, ...resPed, ...resRem, ...resFac];

            // Totales Generales
            const totals = {
                cotizaciones: { count: 0, value: 0 },
                pedidos: { count: 0, value: 0 },
                remisiones: { count: 0, value: 0 },
                facturas: { count: 0, value: 0 }
            };

            allData.forEach(d => {
                const key = d.type.toLowerCase();
                if (totals[key]) {
                    totals[key].count += d.count;
                    totals[key].value += d.totalValue || 0;
                }
            });

            res.json({
                success: true,
                data: {
                    timeline: allData,
                    totals
                }
            });

        } catch (error) {
            console.error('Error in getGeneralStats:', error);
            res.status(500).json({ success: false, message: 'Error obteniendo estadísticas', error: error.message });
        }
    },

    // GET /api/analytics/timeline/:orderId
    getOrderTimeline: async (req, res) => {
        try {
            const { orderId } = req.params;
            const { orderNumber } = req.query; // Opcional, buscar por número

            let pedido = null;
            const params = {};

            // 1. Buscar el Pedido
            let queryPedido = `
        SELECT 
          p.id, p.numero_pedido, p.fecha_pedido, p.estado, p.total,
          p.cotizacion_id, p.codter, p.codven
        FROM ${TABLE_NAMES.pedidos} p
      `;

            if (orderId) {
                queryPedido += ` WHERE p.id = @orderId`;
                params.orderId = orderId;
            } else if (orderNumber) {
                queryPedido += ` WHERE p.numero_pedido = @orderNumber`;
                params.orderNumber = orderNumber;
            } else {
                return res.status(400).json({ success: false, message: 'Se requiere orderId o orderNumber' });
            }

            const resPedido = await executeQueryWithParams(queryPedido, params, req.db_name);

            if (resPedido.length === 0) {
                return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
            }
            pedido = resPedido[0];

            const timeline = [];

            // Agregar evento Pedido
            timeline.push({
                type: 'PEDIDO',
                id: pedido.id,
                number: pedido.numero_pedido,
                date: pedido.fecha_pedido,
                status: mapEstadoFromDb(pedido.estado),
                amount: pedido.total,
                details: 'Pedido creado'
            });

            // 2. Buscar Cotización vinculada
            if (pedido.cotizacion_id) {
                const qCot = `SELECT id, numcot, fecha, estado, subtotal, val_iva, val_descuento FROM ${TABLE_NAMES.cotizaciones} WHERE id = @cotId`;
                const resCot = await executeQueryWithParams(qCot, { cotId: pedido.cotizacion_id }, req.db_name);
                if (resCot.length > 0) {
                    const cot = resCot[0];
                    const totalCot = (cot.subtotal || 0) + (cot.val_iva || 0) - (cot.val_descuento || 0);
                    timeline.push({
                        type: 'COTIZACION',
                        id: cot.id,
                        number: cot.numcot,
                        date: cot.fecha,
                        status: cot.estado, // Cotizaciones usan estado texto a veces o char? Revisar helpers.
                        amount: totalCot,
                        details: 'Cotización origen'
                    });
                }
            }

            // 3. Buscar Remisiones vinculadas
            const qRem = `SELECT id, numero_remision, fecha_remision, estado, factura_id FROM ${TABLE_NAMES.remisiones} WHERE pedido_id = @pedId`;
            const resRem = await executeQueryWithParams(qRem, { pedId: pedido.id }, req.db_name);

            const facturaIds = new Set();

            resRem.forEach(rem => {
                timeline.push({
                    type: 'REMISION',
                    id: rem.id,
                    number: rem.numero_remision,
                    date: rem.fecha_remision,
                    status: mapEstadoFromDb(rem.estado),
                    amount: 0, // Remisiones valor es calculado, opcional mostrarlo
                    details: 'Remisión generada'
                });
                if (rem.factura_id) facturaIds.add(rem.factura_id);
            });

            // 4. Buscar Facturas vinculadas (via Remisiones o directas si hubiera enlace en pedido?)
            // Por ahora via remisiones.
            if (facturaIds.size > 0) {
                const ids = Array.from(facturaIds).join(',');
                const qFac = `SELECT ID, numfact, fecfac, estfac, netfac, CUFE FROM ${TABLE_NAMES.facturas} WHERE ID IN (${ids})`;
                const resFac = await executeQueryWithParams(qFac, {}, req.db_name); // Params not supported with IN clause easily in this helper unless loop.
                // Or use dynamic SQL carefully. Since ids are ints from DB, it's safe-ish.

                resFac.forEach(fac => {
                    timeline.push({
                        type: 'FACTURA',
                        id: fac.ID,
                        number: fac.numfact,
                        date: fac.fecfac,
                        status: mapEstadoFromDb(fac.estfac),
                        amount: fac.netfac,
                        details: fac.CUFE ? 'Factura Electrónica' : 'Factura Local'
                    });
                });
            }

            // Ordenar cronológicamente
            timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

            res.json({
                success: true,
                data: timeline
            });

        } catch (error) {
            console.error('Error in getOrderTimeline:', error);
            res.status(500).json({ success: false, message: 'Error obteniendo línea de tiempo', error: error.message });
        }
    },

    // GET /api/analytics/order-items-comparison/:orderId
    getOrderItemsComparison: async (req, res) => {
        try {
            const { orderId } = req.params;

            // 1. Obtener información básica del pedido para saber cotización vinculada
            const qPedido = `SELECT id, cotizacion_id FROM ${TABLE_NAMES.pedidos} WHERE id = @orderId`;
            const resPedido = await executeQueryWithParams(qPedido, { orderId }, req.db_name);

            if (resPedido.length === 0) {
                return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
            }
            const pedido = resPedido[0];

            // 2. Construir query de comparación
            // La estrategia es:
            // - Base: Items del Pedido (pivote principal)
            // - Left Join con Cotización (si existe) por codins
            // - Left Join con Remisiones (agrupadas) por codins
            // - Left Join con Facturas (agrupadas via remisiones) por codins

            const params = { orderId };
            let qComparison = `
                SELECT 
                    p.codins,
                    p.descripcion as productName,
                    p.cantidad as qtyOrder,
                    COALESCE(c.cantidad, 0) as qtyQuote,
                    COALESCE(r.qtyRemitted, 0) as qtyRemitted,
                    COALESCE(f.qtyInvoiced, 0) as qtyInvoiced
                FROM ${TABLE_NAMES.pedidos_detalle} p
            `;

            // Join Cotización
            if (pedido.cotizacion_id) {
                qComparison += `
                    LEFT JOIN ${TABLE_NAMES.cotizaciones_detalle} c 
                    ON c.numcot = (SELECT numcot FROM ${TABLE_NAMES.cotizaciones} WHERE id = @cotId) 
                    AND c.cod_producto = p.codins
                `;
                params.cotId = pedido.cotizacion_id;
            } else {
                // Dummy join si no hay cotización
                qComparison += `
                    LEFT JOIN (SELECT NULL as cod_producto, 0 as cantidad) c ON 1=0
                `;
            }

            // Join Remisiones (Agrupadas)
            // Las remisiones están linkeadas al pedido por pedido_id
            qComparison += `
                LEFT JOIN (
                    SELECT rd.codins, SUM(rd.cantidad_enviada) as qtyRemitted
                    FROM ${TABLE_NAMES.remisiones_detalle} rd
                    INNER JOIN ${TABLE_NAMES.remisiones} r ON r.id = rd.remision_id
                    WHERE r.pedido_id = @orderId AND r.estado != 'ANULADA'
                    GROUP BY rd.codins
                ) r ON r.codins = p.codins
            `;

            // Join Facturas (Agrupadas)
            // Las facturas se linkean a remisiones. 
            // Necesitamos llegar de Pedido -> Remision -> Factura
            qComparison += `
                LEFT JOIN (
                    SELECT fd.codins, SUM(fd.cantidad) as qtyInvoiced
                    FROM ${TABLE_NAMES.facturas_detalle} fd
                    INNER JOIN ${TABLE_NAMES.facturas} f ON f.ID = fd.id_factura
                    INNER JOIN ${TABLE_NAMES.remisiones} rem ON rem.factura_id = f.ID
                    WHERE rem.pedido_id = @orderId AND f.estfac != 'ANULADA'
                    GROUP BY fd.codins
                ) f ON f.codins = p.codins
            `;

            qComparison += ` WHERE p.pedido_id = @orderId`;

            const comparisonData = await executeQueryWithParams(qComparison, params, req.db_name);

            res.json({
                success: true,
                data: comparisonData
            });

        } catch (error) {
            console.error('Error in getOrderItemsComparison:', error);
            res.status(500).json({ success: false, message: 'Error obteniendo comparación de items', error: error.message });
        }
    }
};

module.exports = analyticsController;
