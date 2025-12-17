IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_remiciones_enc]') AND name = 'factura_id')
BEGIN
    ALTER TABLE [dbo].[ven_remiciones_enc] ADD [factura_id] INT NULL;
    PRINT 'Columna factura_id agregada a ven_remiciones_enc';
END
ELSE
BEGIN
    PRINT 'La columna factura_id ya existe en ven_remiciones_enc';
END
GO

-- Opcional: Crear índice para mejorar rendimiento de búsquedas
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remiciones_enc_factura_id' AND object_id = OBJECT_ID(N'[dbo].[ven_remiciones_enc]'))
BEGIN
    CREATE INDEX [IX_ven_remiciones_enc_factura_id] ON [dbo].[ven_remiciones_enc] ([factura_id]);
    PRINT 'Índice IX_ven_remiciones_enc_factura_id creado';
END
GO
