# 🔍 Análisis: Error al Guardar Cotizaciones

## ❌ Error Principal

```
Transaction has not begun. Call begin() first.
POST http://192.168.1.8:3001/api/cotizaciones 500 (Internal Server Error)
```

## 🔎 Problemas Identificados

### 1. **Error de Transacción (RESUELTO)**
   - **Problema**: Después de hacer `tx.rollback()`, se intentaba usar la transacción para queries de debug
   - **Causa**: Una vez que se hace rollback, la transacción se cierra y no se puede usar más
   - **Solución**: 
     - Mover las queries de debug ANTES del rollback
     - Usar `pool` en lugar de `tx` para las queries de debug
     - Agregar try-catch alrededor del rollback para evitar errores si la transacción ya está cerrada

### 2. **Almacén "001" No Encontrado**
   - **Problema**: El código de almacén "001" no existe en la base de datos
   - **Causa**: El frontend está enviando `empresaId: "001"` pero ese almacén no existe o está inactivo
   - **Solución Necesaria**: 
     - Verificar qué almacenes existen realmente en `inv_almacen`
     - Asegurar que el código de bodega seleccionado en el frontend coincida con un almacén activo en la BD

## 📋 Flujo de Guardado de Cotizaciones

### Endpoint: `POST /api/cotizaciones`

1. **Validaciones Iniciales**:
   - ✅ Cliente (codter) existe y está activo
   - ✅ Vendedor (codi_emple) existe y está activo
   - ❌ **Almacén (codalm) existe y está activo** ← AQUÍ FALLA

2. **Generación de Número de Cotización**:
   - Si no se proporciona, genera automáticamente con formato `COT-XXX`

3. **Inserción en Base de Datos**:
   - Inserta en `ven_cotizacion` (cabecera)
   - Inserta en `ven_detacotizacion` (detalle) para cada item

4. **Commit de Transacción**:
   - Si todo es exitoso, hace commit
   - Si hay error, hace rollback

## 🔧 Cambios Aplicados

### 1. Corrección del Manejo de Errores
```javascript
// ANTES (INCORRECTO):
if (almacenResult.recordset.length === 0) {
  await tx.rollback();
  const reqDebug = new sql.Request(tx); // ❌ Error: transacción ya cerrada
  // ...
}

// DESPUÉS (CORRECTO):
if (almacenResult.recordset.length === 0) {
  // Query de debug ANTES del rollback usando pool
  const reqDebug = new sql.Request(pool);
  // ...
  await tx.rollback(); // Ahora sí se puede hacer rollback
}
```

### 2. Protección en Rollback
```javascript
try {
  await tx.rollback();
} catch (rollbackError) {
  // Si el rollback falla, puede ser porque la transacción ya fue cerrada
  console.error('⚠️ Error en rollback:', rollbackError.message);
}
```

## ⚠️ Problema Pendiente: Almacén No Encontrado

### Verificación Necesaria

Ejecutar esta query en la base de datos para ver qué almacenes existen:

```sql
SELECT codalm, nomalm, activo 
FROM inv_almacen 
WHERE activo = 1
ORDER BY codalm
```

### Posibles Causas

1. **El almacén "001" no existe**: Necesita crearse o usar otro código
2. **El almacén "001" está inactivo**: Cambiar `activo = 0` a `activo = 1`
3. **El código viene con formato incorrecto**: Verificar que el frontend envíe el código correcto

### Solución Temporal

Si no existe el almacén "001", se puede:
1. Crear el almacén en la BD
2. O modificar el frontend para usar un código de almacén que sí exista
3. O hacer que el backend use el primer almacén disponible si el enviado no existe

## 📊 Estructura de Datos

### Tabla: `ven_cotizacion`
- `codalm` (char(3)): Código de almacén - **DEBE EXISTIR EN inv_almacen**
- `numcot` (char(8)): Número de cotización
- `codter` (varchar(15)): Código de tercero/cliente
- `cod_vendedor` (char(10)): Código de vendedor
- `formapago` (nchar(2)): Forma de pago
- `valor_anticipo` (numeric): Valor de anticipo
- `num_orden_compra` (int): Número de orden de compra

### Tabla: `ven_detacotizacion`
- `id_cotizacion` (bigint): FK a ven_cotizacion
- `cod_producto` (char(8)): Código de producto
- `cantidad` (numeric): Cantidad
- `preciound` (numeric): Precio unitario
- `tasa_descuento` (numeric): Tasa de descuento
- `tasa_iva` (numeric): Tasa de IVA
- `valor` (numeric): Valor total

## ✅ Próximos Pasos

1. **Verificar almacenes en BD**: Ejecutar query para ver qué códigos existen
2. **Ajustar frontend**: Asegurar que el código de bodega enviado exista en la BD
3. **Probar guardado**: Intentar crear una cotización con un código de almacén válido
4. **Validar datos**: Verificar que todos los campos requeridos se envíen correctamente

## 🔍 Logs de Debug

El backend ahora muestra:
- Ejemplos de almacenes disponibles cuando no se encuentra el solicitado
- Ejemplos de clientes disponibles cuando no se encuentra el solicitado
- Ejemplos de vendedores disponibles cuando no se encuentra el solicitado

Esto ayuda a identificar qué valores son válidos en la base de datos.

