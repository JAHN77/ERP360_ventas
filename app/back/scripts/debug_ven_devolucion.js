
require('dotenv').config({ path: '../.env' });
const sql = require('mssql');
const { DB_CONFIG } = require('../services/dbConfig.cjs');

async function debugVenDevolucion() {
    try {
        const pool = await sql.connect(DB_CONFIG);
        
        console.log('--- Ven_Devolucion Content ---');
        const res = await pool.request().query('SELECT * FROM Ven_Devolucion');
        console.table(res.recordset);

        console.log('--- gen_movimiento_notas Content (Last 5) ---');
        const res2 = await pool.request().query('SELECT TOP 5 * FROM gen_movimiento_notas ORDER BY id DESC');
        console.table(res2.recordset);

        pool.close();
    } catch (err) {
        console.error(err);
    }
}

debugVenDevolucion();
