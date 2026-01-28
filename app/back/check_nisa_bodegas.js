require('dotenv').config({ path: 'app/back/.env' });
const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: 'Nisa', // Forzando Nisa
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function checkBodegas() {
    try {
        console.log('Connecting to Nisa...');
        await sql.connect(config);
        console.log('Connected!');

        const result = await sql.query`SELECT codalm, nomalm FROM inv_almacen`;
        console.log('Bodegas en Nisa:');
        console.table(result.recordset);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

checkBodegas();
