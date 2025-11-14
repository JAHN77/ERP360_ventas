/**
 * Ejemplo de uso de la API de generación de PDFs
 * 
 * Para ejecutar:
 * node examples/test-pdf-api.js
 * 
 * Requiere: axios (npm install axios)
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuración
const API_URL = process.env.API_URL || 'http://localhost:3001/api/generar-pdf';
const OUTPUT_DIR = path.join(__dirname, '../output');

// Crear directorio de salida si no existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Genera un PDF simple
 */
async function generarPDFSimple() {
  console.log('📄 Generando PDF simple...');
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            line-height: 1.6;
          }
          h1 {
            color: #333;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          p {
            margin: 15px 0;
          }
        </style>
      </head>
      <body>
        <h1>Documento de Prueba</h1>
        <p>Este es un PDF de prueba generado desde la API.</p>
        <p>Fecha: ${new Date().toLocaleString()}</p>
        <p>Este documento demuestra la funcionalidad de generación de PDFs.</p>
      </body>
    </html>
  `;

  try {
    const response = await axios.post(
      API_URL,
      {
        html: html,
        fileName: 'documento-simple.pdf'
      },
      {
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const outputPath = path.join(OUTPUT_DIR, 'documento-simple.pdf');
    fs.writeFileSync(outputPath, response.data);
    console.log(`✅ PDF generado: ${outputPath}`);
    console.log(`   Tamaño: ${(response.data.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('❌ Error generando PDF:', error.message);
    if (error.response) {
      console.error('   Detalles:', error.response.data);
    }
  }
}

/**
 * Genera un PDF con tabla
 */
async function generarPDFConTabla() {
  console.log('📊 Generando PDF con tabla...');
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
          }
          h1 {
            color: #333;
            text-align: center;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #4CAF50;
            color: white;
          }
          tr:nth-child(even) {
            background-color: #f2f2f2;
          }
        </style>
      </head>
      <body>
        <h1>Reporte de Productos</h1>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>Producto A</td>
              <td>10</td>
              <td>$100.00</td>
            </tr>
            <tr>
              <td>2</td>
              <td>Producto B</td>
              <td>20</td>
              <td>$200.00</td>
            </tr>
            <tr>
              <td>3</td>
              <td>Producto C</td>
              <td>30</td>
              <td>$300.00</td>
            </tr>
          </tbody>
        </table>
        <p style="text-align: right; margin-top: 30px;">
          <strong>Total: $600.00</strong>
        </p>
      </body>
    </html>
  `;

  try {
    const response = await axios.post(
      API_URL,
      {
        html: html,
        fileName: 'reporte-productos.pdf'
      },
      {
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const outputPath = path.join(OUTPUT_DIR, 'reporte-productos.pdf');
    fs.writeFileSync(outputPath, response.data);
    console.log(`✅ PDF generado: ${outputPath}`);
    console.log(`   Tamaño: ${(response.data.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('❌ Error generando PDF:', error.message);
    if (error.response) {
      console.error('   Detalles:', error.response.data);
    }
  }
}

/**
 * Genera un PDF con imagen base64
 */
async function generarPDFConImagen() {
  console.log('🖼️  Generando PDF con imagen...');
  
  // Imagen base64 pequeña (1x1 pixel rojo)
  const imagenBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
          }
          .logo {
            text-align: center;
            margin: 20px 0;
          }
          .logo img {
            width: 100px;
            height: 100px;
          }
        </style>
      </head>
      <body>
        <div class="logo">
          <img src="${imagenBase64}" alt="Logo">
        </div>
        <h1>Documento con Imagen</h1>
        <p>Este PDF incluye una imagen embebida usando base64.</p>
      </body>
    </html>
  `;

  try {
    const response = await axios.post(
      API_URL,
      {
        html: html,
        fileName: 'documento-con-imagen.pdf'
      },
      {
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const outputPath = path.join(OUTPUT_DIR, 'documento-con-imagen.pdf');
    fs.writeFileSync(outputPath, response.data);
    console.log(`✅ PDF generado: ${outputPath}`);
    console.log(`   Tamaño: ${(response.data.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('❌ Error generando PDF:', error.message);
    if (error.response) {
      console.error('   Detalles:', error.response.data);
    }
  }
}

/**
 * Prueba de error - HTML vacío
 */
async function pruebaErrorHTMLVacio() {
  console.log('⚠️  Probando error con HTML vacío...');
  
  try {
    const response = await axios.post(
      API_URL,
      {
        html: '',
        fileName: 'error.pdf'
      },
      {
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('❌ No se lanzó el error esperado');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Error manejado correctamente:', error.response.data.message);
    } else {
      console.error('❌ Error inesperado:', error.message);
    }
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 Iniciando pruebas de la API de generación de PDFs\n');
  console.log(`📍 URL de la API: ${API_URL}\n`);
  
  // Ejecutar todas las pruebas
  await generarPDFSimple();
  console.log('');
  
  await generarPDFConTabla();
  console.log('');
  
  await generarPDFConImagen();
  console.log('');
  
  await pruebaErrorHTMLVacio();
  console.log('');
  
  console.log('✨ Pruebas completadas');
  console.log(`📁 PDFs guardados en: ${OUTPUT_DIR}`);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  generarPDFSimple,
  generarPDFConTabla,
  generarPDFConImagen,
  pruebaErrorHTMLVacio
};

