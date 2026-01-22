
require('dotenv').config({ path: '../.env' }); // Adjust path to .env if needed
const sql = require('mssql');
const { DB_CONFIG } = require('../services/dbConfig.cjs');

async function debugCreditNote() {
    try {
        console.log('Connecting to DB...');
        const pool = await sql.connect(DB_CONFIG);
        console.log('Connected.');

        const notaNumero = 7;
        console.log(`Querying Credit Note #${notaNumero}...`);

        const notaResult = await pool.request().query(`
            SELECT * FROM gen_movimiento_notas WHERE consecutivo = ${notaNumero}
        `);

        if (notaResult.recordset.length === 0) {
            console.log('Credit Note NOT FOUND in gen_movimiento_notas');
            return;
        }

        const nota = notaResult.recordset[0];
        console.log('Credit Note Found:', {
            id: nota.id,
            consecutivo: nota.consecutivo,
            comprobante: nota.comprobante,
            fecha: nota.fecha,
            items: '-'
        });

        console.log(`Querying Details for ID ${nota.id} or Numdev ${nota.consecutivo}...`);
        
        const detailsResult = await pool.request().query(`
            SELECT * FROM Ven_Devolucion 
            WHERE id_nota = ${nota.id} 
               OR Numdev = ${nota.consecutivo}
        `);

        console.log(`Found ${detailsResult.recordset.length} details items.`);
        if (detailsResult.recordset.length > 0) {
            console.table(detailsResult.recordset);
        } else {
            console.log('No details found in Ven_Devolucion.');
            
            // Debug: Check if there are ANY records in Ven_Devolucion
            const countRes = await pool.request().query('SELECT COUNT(*) as count FROM Ven_Devolucion');
            console.log(`Total Ven_Devolucion count: ${countRes.recordset[0].count}`);
        }

        pool.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

debugCreditNote();
