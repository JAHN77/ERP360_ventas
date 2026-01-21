const sql = require('mssql');
const { getConnectionForDb } = require('./services/sqlServerClient.cjs');

async function listTablesPrueba() {
    try {
        console.log('Connecting to Prueba_ERP360...');
        const pool = await getConnectionForDb('Prueba_ERP360');

        const result = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME LIKE 'ven_%' ORDER BY TABLE_NAME");
        console.log('Tables in Prueba_ERP360:', result.recordset.map(r => r.TABLE_NAME));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

listTablesPrueba();
