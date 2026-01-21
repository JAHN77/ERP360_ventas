const { executeQuery } = require('./services/sqlServerClient.cjs');

async function checkNotNulls() {
    try {
        const query = `
      SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'gen_usuarios' 
      AND IS_NULLABLE = 'NO'
    `;

        const columns = await executeQuery(query, {}, 'orquidea');
        console.log('NOT NULL columns in orquidea:', columns);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkNotNulls();
