# Análisis de la Estructura de Pedidos

## Resumen
Este documento analiza la estructura de las tablas de pedidos en la base de datos y propone la creación/modificación de las tablas necesarias para el flujo completo: **Cotización → Pedido → Remisión → Facturación**.

## Estructura Actual de la Base de Datos

### Tabla: `ven_detapedidos` (Estructura Real)
La tabla `ven_detapedidos` existe en la base de datos con la siguiente estructura:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `numped` | CHAR(8) | Número de pedido (PK) |
| `codins` | CHAR(8) | Código de insumo/producto |
| `valins` | NUMERIC | Valor unitario del insumo |
| `canped` | NUMERIC | Cantidad pedida |
| `canent` | NUMERIC | Cantidad entregada |
| `canfac` | NUMERIC | Cantidad facturada |
| `ivaped` | NUMERIC | IVA del pedido |
| `dctped` | NUMERIC | Descuento del pedido |
| `estped` | CHAR(1) | Estado del pedido |
| `codalm` | CHAR(3) | Código de almacén |
| `serial` | VARCHAR(30) | Número de serie |
| `reservado` | BIT | Si está reservado |
| `usureserva` | CHAR(10) | Usuario que reservó |
| `numfac` | VARCHAR(12) | Número de factura relacionada |
| `DiasGar` | INT | Días de garantía |
| `Numord` | CHAR(8) | Número de orden |

### Observaciones
- La tabla `ven_detapedidos` parece contener tanto el encabezado como el detalle (basado en `numped` como PK)
- No existe una tabla separada `ven_pedidos` para el encabezado
- La estructura actual no tiene relación directa con cotizaciones

## Estructura Propuesta

### Tabla: `ven_pedidos` (Encabezado)
Tabla nueva para almacenar el encabezado de los pedidos:

**Campos principales:**
- `id` (UNIQUEIDENTIFIER) - ID único del pedido
- `numped` (CHAR(8)) - Número de pedido (único)
- `fecped` (DATE) - Fecha del pedido
- `fec_entrega_estimada` (DATE) - Fecha estimada de entrega
- `codter` (CHAR(10)) - Código del cliente (FK a `con_terceros.codter`)
- `cod_vendedor` (CHAR(10)) - Código del vendedor (FK a `ven_vendedor.codven`)
- `id_cotizacion` (INT) - ID de la cotización origen (FK a `ven_cotizacion.id`)
- `codalm` (CHAR(3)) - Código de almacén (FK a `inv_almacen.codalm`)
- `subtotal` (DECIMAL(18,2)) - Subtotal del pedido
- `val_descuento` (DECIMAL(18,2)) - Valor del descuento
- `val_iva` (DECIMAL(18,2)) - Valor del IVA
- `total` (DECIMAL(18,2)) - Total del pedido
- `impoconsumo` (DECIMAL(18,2)) - Impuesto al consumo
- `tasa_descuento` (DECIMAL(5,2)) - Porcentaje de descuento
- `tasa_iva` (DECIMAL(5,2)) - Porcentaje de IVA
- `estado` (CHAR(1)) - Estado: B=BORRADOR, C=CONFIRMADO, P=EN_PROCESO, R=REMITIDO, X=CANCELADO
- `observa` (VARCHAR(500)) - Observaciones
- `instrucciones_entrega` (VARCHAR(500)) - Instrucciones de entrega
- `lista_precio` (VARCHAR(50)) - Lista de precios aplicada
- `cod_usuario` (CHAR(10)) - Usuario que creó
- `id_usuario` (INT) - ID de usuario
- `fecsys` (DATETIME) - Fecha de creación
- `fecmod` (DATETIME) - Fecha de modificación

### Tabla: `ven_detapedidos` (Detalle - Modificada)
Modificar la tabla existente para agregar campos faltantes:

**Campos adicionales propuestos:**
- `id` (INT IDENTITY) - ID único del registro
- `tasa_iva` (DECIMAL(5,2)) - Tasa de IVA del item
- `tasa_descuento` (DECIMAL(5,2)) - Tasa de descuento del item
- `fecsys` (DATETIME) - Fecha de creación

**Relaciones:**
- `numped` → `ven_pedidos.numped` (FK)
- `codins` → `inv_insumos.codins` (FK)
- `codalm` → `inv_almacen.codalm` (FK)

## Flujo de Trabajo

### 1. Cotización → Pedido
- Se crea un pedido desde una cotización aprobada
- Se copian los items de `ven_detacotizacion` a `ven_detapedidos`
- Se establece `id_cotizacion` en `ven_pedidos`
- Estado inicial: BORRADOR

### 2. Pedido → Remisión
- Se crea una remisión desde un pedido confirmado
- Se actualiza `canent` en `ven_detapedidos` con las cantidades entregadas
- Se relaciona la remisión con el pedido mediante `numped`
- Estado del pedido: EN_PROCESO o REMITIDO

### 3. Remisión → Facturación
- Se crea una factura desde una remisión entregada
- Se actualiza `canfac` en `ven_detapedidos` con las cantidades facturadas
- Se establece `numfac` en `ven_detapedidos`
- Estado del item: FACTURADO

## Estados del Pedido

| Código | Estado | Descripción |
|--------|--------|-------------|
| B | BORRADOR | Pedido en borrador, puede ser modificado |
| C | CONFIRMADO | Pedido confirmado, listo para procesar |
| P | EN_PROCESO | Pedido en proceso de preparación/despacho |
| R | REMITIDO | Pedido completamente remitido |
| X | CANCELADO | Pedido cancelado |

## Estados del Item (estped)

| Código | Estado | Descripción |
|--------|--------|-------------|
| B | BORRADOR | Item en borrador |
| C | CONFIRMADO | Item confirmado |
| E | ENTREGADO | Item entregado (canent > 0) |
| F | FACTURADO | Item facturado (canfac > 0) |

## Campos Importantes para el Flujo

### Para Cotización → Pedido:
- `id_cotizacion`: Relaciona el pedido con su cotización origen
- `numped`: Número único del pedido
- `codter`: Cliente del pedido
- `cod_vendedor`: Vendedor asignado
- `codalm`: Almacén de origen

### Para Pedido → Remisión:
- `numped`: Identifica el pedido a remitir
- `canent`: Cantidad entregada en la remisión
- `estped`: Estado del item (E=ENTREGADO)

### Para Remisión → Facturación:
- `numfac`: Número de factura relacionada
- `canfac`: Cantidad facturada
- `estped`: Estado del item (F=FACTURADO)

## Script SQL

El script `create_pedidos_table.sql` contiene:
1. Creación de la tabla `ven_pedidos` (encabezado) si no existe
2. Modificación de `ven_detapedidos` (detalle) para agregar campos faltantes
3. Creación de índices para mejorar rendimiento
4. Foreign keys para mantener integridad referencial
5. Comentarios y documentación

## Próximos Pasos

1. Ejecutar el script `create_pedidos_table.sql` en la base de datos
2. Actualizar las queries en `dbConfig.cjs` para usar la nueva estructura
3. Modificar el endpoint `POST /api/pedidos` para insertar en las nuevas tablas
4. Actualizar el frontend para mostrar y gestionar pedidos correctamente

