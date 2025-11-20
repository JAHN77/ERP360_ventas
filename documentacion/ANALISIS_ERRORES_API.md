# Análisis de Errores de API y Soluciones Aplicadas

## 🔍 Problema Identificado

La aplicación se quedaba colgada en "Cargando bodegas..." y se generaban múltiples errores de `AbortError: signal is aborted without reason` en las llamadas a la API.

## 📊 Análisis de las APIs

### 1. **apiClient.ts** - Cliente HTTP Principal

#### Problemas Encontrados:
- ❌ `AbortController` con timeout de 10 segundos era demasiado corto
- ❌ El timeout se creaba siempre, incluso si ya había un `signal` existente
- ❌ Los `AbortError` se logueaban como errores críticos
- ❌ No se detectaba correctamente el `AbortError` (solo por mensaje, no por `error.name`)

#### Soluciones Aplicadas:
- ✅ Timeout aumentado a 30 segundos (5 segundos para test-connection)
- ✅ Solo crear `AbortController` si no hay un `signal` existente en `options`
- ✅ Detección mejorada de `AbortError` por `error.name` y mensaje
- ✅ `AbortError` se maneja como warning, no como error crítico
- ✅ Retorna respuesta con `success: false` en lugar de lanzar excepción

### 2. **AuthContext.tsx** - Carga de Bodegas

#### Problemas Encontrados:
- ❌ Timeout de 3 segundos competía con el timeout del `apiClient`
- ❌ `Promise.race` causaba cancelaciones prematuras
- ❌ No verificaba si el componente estaba montado antes de actualizar estado

#### Soluciones Aplicadas:
- ✅ Eliminado `Promise.race` - ahora confía en el timeout del `apiClient`
- ✅ Verificación de `isMounted` antes de actualizar estado
- ✅ Cleanup function para evitar actualizaciones en componentes desmontados
- ✅ Manejo de errores mejorado con fallback a datos mock

### 3. **DataContext.tsx** - Carga de Catálogos

#### Problemas Encontrados:
- ❌ `testApiConnection()` lanzaba error que detenía toda la carga
- ❌ No había manejo individual de errores para cada catálogo
- ❌ Si una API fallaba, todas las demás también fallaban

#### Soluciones Aplicadas:
- ✅ `testApiConnection()` no detiene la carga si falla
- ✅ Manejo individual de errores para cada catálogo (medidas, categorías, vendedores, bodegas)
- ✅ Cada catálogo se carga independientemente, si uno falla, los demás continúan
- ✅ Fallback a datos mock o arrays vacíos si hay errores

## 🔧 Cambios Técnicos Detallados

### apiClient.ts

```typescript
// ANTES:
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);

// DESPUÉS:
let controller: AbortController | null = null;
let timeoutId: NodeJS.Timeout | null = null;
const existingSignal = options.signal;

if (!existingSignal) {
  controller = new AbortController();
  const timeoutDuration = endpoint.includes('test-connection') ? 5000 : 30000;
  timeoutId = setTimeout(() => {
    if (controller) {
      controller.abort();
    }
  }, timeoutDuration);
}
```

### Manejo de AbortError

```typescript
// ANTES:
catch (error) {
  console.error(`Error en API request ${endpoint}:`, error);
  // ...
}

// DESPUÉS:
catch (error) {
  const errorName = error instanceof Error ? error.name : '';
  const isAbortError = errorName === 'AbortError' || 
                      errorMessage.includes('aborted') || 
                      errorMessage.includes('signal is aborted');
  
  if (isAbortError) {
    console.warn(`[api] Solicitud cancelada por timeout o abort: ${endpoint}`);
    return {
      success: false,
      error: 'Error de conexión con el servidor. La solicitud tardó demasiado tiempo o fue cancelada.',
      message: 'No se pudo conectar con el servidor (timeout)'
    };
  }
  // ...
}
```

### DataContext.tsx

```typescript
// ANTES:
const connectionTest = await testApiConnection();
if (!connectionTest.success) {
  throw new Error('No se puede conectar con el servidor API');
}

// DESPUÉS:
try {
  const connectionTest = await testApiConnection();
  if (!connectionTest.success) {
    logger.warn('No se puede conectar con el servidor API, continuando con datos mock');
    // No lanzar error, solo continuar
  }
} catch (connectionError) {
  logger.warn('Error al probar conexión API, continuando con datos mock:', connectionError);
  // Continuar sin lanzar error
}
```

## 📋 Flujo de Carga Actualizado

1. **AuthContext carga bodegas:**
   - Intenta cargar desde API (timeout 30s)
   - Si falla o timeout, usa datos mock
   - Siempre actualiza `isLoadingBodegas = false`

2. **DataContext carga catálogos:**
   - Prueba conexión (no bloquea si falla)
   - Carga cada catálogo independientemente:
     - Medidas (con try-catch individual)
     - Categorías (con try-catch individual)
     - Vendedores (con try-catch individual)
     - Bodegas (con try-catch individual)
   - Si alguno falla, continúa con los demás

3. **Manejo de errores:**
   - `AbortError` → Retorna `{success: false}` sin lanzar excepción
   - Errores de red → Retorna `{success: false}` sin lanzar excepción
   - Timeout → Retorna `{success: false}` sin lanzar excepción

## ✅ Resultado Esperado

- ✅ La aplicación no se queda colgada en "Cargando bodegas..."
- ✅ Los `AbortError` se manejan correctamente y no se muestran como errores críticos
- ✅ Si el backend no está disponible, la aplicación continúa con datos mock
- ✅ Cada catálogo se carga independientemente
- ✅ Timeouts más largos (30s) evitan cancelaciones prematuras
- ✅ Mejor experiencia de usuario: la app siempre carga, incluso sin backend

## 🎯 Próximos Pasos Recomendados

1. Verificar que el backend esté ejecutándose en el puerto correcto
2. Verificar la URL base de la API en `.env.local`
3. Revisar logs del backend para ver si hay errores en las queries
4. Considerar agregar un indicador visual cuando se usan datos mock

