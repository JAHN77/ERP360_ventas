-- Script de optimización de índices para mejorar el rendimiento con grandes volúmenes de datos
-- Ejecutar este script en la base de datos SQL Server para crear índices optimizados

-- ============================================
-- ÍNDICES PARA TABLA DE CLIENTES (con_terceros)
-- ============================================

-- Índice para búsquedas por código de tercero (muy frecuente)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_con_terceros_codter' AND object_id = OBJECT_ID('con_terceros'))
CREATE INDEX IX_con_terceros_codter ON con_terceros(codter);

-- Índice para búsquedas por nombre y estado activo
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_con_terceros_nomter_activo' AND object_id = OBJECT_ID('con_terceros'))
CREATE INDEX IX_con_terceros_nomter_activo ON con_terceros(nomter) INCLUDE (activo) WHERE activo = 1;

-- Índice para búsquedas por email (si se usa para búsqueda)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_con_terceros_email' AND object_id = OBJECT_ID('con_terceros'))
CREATE INDEX IX_con_terceros_email ON con_terceros(EMAIL) WHERE EMAIL IS NOT NULL;

-- ============================================
-- ÍNDICES PARA TABLA DE PRODUCTOS (inv_insumos)
-- ============================================

-- Índice para búsquedas por código de insumo (muy frecuente)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_inv_insumos_codins' AND object_id = OBJECT_ID('inv_insumos'))
CREATE INDEX IX_inv_insumos_codins ON inv_insumos(codins);

-- Índice para búsquedas por nombre y estado activo (usado en filtros)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_inv_insumos_nomins_activo' AND object_id = OBJECT_ID('inv_insumos'))
CREATE INDEX IX_inv_insumos_nomins_activo ON inv_insumos(nomins) INCLUDE (activo) WHERE activo = 1;

-- Índice para búsquedas por referencia (muy usado en búsquedas de productos)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_inv_insumos_referencia' AND object_id = OBJECT_ID('inv_insumos'))
CREATE INDEX IX_inv_insumos_referencia ON inv_insumos(referencia) WHERE referencia IS NOT NULL AND LTRIM(RTRIM(referencia)) <> '';

-- ============================================
-- ÍNDICES PARA TABLA DE INVENTARIO (inv_invent)
-- ============================================

-- Índice compuesto para búsquedas por código de insumo y bodega (usado en cálculo de stock)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_inv_invent_codins_codalm' AND object_id = OBJECT_ID('inv_invent'))
CREATE INDEX IX_inv_invent_codins_codalm ON inv_invent(codins, codalm);

-- ============================================
-- ÍNDICES PARA TABLA DE FACTURAS (ven_facturas)
-- ============================================

-- Índice para búsquedas por número de factura (muy frecuente)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_facturas_numfact' AND object_id = OBJECT_ID('ven_facturas'))
CREATE INDEX IX_ven_facturas_numfact ON ven_facturas(numfact);

-- Índice para búsquedas por cliente y fecha (usado en reportes y filtros)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_facturas_codter_fecfac' AND object_id = OBJECT_ID('ven_facturas'))
CREATE INDEX IX_ven_facturas_codter_fecfac ON ven_facturas(codter, fecfac DESC);

-- Índice para búsquedas por estado (usado en filtros)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_facturas_estfac' AND object_id = OBJECT_ID('ven_facturas'))
CREATE INDEX IX_ven_facturas_estfac ON ven_facturas(estfac);

-- ============================================
-- ÍNDICES PARA TABLA DE DETALLE DE FACTURAS (ven_detafact)
-- ============================================

-- Índice para búsquedas por factura (muy frecuente en JOINs)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_detafact_id_factura' AND object_id = OBJECT_ID('ven_detafact'))
CREATE INDEX IX_ven_detafact_id_factura ON ven_detafact(id_factura);

-- Índice para búsquedas por código de insumo (usado en reportes)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_detafact_codins' AND object_id = OBJECT_ID('ven_detafact'))
CREATE INDEX IX_ven_detafact_codins ON ven_detafact(codins);

-- ============================================
-- ÍNDICES PARA TABLA DE COTIZACIONES (venv_cotizacion)
-- ============================================

-- Índice para búsquedas por número de cotización
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_venv_cotizacion_numcot' AND object_id = OBJECT_ID('venv_cotizacion'))
CREATE INDEX IX_venv_cotizacion_numcot ON venv_cotizacion(numcot);

-- Índice para búsquedas por cliente y fecha (usado en reportes)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_venv_cotizacion_codter_fecha' AND object_id = OBJECT_ID('venv_cotizacion'))
CREATE INDEX IX_venv_cotizacion_codter_fecha ON venv_cotizacion(codter, fecha DESC);

-- Índice para búsquedas por estado (usado en filtros)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_venv_cotizacion_estado' AND object_id = OBJECT_ID('venv_cotizacion'))
CREATE INDEX IX_venv_cotizacion_estado ON venv_cotizacion(estado);

-- ============================================
-- ÍNDICES PARA TABLA DE DETALLE DE COTIZACIONES (venv_detacotizacion)
-- ============================================

-- Índice para búsquedas por cotización (muy frecuente en JOINs)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_venv_detacotizacion_id_cotizacion' AND object_id = OBJECT_ID('venv_detacotizacion'))
CREATE INDEX IX_venv_detacotizacion_id_cotizacion ON venv_detacotizacion(id_cotizacion);

-- ============================================
-- ÍNDICES PARA TABLA DE PEDIDOS (ven_pedidos)
-- ============================================

