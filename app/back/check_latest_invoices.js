const sql = require('mssql');
require('dotenv').config();

async function checkData() {
    const config = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        database: 'orquidea', // Assuming orquidea based on previous context
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    };

    try {
        const pool = await sql.connect(config);

        console.log('--- ULTIMAS 5 FACTURAS ---');
        const facturas = await pool.request().query(`
            SELECT TOP 5 ID, numfact, tipfac, codter, fecfac, netfac, CUFE 
            FROM ven_facturas 
            ORDER BY ID DESC
        `);
        console.table(facturas.recordset);

        if (facturas.recordset.length > 0) {
            const lastId = facturas.recordset[0].ID;
            const lastNum = facturas.recordset[0].numfact;

            console.log(`\n--- DETALLES PARA FACTURA ID: ${lastId} (numfact: ${lastNum}) ---`);
            const detalles = await pool.request()
                .input('id', sql.Int, lastId)
                .input('num', sql.VarChar, lastNum)
                .query(`
                    SELECT ID, id_factura, numfac, tipfact, codins, qtyins, valins, ivains, observa
                    FROM ven_detafact
                    WHERE id_factura = @id OR numfac = @num
                `);
            console.table(detalles.recordset);
        }

        await sql.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkData();
