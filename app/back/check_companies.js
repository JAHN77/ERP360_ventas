require('dotenv').config({ path: 'app/back/.env' });
const { executeQuery } = require('./services/sqlServerClient.cjs');

async function checkCompanies() {
    try {
        console.log('Checking config_empresas...');
        const query = `SELECT * FROM config_empresas`;
        const companies = await executeQuery(query);
        console.log('Companies found:', companies);
    } catch (error) {
        console.error('Error:', error);
    }
}

checkCompanies();
