const { executeQuery, executeQueryWithParams } = require('./services/sqlServerClient.cjs');
const bcrypt = require('bcryptjs');

async function fixOrquidea() {
    const dbName = 'orquidea';
    console.log(`Fixing schema and admin user in ${dbName}...`);

    try {
        // 1. Add password_web if missing
        console.log('Adding password_web column...');
        const alterQuery = `
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'gen_usuarios' AND COLUMN_NAME = 'password_web')
      BEGIN
        ALTER TABLE gen_usuarios ADD password_web VARCHAR(255);
      END
    `;
        await executeQuery(alterQuery, {}, dbName);
        console.log('Column password_web checked/added.');

        // 2. Fix Admin User
        const password = 'admin123';
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const updateQuery = `
      UPDATE gen_usuarios 
      SET password_web = @hash,
          tipousu = 1,
          Activo = 1,
          clausu = 'admin',
          nomusu = 'Administrador Sistema'
      WHERE codusu = 'ADMIN'
    `;

        await executeQueryWithParams(updateQuery, { hash }, dbName);
        console.log('User ADMIN updated with password_web and tipousu=1.');

        process.exit(0);

    } catch (error) {
        console.error('Fix failed:', error);
        process.exit(1);
    }
}

fixOrquidea();
