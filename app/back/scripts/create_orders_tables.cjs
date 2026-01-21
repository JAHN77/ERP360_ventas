const { executeQuery } = require('../services/sqlServerClient.cjs');

async function createOrderTables() {
  try {
    console.log('🛠️ Re-creando tablas de Pedidos WEB con estructura extendida...');

    // 0. Eliminar tablas previas si existen para asegurar estructura limpia
    // IMPORTANTE: Esto borra datos de prueba en _web.
    await executeQuery(`
      IF OBJECT_ID('ven_detapedidos_web', 'U') IS NOT NULL DROP TABLE ven_detapedidos_web;
      IF OBJECT_ID('ven_pedidos_web', 'U') IS NOT NULL DROP TABLE ven_pedidos_web;
    `);

    // 1. Crear tabla ven_pedidos_web (Encabezado)
    // Mantenemos la estructura robusta compatible con el controlador
    const createPedidosQuery = `
      CREATE TABLE ven_pedidos_web (
          id INT IDENTITY(1,1) PRIMARY KEY,
          numero_pedido VARCHAR(50) NOT NULL,
          fecha_pedido DATE,
          fecha_entrega_estimada DATE,
          codter VARCHAR(20),
          codven VARCHAR(20),
          empresa_id INT,
          cotizacion_id INT,
          
          subtotal DECIMAL(18,2) DEFAULT 0,
          descuento_valor DECIMAL(18,2) DEFAULT 0,
          descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
          iva_valor DECIMAL(18,2) DEFAULT 0,
          iva_porcentaje DECIMAL(5,2) DEFAULT 0,
          impoconsumo_valor DECIMAL(18,2) DEFAULT 0,
          total DECIMAL(18,2) DEFAULT 0,
          
          observaciones VARCHAR(500),
          instrucciones_entrega VARCHAR(500),
          estado VARCHAR(20) DEFAULT 'B', -- B: Borrador, C: Confirmado, etc.
          formapago NCHAR(4), 
          
          fec_creacion DATETIME DEFAULT GETDATE(),
          fec_modificacion DATETIME DEFAULT GETDATE(),
          codtar CHAR(2),
          codusu VARCHAR(10)
      );
      PRINT '✅ Tabla ven_pedidos_web creada.';
    `;
    await executeQuery(createPedidosQuery);

    // 2. Crear tabla ven_detapedidos_web (Detalle)
    // Usando la estructura solicitada por el usuario + ajustes de tipos para compatibilidad
    // Se han mantenido todas las columnas del DDL proporcionado
    const createPedidosDetalleQuery = `
      CREATE TABLE ven_detapedidos_web (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          numped CHAR(8) NOT NULL,
          codins CHAR(8) NOT NULL,
          valins NUMERIC(18, 2) NOT NULL,
          canped NUMERIC(18, 2) NOT NULL, -- Ajustado a (18,2) para permitir decimales
          ivaped NUMERIC(18, 2) NULL,
          dctped NUMERIC(18, 2) NULL,     -- Ajustado a (18,2) para permitir valores monetarios completos
          estped CHAR(1) NULL,
          codalm CHAR(3) NULL,
          serial VARCHAR(30) NULL,
          reservado BIT NULL,
          usureserva CHAR(10) NULL,
          numfac VARCHAR(12) NULL,
          DiasGar INT NULL,
          Numord CHAR(8) NULL,
          Fecsys DATETIME NULL DEFAULT GETDATE(),
          msisdn VARCHAR(20) NULL,
          imei VARCHAR(20) NULL,
          iccid VARCHAR(20) NULL,
          codplan CHAR(2) NULL,
          feccargo DATETIME NOT NULL DEFAULT GETDATE(),
          codtec VARCHAR(4) NOT NULL DEFAULT '',
          pedido_id INT NULL
      );
      
      -- Agregar FK
      ALTER TABLE ven_detapedidos_web WITH CHECK ADD CONSTRAINT FK_ven_detapedidos_web_ven_pedidos_web 
      FOREIGN KEY(pedido_id)
      REFERENCES ven_pedidos_web (id)
      ON DELETE CASCADE;

      ALTER TABLE ven_detapedidos_web CHECK CONSTRAINT FK_ven_detapedidos_web_ven_pedidos_web;

      PRINT '✅ Tabla ven_detapedidos_web creada con estructura extendida.';
      
      -- Indices
      CREATE INDEX IDX_ven_detapedidos_web_pedido_id ON ven_detapedidos_web(pedido_id);
    `;
    await executeQuery(createPedidosDetalleQuery);

    console.log('🏁 Tablas WEB recreadas exitosamente.');

  } catch (err) {
    console.error('❌ Error creando tablas:', err);
  } finally {
    process.exit();
  }
}

createOrderTables();