-- Índice para búsquedas por número de pedido
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_pedidos_numero_pedido' AND object_id = OBJECT_ID('ven_pedidos'))
CREATE INDEX IX_ven_pedidos_numero_pedido ON ven_pedidos(numero_pedido);

-- Índice para búsquedas por cliente y fecha (usado en reportes y filtros)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_pedidos_codter_fecha_pedido' AND object_id = OBJECT_ID('ven_pedidos'))
CREATE INDEX IX_ven_pedidos_codter_fecha_pedido ON ven_pedidos(codter, fecha_pedido DESC);

-- Índice para búsquedas por estado (usado en filtros)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_pedidos_estado' AND object_id = OBJECT_ID('ven_pedidos'))
CREATE INDEX IX_ven_pedidos_estado ON ven_pedidos(estado);

-- Índice para búsquedas por cotización relacionada
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_pedidos_cotizacion_id' AND object_id = OBJECT_ID('ven_pedidos'))
CREATE INDEX IX_ven_pedidos_cotizacion_id ON ven_pedidos(cotizacion_id) WHERE cotizacion_id IS NOT NULL;

-- ============================================
-- ÍNDICES PARA TABLA DE DETALLE DE PEDIDOS (ven_detapedidos)
-- ============================================

-- Índice compuesto para búsquedas por pedido y código de insumo (muy usado en JOINs)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_detapedidos_pedido_id_codins' AND object_id = OBJECT_ID('ven_detapedidos'))
CREATE INDEX IX_ven_detapedidos_pedido_id_codins ON ven_detapedidos(pedido_id, codins);

-- Índice para búsquedas por numped (estructura antigua)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_detapedidos_numped' AND object_id = OBJECT_ID('ven_detapedidos'))
CREATE INDEX IX_ven_detapedidos_numped ON ven_detapedidos(numped) WHERE numped IS NOT NULL;

-- ============================================
-- ÍNDICES PARA TABLA DE REMISIONES (ven_remiciones_enc)
-- ============================================

-- Índice para búsquedas por número de remisión
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remiciones_enc_numero_remision' AND object_id = OBJECT_ID('ven_remiciones_enc'))
CREATE INDEX IX_ven_remiciones_enc_numero_remision ON ven_remiciones_enc(numero_remision);

-- Índice para búsquedas por pedido relacionado (muy frecuente)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remiciones_enc_pedido_id' AND object_id = OBJECT_ID('ven_remiciones_enc'))
CREATE INDEX IX_ven_remiciones_enc_pedido_id ON ven_remiciones_enc(pedido_id) WHERE pedido_id IS NOT NULL;

-- Índice para búsquedas por cliente y fecha (usado en reportes)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remiciones_enc_codter_fecha_remision' AND object_id = OBJECT_ID('ven_remiciones_enc'))
CREATE INDEX IX_ven_remiciones_enc_codter_fecha_remision ON ven_remiciones_enc(codter, fecha_remision DESC);

-- Índice para búsquedas por estado (usado en filtros)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remiciones_enc_estado' AND object_id = OBJECT_ID('ven_remiciones_enc'))
CREATE INDEX IX_ven_remiciones_enc_estado ON ven_remiciones_enc(estado);

-- ============================================
-- ÍNDICES PARA TABLA DE DETALLE DE REMISIONES (ven_remiciones_det)
-- ============================================

-- Índice para búsquedas por remisión (muy frecuente en JOINs)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remiciones_det_remision_id' AND object_id = OBJECT_ID('ven_remiciones_det'))
CREATE INDEX IX_ven_remiciones_det_remision_id ON ven_remiciones_det(remision_id);

-- Índice compuesto para búsquedas por remisión y código de insumo (usado en cálculos)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remiciones_det_remision_id_codins' AND object_id = OBJECT_ID('ven_remiciones_det'))
CREATE INDEX IX_ven_remiciones_det_remision_id_codins ON ven_remiciones_det(remision_id, codins);

-- Índice para búsquedas por detalle de pedido relacionado
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_remiciones_det_deta_pedido_id' AND object_id = OBJECT_ID('ven_remiciones_det'))
CREATE INDEX IX_ven_remiciones_det_deta_pedido_id ON ven_remiciones_det(deta_pedido_id) WHERE deta_pedido_id IS NOT NULL;

-- ============================================
-- ÍNDICES PARA TABLA DE NOTAS DE CRÉDITO (ven_notas)
-- ============================================

-- Índice para búsquedas por número de nota
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_notas_numero' AND object_id = OBJECT_ID('ven_notas'))
CREATE INDEX IX_ven_notas_numero ON ven_notas(numero);

-- Índice para búsquedas por factura relacionada (muy frecuente)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_notas_factura_id' AND object_id = OBJECT_ID('ven_notas'))
CREATE INDEX IX_ven_notas_factura_id ON ven_notas(factura_id) WHERE factura_id IS NOT NULL;

-- Índice para búsquedas por cliente y fecha
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ven_notas_cliente_id_fecha_emision' AND object_id = OBJECT_ID('ven_notas'))
CREATE INDEX IX_ven_notas_cliente_id_fecha_emision ON ven_notas(cliente_id, fecha_emision DESC);

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 1. Los índices mejoran el rendimiento de las consultas SELECT, pero pueden ralentizar INSERT/UPDATE/DELETE
-- 2. Ejecutar este script en horarios de baja actividad si la base de datos es grande
-- 3. Monitorear el uso de espacio después de crear los índices
-- 4. Los índices con filtros WHERE solo se aplican a registros que cumplan la condición
-- 5. Revisar periódicamente el uso de índices con sys.dm_db_index_usage_stats

PRINT 'Script de índices completado exitosamente.';

