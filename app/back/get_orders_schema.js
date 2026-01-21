const sql = require('mssql');
const { getConnection } = require('./services/sqlServerClient.cjs');

async function getOrdersSchema() {
    try {
        console.log('Connecting to ERP360 DB...');
        const pool = await getConnection('ERP360');

        const schemaEnc = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ven_pedidos'
    `);
        console.log('ven_pedidos Schema:', JSON.stringify(schemaEnc.recordset, null, 2));

        const schemaDet = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ven_detapedidos'
    `);
        console.log('ven_detapedidos Schema:', JSON.stringify(schemaDet.recordset, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

getOrdersSchema();
