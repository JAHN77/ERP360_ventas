const sql = require('mssql');
const { getConnection } = require('./services/sqlServerClient.cjs');

async function checkStructure() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ven_facturas'
    `);
        console.log('Structure of ven_facturas:');
        result.recordset.forEach(row => console.log(`${row.COLUMN_NAME} (${row.DATA_TYPE})`));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkStructure();
