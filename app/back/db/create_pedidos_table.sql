-- =====================================================
-- Script para crear/modificar tabla de PEDIDOS
-- Basado en la estructura real de la base de datos
-- Flujo: Cotización -> Pedido -> Remisión -> Facturación
-- =====================================================

-- =====================================================
-- IMPORTANTE: Este script crea/modifica las tablas de pedidos
-- para soportar el flujo: Cotización -> Pedido -> Remisión -> Facturación
-- =====================================================

-- Verificar si existe la tabla ven_pedidos (encabezado)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_pedidos]') AND type in (N'U'))
BEGIN
    PRINT 'Creando tabla ven_pedidos (encabezado)...';
    
    CREATE TABLE ven_pedidos (
        -- Identificación
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        numped CHAR(8) NOT NULL, -- Número de pedido (formato: PED0001, sin guiones)
        
        -- Fechas
        fecped DATE NOT NULL DEFAULT GETDATE(), -- Fecha del pedido
        fec_entrega_estimada DATE, -- Fecha estimada de entrega
        
        -- Relaciones
        codter CHAR(10) NOT NULL, -- Código del cliente (FK a con_terceros.codter)
        cod_vendedor CHAR(10), -- Código del vendedor (FK a ven_vendedor.codven)
        id_cotizacion INT, -- ID de la cotización origen (FK a ven_cotizacion.id)
        codalm CHAR(3), -- Código de almacén (FK a inv_almacen.codalm)
        
        -- Valores monetarios
        subtotal DECIMAL(18,2) DEFAULT 0,
        val_descuento DECIMAL(18,2) DEFAULT 0,
        val_iva DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) DEFAULT 0,
        impoconsumo DECIMAL(18,2) DEFAULT 0,
        
        -- Porcentajes
        tasa_descuento DECIMAL(5,2) DEFAULT 0,
        tasa_iva DECIMAL(5,2) DEFAULT 0,
        
        -- Estado y control
        estado CHAR(1) DEFAULT 'B', -- B=BORRADOR, C=CONFIRMADO, P=EN_PROCESO, R=REMITIDO, X=CANCELADO
        observa VARCHAR(500), -- Observaciones generales
        instrucciones_entrega VARCHAR(500), -- Instrucciones de entrega
        
        -- Lista de precios
        lista_precio VARCHAR(50),
        
        -- Auditoría
        cod_usuario CHAR(10), -- Usuario que creó
        id_usuario INT, -- ID de usuario
        fecsys DATETIME DEFAULT GETDATE(), -- Fecha de creación del sistema
        fecmod DATETIME, -- Fecha de modificación
        
        -- Índices
        CONSTRAINT UQ_ven_pedidos_numped UNIQUE (numped),
        CONSTRAINT FK_ven_pedidos_cliente FOREIGN KEY (codter) REFERENCES con_terceros(codter),
        CONSTRAINT FK_ven_pedidos_vendedor FOREIGN KEY (cod_vendedor) REFERENCES ven_vendedor(codven),
        CONSTRAINT FK_ven_pedidos_cotizacion FOREIGN KEY (id_cotizacion) REFERENCES ven_cotizacion(id),
        CONSTRAINT FK_ven_pedidos_almacen FOREIGN KEY (codalm) REFERENCES inv_almacen(codalm)
    );
    
    -- Crear índices para mejorar rendimiento
    CREATE INDEX IX_ven_pedidos_codter ON ven_pedidos(codter);
    CREATE INDEX IX_ven_pedidos_cod_vendedor ON ven_pedidos(cod_vendedor);
    CREATE INDEX IX_ven_pedidos_id_cotizacion ON ven_pedidos(id_cotizacion);
    CREATE INDEX IX_ven_pedidos_estado ON ven_pedidos(estado);
    CREATE INDEX IX_ven_pedidos_fecped ON ven_pedidos(fecped);
    
    PRINT 'Tabla ven_pedidos creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla ven_pedidos ya existe. Verificando columnas...';
    
    -- Agregar columnas faltantes si no existen
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_pedidos]') AND name = 'id')
    BEGIN
        ALTER TABLE ven_pedidos ADD id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID();
        PRINT 'Columna id agregada a ven_pedidos';
    END
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_pedidos]') AND name = 'id_cotizacion')
    BEGIN
        ALTER TABLE ven_pedidos ADD id_cotizacion INT;
        PRINT 'Columna id_cotizacion agregada a ven_pedidos';
    END
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_pedidos]') AND name = 'fec_entrega_estimada')
    BEGIN
        ALTER TABLE ven_pedidos ADD fec_entrega_estimada DATE;
        PRINT 'Columna fec_entrega_estimada agregada a ven_pedidos';
    END
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_pedidos]') AND name = 'instrucciones_entrega')
    BEGIN
        ALTER TABLE ven_pedidos ADD instrucciones_entrega VARCHAR(500);
        PRINT 'Columna instrucciones_entrega agregada a ven_pedidos';
    END
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_pedidos]') AND name = 'impoconsumo')
    BEGIN
        ALTER TABLE ven_pedidos ADD impoconsumo DECIMAL(18,2) DEFAULT 0;
        PRINT 'Columna impoconsumo agregada a ven_pedidos';
    END
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_pedidos]') AND name = 'lista_precio')
    BEGIN
        ALTER TABLE ven_pedidos ADD lista_precio VARCHAR(50);
        PRINT 'Columna lista_precio agregada a ven_pedidos';
    END
END
GO

-- =====================================================
-- Tabla de Detalle de Pedidos (ven_detapedidos)
-- =====================================================

