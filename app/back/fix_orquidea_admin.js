const { executeQueryWithParams } = require('./services/sqlServerClient.cjs');
const bcrypt = require('bcryptjs');

async function fixAdmin() {
    const dbName = 'orquidea';
    console.log(`Fixing admin user in ${dbName}...`);

    try {
        const password = 'admin123';
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Update ADMIN user to have correct password_web and tipousu
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

fixAdmin();
