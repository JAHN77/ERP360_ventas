const { executeQuery } = require('../services/sqlServerClient.cjs');
require('dotenv').config({ path: '../.env' });

async function checkColumns() {
  try {
    console.log("Checking columns for details...");
    const columns = await executeQuery(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'ven_detacotiz'
    `);
    
    columns.forEach(c => console.log(` - ${c.COLUMN_NAME}`));

  } catch (error) {
    console.error("Script error:", error);
  }
}

checkColumns();