-- Verificar si existe la tabla ven_detapedidos
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ven_detapedidos]') AND type in (N'U'))
BEGIN
    PRINT 'Creando tabla ven_detapedidos (detalle)...';
    
    CREATE TABLE ven_detapedidos (
        -- Identificación
        id INT PRIMARY KEY IDENTITY(1,1),
        numped CHAR(8) NOT NULL, -- Número de pedido (FK a ven_pedidos.numped)
        
        -- Producto
        codins CHAR(8) NOT NULL, -- Código de insumo/producto (FK a inv_insumos.codins)
        
        -- Cantidades
        canped DECIMAL(18,2) NOT NULL DEFAULT 0, -- Cantidad pedida
        canent DECIMAL(18,2) DEFAULT 0, -- Cantidad entregada (para remisiones)
        canfac DECIMAL(18,2) DEFAULT 0, -- Cantidad facturada (para facturas)
        
        -- Valores
        valins DECIMAL(18,2) NOT NULL DEFAULT 0, -- Valor unitario del insumo
        ivaped DECIMAL(18,2) DEFAULT 0, -- IVA del pedido (valor)
        dctped DECIMAL(18,2) DEFAULT 0, -- Descuento del pedido (valor)
        
        -- Porcentajes
        tasa_iva DECIMAL(5,2) DEFAULT 0, -- Tasa de IVA
        tasa_descuento DECIMAL(5,2) DEFAULT 0, -- Tasa de descuento
        
        -- Estado y control
        estped CHAR(1) DEFAULT 'B', -- Estado del item: B=BORRADOR, C=CONFIRMADO, E=ENTREGADO, F=FACTURADO
        codalm CHAR(3), -- Código de almacén
        
        -- Serialización y reservas
        serial VARCHAR(30), -- Número de serie
        reservado BIT DEFAULT 0, -- Si está reservado
        usureserva CHAR(10), -- Usuario que reservó
        
        -- Relación con factura
        numfac VARCHAR(12), -- Número de factura relacionada
        
        -- Garantía
        DiasGar INT, -- Días de garantía
        
        -- Orden
        Numord CHAR(8), -- Número de orden
        
        -- Auditoría
        fecsys DATETIME DEFAULT GETDATE(),
        
        -- Foreign Keys
        CONSTRAINT FK_ven_detapedidos_pedido FOREIGN KEY (numped) REFERENCES ven_pedidos(numped) ON DELETE CASCADE,
        CONSTRAINT FK_ven_detapedidos_producto FOREIGN KEY (codins) REFERENCES inv_insumos(codins),
        CONSTRAINT FK_ven_detapedidos_almacen FOREIGN KEY (codalm) REFERENCES inv_almacen(codalm)
    );
    
    -- Crear índices
    CREATE INDEX IX_ven_detapedidos_numped ON ven_detapedidos(numped);
    CREATE INDEX IX_ven_detapedidos_codins ON ven_detapedidos(codins);
    CREATE INDEX IX_ven_detapedidos_estped ON ven_detapedidos(estped);
    CREATE INDEX IX_ven_detapedidos_numfac ON ven_detapedidos(numfac);
    
    PRINT 'Tabla ven_detapedidos creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla ven_detapedidos ya existe. Verificando columnas...';
    
    -- Agregar columnas faltantes si no existen
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_detapedidos]') AND name = 'id')
    BEGIN
        ALTER TABLE ven_detapedidos ADD id INT IDENTITY(1,1);
        PRINT 'Columna id agregada a ven_detapedidos';
    END
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_detapedidos]') AND name = 'tasa_iva')
    BEGIN
        ALTER TABLE ven_detapedidos ADD tasa_iva DECIMAL(5,2) DEFAULT 0;
        PRINT 'Columna tasa_iva agregada a ven_detapedidos';
    END
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_detapedidos]') AND name = 'tasa_descuento')
    BEGIN
        ALTER TABLE ven_detapedidos ADD tasa_descuento DECIMAL(5,2) DEFAULT 0;
        PRINT 'Columna tasa_descuento agregada a ven_detapedidos';
    END
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ven_detapedidos]') AND name = 'fecsys')
    BEGIN
        ALTER TABLE ven_detapedidos ADD fecsys DATETIME DEFAULT GETDATE();
        PRINT 'Columna fecsys agregada a ven_detapedidos';
    END
END
GO

-- =====================================================
-- Comentarios y documentación
-- =====================================================

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Tabla de encabezado de pedidos. Flujo: Cotización -> Pedido -> Remisión -> Facturación', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'ven_pedidos';
GO

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Tabla de detalle de pedidos. Contiene los items de cada pedido.', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'ven_detapedidos';
GO

PRINT '=====================================================';
PRINT 'Script de creación de tablas de PEDIDOS completado';
PRINT '=====================================================';
PRINT '';
PRINT 'Estructura creada:';
PRINT '  - ven_pedidos (encabezado)';
PRINT '  - ven_detapedidos (detalle)';
PRINT '';
PRINT 'Flujo de trabajo:';
PRINT '  1. Cotización (ven_cotizacion) -> id_cotizacion';
PRINT '  2. Pedido (ven_pedidos) -> numped';
PRINT '  3. Remisión (ven_recibos) -> referencia a numped';
PRINT '  4. Factura (ven_facturas) -> referencia a numped';
PRINT '';
PRINT 'Estados de pedido:';
PRINT '  B = BORRADOR';
PRINT '  C = CONFIRMADO';
PRINT '  P = EN_PROCESO';
PRINT '  R = REMITIDO';
PRINT '  X = CANCELADO';
PRINT '';
PRINT 'Estados de item (estped):';
PRINT '  B = BORRADOR';
PRINT '  C = CONFIRMADO';
PRINT '  E = ENTREGADO';
PRINT '  F = FACTURADO';
PRINT '=====================================================';

