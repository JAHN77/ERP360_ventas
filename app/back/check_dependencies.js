const { executeQuery } = require('./services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('./services/dbConfig.cjs');

async function checkDependencies() {
    const dbName = 'orquidea';
    console.log(`Checking dependencies in ${dbName}...`);

    try {
        // Check con_terceros
        console.log('--- con_terceros ---');
        const queryClients = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = '${TABLE_NAMES.clientes}'
    `;
        const clients = await executeQuery(queryClients, {}, dbName);
        console.log('Columns:', clients.map(c => c.COLUMN_NAME));

        // Check remisiones
        console.log(`--- ${TABLE_NAMES.remisiones} ---`);
        const queryRemissions = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = '${TABLE_NAMES.remisiones}'
    `;
        const remissions = await executeQuery(queryRemissions, {}, dbName);
        console.log('Columns:', remissions.map(c => c.COLUMN_NAME));

        process.exit(0);
    } catch (error) {
        console.error('Check failed:', error);
        process.exit(1);
    }
}

checkDependencies();
