const sql = require('mssql');
const { getConnection } = require('./services/sqlServerClient.cjs');

async function checkDatabases() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
      SELECT name FROM sys.databases
    `);
        console.log('Databases:');
        result.recordset.forEach(row => console.log(row.name));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkDatabases();
