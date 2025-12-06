
const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_DATABASE,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true
  }
};

async function checkKardex() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to DB');

    // Get column info
    const result = await pool.request().query("SELECT TOP 0 * FROM inv_kardex");
    console.log('Columns in inv_kardex:');
    if (result.recordset.columns) {
        Object.keys(result.recordset.columns).forEach(col => {
            console.log(`- ${col}`);
        });
    } else {
        console.log('Could not retrieve columns (recordset.columns is undefined)');
    }

  } catch (err) {
    console.error('Error checking inv_kardex:', err.message);
  } finally {
    sql.close();
  }
}

checkKardex();
