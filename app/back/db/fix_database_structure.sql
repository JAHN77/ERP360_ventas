-- =====================================================
-- Script de Corrección de Estructura de Base de Datos
-- Base de Datos: Prueba_ERP360
-- Fecha: 2024-11-10
-- =====================================================
-- Este script corrige las discrepancias identificadas
-- entre la estructura de la BD y lo que el código espera
-- =====================================================

USE Prueba_ERP360;
GO

-- =====================================================
-- 1. CREAR TABLAS FALTANTES
-- =====================================================

-- 1.1 Tabla ven_pedidos (CRÍTICO - NO EXISTE)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_pedidos]') AND type in (N'U'))
BEGIN
    PRINT 'Creando tabla ven_pedidos...';
    CREATE TABLE ven_pedidos (
        id INT PRIMARY KEY IDENTITY(1,1),
        numero_pedido VARCHAR(50) UNIQUE NOT NULL,
        fecha_pedido DATE NOT NULL,
        fecha_entrega_estimada DATE,
        cliente_id VARCHAR(20) NOT NULL, -- codter del cliente
        vendedor_id VARCHAR(20), -- codi_emple del vendedor
        cotizacion_id BIGINT, -- Si viene de cotización (BIGINT para compatibilidad con ven_cotizacion)
        empresa_id INT,
        codalm CHAR(3), -- Bodega/Empresa
        subtotal DECIMAL(18,2) DEFAULT 0,
        descuento_valor DECIMAL(18,2) DEFAULT 0,
        iva_valor DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) DEFAULT 0,
        impoconsumo_valor DECIMAL(18,2) DEFAULT 0,
        observaciones TEXT,
        instrucciones_entrega TEXT,
        estado VARCHAR(20) DEFAULT 'BORRADOR', -- BORRADOR, CONFIRMADO, EN_PROCESO, PARCIALMENTE_REMITIDO, REMITIDO, CANCELADO
        lista_precio_id VARCHAR(50),
        descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
        iva_porcentaje DECIMAL(5,2) DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME,
        created_by INT
    );
    PRINT 'Tabla ven_pedidos creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Tabla ven_pedidos ya existe';
END
GO

-- 1.2 Tabla transportadoras (CRÍTICO - NO EXISTE)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[transportadoras]') AND type in (N'U'))
BEGIN
    PRINT 'Creando tabla transportadoras...';
    CREATE TABLE transportadoras (
        id VARCHAR(36) PRIMARY KEY, -- UUID
        nombre VARCHAR(100) NOT NULL,
        nit_identificacion VARCHAR(20),
        activo BIT DEFAULT 1,
        empresa_id INT,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME
    );
    PRINT 'Tabla transportadoras creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Tabla transportadoras ya existe';
END
GO

-- 1.3 Tabla archivos_adjuntos (OPCIONAL - NO EXISTE)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[archivos_adjuntos]') AND type in (N'U'))
BEGIN
    PRINT 'Creando tabla archivos_adjuntos...';
    CREATE TABLE archivos_adjuntos (
        id VARCHAR(36) PRIMARY KEY, -- UUID
        entidad_id VARCHAR(50) NOT NULL,
        entidad_tipo VARCHAR(20) NOT NULL, -- REMISION, FACTURA, COTIZACION, PEDIDO, NOTA_CREDITO
        nombre_archivo VARCHAR(255) NOT NULL,
        ruta_storage VARCHAR(500) NOT NULL,
        mime_type VARCHAR(100),
        size_bytes BIGINT,
        empresa_id INT,
        created_at DATETIME DEFAULT GETDATE(),
        created_by INT
    );
    PRINT 'Tabla archivos_adjuntos creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Tabla archivos_adjuntos ya existe';
END
GO

