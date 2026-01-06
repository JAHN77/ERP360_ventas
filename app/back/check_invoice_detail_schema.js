const { executeQuery } = require('./services/sqlServerClient.cjs');

async function checkInvoiceDetailSchema() {
    const dbName = 'orquidea';
    console.log(`Checking schema for ven_detafact in ${dbName}...`);

    try {
        const query = `
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'ven_detafact'
      ORDER BY COLUMN_NAME
    `;

        const columns = await executeQuery(query, {}, dbName);
        console.log('Columns in ven_detafact:', columns.map(c => c.COLUMN_NAME));
        process.exit(0);

    } catch (error) {
        console.error('Check failed:', error);
        process.exit(1);
    }
}

checkInvoiceDetailSchema();
