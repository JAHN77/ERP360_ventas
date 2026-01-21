const { executeQuery } = require('./services/sqlServerClient.cjs');

async function createTables() {
    const dbName = 'orquidea';
    console.log(`Creating remissions tables in ${dbName}...`);

    try {
        const createEnc = `
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ven_remiciones_enc')
      BEGIN
        CREATE TABLE ven_remiciones_enc (
          id INT IDENTITY(1,1) PRIMARY KEY,
          numero_remision VARCHAR(50),
          codalm CHAR(3),
          fecha_remision DATETIME,
          pedido_id INT,
          codter VARCHAR(20),
          codven VARCHAR(20),
          estado VARCHAR(20),
          observaciones VARCHAR(255),
          codusu VARCHAR(20),
          fec_creacion DATETIME DEFAULT GETDATE(),
          factura_id INT
        );
        PRINT 'Table ven_remiciones_enc created.';
      END
      ELSE
      BEGIN
        PRINT 'Table ven_remiciones_enc already exists.';
      END
    `;
        await executeQuery(createEnc, {}, dbName);

        const createDet = `
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ven_remiciones_det')
      BEGIN
        CREATE TABLE ven_remiciones_det (
          id INT IDENTITY(1,1) PRIMARY KEY,
          remision_id INT,
          deta_pedido_id INT,
          codins VARCHAR(50),
          cantidad_enviada DECIMAL(18,2),
          cantidad_facturada DECIMAL(18,2),
          cantidad_devuelta DECIMAL(18,2)
        );
        PRINT 'Table ven_remiciones_det created.';
      END
      ELSE
      BEGIN
        PRINT 'Table ven_remiciones_det already exists.';
      END
    `;
        await executeQuery(createDet, {}, dbName);

        console.log('Tables created successfully.');
        process.exit(0);

    } catch (error) {
        console.error('Creation failed:', error);
        process.exit(1);
    }
}

createTables();
