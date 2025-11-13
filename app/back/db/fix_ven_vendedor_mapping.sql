-- =====================================================
-- Script de Corrección de Mapeo de ven_vendedor
-- Problema: El código busca columnas que no existen
-- =====================================================

USE Prueba_ERP360;
GO

-- =====================================================
-- PROBLEMA IDENTIFICADO:
-- =====================================================
-- El código busca estas columnas:
--   - codi_emple (NO EXISTE)
--   - nomb_emple (NO EXISTE)
--   - codi_labor (NO EXISTE)
--   - cedula (NO EXISTE)
--   - email (NO EXISTE)
--
-- Pero la tabla tiene:
--   - id (INT)
--   - ideven (INT) - ID del empleado
--   - codven (CHAR(3)) - Código del vendedor
--   - nomven (CHAR(50)) - Nombre del vendedor
--   - Activo (BIT) - Estado activo
--   - codalm (CHAR(3)) - Almacén
--   - telven, celven, dirven, codusu
--
-- =====================================================
-- SOLUCIÓN 1: CREAR VISTA CON ALIASES (RECOMENDADO)
-- =====================================================

-- Eliminar vista si existe
IF EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N'[dbo].[v_ven_vendedor]'))
    DROP VIEW v_ven_vendedor;
GO

-- Crear vista con mapeo de columnas
CREATE VIEW v_ven_vendedor AS
SELECT 
    -- Mapeo de IDs
    CAST(ideven AS VARCHAR(20)) as codi_emple,  -- Usar ideven como codi_emple
    codven as codigoVendedor,                    -- Código del vendedor
    codven as codigo,                            -- Alias para compatibilidad
    
    -- Mapeo de nombres
    LTRIM(RTRIM(nomven)) as nomb_emple,         -- Nombre del empleado
    LTRIM(RTRIM(nomven)) as nombreCompleto,     -- Nombre completo
    LTRIM(RTRIM(nomven)) as primerNombre,       -- Primer nombre (temporal)
    
    -- Mapeo de datos adicionales
    CAST(ideven AS VARCHAR(20)) as cedula,      -- Usar ideven como cédula (temporal)
    CAST(ideven AS VARCHAR(20)) as numeroDocumento, -- Alias para cedula
    '' as email,                                 -- Email no existe, usar vacío
    CAST(id AS INT) as id,                       -- ID interno
    CAST(ideven AS VARCHAR(20)) as codiEmple,   -- Alias para codi_emple
    
    -- Mapeo de estado
    CAST(Activo AS INT) as activo,              -- Convertir BIT a INT
    Activo as activoBit,                        -- Mantener BIT original
    
    -- Mapeo de otros campos
    codalm as codalm,                           -- Almacén
    dirven as direccion,                        -- Dirección
    telven as telefono,                         -- Teléfono
    celven as celular,                          -- Celular
    codusu as codigoUsuario,                    -- Código de usuario
    
    -- Campos adicionales
    codigo_caja as codigoCaja,                  -- Código de caja
    CAST(cajero AS BIT) as esCajero,            -- Es cajero
    CAST(Tecnico AS BIT) as esTecnico,          -- Es técnico
    CAST(cobrador AS BIT) as esCobrador,        -- Es cobrador
    
    -- Campos para compatibilidad con frontend
    1 as empresaId                              -- Default empresa ID
FROM ven_vendedor;
GO

PRINT 'Vista v_ven_vendedor creada exitosamente';
GO

-- =====================================================
-- SOLUCIÓN 2: AGREGAR COLUMNAS FALTANTES (ALTERNATIVA)
-- =====================================================
-- Si prefieres agregar las columnas directamente a la tabla:

-- Verificar si existe columna codi_emple
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_vendedor]') AND name = 'codi_emple')
BEGIN
    PRINT 'Agregando columnas faltantes a ven_vendedor...';
    
    -- Agregar codi_emple (usar ideven como base)
    ALTER TABLE ven_vendedor
    ADD codi_emple AS CAST(ideven AS VARCHAR(20)) PERSISTED;
    
    -- Agregar nomb_emple (usar nomven como base)
    ALTER TABLE ven_vendedor
    ADD nomb_emple AS LTRIM(RTRIM(nomven)) PERSISTED;
    
    -- Agregar codi_labor (usar codven como base, o crear nueva)
    ALTER TABLE ven_vendedor
    ADD codi_labor AS codven PERSISTED;
    
    -- Agregar cedula (usar ideven como base)
    ALTER TABLE ven_vendedor
    ADD cedula AS CAST(ideven AS VARCHAR(20)) PERSISTED;
    
    -- Agregar email (vacío por defecto)
    ALTER TABLE ven_vendedor
    ADD email VARCHAR(100) NULL DEFAULT '';
    
    PRINT 'Columnas agregadas a ven_vendedor';
END
ELSE
BEGIN
    PRINT 'Las columnas ya existen en ven_vendedor';
END
GO

-- =====================================================
-- VERIFICAR ESTRUCTURA
-- =====================================================

PRINT '=====================================================';
PRINT 'Estructura de ven_vendedor después de los cambios:';
PRINT '=====================================================';

SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ven_vendedor'
ORDER BY ORDINAL_POSITION;

PRINT '=====================================================';
PRINT 'Vista v_ven_vendedor disponible para uso';
PRINT '=====================================================';
PRINT '';
PRINT 'RECOMENDACIÓN:';
PRINT '  - Opción 1: Usar la vista v_ven_vendedor en las consultas';
PRINT '  - Opción 2: Actualizar el código para usar las columnas reales';
PRINT '  - Opción 3: Usar las columnas calculadas (PERSISTED) agregadas';
PRINT '=====================================================';

