require('dotenv').config({ path: 'app/back/.env' });
const { executeQuery } = require('./services/sqlServerClient.cjs');

async function checkUnits() {
    try {
        console.log('--- Checking inv_medidas ---');
        const medidas = await executeQuery('SELECT * FROM inv_medidas', {}, 'Nisa');
        console.table(medidas);

        console.log('--- Checking inv_insumos (RETROCARGADOR) ---');
        const productos = await executeQuery("SELECT id, codins, nomins, undins FROM inv_insumos WHERE nomins LIKE '%RETROCARGADOR%'", {}, 'Nisa');
        console.table(productos);

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

checkUnits();
