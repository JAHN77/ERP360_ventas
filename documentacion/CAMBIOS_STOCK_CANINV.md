# Cambios Realizados: Uso de caninv para Stock

**Fecha:** 2024-11-10  
**Archivo:** `app/back/server.cjs` y `app/back/services/dbConfig.cjs`

## 📋 Resumen

Se actualizó el código para usar la columna `caninv` (cantidad de inventario) de la tabla `inv_invent` en lugar de `ucoins` (unidades en existencia) para obtener el stock de productos.

## 🔄 Cambios Realizados

### 1. Consultas de Productos

#### ✅ `dbConfig.cjs` - GET_PRODUCTOS
- **Antes:** `COALESCE(SUM(inv.ucoins), 0) AS stock`
- **Ahora:** `COALESCE(SUM(inv.caninv), 0) AS stock`

#### ✅ `dbConfig.cjs` - GET_PRODUCTOS_MIN
- **Antes:** `COALESCE(SUM(inv.ucoins), 0) AS stock`
- **Ahora:** `COALESCE(SUM(inv.caninv), 0) AS stock`

### 2. Búsqueda de Productos

#### ✅ `server.cjs` - GET /api/buscar/productos
- **Antes:** `COALESCE(SUM(inv.ucoins), 0) AS stock`
- **Ahora:** `COALESCE(SUM(inv.caninv), 0) AS stock`

### 3. Entradas de Inventario

#### ✅ `server.cjs` - POST /api/inventario/entradas

**Cambios realizados:**
1. **SELECT:** Ahora consulta `caninv` en lugar de `ucoins`
2. **UPDATE:** Actualiza `caninv` en lugar de `ucoins`
3. **INSERT:** Inserta en `caninv` en lugar de `ucoins`
4. **Estructura de tabla:** Corregido para usar `codalm + codins` como clave (NO usa `id`)
5. **Eliminado:** Campo `ultima_actualizacion` (no existe en la tabla real)

**Código actualizado:**
```javascript
// SELECT - Obtener inventario existente
SELECT TOP 1 caninv, valinv
FROM inv_invent
WHERE codins = @codins AND codalm = @codalm

// UPDATE - Actualizar inventario existente
UPDATE inv_invent
SET 
  caninv = COALESCE(caninv, 0) + @cantidad,
  valinv = COALESCE(valinv, 0) + @valor
WHERE codins = @codins AND codalm = @codalm

// INSERT - Crear nuevo registro de inventario
INSERT INTO inv_invent (codins, codalm, caninv, valinv)
VALUES (@codins, @codalm, @cantidad, @valor)
```

### 4. Consulta de Producto Actualizado

#### ✅ `server.cjs` - Después de entrada de inventario
- **Antes:** `COALESCE(SUM(inv.ucoins), 0) AS stock`
- **Ahora:** `COALESCE(SUM(inv.caninv), 0) AS stock`

## 🔍 Estructura de la Tabla inv_invent

### Columnas Reales:
- `codalm` (CHAR(3)) - Código de almacén/bodega (PRIMARY KEY parte 1)
- `codins` (CHAR(8)) - Código de insumo/producto (PRIMARY KEY parte 2)
- `caninv` (NUMERIC) - **Cantidad de inventario** ✅ (USADO PARA STOCK)
- `valinv` (NUMERIC) - Valor de inventario
- `ucoins` (NUMERIC) - Unidades en existencia (NO SE USA)
- `pvdins` (NUMERIC) - Precio de venta
- `minimo` (INT) - Stock mínimo
- `maximo` (INT) - Stock máximo

### ⚠️ Importante:
- **NO tiene columna `id`** (IDENTITY)
- **NO tiene columna `ultima_actualizacion`**
- La clave primaria es la combinación de `codalm + codins`
- `codins` debe ser exactamente 8 caracteres (CHAR(8))
- `codalm` debe ser exactamente 3 caracteres (CHAR(3))

## 📊 Formato de Datos

### codins (CHAR(8)):
- Ejemplo: `"01010001"`
- Formato: 8 caracteres fijos
- Se formatea con `padEnd(8, ' ')` si es necesario

### codalm (CHAR(3)):
- Ejemplo: `"001"` o `"   "` (espacios)
- Formato: 3 caracteres fijos
- Se normaliza con `padStart(3, '0')`

## ✅ Resultado

Ahora todas las consultas de stock usan `caninv`:
- ✅ GET /api/productos - Muestra stock desde `caninv`
- ✅ GET /api/buscar/productos - Muestra stock desde `caninv`
- ✅ POST /api/inventario/entradas - Actualiza `caninv`
- ✅ Consultas después de entrada - Muestran stock actualizado desde `caninv`

## 🧪 Pruebas Recomendadas

1. **Verificar stock en productos:**
   - GET /api/productos
   - Verificar que el stock mostrado coincide con `caninv` en la BD

2. **Buscar productos:**
   - GET /api/buscar/productos?search=...
   - Verificar que el stock se muestra correctamente

3. **Entrada de inventario:**
   - POST /api/inventario/entradas
   - Verificar que `caninv` se actualiza correctamente
   - Verificar que el stock retornado es correcto

4. **Verificar formato:**
   - Verificar que `codins` se formatea correctamente (8 caracteres)
   - Verificar que `codalm` se formatea correctamente (3 caracteres)

## 📝 Archivos Modificados

1. `app/back/services/dbConfig.cjs`
   - Línea 95: GET_PRODUCTOS - Cambiado `ucoins` a `caninv`
   - Línea 122: GET_PRODUCTOS_MIN - Cambiado `ucoins` a `caninv`

2. `app/back/server.cjs`
   - Línea 326: GET /api/buscar/productos - Cambiado `ucoins` a `caninv`
   - Líneas 558-597: POST /api/inventario/entradas - Cambiado a usar `caninv` y corregida estructura
   - Línea 629: Consulta de producto actualizado - Cambiado `ucoins` a `caninv`

## 🎯 Estado

- ✅ Todas las consultas de stock actualizadas
- ✅ Entradas de inventario actualizadas
- ✅ Estructura de tabla corregida (sin `id`, sin `ultima_actualizacion`)
- ✅ Formato de `codins` y `codalm` corregido
- ✅ Sin errores de lint

---

**Documento generado:** 2024-11-10  
**Versión:** 1.0

