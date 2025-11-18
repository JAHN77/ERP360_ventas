/**
 * Script para verificar la estructura real de la tabla ven_facturas
 * y comparar con los límites que estamos usando
 */

require('dotenv').config();
const sql = require('mssql');

const DB_CONFIG = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.NODE_ENV !== 'production',
    enableArithAbort: true,
  },
};

async function verificarEstructura() {
  let pool;
  try {
    console.log('🔌 Conectando a la base de datos...');
    pool = await sql.connect(DB_CONFIG);
    console.log('✅ Conectado a la base de datos\n');

    // Obtener estructura de ven_facturas
    console.log('📋 Estructura de la tabla ven_facturas:');
    const estructuraResult = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ven_facturas'
      ORDER BY ORDINAL_POSITION
    `);

    console.table(estructuraResult.recordset.map(col => ({
      Columna: col.COLUMN_NAME,
      Tipo: col.DATA_TYPE,
      Longitud: col.CHARACTER_MAXIMUM_LENGTH || 'N/A',
      Nullable: col.IS_NULLABLE,
      Default: col.COLUMN_DEFAULT || 'N/A'
    })));

    // Verificar campos VARCHAR que no permiten NULL
    console.log('\n⚠️ Campos VARCHAR que NO permiten NULL:');
    const camposNotNull = estructuraResult.recordset.filter(col => 
      col.IS_NULLABLE === 'NO' && 
      (col.DATA_TYPE === 'varchar' || col.DATA_TYPE === 'char' || col.DATA_TYPE === 'nvarchar')
    );
    console.table(camposNotNull.map(col => ({
      Columna: col.COLUMN_NAME,
      Tipo: col.DATA_TYPE,
      Longitud: col.CHARACTER_MAXIMUM_LENGTH || 'N/A'
    })));

    // Verificar estructura de ven_detafact
    console.log('\n📋 Estructura de la tabla ven_detafact:');
    const estructuraDetalleResult = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ven_detafact'
      ORDER BY ORDINAL_POSITION
    `);

    console.table(estructuraDetalleResult.recordset.map(col => ({
      Columna: col.COLUMN_NAME,
      Tipo: col.DATA_TYPE,
      Longitud: col.CHARACTER_MAXIMUM_LENGTH || 'N/A',
      Nullable: col.IS_NULLABLE,
      Default: col.COLUMN_DEFAULT || 'N/A'
    })));

    // Verificar campos VARCHAR que no permiten NULL en detalle
    console.log('\n⚠️ Campos VARCHAR que NO permiten NULL en ven_detafact:');
    const camposNotNullDetalle = estructuraDetalleResult.recordset.filter(col => 
      col.IS_NULLABLE === 'NO' && 
      (col.DATA_TYPE === 'varchar' || col.DATA_TYPE === 'char' || col.DATA_TYPE === 'nvarchar')
    );
    console.table(camposNotNullDetalle.map(col => ({
      Columna: col.COLUMN_NAME,
      Tipo: col.DATA_TYPE,
      Longitud: col.CHARACTER_MAXIMUM_LENGTH || 'N/A'
    })));

    console.log('\n✅ Verificación completada\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

verificarEstructura();

