const sql = require('mssql');
const { getConnection } = require('../services/sqlServerClient.cjs');

/**
 * Obtiene productos para conteo físico con filtros
 * @route GET /api/inventario-fisico/productos
 * @query {string} codalm - Código de almacén (requerido)
 * @query {string} linea - Código de línea (opcional)
 * @query {string} filtro - 'todos' | 'con_stock' | 'sin_stock' | 'con_diferencias' (opcional)
 * @query {number} idconteo - ID del conteo para filtrar por diferencias (opcional)
 */
const getProductosParaConteo = async (req, res) => {
    try {
        const { codalm, linea, filtro = 'todos', idconteo } = req.query;

        // codalm es requerido solo si NO se proporciona idconteo
        if (!codalm && !idconteo) {
            return res.status(400).json({
                success: false,
                message: 'El código de almacén o el ID de conteo es requerido'
            });
        }

        // DEBUG LOGS
        console.log('--- GET /productos - Debug Info ---');
        console.log('Query Params:', { codalm, linea, filtro, idconteo });

        const pool = await getConnection();
        const request = pool.request();
        let query;

        // Si se filtra por diferencias con idconteo, usar query específica
        if (filtro === 'con_diferencias' && idconteo) {
            query = `
                SELECT 
                    f.codalm,
                    f.codins,
                    ins.nomins as nombreProducto,
                    ins.codigo_linea as linea,
                    lin.nomline as nombreLinea,
                    ins.Codigo_Medida as codigoMedida,
                    med.codmed as unidadMedida,
                    ISNULL(f.caninv, 0) as caninv,
                    ISNULL(f.valcosto, 0) as valcosto,
                    ISNULL(f.canfis, 0) as canfis,
                    ISNULL(f.diferencia, 0) as diferencia,
                    f.id as conteoId
                FROM inv_invfisico f
                INNER JOIN inv_insumos ins ON f.codins = ins.codins
                LEFT JOIN inv_lineas lin ON ins.codigo_linea = lin.codline
                LEFT JOIN inv_medidas med ON ins.Codigo_Medida = med.codmed
                WHERE f.idconteo = @idconteo
            `;
            request.input('idconteo', sql.Int, parseInt(idconteo));
            
            // Opcionalmente filtrar por codalm si se proporciona
            if (codalm) {
                query = query.replace('WHERE f.idconteo = @idconteo', 'WHERE f.idconteo = @idconteo AND f.codalm = @codalm');
                request.input('codalm', sql.Char(3), codalm);
            }
        } else {
            // Query base para productos del inventario actual
            query = `
                SELECT 
                    i.codalm,
                    i.codins,
                    ins.nomins as nombreProducto,
                    ins.codigo_linea as linea,
                    lin.nomline as nombreLinea,
                    ins.Codigo_Medida as codigoMedida,
                    med.codmed as unidadMedida,
                    ISNULL(i.ucoins, 0) as caninv,
                    ISNULL(ins.ultimo_costo, 0) as valcosto,
                    0 as canfis,
                    0 as diferencia
                FROM inv_invent i
                INNER JOIN inv_insumos ins ON i.codins = ins.codins
                LEFT JOIN inv_lineas lin ON ins.codigo_linea = lin.codline
                LEFT JOIN inv_medidas med ON ins.Codigo_Medida = med.codmed
                WHERE i.codalm = @codalm
            `;
            request.input('codalm', sql.Char(3), codalm);

            // Filtro por línea
            if (linea && linea !== 'TODAS') {
                query += ` AND ins.codigo_linea = @linea`;
                request.input('linea', sql.Char(2), linea);
            }

            // Filtros de stock
            if (filtro === 'con_stock') {
                query += ` AND i.ucoins > 0`;
            } else if (filtro === 'sin_stock') {
                query += ` AND (i.ucoins = 0 OR i.ucoins IS NULL)`;
            }
        }

        query += ` ORDER BY ins.nomins`;

        const result = await request.query(query);
        
        console.log(`Found ${result.recordset.length} records for codalm: '${codalm}'`);
        console.log('-----------------------------------');

        res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        console.error('Error al obtener productos para conteo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener productos para conteo',
            error: error.message
        });
    }
};

/**
 * Obtiene lista de conteos físicos registrados
 * @route GET /api/inventario-fisico/conteos
 * @query {string} codalm - Código de almacén (opcional)
 */
