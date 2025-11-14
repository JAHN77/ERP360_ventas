# Configuración para Despliegue en Vercel

## 📚 Documentación

- **[API de Generación de PDFs](./API_PDF_DOCUMENTATION.md)**: Documentación completa de la API de generación de PDFs
- **[Ejemplos de Uso](./examples/test-pdf-api.js)**: Ejemplos prácticos de cómo usar la API

## Cambios Realizados

### 1. Dependencias
- ✅ `puppeteer` (completo) para desarrollo local (incluye Chromium)
- ✅ `puppeteer-core` para Vercel (más ligero)
- ✅ `@sparticuz/chromium` para Vercel (serverless)
- ✅ Detección automática de entorno (local vs Vercel)

### 2. Configuración de Puppeteer
- ✅ Detección automática de entorno (Vercel vs Local)
- ✅ En Vercel: usa `puppeteer-core` + `@sparticuz/chromium` optimizado para serverless
- ✅ En Local: usa `puppeteer` completo con Chromium incluido (no requiere Chrome instalado)
- ✅ Soporte opcional para navegador personalizado (Chrome, Edge, Brave) mediante variables de entorno

### 3. Optimizaciones para Vercel
- ✅ Timeouts ajustados para serverless (30 segundos)
- ✅ Memoria aumentada a 3008 MB en `vercel.json`
- ✅ Argumentos de Chrome optimizados para serverless
- ✅ Mejor manejo de errores con logging detallado

## Configuración Local

### ✅ Opción Recomendada: Puppeteer Completo (Chromium Incluido)

**No se requiere Chrome instalado**. El proyecto usa `puppeteer` completo que incluye Chromium.

1. **Instalar dependencias**:
   ```bash
   cd app/back
   npm install
   ```

2. **Ejecutar el servidor**:
   ```bash
   npm run dev
   ```

Puppeteer descargará automáticamente Chromium la primera vez que se ejecute. No necesitas tener Chrome, Edge, Brave ni ningún navegador instalado.

### Opción Alternativa: Usar Navegador Personalizado

Si prefieres usar Chrome, Edge, Brave u otro navegador instalado en tu sistema, crea un archivo `.env` en `app/back/` con:

```env
# Para Chrome
CHROME_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

# Para Edge (Windows)
CHROME_EXECUTABLE_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe

# Para Brave (Windows)
CHROME_EXECUTABLE_PATH=C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe

# O usar la variable alternativa
PUPPETEER_EXECUTABLE_PATH=C:\ruta\a\tu\navegador.exe
```

**Nota**: Si no especificas ninguna ruta, Puppeteer usará su Chromium incluido automáticamente.

## Configuración en Vercel

### Variables de Entorno Requeridas
En Vercel, añade estas variables de entorno en **Settings → Environment Variables**:

```env
# Base de Datos
DB_SERVER=tu_servidor_db
DB_PORT=1433
DB_DATABASE=ERP360
DB_USER=tu_usuario
DB_PASSWORD=tu_password
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

# API Keys
GEMINI_API_KEY=tu_api_key_gemini

# Opcional
PORT=3001
NODE_ENV=production
```

### Configuración del Proyecto
1. **Root Directory**: `app/back`
2. **Build Command**: (vacío o `npm install`)
3. **Output Directory**: (vacío)
4. **Install Command**: `npm install`

### Límites de Vercel

#### Plan Gratuito (Hobby)
- **Memoria**: 1024 MB (configurado en `vercel.json`)
- **Timeout**: 10 segundos máximo
- **Runtime**: Node.js 20.x

#### Plan Pro
- **Memoria**: Hasta 3008 MB (puedes aumentar en `vercel.json`)
- **Timeout**: Hasta 300 segundos
- **Runtime**: Node.js 20.x

**Nota**: El código está optimizado para el plan gratuito. Si tienes plan Pro, puedes aumentar la memoria y timeout en `vercel.json`.

## Pruebas

### Probar Localmente
```bash
cd app/back
npm install
npm run dev
```

Luego prueba el endpoint:
```bash
curl -X POST http://localhost:3001/api/generar-pdf \
  -H "Content-Type: application/json" \
  -d '{"html":"<html><body><h1>Test</h1></body></html>","fileName":"test.pdf"}'
```

### Probar en Vercel
Después del despliegue, prueba:
```bash
curl -X POST https://tu-backend.vercel.app/api/generar-pdf \
  -H "Content-Type: application/json" \
  -d '{"html":"<html><body><h1>Test</h1></body></html>","fileName":"test.pdf"}'
```

## ⚠️ Limitaciones del Plan Gratuito

### Tiempo de Ejecución
- **Máximo 10 segundos**: Todo el proceso de generación de PDF debe completarse en 10 segundos
- **Distribución del tiempo**:
  - Lanzar navegador: ~2-3 segundos
  - Cargar HTML: 3 segundos máximo
  - Generar PDF: 5 segundos máximo
  - Total: ~8-10 segundos

### Optimizaciones Aplicadas
- ✅ Timeouts reducidos y optimizados
- ✅ Uso de `waitUntil: 'load'` en lugar de `networkidle` (más rápido)
- ✅ Argumentos de Chrome optimizados para velocidad
- ✅ Memoria limitada a 1024 MB

### Recomendaciones
1. **HTML simple**: Evita HTML muy complejo con muchas imágenes o scripts pesados
2. **Primera ejecución**: La primera vez puede ser más lenta (cold start)
3. **Si falla por timeout**: Considera simplificar el HTML o actualizar a plan Pro

## Solución de Problemas

### Error: "Executable not found"
- **Local**: Asegúrate de tener Chrome instalado o define `CHROME_EXECUTABLE_PATH`
- **Vercel**: Esto no debería pasar, pero verifica que `@sparticuz/chromium` esté instalado

### Error: "Timeout generando PDF"
- Reduce el tamaño del HTML
- Aumenta el timeout en `vercel.json` (requiere plan Pro para >60s)
- Verifica la complejidad del contenido HTML

### Error: "Memory limit exceeded"
- Ya está configurado con 3008 MB (máximo)
- Si persiste, simplifica el HTML o divide el proceso

### Logs Detallados
El código incluye logging extensivo. Revisa los logs en Vercel para ver:
- Entorno detectado (Vercel/Local)
- Ruta del ejecutable de Chrome
- Errores específicos con stack traces

## Notas Importantes

1. **Primera ejecución en Vercel**: Puede tomar más tiempo la primera vez que se genera un PDF debido a la descarga de Chromium
2. **Cold starts**: Las funciones serverless tienen "cold starts". Considera usar Vercel Pro para mejor rendimiento
3. **Costo**: Generar PDFs consume recursos. Monitorea el uso en el dashboard de Vercel
4. **Alternativas**: Para PDFs muy complejos, considera usar un servicio dedicado como PDFShift o Browserless

