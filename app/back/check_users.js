const { executeQuery } = require('./services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('./services/dbConfig.cjs');
require('dotenv').config();

async function checkTenantsAndUsers() {
    try {
        console.log('Checking config_empresas...');
        const tenants = await executeQuery(`SELECT * FROM config_empresas`, []);
        console.log('Tenants found:', tenants.length);
        tenants.forEach(t => {
            console.log(`ID: ${t.id}, Name: ${t.razon_social}, DB: ${t.db_name}, Active: ${t.activo}`);
        });

        if (tenants.length > 0) {
            const targetDb = tenants[0].db_name;
            console.log(`\nChecking users in tenant DB: ${targetDb}`);
            // Pass empty array as params, and targetDb as third argument
            const users = await executeQuery(`SELECT TOP 5 * FROM ${TABLE_NAMES.usuarios}`, [], targetDb);
            console.log('Users found:', users.length);
            users.forEach(u => {
                console.log(`ID: ${u.id}, User: ${u.codusu}, Name: ${u.nomusu}, Active: ${u.Activo}, PasswordWeb: ${u.password_web ? 'YES' : 'NO'}`);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

checkTenantsAndUsers();
