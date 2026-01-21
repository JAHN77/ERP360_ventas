const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { executeQuery } = require('./services/sqlServerClient.cjs');

async function findOrquideaDb() {
    try {
        console.log('Searching for Orquidea in config_empresas...');
        const query = "SELECT * FROM config_empresas WHERE nombre_empresa LIKE '%Orquidea%'";
        const results = await executeQuery(query);
        console.log('Results:', results);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

findOrquideaDb();
