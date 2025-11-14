# 📄 API de Generación de PDFs - Documentación

## Descripción General

La API de generación de PDFs permite convertir contenido HTML en documentos PDF utilizando Puppeteer y Chromium. Está optimizada para funcionar en entornos serverless como Vercel, con soporte para planes gratuitos y de pago.

## Endpoint

```
POST /api/generar-pdf
```

## Autenticación

Actualmente la API no requiere autenticación. En producción, se recomienda implementar autenticación mediante tokens o API keys.

## Parámetros

### Body (JSON)

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `html` | `string` | ✅ Sí | Contenido HTML completo que se convertirá a PDF. Debe ser un string válido con HTML. |
| `fileName` | `string` | ❌ No | Nombre del archivo PDF. Si no se proporciona, se usará `documento.pdf`. Los caracteres especiales serán reemplazados por guiones bajos. |

### Ejemplo de Request Body

```json
{
  "html": "<html><body><h1>Mi Documento</h1><p>Contenido del PDF</p></body></html>",
  "fileName": "mi-documento.pdf"
}
```

## Respuestas

### Éxito (200 OK)

La respuesta exitosa devuelve el archivo PDF como un blob binario con los siguientes headers:

- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="nombre-archivo.pdf"`
- `Content-Length: <tamaño-en-bytes>`

**Ejemplo de respuesta exitosa:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="mi-documento.pdf"
Content-Length: 12345

[binary PDF data]
```

### Errores

#### 400 Bad Request
```json
{
  "success": false,
  "message": "El contenido HTML es requerido."
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "No se pudo generar el PDF",
  "error": "Descripción del error",
  "details": {
    "stack": "Stack trace (solo en desarrollo)",
    "isVercel": true,
    "isTimeout": false,
    "isLaunchError": false
  }
}
```

## Ejemplos de Uso

### JavaScript/TypeScript (Frontend)

#### Usando Fetch API

```javascript
async function generarPDF(html, fileName = 'documento.pdf') {
  try {
    const response = await fetch('https://tu-backend.vercel.app/api/generar-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: html,
        fileName: fileName
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error generando PDF');
    }

    // Obtener el blob del PDF
    const blob = await response.blob();
    
    // Crear URL temporal y descargar
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    
    console.log('PDF generado exitosamente');
  } catch (error) {
    console.error('Error generando PDF:', error);
    throw error;
  }
}

// Uso
const htmlContent = `
  <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; }
      </style>
    </head>
    <body>
      <h1>Mi Documento</h1>
      <p>Este es el contenido del PDF</p>
    </body>
  </html>
`;

generarPDF(htmlContent, 'mi-documento.pdf');
```

#### Usando Axios

```javascript
import axios from 'axios';

async function generarPDFConAxios(html, fileName = 'documento.pdf') {
  try {
    const response = await axios.post(
      'https://tu-backend.vercel.app/api/generar-pdf',
      {
        html: html,
        fileName: fileName
      },
      {
        responseType: 'blob', // Importante para recibir el PDF como blob
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Crear URL temporal y descargar
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
    return response.data;
  } catch (error) {
    console.error('Error generando PDF:', error);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    throw error;
  }
}
```

### React/TypeScript (Función Helper)

