import React from 'react';
import ReactDOMServer from 'react-dom/server';

/**
 * Convierte un componente React a HTML completo listo para generar PDF
 * 
 * @param component - Componente React a convertir
 * @param options - Opciones para el HTML generado
 * @returns HTML completo como string
 */
export function reactToHtml(
  component: React.ReactElement,
  options: {
    includeTailwind?: boolean;
    title?: string;
    customStyles?: string;
  } = {}
): string {
  const {
    includeTailwind = true,
    title = 'Documento',
    customStyles = ''
  } = options;

  // Renderizar el componente React a HTML string
  const componentHTML = ReactDOMServer.renderToStaticMarkup(component);

  // Construir el documento HTML completo
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${includeTailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : ''}
    <style>
        @page {
            margin: 0;
            size: A4;
        }
        body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #0f172a;
        }
        /* Asegurar que los estilos se apliquen correctamente */
        * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
        }
        ${customStyles}
    </style>
</head>
<body>
    ${componentHTML}
</body>
</html>`;

  return html;
}

/**
 * Convierte un componente React a HTML y lo envía a la API para generar PDF
 * 
 * @param component - Componente React a convertir
 * @param fileName - Nombre del archivo PDF
 * @param options - Opciones adicionales
 */
export async function generarPDFDesdeReact(
  component: React.ReactElement,
  fileName: string,
  options: {
    includeTailwind?: boolean;
    title?: string;
    customStyles?: string;
    apiUrl?: string;
  } = {}
): Promise<void> {
  const API_BASE_URL =
    options.apiUrl ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) ||
    'http://localhost:3001/api';

  const PDF_ENDPOINT = `${API_BASE_URL}/generar-pdf`;

  // Convertir React a HTML
  const html = reactToHtml(component, {
    includeTailwind: options.includeTailwind ?? true,
    title: options.title || fileName,
    customStyles: options.customStyles
  });

  // Enviar a la API
  const response = await fetch(PDF_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, fileName })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error generando PDF' }));
    throw new Error(`Error generando PDF (${response.status}): ${error.message || 'Error desconocido'}`);
  }

  // Descargar el PDF
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Obtiene solo el HTML del componente React (sin el documento completo)
 * Útil para ver el HTML generado o procesarlo antes de enviarlo
 */
export function reactToHtmlOnly(component: React.ReactElement): string {
  return ReactDOMServer.renderToStaticMarkup(component);
}

