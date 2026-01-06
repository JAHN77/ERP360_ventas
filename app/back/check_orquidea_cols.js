const { executeQuery } = require('./services/sqlServerClient.cjs');

async function checkColumns() {
    try {
        const query = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'gen_usuarios' 
      AND COLUMN_NAME IN ('email', 'password_hash', 'role', 'created_at')
    `;

        const columns = await executeQuery(query, {}, 'orquidea');
        console.log('Existing columns in orquidea:', columns.map(c => c.COLUMN_NAME));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkColumns();
