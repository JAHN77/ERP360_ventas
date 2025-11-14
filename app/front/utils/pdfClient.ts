const API_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) ||
  'http://localhost:3001/api';

const PDF_ENDPOINT = `${API_BASE_URL}/generar-pdf`;
const DEBUG_PDF_BODY_ENDPOINT = `${API_BASE_URL}/debug-pdf-body`;

// Modo debug: activar para ver qué se envía al body antes de generar el PDF
// Puedes cambiarlo a false para desactivar el debug
const DEBUG_MODE = true;

export interface GeneratePdfOptions {
  fileName?: string;
  debug?: boolean; // Opción para activar/desactivar debug por llamada
}

const buildHtmlDocument = (content: string): string => {
  // Intentar recopilar estilos del documento actual
  // Filtrar para excluir recursos externos que pueden causar timeouts (fonts, preconnect, etc.)
  const headNodes = Array.from(
    document.head.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
      'link[rel="stylesheet"], style',
    ),
  )
    .filter((node) => {
      // Excluir fonts de Google y otros recursos externos que pueden causar timeouts
      if (node.tagName === 'LINK') {
        const href = (node as HTMLLinkElement).href || '';
        // Excluir fonts de Google
        if (href.includes('fonts.googleapis.com') || href.includes('fonts.gstatic.com')) {
          return false;
        }
        // Excluir preconnect y dns-prefetch (no necesarios para PDF)
        const rel = (node as HTMLLinkElement).rel || '';
        if (rel.includes('preconnect') || rel.includes('dns-prefetch')) {
          return false;
        }
      }
      return true;
    })
    .map((node) => node.outerHTML)
    .join('\n');

  const collectedCss: string[] = [];

  // Recopilar estilos CSS del documento
  // Filtrar para excluir referencias a fonts externos que pueden causar timeouts
  Array.from(document.styleSheets).forEach((sheet) => {
    try {
      if (!sheet.cssRules) {
        return;
      }
      
      // Filtrar reglas CSS que hacen referencia a fonts externos
      const cssRules = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .filter((cssText) => {
          // Excluir @import y @font-face que referencian fonts externos
          if (cssText.includes('@import') && (cssText.includes('fonts.googleapis.com') || cssText.includes('fonts.gstatic.com'))) {
            return false;
          }
          if (cssText.includes('@font-face') && (cssText.includes('fonts.googleapis.com') || cssText.includes('fonts.gstatic.com'))) {
            return false;
          }
          // Excluir url() que apuntan a fonts externos
          if (cssText.includes('url(') && (cssText.includes('fonts.googleapis.com') || cssText.includes('fonts.gstatic.com'))) {
            return false;
          }
          return true;
        });
      
      if (cssRules.length > 0) {
        collectedCss.push(cssRules.join('\n'));
      }
    } catch (error) {
      // Solo agregar @import si no es de fonts externos
      if ((error as DOMException).name === 'SecurityError' && sheet.href) {
        if (!sheet.href.includes('fonts.googleapis.com') && !sheet.href.includes('fonts.gstatic.com')) {
          collectedCss.push(`@import url('${sheet.href}');`);
        }
      }
    }
  });

  const classList = document.documentElement.className
    .split(/\s+/)
    .filter((cls) => cls && cls !== 'dark')
    .join(' ');
  const langAttr = document.documentElement.getAttribute('lang') ?? 'es';

  // Verificar si el contenido ya tiene Tailwind (puede venir del componente React)
  const tieneTailwind = content.includes('cdn.tailwindcss.com') || content.includes('tailwindcss');
  
  // Si no tiene Tailwind, agregarlo en el head para que se cargue antes
  const tailwindScript = tieneTailwind 
    ? '' 
    : '<script src="https://cdn.tailwindcss.com"></script>';
  
  // Script para forzar el procesamiento de Tailwind después de que se cargue
  const tailwindInitScript = tieneTailwind
    ? ''
    : `
<script>
  // Esperar a que Tailwind se cargue completamente y procese todas las clases
  (function() {
    function waitForTailwind() {
      if (typeof window.tailwind !== 'undefined' && window.tailwind) {
        // Tailwind está cargado, procesar el contenido
        const container = document.getElementById('pdf-container');
        if (container) {
          // Forzar el procesamiento de todas las clases en el contenedor
          // Tailwind CDN procesa automáticamente, pero podemos forzar un reflow
          container.offsetHeight;
          
          // Esperar un momento para que Tailwind termine de procesar
          setTimeout(function() {
            // Verificar que los estilos se aplicaron
            const testEl = container.querySelector('.bg-blue-800');
            if (testEl) {
              const style = window.getComputedStyle(testEl);
              // Los estilos deberían estar aplicados ahora
            }
          }, 200);
        }
        return true;
      }
      return false;
    }
    
    // Intentar inmediatamente
    if (!waitForTailwind()) {
      // Si Tailwind no está listo, esperar a que se cargue
      let attempts = 0;
      const maxAttempts = 30; // 3 segundos
      const interval = setInterval(function() {
        attempts++;
        if (waitForTailwind() || attempts >= maxAttempts) {
          clearInterval(interval);
        }
      }, 100);
    }
  })();
</script>`;

  return `<!DOCTYPE html>
<html lang="${langAttr}" class="${classList}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<base href="${window.location.origin}/" />
${tailwindScript}
${headNodes}
<style id="pdf-inline-styles">
${collectedCss.join('\n')}
</style>
<style>
  @page {
    margin: 15mm 12mm;
    size: A4;
  }
  html, body { 
    margin: 0; 
    padding: 0; 
    background: #ffffff; 
    color: #0f172a; 
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
  body { 
    width: 100%;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  #pdf-container { 
    background: #ffffff !important; 
    color: #0f172a !important; 
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    padding: 0;
    box-sizing: border-box;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
  }
  
  /* ===== ESTILOS CRÍTICOS DE TAILWIND =====
     Estos estilos se aplican como fallback si Tailwind CDN no se carga a tiempo.
     Se usan con !important para asegurar que se apliquen correctamente. */
  
  /* Padding */
  #pdf-container .p-10 { padding: 2.5rem !important; }
  #pdf-container .p-4 { padding: 1rem !important; }
  #pdf-container .p-3 { padding: 0.75rem !important; }
  #pdf-container .p-2 { padding: 0.5rem !important; }
  #pdf-container .p-1 { padding: 0.25rem !important; }
  #pdf-container .pb-4 { padding-bottom: 1rem !important; }
  #pdf-container .pt-10 { padding-top: 2.5rem !important; }
  #pdf-container .pt-8 { padding-top: 2rem !important; }
  #pdf-container .pt-2 { padding-top: 0.5rem !important; }
  #pdf-container .pr-4 { padding-right: 1rem !important; }
  #pdf-container .px-16 { padding-left: 4rem !important; padding-right: 4rem !important; }
  
  /* Margin */
  #pdf-container .mb-8 { margin-bottom: 2rem !important; }
  #pdf-container .mb-4 { margin-bottom: 1rem !important; }
  #pdf-container .mb-2 { margin-bottom: 0.5rem !important; }
  #pdf-container .mb-1 { margin-bottom: 0.25rem !important; }
  #pdf-container .mb-12 { margin-bottom: 3rem !important; }
  #pdf-container .mt-8 { margin-top: 2rem !important; }
  #pdf-container .mt-4 { margin-top: 1rem !important; }
  #pdf-container .mt-2 { margin-top: 0.5rem !important; }
  #pdf-container .mt-1 { margin-top: 0.25rem !important; }
  #pdf-container .mt-24 { margin-top: 6rem !important; }
  #pdf-container .my-8 { margin-top: 2rem !important; margin-bottom: 2rem !important; }
  
  /* Colores de texto */
  #pdf-container .text-slate-800 { color: #1e293b !important; }
  #pdf-container .text-slate-900 { color: #0f172a !important; }
  #pdf-container .text-slate-700 { color: #334155 !important; }
  #pdf-container .text-slate-600 { color: #475569 !important; }
  #pdf-container .text-slate-500 { color: #64748b !important; }
  #pdf-container .text-slate-400 { color: #94a3b8 !important; }
  #pdf-container .text-white,
  #pdf-container [class*="text-white"] { 
    color: #ffffff !important; 
  }
  
  /* Forzar texto blanco en elementos con fondo azul */
  #pdf-container .bg-blue-800.text-white,
  #pdf-container [class*="bg-blue-800"][class*="text-white"] {
    color: #ffffff !important;
  }
  
  /* Asegurar que cualquier elemento dentro de un contenedor azul tenga texto blanco si tiene la clase text-white */
  #pdf-container .bg-blue-800 .text-white,
  #pdf-container [class*="bg-blue-800"] .text-white {
    color: #ffffff !important;
  }
  #pdf-container .text-red-600 { color: #dc2626 !important; }
  #pdf-container .text-red-500 { color: #ef4444 !important; }
  #pdf-container .text-amber-800 { color: #92400e !important; }
  #pdf-container .text-amber-700 { color: #b45309 !important; }
  
  /* Fondos */
  #pdf-container .bg-white { background-color: #ffffff !important; }
  #pdf-container .bg-slate-50 { background-color: #f8fafc !important; }
  #pdf-container .bg-slate-100 { background-color: #f1f5f9 !important; }
  #pdf-container .bg-blue-800 { background-color: #1e40af !important; }
  #pdf-container .bg-amber-50 { background-color: #fffbeb !important; }
  
  /* Bordes */
  #pdf-container .border { border-width: 1px !important; border-style: solid !important; }
  #pdf-container .border-b { border-bottom-width: 1px !important; border-bottom-style: solid !important; }
  #pdf-container .border-t { border-top-width: 1px !important; border-top-style: solid !important; }
  #pdf-container .border-t-2 { border-top-width: 2px !important; border-top-style: solid !important; }
  #pdf-container .border-slate-200 { border-color: #e2e8f0 !important; }
  #pdf-container .border-slate-400 { border-color: #94a3b8 !important; }
  #pdf-container .border-amber-200 { border-color: #fde68a !important; }
  #pdf-container .border-blue-200 { border-color: #bfdbfe !important; }
  
  /* Border radius */
  #pdf-container .rounded-md { border-radius: 0.375rem !important; }
  #pdf-container .rounded-lg { border-radius: 0.5rem !important; }
  #pdf-container .rounded-l-lg { border-top-left-radius: 0.5rem !important; border-bottom-left-radius: 0.5rem !important; }
  #pdf-container .rounded-r-lg { border-top-right-radius: 0.5rem !important; border-bottom-right-radius: 0.5rem !important; }
  #pdf-container .rounded-tl-lg { border-top-left-radius: 0.5rem !important; }
  #pdf-container .rounded-tr-lg { border-top-right-radius: 0.5rem !important; }
  
  /* Tipografía */
  #pdf-container .text-sm { font-size: 0.875rem !important; line-height: 1.25rem !important; }
  #pdf-container .text-xs { font-size: 0.75rem !important; line-height: 1rem !important; }
  #pdf-container .text-lg { font-size: 1.125rem !important; line-height: 1.75rem !important; }
  #pdf-container .text-xl { font-size: 1.25rem !important; line-height: 1.75rem !important; }
  #pdf-container .text-2xl { font-size: 1.5rem !important; line-height: 2rem !important; }
  #pdf-container .text-base { font-size: 1rem !important; line-height: 1.5rem !important; }
  
  #pdf-container .font-sans { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important; }
  #pdf-container .font-bold { font-weight: 700 !important; }
  #pdf-container .font-semibold { font-weight: 600 !important; }
  #pdf-container .font-medium { font-weight: 500 !important; }
  
  /* Alineación de texto */
  #pdf-container .text-left { text-align: left !important; }
  #pdf-container .text-right { text-align: right !important; }
  #pdf-container .text-center { text-align: center !important; }
  
  /* Display */
  #pdf-container .flex { display: flex !important; }
  #pdf-container .grid { display: grid !important; }
  #pdf-container .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  #pdf-container .inline-block { display: inline-block !important; }
  
  /* Flexbox y Grid */
  #pdf-container .items-start { align-items: flex-start !important; }
  #pdf-container .items-center { align-items: center !important; }
  #pdf-container .justify-between { justify-content: space-between !important; }
  #pdf-container .justify-center { justify-content: center !important; }
  
  /* Espaciado */
  #pdf-container .gap-4 { gap: 1rem !important; }
  #pdf-container .gap-x-6 { column-gap: 1.5rem !important; }
  #pdf-container .gap-16 { gap: 4rem !important; }
  
  /* Dimensiones */
  #pdf-container .w-full { width: 100% !important; }
  #pdf-container .w-1\/2 { width: 50% !important; }
  #pdf-container .w-2\/5 { width: 40% !important; }
  #pdf-container .w-24 { width: 6rem !important; }
  #pdf-container .w-32 { width: 8rem !important; }
  #pdf-container .h-16 { height: 4rem !important; }
  #pdf-container .h-24 { height: 6rem !important; }
  #pdf-container .h-8 { height: 2rem !important; }
  #pdf-container .h-5 { height: 1.25rem !important; }
  
  /* Texto */
  #pdf-container .uppercase { text-transform: uppercase !important; }
  #pdf-container .tracking-wider { letter-spacing: 0.05em !important; }
  
  /* Dividers */
  #pdf-container .divide-y > * + * { border-top-width: 1px !important; border-top-style: solid !important; }
  #pdf-container .divide-slate-200 > * + * { border-color: #e2e8f0 !important; }
  
  /* Alineación vertical */
  #pdf-container .align-top { vertical-align: top !important; }
  
  /* White space */
  #pdf-container .whitespace-nowrap { white-space: nowrap !important; }
  
  /* Sombras */
  #pdf-container .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important; }
  
  /* Estilos adicionales críticos */
  #pdf-container .break-all { word-break: break-all !important; }
  #pdf-container .font-mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace !important; }
  #pdf-container .inline-flex { display: inline-flex !important; }
  #pdf-container .flex-1 { flex: 1 1 0% !important; }
  #pdf-container .space-y-1 > * + * { margin-top: 0.25rem !important; }
  #pdf-container .space-y-2 > * + * { margin-top: 0.5rem !important; }
  
  /* Estilos para el logo placeholder y SVG */
  #pdf-container svg { 
    display: block !important;
    vertical-align: middle !important;
  }
  
  /* Estilos para headers y títulos - reset */
  #pdf-container h1, #pdf-container h2, #pdf-container h3, 
  #pdf-container h4, #pdf-container h5, #pdf-container h6 {
    margin: 0 !important;
    font-weight: inherit !important;
  }
  
  /* Estilos para párrafos - reset */
  #pdf-container p {
    margin: 0 !important;
  }
  
  /* Estilos para tablas - asegurar que se muestren correctamente */
  #pdf-container table {
    border-collapse: collapse !important;
    width: 100% !important;
    table-layout: auto !important;
  }
  
  /* Asegurar que los headers de tabla tengan los estilos correctos */
  #pdf-container table thead tr.bg-blue-800 {
    background-color: #1e40af !important;
  }
  
  #pdf-container table thead tr.bg-blue-800 th {
    background-color: #1e40af !important;
    color: #ffffff !important;
  }
  
  #pdf-container table thead th.bg-blue-800 {
    background-color: #1e40af !important;
    color: #ffffff !important;
  }
  
  #pdf-container table thead th.text-white {
    color: #ffffff !important;
  }
  
  /* Forzar texto blanco en TODOS los elementos dentro de headers azules */
  #pdf-container table thead tr.bg-blue-800,
  #pdf-container table thead tr[class*="bg-blue-800"] {
    background-color: #1e40af !important;
  }
  
  #pdf-container table thead tr.bg-blue-800 th,
  #pdf-container table thead tr[class*="bg-blue-800"] th,
  #pdf-container table thead tr.bg-blue-800 td,
  #pdf-container table thead tr[class*="bg-blue-800"] td {
    background-color: #1e40af !important;
    color: #ffffff !important;
  }
  
  #pdf-container table thead tr.bg-blue-800 *,
  #pdf-container table thead tr[class*="bg-blue-800"] *,
  #pdf-container table thead tr.bg-blue-800 th *,
  #pdf-container table thead tr[class*="bg-blue-800"] th * {
    color: #ffffff !important;
  }
  
  /* Asegurar que la fila TOTAL tenga texto blanco */
  #pdf-container table tbody tr.bg-blue-800,
  #pdf-container table tbody tr[class*="bg-blue-800"] {
    background-color: #1e40af !important;
  }
  
  #pdf-container table tbody tr.bg-blue-800 td,
  #pdf-container table tbody tr[class*="bg-blue-800"] td {
    background-color: #1e40af !important;
    color: #ffffff !important;
  }
  
  /* Asegurar que las celdas con text-white dentro de filas bg-blue-800 funcionen */
  #pdf-container table tbody tr.bg-blue-800 td.text-white,
  #pdf-container table tbody tr[class*="bg-blue-800"] td.text-white {
    background-color: #1e40af !important;
    color: #ffffff !important;
  }
  
  #pdf-container table tbody tr.bg-blue-800 *,
  #pdf-container table tbody tr[class*="bg-blue-800"] *,
  #pdf-container table tbody tr.bg-blue-800 td *,
  #pdf-container table tbody tr[class*="bg-blue-800"] td * {
    color: #ffffff !important;
  }
  
  /* Regla específica para elementos dentro de celdas bg-blue-800 */
  #pdf-container table tbody tr.bg-blue-800 td *,
  #pdf-container table tbody tr[class*="bg-blue-800"] td * {
    color: #ffffff !important;
  }
  
  /* Regla adicional: cualquier elemento con bg-blue-800 debe tener texto blanco */
  #pdf-container [class*="bg-blue-800"] {
    color: #ffffff !important;
  }
  
  #pdf-container [class*="bg-blue-800"] *:not([class*="bg-"]) {
    color: #ffffff !important;
  }
  
  /* Asegurar que las filas de la tabla tengan bordes */
  #pdf-container table tbody tr {
    border-bottom: 1px solid #e2e8f0 !important;
  }
  
  * { 
    -webkit-print-color-adjust: exact !important; 
    print-color-adjust: exact !important; 
    color-adjust: exact !important; 
    box-sizing: border-box !important;
  }
  
  /* Estilos específicos para print-content si existen */
  .print-content {
    color: #1e293b !important;
    background-color: #ffffff !important;
  }
  
  @media print {
    body {
      padding: 0;
      margin: 0;
    }
    #pdf-container {
      width: 100%;
      max-width: 100%;
    }
  }
</style>
</head>
<body>
<div id="pdf-container">
${content}
</div>
${tailwindInitScript}
</body>
</html>`;
};

