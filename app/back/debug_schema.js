const { getConnection } = require('./services/sqlServerClient.cjs');

async function checkSchema() {
    try {
        const pool = await getConnection();
        const tables = ['inv_insumos', 'inv_lineas', 'inv_medidas'];
        
        for (const table of tables) {
            console.log(`\n--- Columns for ${table} ---`);
            const result = await pool.request().query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = '${table}'
            `);
            console.log(result.recordset.map(r => r.COLUMN_NAME).join(', '));
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkSchema();
