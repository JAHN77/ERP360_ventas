# 📊 Análisis Completo de Endpoints - ERP360 Ventas

## Resumen Ejecutivo

Este documento contiene el análisis completo de todos los endpoints disponibles en el sistema ERP360 Ventas, incluyendo cómo se usan, qué validaciones tienen, y cómo se relacionan entre sí.

## 📋 Endpoints Disponibles

### GET - Consultas y Búsquedas

#### Catálogos Base
- `GET /api/clientes` - Lista todos los clientes
- `GET /api/clientes/:id` - Obtiene un cliente específico
- `GET /api/productos` - Lista productos (con paginación y filtros)
- `GET /api/vendedores` - Lista vendedores
- `GET /api/bodegas` - Lista bodegas/almacenes
- `GET /api/medidas` - Lista unidades de medida
- `GET /api/categorias` - Lista categorías de productos

#### Documentos Transaccionales
- `GET /api/cotizaciones` - Lista cotizaciones
- `GET /api/cotizaciones-detalle` - Lista items de cotizaciones
- `GET /api/pedidos` - Lista pedidos (con paginación, búsqueda y filtros)
- `GET /api/pedidos-detalle` - Lista items de pedidos
- `GET /api/remisiones` - Lista remisiones (con paginación y búsqueda)
- `GET /api/remisiones/:id/detalle` - Obtiene detalle de una remisión específica
- `GET /api/remisiones-detalle` - Lista items de remisiones
- `GET /api/facturas` - Lista facturas
- `GET /api/facturas-detalle` - Lista items de facturas
- `GET /api/notas-credito` - Lista notas de crédito

#### Búsquedas Server-Side
- `GET /api/buscar/clientes?search=...` - Búsqueda de clientes
- `GET /api/buscar/vendedores?search=...` - Búsqueda de vendedores
- `GET /api/buscar/productos?search=...` - Búsqueda de productos

#### Utilidades
- `GET /api/test-connection` - Prueba de conexión a la BD
- `GET /api/health` - Health check del servidor
- `GET /api/adjuntos` - Lista archivos adjuntos
- `GET /api/adjuntos/:id` - Obtiene un adjunto específico
- `GET /api/adjuntos/:id/download` - Descarga un adjunto

### POST - Creación

#### Documentos Transaccionales
- `POST /api/cotizaciones` - Crea una nueva cotización
- `POST /api/pedidos` - Crea un nuevo pedido
- `POST /api/remisiones` - Crea una nueva remisión
- `POST /api/facturas` - Crea una nueva factura
- `POST /api/notas-credito` - Crea una nueva nota de crédito

#### Catálogos
- `POST /api/clientes` - Crea un nuevo cliente
- `POST /api/clientes/:id/lista-precios` - Asigna lista de precios a cliente

#### Operaciones
- `POST /api/inventario/entradas` - Registra entrada de inventario
- `POST /api/query` - Ejecuta consulta SQL personalizada
- `POST /api/generar-pdf` - Genera PDF de documentos
- `POST /api/ai/generate` - Generación con IA

### PUT - Actualización

- `PUT /api/cotizaciones/:id` - Actualiza una cotización
- `PUT /api/pedidos/:id` - Actualiza un pedido (solo si está en BORRADOR o ENVIADA)
- `PUT /api/remisiones/:id` - Actualiza una remisión
- `PUT /api/facturas/:id` - Actualiza una factura
- `PUT /api/notas-credito/:id` - Actualiza una nota de crédito

## 🔄 Flujos de Conversión Entre Secciones

### 1. Cotización → Pedido

**Proceso:**
1. Se crea una cotización con estado `BORRADOR` o `ENVIADA`
2. Se aprueba la cotización (cambia estado a `APROBADA`)
3. Se crea un pedido desde la cotización aprobada
4. El pedido mantiene referencia a la cotización origen (`cotizacion_id`)

**Endpoints involucrados:**
- `POST /api/cotizaciones` - Crear cotización
- `PUT /api/cotizaciones/:id` - Aprobar cotización (cambiar estado a APROBADA)
- `POST /api/pedidos` - Crear pedido (con `cotizacionId` en el payload)

**Validaciones:**
- La cotización debe existir
- La cotización debe estar en estado `APROBADA` o `ENVIADA`
- Los items de la cotización deben tener productos válidos
- El cliente debe existir y estar activo

### 2. Pedido → Remisión

**Proceso:**
1. Se crea un pedido (puede venir de cotización o ser directo)
2. El pedido debe estar en estado `CONFIRMADO` para poder crear remisión
3. Se crea una remisión desde el pedido
4. La remisión mantiene referencia al pedido origen (`pedido_id`)
5. Se actualiza el estado del pedido según las cantidades remitidas:
   - `EN_PROCESO` - Si es la primera remisión parcial
   - `PARCIALMENTE_REMITIDO` - Si hay remisiones parciales
   - `REMITIDO` - Si todos los items están completamente remitidos

