const sql = require('mssql');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const config = {
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

async function checkColumns() {
  try {
    console.log('Connecting to:', config.server, config.database);
    const pool = await sql.connect(config);
    const result = await pool.request().query("SELECT TOP 1 * FROM ven_detapedidos");
    console.log('Columns in ven_detapedidos:');
    if (result.recordset.length > 0) {
        console.log(Object.keys(result.recordset[0]));
    } else {
        const schema = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ven_detapedidos'");
        console.log(schema.recordset.map(r => r.COLUMN_NAME));
    }
    pool.close();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkColumns();
