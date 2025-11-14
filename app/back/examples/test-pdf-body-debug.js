/**
 * Script para probar y ver exactamente qué se envía al body de la API de generar PDF
 * 
 * Uso:
 *   node examples/test-pdf-body-debug.js
 * 
 * Este script envía una petición al endpoint /api/debug-pdf-body que devuelve
 * exactamente lo que recibe en el body, sin procesarlo.
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';

// HTML de ejemplo similar al que se enviaría desde el frontend
const htmlEjemplo = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ejemplo PDF</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { background: #1e40af; color: white; padding: 20px; border-radius: 8px; }
        .content { padding: 20px; background: #f9fafb; margin-top: 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Documento de Prueba</h1>
        </div>
        <div class="content">
            <p>Este es un documento de ejemplo para probar la API de generación de PDF.</p>
            <p>Fecha: ${new Date().toLocaleString('es-ES')}</p>
        </div>
    </div>
</body>
</html>`;

// Body que se enviaría
const body = {
    html: htmlEjemplo,
    fileName: 'documento-prueba.pdf'
};

async function testBodyDebug() {
    console.log('🚀 Enviando petición a /api/debug-pdf-body...');
    console.log('📋 URL:', `${API_BASE_URL}/debug-pdf-body`);
    console.log('📦 Body que se envía:');
    console.log('   - html: string de', body.html.length, 'caracteres');
    console.log('   - fileName:', body.fileName);
    console.log('');

    try {
        const response = await fetch(`${API_BASE_URL}/debug-pdf-body`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        console.log('📥 Response status:', response.status);
        console.log('📥 Response headers:');
        response.headers.forEach((value, key) => {
            console.log(`   - ${key}: ${value}`);
        });
        console.log('');

        const data = await response.json();

        console.log('✅ Respuesta recibida:');
        console.log('═'.repeat(80));
        console.log(JSON.stringify(data, null, 2));
        console.log('═'.repeat(80));
        console.log('');

        // Mostrar información clave
        if (data.informacionBody) {
            console.log('📊 Información del Body:');
            console.log('   - Tiene body:', data.informacionBody.tieneBody);
            console.log('   - Tipo:', data.informacionBody.tipoBody);
            console.log('   - Keys:', data.informacionBody.keys.join(', '));
            console.log('   - Cantidad de propiedades:', data.informacionBody.cantidadPropiedades);
            console.log('');
        }

        if (data.propiedades) {
            console.log('📋 Propiedades del Body:');
            Object.keys(data.propiedades).forEach(key => {
                const prop = data.propiedades[key];
                console.log(`   - ${key}:`);
                console.log(`     Tipo: ${prop.tipo}`);
                console.log(`     Longitud: ${prop.longitud || 'N/A'}`);
                if (prop.preview) {
                    console.log(`     Preview: ${prop.preview.substring(0, 100)}...`);
                }
            });
            console.log('');
        }

        if (data.bodyCompleto && data.bodyCompleto.html) {
            const htmlInfo = data.bodyCompleto.html;
            if (typeof htmlInfo === 'object') {
                console.log('📄 Información del HTML:');
                console.log('   - Longitud:', htmlInfo.longitud, 'caracteres');
                console.log('   - Contiene DOCTYPE:', htmlInfo.contieneDoctype);
                console.log('   - Contiene <html>:', htmlInfo.contieneHtml);
                console.log('   - Contiene <head>:', htmlInfo.contieneHead);
                console.log('   - Contiene <body>:', htmlInfo.contieneBody);
                console.log('   - Contiene Tailwind:', htmlInfo.contieneTailwind);
                console.log('');
                console.log('   Primeros 500 caracteres:');
                console.log('   ' + '─'.repeat(70));
                console.log('   ' + htmlInfo.primeros500.split('\n').join('\n   '));
                console.log('   ' + '─'.repeat(70));
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Ejecutar
testBodyDebug();

