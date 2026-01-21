const { executeQuery } = require('./services/sqlServerClient.cjs');

async function createTables() {
    const dbName = 'Multiacabados';
    console.log(`Creating orders tables in ${dbName}...`);

    try {
        const createEnc = `
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ven_pedidos')
      BEGIN
        CREATE TABLE ven_pedidos (
          id INT IDENTITY(1,1) PRIMARY KEY,
          numero_pedido VARCHAR(50),
          fecha_pedido DATETIME,
          codter VARCHAR(20),
          codven VARCHAR(20),
          estado VARCHAR(20),
          observaciones VARCHAR(255),
          total DECIMAL(18,2),
          subtotal DECIMAL(18,2),
          iva DECIMAL(18,2),
          codusu VARCHAR(20),
          fec_creacion DATETIME DEFAULT GETDATE()
        );
        PRINT 'Table ven_pedidos created.';
      END
      ELSE
      BEGIN
        PRINT 'Table ven_pedidos already exists.';
      END
    `;
        await executeQuery(createEnc, {}, dbName);

        const createDet = `
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ven_detapedidos')
      BEGIN
        CREATE TABLE ven_detapedidos (
          id INT IDENTITY(1,1) PRIMARY KEY,
          pedido_id INT,
          codins VARCHAR(50),
          cantidad DECIMAL(18,2),
          precio_unitario DECIMAL(18,2),
          total_linea DECIMAL(18,2),
          iva_porcentaje DECIMAL(5,2)
        );
        PRINT 'Table ven_detapedidos created.';
      END
      ELSE
      BEGIN
        PRINT 'Table ven_detapedidos already exists.';
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
