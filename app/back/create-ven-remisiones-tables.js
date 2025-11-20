const sql = require('mssql');
require('dotenv').config();

(async () => {
  let pool;
  
  try {
    console.log('🔌 Conectando a la base de datos...');
    pool = await sql.connect({
      server: process.env.DB_SERVER,
      port: parseInt(process.env.DB_PORT),
      database: process.env.DB_DATABASE,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      options: {
        encrypt: false,
        trustServerCertificate: true
      }
    });
    console.log('✅ Conectado a la base de datos\n');

    // Verificar si las tablas ya existen
    const checkEnc = await pool.request().query(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'ven_remisiones_enc'
    `);
    const checkDet = await pool.request().query(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'ven_remisiones_det'
    `);

    // Crear tabla ven_remisiones_enc si no existe
    if (checkEnc.recordset[0].count === 0) {
      console.log('📝 Creando tabla ven_remisiones_enc...');
      await pool.request().query(`
        CREATE TABLE ven_remisiones_enc (
          id INT PRIMARY KEY IDENTITY(1,1),
          codalm VARCHAR(10),
          numero_remision VARCHAR(50),
          fecha_remision DATE,
          pedido_id INT,
          codter VARCHAR(20),
          codven VARCHAR(20),
          estado VARCHAR(20),
          observaciones VARCHAR(500),
          codusu VARCHAR(20),
          fec_creacion DATETIME DEFAULT GETDATE()
        )
      `);
      console.log('✅ Tabla ven_remisiones_enc creada');
    } else {
      console.log('ℹ️  Tabla ven_remisiones_enc ya existe');
    }

    // Crear tabla ven_remisiones_det si no existe
    if (checkDet.recordset[0].count === 0) {
      console.log('📝 Creando tabla ven_remisiones_det...');
      await pool.request().query(`
        CREATE TABLE ven_remisiones_det (
          id INT PRIMARY KEY IDENTITY(1,1),
          remision_id INT NOT NULL,
          deta_pedido_id INT NULL,
          codins VARCHAR(50),
          cantidad_enviada DECIMAL(18,2) DEFAULT 0,
          cantidad_facturada DECIMAL(18,2) DEFAULT 0,
          cantidad_devuelta DECIMAL(18,2) DEFAULT 0,
          FOREIGN KEY (remision_id) REFERENCES ven_remisiones_enc(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Tabla ven_remisiones_det creada');
    } else {
      console.log('ℹ️  Tabla ven_remisiones_det ya existe');
    }

    // Crear índices
    console.log('\n📝 Creando índices...');
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remisiones_enc_pedido_id' AND object_id = OBJECT_ID('ven_remisiones_enc'))
          CREATE INDEX IX_ven_remisiones_enc_pedido_id ON ven_remisiones_enc(pedido_id)
      `);
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remisiones_enc_codter' AND object_id = OBJECT_ID('ven_remisiones_enc'))
          CREATE INDEX IX_ven_remisiones_enc_codter ON ven_remisiones_enc(codter)
      `);
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remisiones_enc_fecha_remision' AND object_id = OBJECT_ID('ven_remisiones_enc'))
          CREATE INDEX IX_ven_remisiones_enc_fecha_remision ON ven_remisiones_enc(fecha_remision)
      `);
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remisiones_det_remision_id' AND object_id = OBJECT_ID('ven_remisiones_det'))
          CREATE INDEX IX_ven_remisiones_det_remision_id ON ven_remisiones_det(remision_id)
      `);
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remisiones_det_codins' AND object_id = OBJECT_ID('ven_remisiones_det'))
          CREATE INDEX IX_ven_remisiones_det_codins ON ven_remisiones_det(codins)
      `);
      console.log('✅ Índices creados');
    } catch (e) {
      console.log('ℹ️  Índices ya existen o error al crearlos:', e.message);
    }

    // Migrar datos si existen en las tablas antiguas
    console.log('\n📦 Verificando datos para migrar...');
    const oldEncExists = await pool.request().query(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'ven_remiciones_enc'
    `);
    const oldDetExists = await pool.request().query(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'ven_remiciones_det'
    `);

    if (oldEncExists.recordset[0].count > 0) {
      const newCount = await pool.request().query('SELECT COUNT(*) as count FROM ven_remisiones_enc');
      const oldCount = await pool.request().query('SELECT COUNT(*) as count FROM ven_remiciones_enc');
      
      if (newCount.recordset[0].count === 0) {
        console.log('📦 Migrando datos de ven_remiciones_enc a ven_remisiones_enc...');
        await pool.request().query(`
          INSERT INTO ven_remisiones_enc (
            codalm, numero_remision, fecha_remision, pedido_id, codter, codven, 
            estado, observaciones, codusu, fec_creacion
          )
          SELECT 
            codalm, numero_remision, fecha_remision, pedido_id, codter, codven, 
            estado, observaciones, codusu, fec_creacion
          FROM ven_remiciones_enc
        `);
        const migrated = await pool.request().query('SELECT COUNT(*) as count FROM ven_remisiones_enc');
        console.log(`✅ ${migrated.recordset[0].count} registros migrados`);
      } else {
        console.log('ℹ️  ven_remisiones_enc ya tiene datos, no se migran');
      }
    }

    if (oldDetExists.recordset[0].count > 0) {
      const newDetCount = await pool.request().query('SELECT COUNT(*) as count FROM ven_remisiones_det');
      
      if (newDetCount.recordset[0].count === 0) {
        console.log('📦 Migrando datos de ven_remiciones_det a ven_remisiones_det...');
        // Mapear remision_id antiguo al nuevo usando numero_remision, codter y fecha
        await pool.request().query(`
          INSERT INTO ven_remisiones_det (
            remision_id, deta_pedido_id, codins, 
            cantidad_enviada, cantidad_facturada, cantidad_devuelta
          )
          SELECT 
            rn.id as remision_id,
            rd.deta_pedido_id,
            rd.codins,
            rd.cantidad_enviada,
            rd.cantidad_facturada,
            rd.cantidad_devuelta
          FROM ven_remiciones_det rd
          INNER JOIN ven_remiciones_enc ro ON rd.remision_id = ro.id
          INNER JOIN ven_remisiones_enc rn ON 
            ro.numero_remision = rn.numero_remision 
            AND ro.codter = rn.codter
            AND CAST(ro.fecha_remision AS DATE) = CAST(rn.fecha_remision AS DATE)
        `);
        const migrated = await pool.request().query('SELECT COUNT(*) as count FROM ven_remisiones_det');
        console.log(`✅ ${migrated.recordset[0].count} registros migrados`);
      } else {
        console.log('ℹ️  ven_remisiones_det ya tiene datos, no se migran');
      }
    }

    // Verificar resultado final
    console.log('\n📊 Estado final:');
    const finalEnc = await pool.request().query('SELECT COUNT(*) as count FROM ven_remisiones_enc');
    const finalDet = await pool.request().query('SELECT COUNT(*) as count FROM ven_remisiones_det');
    console.log(`   ven_remisiones_enc: ${finalEnc.recordset[0].count} registros`);
    console.log(`   ven_remisiones_det: ${finalDet.recordset[0].count} registros`);

    console.log('\n✅ Proceso completado exitosamente');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Conexión cerrada');
    }
  }
})();
