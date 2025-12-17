-- =====================================================
-- Script de Creación de Base de Datos ERP360
-- Sistema ERP360 Comercial
-- =====================================================
-- Este script crea todas las tablas necesarias para
-- la aplicación ERP360 Comercial
-- =====================================================

USE ERP360;
GO

-- =====================================================
-- 1. TABLAS MAESTRAS (Catálogos)
-- =====================================================

-- Tabla de Departamentos
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[gen_departamentos]') AND type in (N'U'))
BEGIN
    CREATE TABLE gen_departamentos (
        id INT PRIMARY KEY IDENTITY(1,1),
        codigo VARCHAR(10) UNIQUE NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        activo BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME
    );
    PRINT 'Tabla gen_departamentos creada exitosamente';
END
GO

-- Tabla de Municipios (Ciudades)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[gen_municipios]') AND type in (N'U'))
BEGIN
    CREATE TABLE gen_municipios (
        id INT PRIMARY KEY IDENTITY(1,1),
        codigo VARCHAR(10) UNIQUE NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        departamento_id INT,
        coddane VARCHAR(10),
        activo BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME,
        FOREIGN KEY (departamento_id) REFERENCES gen_departamentos(id)
    );
    PRINT 'Tabla gen_municipios creada exitosamente';
END
GO

-- Tabla de Tipos de Documento (DIAN)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Dian_tipodocumento]') AND type in (N'U'))
BEGIN
    CREATE TABLE Dian_tipodocumento (
        id VARCHAR(10) PRIMARY KEY,
        codigo VARCHAR(10) UNIQUE NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        activo BIT DEFAULT 1
    );
    PRINT 'Tabla Dian_tipodocumento creada exitosamente';
END
GO

-- Tabla de Tipos de Persona
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tipos_persona]') AND type in (N'U'))
BEGIN
    CREATE TABLE tipos_persona (
        id VARCHAR(10) PRIMARY KEY,
        codigo VARCHAR(10) UNIQUE NOT NULL,
        nombre VARCHAR(50) NOT NULL,
        activo BIT DEFAULT 1
    );
    PRINT 'Tabla tipos_persona creada exitosamente';
END
GO

-- Tabla de Régimenes Fiscales (DIAN)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Dian_Regimenes]') AND type in (N'U'))
BEGIN
    CREATE TABLE Dian_Regimenes (
        id VARCHAR(10) PRIMARY KEY,
        codigo VARCHAR(10) UNIQUE NOT NULL,
        nombre VARCHAR(200) NOT NULL,
        activo BIT DEFAULT 1
    );
    PRINT 'Tabla Dian_Regimenes creada exitosamente';
END
GO

-- Tabla de Medidas
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[inv_medidas]') AND type in (N'U'))
BEGIN
    CREATE TABLE inv_medidas (
        id INT PRIMARY KEY IDENTITY(1,1),
        codigo VARCHAR(10) UNIQUE NOT NULL,
        codmed VARCHAR(10) UNIQUE NOT NULL, -- Alias para compatibilidad
        nombre VARCHAR(50) NOT NULL,
        nommed VARCHAR(50) NOT NULL, -- Alias para compatibilidad
        abreviatura VARCHAR(10) NOT NULL,
        activo BIT DEFAULT 1
    );
    PRINT 'Tabla inv_medidas creada exitosamente';
END
GO

-- Tabla de Categorías
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[inv_categorias]') AND type in (N'U'))
BEGIN
    CREATE TABLE inv_categorias (
        id INT PRIMARY KEY IDENTITY(1,1),
        codigo VARCHAR(10),
        nombre VARCHAR(100) NOT NULL,
        isreceta BIT DEFAULT 0,
        requiere_empaques BIT DEFAULT 0,
        estado INT DEFAULT 1,
        imgruta VARCHAR(255),
        activo BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME
    );
    PRINT 'Tabla inv_categorias creada exitosamente';
END
GO

-- Tabla de Almacenes (Bodegas)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[inv_almacen]') AND type in (N'U'))
BEGIN
    CREATE TABLE inv_almacen (
        codalm VARCHAR(3) PRIMARY KEY,
        nomalm VARCHAR(100) NOT NULL,
        diralm VARCHAR(255),
        ciualm VARCHAR(100),
        activo BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME
    );
    PRINT 'Tabla inv_almacen creada exitosamente';
