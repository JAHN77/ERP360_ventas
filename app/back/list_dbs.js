const sql = require('mssql');
const { getConnection } = require('./services/sqlServerClient.cjs');

async function listDatabases() {
    try {
        const pool = await getConnection(); // Default connection
        const result = await pool.request().query('SELECT name FROM sys.databases');
        console.log('Databases:', result.recordset.map(r => r.name));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

listDatabases();
