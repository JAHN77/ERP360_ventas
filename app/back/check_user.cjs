
require('dotenv').config();
const { executeQueryWithParams } = require('./services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('./services/dbConfig.cjs');

async function checkUser() {
    try {
        const username = 'WEBADMIN';
        console.log(`Checking user: ${username}`);

        const query = `
      SELECT 
        id, 
        LTRIM(RTRIM(codusu)) as codusu, 
        LTRIM(RTRIM(nomusu)) as nomusu, 
        password_web,
        LTRIM(RTRIM(clausu)) as clausu_legacy,
        tipousu,
        Activo
      FROM ${TABLE_NAMES.usuarios}
      WHERE LTRIM(RTRIM(codusu)) = @username
    `;

        const users = await executeQueryWithParams(query, { username });
        console.log('Users found:', users);

        if (users.length > 0) {
            const user = users[0];
            console.log('User details:', {
                id: user.id,
                codusu: user.codusu,
                hasPasswordWeb: !!user.password_web,
                passwordWebLength: user.password_web ? user.password_web.length : 0,
                activo: user.Activo
            });
        } else {
            console.log('User not found.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error checking user:', error);
        process.exit(1);
    }
}

checkUser();