END
GO

-- Tabla de Vendedores
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_vendedor]') AND type in (N'U'))
BEGIN
    CREATE TABLE ven_vendedor (
        codi_emple VARCHAR(20) PRIMARY KEY,
        cedula VARCHAR(20) UNIQUE NOT NULL,
        nomb_emple VARCHAR(100) NOT NULL,
        NOMB_EMPLE AS nomb_emple, -- Columna calculada para compatibilidad
        codi_labor VARCHAR(20),
        email VARCHAR(100),
        activo BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME
    );
    PRINT 'Tabla ven_vendedor creada exitosamente';
END
GO

-- Tabla de Transportadoras
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[transportadoras]') AND type in (N'U'))
BEGIN
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
GO

-- =====================================================
-- 2. TABLAS DE ENTIDADES PRINCIPALES
-- =====================================================

-- Tabla de Terceros (Clientes/Proveedores)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[con_terceros]') AND type in (N'U'))
BEGIN
    CREATE TABLE con_terceros (
        id INT PRIMARY KEY IDENTITY(1,1),
        codter VARCHAR(20) UNIQUE NOT NULL, -- Número de documento
        tipter INT NOT NULL DEFAULT 1, -- 1: Natural, 2: Jurídica
        nomter VARCHAR(200) NOT NULL, -- Razón social o nombre completo
        -- Persona Natural
        nom1 VARCHAR(50),
        nom2 VARCHAR(50),
        apl1 VARCHAR(50),
        apl2 VARCHAR(50),
        -- Contacto
        dirter VARCHAR(255),
        TELTER VARCHAR(20),
        CELTER VARCHAR(20),
        EMAIL VARCHAR(100),
        ciudad VARCHAR(100),
        coddane VARCHAR(10), -- Código DANE
        -- Comercial
        codven VARCHAR(20), -- Vendedor asignado
        cupo_credito DECIMAL(18,2) DEFAULT 0,
        plazo INT DEFAULT 0, -- Días de crédito
        tasa_descuento DECIMAL(5,2) DEFAULT 0,
        Forma_pago VARCHAR(50),
        regimen_tributario VARCHAR(100),
        contacto VARCHAR(100),
        -- Estado
        activo BIT DEFAULT 1,
        fecing DATETIME DEFAULT GETDATE(), -- Fecha ingreso
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME,
        FOREIGN KEY (codven) REFERENCES ven_vendedor(codi_emple)
    );
    PRINT 'Tabla con_terceros creada exitosamente';
END
GO

-- Tabla de Insumos (Productos)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[inv_insumos]') AND type in (N'U'))
BEGIN
    CREATE TABLE inv_insumos (
        id INT PRIMARY KEY IDENTITY(1,1),
        codins VARCHAR(50) UNIQUE NOT NULL, -- Código interno
        nomins VARCHAR(200) NOT NULL,
        referencia VARCHAR(100),
        -- Clasificación
        codigo_linea VARCHAR(20),
        codigo_sublinea VARCHAR(20),
        Codigo_Medida VARCHAR(10), -- Referencia a inv_medidas
        undins VARCHAR(20), -- Unidad de medida
        -- Costos y Precios
        ultimo_costo DECIMAL(18,2) DEFAULT 0,
        costo_promedio DECIMAL(18,2) DEFAULT 0,
        precio_publico DECIMAL(18,2) DEFAULT 0,
        precio_mayorista DECIMAL(18,2) DEFAULT 0,
        precio_minorista DECIMAL(18,2) DEFAULT 0,
        MARGEN_VENTA DECIMAL(5,2) DEFAULT 0,
        -- Impuestos
        tasa_iva DECIMAL(5,2) DEFAULT 0,
        -- Inventario
        karins BIT DEFAULT 0, -- Controla existencia
        -- Estado
        activo BIT DEFAULT 1,
        fecsys DATETIME DEFAULT GETDATE(),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME
    );
    PRINT 'Tabla inv_insumos creada exitosamente';
END
GO

