# Cambios Realizados: Adaptación de ven_vendedor a Columnas Reales

**Fecha:** 2024-11-10  
**Archivo:** `app/back/server.cjs`

## 📋 Resumen

Se adaptó el código del backend para usar las **columnas reales** de la tabla `ven_vendedor` en lugar de las columnas que no existen en la base de datos.

## 🔄 Mapeo de Columnas

### Columnas que el código esperaba (NO EXISTEN):
- `codi_emple`
- `nomb_emple`
- `codi_labor`
- `cedula`
- `email`
- `activo`

### Columnas reales en la BD:
- `ideven` (INT) - ID del empleado
- `nomven` (CHAR(50)) - Nombre del vendedor
- `codven` (CHAR(3)) - Código del vendedor
- `Activo` (BIT) - Estado activo
- `codalm` (CHAR(3)) - Almacén
- `telven`, `celven`, `dirven`, `codusu`

### Mapeo Aplicado:
| Columna Esperada | Columna Real | Transformación |
|-----------------|--------------|----------------|
| `codi_emple` | `ideven` | `CAST(ideven AS VARCHAR(20))` |
| `nomb_emple` | `nomven` | `LTRIM(RTRIM(nomven))` |
| `codi_labor` | `codven` | `codven` directamente |
| `cedula` | `ideven` | `CAST(ideven AS VARCHAR(20))` |
| `email` | No existe | `''` (vacío) |
| `activo` | `Activo` | `CAST(Activo AS INT)` |

## ✅ Cambios Realizados

### 1. Endpoint GET /api/buscar/vendedores (línea 258-310)
- ✅ Actualizado para usar `ideven`, `nomven`, `codven`, `Activo`
- ✅ Búsqueda por nombre, código de vendedor o ID de empleado
- ✅ Filtrado por `Activo = 1`

### 2. Endpoint GET /api/vendedores (línea 1771-1812)
- ✅ Actualizado para usar columnas reales
- ✅ Mapeo de `ideven` a `id` y `codiEmple`
- ✅ Mapeo de `nomven` a `nombreCompleto`
- ✅ Mapeo de `codven` a `codigoVendedor`

### 3. Validación de Vendedor en Creación de Cotizaciones (línea 2014-2067)
- ✅ Búsqueda por `ideven` (si es numérico) o `codven` (si es string)
- ✅ Validación de que el vendedor existe y está activo
- ✅ Uso de `codven` para insertar en `ven_cotizacion.cod_vendedor` (CHAR(10))

### 4. Validación de Vendedor en Creación de Pedidos (línea 2678-2719)
- ✅ Búsqueda flexible por `ideven` o `codven`
- ✅ Validación de existencia y estado activo
- ✅ Retorna `codi_emple` (mapeado desde `ideven`) para usar en pedidos

### 5. Validación de Vendedor en Creación de Remisiones (línea 3236-3279)
- ✅ Búsqueda flexible por `ideven` o `codven`
- ✅ Validación opcional (puede ser null)
- ✅ Retorna `codi_emple` para usar en remisiones

### 6. Validación de Vendedor en Creación de Facturas (línea 3926-4009)
- ✅ Búsqueda flexible por `ideven` o `codven`
- ✅ Validación de estado activo con manejo de BIT
- ✅ Mensajes de error mejorados

## 🔍 Lógica de Búsqueda

El código ahora soporta búsqueda flexible:
- Si el `vendedorId` es **numérico**: busca por `ideven` (INT)
- Si el `vendedorId` es **string**: busca por `codven` (CHAR(3))

```javascript
const idevenNum = parseInt(vendedorIdStr, 10);
const isNumeric = !isNaN(idevenNum) && String(idevenNum) === vendedorIdStr;

if (isNumeric) {
  // Buscar por ideven
  reqVendedor.input('ideven', sql.Int, idevenNum);
  vendedorQuery = `SELECT ... WHERE ideven = @ideven AND Activo = 1`;
} else {
  // Buscar por codven
  reqVendedor.input('codven', sql.VarChar(20), vendedorIdStr);
  vendedorQuery = `SELECT ... WHERE codven = @codven AND Activo = 1`;
}
```

