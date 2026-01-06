const sql = require('mssql');
const { getConnection } = require('./services/sqlServerClient.cjs');

async function checkPruebaRemission() {
    try {
        console.log('Connecting to Prueba_ERP360 DB...');
        process.env.DB_DATABASE = 'Prueba_ERP360';

        const pool = await getConnection('Prueba_ERP360');

        const rem02 = await pool.request().query("SELECT * FROM ven_remiciones_enc WHERE numero_remision = '000002'");
        if (rem02.recordset.length > 0) {
            console.log('Remission 000002 FOUND in Prueba_ERP360:', rem02.recordset[0]);
        } else {
            console.log('Remission 000002 NOT found in Prueba_ERP360');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

checkPruebaRemission();