const getConteos = async (req, res) => {
    try {
        console.log('🔵 [getConteos] Iniciando...');
        const { codalm } = req.query;
        console.log('🔵 [getConteos] codalm recibido:', codalm);
        
        const pool = await getConnection();
        console.log('🔵 [getConteos] Conexión obtenida');

        let query = `
            SELECT 
                idconteo,
                codalm,
                MIN(Fecha) as fecha,
                MIN(fecsys) as fecsys,
                COUNT(*) as totalProductos,
                SUM(CASE WHEN diferencia != 0 THEN 1 ELSE 0 END) as totalDiferencias,
                SUM(ABS(diferencia * valcosto)) as valorTotal,
                MIN(codusu) as usuario
            FROM inv_invfisico
        `;

        const request = pool.request();

        if (codalm) {
            query += ` WHERE codalm = @codalm`;
            request.input('codalm', sql.Char(3), codalm);
            console.log('🔵 [getConteos] Filtro aplicado para codalm:', codalm);
        } else {
            console.log('🔵 [getConteos] Sin filtro de almacén');
        }

        query += ` GROUP BY idconteo, codalm ORDER BY idconteo DESC`;
        console.log('🔵 [getConteos] Query construido:', query);

        const result = await request.query(query);
        console.log('🔵 [getConteos] Resultados obtenidos:', result.recordset.length, 'registros');
        console.log('🔵 [getConteos] Datos:', JSON.stringify(result.recordset, null, 2));

        res.json({
            success: true,
            data: result.recordset
        });
        console.log('🔵 [getConteos] Respuesta enviada exitosamente');

    } catch (error) {
        console.error('❌ [getConteos] Error al obtener conteos:', error);
        console.error('❌ [getConteos] Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Error al obtener conteos',
            error: error.message
        });
    }
};

/**
 * Crea un nuevo conteo físico
 * @route POST /api/inventario-fisico/conteo
 * @body {number} idconteo - Número de toma
 * @body {string} codalm - Código de almacén
 * @body {string} fecha - Fecha del conteo
 * @body {string} usuario - Usuario que realiza el conteo
 * @body {Array} productos - Array de productos con cantidades físicas
 */
const createConteo = async (req, res) => {
    try {
        const { idconteo, codalm, fecha, usuario, productos } = req.body;

        if (!idconteo || !codalm || !productos || productos.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Datos incompletos para crear el conteo'
            });
        }

        const pool = await getConnection();
        const fechaObj = new Date(fecha);
        const mes = fechaObj.getMonth() + 1;
        const año = fechaObj.getFullYear();

        // Insertar cada producto en inv_invfisico
        for (const producto of productos) {
            const request = pool.request();
            
            const diferencia = (producto.canfis || 0) - (producto.caninv || 0);

            await request
                .input('idconteo', sql.Int, idconteo)
                .input('codalm', sql.Char(3), codalm)
                .input('codins', sql.Char(8), producto.codins)
                .input('caninv', sql.Numeric(11, 2), producto.caninv || 0)
                .input('canfis', sql.Numeric(11, 2), producto.canfis || 0)
                .input('diferencia', sql.Numeric(11, 2), diferencia)
                .input('valcosto', sql.Numeric(13, 2), producto.valcosto || 0)
                .input('valunit', sql.Numeric(13, 2), producto.valcosto || 0)
                .input('fecha', sql.Date, fecha)
                .input('fecsys', sql.DateTime, new Date())
                .input('mes', sql.Int, mes)
                .input('año', sql.Int, año)
                .input('codusu', sql.NVarChar(20), usuario || 'SYSTEM')
                .query(`
                    INSERT INTO inv_invfisico 
                    (idconteo, codalm, codins, caninv, canfis, diferencia, valcosto, valunit, Fecha, fecsys, mes, año, codusu)
                    VALUES 
                    (@idconteo, @codalm, @codins, @caninv, @canfis, @diferencia, @valcosto, @valunit, @fecha, @fecsys, @mes, @año, @codusu)
                `);
        }

        res.json({
            success: true,
            message: 'Conteo físico creado exitosamente',
            data: { idconteo, totalProductos: productos.length }
        });

    } catch (error) {
        console.error('Error al crear conteo físico:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear conteo físico',
            error: error.message
        });
    }
};

/**
 * Actualiza la cantidad física de un producto en el conteo
 * @route PUT /api/inventario-fisico/conteo/:id
 * @param {number} id - ID del registro en inv_invfisico
 * @body {number} canfis - Nueva cantidad física
 */
