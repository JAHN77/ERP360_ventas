
require('dotenv').config();
const { executeQueryWithParams } = require('./services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('./services/dbConfig.cjs');
const bcrypt = require('bcryptjs');

async function createUser() {
    try {
        const username = 'WEBADMIN';
        const password = 'admin123';
        const saltRounds = 10;

        console.log(`Creating user: ${username}`);

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        console.log('Password hashed successfully.');

        // Using a safe ID that likely doesn't conflict, or letting DB handle it if identity insert is on (but schema showed ID is int, likely identity)
        // The schema showed 'id' is 'int' and 'NO' nullable. Usually it's identity.
        // I'll try to insert without ID first. If it fails, I might need to check for identity.
        // Actually, let's check the max ID first to be safe if I need to provide one, 
        // but standard practice is Identity.
        // However, the previous listUsers showed IDs 1, 2, 3.

        const query = `
      INSERT INTO ${TABLE_NAMES.usuarios} 
      (codusu, nomusu, clausu, tipousu, Activo, password_web, vendedor, Tecnico)
      VALUES 
      (@codusu, @nomusu, @clausu, @tipousu, @activo, @password_web, 0, 0)
    `;

        // Note: codusu is char(8), so we pad or trim? The DB seems to have 'ADMIN   '.
        // 'WEBADMIN' is exactly 8 chars.

        await executeQueryWithParams(query, {
            codusu: username,
            nomusu: 'Web Admin',
            clausu: password, // Legacy password field
            tipousu: 1, // Admin
            activo: 1,
            password_web: hashedPassword
        });

        console.log('User created successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error creating user:', error);
        process.exit(1);
    }
}

createUser();