-- Tabla de Inventario por Bodega
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[inv_invent]') AND type in (N'U'))
BEGIN
    CREATE TABLE inv_invent (
        id INT PRIMARY KEY IDENTITY(1,1),
        codins VARCHAR(50) NOT NULL,
        codalm VARCHAR(3) NOT NULL,
        ucoins DECIMAL(18,2) DEFAULT 0, -- Unidades en existencia
        valinv DECIMAL(18,2) DEFAULT 0, -- Valor de inventario
        ultima_actualizacion DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (codins) REFERENCES inv_insumos(codins),
        FOREIGN KEY (codalm) REFERENCES inv_almacen(codalm),
        UNIQUE (codins, codalm)
    );
    PRINT 'Tabla inv_invent creada exitosamente';
END
GO

-- =====================================================
-- 3. TABLAS DE DOCUMENTOS COMERCIALES
-- =====================================================

-- Tabla de Cotizaciones (Encabezado)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_cotizacion]') AND type in (N'U'))
BEGIN
    CREATE TABLE ven_cotizacion (
        id INT PRIMARY KEY IDENTITY(1,1),
        numcot VARCHAR(50) UNIQUE NOT NULL,
        fecha DATE NOT NULL,
        fecha_vence DATE NOT NULL,
        codter VARCHAR(20) NOT NULL,
        cod_vendedor VARCHAR(20),
        codalm VARCHAR(3) NOT NULL, -- Bodega/Empresa
        subtotal DECIMAL(18,2) DEFAULT 0,
        val_descuento DECIMAL(18,2) DEFAULT 0,
        val_iva DECIMAL(18,2) DEFAULT 0,
        observa TEXT,
        estado CHAR(1) DEFAULT 'B', -- B: Borrador, E: Enviada, A: Aprobada, R: Rechazada, V: Vencida
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME,
        created_by INT,
        FOREIGN KEY (codter) REFERENCES con_terceros(codter),
        FOREIGN KEY (cod_vendedor) REFERENCES ven_vendedor(codi_emple),
        FOREIGN KEY (codalm) REFERENCES inv_almacen(codalm)
    );
    PRINT 'Tabla ven_cotizacion creada exitosamente';
END
GO

-- Tabla de Detalle de Cotizaciones
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_detacotizacion]') AND type in (N'U'))
BEGIN
    CREATE TABLE ven_detacotizacion (
        id INT PRIMARY KEY IDENTITY(1,1),
        id_cotizacion INT NOT NULL,
        cod_producto INT NOT NULL, -- Referencia a inv_insumos.id
        cantidad DECIMAL(18,2) NOT NULL,
        preciound DECIMAL(18,2) NOT NULL,
        tasa_descuento DECIMAL(5,2) DEFAULT 0,
        tasa_iva DECIMAL(5,2) DEFAULT 0,
        valor DECIMAL(18,2) NOT NULL, -- Total del item
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (id_cotizacion) REFERENCES ven_cotizacion(id) ON DELETE CASCADE,
        FOREIGN KEY (cod_producto) REFERENCES inv_insumos(id)
    );
    PRINT 'Tabla ven_detacotizacion creada exitosamente';
END
GO

-- Tabla de Pedidos (Encabezado)
-- NOTA: Según el código, la tabla se llama ven_detapedidos pero parece ser el encabezado
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_pedidos]') AND type in (N'U'))
BEGIN
    CREATE TABLE ven_pedidos (
        id INT PRIMARY KEY IDENTITY(1,1),
        numero_pedido VARCHAR(50) UNIQUE NOT NULL,
        fecha_pedido DATE NOT NULL,
        fecha_entrega_estimada DATE,
        cliente_id VARCHAR(20) NOT NULL, -- codter del cliente
        vendedor_id VARCHAR(20), -- codi_emple del vendedor
        cotizacion_id INT, -- Si viene de cotización
        empresa_id INT,
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
        created_by INT,
        FOREIGN KEY (cliente_id) REFERENCES con_terceros(codter),
        FOREIGN KEY (vendedor_id) REFERENCES ven_vendedor(codi_emple),
        FOREIGN KEY (cotizacion_id) REFERENCES ven_cotizacion(id)
    );
    PRINT 'Tabla ven_pedidos creada exitosamente';
END
GO

