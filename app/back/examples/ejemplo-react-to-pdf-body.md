# Cómo convertir un Componente React a Body para la API de PDFs

## Opción 1: Usar la función existente (Recomendado)

Tu proyecto ya tiene la función `descargarElementoComoPDF` que convierte automáticamente un elemento React a HTML y lo envía a la API.

```typescript
// En tu componente React (ej: CotizacionPreviewModal.tsx)
import { descargarElementoComoPDF } from '../../utils/pdfClient';

const handleDownload = async () => {
    if (!componentRef.current) return;
    
    try {
        await descargarElementoComoPDF(componentRef.current, {
            fileName: `Cotizacion-${cotizacion.numeroCotizacion}.pdf`
        });
    } catch (error) {
        console.error('Error generando PDF:', error);
    }
};
```

Esta función:
1. Toma el elemento HTML renderizado del componente React
2. Lo serializa a HTML
3. Lo envuelve en un documento HTML completo
4. Lo envía a la API `/api/generar-pdf`

## Opción 2: Obtener el HTML manualmente desde React

Si necesitas el HTML antes de enviarlo a la API:

```typescript
import ReactDOMServer from 'react-dom/server';
import CotizacionPDF from './CotizacionPDF';

// Renderizar el componente a HTML string
const htmlString = ReactDOMServer.renderToStaticMarkup(
    <CotizacionPDF
        cotizacion={cotizacion}
        cliente={cliente}
        vendedor={vendedor}
        empresa={empresa}
        preferences={preferences}
    />
);

// Envolver en documento HTML completo
const htmlCompleto = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @page { margin: 0; size: A4; }
        body { margin: 0; padding: 0; }
    </style>
</head>
<body>
    ${htmlString}
</body>
</html>
`;

// Crear el body para la API
const body = {
    html: htmlCompleto,
    fileName: `Cotizacion-${cotizacion.numeroCotizacion}.pdf`
};

// Enviar a la API
const response = await fetch('http://localhost:3001/api/generar-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
});
```

## Opción 3: Convertir manualmente a HTML estático

Si prefieres tener control total sobre el HTML, puedes crear una función que genere el HTML basándose en los datos:

```typescript
// utils/generarHTMLCotizacion.ts
export function generarHTMLCotizacion(data: {
    cotizacion: Cotizacion;
    cliente: Cliente;
    vendedor: Vendedor;
    empresa: any;
    preferences?: DocumentPreferences;
}): string {
    const { cotizacion, cliente, vendedor, empresa, preferences } = data;
    
    // Calcular totales
    const totalDescuentos = cotizacion.items.reduce((acc, item) => {
        return acc + (item.precioUnitario * item.cantidad * item.descuentoPorcentaje / 100);
    }, 0);
    
    // Generar HTML (similar al ejemplo en ejemplo-cotizacion-pdf-body.js)
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @page { margin: 0; size: A4; }
        body { margin: 0; padding: 0; }
    </style>
</head>
<body>
    <div class="p-10 text-slate-800 bg-white font-sans text-sm">
        <!-- Tu HTML aquí basado en el componente React -->
        <header>...</header>
        <section>...</section>
        <!-- etc -->
    </div>
</body>
</html>
    `;
}

// Uso
const html = generarHTMLCotizacion({
    cotizacion,
    cliente,
    vendedor,
    empresa,
    preferences
});

const body = {
    html: html,
    fileName: `Cotizacion-${cotizacion.numeroCotizacion}.pdf`
};
```

## Ejemplo completo: Body JSON listo para usar

Basado en el componente `CotizacionPDF.tsx`, aquí tienes un ejemplo de body JSON:

```json
{
  "html": "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"UTF-8\"><script src=\"https://cdn.tailwindcss.com\"></script><style>@page{margin:0;size:A4}body{margin:0;padding:0}</style></head><body><div class=\"p-10 text-slate-800 bg-white font-sans text-sm\"><header class=\"flex justify-between items-start mb-8 pb-4 border-b border-slate-200\"><div class=\"flex items-start gap-4\"><div class=\"h-16 w-16 bg-slate-100 flex items-center justify-center rounded-md text-slate-400\"><svg xmlns=\"http://www.w3.org/2000/svg\" class=\"h-8 w-8\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z\"/></svg></div><div><h2 class=\"text-lg font-bold text-slate-900\">ERP360 Comercial</h2><p class=\"text-sm text-slate-600\">NIT: 900.000.000-1</p></div></div><div class=\"text-right\"><h1 class=\"text-2xl font-bold text-slate-900\">COTIZACIÓN</h1><p class=\"font-semibold text-xl text-red-600\">COT-2025-001</p></div></header><section class=\"grid grid-cols-2 gap-x-6 my-8\"><div class=\"p-4 bg-slate-50 border border-slate-200 rounded-md\"><h3 class=\"text-xs font-semibold text-slate-500 mb-1\">CLIENTE</h3><p class=\"font-bold text-base text-slate-900\">Cliente de Prueba S.A.S</p></div></section></div></body></html>",
  "fileName": "Cotizacion-COT-2025-001.pdf"
}
```

## Recomendación

**Usa la Opción 1** (`descargarElementoComoPDF`) porque:
- ✅ Ya está implementada en tu proyecto
- ✅ Maneja automáticamente la serialización del componente React
- ✅ Incluye el wrapper HTML necesario
- ✅ Es más simple y mantenible
- ✅ Se actualiza automáticamente cuando cambias el componente React

Solo usa las otras opciones si necesitas:
- Modificar el HTML antes de enviarlo
- Generar PDFs desde el backend sin React
- Tener control total sobre el HTML generado

## Ver ejemplos completos

- `ejemplo-cotizacion-pdf-body.js` - Función completa para generar HTML de cotización
- `test-pdf-tailwind.js` - Ejemplo con Tailwind CSS
- `ejemplo-body-simple-tailwind.js` - Ejemplo simple para copiar/pegar