/**
 * Función para enviar el body al endpoint de debug y ver qué recibe la API
 */
const debugPdfBody = async (body: { html: string; fileName: string }): Promise<void> => {
  console.log('\n🔍 [PDF DEBUG] ========== ENVIANDO AL ENDPOINT DE DEBUG ==========');
  console.log('[PDF DEBUG] URL:', DEBUG_PDF_BODY_ENDPOINT);
  console.log('[PDF DEBUG] Body que se enviará:');
  console.log('   - html: string de', body.html.length, 'caracteres');
  console.log('   - fileName:', body.fileName);
  console.log('   - Body tamaño total:', JSON.stringify(body).length, 'bytes');
  console.log('');

  try {
    const debugResponse = await fetch(DEBUG_PDF_BODY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    console.log('[PDF DEBUG] Response status:', debugResponse.status);
    console.log('[PDF DEBUG] Response ok:', debugResponse.ok);

    if (debugResponse.ok) {
      const debugData = await debugResponse.json();
      
      console.log('\n📊 [PDF DEBUG] ========== RESPUESTA DEL ENDPOINT DE DEBUG ==========');
      console.log('[PDF DEBUG] ✅ Body recibido correctamente por el servidor');
      console.log('[PDF DEBUG] Información del body:');
      console.log('   - Tiene body:', debugData.informacionBody?.tieneBody);
      console.log('   - Tipo:', debugData.informacionBody?.tipoBody);
      console.log('   - Keys:', debugData.informacionBody?.keys?.join(', '));
      console.log('   - Cantidad de propiedades:', debugData.informacionBody?.cantidadPropiedades);
      console.log('');

      if (debugData.propiedades) {
        console.log('[PDF DEBUG] Propiedades analizadas:');
        Object.keys(debugData.propiedades).forEach(key => {
          const prop = debugData.propiedades[key];
          console.log(`   - ${key}:`);
          console.log(`     Tipo: ${prop.tipo}`);
          console.log(`     Longitud: ${prop.longitud || 'N/A'}`);
          if (prop.preview) {
            const preview = typeof prop.preview === 'string' 
              ? prop.preview.substring(0, 150) + (prop.preview.length > 150 ? '...' : '')
              : prop.preview;
            console.log(`     Preview: ${preview}`);
          }
        });
        console.log('');
      }

      if (debugData.bodyCompleto?.html) {
        const htmlInfo = debugData.bodyCompleto.html;
        if (typeof htmlInfo === 'object') {
          console.log('[PDF DEBUG] Información del HTML recibido:');
          console.log('   - Longitud:', htmlInfo.longitud, 'caracteres');
          console.log('   - Tamaño:', (htmlInfo.longitud / 1024).toFixed(2), 'KB');
          console.log('   - Contiene DOCTYPE:', htmlInfo.contieneDoctype ? '✅ Sí' : '❌ No');
          console.log('   - Contiene <html>:', htmlInfo.contieneHtml ? '✅ Sí' : '❌ No');
          console.log('   - Contiene <head>:', htmlInfo.contieneHead ? '✅ Sí' : '❌ No');
          console.log('   - Contiene <body>:', htmlInfo.contieneBody ? '✅ Sí' : '❌ No');
          console.log('   - Contiene Tailwind:', htmlInfo.contieneTailwind ? '✅ Sí' : '❌ No');
          console.log('');
          
          // Analizar el contenido del body
          if (htmlInfo.primeros500) {
            // Buscar el contenido del body
            const bodyMatch = htmlInfo.primeros500.match(/<body[^>]*>([\s\S]*?)(?:<\/body>|$)/i);
            const bodyContent = bodyMatch ? bodyMatch[1] : '';
            
            console.log('[PDF DEBUG] Contenido del <body> (primeros 500 chars):');
            console.log('─'.repeat(80));
            console.log(bodyContent.substring(0, 500));
            console.log('─'.repeat(80));
            
            // Verificar si hay contenido visible
            const textContent = bodyContent.replace(/<[^>]*>/g, '').trim();
            console.log('');
            console.log('[PDF DEBUG] Texto extraíble del body (primeros 200 chars):');
            console.log('─'.repeat(80));
            console.log(textContent.substring(0, 200));
            console.log('─'.repeat(80));
            console.log('   - Longitud del texto extraíble:', textContent.length, 'caracteres');
            console.log('   - ¿Tiene contenido visible?:', textContent.length > 0 ? '✅ Sí' : '❌ No');
          }
          
          // Ver los últimos 500 caracteres también
          if (htmlInfo.ultimos500) {
            console.log('');
            console.log('[PDF DEBUG] Últimos 500 caracteres del HTML:');
            console.log('─'.repeat(80));
            console.log(htmlInfo.ultimos500);
            console.log('─'.repeat(80));
          }
        }
      }
      
      // Analizar el HTML completo que se envió
      if (body.html) {
        console.log('');
        console.log('[PDF DEBUG] ========== ANÁLISIS DEL HTML COMPLETO ==========');
        
        // Buscar el contenido del body
        const bodyMatch = body.html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          const bodyContent = bodyMatch[1];
          const textContent = bodyContent.replace(/<[^>]*>/g, '').trim();
          
          console.log('[PDF DEBUG] Contenido del <body>:');
          console.log('   - Longitud del body HTML:', bodyContent.length, 'caracteres');
          console.log('   - Longitud del texto extraíble:', textContent.length, 'caracteres');
          console.log('   - ¿Tiene contenido?:', textContent.length > 0 ? '✅ Sí' : '❌ No');
          
          // Buscar el contenedor PDF
          const pdfContainerMatch = bodyContent.match(/<div[^>]*id=["']pdf-container["'][^>]*>([\s\S]*?)<\/div>/i);
          if (pdfContainerMatch) {
            const containerContent = pdfContainerMatch[1];
            const containerText = containerContent.replace(/<[^>]*>/g, '').trim();
            console.log('[PDF DEBUG] Contenido del #pdf-container:');
            console.log('   - Longitud:', containerContent.length, 'caracteres');
            console.log('   - Texto extraíble:', containerText.length, 'caracteres');
            console.log('   - Preview (primeros 300 chars):', containerText.substring(0, 300));
          } else {
            console.log('[PDF DEBUG] ⚠️ No se encontró #pdf-container en el HTML');
          }
          
          // Contar elementos
          const divs = (bodyContent.match(/<div/g) || []).length;
          const tables = (bodyContent.match(/<table/g) || []).length;
          const paragraphs = (bodyContent.match(/<p/g) || []).length;
          const images = (bodyContent.match(/<img/g) || []).length;
          
          console.log('');
          console.log('[PDF DEBUG] Elementos en el body:');
          console.log('   - Divs:', divs);
          console.log('   - Tablas:', tables);
          console.log('   - Párrafos:', paragraphs);
          console.log('   - Imágenes:', images);
        } else {
          console.log('[PDF DEBUG] ⚠️ No se encontró <body> en el HTML');
        }
        
        console.log('[PDF DEBUG] ========== FIN DEL ANÁLISIS ==========');
      }

      console.log('[PDF DEBUG] ========== FIN DEL DEBUG ==========\n');
    } else {
      console.warn('[PDF DEBUG] ⚠️ El endpoint de debug respondió con error:', debugResponse.status);
      const errorText = await debugResponse.text();
      console.warn('[PDF DEBUG] Error:', errorText);
    }
  } catch (error) {
    console.warn('[PDF DEBUG] ⚠️ Error al llamar al endpoint de debug:', error);
    console.warn('[PDF DEBUG] Continuando con la generación del PDF...');
  }
};

export const descargarElementoComoPDF = async (
  element: HTMLElement,
  options: GeneratePdfOptions = {},
): Promise<void> => {
  console.log('[PDF Client] ========== INICIANDO GENERACIÓN DE PDF ==========');
  console.log('[PDF Client] Elemento:', element);
  console.log('[PDF Client] Opciones:', options);
  
  if (!element) {
    throw new Error('El elemento HTML es requerido');
  }

  // Verificar que el elemento esté en el DOM
  if (!element.isConnected) {
    throw new Error('El elemento no está conectado al DOM. Asegúrate de que el componente esté montado.');
  }

  // Verificar que el elemento tenga contenido visible
  // Esperar hasta que el elemento tenga contenido o hasta 2 segundos
  let elementText = element.textContent || element.innerText || '';
  let elementHTML = element.innerHTML || '';
  let attempts = 0;
  const maxAttempts = 20; // 20 intentos * 100ms = 2 segundos máximo
  
  console.log('[PDF Client] Verificación inicial del elemento:');
  console.log('   - Texto del elemento:', elementText.substring(0, 100), '...');
  console.log('   - Longitud del texto:', elementText.length, 'caracteres');
  console.log('   - Longitud del HTML interno:', elementHTML.length, 'caracteres');
  console.log('   - Número de hijos:', element.children.length);
  console.log('   - Está conectado al DOM:', element.isConnected);
  
  // Verificar estilos computados para asegurar que el elemento sea visible
  const computedStyle = window.getComputedStyle(element);
  console.log('   - Display:', computedStyle.display);
  console.log('   - Visibility:', computedStyle.visibility);
  console.log('   - Opacity:', computedStyle.opacity);
  console.log('   - Height:', computedStyle.height);
  console.log('   - Width:', computedStyle.width);
  
  // Esperar a que el elemento tenga contenido
  while ((elementText.length === 0 && elementHTML.length === 0) && attempts < maxAttempts) {
    console.warn(`[PDF Client] ⚠️ El elemento parece estar vacío. Intento ${attempts + 1}/${maxAttempts}...`);
    await new Promise(resolve => setTimeout(resolve, 100));
    elementText = element.textContent || element.innerText || '';
    elementHTML = element.innerHTML || '';
    attempts++;
  }
  
  if (elementText.length === 0 && elementHTML.length === 0) {
    console.error('[PDF Client] ❌ El elemento está vacío después de esperar');
    console.error('[PDF Client] Elemento completo:', element);
    console.error('[PDF Client] OuterHTML:', element.outerHTML.substring(0, 500));
    throw new Error('El elemento HTML está vacío después de esperar. El componente puede no estar completamente renderizado o el ref no está apuntando al elemento correcto.');
  }
  
  console.log('[PDF Client] ✅ Elemento tiene contenido después de', attempts, 'intentos');
  console.log('   - Texto final:', elementText.substring(0, 100), '...');
  console.log('   - Longitud del texto final:', elementText.length, 'caracteres');
  console.log('   - Longitud del HTML final:', elementHTML.length, 'caracteres');

  // Clonar el elemento y limpiar elementos que no deben aparecer
  console.log('[PDF Client] Clonando elemento...');
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Remover elementos que no deben aparecer en el PDF
  clone.querySelectorAll('[data-ignore-pdf="true"]').forEach((node) => node.remove());
  
  // Verificar el contenido del clon
  const cloneText = clone.textContent || clone.innerText || '';
  const cloneHTML = clone.innerHTML || '';
  const cloneOuterHTML = clone.outerHTML || '';
  
  console.log('[PDF Client] Verificación del clon:');
  console.log('   - Texto del clon:', cloneText.substring(0, 100), '...');
  console.log('   - Longitud del texto:', cloneText.length, 'caracteres');
  console.log('   - Longitud del HTML interno (innerHTML):', cloneHTML.length, 'caracteres');
  console.log('   - Longitud del HTML externo (outerHTML):', cloneOuterHTML.length, 'caracteres');
  console.log('   - Número de hijos directos:', clone.children.length);
  console.log('   - Número total de elementos:', clone.querySelectorAll('*').length);
  
  // Si el clon no tiene contenido, usar el elemento original
  if (cloneHTML.length === 0 && cloneText.length === 0) {
    console.warn('[PDF Client] ⚠️ El clon está vacío, usando el elemento original');
    throw new Error('El clon del elemento está vacío. El elemento original puede no tener contenido renderizado.');
  }
  
  // Obtener el HTML del contenido
  // Prioridad: innerHTML > outerHTML (sin el tag wrapper) > XMLSerializer
  let serialized: string;
  
  if (cloneHTML.length > 0) {
    // Usar innerHTML directamente - es más limpio y no agrega xmlns
    serialized = cloneHTML;
    console.log('[PDF Client] ✅ Usando innerHTML del clon');
  } else if (cloneOuterHTML.length > 0) {
    // Fallback: usar outerHTML pero remover el tag wrapper
    console.warn('[PDF Client] ⚠️ innerHTML vacío, usando outerHTML y removiendo wrapper');
    serialized = cloneOuterHTML;
    
    // Remover el tag wrapper si existe
    const tagMatch = serialized.match(/^<[^>]+>(.*)<\/[^>]+>$/s);
    if (tagMatch && tagMatch[1]) {
      serialized = tagMatch[1];
    }
  } else {
    // Último recurso: usar XMLSerializer
    console.warn('[PDF Client] ⚠️ HTML vacío, usando XMLSerializer como último recurso');
    serialized = new XMLSerializer().serializeToString(clone);
    
    // Limpiar el HTML serializado: remover xmlns
    serialized = serialized
      .replace(/xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '')
      .replace(/xmlns='http:\/\/www\.w3\.org\/1999\/xhtml'/g, '')
      .trim();
    
    // Si el serializado empieza con un div wrapper y termina con </div>, removerlo
    if (serialized.match(/^<div[^>]*>.*<\/div>$/s)) {
      const tagMatch = serialized.match(/^<div[^>]*>(.*)<\/div>$/s);
      if (tagMatch && tagMatch[1]) {
        serialized = tagMatch[1];
      }
    }
  }
  
  serialized = serialized.trim();
  
  console.log('[PDF Client] HTML serializado final:');
  console.log('   - Longitud:', serialized.length, 'caracteres');
  console.log('   - Preview (primeros 300 chars):', serialized.substring(0, 300));
  console.log('   - Preview (últimos 300 chars):', serialized.substring(Math.max(0, serialized.length - 300)));
  
  // Verificar que el HTML tenga contenido
  const serializedText = serialized.replace(/<[^>]*>/g, '').trim();
  console.log('[PDF Client] Análisis del HTML serializado:');
  console.log('   - Texto extraíble:', serializedText.length, 'caracteres');
  console.log('   - Preview del texto (primeros 200 chars):', serializedText.substring(0, 200));
  console.log('   - Número de elementos HTML:', (serialized.match(/<[^>]+>/g) || []).length);
  
  // Validación final: el HTML debe tener contenido
  if (serialized.length === 0) {
    console.error('[PDF Client] ❌ ERROR CRÍTICO: El HTML serializado está completamente vacío');
    console.error('[PDF Client] Elemento original:');
    console.error('   - innerHTML:', element.innerHTML.substring(0, 500));
    console.error('   - outerHTML:', element.outerHTML.substring(0, 500));
    console.error('   - textContent:', element.textContent?.substring(0, 200));
    throw new Error('El HTML serializado está vacío. El componente puede no estar completamente renderizado o el ref no está apuntando al elemento correcto.');
  }
  
  if (serializedText.length === 0) {
    console.warn('[PDF Client] ⚠️ ADVERTENCIA: El HTML no tiene texto extraíble, pero tiene estructura HTML');
    console.warn('[PDF Client] Esto puede ser normal si el componente solo tiene elementos estructurados sin texto');
    console.warn('[PDF Client] HTML completo:', serialized.substring(0, 1000));
  }
  
  // Construir documento HTML completo
  console.log('[PDF Client] Construyendo documento HTML con contenido serializado...');
  console.log('[PDF Client] Contenido a insertar (primeros 300 chars):', serialized.substring(0, 300));
  console.log('[PDF Client] Contenido a insertar (últimos 300 chars):', serialized.substring(Math.max(0, serialized.length - 300)));
  
  const htmlDocument = buildHtmlDocument(serialized);
  console.log('[PDF Client] HTML documento completo, longitud:', htmlDocument.length);
  console.log('[PDF Client] Endpoint API:', PDF_ENDPOINT);
  
    // Verificar que el contenido serializado se insertó correctamente en el documento
    // El contenido debería estar dentro del #pdf-container
    // Nota: La verificación del contenido es solo para debugging
    // El contenido real se está enviando correctamente (lo vemos en el body completo)
    console.log('[PDF Client] ℹ️ Verificación del documento HTML:');
    console.log('   - El contenido serializado tiene', serialized.length, 'caracteres');
    console.log('   - El contenido serializado tiene', serialized.replace(/<[^>]*>/g, '').trim().length, 'caracteres de texto extraíble');
    console.log('   - El documento HTML completo tiene', htmlDocument.length, 'caracteres');
    console.log('   - El documento contiene #pdf-container:', htmlDocument.includes('id="pdf-container"') || htmlDocument.includes("id='pdf-container'") ? '✅ Sí' : '❌ No');
  
  // Verificar que el documento HTML tenga contenido en el body y en #pdf-container
  const bodyMatch = htmlDocument.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    const bodyContent = bodyMatch[1];
    const bodyText = bodyContent.replace(/<[^>]*>/g, '').trim();
    
    console.log('[PDF Client] ========== VERIFICACIÓN FINAL DEL DOCUMENTO HTML ==========');
    console.log('[PDF Client] Body HTML:');
    console.log('   - Longitud del body HTML:', bodyContent.length, 'caracteres');
    console.log('   - Texto extraíble del body:', bodyText.length, 'caracteres');
    console.log('   - Contiene #pdf-container:', bodyContent.includes('id="pdf-container"') || bodyContent.includes("id='pdf-container'") ? '✅ Sí' : '❌ No');
    
    // Verificar que el contenido serializado esté presente en el body
    // El contenido serializado debería estar dentro del #pdf-container
    const serializedPreview = serialized.substring(0, 100);
    const bodyContainsContent = bodyContent.includes(serializedPreview) || 
                                bodyContent.includes(serialized.substring(0, 50));
    
    console.log('[PDF Client] Verificación del contenido serializado en el body:');
    console.log('   - El body contiene el contenido serializado:', bodyContainsContent ? '✅ Sí' : '❌ No');
    
    if (!bodyContainsContent) {
      console.warn('[PDF Client] ⚠️ ADVERTENCIA: El contenido serializado no se encontró directamente en el body');
      console.warn('[PDF Client] Esto puede ser normal si el contenido se transformó durante la inserción');
    }
    
    // Verificar que #pdf-container existe y tiene algún contenido
    const hasPdfContainer = bodyContent.includes('id="pdf-container"') || bodyContent.includes("id='pdf-container'");
    if (!hasPdfContainer) {
      console.error('[PDF Client] ❌ ERROR: No se encontró #pdf-container en el documento HTML');
      console.error('[PDF Client] Body content (primeros 500 chars):', bodyContent.substring(0, 500));
      throw new Error('No se encontró #pdf-container en el documento HTML. El documento puede estar mal formado.');
    }
    
    // Extraer una muestra del contenido dentro del #pdf-container para verificación
    // Buscar el inicio del #pdf-container y tomar los siguientes 500 caracteres
    const pdfContainerStart = bodyContent.search(/<div[^>]*id=["']pdf-container["'][^>]*>/i);
    if (pdfContainerStart !== -1) {
      const afterContainerStart = bodyContent.substring(pdfContainerStart);
      const containerSample = afterContainerStart.substring(0, Math.min(500, afterContainerStart.length));
      const containerTextSample = containerSample.replace(/<[^>]*>/g, '').trim();
      
      console.log('[PDF Client] Muestra del contenido dentro de #pdf-container:');
      console.log('   - Muestra del HTML (primeros 300 chars después del tag):', containerSample.substring(0, 300));
      console.log('   - Texto extraíble de la muestra:', containerTextSample.length, 'caracteres');
      console.log('   - Preview del texto (primeros 150 chars):', containerTextSample.substring(0, 150));
      
      if (containerTextSample.length === 0) {
        console.error('[PDF Client] ❌ ERROR: El #pdf-container parece estar vacío');
        console.error('[PDF Client] Muestra completa:', containerSample);
        throw new Error('El #pdf-container está vacío. El contenido no se está insertando correctamente en el documento HTML.');
      } else {
        console.log('[PDF Client] ✅ El #pdf-container tiene contenido');
      }
    }
    
    // Verificar que haya contenido en el body - esto es lo importante
    if (bodyText.length === 0) {
      console.error('[PDF Client] ❌ ERROR: El body del documento HTML no tiene texto extraíble');
      console.error('[PDF Client] Esto puede indicar un problema con el contenido.');
      throw new Error('El body del documento HTML está vacío. El contenido no se está capturando correctamente.');
    } else {
      console.log('[PDF Client] ✅ El documento HTML tiene contenido válido en el body');
      console.log('   - Preview del texto del body (primeros 150 chars):', bodyText.substring(0, 150));
    }
    
    console.log('[PDF Client] ========== FIN DE VERIFICACIÓN ==========');
  } else {
    console.error('[PDF Client] ❌ ERROR: No se encontró <body> en el documento HTML');
    throw new Error('El documento HTML no tiene un tag <body>. El documento puede estar mal formado.');
  }

  // Preparar el body para la API
  const body = {
    html: htmlDocument,
    fileName: options.fileName ?? 'documento.pdf'
  };
  
  console.log('[PDF Client] Body preparado:');
  console.log('   - html: string de', body.html.length, 'caracteres');
  console.log('   - fileName:', body.fileName);
  console.log('   - Body tamaño total:', JSON.stringify(body).length, 'bytes');

  // Modo debug: enviar primero al endpoint de debug si está activado
  const shouldDebug = options.debug !== undefined ? options.debug : DEBUG_MODE;
  if (shouldDebug) {
    await debugPdfBody(body);
  }

  console.log('[PDF Client] Enviando request a la API para generar PDF...');

  try {
    const response = await fetch(PDF_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    console.log('[PDF Client] Response status:', response.status);
    console.log('[PDF Client] Response ok:', response.ok);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
      console.error('[PDF Client] Error response:', errorData);
      throw new Error(`Error generando PDF (${response.status}): ${errorData.message || 'Error desconocido'}`);
    }

    console.log('[PDF Client] Obteniendo blob del PDF...');
    const blob = await response.blob();
    console.log('[PDF Client] Blob recibido, tamaño:', blob.size, 'bytes');
    
    // Crear URL temporal y descargar
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = body.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    
    console.log('[PDF Client] ✅ PDF descargado exitosamente');
  } catch (error) {
    console.error('[PDF Client] ❌ Error en la generación de PDF:', error);
    if (error instanceof Error) {
      console.error('[PDF Client] Mensaje de error:', error.message);
      console.error('[PDF Client] Stack:', error.stack);
    }
    throw error;
  }
};
