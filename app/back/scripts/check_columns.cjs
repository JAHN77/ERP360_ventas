const { executeQuery } = require('../services/sqlServerClient.cjs');
require('dotenv').config({ path: '../.env' });

async function checkColumns() {
  try {
    const tableName = 'ven_pedidos'; 
    console.log(`Checking columns for table: ${tableName}`);
    const query = `
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${tableName}'
    `;
    const result = await executeQuery(query);
    console.table(result);
  } catch (error) {
    console.error('Error checking columns:', error);
  } finally {
    process.exit();
  }
}

checkColumns();