-- 1.4 Tabla tipos_persona (OPCIONAL - NO EXISTE)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tipos_persona]') AND type in (N'U'))
BEGIN
    PRINT 'Creando tabla tipos_persona...';
    CREATE TABLE tipos_persona (
        id VARCHAR(10) PRIMARY KEY,
        codigo VARCHAR(10) UNIQUE NOT NULL,
        nombre VARCHAR(50) NOT NULL,
        activo BIT DEFAULT 1
    );
    -- Insertar datos básicos
    INSERT INTO tipos_persona (id, codigo, nombre, activo) VALUES
        ('1', '1', 'Persona Natural', 1),
        ('2', '2', 'Persona Jurídica', 1);
    PRINT 'Tabla tipos_persona creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Tabla tipos_persona ya existe';
END
GO

-- =====================================================
-- 2. ADAPTAR TABLA ven_detapedidos
-- =====================================================
-- Nota: La tabla existe pero tiene estructura antigua
-- Opción 1: Agregar columnas nuevas si no existen
-- Opción 2: Crear tabla nueva (recomendado si hay datos críticos)

-- Verificar si existen las columnas nuevas
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_detapedidos]') AND name = 'pedido_id')
BEGIN
    PRINT 'Agregando columnas a ven_detapedidos...';
    ALTER TABLE ven_detapedidos
    ADD pedido_id INT NULL,
        producto_id INT NULL,
        precio_unitario DECIMAL(18,2) NULL,
        descuento_porcentaje DECIMAL(5,2) NULL,
        iva_porcentaje DECIMAL(5,2) NULL,
        descripcion VARCHAR(255) NULL,
        subtotal DECIMAL(18,2) NULL,
        valor_iva DECIMAL(18,2) NULL,
        total DECIMAL(18,2) NULL;
    PRINT 'Columnas agregadas a ven_detapedidos';
END
ELSE
BEGIN
    PRINT 'Columnas ya existen en ven_detapedidos';
END
GO

-- =====================================================
-- 3. ADAPTAR TABLA ven_recibos (Remisiones)
-- =====================================================
-- Agregar columnas faltantes para remisiones

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_recibos]') AND name = 'numero_remision')
BEGIN
    PRINT 'Agregando columnas a ven_recibos...';
    ALTER TABLE ven_recibos
    ADD numero_remision VARCHAR(50) NULL,
        fecha_remision DATE NULL,
        fecha_despacho DATE NULL,
        pedido_id INT NULL,
        factura_id INT NULL,
        cliente_id VARCHAR(20) NULL, -- Para compatibilidad con codter
        vendedor_id VARCHAR(20) NULL, -- Para compatibilidad
        empresa_id INT NULL,
        subtotal DECIMAL(18,2) NULL,
        descuento_valor DECIMAL(18,2) NULL,
        iva_valor DECIMAL(18,2) NULL,
        total DECIMAL(18,2) NULL,
        observaciones TEXT NULL,
        estado VARCHAR(20) NULL,
        estado_envio VARCHAR(10) NULL,
        metodo_envio VARCHAR(30) NULL,
        transportadora_id VARCHAR(36) NULL,
        transportadora VARCHAR(100) NULL,
        numero_guia VARCHAR(50) NULL;
    PRINT 'Columnas agregadas a ven_recibos';
END
ELSE
BEGIN
    PRINT 'Columnas ya existen en ven_recibos';
END
GO

