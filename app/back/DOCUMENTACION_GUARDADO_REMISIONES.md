# 📋 Documentación: Dónde y Qué se Guarda en Remisiones

## 🗄️ TABLAS UTILIZADAS

### 1. **ven_remiciones_enc** (Encabezado de Remisión)
**Ubicación en código:** `server.cjs` línea 4238-4248

**Columnas que se guardan:**

| Columna | Tipo | Origen | Descripción |
|---------|------|--------|-------------|
| `id` | INT (IDENTITY) | Auto-generado | ID único de la remisión (generado automáticamente) |
| `codalm` | VARCHAR(10) | `codalm` o `empresaId` del body | Código del almacén/bodega |
| `numero_remision` | VARCHAR(50) | `numeroRemision` del body o auto-generado | Número de remisión (ej: REM-001) |
| `fecha_remision` | DATE | `fechaRemision` del body o fecha actual | Fecha de la remisión |
| `pedido_id` | INT | `pedidoId` del body | ID del pedido relacionado (opcional) |
| `codter` | VARCHAR(20) | `clienteId` del body | Código del tercero/cliente |
| `codven` | VARCHAR(20) | `vendedorId` del body | Código del vendedor (opcional) |
| `estado` | VARCHAR(20) | `estado` del body (default: 'BORRADOR') | Estado de la remisión |
| `observaciones` | VARCHAR(500) | `observaciones` del body | Observaciones de la remisión |
| `codusu` | VARCHAR(20) | `codusu` del body | Código del usuario que crea |
| `fec_creacion` | DATETIME | Fecha/hora actual | Fecha de creación del registro |

**Código SQL que se ejecuta:**
```sql
INSERT INTO ven_remiciones_enc (
  codalm, numero_remision, fecha_remision,
  pedido_id, codter, codven, estado, observaciones, codusu, fec_creacion
) VALUES (
  @codalm, @numero_remision, @fecha_remision,
  @pedido_id, @codter, @codven, @estado, @observaciones, @codusu, @fec_creacion
);
SELECT SCOPE_IDENTITY() AS id;
```

---

### 2. **ven_remiciones_det** (Detalle/Items de Remisión)
**Ubicación en código:** `server.cjs` línea 4294-4299

**Columnas que se guardan:**

| Columna | Tipo | Origen | Descripción |
|---------|------|--------|-------------|
| `id` | INT (IDENTITY) | Auto-generado | ID único del item (generado automáticamente) |
| `remision_id` | INT (NOT NULL) | `newId` del encabezado | ID de la remisión (FK a ven_remiciones_enc) |
| `deta_pedido_id` | INT | `detaPedidoId` del item (opcional) | ID del detalle del pedido relacionado |
| `codins` | VARCHAR(50) | `codProducto` o `codins` del item | Código del insumo/producto |
| `cantidad_enviada` | DECIMAL(18,2) | `cantidadEnviada` o `cantidad` del item | Cantidad enviada del producto |
| `cantidad_facturada` | DECIMAL(18,2) | `cantidadFacturada` del item (default: 0) | Cantidad facturada (inicialmente 0) |
| `cantidad_devuelta` | DECIMAL(18,2) | `cantidadDevuelta` del item (default: 0) | Cantidad devuelta (inicialmente 0) |

**Código SQL que se ejecuta (por cada item):**
```sql
INSERT INTO ven_remiciones_det (
  remision_id, deta_pedido_id, codins, 
  cantidad_enviada, cantidad_facturada, cantidad_devuelta
) VALUES (
  @remision_id, @deta_pedido_id, @codins, 
  @cantidad_enviada, @cantidad_facturada, @cantidad_devuelta
);
```

---

## 📤 ESTRUCTURA DEL PAYLOAD QUE RECIBE LA API

**Endpoint:** `POST /api/remisiones`

