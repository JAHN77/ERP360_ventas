const { executeQuery } = require('./services/sqlServerClient.cjs');

async function findOrquideaDb() {
    try {
        console.log('Searching for Orquidea in config_empresas...');
        const query = "SELECT nombre_comercial, db_name FROM config_empresas WHERE nombre_comercial LIKE '%Orquidea%' OR razon_social LIKE '%Orquidea%'";
        const results = await executeQuery(query);
        console.log('Results:', results);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

findOrquideaDb();
