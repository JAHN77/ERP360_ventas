const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'services', '..', '.env') });
const sql = require('mssql');
const { getConnection } = require('./services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('./services/dbConfig.cjs');

async function checkColumnLength() {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = '${TABLE_NAMES.pedidos}' AND COLUMN_NAME = 'estado'
    `);
    console.log(result.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkColumnLength();
