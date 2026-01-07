require('dotenv').config();
const sql = require('mssql');

const dbConfig = {
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT || '1433', 10),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: true,
    },
};

async function checkSchema() {
    try {
        await sql.connect(dbConfig);
        console.log('Connected to Master DB');

        // Get DB name for Orquidea
        const resultDb = await sql.query(`SELECT db_name FROM config_empresas WHERE razon_social LIKE '%Orquidea%'`);
        if (resultDb.recordset.length === 0) {
            console.log('Orquidea not found in config_empresas');
            return;
        }
        const targetDb = resultDb.recordset[0].db_name;
        console.log(`Target DB for Orquidea: ${targetDb}`);

        await sql.close();

        // Connect to Target DB
        const targetConfig = { ...dbConfig, database: targetDb };
        await sql.connect(targetConfig);
        console.log(`Connected to ${targetDb}`);

        // 1. List all tables starting with 'ven_'
        console.log('\n--- Tables starting with "ven_" ---');
        const resultVen = await sql.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME LIKE 'ven_%'
    `);
        resultVen.recordset.forEach(row => console.log(row.TABLE_NAME));

        // 2. Check columns of 'ven_detapedidos'
        console.log('\n--- Columns of ven_detapedidos ---');
        try {
            const resultCols = await sql.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'ven_detapedidos'
        `);
            resultCols.recordset.forEach(row => console.log(row.COLUMN_NAME));
        } catch (e) { console.log('Table ven_detapedidos not found'); }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
    }
}

checkSchema();
