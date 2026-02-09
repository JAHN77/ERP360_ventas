# SOLUCIÓN AL PROBLEMA DE ITEMS NO ENCONTRADOS

## Problema Identificado

El error "Producto 13 no encontrado" ocurre porque:

1. **El frontend envía `productoId` como STRING** (ej: `'001'`, `'013'`)
2. **El backend hace `parseInt('013', 10)`** que da `13` (pierde el cero inicial)
3. **En `ven_servicios`, el campo `codser` es VARCHAR** y almacena `'013'` con el cero
4. **El backend busca por ID numérico `13`** en lugar de por código `'013'`

## Solución

Modificar el archivo `/app/back/controllers/invoiceController.js` en la línea 833-857.

### Código Actual (INCORRECTO):
```javascript
// Línea 834
let productoIdNum = typeof it.productoId === 'number' ? it.productoId : parseInt(it.productoId, 10);

// Línea 838
const codProducto = String(it.codProducto || it.referencia || '').trim();
```

### Código Corregido (CORRECTO):
```javascript
// IMPORTANTE: Si productoId es un string (ej: '001', '013'), usarlo como código directamente
const isStringCode = typeof it.productoId === 'string' && it.productoId.trim().length > 0;
let productoIdNum = -1;
let codProducto = '';

if (isStringCode) {
  // productoId es un código string, usarlo directamente para preservar ceros
  codProducto = String(it.productoId).trim();
  console.log(`🔍 Item ${idx + 1}: productoId es código string: "${codProducto}"`);
} else {
  // productoId es número o no válido, intentar parsearlo
  productoIdNum = typeof it.productoId === 'number' ? it.productoId : parseInt(it.productoId, 10);
  codProducto = String(it.codProducto || it.referencia || '').trim();
}
```

## Instrucciones de Aplicación Manual

1. Abre el archivo: `/Users/tecnicell/Desktop/erp/ERP360_ventas/app/back/controllers/invoiceController.js`

2. Busca la línea 833-838 que dice:
   ```javascript
   // Intentar obtener productoId del item
   let productoIdNum = typeof it.productoId === 'number' ? it.productoId : parseInt(it.productoId, 10);

   // Si productoId no es válido, intentar buscarlo en la BD usando codProducto
   if (isNaN(productoIdNum) || productoIdNum <= 0) {
     const codProducto = String(it.codProducto || it.referencia || '').trim();
   ```

3. Reemplázala con:
   ```javascript
   // Intentar obtener productoId del item
   // IMPORTANTE: Si productoId es un string (ej: '001', '013'), usarlo como código directamente
   const isStringCode = typeof it.productoId === 'string' && it.productoId.trim().length > 0;
   let productoIdNum = -1;
   let codProducto = '';
   
   if (isStringCode) {
     // productoId es un código string, usarlo directamente para preservar ceros
     codProducto = String(it.productoId).trim();
     console.log(`🔍 Item ${idx + 1}: productoId es código string: "${codProducto}"`);
   } else {
     // productoId es número o no válido, intentar parsearlo
     productoIdNum = typeof it.productoId === 'number' ? it.productoId : parseInt(it.productoId, 10);
     codProducto = String(it.codProducto || it.referencia || '').trim();
   }

   // Si productoId no es válido O es código string, buscar en BD
   if (isNaN(productoIdNum) || productoIdNum <= 0 || isStringCode) {
     if (!codProducto) {
       throw new Error(`Item ${idx + 1}: Se requiere productoId o codProducto válido`);
     }
   ```

4. Modifica también la línea 851-853 que dice:
   ```javascript
   if (buscarResult.recordset.length === 0) {
     throw new Error(`Item ${idx + 1}: Producto con código "${codProducto}" no encontrado en inventario`);
   }
   ```

   Reemplázala con:
   ```javascript
   if (buscarResult.recordset.length === 0) {
     // No está en inv_insumos, se buscará en ven_servicios más adelante
     console.log(`⚠️ Item ${idx + 1}: Código "${codProducto}" no encontrado en inv_insumos, se buscará en ven_servicios`);
     productoIdNum = -1; // Marcar para buscar en servicios
   } else {
     productoIdNum = buscarResult.recordset[0].id;
     console.log(`✅ Item ${idx + 1}: productoId encontrado automáticamente: ${productoIdNum} para código ${codProducto}`);
   }
   ```

5. Elimina las líneas 855-856:
   ```javascript
   productoIdNum = buscarResult.recordset[0].id;
   console.log(`✅ Item ${idx + 1}: productoId encontrado automáticamente: ${productoIdNum} para código ${codProducto}`);
   ```

6. Guarda el archivo y reinicia el servidor backend.

## Resultado Esperado

Después de aplicar estos cambios:
- ✅ Los códigos con ceros iniciales (`'001'`, `'013'`) se preservarán correctamente
- ✅ El backend buscará primero en `inv_insumos` y luego en `ven_servicios`
- ✅ Las facturas se guardarán correctamente en la base de datos

## Archivo de Respaldo

Se ha creado un respaldo en:
`/Users/tecnicell/Desktop/erp/ERP360_ventas/app/back/controllers/invoiceController.js.backup`

Si algo sale mal, puedes restaurarlo con:
```bash
cp /Users/tecnicell/Desktop/erp/ERP360_ventas/app/back/controllers/invoiceController.js.backup /Users/tecnicell/Desktop/erp/ERP360_ventas/app/back/controllers/invoiceController.js
```
