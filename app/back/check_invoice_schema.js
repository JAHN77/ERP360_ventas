const { executeQuery } = require('./services/sqlServerClient.cjs');

async function checkInvoiceSchema() {
    const dbName = 'orquidea';
    console.log(`Checking schema for ven_facturas in ${dbName}...`);

    try {
        const query = `
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'ven_facturas'
      ORDER BY COLUMN_NAME
    `;

        const columns = await executeQuery(query, {}, dbName);
        console.log('Columns in ven_facturas:', columns.map(c => c.COLUMN_NAME));
        process.exit(0);

    } catch (error) {
        console.error('Check failed:', error);
        process.exit(1);
    }
}

checkInvoiceSchema();