## 📝 Notas Importantes

### 1. Compatibilidad con ven_cotizacion
- La tabla `ven_cotizacion.cod_vendedor` es `CHAR(10)`
- Se usa el `codven` del vendedor (CHAR(3)) truncado/padded a 10 caracteres
- Si no hay `codven`, se usa el `ideven` convertido a string

### 2. Compatibilidad con ven_pedidos y ven_recibos
- Los campos `vendedor_id` son `VARCHAR(20)`
- Se usa el `codi_emple` mapeado (que viene de `ideven` convertido a VARCHAR)

### 3. Clientes (con_terceros)
- El campo `codven` en `con_terceros` es `CHAR(3)` (código de vendedor)
- Este campo NO se modifica en estos cambios
- Se mantiene la compatibilidad existente

## 🧪 Pruebas Recomendadas

1. **GET /api/vendedores**
   - Verificar que retorna la lista de vendedores activos
   - Verificar que los nombres se muestran correctamente (sin espacios extras)

2. **GET /api/buscar/vendedores?search=...**
   - Probar búsqueda por nombre
   - Probar búsqueda por código de vendedor
   - Probar búsqueda por ID de empleado

3. **Crear Cotización con Vendedor**
   - Probar con `vendedorId` numérico (ideven)
   - Probar con `vendedorId` string (codven)
   - Verificar que se guarda correctamente en `ven_cotizacion`

4. **Crear Pedido con Vendedor**
   - Probar con diferentes formatos de `vendedorId`
   - Verificar validación de vendedor activo

5. **Crear Remisión con Vendedor**
   - Probar con vendedor válido
   - Probar sin vendedor (debe ser opcional)

6. **Crear Factura con Vendedor**
   - Probar con vendedor válido y activo
   - Probar con vendedor inactivo (debe dar error)

## 🚨 Posibles Problemas

1. **Vendedores con codven NULL o vacío**
   - Si un vendedor no tiene `codven`, puede haber problemas al insertar en `ven_cotizacion`
   - **Solución:** El código usa un fallback con el `ideven` convertido

2. **Vendedores inactivos**
   - El código valida que `Activo = 1`
   - Vendedores inactivos no aparecerán en búsquedas ni se podrán asignar

3. **Formato de nombres**
   - Los nombres vienen de `nomven` que es `CHAR(50)` (con padding de espacios)
   - Se usa `LTRIM(RTRIM(nomven))` para eliminar espacios

## 📊 Ejemplo de Datos

### Vendedor en BD:
```
ideven: 72345444
nomven: "VENDEDOR INACTIVO                                 "
codven: "002"
Activo: false
```

### Resultado en API:
```json
{
  "id": "72345444",
  "codiEmple": "72345444",
  "codigoVendedor": "002",
  "nombreCompleto": "VENDEDOR INACTIVO",
  "primerNombre": "VENDEDOR",
  "primerApellido": "INACTIVO",
  "activo": 0
}
```

## ✅ Estado

- ✅ Todas las consultas actualizadas
- ✅ Validaciones adaptadas
- ✅ Mapeo de columnas implementado
- ✅ Búsqueda flexible implementada
- ✅ Compatibilidad con tablas relacionadas mantenida

## 📝 Archivos Modificados

1. `app/back/server.cjs`
   - Líneas 258-310: GET /api/buscar/vendedores
   - Líneas 1771-1812: GET /api/vendedores
   - Líneas 2014-2275: Validación en creación de cotizaciones
   - Líneas 2678-2719: Validación en creación de pedidos
   - Líneas 3236-3279: Validación en creación de remisiones
   - Líneas 3926-4009: Validación en creación de facturas

## 🎯 Próximos Pasos

1. Probar todas las funcionalidades con vendedores reales
2. Verificar que los vendedores se muestran correctamente en el frontend
3. Verificar que las cotizaciones, pedidos, remisiones y facturas se crean correctamente con vendedores
4. Si hay problemas, revisar los logs del servidor para ver los mensajes de error

---

**Documento generado:** 2024-11-10  
**Versión:** 1.0

