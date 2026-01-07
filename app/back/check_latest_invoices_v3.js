const { getConnectionForDb } = require('./services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('./services/dbConfig.cjs');

async function checkData() {
    try {
        const pool = await getConnectionForDb('orquidea');

        console.log('--- ULTIMA FACTURA (DETALLADA) ---');
        const facturas = await pool.request().query(`
            SELECT TOP 1 * 
            FROM ${TABLE_NAMES.facturas}
            ORDER BY ID DESC
        `);
        console.log(JSON.stringify(facturas.recordset[0], null, 2));

        if (facturas.recordset.length > 0) {
            const lastId = facturas.recordset[0].ID;
            const lastNum = facturas.recordset[0].numfact;

            console.log(`\n--- DETALLES PARA FACTURA ID: ${lastId} (numfact: ${lastNum}) ---`);
            const detalles = await pool.request()
                .input('id', lastId)
                .input('num', lastNum)
                .query(`
                    SELECT *
                    FROM ${TABLE_NAMES.facturas_detalle}
                    WHERE id_factura = @id OR numfac = @num
                `);
            console.table(detalles.recordset);
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkData();
