const { executeQuery } = require('./services/sqlServerClient.cjs');

async function testQueries() {
    const dbs = ['orquidea', 'Prueba_ERP360'];

    for (const dbName of dbs) {
        console.log(`\n--- Testing queries for ${dbName} ---`);

        try {
            console.log('Querying ven_pedidos...');
            const pedidos = await executeQuery('SELECT TOP 1 * FROM ven_pedidos', {}, dbName);
            console.log(`✅ ven_pedidos query successful (Found ${pedidos.length} records)`);
        } catch (error) {
            console.error(`❌ ven_pedidos query failed in ${dbName}:`, error.message);
        }

        try {
            console.log('Querying ven_detapedidos...');
            const detaPedidos = await executeQuery('SELECT TOP 1 * FROM ven_detapedidos', {}, dbName);
            console.log(`✅ ven_detapedidos query successful (Found ${detaPedidos.length} records)`);
        } catch (error) {
            console.error(`❌ ven_detapedidos query failed in ${dbName}:`, error.message);
        }

        try {
            console.log('Querying ven_cotizacion...');
            const cotizaciones = await executeQuery('SELECT TOP 1 * FROM ven_cotizacion', {}, dbName);
            console.log(`✅ ven_cotizacion query successful (Found ${cotizaciones.length} records)`);
        } catch (error) {
            console.error(`❌ ven_cotizacion query failed in ${dbName}:`, error.message);
        }

        try {
            console.log('Querying ven_detacotiz...');
            const detaCotiz = await executeQuery('SELECT TOP 1 * FROM ven_detacotiz', {}, dbName);
            console.log(`✅ ven_detacotiz query successful (Found ${detaCotiz.length} records)`);
        } catch (error) {
            console.error(`❌ ven_detacotiz query failed in ${dbName}:`, error.message);
        }
    }
    process.exit(0);
}

testQueries();
