const { executeQueryWithParams } = require('../services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('../services/dbConfig.cjs');

/**
 * Obtiene KPIs globales de desempeño comercial
 */
const getCommercialPerformance = async (req, res) => {
    try {
        const { startDate, endDate, vendedorId } = req.query;

        let whereCot = "WHERE 1=1";
        let wherePed = "WHERE 1=1";
        const params = {};

        if (startDate && endDate) {
            whereCot += " AND c.fecha BETWEEN @startDate AND @endDate";
            wherePed += " AND p.fecha_pedido BETWEEN @startDate AND @endDate";
            params.startDate = startDate;
            params.endDate = endDate;
        }

        if (vendedorId) {
            whereCot += " AND c.cod_vendedor = @vendedorId";
            wherePed += " AND p.codven = @vendedorId";
            params.vendedorId = vendedorId;
        }

        // 1. Monto Total Cotizado (Calculamos total: subtotal - val_descuento + val_iva)
        const cotQuery = `SELECT SUM(subtotal - COALESCE(val_descuento, 0) + COALESCE(val_iva, 0)) as totalCotizado, COUNT(*) as countCotizaciones FROM ${TABLE_NAMES.cotizaciones} c ${whereCot}`;
        const cotResult = await executeQueryWithParams(cotQuery, params);

        // 2. Monto Total Pedidos y Conteo
        const pedQuery = `SELECT SUM(total) as totalPedidos, COUNT(*) as countPedidos FROM ${TABLE_NAMES.pedidos} p ${wherePed}`;
        const pedResult = await executeQueryWithParams(pedQuery, params);

        // 3. Ranking de Vendedores
        const rankingQuery = `
      SELECT TOP 5
        v.nomven as nombre,
        SUM(p.total) as total
      FROM ${TABLE_NAMES.pedidos} p
      LEFT JOIN ${TABLE_NAMES.vendedores} v ON v.codven = p.codven
      ${wherePed}
      GROUP BY v.nomven
      ORDER BY total DESC
    `;
        const rankingResult = await executeQueryWithParams(rankingQuery, params);

        const totalCotizado = cotResult[0]?.totalCotizado || 0;
        const countCotizaciones = cotResult[0]?.countCotizaciones || 0;
        const totalPedidos = pedResult[0]?.totalPedidos || 0;
        const countPedidos = pedResult[0]?.countPedidos || 0;

        res.json({
            success: true,
            data: {
                kpis: {
                    montoCotizado: totalCotizado,
                    montoPedidos: totalPedidos,
                    hitRate: countCotizaciones > 0 ? (countPedidos / countCotizaciones) * 100 : 0,
                    countCotizaciones,
                    countPedidos
                },
                rankingVendedores: rankingResult
            }
        });
    } catch (error) {
        console.error('Error in getCommercialPerformance:', error);
        res.status(500).json({ success: false, message: 'Error obteniendo desempeño comercial', error: error.message });
    }
};

/**
 * Analiza la "fuga de venta" comparando ítems cotizados vs pedidos
 */
const getSalesLeakage = async (req, res) => {
    try {
        const { startDate, endDate, vendedorId } = req.query;
        const params = {};
        let where = "WHERE p.cotizacion_id IS NOT NULL";

        if (startDate && endDate) {
            where += " AND p.fecha_pedido BETWEEN @startDate AND @endDate";
            params.startDate = startDate;
            params.endDate = endDate;
        }

        if (vendedorId) {
            where += " AND p.codven = @vendedorId";
            params.vendedorId = vendedorId;
        }

        const query = `
      SELECT 
        p.numero_pedido as pedido,
        c.numcot as cotizacion,
        dc.cod_producto as producto,
        i.nomins as nombreProducto,
        dc.cantidad as cantCotizada,
        dp.canped as cantPedida,
        (dc.cantidad - dp.canped) as diferencia,
        dc.preciound as precioCotizado,
        dp.valins as precioPedido
      FROM ${TABLE_NAMES.pedidos} p
      INNER JOIN ${TABLE_NAMES.cotizaciones} c ON c.id = p.cotizacion_id
      INNER JOIN ${TABLE_NAMES.cotizaciones_detalle} dc ON dc.id_cotizacion = c.id
      INNER JOIN ${TABLE_NAMES.pedidos_detalle} dp ON dp.pedido_id = p.id AND dp.codins = dc.cod_producto
      LEFT JOIN inv_insumos i ON i.codins = dc.cod_producto
      ${where}
      AND (dc.cantidad <> dp.canped OR dc.preciound <> dp.valins)
    `;

        const result = await executeQueryWithParams(query, params);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error in getSalesLeakage:', error);
        res.status(500).json({ success: false, message: 'Error analizando fuga de venta', error: error.message });
    }
};

/**
 * Calcula la eficiencia logística (Lead Time)
 */
const getLogisticsEfficiency = async (req, res) => {
    try {
        const { startDate, endDate, vendedorId } = req.query;
        const params = {};
        let where = "WHERE r.pedido_id IS NOT NULL";

        if (startDate && endDate) {
            where += " AND r.fecha_remision BETWEEN @startDate AND @endDate";
            params.startDate = startDate;
            params.endDate = endDate;
        }

        if (vendedorId) {
            where += " AND p.codven = @vendedorId";
            params.vendedorId = vendedorId;
        }

        const query = `
      SELECT 
        p.numero_pedido as pedido,
        r.numero_remision as remision,
        p.fecha_pedido,
        r.fecha_remision,
        DATEDIFF(HOUR, p.fecha_pedido, r.fecha_remision) as leadTimeHoras
      FROM ${TABLE_NAMES.remisiones} r
      INNER JOIN ${TABLE_NAMES.pedidos} p ON p.id = r.pedido_id
      ${where}
    `;

        const result = await executeQueryWithParams(query, params);

        const avgLeadTime = result.length > 0
            ? result.reduce((acc, curr) => acc + curr.leadTimeHoras, 0) / result.length
            : 0;

        res.json({
            success: true,
            data: {
                avgLeadTimeHoras: avgLeadTime,
                details: result
            }
        });
    } catch (error) {
        console.error('Error in getLogisticsEfficiency:', error);
        res.status(500).json({ success: false, message: 'Error calculando eficiencia logística', error: error.message });
    }
};

/**
 * Obtiene el estatus del ciclo financiero (Facturación vs Pedidos)
 */
const getFinancialCycle = async (req, res) => {
    try {
        const { startDate, endDate, vendedorId } = req.query;
        const params = {};
        let where = "WHERE 1=1";

        if (startDate && endDate) {
            where += " AND p.fecha_pedido BETWEEN @startDate AND @endDate";
            params.startDate = startDate;
            params.endDate = endDate;
        }

        if (vendedorId) {
            where += " AND p.codven = @vendedorId";
            params.vendedorId = vendedorId;
        }

        // Usamos una CTE para filtrar los pedidos base y luego calcular métricas precisas
        const query = `
      WITH PedidosBase AS (
        SELECT id, total 
        FROM ${TABLE_NAMES.pedidos} p
        ${where}
      )
      SELECT 
        (SELECT COUNT(*) FROM PedidosBase) as totalPedidos,
        (SELECT SUM(total) FROM PedidosBase) as montoTotal,
        (SELECT COUNT(DISTINCT r.factura_id) 
         FROM ${TABLE_NAMES.remisiones} r 
         WHERE r.pedido_id IN (SELECT id FROM PedidosBase) AND r.factura_id IS NOT NULL) as pedidosFacturados,
        (SELECT SUM(f.netfac) 
         FROM ${TABLE_NAMES.remisiones} r 
         JOIN ${TABLE_NAMES.facturas} f ON f.id = r.factura_id
         WHERE r.pedido_id IN (SELECT id FROM PedidosBase)) as montoFacturado
    `;

        const result = await executeQueryWithParams(query, params);
        res.json({ success: true, data: result[0] });
    } catch (error) {
        console.error('Error in getFinancialCycle:', error);
        res.status(500).json({ success: false, message: 'Error obteniendo ciclo financiero', error: error.message });
    }
};

module.exports = {
    getCommercialPerformance,
    getSalesLeakage,
    getLogisticsEfficiency,
    getFinancialCycle
};
