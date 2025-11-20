# 📋 Resumen: API de Remisiones - Body y Proceso de Guardado

## 🔗 ENDPOINT DE LA API

**URL Completa:** `http://localhost:3001/api/remisiones`  
**Método:** `POST`  
**Content-Type:** `application/json`

---

## 📤 BODY QUE SE ENVÍA (Ejemplo Real)

```json
{
  "pedidoId": null,
  "clienteId": "72266545",
  "vendedorId": null,
  "fechaRemision": "2025-11-18",
  "fechaDespacho": null,
  "subtotal": 879147.15,
  "descuentoValor": 0,
  "ivaValor": 167037.9585,
  "total": 1046185.1085,
  "observaciones": "Remisión de prueba - Test detallado de guardado",
  "estado": "BORRADOR",
  "empresaId": "001",
  "codalm": "001",
  "codusu": "TEST_USER",
  "items": [
    {
      "productoId": 2289,
      "cantidad": 5,
      "codProducto": "02800032",
      "cantidadEnviada": 5,
      "detaPedidoId": null,
      "precioUnitario": 1092.43,
      "descuentoPorcentaje": 0,
      "ivaPorcentaje": 19,
      "descripcion": "BUJES SAMURAY- VOLMO",
      "subtotal": 5462.15,
      "valorIva": 1037.81,
      "total": 6499.96,
      "cantidadFacturada": 0,
      "cantidadDevuelta": 0
    }
  ]
}
```

---

## 🗄️ CÓMO SE GUARDA EN LA BASE DE DATOS

### 1️⃣ TABLA: `ven_remisiones_enc` (Encabezado)

**Campos que se guardan:**

| Campo en Body | Campo en BD | Valor Ejemplo | Descripción |
|---------------|-------------|---------------|-------------|
| `codalm` o `empresaId` | `codalm` | `"001"` | Código de almacén |
| (auto-generado) | `numero_remision` | `"REM-008"` | Número de remisión |
| `fechaRemision` | `fecha_remision` | `"2025-11-18"` | Fecha de remisión |
| `pedidoId` | `pedido_id` | `NULL` | ID del pedido relacionado |
| `clienteId` | `codter` | `"72266545"` | Código del cliente |
| `vendedorId` | `codven` | `NULL` | Código del vendedor |
| `estado` | `estado` | `"BORRADOR"` | Estado de la remisión |
| `observaciones` | `observaciones` | `"Remisión de prueba..."` | Observaciones |
| `codusu` | `codusu` | `"TEST_USER"` | Usuario que crea |
| (auto) | `fec_creacion` | `2025-11-18 10:30:00` | Fecha de creación |
| (auto) | `id` | `13` | ID único (IDENTITY) |

**SQL que se ejecuta:**
```sql
INSERT INTO ven_remisiones_enc (
  codalm, numero_remision, fecha_remision,
  pedido_id, codter, codven, estado, observaciones, codusu, fec_creacion
) VALUES (
  '001', 'REM-008', '2025-11-18',
  NULL, '72266545', NULL, 'BORRADOR', 'Remisión de prueba...', 'TEST_USER', GETDATE()
);
SELECT SCOPE_IDENTITY() AS id;
```

---

### 2️⃣ TABLA: `ven_remisiones_det` (Detalle/Items)

**Por cada item en el array `items`:**

| Campo en Body | Campo en BD | Valor Ejemplo | Descripción |
|---------------|-------------|---------------|-------------|
| (del encabezado) | `remision_id` | `13` | ID de la remisión (FK) |
| `detaPedidoId` | `deta_pedido_id` | `NULL` | ID del detalle del pedido |
| `codProducto` | `codins` | `"02800032"` | Código del producto |
| `cantidadEnviada` | `cantidad_enviada` | `5` | Cantidad enviada |
| `cantidadFacturada` | `cantidad_facturada` | `0` | Cantidad facturada |
| `cantidadDevuelta` | `cantidad_devuelta` | `0` | Cantidad devuelta |
| (auto) | `id` | `25` | ID único (IDENTITY) |

**SQL que se ejecuta (por cada item):**
```sql
INSERT INTO ven_remisiones_det (
  remision_id, deta_pedido_id, codins, 
  cantidad_enviada, cantidad_facturada, cantidad_devuelta
) VALUES (
  13, NULL, '02800032', 
  5, 0, 0
);
```

---

## 🔄 FLUJO COMPLETO DEL PROCESO

1. **Recibe el request** en `POST /api/remisiones`
2. **Valida datos:**
   - Verifica que `clienteId` exista
   - Verifica que `items` sea un array y no esté vacío
3. **Inicia transacción SQL**
4. **Valida cliente** en `con_terceros`
5. **Valida vendedor** (si se proporciona) en `ven_vendedor`
6. **Genera número de remisión** automáticamente si no se proporciona (REM-001, REM-002, etc.)
7. **INSERT en `ven_remisiones_enc`** → Obtiene el `id` generado
8. **INSERT en `ven_remisiones_det`** → Por cada item del array
9. **Actualiza estado del pedido** (si hay `pedidoId`)
10. **COMMIT de la transacción**
11. **Responde** con `{ success: true, data: { id: 13 } }`

---

## 📍 UBICACIÓN EN EL CÓDIGO

- **Archivo:** `app/back/server.cjs`
- **Endpoint:** Línea 3857 (`app.post('/api/remisiones', ...)`)
- **INSERT encabezado:** Líneas 4238-4248
- **INSERT detalle:** Líneas 4294-4299
- **COMMIT:** Línea 4402

---

## ⚠️ CAMPOS CRÍTICOS

### Requeridos:
- ✅ `clienteId`: Debe existir en `con_terceros`
- ✅ `items`: Array con al menos un item
- ✅ `codProducto` en cada item: Debe existir en `inv_insumos`

### Opcionales pero importantes:
- `pedidoId`: Si se proporciona, se relaciona con el pedido
- `codalm` o `empresaId`: Código de almacén (default: '001')
- `fechaRemision`: Si no se envía, usa fecha actual
- `numeroRemision`: Si no se envía, se genera automáticamente

---

## 🧪 PRUEBA MANUAL

Para probar, ejecuta:
```bash
cd app/back
node test-api-remision-detallado.js
```

Este script:
1. Obtiene datos reales de la BD (cliente y productos)
2. Construye el payload
3. Muestra el body completo
4. Envía la petición POST
5. Verifica que se guardó correctamente
6. Muestra los datos guardados en las 3 tablas

---

## 📊 VERIFICACIÓN EN BASE DE DATOS

```sql
-- Ver última remisión creada
SELECT TOP 1 * FROM ven_remisiones_enc ORDER BY id DESC;

-- Ver items de la última remisión
SELECT * FROM ven_remisiones_det 
WHERE remision_id = (SELECT TOP 1 id FROM ven_remisiones_enc ORDER BY id DESC);
```

