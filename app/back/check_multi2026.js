const sql = require('mssql');
const { getConnection } = require('./services/sqlServerClient.cjs');

async function checkMulti2026() {
    try {
        console.log('Connecting to Multi2026 DB...');
        process.env.DB_DATABASE = 'Multi2026';

        const pool = await getConnection('Multi2026');

        // Check Clients
        const clients = await pool.request().query('SELECT COUNT(*) as count FROM con_terceros');
        console.log(`Clientes count: ${clients.recordset[0].count}`);

        // Check Remissions
        const remissions = await pool.request().query('SELECT COUNT(*) as count FROM ven_remiciones_enc');
        console.log(`Remisiones count: ${remissions.recordset[0].count}`);

        // Check Pedidos
        const pedidos = await pool.request().query('SELECT COUNT(*) as count FROM ven_pedidos');
        console.log(`Pedidos count: ${pedidos.recordset[0].count}`);

        // Check Admin user
        const admin = await pool.request().query("SELECT * FROM gen_usuarios WHERE login = 'admin' OR login = 'ADMIN'");
        if (admin.recordset.length > 0) {
            console.log('Admin user found in Multi2026:', admin.recordset[0]);
        } else {
            console.log('Admin user NOT found in Multi2026');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

checkMulti2026();
