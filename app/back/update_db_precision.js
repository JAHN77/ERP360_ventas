const sql = require('mssql');
require('dotenv').config();

// Configuración de la base de datos SQL Server desde variables de entorno
const DB_CONFIG = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true, // For development/scripts
    enableArithAbort: true,
  },
};

const TABLE_NAMES = {
  facturas: 'ven_facturas',
  facturas_detalle: 'ven_detafact',
};

async function updatePrecision() {
  console.log('🔄 Iniciando actualización de precisión de columnas a DECIMAL(18, 6)...');
  
  let pool;
  try {
    pool = await sql.connect(DB_CONFIG);
    console.log('✅ Conexión establecida.');

    const columnsToUpdateFacturas = [
      'valvta', 'valiva', 'valotr', 'valant', 'valdev', 'abofac', 'valdcto', 
      'valret', 'valrica', 'valriva', 'netfac', 'valcosto', 
      'efectivo', 'cheques', 'credito', 'tarjetacr', 'TarjetaDB', 'Transferencia',
      'valpagado', 'TARIFA_CREE', 'RETECREE', 'VALDOMICILIO', 'Valnotas'
    ];

    const columnsToUpdateDetalle = [
       'qtyins', 'valins', 'ivains', 'valdescuento', 'cosins', 'PRECIOUND', 'QTYVTA', 'PRECIO_LISTA'
    ];

    console.log(`\n📦 Actualizando tabla ${TABLE_NAMES.facturas} a DECIMAL(18, 2)...`);
    for (const col of columnsToUpdateFacturas) {
      try {
        console.log(`   - Altering column: ${col}...`);
        await pool.request().query(`ALTER TABLE ${TABLE_NAMES.facturas} ALTER COLUMN ${col} DECIMAL(18, 2)`);
        console.log(`     ✅ OK`);
      } catch (err) {
        console.error(`     ❌ Error alterando ${col}:`, err.message);
      }
    }

    console.log(`\n📦 Actualizando tabla ${TABLE_NAMES.facturas_detalle} a DECIMAL(18, 2)...`);
    for (const col of columnsToUpdateDetalle) {
      try {
        console.log(`   - Altering column: ${col}...`);
        await pool.request().query(`ALTER TABLE ${TABLE_NAMES.facturas_detalle} ALTER COLUMN ${col} DECIMAL(18, 2)`);
        console.log(`     ✅ OK`);
      } catch (err) {
        console.error(`     ❌ Error alterando ${col}:`, err.message);
      }
    }

    console.log('\n🎉 Proceso finalizado.');

  } catch (err) {
    console.error('❌ Error general:', err);
  } finally {
    if (pool) await pool.close();
  }
}

updatePrecision();
