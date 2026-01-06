const { executeQuery } = require('./services/sqlServerClient.cjs');

async function listColumns() {
    try {
        console.log('Listing columns of config_empresas...');
        const query = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'config_empresas'
    `;
        const results = await executeQuery(query);
        console.log('Columns:', results.map(c => c.COLUMN_NAME));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

listColumns();