-- Tabla de Detalle de Pedidos
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_detapedidos]') AND type in (N'U'))
BEGIN
    CREATE TABLE ven_detapedidos (
        id INT PRIMARY KEY IDENTITY(1,1),
        pedido_id INT NOT NULL,
        producto_id INT NOT NULL,
        cantidad DECIMAL(18,2) NOT NULL,
        precio_unitario DECIMAL(18,2) NOT NULL,
        descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
        iva_porcentaje DECIMAL(5,2) DEFAULT 0,
        descripcion VARCHAR(255),
        subtotal DECIMAL(18,2) DEFAULT 0,
        valor_iva DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (pedido_id) REFERENCES ven_pedidos(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES inv_insumos(id)
    );
    PRINT 'Tabla ven_detapedidos creada exitosamente';
END
GO

-- Tabla de Remisiones (Encabezado)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_recibos]') AND type in (N'U'))
BEGIN
    CREATE TABLE ven_recibos (
        id INT PRIMARY KEY IDENTITY(1,1),
        numero_remision VARCHAR(50) UNIQUE NOT NULL,
        fecha_remision DATE NOT NULL,
        fecha_despacho DATE,
        pedido_id INT,
        factura_id INT,
        cliente_id VARCHAR(20) NOT NULL, -- codter del cliente
        vendedor_id VARCHAR(20), -- codi_emple del vendedor
        empresa_id INT,
        subtotal DECIMAL(18,2) DEFAULT 0,
        descuento_valor DECIMAL(18,2) DEFAULT 0,
        iva_valor DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) DEFAULT 0,
        observaciones TEXT,
        estado VARCHAR(20) DEFAULT 'BORRADOR', -- BORRADOR, EN_TRANSITO, ENTREGADO, CANCELADO
        estado_envio VARCHAR(10) DEFAULT 'Total', -- Total, Parcial
        metodo_envio VARCHAR(30), -- transportadoraExterna, transportePropio, recogeCliente
        transportadora_id VARCHAR(36),
        transportadora VARCHAR(100), -- Nombre de transportadora (para compatibilidad)
        numero_guia VARCHAR(50),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME,
        created_by INT,
        FOREIGN KEY (cliente_id) REFERENCES con_terceros(codter),
        FOREIGN KEY (vendedor_id) REFERENCES ven_vendedor(codi_emple),
        FOREIGN KEY (pedido_id) REFERENCES ven_pedidos(id),
        FOREIGN KEY (transportadora_id) REFERENCES transportadoras(id)
    );
    PRINT 'Tabla ven_recibos creada exitosamente';
END
GO

-- Tabla de Detalle de Remisiones
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_detarecibo]') AND type in (N'U'))
BEGIN
    CREATE TABLE ven_detarecibo (
        id INT PRIMARY KEY IDENTITY(1,1),
        remision_id INT NOT NULL,
        producto_id INT NOT NULL,
        cantidad DECIMAL(18,2) NOT NULL,
        precio_unitario DECIMAL(18,2) NOT NULL,
        descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
        iva_porcentaje DECIMAL(5,2) DEFAULT 0,
        descripcion VARCHAR(255),
        subtotal DECIMAL(18,2) DEFAULT 0,
        valor_iva DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (remision_id) REFERENCES ven_recibos(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES inv_insumos(id)
    );
    PRINT 'Tabla ven_detarecibo creada exitosamente';
END
GO

-- Tabla de Seguimiento de Remisiones
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_remision_seguimiento]') AND type in (N'U'))
BEGIN
    CREATE TABLE ven_remision_seguimiento (
        id INT PRIMARY KEY IDENTITY(1,1),
        remision_id INT NOT NULL,
        estado_anterior VARCHAR(20),
        estado_nuevo VARCHAR(20) NOT NULL,
        fecha_cambio DATETIME DEFAULT GETDATE(),
        usuario_id INT,
        usuario_nombre VARCHAR(100),
        observaciones TEXT,
        ubicacion VARCHAR(200), -- Ubicación/checkpoint del envío
        latitud DECIMAL(10, 8), -- Coordenadas GPS (opcional)
        longitud DECIMAL(11, 8), -- Coordenadas GPS (opcional)
        evidencia_url VARCHAR(500), -- URL de foto/evidencia
        codigo_rastreo VARCHAR(100), -- Código de rastreo de transportadora
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (remision_id) REFERENCES ven_recibos(id) ON DELETE CASCADE
    );
    PRINT 'Tabla ven_remision_seguimiento creada exitosamente';
