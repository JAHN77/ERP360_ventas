const sql = require('mssql');
const { getConnection } = require('./services/sqlServerClient.cjs');

async function checkConfigEmpresas() {
    try {
        console.log('Connecting to ERP_EMPRESAS_MASTER...');
        // DB_DATABASE is already ERP_EMPRESAS_MASTER in .env, so default connection is fine.

        const pool = await getConnection();

        const result = await pool.request().query('SELECT * FROM config_empresas');
        console.log('Config Empresas:', JSON.stringify(result.recordset, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

checkConfigEmpresas();
