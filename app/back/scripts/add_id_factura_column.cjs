const { executeQuery } = require('../services/sqlServerClient.cjs');

async function addIdFacturaColumn() {
  try {
    console.log('🛠️ Adding id_factura column to gen_movimiento_notas...');
    
    // Check if column exists first to avoid error
    await executeQuery(`
      IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'gen_movimiento_notas' AND COLUMN_NAME = 'id_factura'
      )
      BEGIN
        ALTER TABLE gen_movimiento_notas ADD id_factura INT NULL;
        PRINT '✅ Column id_factura added successfully.';
        
        -- Create Index for performance
        CREATE INDEX IDX_gen_movimiento_notas_id_factura ON gen_movimiento_notas(id_factura);
        PRINT '✅ Index created.';
      END
      ELSE
      BEGIN
        PRINT 'ℹ️ Column id_factura already exists.';
      END
    `);

    console.log('🏁 Migration completed.');
  } catch (err) {
    console.error('❌ Error adding column:', err);
  } finally {
    process.exit();
  }
}

addIdFacturaColumn();
