const sql = require('mssql');
const { getConnection } = require('./services/sqlServerClient.cjs');

async function checkOrquideaRemission() {
    try {
        console.log('Connecting to Orquidea DB...');
        process.env.DB_DATABASE = 'orquidea';

        const pool = await getConnection('orquidea');

        const rem02 = await pool.request().query("SELECT * FROM ven_remiciones_enc WHERE numero_remision = '000002'");
        if (rem02.recordset.length > 0) {
            console.log('Remission 000002 FOUND in Orquidea:', rem02.recordset[0]);
        } else {
            console.log('Remission 000002 NOT found in Orquidea');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

checkOrquideaRemission();
