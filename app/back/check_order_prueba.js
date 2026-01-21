const sql = require('mssql');
const { getConnectionForDb } = require('./services/sqlServerClient.cjs');

async function checkOrderPrueba() {
    try {
        console.log('Connecting to Prueba_ERP360...');
        const pool = await getConnectionForDb('Prueba_ERP360');

        // Check Order 273
        const order = await pool.request().query("SELECT * FROM ven_pedidos WHERE id = 273");
        if (order.recordset.length > 0) {
            console.log('Order 273 FOUND:', order.recordset[0]);
        } else {
            console.log('Order 273 NOT found');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

checkOrderPrueba();
