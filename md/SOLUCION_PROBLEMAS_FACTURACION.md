# 🔧 SOLUCIÓN DE PROBLEMAS AL FACTURAR

## ✅ ERRORES CORREGIDOS

### 1. ✅ Error: "Assignment to constant variable"
**Ubicación:** `dian-service.cjs` línea 753
**Problema:** `finalBodyString` estaba declarado como `const` pero se intentaba reasignar
**Solución:** Cambiado a `let finalBodyString`

### 2. ✅ Error: "trackId cannot be an array or an object"
**Ubicación:** `dian-service.cjs` múltiples líneas
**Problema:** `trackId` se enviaba cuando `sync: false` o como array/objeto
**Solución:** 
- Eliminación de `trackId` cuando `sync: false` en 5 puntos diferentes
- Validación y conversión a string cuando `sync: true`
- Verificación final antes de enviar el body

---

## 🔍 PROBLEMAS COMUNES Y SOLUCIONES

### Problema 1: Cliente no encontrado
**Error:** `CLIENTE_NOT_FOUND`
**Causa:** El `clienteId` no existe en `con_terceros`
**Solución:**
- Verificar que el código del cliente sea correcto
- Verificar que no haya espacios en blanco
- Revisar los logs para ver clientes similares sugeridos

### Problema 2: Cliente inactivo
**Error:** `CLIENTE_INACTIVO`
**Causa:** El cliente existe pero está marcado como inactivo
**Solución:**
- Activar el cliente en la base de datos
- Actualizar `activo = 1` en `con_terceros`

### Problema 3: Vendedor no encontrado o inactivo
**Error:** `VENDEDOR_NOT_FOUND` o `VENDEDOR_INACTIVO`
**Causa:** El vendedor no existe o está inactivo
**Solución:**
- Verificar que el código del vendedor sea correcto
- Activar el vendedor en `ven_vendedor`
- Omitir el vendedor si no es requerido

### Problema 4: Remisión sin items
**Error:** `REMISION_SIN_ITEMS`
**Causa:** La remisión no tiene items con `cantidad_enviada > 0`
**Solución:**
- Verificar que la remisión tenga items
- Verificar que los items tengan `cantidad_enviada > 0`

### Problema 5: Items sin precios
**Error:** `precioUnitario inválido`
**Causa:** Los items de la remisión no tienen precios desde el pedido relacionado
**Solución:**
- Verificar que el pedido relacionado tenga precios
- Verificar que la relación entre remisión y pedido sea correcta

### Problema 6: Producto no encontrado
**Error:** `Producto con ID X no encontrado en inv_insumos`
**Causa:** El `productoId` no existe en `inv_insumos`
**Solución:**
- Verificar que el producto exista
- Verificar que el `productoId` sea correcto

### Problema 7: Error al timbrar - trackId
**Error:** `string violation: trackId cannot be an array or an object`
**Causa:** `trackId` presente cuando `sync: false` o formato incorrecto
**Solución:** ✅ Ya corregido - `trackId` se elimina cuando `sync: false`

### Problema 8: Error al timbrar - Assignment to constant
**Error:** `Assignment to constant variable`
**Causa:** Variable `const` intentando reasignarse
**Solución:** ✅ Ya corregido - cambiado a `let`

---

## 📋 CHECKLIST DE VALIDACIÓN

Antes de facturar, verificar:

- [ ] Cliente existe y está activo
- [ ] Vendedor existe y está activo (si se proporciona)
- [ ] Remisión tiene items con `cantidad_enviada > 0`
- [ ] Items tienen precios válidos
- [ ] Productos existen en `inv_insumos`
- [ ] Totales calculados correctamente
- [ ] Parámetros DIAN configurados correctamente

---

## 🔍 CÓMO REVISAR LOS LOGS

### 1. Logs del Backend (Terminal del servidor)
Buscar:
- `❌ ERROR` - Errores críticos
- `⚠️ ADVERTENCIA` - Advertencias
- `📋 [TIMBRADO]` - Proceso de timbrado
- `📦 [DIAN]` - Interacción con DIAN

### 2. Logs del Frontend (Consola del navegador)
Buscar:
- `🚀 [FRONTEND]` - Inicio de procesos
- `📤 [DataContext]` - Envío de peticiones
- `📥 [API Response]` - Respuestas del backend
- `❌ Error` - Errores del frontend

### 3. Logs Específicos de Facturación
- `POST /api/facturas` - Creación de factura
- `PUT /api/facturas/:id` - Actualización/timbrado
- `[TIMBRADO] PASO X` - Pasos del proceso de timbrado

---

## 🛠️ PASOS PARA DIAGNOSTICAR

1. **Revisar logs del backend** cuando intentas facturar
2. **Identificar el error específico** (mensaje y stack trace)
3. **Verificar los datos** que se están enviando
4. **Revisar las validaciones** que están fallando
5. **Corregir el problema** según la solución correspondiente

---

## 📝 EJEMPLO DE LOGS ESPERADOS

### ✅ Creación exitosa:
```
📥 Recibida solicitud POST /api/facturas
✅ Se obtuvieron X items desde la remisión Y
✅ [Backend] Cliente válido y activo
✅ [Backend] Vendedor válido y activo
✅ Factura creada exitosamente: ID=Z
```

### ❌ Error común:
```
❌ [Backend] Cliente inactivo detectado
❌ Error: CLIENTE_INACTIVO
```

---

## 🎯 PRÓXIMOS PASOS

Si sigues teniendo problemas:

1. **Comparte los logs específicos** del error
2. **Indica qué operación** estás intentando (crear factura, timbrar, etc.)
3. **Menciona el mensaje de error exacto** que aparece
4. **Incluye el stack trace** si está disponible

Con esta información podré identificar y solucionar el problema específico.