-- =====================================================
-- 4. CREAR TABLA ven_detarecibo_productos
-- =====================================================
-- La tabla ven_detarecibo actual es para pagos, no para productos
-- Crear tabla separada para detalle de productos en remisiones

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_detarecibo_productos]') AND type in (N'U'))
BEGIN
    PRINT 'Creando tabla ven_detarecibo_productos...';
    CREATE TABLE ven_detarecibo_productos (
        id INT PRIMARY KEY IDENTITY(1,1),
        remision_id INT NOT NULL,
        producto_id INT NOT NULL,
        codins CHAR(8) NULL, -- Para compatibilidad
        cantidad DECIMAL(18,2) NOT NULL,
        precio_unitario DECIMAL(18,2) NOT NULL,
        descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
        iva_porcentaje DECIMAL(5,2) DEFAULT 0,
        descripcion VARCHAR(255),
        subtotal DECIMAL(18,2) DEFAULT 0,
        valor_iva DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla ven_detarecibo_productos creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Tabla ven_detarecibo_productos ya existe';
END
GO

-- =====================================================
-- 5. CORREGIR ven_detacotizacion.cod_producto
-- =====================================================
-- El código inserta INT (id de producto) pero la BD espera CHAR(8) (codins)
-- Opción 1: Cambiar tipo de columna a INT (recomendado)
-- Opción 2: Mantener CHAR(8) y cambiar código para usar codins

-- Verificar tipo actual
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_detacotizacion]') AND name = 'cod_producto')
BEGIN
    DECLARE @CurrentType NVARCHAR(50);
    SELECT @CurrentType = TYPE_NAME(system_type_id) 
    FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[ven_detacotizacion]') 
    AND name = 'cod_producto';
    
    IF @CurrentType = 'char' OR @CurrentType = 'varchar'
    BEGIN
        PRINT 'Cambiando tipo de cod_producto de ' + @CurrentType + ' a INT...';
        -- Nota: Esto requiere que la tabla esté vacía o hacer migración de datos
        -- ALTER TABLE ven_detacotizacion ALTER COLUMN cod_producto INT;
        PRINT 'IMPORTANTE: Revisar si hay datos antes de cambiar el tipo';
    END
    ELSE
    BEGIN
        PRINT 'cod_producto ya es de tipo ' + @CurrentType;
    END
END
GO

-- =====================================================
-- 6. CREAR VISTAS PARA FACILITAR MAPEO
-- =====================================================

-- 6.1 Vista para ven_facturas (mapeo de columnas)
IF EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N'[dbo].[v_ven_facturas]'))
    DROP VIEW v_ven_facturas;
GO

CREATE VIEW v_ven_facturas AS
SELECT 
    ID as id,
    numfact as numero_factura,
    fecfac as fecha_factura,
    venfac as fecha_vencimiento,
    codter as cliente_id,
    codven as vendedor_id,
    NULL as remision_id,
    NULL as pedido_id,
    valvta as subtotal,
    valdcto as descuento_valor,
    valiva as iva_valor,
    netfac as total,
    Observa as observaciones,
    estfac as estado,
    CUFE as cufe,
    NULL as empresa_id,
    NULL as fecha_timbrado
FROM ven_facturas;
GO

PRINT 'Vista v_ven_facturas creada';
GO

-- 6.2 Vista para ven_detafact (mapeo de columnas)
IF EXISTS (SELECT * FROM sys.views WHERE object_id = OBJECT_ID(N'[dbo].[v_ven_detafact]'))
    DROP VIEW v_ven_detafact;
GO

CREATE VIEW v_ven_detafact AS
SELECT 
    ID as id,
    id_factura as factura_id,
    NULL as producto_id, -- Necesita mapeo de codins a id
    codins,
    qtyins as cantidad,
    PRECIOUND as precio_unitario,
    desins as descuento_porcentaje,
    NULL as iva_porcentaje, -- Calcular desde ivains
    observa as descripcion,
    valins as subtotal,
    ivains as valor_iva,
    (valins + ISNULL(ivains, 0)) as total
FROM ven_detafact;
GO

PRINT 'Vista v_ven_detafact creada';
GO

-- =====================================================
-- 7. CREAR ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

-- Índices para ven_pedidos
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_pedidos_fecha' AND object_id = OBJECT_ID('ven_pedidos'))
    CREATE INDEX idx_pedidos_fecha ON ven_pedidos(fecha_pedido);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_pedidos_estado' AND object_id = OBJECT_ID('ven_pedidos'))
    CREATE INDEX idx_pedidos_estado ON ven_pedidos(estado);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_pedidos_cliente' AND object_id = OBJECT_ID('ven_pedidos'))
    CREATE INDEX idx_pedidos_cliente ON ven_pedidos(cliente_id);