END
GO

-- Tabla de Facturas (Encabezado)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_facturas]') AND type in (N'U'))
BEGIN
    CREATE TABLE ven_facturas (
        id INT PRIMARY KEY IDENTITY(1,1),
        numero_factura VARCHAR(50) UNIQUE NOT NULL,
        fecha_factura DATE NOT NULL,
        fecha_vencimiento DATE,
        cliente_id VARCHAR(20) NOT NULL, -- codter del cliente
        vendedor_id VARCHAR(20), -- codi_emple del vendedor
        remision_id INT,
        pedido_id INT,
        empresa_id INT,
        subtotal DECIMAL(18,2) DEFAULT 0,
        descuento_valor DECIMAL(18,2) DEFAULT 0,
        iva_valor DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) DEFAULT 0,
        observaciones TEXT,
        estado VARCHAR(20) DEFAULT 'BORRADOR', -- BORRADOR, ENVIADA, ACEPTADA, RECHAZADA, ANULADA
        estado_devolucion VARCHAR(20), -- DEVOLUCION_PARCIAL, DEVOLUCION_TOTAL
        -- Facturación Electrónica
        cufe VARCHAR(100),
        fecha_timbrado DATETIME,
        estado_dian VARCHAR(20), -- Transmitido, PENDIENTE, Error
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME,
        created_by INT,
        FOREIGN KEY (cliente_id) REFERENCES con_terceros(codter),
        FOREIGN KEY (vendedor_id) REFERENCES ven_vendedor(codi_emple),
        FOREIGN KEY (remision_id) REFERENCES ven_recibos(id),
        FOREIGN KEY (pedido_id) REFERENCES ven_pedidos(id)
    );
    PRINT 'Tabla ven_facturas creada exitosamente';
END
GO

-- Tabla de Detalle de Facturas
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_detafact]') AND type in (N'U'))
BEGIN
    CREATE TABLE ven_detafact (
        id INT PRIMARY KEY IDENTITY(1,1),
        factura_id INT NOT NULL,
        producto_id INT NOT NULL,
        cantidad DECIMAL(18,2) NOT NULL,
        precio_unitario DECIMAL(18,2) NOT NULL,
        descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
        iva_porcentaje DECIMAL(5,2) DEFAULT 0,
        descripcion VARCHAR(255),
        subtotal DECIMAL(18,2) DEFAULT 0,
        valor_iva DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (factura_id) REFERENCES ven_facturas(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES inv_insumos(id)
    );
    PRINT 'Tabla ven_detafact creada exitosamente';
END
GO

-- Tabla de Notas de Crédito (Encabezado)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_notas]') AND type in (N'U'))
BEGIN
    CREATE TABLE ven_notas (
        id INT PRIMARY KEY IDENTITY(1,1),
        numero VARCHAR(50) UNIQUE NOT NULL,
        factura_id INT NOT NULL,
        cliente_id VARCHAR(20) NOT NULL, -- codter del cliente
        fecha_emision DATE NOT NULL,
        motivo TEXT NOT NULL,
        subtotal DECIMAL(18,2) DEFAULT 0,
        iva DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) DEFAULT 0,
        estado_dian VARCHAR(20), -- Transmitido, PENDIENTE, Error
        tipo_nota VARCHAR(20) DEFAULT 'DEVOLUCION', -- DEVOLUCION, ANULACION
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME,
        created_by INT,
        FOREIGN KEY (factura_id) REFERENCES ven_facturas(id),
        FOREIGN KEY (cliente_id) REFERENCES con_terceros(codter)
    );
    PRINT 'Tabla ven_notas creada exitosamente';
END
GO

