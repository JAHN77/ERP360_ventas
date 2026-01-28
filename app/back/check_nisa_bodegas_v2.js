const { getConnectionForDb, executeQuery } = require('./services/sqlServerClient.cjs');

async function check() {
    try {
        console.log('Consultando bodegas en Nisa...');
        const result = await executeQuery('SELECT codalm, nomalm FROM inv_almacen', {}, 'Nisa');
        console.table(result);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

check();
