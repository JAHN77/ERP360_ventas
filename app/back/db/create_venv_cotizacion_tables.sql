-- Script para crear las tablas venv_cotizacion y venv_detacotizacion
-- Basado en la estructura de ven_cotizacion y ven_detacotizacion

-- Tabla venv_cotizacion (Cabecera de cotizaciones)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[venv_cotizacion]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[venv_cotizacion] (
        [id] BIGINT IDENTITY(1,1) NOT NULL,
        [codalm] CHAR(3) NOT NULL,
        [numcot] CHAR(8) NOT NULL,
        [codter] VARCHAR(15) NOT NULL,
        [fecha] DATE NOT NULL,
        [fecha_vence] DATE NULL,
        [cod_vendedor] CHAR(10) NULL,
        [formapago] NCHAR(2) NULL DEFAULT ((1)),
        [valor_anticipo] NUMERIC(18,2) NULL DEFAULT ((0)),
        [subtotal] NUMERIC(18,2) NOT NULL,
        [val_iva] NUMERIC(18,2) NOT NULL,
        [val_descuento] NUMERIC(18,2) NULL,
        [observa] VARCHAR(200) NULL DEFAULT (''),
        [cod_usuario] VARCHAR(10) NOT NULL,
        [num_orden_compra] INT NULL,
        [fecha_aprobacion] DATE NULL,
        [fecsys] DATETIME NOT NULL DEFAULT GETDATE(),
        [estado] CHAR(1) NULL DEFAULT (''),
        [id_usuario] INT NULL,
        [COD_TARIFA] CHAR(2) NOT NULL DEFAULT (space((2))),
        CONSTRAINT [PK_venv_cotizacion] PRIMARY KEY CLUSTERED ([id] ASC)
    );
    PRINT 'Tabla venv_cotizacion creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla venv_cotizacion ya existe';
END
GO

-- Tabla venv_detacotizacion (Detalle de cotizaciones)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[venv_detacotizacion]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[venv_detacotizacion] (
        [id] BIGINT IDENTITY(1,1) NOT NULL,
        [id_cotizacion] BIGINT NOT NULL,
        [num_factura] CHAR(8) NULL DEFAULT (space((1))),
        [cod_producto] CHAR(8) NOT NULL,  -- CHAR(8) como en ven_detacotizacion
        [cantidad] NUMERIC(9,2) NOT NULL,
        [cant_facturada] NUMERIC(18,2) NULL,
        [valor] NUMERIC(18,2) NOT NULL,
        [codigo_medida] CHAR(3) NOT NULL,
        [tasa_descuento] NUMERIC(9,5) NOT NULL DEFAULT ((0)),
        [tasa_iva] NUMERIC(5,2) NOT NULL DEFAULT ((0)),
        [estado] CHAR(1) NULL,
        [qtycot] NUMERIC(10,4) NOT NULL DEFAULT ((0.00)),
        [preciound] NUMERIC(19,5) NOT NULL DEFAULT ((0.00)),
        [costo_unidad] NUMERIC(18,3) NOT NULL DEFAULT ((0.00)),
        [costo_cot] NUMERIC(18,2) NOT NULL DEFAULT ((0.00)),
        [precio_lista] NUMERIC(18,2) NOT NULL DEFAULT ((0.00)),
        [cantidad_medida] NUMERIC(8,3) NOT NULL DEFAULT ((0.00)),
        [excedente] NUMERIC(18,2) NOT NULL DEFAULT ((0.00)),
        CONSTRAINT [PK_venv_detacotizacion] PRIMARY KEY CLUSTERED ([id] ASC),
        CONSTRAINT [FK_venv_detacotizacion_venv_cotizacion] FOREIGN KEY ([id_cotizacion]) 
            REFERENCES [dbo].[venv_cotizacion] ([id]) ON DELETE CASCADE
    );
    PRINT 'Tabla venv_detacotizacion creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla venv_detacotizacion ya existe';
END
GO

-- Índices para venv_cotizacion
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_venv_cotizacion_fecha' AND object_id = OBJECT_ID('venv_cotizacion'))
    CREATE INDEX idx_venv_cotizacion_fecha ON venv_cotizacion(fecha);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_venv_cotizacion_estado' AND object_id = OBJECT_ID('venv_cotizacion'))
    CREATE INDEX idx_venv_cotizacion_estado ON venv_cotizacion(estado);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_venv_cotizacion_cliente' AND object_id = OBJECT_ID('venv_cotizacion'))
    CREATE INDEX idx_venv_cotizacion_cliente ON venv_cotizacion(codter);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_venv_cotizacion_numcot' AND object_id = OBJECT_ID('venv_cotizacion'))
    CREATE INDEX idx_venv_cotizacion_numcot ON venv_cotizacion(numcot);
GO

-- Índices para venv_detacotizacion
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_venv_detacotizacion_cotizacion' AND object_id = OBJECT_ID('venv_detacotizacion'))
    CREATE INDEX idx_venv_detacotizacion_cotizacion ON venv_detacotizacion(id_cotizacion);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_venv_detacotizacion_producto' AND object_id = OBJECT_ID('venv_detacotizacion'))
    CREATE INDEX idx_venv_detacotizacion_producto ON venv_detacotizacion(cod_producto);
GO

PRINT 'Script completado exitosamente';
GO

