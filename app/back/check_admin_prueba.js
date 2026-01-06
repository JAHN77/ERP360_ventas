const sql = require('mssql');
const { getConnection } = require('./services/sqlServerClient.cjs');

async function checkAdminPrueba() {
    try {
        console.log('Connecting to Prueba_ERP360...');
        const pool = await getConnection('Prueba_ERP360');

        const admin = await pool.request().query("SELECT * FROM gen_usuarios WHERE login = 'admin' OR login = 'ADMIN' OR codusu = 'admin' OR codusu = 'ADMIN'");
        if (admin.recordset.length > 0) {
            console.log('Admin user FOUND in Prueba_ERP360:', admin.recordset[0]);
        } else {
            console.log('Admin user NOT found in Prueba_ERP360');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

checkAdminPrueba();
