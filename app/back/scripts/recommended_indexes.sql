-- OPTIMIZACION DE INDICES - ERP360
-- Ejecutar este script en SQL Server Management Studio para mejorar el rendimiento de consultas

-- 1. Indices para Tabla de Remisiones (Búsquedas y Filtros)
CREATE NONCLUSTERED INDEX [IX_Remisiones_Fecha] ON [dbo].[remisiones] ([fecha_remision]) INCLUDE ([numero_remision], [codter], [estado]);
CREATE NONCLUSTERED INDEX [IX_Remisiones_Pedido] ON [dbo].[remisiones] ([pedido_id]) INCLUDE ([id], [numero_remision]);
CREATE NONCLUSTERED INDEX [IX_Remisiones_Cliente] ON [dbo].[remisiones] ([codter]);
CREATE NONCLUSTERED INDEX [IX_Remisiones_Estado] ON [dbo].[remisiones] ([estado]);

-- 2. Indices para Detalles (Joins rápidos)
CREATE NONCLUSTERED INDEX [IX_RemisionesDetalle_Remision] ON [dbo].[remisiones_detalle] ([remission_id]) INCLUDE ([codins], [cantidad_enviada]);

-- 3. Indices para Productos (Búsquedas en autocompletado y validaciones)
CREATE NONCLUSTERED INDEX [IX_Productos_Codins] ON [dbo].[inv_insumos] ([codins]) INCLUDE ([nomins], [ultimo_costo]);

-- 4. Indices para Clientes (Búsquedas por nombre o código)
CREATE NONCLUSTERED INDEX [IX_Clientes_Codter] ON [dbo].[gen_terceros] ([codter]) INCLUDE ([nomter], [EMAIL]);
-- Nota: EMAIL se usa frecuentemente para envíos, incluirlo evita lookups adicionales

-- 5. Mantenimiento de Estadísticas (Recomendado ejecutar semanalmente)
-- UPDATE STATISTICS [dbo].[remisiones];
-- UPDATE STATISTICS [dbo].[remisiones_detalle];
