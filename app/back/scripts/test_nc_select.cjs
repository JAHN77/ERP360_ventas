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

async function testSelect() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to database');

    const query = `
        SELECT TOP 1
          id,
          consecutivo AS numero,
          id_factura AS facturaId,
          LTRIM(RTRIM(codter)) AS clienteId,
          fecha AS fechaEmision,
          valor_nota AS subtotal,
          iva_nota AS iva,
          total_nota AS total,
          detalle AS motivo,
          CASE WHEN estado_envio = 1 THEN '1' ELSE '0' END AS estadoDian,
          fecsys AS createdAt,
          fecsys AS updatedAt,
          cufe
        FROM gen_movimiento_notas
        ORDER BY fecha DESC, id DESC
    `;
    
    console.log('Executing query...');
    const result = await pool.request().query(query);
    console.log('Query successful!');
    console.log('Result:', result.recordset);

    process.exit(0);
  } catch (err) {
    console.error('Query Error:', err);
    process.exit(1);
  }
}

testSelect();
