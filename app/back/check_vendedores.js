const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { getConnectionForDb } = require('./services/sqlServerClient.cjs');

async function checkVendedoresActive() {
    try {
        const pool = await getConnectionForDb('orquidea');
        const result = await pool.request().query('SELECT * FROM ven_vendedor WHERE Activo = 1');
        console.log('Active Vendedores:', result.recordset.length);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkVendedoresActive();
