# Análisis de la Estructura de Remisiones

## Resumen
Este documento analiza las tablas que manejan la sección de remisiones en la base de datos ERP360.

**⚠️ IMPORTANTE:** El análisis revela que:
- `ven_recibos` parece ser una tabla de **recibos de caja/pagos**, no de remisiones de productos
- `ven_detarecibo` contiene información de **pagos/cuotas**, no items de productos
- Es necesario investigar si existe otra tabla para los items de remisión de productos

## Tablas Identificadas

### 1. Tabla: `ven_recibos` (Encabezado - Recibos/Remisiones)

**Ubicación en BD:** `dbo.ven_recibos`

**Estructura Real de la Base de Datos:**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INT (IDENTITY) | ID único del registro (PK) |
| `codalm` | CHAR(3) | Código de almacén |
| `numrec` | INT | Número de recibo/remisión |
| `tipdoc` | CHAR(2) | Tipo de documento |
| `codter` | VARCHAR(15) | Código del cliente (FK a `con_terceros.codter`) |
| `fecrec` | DATETIME | Fecha del recibo/remisión |
| `codcue` | VARCHAR(?) | Código de cuenta (posiblemente) |
| ... | ... | (Más columnas según estructura real) |

**Índices:**
- `IX_ven_recibos` (NONCLUSTERED) en: `codalm, numrec, codter`

**Observaciones:**
- La tabla usa `numrec` (número de recibo) como identificador principal junto con `codalm` y `tipdoc`
- La estructura real es diferente a la propuesta en el script de creación
- No tiene campos como `numero_remision`, `pedido_id`, `factura_id` en la estructura real actual

### 2. Tabla: `ven_detarecibo` (Detalle - Pagos/Cuotas)

**Ubicación en BD:** `dbo.ven_detarecibo`

**Estructura Real de la Base de Datos:**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INT (IDENTITY) | ID único del registro (PK) |
| `codalm` | CHAR(3) | Código de almacén |
| `tipdoc` | CHAR(2) | Tipo de documento |
| `numrec` | NUMERIC | Número de recibo/remisión (FK a `ven_recibos.numrec`) |
| `valcuo` | NUMERIC | Valor de cuota (posiblemente) |
| `forpag` | CHAR(2) | Forma de pago |
| `numdoc` | VARCHAR(?) | Número de documento relacionado |
| ... | ... | (Más columnas según estructura real) |

**Observaciones:**
- La tabla usa `numrec` junto con `codalm` y `tipdoc` para relacionarse con `ven_recibos`
- La estructura real es diferente a la propuesta en el script de creación
- No tiene campos como `remision_id`, `producto_id`, `cantidad` en la estructura real actual

## Mapeo en el Código

### En `dbConfig.cjs`:

```javascript
TABLE_NAMES = {
  remisiones: 'ven_recibos',
  remisiones_detalle: 'ven_detarecibo'
}
```

### Queries Actuales:

#### GET_REMISIONES:
```sql
SELECT 
  r.id,
  r.numero_remision as numeroRemision,
  r.fecha_remision as fechaRemision,
  r.pedido_id as pedidoId,
  r.factura_id as facturaId,
  r.cliente_id as clienteId,
  r.vendedor_id as vendedorId,
  r.subtotal,
  r.descuento_valor as descuentoValor,
  r.iva_valor as ivaValor,
  r.total,
  r.observaciones,
  r.estado,
  r.empresa_id as empresaId,
  r.fecha_despacho as fechaDespacho,
  r.estado_envio,
  r.metodo_envio,
  r.transportadora_id,
  r.transportadora,
  r.numero_guia
FROM ven_recibos r
ORDER BY r.fecha_remision DESC
```

#### GET_REMISIONES_DETALLE:
```sql
SELECT 
  rd.id,
  rd.remision_id as remisionId,
  rd.producto_id as productoId,
  rd.cantidad,
  rd.precio_unitario as precioUnitario,
  rd.descuento_porcentaje as descuentoPorcentaje,
  rd.iva_porcentaje as ivaPorcentaje,
  rd.descripcion,
  rd.subtotal,
  rd.valor_iva as valorIva,
  rd.total
FROM ven_detarecibo rd
```

## Discrepancias Identificadas

### Problema Principal:
Las queries en `dbConfig.cjs` están usando nombres de columnas que **NO EXISTEN** en la estructura real de la base de datos:

