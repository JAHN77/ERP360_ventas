const sql = require('mssql');
require('dotenv').config();

const config = {
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT || '1433', 10),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: true
    }
};

async function checkColumns() {
    try {
        await sql.connect(config);
        const tables = ['ven_remiciones_enc', 'ven_remiciones_det', 'ven_cotizacion', 'ven_detacotizacion'];

        for (const table of tables) {
            console.log(`\n--- Columnas de ${table} ---`);
            const result = await sql.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = '${table}'
            `);
            console.log(result.recordset.map(r => r.COLUMN_NAME).join(', '));
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sql.close();
    }
}

checkColumns();
