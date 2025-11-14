# 🔍 Debug: Ver Exactamente Qué Recibe el Body de la API de Generar PDF

Este documento explica cómo ver exactamente qué recibe el body de la API `/api/generar-pdf`.

## 📋 Métodos para Ver el Body

### 1. **Logs en el Servidor (Recomendado)**

Cuando haces una petición a `/api/generar-pdf`, el servidor imprime logs detallados en la consola que incluyen:

- **Información completa del body**: Tipo, propiedades, valores
- **Análisis del HTML**: Longitud, estructura, contenido
- **Análisis del fileName**: Valor completo, validación
- **Preview del HTML**: Primeros y últimos 1000 caracteres
- **Análisis estructural**: DOCTYPE, head, body, Tailwind, etc.

#### Cómo ver los logs:

1. Inicia el servidor:
   ```bash
   cd app/back
   npm run dev
   ```

2. Genera un PDF desde el frontend (cualquier botón de descarga)

3. Revisa la consola del servidor. Verás logs como:
   ```
   ========== [PDF] NUEVO REQUEST RECIBIDO ==========
   [PDF] BODY EXACTO RECIBIDO
   [PDF] CONTENIDO EXACTO DEL HTML
   [PDF] RESUMEN FINAL DEL BODY RECIBIDO
   ```

### 2. **Endpoint de Debug: `/api/debug-pdf-body`**

Este endpoint recibe exactamente el mismo body que `/api/generar-pdf` pero en lugar de generar un PDF, devuelve un JSON con toda la información del body recibido.

#### Uso desde el frontend:

```javascript
const body = {
    html: '<html>...</html>',
    fileName: 'documento.pdf'
};

const response = await fetch('http://localhost:3001/api/debug-pdf-body', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
});

const data = await response.json();
console.log('Body recibido:', data);
```

#### Uso con el script de prueba:

```bash
cd app/back
node examples/test-pdf-body-debug.js
```

Este script envía una petición de ejemplo y muestra toda la información recibida.

### 3. **Logs en el Cliente (Frontend)**

El cliente también imprime logs cuando envía la petición. Revisa la consola del navegador para ver:

```
[PDF Client] Iniciando generación de PDF...
[PDF Client] HTML serializado, longitud: 15234
[PDF Client] HTML documento completo, longitud: 18234
[PDF Client] Endpoint API: http://localhost:3001/api/generar-pdf
[PDF Client] Body tamaño: 18250 bytes
[PDF Client] fileName: documento.pdf
```

## 📊 Estructura del Body

El body que recibe la API tiene la siguiente estructura:

```json
{
  "html": "<!DOCTYPE html><html>...</html>",
  "fileName": "documento.pdf"
}
```

### Propiedades:

- **`html`** (string, requerido): HTML completo del documento a convertir a PDF
  - Debe incluir `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`
  - Puede incluir Tailwind CSS (CDN o inline)
  - Puede incluir estilos CSS inline
  - Puede incluir scripts (aunque no se ejecutarán en el PDF)

- **`fileName`** (string, opcional): Nombre del archivo PDF a generar
  - Si no se proporciona, se usa `documento.pdf`
  - Se sanitiza automáticamente (caracteres especiales reemplazados por `_`)

## 🔍 Información Detallada en los Logs

### 1. Información del Body

```
[PDF] BODY EXACTO RECIBIDO
[PDF] req.body completo (tipo): object
[PDF] req.body es objeto: true
[PDF] Keys en req.body: [ 'html', 'fileName' ]
[PDF] Cantidad de propiedades: 2
```

### 2. Análisis de Cada Propiedad

```
[PDF]   - html: {
  tipo: 'string',
  esString: true,
  longitud: 18234,
  valorPreview: '<!DOCTYPE html>...'
}
[PDF]   - fileName: {
  tipo: 'string',
  esString: true,
  longitud: 15,
  valorPreview: 'documento.pdf'
}
```

### 3. Contenido del HTML

```
[PDF] CONTENIDO EXACTO DEL HTML
[PDF] Longitud total: 18234 caracteres
[PDF] Primeros 1000 caracteres:
[HTML completo aquí...]
[PDF] Últimos 1000 caracteres:
[HTML completo aquí...]
```

### 4. Análisis Estructural

```
[PDF] ANÁLISIS ESTRUCTURAL DEL HTML
[PDF] Contiene DOCTYPE: ✅ Sí
[PDF] Contiene <html>: ✅ Sí
[PDF] Contiene <head>: ✅ Sí
[PDF] Contiene <body>: ✅ Sí
[PDF] Contiene Tailwind: ✅ Sí
[PDF] Número de scripts: 1
[PDF] Número de styles: 3
```

### 5. Resumen Final

```
[PDF] RESUMEN FINAL DEL BODY RECIBIDO
[PDF] ✅ Body recibido: Sí
[PDF] ✅ Tipo: object
[PDF] ✅ Propiedades: html, fileName
[PDF] ✅ HTML presente: Sí
[PDF] ✅ HTML longitud: 18234 caracteres
[PDF] ✅ HTML tamaño: 17.81 KB
[PDF] ✅ fileName presente: Sí
[PDF] ✅ fileName valor: documento.pdf
```

## 🧪 Probar con el Script

1. Ejecuta el script de prueba:
   ```bash
   cd app/back
   node examples/test-pdf-body-debug.js
   ```

2. Verás la salida completa con:
   - Información del body recibido
   - Propiedades analizadas
   - Contenido del HTML (primeros y últimos 500 caracteres)
   - Headers de la petición
   - Body completo en JSON

## 🐛 Troubleshooting

### El body está vacío o undefined

- Verifica que el `Content-Type` sea `application/json`
- Verifica que el body sea un JSON válido
- Revisa los logs del servidor para ver qué headers se recibieron

### El HTML no se recibe correctamente

- Verifica que el HTML sea un string válido
- Verifica que el HTML esté correctamente escapado en el JSON
- Revisa los logs para ver la longitud y preview del HTML

### El fileName no se recibe

- Verifica que el campo se llame exactamente `fileName` (case-sensitive)
- Verifica que sea un string
- Si es opcional, se usará `documento.pdf` por defecto

## 📝 Ejemplo de Body Completo

```json
{
  "html": "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"UTF-8\"><title>Documento</title><script src=\"https://cdn.tailwindcss.com\"></script></head><body><div class=\"container\"><h1>Título</h1><p>Contenido</p></div></body></html>",
  "fileName": "mi-documento.pdf"
}
```

## 🔗 Ver También

- [API_PDF_DOCUMENTATION.md](./API_PDF_DOCUMENTATION.md) - Documentación completa de la API
- [README_VERCEL.md](./README_VERCEL.md) - Documentación de despliegue en Vercel
- `examples/test-pdf-body-debug.js` - Script de prueba

