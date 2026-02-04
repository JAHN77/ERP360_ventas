const { executeQuery } = require('../services/sqlServerClient.cjs');

async function run() {
    try {
        console.log('Checking gen_perfil...');
        const perfiles = await executeQuery('SELECT * FROM gen_perfil');
        console.log('Perfiles:', perfiles);

        console.log('Checking gen_usuarios columns...');
        const columns = await executeQuery(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'gen_usuarios'
    `);
        columns.forEach(col => console.log(col.COLUMN_NAME));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

run();
