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
    trustServerCertificate: process.env.NODE_ENV !== 'production',
  },
};

async function checkColumns() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to database');

    const result = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'gen_movimiento_notas'
    `);

    console.log('Columns for gen_movimiento_notas:');
    result.recordset.forEach(row => console.log(row.COLUMN_NAME));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkColumns();
