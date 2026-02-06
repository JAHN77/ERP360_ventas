require('dotenv').config();
const { executeQuery } = require('./services/sqlServerClient.cjs');

async function checkBodegas() {
  console.log('Checking bodegas in DB:', process.env.DB_DATABASE);
  try {
    const bodegas = await executeQuery('SELECT * FROM inv_almacen');
    console.log('Bodegas found:', bodegas.length);
    if(bodegas.length > 0) {
        console.log('First bodega:', bodegas[0]);
        const activeBodegas = bodegas.filter(b => b.activo === true || b.activo === 1);
        console.log('Active bodegas:', activeBodegas.length);
    } else {
        console.log('No bodegas found in table inv_almacen');
    }
  } catch (err) {
    console.error('Error active checking:', err.message);
    
    // Fallback check: list tables
    try {
        console.log('Listing Active tables...');
        const tables = await executeQuery("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
        const invTables = tables.filter(t => t.TABLE_NAME.toLowerCase().includes('inv'));
        console.log('Inventory tables:', invTables.map(t => t.TABLE_NAME));
    } catch(e) {
        console.error('Error listing tables:', e);
    }
  }
  process.exit();
}

checkBodegas();
