const { executeQueryWithParams } = require('./services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('./services/dbConfig.cjs');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function updatePassword() {
    try {
        const targetDb = 'Prueba_ERP360';
        const username = 'ADMIN';
        const newPassword = 'password123';
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        console.log(`Updating password for ${username} in ${targetDb}...`);

        const query = `UPDATE ${TABLE_NAMES.usuarios} SET password_web = @password WHERE LTRIM(RTRIM(codusu)) = @username`;
        await executeQueryWithParams(query, { password: hashedPassword, username }, targetDb);

        console.log('Password updated successfully.');
    } catch (error) {
        console.error('Error updating password:', error);
    }
}

updatePassword();
