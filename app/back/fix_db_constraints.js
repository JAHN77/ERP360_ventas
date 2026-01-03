const sql = require('mssql');
require('dotenv').config();

const DB_CONFIG = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

const TABLE_NAMES = {
  facturas: 'ven_facturas',
};

// Columnas que fallaron anteriormente por constraints
const columnsToFix = [
  'valiva', 'valotr', 'valant', 'valdev', 'abofac', 'valdcto', 
  'valret', 'valrica', 'valriva', 'valcosto', 
  'efectivo', 'cheques', 'credito', 'tarjetacr', 'TarjetaDB', 'Transferencia',
  'VALDOMICILIO', 'Valnotas'
];

async function updateDb() {
  try {
    const pool = await sql.connect(DB_CONFIG);

    console.log('✅ Conexión establecida.');

    for (const col of columnsToFix) {
      console.log(`\n🔧 Procesando columna: ${col}...`);
      
      // 1. Buscar Constraint
      const constraintQuery = `
        SELECT default_constraints.name
        FROM sys.all_columns
        INNER JOIN sys.tables
            ON all_columns.object_id = tables.object_id
        INNER JOIN sys.schemas
            ON tables.schema_id = schemas.schema_id
        INNER JOIN sys.default_constraints
            ON all_columns.default_object_id = default_constraints.object_id
        WHERE 
            schemas.name = 'dbo'
            AND tables.name = '${TABLE_NAMES.facturas}'
            AND all_columns.name = '${col}'
      `;
      
      const res = await pool.request().query(constraintQuery);
      
      if (res.recordset.length > 0) {
        const constraintName = res.recordset[0].name;
        console.log(`   🔸 Constraint encontrado: ${constraintName}`);
        
        // 2. Eliminar Constraint
        console.log(`   🔥 Eliminando constraint...`);
        await pool.request().query(`ALTER TABLE ${TABLE_NAMES.facturas} DROP CONSTRAINT ${constraintName}`);
      } else {
        console.log(`   ℹ️ No se encontró constraint (o ya fue borrado).`);
      }

      // 3. Alterar Columna
      console.log(`   🔄 Alterando columna a DECIMAL(18, 2)...`);
      try {
        await pool.request().query(`ALTER TABLE ${TABLE_NAMES.facturas} ALTER COLUMN ${col} DECIMAL(18, 2)`);
        console.log(`     ✅ Alteración Exitosa`);
      } catch (alterError) {
        console.error(`     ❌ Error alterando columna: ${alterError.message}`);
      }

      // 4. Restaurar Constraint (Default 0)
      console.log(`   ➕ Restaurando constraint DEFAULT 0...`);
      try {
        // Generar nombre aleatorio o consistente para evitar colisiones si se borró uno global
        const newConstraintName = `DF_${TABLE_NAMES.facturas}_${col}_Fixed`; 
        // Verificar si existe antes de crear (por seguridad)
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.default_constraints WHERE name = '${newConstraintName}')
            BEGIN
                ALTER TABLE ${TABLE_NAMES.facturas} ADD CONSTRAINT ${newConstraintName} DEFAULT 0 FOR ${col}
            END
        `);
         console.log(`     ✅ Constraint restaurado.`);
      } catch (constError) {
          console.error(`     ⚠️ Advertencia re-creando constraint: ${constError.message}`);
      }
    }

    console.log('\n🎉 Reparación finalizada.');
    process.exit(0);

  } catch (err) {
    console.error('❌ Error general:', err);
    process.exit(1);
  }
}

updateDb();
