const { getConnectionForDb } = require('./services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('./services/dbConfig.cjs');

async function checkData() {
    try {
        const pool = await getConnectionForDb('orquidea');

        const facturas = await pool.request().query(`
            SELECT TOP 1 ID, numfact, tipfac, codter, fecfac, valvta, valiva, netfac, CUFE 
            FROM ${TABLE_NAMES.facturas}
            ORDER BY ID DESC
        `);
        console.log('HEADER:', facturas.recordset[0]);

        if (facturas.recordset.length > 0) {
            const lastId = facturas.recordset[0].ID;
            const lastNum = facturas.recordset[0].numfact;

            const detalles = await pool.request()
                .input('id', lastId)
                .input('num', lastNum)
                .query(`
                    SELECT ID, id_factura, numfac, tipfact, codins, qtyins, valins, ivains, observa
                    FROM ${TABLE_NAMES.facturas_detalle}
                    WHERE id_factura = @id OR numfac = @num
                `);
            console.log('DETAILS COUNT:', detalles.recordset.length);
            detalles.recordset.forEach((d, i) => console.log(`DETAIL ${i}:`, d));
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkData();
