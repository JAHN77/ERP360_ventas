const sql = require('mssql');
const { getConnection } = require('./services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('./services/dbConfig.cjs');

async function checkQuotes() {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT TOP 5 id, numcot 
      FROM ${TABLE_NAMES.cotizaciones} 
      ORDER BY id DESC
    `);
    console.log('Top 5 Quotes:', result.recordset);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkQuotes();
