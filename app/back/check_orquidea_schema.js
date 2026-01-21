const { executeQuery } = require('./services/sqlServerClient.cjs');

async function checkSchema() {
    const dbName = 'orquidea';
    const tables = ['ven_pedidos', 'ven_detapedidos', 'ven_remiciones_enc', 'ven_remiciones_det', 'ven_cotizacion', 'ven_detacotiz', 'inv_insumos'];

    console.log(`\n--- Checking schema for ${dbName} ---`);
    for (const table of tables) {
        try {
            const query = `
                SELECT COLUMN_NAME, DATA_TYPE 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = '${table}'
            `;
            const columns = await executeQuery(query, {}, dbName);
            console.log(`\nTable: ${table}`);
            if (columns.length === 0) {
                console.log('  (Table not found)');
            } else {
                columns.forEach(c => console.log(`  - ${c.COLUMN_NAME} (${c.DATA_TYPE})`));
            }
        } catch (error) {
            console.error(`Error checking table ${table} in ${dbName}:`, error.message);
        }
    }
    process.exit(0);
}

checkSchema();
