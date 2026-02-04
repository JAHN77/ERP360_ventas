const { executeQuery } = require('../services/sqlServerClient.cjs');

async function createRemissionTables() {
  try {
    console.log('🚀 Creando tablas de remisiones...');

    // 1. Tabla de cabecera: ven_remisiones
    console.log('Creando tabla ven_remisiones...');
    await executeQuery(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_remisiones]') AND type in (N'U'))
      BEGIN
        CREATE TABLE [dbo].[ven_remisiones](
          [ID] [bigint] IDENTITY(1,1) NOT NULL,
          [codalm] [char](3) NOT NULL DEFAULT (''),
          [numrem] [varchar](15) NOT NULL,
          [tiprem] [char](2) NOT NULL DEFAULT ('RM'),
          [codter] [varchar](15) NOT NULL,
          [fecrem] [datetime] NOT NULL DEFAULT (getdate()),
          [vecrem] [datetime] NULL,
          [codven] [char](3) NULL DEFAULT (''),
          [valfac] [numeric](18, 2) NOT NULL DEFAULT ((0)),
          [iva] [numeric](18, 2) NOT NULL DEFAULT ((0)),
          [descuento] [numeric](18, 2) NOT NULL DEFAULT ((0)),
          [subtotal] [numeric](18, 2) NOT NULL DEFAULT ((0)),
          [total] [numeric](18, 2) NOT NULL DEFAULT ((0)),
          [observacion] [varchar](max) NULL,
          [estado] [int] NOT NULL DEFAULT ((1)), -- 1: Activa, 0: Anulada, 2: Facturada
          [usuario] [varchar](20) NULL,
          CONSTRAINT [PK_ven_remisiones] PRIMARY KEY CLUSTERED ([ID] ASC),
          CONSTRAINT [UK_ven_remisiones_num] UNIQUE ([codalm], [numrem], [tiprem])
        )
        PRINT '✅ Tabla ven_remisiones creada.';
      END
      ELSE
      BEGIN
        PRINT 'ℹ️ Tabla ven_remisiones ya existe.';
      END
    `);

    // 2. Tabla de detalle: ven_detaremision
    console.log('Creando tabla ven_detaremision...');
    await executeQuery(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_detaremision]') AND type in (N'U'))
      BEGIN
        CREATE TABLE [dbo].[ven_detaremision](
          [ID] [int] IDENTITY(1,1) NOT NULL,
          [codalm] [char](3) NOT NULL,
          [numrem] [varchar](15) NOT NULL,
          [tiprem] [char](2) NOT NULL DEFAULT ('RM'),
          [codins] [varchar](15) NOT NULL,
          [canins] [numeric](18, 2) NOT NULL DEFAULT ((0)),
          [preins] [numeric](18, 2) NOT NULL DEFAULT ((0)),
          [tasa_iva] [numeric](5, 2) NOT NULL DEFAULT ((0)),
          [porc_desc] [numeric](5, 2) NOT NULL DEFAULT ((0)),
          [subtotal] [numeric](18, 2) NOT NULL DEFAULT ((0)),
          [total] [numeric](18, 2) NOT NULL DEFAULT ((0)),
          CONSTRAINT [PK_ven_detaremision] PRIMARY KEY CLUSTERED ([ID] ASC)
        )
        PRINT '✅ Tabla ven_detaremision creada.';
      END
      ELSE
      BEGIN
        PRINT 'ℹ️ Tabla ven_detaremision ya existe.';
      END
    `);

    console.log('\n✨ Tablas creadas con éxito.');
  } catch (err) {
    console.error('❌ Error creando las tablas:', err);
  } finally {
    process.exit();
  }
}

createRemissionTables();
