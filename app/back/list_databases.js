const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { getConnection, executeQuery } = require('./services/sqlServerClient.cjs');

async function listDatabases() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT name FROM sys.databases WHERE name LIKE '%Orquidea%' OR name LIKE '%ERP%'");
        console.log('Databases:', result.recordset.map(r => r.name));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

listDatabases();
