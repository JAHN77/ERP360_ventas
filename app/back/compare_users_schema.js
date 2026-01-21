const { executeQuery } = require('./services/sqlServerClient.cjs');

async function compareSchemas() {
    try {
        const query = `
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'gen_usuarios'
      ORDER BY COLUMN_NAME
    `;

        console.log('--- Schema for Prueba_ERP360 ---');
        const schema1 = await executeQuery(query, {}, 'Prueba_ERP360');
        console.log(JSON.stringify(schema1, null, 2));

        console.log('--- Schema for orquidea ---');
        const schema2 = await executeQuery(query, {}, 'orquidea');
        console.log(JSON.stringify(schema2, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

compareSchemas();
