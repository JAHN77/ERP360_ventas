# Ejemplos de Uso de la API de Generación de PDFs

Este directorio contiene ejemplos prácticos de cómo usar la API de generación de PDFs.

## Requisitos

- Node.js instalado
- Dependencias del proyecto instaladas (`npm install` en `app/back`)
- Servidor backend ejecutándose (local o en Vercel)

## Instalación

```bash
# Desde el directorio app/back
npm install axios
```

## Uso

### Ejecutar todos los ejemplos

```bash
# Desde el directorio app/back
node examples/test-pdf-api.js
```

### Configurar la URL de la API

Por defecto, los ejemplos usan `http://localhost:3001/api/generar-pdf`. Para cambiar la URL:

```bash
# Usar API en Vercel
API_URL=https://tu-backend.vercel.app/api/generar-pdf node examples/test-pdf-api.js

# O exportar la variable
export API_URL=https://tu-backend.vercel.app/api/generar-pdf
node examples/test-pdf-api.js
```

## Ejemplos Incluidos

### 1. PDF Simple
Genera un PDF básico con texto y estilos simples.
```bash
node examples/test-pdf-api.js
```

### 2. PDF con Tabla
Genera un PDF con una tabla formateada, demostrando cómo crear reportes.

### 3. PDF con Imagen
Genera un PDF con una imagen embebida usando base64.

### 4. PDF con Tailwind CSS ⭐ **NUEVO**
Genera un PDF profesional usando Tailwind CSS con diseño moderno, tablas, badges y gradientes.
```bash
node examples/test-pdf-tailwind.js
```

**Archivos relacionados:**
- `test-pdf-tailwind.js` - Script Node.js para generar el PDF
- `ejemplo-pdf-tailwind.html` - HTML completo con Tailwind (para referencia)
- `ejemplo-body-tailwind.json` - Body JSON listo para usar con la API

### 5. Prueba de Error
Demuestra el manejo de errores cuando se envía HTML vacío.

## Archivos Generados

Los PDFs generados se guardan en el directorio `app/back/output/` (se crea automáticamente).

## Personalizar

Puedes modificar los ejemplos o crear nuevos basándote en `test-pdf-api.js`. Cada función es independiente y puede ser llamada individualmente.

## Ver Documentación Completa

Para más detalles sobre la API, consulta [API_PDF_DOCUMENTATION.md](../API_PDF_DOCUMENTATION.md).