**Columnas que NO existen en `ven_recibos`:**
- ❌ `numero_remision` → Debería ser `numrec`
- ❌ `fecha_remision` → Debería ser `fecrec`
- ❌ `pedido_id` → No existe en la estructura real
- ❌ `factura_id` → No existe en la estructura real
- ❌ `cliente_id` → Debería ser `codter`
- ❌ `vendedor_id` → No existe en la estructura real
- ❌ `subtotal`, `descuento_valor`, `iva_valor`, `total` → No existen
- ❌ `observaciones` → No existe
- ❌ `estado` → No existe
- ❌ `empresa_id` → No existe
- ❌ `fecha_despacho` → No existe
- ❌ `estado_envio`, `metodo_envio`, `transportadora_id`, `transportadora`, `numero_guia` → No existen

**Columnas que NO existen en `ven_detarecibo`:**
- ❌ `remision_id` → Debería usar `numrec` + `codalm` + `tipdoc`
- ❌ `producto_id` → No existe en la estructura real
- ❌ `cantidad` → No existe en la estructura real
- ❌ `precio_unitario` → No existe en la estructura real
- ❌ `descuento_porcentaje`, `iva_porcentaje` → No existen
- ❌ `descripcion` → No existe
- ❌ `subtotal`, `valor_iva`, `total` → No existen

## Estructura Completa de `ven_recibos`

### Campos Identificados:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INT (IDENTITY) | ID único (PK) |
| `codalm` | CHAR(3) | Código de almacén |
| `numrec` | INT | Número de recibo/remisión |
| `tipdoc` | CHAR(2) | Tipo de documento |
| `codter` | VARCHAR(15) | Código del cliente |
| `fecrec` | DATETIME | Fecha del recibo |
| `codcue` | CHAR(8) | Código de cuenta |
| `doccoc` | VARCHAR(12) | Documento contable |
| `numped` | NUMERIC | Número de pedido relacionado ✅ |
| `valrec` | NUMERIC | Valor del recibo |
| `estrec` | CHAR(1) | Estado del recibo |
| `efectivo` | NUMERIC | Valor en efectivo |
| `cheques` | NUMERIC | Valor en cheques |
| `TarjetaDB` | NUMERIC | Valor en tarjeta débito |
| `tarjeta` | NUMERIC | Valor en tarjeta |
| `Consignado` | NUMERIC | Valor consignado |
| `desrec` | NUMERIC | Descuento del recibo |
| `retfte` | NUMERIC | Retención en la fuente |
| `otrdesc` | NUMERIC | Otros descuentos |
| `rtefte` | NUMERIC | Retención en la fuente (alternativo) |
| `retserv` | NUMERIC | Retención de servicios |
| `retiva` | NUMERIC | Retención de IVA |
| `retica` | NUMERIC | Retención de ICA |
| `bono` | NUMERIC | Bonos |
| `otros` | NUMERIC | Otros valores |
| `otrosi` | NUMERIC | Otros ingresos |
| `netrec` | NUMERIC | Valor neto del recibo |
| `observa` | VARCHAR(100) | Observaciones ✅ |
| `codusu` | VARCHAR(10) | Código de usuario |
| `fecsys` | DATETIME | Fecha del sistema |
| `clarec` | CHAR(1) | Clase de recibo |
| `codban` | CHAR(4) | Código de banco |
| `codcaja` | CHAR(4) | Código de caja |
| `TRANSFERENCIA` | BIT | Si es transferencia |
| `CODVEN` | CHAR(3) | Código de vendedor ✅ |
| `NRECAUDOVENDEDOR` | CHAR(8) | Número de recaudo del vendedor |
| `ORICOC` | CHAR(2) | Origen contable |
| `SYNCRO` | BIT | Sincronizado |

### Campos Clave para el Flujo:
- ✅ `numped`: Relación con pedidos
- ✅ `codter`: Cliente
- ✅ `CODVEN`: Vendedor
- ✅ `observa`: Observaciones
- ✅ `estrec`: Estado del recibo
- ✅ `valrec`: Valor total
- ✅ `netrec`: Valor neto

## Estructura Completa de `ven_detarecibo`