const updateConteoFisico = async (req, res) => {
    try {
        const { id } = req.params;
        const { canfis } = req.body;

        if (!id || canfis === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Datos incompletos para actualizar el conteo'
            });
        }

        const pool = await getConnection();
        
        // Actualizar cantidad física y recalcular diferencia
        await pool.request()
            .input('id', sql.Int, parseInt(id))
            .input('canfis', sql.Numeric(11, 2), canfis)
            .query(`
                UPDATE inv_invfisico 
                SET canfis = @canfis,
                    diferencia = @canfis - caninv
                WHERE id = @id
            `);

        res.json({
            success: true,
            message: 'Cantidad física actualizada exitosamente'
        });

    } catch (error) {
        console.error('Error al actualizar conteo físico:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar conteo físico',
            error: error.message
        });
    }
};

/**
 * Aplica los ajustes del conteo físico al inventario
 * @route POST /api/inventario-fisico/aplicar/:idconteo
 * @param {number} idconteo - ID del conteo a aplicar
 */
const aplicarConteo = async (req, res) => {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);
    
    try {
        const { idconteo } = req.params;

        if (!idconteo) {
            return res.status(400).json({
                success: false,
                message: 'ID de conteo requerido'
            });
        }

        await transaction.begin();

        // Obtener todos los productos del conteo
        const requestSelect = new sql.Request(transaction);
        const conteoResult = await requestSelect
            .input('idconteo', sql.Int, parseInt(idconteo))
            .query(`
                SELECT * FROM inv_invfisico 
                WHERE idconteo = @idconteo
            `);

        const productos = conteoResult.recordset;

        // Actualizar inv_invent con las cantidades físicas
        for (const producto of productos) {
            if (producto.diferencia !== 0) {
                const requestUpdate = new sql.Request(transaction);
                
                // Actualizar cantidad en inv_invent
                await requestUpdate
                    .input('codalm', sql.Char(3), producto.codalm)
                    .input('codins', sql.Char(8), producto.codins)
                    .input('canfis', sql.Numeric(18, 2), producto.canfis)
                    .query(`
                        UPDATE inv_invent 
                        SET ucoins = @canfis
                        WHERE codalm = @codalm AND codins = @codins
                    `);

                // Registrar movimiento en kardex (inv_kardex)
                const requestKardex = new sql.Request(transaction);
                const tipoMovimiento = producto.diferencia > 0 ? 'EN' : 'SA'; // EN = Entrada, SA = Salida
                const cantidadMovimiento = Math.abs(producto.diferencia);
                
                await requestKardex
                    .input('codins', sql.Char(8), producto.codins)
                    .input('codalm', sql.Char(3), producto.codalm)
                    .input('cankar', sql.Decimal(18, 6), cantidadMovimiento)
                    .input('tipkar', sql.Char(2), tipoMovimiento)
                    .input('coskar', sql.Decimal(18, 2), producto.valcosto)
                    .input('venkar', sql.Decimal(18, 2), 0) // 0 para ajustes
                    .input('feckar', sql.DateTime, new Date())
                    .input('observa', sql.VarChar(100), `Ajuste conteo físico #${idconteo}`)
                    .input('dockar', sql.Int, parseInt(idconteo))
                    .input('codusu', sql.VarChar(12), producto.codusu || 'SISTEMA')
                    .query(`
                        INSERT INTO inv_kardex 
                        (codalm, codins, feckar, tipkar, dockar, cankar, coskar, venkar, codusu, observa, fecsys, FECREM)
                        VALUES 
                        (@codalm, @codins, @feckar, @tipkar, @dockar, @cankar, @coskar, @venkar, @codusu, @observa, GETDATE(), GETDATE())
                    `);
            }
        }

        await transaction.commit();

        res.json({
            success: true,
            message: 'Conteo aplicado exitosamente',
            data: {
                idconteo: parseInt(idconteo),
                productosActualizados: productos.filter(p => p.diferencia !== 0).length
            }
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error al aplicar conteo físico:', error);
        res.status(500).json({
            success: false,
            message: 'Error al aplicar conteo físico',
            error: error.message
        });
    }
};

/**
 * Obtiene el siguiente número de conteo disponible
 * @route GET /api/inventario-fisico/siguiente-numero
 */
const getSiguienteNumeroConteo = async (req, res) => {
    try {
        const pool = await getConnection();
        
        const result = await pool.request().query(`
            SELECT ISNULL(MAX(idconteo), 0) + 1 as siguienteNumero
            FROM inv_invfisico
        `);

        res.json({
            success: true,
            data: result.recordset[0].siguienteNumero
        });

    } catch (error) {
        console.error('Error al obtener siguiente número de conteo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener siguiente número de conteo',
            error: error.message
        });
    }
};

module.exports = {
    getProductosParaConteo,
    getConteos,
    createConteo,
    updateConteoFisico,
    aplicarConteo,
    getSiguienteNumeroConteo
};
