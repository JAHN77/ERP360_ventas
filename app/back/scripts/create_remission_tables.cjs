const { executeQuery } = require('../services/sqlServerClient.cjs');

async function createRemissionTables() {
  try {
    console.log('🛠️ Iniciando creación de tablas de Remisiones WEB...');

    // 1. Crear tabla ven_remiciones_enc_web (Encabezado)
    const createEncabezadoQuery = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ven_remiciones_enc_web' AND xtype='U')
      BEGIN
          CREATE TABLE ven_remiciones_enc_web (
              id INT IDENTITY(1,1) PRIMARY KEY,
              numero_remision VARCHAR(50) NOT NULL,
              fecha_remision DATETIME DEFAULT GETDATE(),
              pedido_id INT NULL,
              codter VARCHAR(20),
              codven VARCHAR(20),
              codalm VARCHAR(10),
              estado VARCHAR(20) DEFAULT 'BORRADOR',
              observaciones VARCHAR(500),
              codusu VARCHAR(20),
              fec_creacion DATETIME DEFAULT GETDATE(),
              factura_id INT NULL,
              empresa_id INT NULL
          );
          PRINT '✅ Tabla ven_remiciones_enc_web creada correctamente.';
      END
      ELSE
      BEGIN
          PRINT 'ℹ️ La tabla ven_remiciones_enc_web ya existe.';
      END
    `;
    await executeQuery(createEncabezadoQuery);

    // 2. Crear tabla ven_remiciones_det_web (Detalle)
    const createDetalleQuery = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ven_remiciones_det_web' AND xtype='U')
      BEGIN
          CREATE TABLE ven_remiciones_det_web (
              id INT IDENTITY(1,1) PRIMARY KEY,
              remision_id INT NOT NULL,
              deta_pedido_id INT NULL,
              codins VARCHAR(20) NOT NULL,
              cantidad_enviada DECIMAL(18, 2) DEFAULT 0,
              cantidad_facturada DECIMAL(18, 2) DEFAULT 0,
              cantidad_devuelta DECIMAL(18, 2) DEFAULT 0,
              fec_creacion DATETIME DEFAULT GETDATE()
          );

          -- FK a Encabezado
          ALTER TABLE ven_remiciones_det_web WITH CHECK ADD CONSTRAINT FK_ven_remiciones_det_web_enc 
          FOREIGN KEY(remision_id)
          REFERENCES ven_remiciones_enc_web (id)
          ON DELETE CASCADE;

          ALTER TABLE ven_remiciones_det_web CHECK CONSTRAINT FK_ven_remiciones_det_web_enc;

          PRINT '✅ Tabla ven_remiciones_det_web creada correctamente.';
          
          CREATE INDEX IDX_ven_remiciones_det_web_remision_id ON ven_remiciones_det_web(remision_id);
      END
      ELSE
      BEGIN
          PRINT 'ℹ️ La tabla ven_remiciones_det_web ya existe.';
      END
    `;
    await executeQuery(createDetalleQuery);

    console.log('🏁 Proceso de creación de tablas Remisiones WEB finalizado.');

  } catch (err) {
    console.error('❌ Error creando tablas de remisiones:', err);
  } finally {
    process.exit();
  }
}

createRemissionTables();
