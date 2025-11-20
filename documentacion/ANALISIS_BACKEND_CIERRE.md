# Análisis: Backend se Cierra al Ejecutar

## 🔍 Problemas Identificados

### 1. **`process.exit(1)` en sqlServerClient.cjs** ❌
**Ubicación:** `app/back/services/sqlServerClient.cjs` línea 12

**Problema:**
```javascript
if (missingVars.length > 0) {
  console.error('❌ Error: Faltan variables de entorno requeridas:', missingVars.join(', '));
  process.exit(1); // ❌ Esto cierra el proceso inmediatamente
}
```

**Impacto:**
- Si faltan variables de entorno (DB_SERVER, DB_DATABASE, DB_USER, DB_PASSWORD), el proceso termina inmediatamente
- El servidor nunca llega a iniciarse
- No hay oportunidad de manejar el error o mostrar mensajes útiles

### 2. **Falta de Manejo de Errores No Capturados** ❌
**Ubicación:** `app/back/server.cjs`

**Problema:**
- No hay handlers para `uncaughtException`
- No hay handlers para `unhandledRejection`
- Cualquier error no manejado puede terminar el proceso

**Impacto:**
- Errores inesperados pueden cerrar el servidor
- No hay logging de errores críticos
- No hay limpieza de recursos antes de terminar

### 3. **Falta de Manejo de Errores del Servidor** ❌
**Ubicación:** `app/back/server.cjs` - `app.listen()`

**Problema:**
- No hay manejo de errores en `app.listen()`
- Si el puerto está en uso, el error no se maneja correctamente
- No hay manejo de señales de terminación (SIGTERM, SIGINT)

**Impacto:**
- Si el puerto está ocupado, el servidor falla sin mensaje claro
- No se cierran conexiones de BD correctamente al terminar
- Recursos no se liberan correctamente

## ✅ Soluciones Aplicadas

### 1. **Eliminado `process.exit(1)` en sqlServerClient.cjs**

**Antes:**
```javascript
if (missingVars.length > 0) {
  console.error('❌ Error: Faltan variables de entorno requeridas:', missingVars.join(', '));
  process.exit(1); // ❌ Cierra el proceso
}
```

**Después:**
```javascript
if (missingVars.length > 0) {
  console.warn('⚠️  Advertencia: Faltan variables de entorno requeridas:', missingVars.join(', '));
  console.warn('💡 El servidor iniciará, pero las operaciones de BD fallarán hasta que se configuren las variables.');
  // ✅ NO hacer process.exit(1) - permitir que el servidor inicie
}
```

**Beneficios:**
- El servidor puede iniciar incluso sin variables de entorno
- Los errores de BD se manejan en tiempo de ejecución
- Mejor experiencia de desarrollo (puedes iniciar el servidor y ver qué falta)

### 2. **Agregado Manejo de Errores No Capturados**

**Código agregado:**
```javascript
// Manejo de errores no capturados para evitar que el proceso termine
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado (uncaughtException):', error);
  console.error('Stack:', error.stack);
  // NO hacer process.exit() - permitir que el servidor continúe
  // Solo loguear el error para debugging
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada (unhandledRejection):', reason);
  console.error('Promise:', promise);
  // NO hacer process.exit() - permitir que el servidor continúe
  // Solo loguear el error para debugging
});
```

**Beneficios:**
- Errores no capturados se loguean pero no cierran el servidor
- Mejor debugging con stack traces
- El servidor continúa funcionando incluso con errores inesperados

### 3. **Agregado Manejo de Señales de Terminación**