```typescript
// utils/pdfClient.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export interface GeneratePdfOptions {
  fileName?: string;
}

export const descargarElementoComoPDF = async (
  element: HTMLElement,
  options: GeneratePdfOptions = {},
): Promise<void> => {
  // Clonar el elemento y remover elementos que no deben aparecer en el PDF
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-ignore-pdf="true"]').forEach((node) => node.remove());

  // Serializar el HTML
  const serialized = new XMLSerializer().serializeToString(clone);
  
  // Construir documento HTML completo
  const htmlDocument = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
        </style>
      </head>
      <body>
        ${serialized}
      </body>
    </html>
  `;

  const response = await fetch(`${API_BASE_URL}/generar-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      html: htmlDocument, 
      fileName: options.fileName 
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Error generando PDF (${response.status}): ${error.message}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = options.fileName ?? 'documento.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

// Uso en un componente React
import { useRef } from 'react';
import { descargarElementoComoPDF } from '../utils/pdfClient';

function MiComponente() {
  const componentRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    if (!componentRef.current) return;
    
    try {
      await descargarElementoComoPDF(componentRef.current, {
        fileName: 'mi-documento.pdf'
      });
      console.log('PDF descargado exitosamente');
    } catch (error) {
      console.error('Error generando PDF:', error);
    }
  };

  return (
    <div>
      <div ref={componentRef}>
        <h1>Contenido para PDF</h1>
        <p>Este contenido se convertirá a PDF</p>
      </div>
      <button onClick={handleDownloadPDF}>Descargar PDF</button>
    </div>
  );
}
```

### cURL

```bash
curl -X POST https://tu-backend.vercel.app/api/generar-pdf \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<html><body><h1>Mi Documento</h1><p>Contenido del PDF</p></body></html>",
    "fileName": "mi-documento.pdf"
  }' \
  --output mi-documento.pdf
```

### Python

```python
import requests
import json

def generar_pdf(html, file_name='documento.pdf', api_url='https://tu-backend.vercel.app/api/generar-pdf'):
    """
    Genera un PDF a partir de HTML usando la API
    
    Args:
        html (str): Contenido HTML a convertir
        file_name (str): Nombre del archivo PDF
        api_url (str): URL de la API
    
    Returns:
        bytes: Contenido del PDF como bytes
    """
    payload = {
        'html': html,
        'fileName': file_name
    }
    
    headers = {
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.post(api_url, json=payload, headers=headers)
        response.raise_for_status()
        
        # Guardar el PDF
        with open(file_name, 'wb') as f:
            f.write(response.content)
        
        print(f'PDF generado exitosamente: {file_name}')
        return response.content
    except requests.exceptions.RequestException as e:
        print(f'Error generando PDF: {e}')
        if hasattr(e.response, 'json'):
            print(f'Detalles: {e.response.json()}')
        raise

# Uso
html_content = """
<html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
        </style>
    </head>
    <body>
        <h1>Mi Documento</h1>
        <p>Este es el contenido del PDF</p>
    </body>
</html>
"""

generar_pdf(html_content, 'mi-documento.pdf')
```

### Node.js

```javascript
const axios = require('axios');
const fs = require('fs');

async function generarPDF(html, fileName = 'documento.pdf') {
  try {
    const response = await axios.post(
      'https://tu-backend.vercel.app/api/generar-pdf',
      {
        html: html,
        fileName: fileName
      },
      {
        responseType: 'arraybuffer', // Para recibir el PDF como buffer
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Guardar el PDF en el sistema de archivos
    fs.writeFileSync(fileName, response.data);
    console.log(`PDF generado exitosamente: ${fileName}`);
    
    return response.data;
  } catch (error) {
    console.error('Error generando PDF:', error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    throw error;
  }
}

// Uso
const htmlContent = `
  <html>
    <body>
      <h1>Mi Documento</h1>
      <p>Contenido del PDF</p>
    </body>
  </html>
`;

generarPDF(htmlContent, 'mi-documento.pdf');
```

## Especificaciones del PDF Generado

### Formato
- **Tamaño**: A4 (210mm x 297mm)
- **Orientación**: Vertical (portrait)
- **Márgenes**: 
  - Superior: 10mm
  - Derecho: 12mm
  - Inferior: 12mm
  - Izquierdo: 12mm

### Características
- ✅ Soporte para imágenes (URLs externas y base64)
- ✅ Soporte para estilos CSS (inline y en `<style>`)
- ✅ Soporte para fuentes web (Google Fonts, etc.)
- ✅ Fondo de página incluido (`printBackground: true`)
- ✅ JavaScript ejecutado antes de generar el PDF (en desarrollo local)

## Limitaciones

### Plan Gratuito de Vercel
- ⏱️ **Timeout máximo**: 10 segundos
- 💾 **Memoria**: 1024 MB
- 📄 **HTML simple recomendado**: Para documentos con muchas imágenes o scripts pesados, puede exceder el timeout

### Plan Pro de Vercel
- ⏱️ **Timeout máximo**: 300 segundos (5 minutos)
- 💾 **Memoria**: Hasta 3008 MB
- 📄 **HTML complejo**: Soporta documentos más complejos

### Recomendaciones de HTML

#### ✅ HTML Optimizado (Recomendado)
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body {
        font-family: Arial, sans-serif;
        padding: 20px;
        margin: 0;
      }
      /* Estilos simples y eficientes */
    </style>
  </head>
  <body>
    <h1>Título</h1>
    <p>Contenido del documento</p>
    <!-- Imágenes optimizadas o base64 -->
    <img src="data:image/png;base64,..." alt="Imagen">
  </body>
</html>
```

#### ❌ HTML No Optimizado (Puede causar timeout)
```html
<!-- Evitar: -->
- Muchas imágenes externas grandes
- Scripts pesados que tardan en ejecutarse
- Recursos externos que pueden no cargar
- HTML muy complejo con miles de elementos
- Animaciones o transiciones CSS complejas
```

## Mejores Prácticas

### 1. Optimizar el HTML
- Usa imágenes base64 para imágenes pequeñas
- Minimiza el uso de recursos externos
- Evita scripts complejos que no sean necesarios
- Usa CSS inline cuando sea posible

### 2. Manejo de Errores
```javascript
try {
  await generarPDF(html, 'documento.pdf');
} catch (error) {
  if (error.message.includes('Timeout')) {
    console.error('El PDF tardó demasiado en generarse. Simplifica el HTML.');
  } else if (error.message.includes('Executable')) {
    console.error('Error con el navegador. Contacta al administrador.');
  } else {
    console.error('Error desconocido:', error);
  }
}
```

### 3. Validar HTML antes de enviar
```javascript
function validarHTML(html) {
  if (!html || typeof html !== 'string') {
    throw new Error('HTML debe ser un string válido');
  }
  
  if (html.trim().length === 0) {
    throw new Error('HTML no puede estar vacío');
  }
  
  // Validar que sea HTML válido
  if (!html.includes('<html') && !html.includes('<body')) {
    console.warn('El HTML podría no ser válido. Considera envolverlo en <html><body>...</body></html>');
  }
  
  return true;
}

// Uso
validarHTML(htmlContent);
await generarPDF(htmlContent, 'documento.pdf');
```

### 4. Progreso y Feedback al Usuario
```javascript
async function generarPDFConProgreso(html, fileName) {
  // Mostrar loading
  mostrarLoading('Generando PDF...');
  
  try {
    await generarPDF(html, fileName);
    mostrarMensaje('PDF generado exitosamente', 'success');
  } catch (error) {
    mostrarMensaje('Error generando PDF: ' + error.message, 'error');
  } finally {
    ocultarLoading();
  }
}
```

## Solución de Problemas

### Error: "Timeout generando PDF"
**Causa**: El HTML es demasiado complejo o tiene muchos recursos externos.

**Solución**:
- Simplifica el HTML
- Reduce el número de imágenes
- Usa imágenes base64 en lugar de URLs externas
- Elimina scripts innecesarios
- Considera actualizar a plan Pro de Vercel

### Error: "El contenido HTML es requerido"
**Causa**: No se envió el parámetro `html` o está vacío.

**Solución**:
```javascript
// Asegúrate de enviar el HTML
const html = '<html><body>...</body></html>';
await generarPDF(html, 'documento.pdf');
```

### Error: "Executable not found"
**Causa**: Problema con la configuración de Puppeteer/Chromium.

**Solución**:
- **En Vercel**: Esto no debería pasar. Verifica que `@sparticuz/chromium` esté instalado y que las dependencias estén correctas
- **En local**: 
  - Por defecto, Puppeteer usa su Chromium incluido (no requiere Chrome instalado)
  - Si especificaste `CHROME_EXECUTABLE_PATH`, verifica que la ruta sea correcta
  - Ejecuta `npm install` para asegurarte de que Puppeteer esté instalado correctamente
  - La primera vez que ejecutes, Puppeteer descargará Chromium automáticamente (puede tardar unos minutos)

### Error: "Memory limit exceeded"
**Causa**: El HTML es demasiado grande o complejo.

**Solución**:
- Reduce el tamaño del HTML
- Simplifica el contenido
- Divide el documento en múltiples PDFs más pequeños
- Actualiza a plan Pro de Vercel para más memoria

### PDF generado pero vacío o mal formateado
**Causa**: El HTML no es válido o falta estructura.

**Solución**:
- Asegúrate de que el HTML tenga la estructura completa: `<html><head><body>...</body></html>`
- Incluye estilos CSS necesarios
- Verifica que las imágenes se carguen correctamente

## Variables de Entorno

Para desarrollo local, puedes configurar:

```env
# Ruta al ejecutable de navegador (opcional)
# Por defecto, Puppeteer usa su Chromium incluido (no requiere Chrome instalado)
# Solo especifica esto si quieres usar Chrome, Edge, Brave u otro navegador

# Para Chrome (Windows)
CHROME_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

# Para Edge (Windows)
CHROME_EXECUTABLE_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe

# Para Brave (Windows)
CHROME_EXECUTABLE_PATH=C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe

# Variable alternativa
PUPPETEER_EXECUTABLE_PATH=C:\ruta\a\tu\navegador.exe

# Entorno
NODE_ENV=development
```

**Nota**: Si no especificas ninguna ruta, Puppeteer usará automáticamente su Chromium incluido. No necesitas tener Chrome, Edge o Brave instalado.

## Monitoreo y Logs

La API genera logs detallados que incluyen:
- Tiempo de ejecución
- Tamaño del HTML recibido
- Tamaño del PDF generado
- Errores con stack traces (en desarrollo)
- Información del entorno (Vercel/Local)

Para ver los logs en Vercel:
1. Ve al dashboard de Vercel
2. Selecciona tu proyecto
3. Ve a la sección "Logs"
4. Filtra por la función `api/generar-pdf`

## Rate Limiting

Actualmente no hay rate limiting implementado. En producción, se recomienda:
- Implementar rate limiting por IP
- Usar autenticación con API keys
- Monitorear el uso de la API

## Soporte

Para reportar problemas o solicitar características:
1. Revisa los logs en Vercel
2. Verifica que el HTML sea válido
3. Comprueba los límites de tiempo y memoria
4. Contacta al equipo de desarrollo con los detalles del error

## Changelog

### v1.0.0 (2025-11-09)
- ✅ Soporte inicial para generación de PDFs
- ✅ Optimización para plan gratuito de Vercel (10s timeout)
- ✅ Soporte para HTML con imágenes y CSS
- ✅ Manejo de errores mejorado
- ✅ Logging detallado

## Licencia

Esta API es parte del proyecto ERP360 Comercial Ventas.

