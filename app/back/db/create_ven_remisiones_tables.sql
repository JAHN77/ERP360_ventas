-- Crear tablas correctas: ven_remisiones_enc y ven_remisiones_det
-- (con "s" en remisiones, según especificación del usuario)

-- Verificar y crear tabla ven_remisiones_enc
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_remisiones_enc]') AND type in (N'U'))
BEGIN
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
    );
    PRINT 'Tabla ven_remisiones_enc creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla ven_remisiones_enc ya existe';
END
GO

-- Verificar y crear tabla ven_remisiones_det
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_remisiones_det]') AND type in (N'U'))
BEGIN
    CREATE TABLE ven_remisiones_det (
        id INT PRIMARY KEY IDENTITY(1,1),
        remision_id INT NOT NULL,
        deta_pedido_id INT NULL,
        codins VARCHAR(50),
        cantidad_enviada DECIMAL(18,2) DEFAULT 0,
        cantidad_facturada DECIMAL(18,2) DEFAULT 0,
        cantidad_devuelta DECIMAL(18,2) DEFAULT 0,
        FOREIGN KEY (remision_id) REFERENCES ven_remisiones_enc(id) ON DELETE CASCADE
    );
    PRINT 'Tabla ven_remisiones_det creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla ven_remisiones_det ya existe';
END
GO

-- Índices para optimización
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remisiones_enc_pedido_id' AND object_id = OBJECT_ID('ven_remisiones_enc'))
    CREATE INDEX IX_ven_remisiones_enc_pedido_id ON ven_remisiones_enc(pedido_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remisiones_enc_codter' AND object_id = OBJECT_ID('ven_remisiones_enc'))
    CREATE INDEX IX_ven_remisiones_enc_codter ON ven_remisiones_enc(codter);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remisiones_enc_fecha_remision' AND object_id = OBJECT_ID('ven_remisiones_enc'))
    CREATE INDEX IX_ven_remisiones_enc_fecha_remision ON ven_remisiones_enc(fecha_remision);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remisiones_det_remision_id' AND object_id = OBJECT_ID('ven_remisiones_det'))
    CREATE INDEX IX_ven_remisiones_det_remision_id ON ven_remisiones_det(remision_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remisiones_det_codins' AND object_id = OBJECT_ID('ven_remisiones_det'))
    CREATE INDEX IX_ven_remisiones_det_codins ON ven_remisiones_det(codins);
GO

-- Migrar datos de ven_remiciones_enc a ven_remisiones_enc si existen
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_remiciones_enc]') AND type in (N'U'))
BEGIN
    IF NOT EXISTS (SELECT * FROM ven_remisiones_enc)
    BEGIN
        INSERT INTO ven_remisiones_enc (
            codalm, numero_remision, fecha_remision, pedido_id, codter, codven, 
            estado, observaciones, codusu, fec_creacion
        )
        SELECT 
            codalm, numero_remision, fecha_remision, pedido_id, codter, codven, 
            estado, observaciones, codusu, fec_creacion
        FROM ven_remiciones_enc;
        PRINT 'Datos migrados de ven_remiciones_enc a ven_remisiones_enc';
    END
    ELSE
    BEGIN
        PRINT 'ven_remisiones_enc ya tiene datos, no se migran';
    END
END
GO

-- Migrar datos de ven_remiciones_det a ven_remisiones_det si existen
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_remiciones_det]') AND type in (N'U'))
BEGIN
    IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_remisiones_enc]') AND type in (N'U'))
    BEGIN
        -- Primero necesitamos mapear los IDs antiguos a los nuevos
        -- Esto es complejo, así que mejor insertamos directamente si no hay conflictos
        IF NOT EXISTS (SELECT * FROM ven_remisiones_det)
        BEGIN
            -- Mapear remision_id antiguo al nuevo
            INSERT INTO ven_remisiones_det (
                remision_id, deta_pedido_id, codins, 
                cantidad_enviada, cantidad_facturada, cantidad_devuelta
            )
            SELECT 
                rn.id as remision_id,  -- Usar el nuevo ID
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
                AND CAST(ro.fecha_remision AS DATE) = CAST(rn.fecha_remision AS DATE);
            PRINT 'Datos migrados de ven_remiciones_det a ven_remisiones_det';
        END
        ELSE
        BEGIN
            PRINT 'ven_remisiones_det ya tiene datos, no se migran';
        END
    END
END
GO

PRINT 'Proceso completado';