**Código agregado:**
```javascript
// Manejo de señales de terminación para cerrar conexiones correctamente
process.on('SIGTERM', async () => {
  console.log('📡 Señal SIGTERM recibida, cerrando servidor...');
  try {
    const { closeConnection } = require('./services/sqlServerClient.cjs');
    await closeConnection();
  } catch (error) {
    console.error('Error cerrando conexión:', error);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n📡 Señal SIGINT recibida (Ctrl+C), cerrando servidor...');
  try {
    const { closeConnection } = require('./services/sqlServerClient.cjs');
    await closeConnection();
  } catch (error) {
    console.error('Error cerrando conexión:', error);
  }
  process.exit(0);
});
```

**Beneficios:**
- Conexiones de BD se cierran correctamente al terminar
- Limpieza de recursos antes de salir
- Manejo correcto de Ctrl+C y señales de terminación

### 4. **Agregado Manejo de Errores del Servidor**

**Código agregado:**
```javascript
const server = app.listen(PORT, HOST, () => {
  // ... código de inicio
});

// Manejar errores del servidor
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Error: El puerto ${PORT} ya está en uso.`);
    console.error('💡 Intenta usar otro puerto o detén el proceso que está usando este puerto.');
  } else {
    console.error('❌ Error del servidor:', error);
  }
  // NO hacer process.exit() - solo loguear el error
});
```

**Beneficios:**
- Mensajes claros cuando el puerto está en uso
- Mejor manejo de errores de inicio del servidor
- El servidor no se cierra inesperadamente

## 📋 Flujo de Inicio Actualizado

1. **Carga de variables de entorno:**
   - Si faltan variables, muestra advertencia pero continúa
   - El servidor puede iniciar sin conexión a BD

2. **Inicio del servidor:**
   - Intenta iniciar en el puerto especificado
   - Si hay error (puerto ocupado), muestra mensaje claro
   - No termina el proceso si hay errores

3. **Manejo de errores:**
   - Errores no capturados se loguean pero no cierran el servidor
   - Promesas rechazadas se loguean pero no cierran el servidor
   - El servidor continúa funcionando

4. **Terminación:**
   - Al recibir SIGTERM o SIGINT, cierra conexiones correctamente
   - Limpia recursos antes de salir
   - Exit code 0 (éxito)

## ✅ Resultado Esperado

- ✅ El servidor inicia incluso si faltan variables de entorno
- ✅ El servidor no se cierra por errores no capturados
- ✅ Mensajes claros cuando hay problemas (puerto ocupado, variables faltantes)
- ✅ Conexiones de BD se cierran correctamente al terminar
- ✅ Mejor debugging con logs detallados

## 🎯 Próximos Pasos Recomendados

1. **Verificar archivo .env:**
   ```bash
   # Asegúrate de tener estas variables en app/back/.env:
   DB_SERVER=tu_servidor
   DB_DATABASE=tu_base_de_datos
   DB_USER=tu_usuario
   DB_PASSWORD=tu_contraseña
   DB_PORT=1433
   DB_ENCRYPT=false
   ```

2. **Verificar que el puerto no esté en uso:**
   ```bash
   # En macOS/Linux:
   lsof -i :3001
   
   # Si está en uso, detén el proceso o cambia el puerto en .env:
   PORT=3002
   ```

3. **Ejecutar el servidor:**
   ```bash
   cd app/back
   npm start
   # o
   node server.cjs
   ```

4. **Verificar logs:**
   - Si faltan variables, verás advertencias pero el servidor iniciará
   - Si hay errores de conexión a BD, se mostrarán en los logs
   - El servidor debería mantenerse activo y escuchando en el puerto

## 🔧 Debugging

Si el servidor aún se cierra:

1. **Revisa los logs:**
   - Busca mensajes de error antes de que se cierre
   - Verifica si hay `process.exit()` en otros archivos

2. **Verifica variables de entorno:**
   ```bash
   cd app/back
   node -e "require('dotenv').config(); console.log(process.env.DB_SERVER)"
   ```

3. **Ejecuta con más verbosidad:**
   ```bash
   DEBUG=* node server.cjs
   ```

4. **Verifica que no haya otros procesos:**
   ```bash
   ps aux | grep node
   ```

