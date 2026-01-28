require('dotenv').config({ path: 'app/back/.env' });
const { executeQuery } = require('./services/sqlServerClient.cjs');

async function checkCols() {
    try {
        const cols = await executeQuery("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ven_detafact'", {}, 'Nisa');
        console.log(cols.map(c => c.COLUMN_NAME).join(', '));
    } catch (e) { console.error(e); }
    process.exit(0);
}
checkCols();