**Ejemplo de payload:**
```json
{
  "pedidoId": 123,                    // Opcional: ID del pedido relacionado
  "clienteId": "900464817-6",         // Requerido: Código del cliente (codter)
  "vendedorId": "VEN001",             // Opcional: Código del vendedor
  "fechaRemision": "2025-11-18",      // Opcional: Si no se envía, usa fecha actual
  "fechaDespacho": null,              // Opcional: Fecha de despacho
  "subtotal": 250000,                 // Opcional: Subtotal
  "descuentoValor": 0,                // Opcional: Valor de descuento
  "ivaValor": 47500,                  // Opcional: Valor de IVA
  "total": 297500,                    // Opcional: Total
  "observaciones": "Remisión de prueba", // Opcional: Observaciones
  "estado": "BORRADOR",               // Opcional: Estado (default: BORRADOR)
  "empresaId": "001",                 // Opcional: Código de empresa/bodega
  "codalm": "001",                    // Opcional: Código de almacén
  "codusu": "USUARIO01",              // Opcional: Código de usuario
  "items": [                          // Requerido: Array de items
    {
      "productoId": 456,              // ID del producto
      "cantidad": 10,                 // Cantidad
      "codProducto": "02300196",      // CRÍTICO: Código del producto (codins)
      "cantidadEnviada": 10,          // Cantidad enviada
      "detaPedidoId": null,           // Opcional: ID del detalle del pedido
      "precioUnitario": 25000,        // Opcional: Precio unitario
      "descuentoPorcentaje": 0,       // Opcional: Porcentaje de descuento
      "ivaPorcentaje": 19,            // Opcional: Porcentaje de IVA
      "descripcion": "Producto ejemplo", // Opcional: Descripción
      "subtotal": 250000,             // Opcional: Subtotal del item
      "valorIva": 47500,              // Opcional: Valor de IVA del item
      "total": 297500,                // Opcional: Total del item
      "cantidadFacturada": 0,         // Opcional: Cantidad facturada (default: 0)
      "cantidadDevuelta": 0           // Opcional: Cantidad devuelta (default: 0)
    }
  ]
}
```

---

## 🔄 FLUJO DE GUARDADO

1. **Validación de datos** (líneas 3881-3906)
   - Verifica que `clienteId` exista
   - Verifica que `items` sea un array y no esté vacío

2. **Inicio de transacción** (línea 3908-3910)
   - Se inicia una transacción SQL para garantizar atomicidad

3. **Validación de pedido** (líneas 3912-3945)
   - Si hay `pedidoId`, verifica que el pedido exista

4. **Validación de cliente** (líneas 3955-3977)
   - Verifica que el cliente exista y esté activo

5. **Validación de vendedor** (líneas 3979-4022)
   - Si hay `vendedorId`, verifica que el vendedor exista

6. **Generación de número de remisión** (líneas 4088-4154)
   - Si no se proporciona, genera automáticamente: REM-001, REM-002, etc.

7. **Generación de fecha** (líneas 4156-4168)
   - Si no se proporciona, usa la fecha actual

8. **INSERT en ven_remiciones_enc** (líneas 4238-4248)
   - Inserta el encabezado
   - Obtiene el `id` generado

9. **INSERT en ven_remiciones_det** (líneas 4250-4309)
   - Por cada item en el array, inserta un registro
   - Relaciona cada item con el `remision_id` del encabezado

10. **Actualización de estado del pedido** (líneas 4311-4399)
    - Si hay `pedidoId`, actualiza el estado del pedido según las cantidades remitidas

11. **COMMIT de la transacción** (línea 4402)
    - Confirma todos los cambios en la base de datos

---

## ⚠️ CAMPOS CRÍTICOS

### Para el encabezado:
- **`clienteId`**: REQUERIDO - Debe existir en `con_terceros`
- **`codalm`** o **`empresaId`**: Se usa como código de almacén (default: '001')

### Para los items:
- **`codProducto`** o **`codins`**: REQUERIDO - Código del producto que debe existir en `inv_insumos`
- **`cantidadEnviada`** o **`cantidad`**: REQUERIDO - Cantidad a enviar

---

## 📍 UBICACIÓN EN EL CÓDIGO

- **Archivo:** `app/back/server.cjs`
- **Endpoint:** `POST /api/remisiones` (línea 3857)
- **INSERT encabezado:** Líneas 4238-4248
- **INSERT detalle:** Líneas 4294-4299
- **COMMIT:** Línea 4402

---

## 🔍 VERIFICACIÓN EN BASE DE DATOS

Para verificar que se guardó correctamente:

```sql
-- Ver encabezado de remisión
SELECT * FROM ven_remiciones_enc WHERE id = [ID_REMISION];

-- Ver items de remisión
SELECT * FROM ven_remiciones_det WHERE remision_id = [ID_REMISION];

-- Ver remisión completa con items
SELECT 
  r.*,
  rd.id as detalle_id,
  rd.codins,
  rd.cantidad_enviada,
  rd.cantidad_facturada,
  rd.cantidad_devuelta
FROM ven_remiciones_enc r
LEFT JOIN ven_remiciones_det rd ON rd.remision_id = r.id
WHERE r.id = [ID_REMISION];
```

