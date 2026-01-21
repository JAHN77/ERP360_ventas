-- Script de creación de tablas de Cotizaciones para futuras migraciones
-- Basado en esquema compatible con Nisa

-- Tabla: ven_cotizacion
IF OBJECT_ID('dbo.ven_cotizacion', 'U') IS NOT NULL 
    PRINT 'La tabla ven_cotizacion ya existe';
ELSE
BEGIN
    CREATE TABLE [dbo].[ven_cotizacion](
        [id] [bigint] IDENTITY(1,1) NOT NULL,
        [codalm] [char](3) NOT NULL,
        [numcot] [char](8) NOT NULL,
        [codter] [varchar](15) NOT NULL,
        [fecha] [date] NOT NULL,
        [fecha_vence] [date] NULL,
        [cod_vendedor] [char](10) NULL,
        [formapago] [nchar](2) NULL,
        [valor_anticipo] [numeric](18, 2) NULL,
        [subtotal] [numeric](18, 2) NOT NULL,
        [val_iva] [numeric](18, 2) NOT NULL,
        [val_descuento] [numeric](18, 2) NULL,
        [observa] [varchar](200) NULL,
        [cod_usuario] [varchar](10) NOT NULL,
        [num_orden_compra] [int] NULL,
        [fecha_aprobacion] [date] NULL,
        [fecsys] [datetime] NOT NULL,
        [estado] [char](1) NULL,
        [id_usuario] [int] NULL,
        [COD_TARIFA] [char](2) NOT NULL,
        CONSTRAINT [PK_ven_cotizacion] PRIMARY KEY CLUSTERED 
        (
            [codalm] ASC,
            [numcot] ASC
        )
    );

    -- Constraints y Defaults para ven_cotizacion
    ALTER TABLE [dbo].[ven_cotizacion] ADD CONSTRAINT [DF_ven_cotizacion_formapago] DEFAULT ((1)) FOR [formapago];
    ALTER TABLE [dbo].[ven_cotizacion] ADD CONSTRAINT [DF_ven_cotizacion_abono] DEFAULT ((0)) FOR [valor_anticipo];
    ALTER TABLE [dbo].[ven_cotizacion] ADD CONSTRAINT [DF_ven_cotizacion_observa] DEFAULT ('') FOR [observa];
    ALTER TABLE [dbo].[ven_cotizacion] ADD CONSTRAINT [DF_ven_cotizacion_estcot] DEFAULT ('') FOR [estado];
    ALTER TABLE [dbo].[ven_cotizacion] ADD DEFAULT (space((2))) FOR [COD_TARIFA];
    
    PRINT 'Tabla ven_cotizacion creada exitosamente';
END
GO

-- Tabla: ven_detacotizacion
IF OBJECT_ID('dbo.ven_detacotizacion', 'U') IS NOT NULL 
    PRINT 'La tabla ven_detacotizacion ya existe';
ELSE
BEGIN
    CREATE TABLE [dbo].[ven_detacotizacion](
        [id] [bigint] IDENTITY(1,1) NOT NULL,
        [id_cotizacion] [bigint] NOT NULL,
        [num_factura] [char](8) NULL,
        [cod_producto] [char](8) NOT NULL,
        [cantidad] [numeric](9, 2) NOT NULL,
        [cant_facturada] [numeric](18, 2) NULL,
        [valor] [numeric](18, 2) NOT NULL,
        [codigo_medida] [char](3) NOT NULL,
        [tasa_descuento] [numeric](9, 5) NOT NULL,
        [tasa_iva] [numeric](5, 2) NOT NULL,
        [estado] [char](1) NULL,
        [qtycot] [numeric](10, 4) NOT NULL,
        [preciound] [numeric](19, 5) NOT NULL,
        [costo_unidad] [numeric](18, 3) NOT NULL,
        [costo_cot] [numeric](18, 2) NOT NULL,
        [precio_lista] [numeric](18, 2) NOT NULL,
        [cantidad_medida] [numeric](8, 3) NOT NULL,
        [excedente] [numeric](18, 2) NOT NULL,
        CONSTRAINT [PK__ven_deta__3213E83FB77682AE] PRIMARY KEY CLUSTERED 
        (
            [id] ASC
        )
    );

    -- Constraints y Defaults para ven_detacotizacion
    ALTER TABLE [dbo].[ven_detacotizacion] ADD CONSTRAINT [DF_ven_detacotizacion_num_factura] DEFAULT (space((1))) FOR [num_factura];
    ALTER TABLE [dbo].[ven_detacotizacion] ADD CONSTRAINT [DF_ven_detacotizacion_tasa_descuento] DEFAULT ((0)) FOR [tasa_descuento];
    ALTER TABLE [dbo].[ven_detacotizacion] ADD CONSTRAINT [DF_ven_detacotizacion_tasa_iva] DEFAULT ((0)) FOR [tasa_iva];
    ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT ((0.00)) FOR [qtycot];
    ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT ((0.00)) FOR [preciound];
    ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT ((0.00)) FOR [costo_unidad];
    ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT ((0.00)) FOR [costo_cot];
    ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT ((0.00)) FOR [precio_lista];
    ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT ((0.00)) FOR [cantidad_medida];
    ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT ((0.00)) FOR [excedente];

    PRINT 'Tabla ven_detacotizacion creada exitosamente';
END
GO
