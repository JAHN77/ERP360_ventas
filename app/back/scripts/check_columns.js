
require('dotenv').config({ path: '../.env' });
const sql = require('mssql');
const { DB_CONFIG } = require('../services/dbConfig.cjs');

async function checkColumns() {
    try {
        const pool = await sql.connect(DB_CONFIG);
        const res = await pool.request().query('SELECT TOP 1 * FROM ven_facturas');
        console.log('ven_facturas keys:', Object.keys(res.recordset[0]));
        pool.close();
    } catch (err) {
        console.error(err);
    }
}
checkColumns();
