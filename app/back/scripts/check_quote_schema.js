const { executeQuery } = require('../services/sqlServerClient.cjs');

async function checkQuoteSchema() {
    try {
        const query = `
      SELECT 
        TABLE_NAME, 
        COLUMN_NAME, 
        DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'ven_cotizacion'
      ORDER BY COLUMN_NAME
    `;

        const result = await executeQuery(query);
        console.table(result);
    } catch (error) {
        console.error('Error checking schema:', error);
    } finally {
        process.exit();
    }
}

checkQuoteSchema();
