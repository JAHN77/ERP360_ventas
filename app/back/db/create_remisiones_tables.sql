-- Script para crear las tablas de remisiones
-- Tabla: ven_remiciones_enc (Encabezado de remisiones)
-- Tabla: ven_remiciones_det (Detalle de remisiones)

-- Verificar y crear tabla ven_remiciones_enc
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_remiciones_enc]') AND type in (N'U'))
BEGIN
    CREATE TABLE ven_remiciones_enc (
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
    );
    PRINT 'Tabla ven_remiciones_enc creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla ven_remiciones_enc ya existe';
END
GO

-- Verificar y crear tabla ven_remiciones_det
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_remiciones_det]') AND type in (N'U'))
BEGIN
    CREATE TABLE ven_remiciones_det (
        id INT PRIMARY KEY IDENTITY(1,1),
        remision_id INT NOT NULL,
        deta_pedido_id INT NULL,
        codins VARCHAR(50),
        cantidad_enviada DECIMAL(18,2) DEFAULT 0,
        cantidad_facturada DECIMAL(18,2) DEFAULT 0,
        cantidad_devuelta DECIMAL(18,2) DEFAULT 0,
        FOREIGN KEY (remision_id) REFERENCES ven_remiciones_enc(id) ON DELETE CASCADE
    );
    PRINT 'Tabla ven_remiciones_det creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla ven_remiciones_det ya existe';
END
GO

-- Crear índices para mejorar el rendimiento
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remiciones_enc_pedido_id' AND object_id = OBJECT_ID('ven_remiciones_enc'))
BEGIN
    CREATE INDEX IX_ven_remiciones_enc_pedido_id ON ven_remiciones_enc(pedido_id);
    PRINT 'Índice IX_ven_remiciones_enc_pedido_id creado';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remiciones_enc_codter' AND object_id = OBJECT_ID('ven_remiciones_enc'))
BEGIN
    CREATE INDEX IX_ven_remiciones_enc_codter ON ven_remiciones_enc(codter);
    PRINT 'Índice IX_ven_remiciones_enc_codter creado';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remiciones_enc_fecha_remision' AND object_id = OBJECT_ID('ven_remiciones_enc'))
BEGIN
    CREATE INDEX IX_ven_remiciones_enc_fecha_remision ON ven_remiciones_enc(fecha_remision);
    PRINT 'Índice IX_ven_remiciones_enc_fecha_remision creado';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remiciones_det_remision_id' AND object_id = OBJECT_ID('ven_remiciones_det'))
BEGIN
    CREATE INDEX IX_ven_remiciones_det_remision_id ON ven_remiciones_det(remision_id);
    PRINT 'Índice IX_ven_remiciones_det_remision_id creado';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remiciones_det_codins' AND object_id = OBJECT_ID('ven_remiciones_det'))
BEGIN
    CREATE INDEX IX_ven_remiciones_det_codins ON ven_remiciones_det(codins);
    PRINT 'Índice IX_ven_remiciones_det_codins creado';
END
GO

PRINT 'Script de creación de tablas de remisiones completado exitosamente';
GO