-- Tabla de Detalle de Notas de Crédito
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_detanotas]') AND type in (N'U'))
BEGIN
    CREATE TABLE ven_detanotas (
        id INT PRIMARY KEY IDENTITY(1,1),
        nota_id INT NOT NULL,
        producto_id INT NOT NULL,
        cantidad DECIMAL(18,2) NOT NULL,
        precio_unitario DECIMAL(18,2) NOT NULL,
        descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
        iva_porcentaje DECIMAL(5,2) DEFAULT 0,
        subtotal DECIMAL(18,2) DEFAULT 0,
        valor_iva DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (nota_id) REFERENCES ven_notas(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES inv_insumos(id)
    );
    PRINT 'Tabla ven_detanotas creada exitosamente';
END
GO

-- Tabla de Archivos Adjuntos
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[archivos_adjuntos]') AND type in (N'U'))
BEGIN
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
GO

-- =====================================================
-- 4. CREAR ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

-- Índices para con_terceros
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_terceros_codter' AND object_id = OBJECT_ID('con_terceros'))
    CREATE INDEX idx_terceros_codter ON con_terceros(codter);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_terceros_activo' AND object_id = OBJECT_ID('con_terceros'))
    CREATE INDEX idx_terceros_activo ON con_terceros(activo);
GO

-- Índices para inv_insumos
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_insumos_codins' AND object_id = OBJECT_ID('inv_insumos'))
    CREATE INDEX idx_insumos_codins ON inv_insumos(codins);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_insumos_activo' AND object_id = OBJECT_ID('inv_insumos'))
    CREATE INDEX idx_insumos_activo ON inv_insumos(activo);
GO

-- Índices para inv_invent
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_invent_codins_codalm' AND object_id = OBJECT_ID('inv_invent'))
    CREATE INDEX idx_invent_codins_codalm ON inv_invent(codins, codalm);
GO

-- Índices para cotizaciones
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_cotizaciones_fecha' AND object_id = OBJECT_ID('ven_cotizacion'))
    CREATE INDEX idx_cotizaciones_fecha ON ven_cotizacion(fecha);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_cotizaciones_estado' AND object_id = OBJECT_ID('ven_cotizacion'))
    CREATE INDEX idx_cotizaciones_estado ON ven_cotizacion(estado);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_cotizaciones_cliente' AND object_id = OBJECT_ID('ven_cotizacion'))
    CREATE INDEX idx_cotizaciones_cliente ON ven_cotizacion(codter);
GO

-- Índices para pedidos
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_pedidos_fecha' AND object_id = OBJECT_ID('ven_pedidos'))
    CREATE INDEX idx_pedidos_fecha ON ven_pedidos(fecha_pedido);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_pedidos_estado' AND object_id = OBJECT_ID('ven_pedidos'))
    CREATE INDEX idx_pedidos_estado ON ven_pedidos(estado);
GO

-- Índices para facturas
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_facturas_fecha' AND object_id = OBJECT_ID('ven_facturas'))
    CREATE INDEX idx_facturas_fecha ON ven_facturas(fecha_factura);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_facturas_estado' AND object_id = OBJECT_ID('ven_facturas'))
    CREATE INDEX idx_facturas_estado ON ven_facturas(estado);
GO

-- Índices para remisiones
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_remisiones_fecha' AND object_id = OBJECT_ID('ven_recibos'))
    CREATE INDEX idx_remisiones_fecha ON ven_recibos(fecha_remision);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_remisiones_estado' AND object_id = OBJECT_ID('ven_recibos'))
    CREATE INDEX idx_remisiones_estado ON ven_recibos(estado);
GO

-- Índices para seguimiento de remisiones
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_remision_seg_remision_id' AND object_id = OBJECT_ID('ven_remision_seguimiento'))
    CREATE INDEX idx_remision_seg_remision_id ON ven_remision_seguimiento(remision_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_remision_seg_fecha' AND object_id = OBJECT_ID('ven_remision_seguimiento'))
    CREATE INDEX idx_remision_seg_fecha ON ven_remision_seguimiento(fecha_cambio);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_remision_seg_estado' AND object_id = OBJECT_ID('ven_remision_seguimiento'))
    CREATE INDEX idx_remision_seg_estado ON ven_remision_seguimiento(estado_nuevo);
GO

PRINT '=====================================================';
PRINT 'Todas las tablas e índices han sido creados exitosamente';
PRINT 'Base de datos ERP360 lista para usar';
PRINT '=====================================================';

