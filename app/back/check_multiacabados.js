const sql = require('mssql');
const { getConnection } = require('./services/sqlServerClient.cjs');

async function checkMultiacabados() {
    try {
        console.log('Connecting to Multiacabados DB...');
        process.env.DB_DATABASE = 'Multiacabados';

        const pool = await getConnection('Multiacabados');

        // Check Clients
        const clients = await pool.request().query('SELECT COUNT(*) as count FROM con_terceros');
        console.log(`Clientes count: ${clients.recordset[0].count}`);

        // Check Remissions
        const remissions = await pool.request().query('SELECT COUNT(*) as count FROM ven_remiciones_enc');
        console.log(`Remisiones count: ${remissions.recordset[0].count}`);

        // Check specific remission 000002
        const rem02 = await pool.request().query("SELECT * FROM ven_remiciones_enc WHERE numero_remision = '000002'");
        if (rem02.recordset.length > 0) {
            const r = rem02.recordset[0];
            console.log('Remission 000002 found. codter:', r.codter);

            // Check if client exists
            const clientCheck = await pool.request().query(`SELECT * FROM con_terceros WHERE codter = '${r.codter}'`);
            if (clientCheck.recordset.length > 0) {
                console.log('Client found for remission:', clientCheck.recordset[0].nomter);
            } else {
                console.log('WARNING: Client NOT found for remission codter:', r.codter);
            }
        } else {
            console.log('Remission 000002 NOT found in ven_remiciones_enc');
        }

        // Check Pedidos
        const pedidos = await pool.request().query('SELECT COUNT(*) as count FROM ven_pedidos');
        console.log(`Pedidos count: ${pedidos.recordset[0].count}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

checkMultiacabados();
