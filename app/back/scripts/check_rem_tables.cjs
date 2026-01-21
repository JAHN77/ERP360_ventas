const { executeQuery } = require('../services/sqlServerClient.cjs');
require('dotenv').config({ path: '../.env' });

async function checkRemTables() {
  try {
    console.log("Checking remission tables...");
    
    const tables = await executeQuery(`
      SELECT name FROM sys.tables 
      WHERE name LIKE 'ven_remiciones%'
    `);
    
    console.log("Found remission tables:");
    tables.forEach(t => console.log(` - ${t.name}`));

  } catch (error) {
    console.error("Script error:", error);
  }
}

checkRemTables();