### Campos Identificados:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INT (IDENTITY) | ID único (PK) |
| `codalm` | CHAR(3) | Código de almacén |
| `tipdoc` | CHAR(2) | Tipo de documento |
| `numrec` | NUMERIC | Número de recibo (FK a `ven_recibos.numrec`) |
| `valcuo` | NUMERIC | Valor de cuota |
| `forpag` | CHAR(2) | Forma de pago |
| `numdoc` | CHAR(15) | Número de documento |
| `codban` | CHAR(10) | Código de banco |
| `feccheq` | DATETIME | Fecha de cheque |
| `abocuo` | NUMERIC | Abono a cuota |
| `salcuo` | NUMERIC | Saldo de cuota |
| `estrec` | CHAR(1) | Estado del recibo |

### Observación Importante:
⚠️ **La tabla `ven_detarecibo` NO contiene items de productos**, sino información de **pagos/cuotas** del recibo. 

Esto sugiere que:
- `ven_recibos` es una tabla de **recibos de caja** o **pagos**, no de remisiones de productos
- Los items de productos probablemente están en otra tabla relacionada
- Es posible que necesitemos buscar otra tabla para los items de remisión

### Posibles Tablas Alternativas:
- `ven_detapedidos` - Podría contener items relacionados con remisiones
- Otra tabla específica para items de remisión que no hemos identificado aún

## Estructura Real vs Estructura Esperada

### Estructura Real (Actual):
```
ven_recibos:
  - id (INT)
  - codalm (CHAR(3))
  - numrec (INT)
  - tipdoc (CHAR(2))
  - codter (VARCHAR(15))
  - fecrec (DATETIME)
  - codcue (VARCHAR)
  - ... (más campos)

ven_detarecibo:
  - id (INT)
  - codalm (CHAR(3))
  - tipdoc (CHAR(2))
  - numrec (NUMERIC)
  - valcuo (NUMERIC)
  - forpag (CHAR(2))
  - numdoc (VARCHAR)
  - ... (más campos)
```

### Estructura Esperada (En el código):
```
ven_recibos:
  - id
  - numero_remision
  - fecha_remision
  - pedido_id
  - factura_id
  - cliente_id
  - vendedor_id
  - subtotal
  - descuento_valor
  - iva_valor
  - total
  - observaciones
  - estado
  - empresa_id
  - fecha_despacho
  - estado_envio
  - metodo_envio
  - transportadora_id
  - transportadora
  - numero_guia

ven_detarecibo:
  - id
  - remision_id
  - producto_id
  - cantidad
  - precio_unitario
  - descuento_porcentaje
  - iva_porcentaje
  - descripcion
  - subtotal
  - valor_iva
  - total
```

## Recomendaciones

### Opción 1: Adaptar el Código a la Estructura Real
- Modificar las queries en `dbConfig.cjs` para usar los nombres de columnas reales
- Mapear los campos reales a los campos esperados por el frontend
- Investigar qué campos adicionales existen en la estructura real

### Opción 2: Modificar la Estructura de la Base de Datos
- Agregar las columnas faltantes a `ven_recibos` y `ven_detarecibo`
- Mantener compatibilidad con la estructura existente
- Crear un script de migración

### Opción 3: Crear Vistas (Views)
- Crear vistas que mapeen la estructura real a la estructura esperada
- Mantener el código sin cambios
- Facilitar la migración gradual

## Próximos Pasos

1. **Investigar la estructura completa:**
   - Obtener todos los campos de `ven_recibos` y `ven_detarecibo`
   - Identificar qué campos se usan actualmente
   - Documentar el propósito de cada campo

2. **Decidir la estrategia:**
   - Adaptar código a estructura real
   - Modificar estructura de BD
   - Usar vistas

3. **Implementar la solución:**
   - Actualizar queries en `dbConfig.cjs`
   - Actualizar endpoints en `server.cjs`
   - Probar el flujo completo

## Campos Necesarios para el Flujo

### Para Pedido → Remisión:
- Número de remisión único
- Fecha de remisión
- Relación con pedido (numped)
- Cliente (codter)
- Vendedor (codven)
- Almacén (codalm)
- Items del pedido a remitir
- Cantidades a entregar

### Para Remisión → Facturación:
- Relación con factura (numfac)
- Estado de entrega
- Información de transporte (si aplica)
- Cantidades facturadas

## Notas Adicionales

- La tabla `ven_recibos` tiene un índice compuesto en `(codalm, numrec, codter)`
- El número de remisión (`numrec`) parece ser numérico, no un string como "REM-001"
- La relación entre `ven_recibos` y `ven_detarecibo` se hace mediante `numrec` + `codalm` + `tipdoc`
- Es necesario investigar qué otros campos existen en ambas tablas para entender mejor su uso

