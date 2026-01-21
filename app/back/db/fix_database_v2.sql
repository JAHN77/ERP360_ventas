-- =====================================================
-- Script de Corrección de Estructura de Base de Datos V2
-- =====================================================
-- Este script corrige las discrepancias identificadas
-- entre la estructura de la BD y lo que el código espera.
-- Es agnóstico a la base de datos (no contiene USE).
-- =====================================================

PRINT 'Iniciando correcciones de esquema...';

-- 1. TABLA ven_pedidos
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_pedidos]') AND type in (N'U'))
BEGIN
    -- Agregar id si falta
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_pedidos]') AND name = 'id')
    BEGIN
        PRINT 'Agregando columna id a ven_pedidos...';
        ALTER TABLE ven_pedidos ADD id INT IDENTITY(1,1);
    END

    -- Agregar codter si falta (mapear desde codcli)
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_pedidos]') AND name = 'codter')
    BEGIN
        PRINT 'Agregando columna codter a ven_pedidos...';
        ALTER TABLE ven_pedidos ADD codter VARCHAR(20) NULL;
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_pedidos]') AND name = 'codcli')
        BEGIN
            EXEC('UPDATE ven_pedidos SET codter = codcli WHERE codter IS NULL');
        END
    END

    -- Agregar cotizacion_id si falta
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_pedidos]') AND name = 'cotizacion_id')
    BEGIN
        PRINT 'Agregando columna cotizacion_id a ven_pedidos...';
        ALTER TABLE ven_pedidos ADD cotizacion_id INT NULL;
    END
END

-- 2. TABLA ven_detapedidos
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_detapedidos]') AND type in (N'U'))
BEGIN
    -- Agregar id si falta
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_detapedidos]') AND name = 'id')
    BEGIN
        PRINT 'Agregando columna id a ven_detapedidos...';
        ALTER TABLE ven_detapedidos ADD id BIGINT IDENTITY(1,1);
    END

    -- Agregar pedido_id si falta
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_detapedidos]') AND name = 'pedido_id')
    BEGIN
        PRINT 'Agregando columna pedido_id a ven_detapedidos...';
        ALTER TABLE ven_detapedidos ADD pedido_id INT NULL;
        
        -- Intentar vincular por numped si existe ven_pedidos
        IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_pedidos]') AND type in (N'U'))
        BEGIN
            PRINT 'Vinculando ven_detapedidos con ven_pedidos por numped...';
            EXEC('UPDATE dp SET dp.pedido_id = p.id FROM ven_detapedidos dp JOIN ven_pedidos p ON LTRIM(RTRIM(dp.numped)) = LTRIM(RTRIM(p.numped)) WHERE dp.pedido_id IS NULL');
        END
    END
END

-- 3. TABLA ven_cotizacion
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_cotizacion]') AND type in (N'U'))
BEGIN
    -- Agregar id si falta
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_cotizacion]') AND name = 'id')
    BEGIN
        PRINT 'Agregando columna id a ven_cotizacion...';
        ALTER TABLE ven_cotizacion ADD id BIGINT IDENTITY(1,1);
    END

    -- Agregar fecha si falta (mapear desde feccot)
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_cotizacion]') AND name = 'fecha')
    BEGIN
        PRINT 'Agregando columna fecha a ven_cotizacion...';
        ALTER TABLE ven_cotizacion ADD fecha DATE NULL;
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_cotizacion]') AND name = 'feccot')
        BEGIN
            EXEC('UPDATE ven_cotizacion SET fecha = CAST(feccot AS DATE) WHERE fecha IS NULL');
        END
    END

    -- Agregar fecha_vence si falta (mapear desde fecven)
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_cotizacion]') AND name = 'fecha_vence')
    BEGIN
        PRINT 'Agregando columna fecha_vence a ven_cotizacion...';
        ALTER TABLE ven_cotizacion ADD fecha_vence DATE NULL;
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_cotizacion]') AND name = 'fecven')
        BEGIN
            EXEC('UPDATE ven_cotizacion SET fecha_vence = CAST(fecven AS DATE) WHERE fecha_vence IS NULL');
        END
    END

    -- Agregar estado si falta (mapear desde estcot)
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_cotizacion]') AND name = 'estado')
    BEGIN
        PRINT 'Agregando columna estado a ven_cotizacion...';
        ALTER TABLE ven_cotizacion ADD estado VARCHAR(10) NULL;
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_cotizacion]') AND name = 'estcot')
        BEGIN
            EXEC('UPDATE ven_cotizacion SET estado = estcot WHERE estado IS NULL');
        END
    END
END

-- 4. TABLA ven_detacotiz
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_detacotiz]') AND type in (N'U'))
BEGIN
    -- Agregar id si falta
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_detacotiz]') AND name = 'id')
    BEGIN
        PRINT 'Agregando columna id a ven_detacotiz...';
        ALTER TABLE ven_detacotiz ADD id BIGINT IDENTITY(1,1);
    END

    -- Agregar id_cotizacion si falta
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_detacotiz]') AND name = 'id_cotizacion')
    BEGIN
        PRINT 'Agregando columna id_cotizacion a ven_detacotiz...';
        ALTER TABLE ven_detacotiz ADD id_cotizacion BIGINT NULL;
        
        -- Intentar vincular por numcot si existe ven_cotizacion
        IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_cotizacion]') AND type in (N'U'))
        BEGIN
            PRINT 'Vinculando ven_detacotiz con ven_cotizacion por numcot...';
            EXEC('UPDATE dc SET dc.id_cotizacion = c.id FROM ven_detacotiz dc JOIN ven_cotizacion c ON LTRIM(RTRIM(dc.numcot)) = LTRIM(RTRIM(c.numcot)) WHERE dc.id_cotizacion IS NULL');
        END
    END

    -- Agregar tasa_iva si falta (mapear desde ivadet)
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_detacotiz]') AND name = 'tasa_iva')
    BEGIN
        PRINT 'Agregando columna tasa_iva a ven_detacotiz...';
        ALTER TABLE ven_detacotiz ADD tasa_iva DECIMAL(5,2) NULL;
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_detacotiz]') AND name = 'ivadet')
        BEGIN
            EXEC('UPDATE ven_detacotiz SET tasa_iva = ivadet WHERE tasa_iva IS NULL');
        END
    END

    -- Agregar valor si falta (mapear desde vundet * candet)
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_detacotiz]') AND name = 'valor')
    BEGIN
        PRINT 'Agregando columna valor a ven_detacotiz...';
        ALTER TABLE ven_detacotiz ADD valor DECIMAL(18,2) NULL;
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_detacotiz]') AND name = 'vundet') AND EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_detacotiz]') AND name = 'candet')
        BEGIN
            EXEC('UPDATE ven_detacotiz SET valor = vundet * candet WHERE valor IS NULL');
        END
    END
END

PRINT 'Correcciones de esquema completadas.';
