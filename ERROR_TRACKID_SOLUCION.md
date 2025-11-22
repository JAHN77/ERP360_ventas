# 🔴 ERROR: "trackId cannot be an array or an object"

## 📋 DESCRIPCIÓN DEL ERROR

**Error recibido de la API DIAN:**
```json
{
  "message": "Error al procesar la consulta",
  "error": {
    "status": 500,
    "message": "string violation: trackId cannot be an array or an object"
  }
}
```

---

## 🔍 ¿QUÉ SIGNIFICA ESTE ERROR?

La API de DIAN está rechazando la factura porque el campo `trackId` está siendo enviado con un formato incorrecto:

- ❌ **Array**: `trackId: [1, 2, 3]` o `trackId: []`
- ❌ **Objeto**: `trackId: { id: 1 }` o `trackId: {}`
- ✅ **String**: `trackId: "track-123"` (solo si `sync: true`)
- ✅ **No presente**: Si `sync: false`, `trackId` NO debe estar en el JSON

---

## 🔍 ¿QUÉ ESTAMOS ENVIANDO ACTUALMENTE?

### ❌ PROBLEMA IDENTIFICADO:

Cuando `sync: false`, el campo `trackId` **NO debe estar presente** en el JSON que se envía a la API de DIAN.

**Formato INCORRECTO (causa el error):**
```json
{
  "sync": false,
  "trackId": null,        // ❌ ERROR: No debe estar presente
  "trackId": [],          // ❌ ERROR: Array
  "trackId": {},          // ❌ ERROR: Objeto
  "number": 244,
  ...
}
```

**Formato CORRECTO:**
```json
{
  "sync": false,
  // trackId NO está presente ✅
  "number": 244,
  ...
}
```

---

## 🔧 SOLUCIÓN IMPLEMENTADA

### 1. Validación en `transformVenFacturaForDIAN()`

**Ubicación:** `dian-service.cjs` línea 447-463

```javascript
// Si sync es false, NO incluir trackId
const syncValue = config?.sync === true;
const trackIdValue = syncValue 
  ? (invoiceData?.trackId || `track-${invoiceNumber}-${Date.now()}`)
  : null;

const dianJson = {
  // ... otros campos
  sync: syncValue,
  // Solo incluir trackId si sync es true
  ...(syncValue && trackIdValue ? { trackId: String(trackIdValue) } : {}),
  // ... resto de campos
};
```

### 2. Validación en `sendInvoiceToDIAN()`

**Ubicación:** `dian-service.cjs` línea 584-607

```javascript
// Si sync es false, eliminar trackId completamente
if (invoiceJson.sync === false) {
  if (invoiceJson.trackId !== undefined) {
    console.log('🔧 [DIAN] sync es false, removiendo trackId del JSON');
    delete invoiceJson.trackId;
  }
}
```

### 3. Validación Final Antes de Enviar

**Ubicación:** `dian-service.cjs` línea 654-692

```javascript
// Crear copia limpia del JSON
const cleanJson = JSON.parse(JSON.stringify(invoiceJson));

// Verificar nuevamente
if (cleanJson.sync === false && 'trackId' in cleanJson) {
  delete cleanJson.trackId;
}

// Verificar en el string JSON
const bodyString = JSON.stringify(cleanJson);
if (cleanJson.sync === false && bodyString.toLowerCase().includes('trackid')) {
  // Eliminar trackId del string
  const jsonObj = JSON.parse(bodyString);
  delete jsonObj.trackId;
  bodyString = JSON.stringify(jsonObj);
}
```

---

## 📊 COMPARATIVA: ANTES vs DESPUÉS

### ❌ ANTES (Causaba Error):

```json
{
  "number": 244,
  "sync": false,
  "trackId": null,        // ❌ Presente aunque sea null
  "issue_date": "2025-11-22",
  ...
}
```

### ✅ DESPUÉS (Correcto):

```json
{
  "number": 244,
  "sync": false,
  // trackId NO está presente ✅
  "issue_date": "2025-11-22",
  ...
}
```

---

## 🔍 VALIDACIONES AGREGADAS

1. ✅ **Validación en invoiceData**: Verifica que `trackId` no sea array/objeto antes de usarlo
2. ✅ **Validación en construcción del JSON**: Solo incluye `trackId` si `sync: true`
3. ✅ **Validación antes de enviar**: Elimina `trackId` si `sync: false`
4. ✅ **Validación en copia limpia**: Crea copia limpia y verifica nuevamente
5. ✅ **Validación en string JSON**: Busca `trackId` en el string y lo elimina si existe
6. ✅ **Logs detallados**: Muestra exactamente qué se está enviando

---

## 📝 LOGS QUE VERÁS

Cuando intentes timbrar, verás estos logs:

```
🔍 [DIAN] VALIDACIÓN FINAL DEL JSON ANTES DE ENVIAR:
   - sync: false
   - trackId presente: false
   - trackId en objeto: false

🔍 [DIAN] VERIFICACIÓN EN COPIA LIMPIA:
   - sync: false
   - trackId presente: false
   - Claves del objeto: ["number", "sync", "issue_date", ...]

📋 [DIAN] VERIFICACIÓN FINAL ANTES DE ENVIAR:
   - sync: false
   - trackId en objeto: false
   - trackId en string: NO ✅
```

---

## ✅ RESULTADO ESPERADO

Después de las correcciones:

1. ✅ Si `sync: false` → `trackId` NO estará en el JSON
2. ✅ Si `sync: true` → `trackId` será un string válido
3. ✅ El JSON se validará múltiples veces antes de enviar
4. ✅ Los logs mostrarán exactamente qué se está enviando

---

## 🎯 PRÓXIMOS PASOS

1. **Intenta timbrar una factura nuevamente**
2. **Revisa los logs del backend** para ver:
   - Si `trackId` está presente o no
   - El JSON completo que se está enviando
   - Las validaciones que se están aplicando
3. **Si el error persiste**, los logs mostrarán exactamente dónde está el problema

---

## 🔍 DIAGNÓSTICO

Si el error persiste después de estas correcciones, revisa:

1. **¿El JSON final contiene `trackId`?**
   - Busca en los logs: `📦 [DIAN] BODY ENVIADO (JSON)`
   - Verifica si aparece `"trackId"` en el string

2. **¿El `trackId` es array u objeto?**
   - Busca en los logs: `❌ [DIAN] ERROR: trackId es array u objeto!`
   - Esto indicará si se detectó el problema

3. **¿La API está interpretando otro campo como `trackId`?**
   - Revisa si hay algún campo con nombre similar
   - Verifica que no haya campos anidados con `trackId`

---

## 📋 RESUMEN

**El error ocurre porque:**
- La API de DIAN espera que `trackId` sea un string o no esté presente
- Cuando `sync: false`, `trackId` NO debe estar en el JSON
- Si `trackId` está presente como array u objeto, la API lo rechaza

**La solución:**
- Validar y eliminar `trackId` cuando `sync: false`
- Asegurar que `trackId` sea string cuando `sync: true`
- Validar múltiples veces antes de enviar
- Logs detallados para diagnosticar problemas