**Endpoints involucrados:**
- `POST /api/pedidos` - Crear pedido
- `PUT /api/pedidos/:id` - Confirmar pedido (cambiar estado a CONFIRMADO)
- `POST /api/remisiones` - Crear remisión (con `pedidoId` en el payload)

**Validaciones:**
- El pedido debe existir
- El pedido debe estar en estado `CONFIRMADO`
- Los items a remitir no deben exceder las cantidades pedidas
- El almacén debe existir y estar activo

### 3. Remisión → Factura

**Proceso:**
1. Se crea una remisión (puede venir de pedido o ser directa)
2. Se crea una factura desde una o más remisiones
3. La factura mantiene referencia a las remisiones origen
4. Se actualiza el estado de las remisiones a facturadas

**Endpoints involucrados:**
- `POST /api/remisiones` - Crear remisión
- `POST /api/facturas` - Crear factura (con `remisionIds` en el payload)

## ✅ Validaciones por Endpoint

### POST /api/cotizaciones
- ✅ Cliente debe existir y estar activo
- ✅ Almacén/Bodega debe existir y estar activo
- ✅ Todos los items deben tener productos válidos
- ✅ Valores numéricos validados (subtotal, IVA, total)
- ✅ Fechas válidas (fechaCotizacion, fechaVencimiento)

### POST /api/pedidos
- ✅ Cliente debe existir
- ✅ Almacén/Bodega debe existir
- ✅ Si viene `cotizacionId`, la cotización debe existir
- ✅ Todos los items deben tener productos válidos
- ✅ Valores numéricos validados y limitados a DECIMAL(18,2)
- ✅ `pedido_id` generado correctamente para items

### PUT /api/pedidos/:id
- ✅ El pedido debe existir
- ✅ Solo se puede editar si está en estado `BORRADOR` o `ENVIADA`
- ✅ No se puede editar si está en `CONFIRMADO`, `EN_PROCESO`, `PARCIALMENTE_REMITIDO`, `REMITIDO`, o `CANCELADO`
- ✅ Si se envían items, se eliminan los antiguos y se crean nuevos
- ✅ Valores numéricos validados

### POST /api/remisiones
- ✅ Cliente debe existir
- ✅ Si viene `pedidoId`, el pedido debe existir
- ✅ Almacén debe existir
- ✅ Todos los items deben tener `codProducto` válido
- ✅ Valores numéricos validados
- ✅ Se actualiza estado del pedido si viene `pedidoId`

### PUT /api/remisiones/:id
- ✅ La remisión debe existir
- ✅ Validación de estado según reglas de negocio

## 🧪 Script de Pruebas

Se ha creado un script completo de pruebas en `test-completo-endpoints.js` que:

1. **Analiza todos los endpoints** disponibles
2. **Prueba creación** de documentos (cotizaciones, pedidos, remisiones)
3. **Prueba edición** de documentos
4. **Prueba conversiones** entre secciones:
   - Cotización → Pedido
   - Pedido → Remisión
5. **Prueba flujo completo** desde cotización hasta remisión

### Ejecutar Pruebas

```bash
cd app/back
node test-completo-endpoints.js
```

## 📝 Notas Importantes

### Estados de Pedidos
- `BORRADOR` - Editable
- `ENVIADA` - Editable
- `CONFIRMADO` - No editable, listo para remitir
- `EN_PROCESO` - No editable, tiene remisiones parciales
- `PARCIALMENTE_REMITIDO` - No editable
- `REMITIDO` - No editable, completamente remitido
- `CANCELADO` - No editable

### Validación Numérica
Todos los valores numéricos se validan para evitar errores de "Arithmetic overflow":
- Se limitan a DECIMAL(18,2) máximo: 9999999999999999.99
- Se redondean a 2 decimales
- Se validan que sean números finitos (no NaN, no Infinity)

### Relaciones entre Tablas
- `ven_detapedidos` NO tiene columna `id` - se identifica por `pedido_id` + `codins`
- `ven_remiciones_det.deta_pedido_id` se deja como NULL porque no hay ID único en `ven_detapedidos`
- La relación se mantiene a través de `pedido_id` en el encabezado

## 🔍 Problemas Conocidos y Soluciones

1. **Error "Arithmetic overflow"**: Solucionado con validación numérica exhaustiva
2. **deta_pedido_id NULL**: Esperado, ya que `ven_detapedidos` no tiene columna `id`
3. **Pedidos no editables**: Por diseño, solo se pueden editar en estados iniciales
4. **Validación de almacén**: Se debe usar un código de almacén válido desde `inv_almacen`

