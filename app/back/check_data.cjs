const sql = require('mssql');
const { getConnection } = require('./services/sqlServerClient.cjs');

async function checkData() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
      SELECT COUNT(*) as count FROM ven_facturas
    `);
        console.log('Count in ven_facturas:', result.recordset[0].count);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkData();
