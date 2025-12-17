USE ERP360;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_notas]') AND name = 'tipo_nota')
BEGIN
    ALTER TABLE ven_notas ADD tipo_nota VARCHAR(20) DEFAULT 'DEVOLUCION';
    PRINT 'Columna tipo_nota agregada a la tabla ven_notas';
END
ELSE
BEGIN
    PRINT 'La columna tipo_nota ya existe en la tabla ven_notas';
END
GO