GO

-- Índices para transportadoras
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_transportadoras_activo' AND object_id = OBJECT_ID('transportadoras'))
    CREATE INDEX idx_transportadoras_activo ON transportadoras(activo);
GO

-- Índices para ven_detarecibo_productos
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_detarecibo_remision' AND object_id = OBJECT_ID('ven_detarecibo_productos'))
    CREATE INDEX idx_detarecibo_remision ON ven_detarecibo_productos(remision_id);
GO

PRINT 'Índices creados';
GO

-- =====================================================
-- 8. POBLAR TABLAS DE CATÁLOGOS VACÍAS
-- =====================================================

-- 8.1 Dian_tipodocumento
IF NOT EXISTS (SELECT * FROM Dian_tipodocumento)
BEGIN
    PRINT 'Poblando Dian_tipodocumento...';
    INSERT INTO Dian_tipodocumento (Tipdoc, Nomdoc, Razon) VALUES
        ('11', 'Registro Civil', 0),
        ('12', 'Tarjeta de Identidad', 0),
        ('13', 'Cédula de Ciudadanía', 0),
        ('21', 'Tarjeta de Extranjería', 0),
        ('22', 'Cédula de Extranjería', 0),
        ('31', 'NIT', 1),
        ('41', 'Pasaporte', 0),
        ('42', 'Documento de Identificación Extranjero', 0),
        ('43', 'Sin Identificación del Exterior', 0),
        ('91', 'NUIP', 0);
    PRINT 'Dian_tipodocumento poblada';
END
GO

-- 8.2 Dian_Regimenes
IF NOT EXISTS (SELECT * FROM Dian_Regimenes)
BEGIN
    PRINT 'Poblando Dian_Regimenes...';
    INSERT INTO Dian_Regimenes (codigo, nombre) VALUES
        (1, 'Simplificado'),
        (2, 'Común'),
        (3, 'Gran Contribuyente'),
        (4, 'Autorretenedor'),
        (5, 'Agente de Retención IVA');
    PRINT 'Dian_Regimenes poblada';
END
GO

-- 8.3 inv_categorias (ejemplo básico)
IF NOT EXISTS (SELECT * FROM inv_categorias)
BEGIN
    PRINT 'Poblando inv_categorias...';
    INSERT INTO inv_categorias (id, nombre) VALUES
        (1, 'General'),
        (2, 'Electrónica'),
        (3, 'Ropa'),
        (4, 'Alimentos');
    PRINT 'inv_categorias poblada';
END
GO

-- =====================================================
-- 9. RESUMEN DE CAMBIOS
-- =====================================================

PRINT '=====================================================';
PRINT 'Script de corrección completado';
PRINT '=====================================================';
PRINT 'Tablas creadas:';
PRINT '  - ven_pedidos (CRÍTICO)';
PRINT '  - transportadoras (CRÍTICO)';
PRINT '  - archivos_adjuntos (OPCIONAL)';
PRINT '  - tipos_persona (OPCIONAL)';
PRINT '  - ven_detarecibo_productos (NUEVA)';
PRINT '=====================================================';
PRINT 'Vistas creadas:';
PRINT '  - v_ven_facturas';
PRINT '  - v_ven_detafact';
PRINT '=====================================================';
PRINT 'Columnas agregadas:';
PRINT '  - ven_detapedidos (columnas nuevas)';
PRINT '  - ven_recibos (columnas nuevas)';
PRINT '=====================================================';
PRINT 'IMPORTANTE:';
PRINT '  1. Revisar si hay datos antes de modificar tipos de columnas';
PRINT '  2. Verificar que las Foreign Keys sean correctas';
PRINT '  3. Probar las funcionalidades una por una';
PRINT '  4. Hacer backup antes de aplicar en producción';
PRINT '=====================================================';

