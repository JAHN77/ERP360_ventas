const { executeQuery } = require('../services/sqlServerClient.cjs');
require('dotenv').config({ path: '../.env' });

async function checkBodegas() {
  try {
    console.log("Checking inv_almacen table...");
    try {
        const result = await executeQuery(`SELECT * FROM inv_almacen`);
        console.log("Found active bodegas:", result.length);
        if (result.length > 0) {
            console.log("First bodega sample:", result[0]);
        } else {
            console.log("Table exists but is empty.");
        }
    } catch (err) {
        console.error("Error querying inv_almacen:", err.message);
        
        // Try to list tables to see if it's named differently
        const tables = await executeQuery(`SELECT name FROM sys.tables WHERE name LIKE '%almacen%' OR name LIKE '%bodega%'`);
        console.log("Similar tables found:", tables);
    }

  } catch (error) {
    console.error("Script error:", error);
  }
}

checkBodegas();
