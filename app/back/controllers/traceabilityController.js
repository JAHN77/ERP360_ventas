const { executeQueryWithParams } = require('../services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('../services/dbConfig.cjs');
const { mapEstadoFromDb } = require('../utils/helpers');

const getTraceability = async (req, res) => {
    try {
        const { type, id } = req.query;

        if (!type || !id) {
            return res.status(400).json({ success: false, message: 'Tipo e ID son requeridos' });
        }

        let traceability = {
            cotizacion: null,
            pedido: null,
            remisiones: [],
            facturas: []
        };

        const idNum = parseInt(id, 10);

        if (type === 'pedido') {
            // 1. Obtener el Pedido
            const pedidoQuery = `
        SELECT p.*, c.numero_cotizacion as numeroCotizacionOrigen
        FROM ${TABLE_NAMES.pedidos} p
        LEFT JOIN ${TABLE_NAMES.cotizaciones} c ON c.id = p.cotizacion_id
        WHERE p.id = @id
      `;
            const pedidoResult = await executeQueryWithParams(pedidoQuery, { id: idNum });

            if (pedidoResult.length > 0) {
                const pedido = pedidoResult[0];
                traceability.pedido = {
                    id: pedido.id,
                    numero: pedido.numero_pedido,
                    fecha: pedido.fecha_pedido,
                    total: pedido.total,
                    estado: mapEstadoFromDb(pedido.estado)
                };

                // 2. Obtener Cotización si existe
                if (pedido.cotizacion_id) {
                    const cotQuery = `SELECT id, numero_cotizacion as numero, fecha_cotizacion as fecha, total, estado FROM ${TABLE_NAMES.cotizaciones} WHERE id = @cotId`;
                    const cotResult = await executeQueryWithParams(cotQuery, { cotId: pedido.cotizacion_id });
                    if (cotResult.length > 0) {
                        traceability.cotizacion = {
                            ...cotResult[0],
                            estado: mapEstadoFromDb(cotResult[0].estado)
                        };
                    }
                }

                // 3. Obtener Remisiones
                const remQuery = `SELECT id, numero_remision as numero, fecha_remision as fecha, estado, factura_id FROM ${TABLE_NAMES.remisiones} WHERE pedido_id = @id`;
                const remResult = await executeQueryWithParams(remQuery, { id: idNum });
                traceability.remisiones = remResult.map(r => ({
                    ...r,
                    estado: mapEstadoFromDb(r.estado)
                }));

                // 4. Obtener Facturas relacionadas a esas remisiones
                const facturaIds = remResult.map(r => r.factura_id).filter(fid => fid !== null);
                if (facturaIds.length > 0) {
                    const factQuery = `SELECT id, numfact as numero, fecfac as fecha, netfac as total, estfac as estado FROM ${TABLE_NAMES.facturas} WHERE id IN (${facturaIds.join(',')})`;
                    const factResult = await executeQueryWithParams(factQuery, {});
                    traceability.facturas = factResult.map(f => ({
                        ...f,
                        estado: mapEstadoFromDb(f.estado)
                    }));
                }
            }
        } else if (type === 'cotizacion') {
            // 1. Obtener la Cotización
            const cotQuery = `SELECT id, numero_cotizacion as numero, fecha_cotizacion as fecha, total, estado FROM ${TABLE_NAMES.cotizaciones} WHERE id = @id`;
            const cotResult = await executeQueryWithParams(cotQuery, { id: idNum });

            if (cotResult.length > 0) {
                const cotizacion = cotResult[0];
                traceability.cotizacion = {
                    ...cotizacion,
                    estado: mapEstadoFromDb(cotizacion.estado)
                };

                // 2. Obtener Pedido si existe
                const pedidoQuery = `SELECT id, numero_pedido as numero, fecha_pedido as fecha, total, estado FROM ${TABLE_NAMES.pedidos} WHERE cotizacion_id = @id`;
                const pedidoResult = await executeQueryWithParams(pedidoQuery, { id: idNum });

                if (pedidoResult.length > 0) {
                    const pedido = pedidoResult[0];
                    traceability.pedido = {
                        ...pedido,
                        estado: mapEstadoFromDb(pedido.estado)
                    };

                    // 3. Obtener Remisiones
                    const remQuery = `SELECT id, numero_remision as numero, fecha_remision as fecha, estado, factura_id FROM ${TABLE_NAMES.remisiones} WHERE pedido_id = @pedidoId`;
                    const remResult = await executeQueryWithParams(remQuery, { pedidoId: pedido.id });
                    traceability.remisiones = remResult.map(r => ({
                        ...r,
                        estado: mapEstadoFromDb(r.estado)
                    }));

                    // 4. Obtener Facturas relacionadas a esas remisiones
                    const facturaIds = remResult.map(r => r.factura_id).filter(fid => fid !== null);
                    if (facturaIds.length > 0) {
                        const factQuery = `SELECT id, numfact as numero, fecfac as fecha, netfac as total, estfac as estado FROM ${TABLE_NAMES.facturas} WHERE id IN (${facturaIds.join(',')})`;
                        const factResult = await executeQueryWithParams(factQuery, {});
                        traceability.facturas = factResult.map(f => ({
                            ...f,
                            estado: mapEstadoFromDb(f.estado)
                        }));
                    }
                }
            }
        }

        res.json({ success: true, data: traceability });

    } catch (error) {
        console.error('Error in traceability:', error);
        res.status(500).json({ success: false, message: 'Error obteniendo trazabilidad', error: error.message });
    }
};

module.exports = {
    getTraceability
};
