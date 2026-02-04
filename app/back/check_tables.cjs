const sql = require('mssql');
const { getConnection } = require('./services/sqlServerClient.cjs');

async function checkTables() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME LIKE 'ven_ven%'
    `);
        console.log('Tables started with ven_:');
        result.recordset.forEach(row => console.log(row.TABLE_NAME));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkTables();
