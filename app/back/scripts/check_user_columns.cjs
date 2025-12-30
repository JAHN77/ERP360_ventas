const { executeQuery } = require('../services/sqlServerClient.cjs');

async function checkSchema() {
  try {
    console.log('Checking gen_usuarios schema...');
    const schema = await executeQuery(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'gen_usuarios'
    `);
    console.log('Schema:', schema);

    console.log('Checking for admin user...');
    const users = await executeQuery("SELECT top 5 codusu, nomusu, clausu FROM gen_usuarios");
    console.log('Users:', users);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

checkSchema();
