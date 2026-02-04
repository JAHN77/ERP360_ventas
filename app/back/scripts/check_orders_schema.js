const { executeQuery } = require('../services/sqlServerClient.cjs');

async function checkOrdersSchema() {
    try {
        const query = `
      SELECT 
        TABLE_NAME, 
        COLUMN_NAME, 
        DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME IN ('ven_pedidos', 'ven_detapedidos', 'ven_remisiones', 'ven_detaremision')
      ORDER BY TABLE_NAME, COLUMN_NAME
    `;

        const result = await executeQuery(query);
        console.table(result);
    } catch (error) {
        console.error('Error checking schema:', error);
    } finally {
        process.exit();
    }
}

checkOrdersSchema();
