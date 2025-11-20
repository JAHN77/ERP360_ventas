# 📱 Configurar Frontend para Acceso desde Red

## ⚠️ Problema Actual

El frontend está intentando conectarse a `http://localhost:3001` desde otro dispositivo, pero debería usar la IP de red `http://192.168.1.8:3001`.

## 🔧 Solución

### Opción 1: Variable de Entorno (Recomendado)

1. **Crear archivo `.env.local` en `app/front/`:**

```bash
cd app/front
touch .env.local
```

2. **Agregar la IP de tu servidor:**

```env
VITE_API_BASE_URL=http://192.168.1.8:3001/api
```

**⚠️ IMPORTANTE:** Reemplaza `192.168.1.8` con la IP que muestra tu servidor al iniciar.

3. **Reiniciar el servidor de desarrollo del frontend:**

```bash
# Detén el servidor (Ctrl+C) y vuelve a iniciarlo
npm run dev
```

### Opción 2: Modificar Temporalmente el Código

Si necesitas una solución rápida, puedes modificar temporalmente `app/front/services/apiClient.ts`:

```typescript
// Cambiar esta línea:
const API_BASE_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || 'http://localhost:3001/api';

// Por esta (reemplaza con tu IP):
const API_BASE_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || 'http://192.168.1.8:3001/api';
```

**⚠️ No recomendado para producción** - Usa la Opción 1.

---

## 📋 Pasos Completos

### 1. Obtener la IP del Servidor

Cuando inicies el backend, verás algo como:
```
🌐 URL de red: http://192.168.1.8:3001
```

Copia esa IP (en este caso `192.168.1.8`).

### 2. Configurar el Frontend

**Crear `.env.local` en `app/front/`:**

```env
VITE_API_BASE_URL=http://TU_IP:3001/api
```

Reemplaza `TU_IP` con la IP que viste en el paso 1.

### 3. Reiniciar el Frontend

```bash
cd app/front
# Detén el servidor si está corriendo (Ctrl+C)
npm run dev
```

### 4. Acceder desde Otro Dispositivo

1. Asegúrate de que el frontend esté corriendo
2. Obtén la IP de la máquina donde corre el frontend (generalmente la misma que el backend)
3. Desde otro dispositivo, accede a:
   ```
   http://TU_IP:3000
   ```
   (El frontend corre en el puerto 3000 por defecto)

---

## 🔍 Verificar que Funciona

1. Abre las herramientas de desarrollador en el navegador (F12)
2. Ve a la pestaña "Network" (Red)
3. Recarga la página
4. Verifica que las solicitudes vayan a `http://192.168.1.8:3001/api/...` y no a `localhost`

---

## 🐛 Solución de Problemas

### Error: "CORS header missing"
- ✅ Ya corregido en el backend
- Reinicia el servidor backend si aún ves el error

### Error: "Cannot connect"
- Verifica que ambos dispositivos estén en la misma red Wi‑Fi
- Verifica que el firewall permita Node.js
- Verifica que la IP sea correcta

### El frontend sigue usando localhost
- Asegúrate de haber creado `.env.local` (no `.env`)
- Reinicia el servidor de desarrollo del frontend
- Verifica que el archivo tenga el formato correcto (sin espacios extra)

---

## 📝 Notas

- El archivo `.env.local` no se sube a Git (está en `.gitignore`)
- Cada desarrollador puede tener su propia IP
- Para producción, usa variables de entorno del servidor

