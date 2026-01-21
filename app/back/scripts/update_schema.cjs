const { executeQuery } = require('../services/sqlServerClient.cjs');
require('dotenv').config({ path: '../.env' });

async function updateSchema() {
  try {
    console.log("Updating schema for Nisa...");

    // 1. ven_cotizacion
    console.log("Recreating ven_cotizacion...");
    try {
        await executeQuery("IF OBJECT_ID('dbo.ven_cotizacion', 'U') IS NOT NULL DROP TABLE dbo.ven_cotizacion");
    } catch(e) { console.log("Table didn't exist or couldn't drop, proceeding..."); }

    await executeQuery(`
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
    )
    `);

    // Constraints separately
    await executeQuery("ALTER TABLE [dbo].[ven_cotizacion] ADD DEFAULT ((1)) FOR [formapago]");
    await executeQuery("ALTER TABLE [dbo].[ven_cotizacion] ADD DEFAULT ((0)) FOR [valor_anticipo]");
    await executeQuery("ALTER TABLE [dbo].[ven_cotizacion] ADD DEFAULT ('') FOR [observa]");
    await executeQuery("ALTER TABLE [dbo].[ven_cotizacion] ADD DEFAULT ('') FOR [estado]");
    await executeQuery("ALTER TABLE [dbo].[ven_cotizacion] ADD DEFAULT (space((2))) FOR [COD_TARIFA]");


    // 2. ven_detacotizacion
    console.log("Recreating ven_detacotizacion...");
    try {
        await executeQuery("IF OBJECT_ID('dbo.ven_detacotizacion', 'U') IS NOT NULL DROP TABLE dbo.ven_detacotizacion");
        // Also drop older name if exists to avoid confusion
        await executeQuery("IF OBJECT_ID('dbo.ven_detacotiz', 'U') IS NOT NULL DROP TABLE dbo.ven_detacotiz");
    } catch(e) { console.log("Table drop error (ignorable): " + e.message); }

    await executeQuery(`
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
    )
    `);

    await executeQuery("ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT (space((1))) FOR [num_factura]");
    await executeQuery("ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT ((0)) FOR [tasa_descuento]");
    await executeQuery("ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT ((0)) FOR [tasa_iva]");
    await executeQuery("ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT ((0.00)) FOR [qtycot]");
    await executeQuery("ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT ((0.00)) FOR [preciound]");
    await executeQuery("ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT ((0.00)) FOR [costo_unidad]");
    await executeQuery("ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT ((0.00)) FOR [costo_cot]");
    await executeQuery("ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT ((0.00)) FOR [precio_lista]");
    await executeQuery("ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT ((0.00)) FOR [cantidad_medida]");
    await executeQuery("ALTER TABLE [dbo].[ven_detacotizacion] ADD DEFAULT ((0.00)) FOR [excedente]");

    console.log("Schema update completed successfully.");

  } catch (error) {
    console.error("Script error:", error);
  }
}

updateSchema();
