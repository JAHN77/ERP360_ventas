/**
 * EJEMPLO SIMPLE: Body para crear PDF con Tailwind CSS
 * 
 * Copia y pega este código en tu aplicación frontend o backend
 */

// Ejemplo de body para la API de generación de PDFs con Tailwind CSS
const bodyEjemplo = {
  html: `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>PDF con Tailwind</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @page { margin: 0; size: A4; }
        body { margin: 0; padding: 0; }
    </style>
</head>
<body class="bg-gray-50">
    <div class="max-w-4xl mx-auto bg-white shadow-lg">
        <!-- Header con gradiente -->
        <header class="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
            <h1 class="text-3xl font-bold">ERP360 Comercial</h1>
            <p class="text-blue-100 mt-1">Sistema de Gestión de Ventas</p>
        </header>

        <!-- Contenido -->
        <main class="p-6">
            <!-- Información -->
            <section class="mb-6">
                <h2 class="text-2xl font-semibold text-gray-800 mb-4 border-b-2 border-blue-500 pb-2">
                    Información del Cliente
                </h2>
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <p class="text-sm text-gray-600">Nombre</p>
                        <p class="text-lg font-semibold text-gray-800">Cliente de Prueba S.A.S</p>
                    </div>
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <p class="text-sm text-gray-600">NIT</p>
                        <p class="text-lg font-semibold text-gray-800">900.123.456-7</p>
                    </div>
                </div>
            </section>

            <!-- Tabla -->
            <section class="mb-6">
                <h2 class="text-2xl font-semibold text-gray-800 mb-4 border-b-2 border-blue-500 pb-2">
                    Productos
                </h2>
                <table class="min-w-full divide-y divide-gray-200 border border-gray-300">
                    <thead class="bg-gray-800 text-white">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium uppercase">Código</th>
                            <th class="px-4 py-3 text-left text-xs font-medium uppercase">Producto</th>
                            <th class="px-4 py-3 text-right text-xs font-medium uppercase">Cantidad</th>
                            <th class="px-4 py-3 text-right text-xs font-medium uppercase">Precio</th>
                            <th class="px-4 py-3 text-right text-xs font-medium uppercase">Total</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr>
                            <td class="px-4 py-3 text-sm text-gray-900">PROD-001</td>
                            <td class="px-4 py-3 text-sm text-gray-900">Producto A</td>
                            <td class="px-4 py-3 text-sm text-gray-900 text-right">10</td>
                            <td class="px-4 py-3 text-sm text-gray-900 text-right">$50.000</td>
                            <td class="px-4 py-3 text-sm font-semibold text-gray-900 text-right">$500.000</td>
                        </tr>
                        <tr class="bg-gray-50">
                            <td class="px-4 py-3 text-sm text-gray-900">PROD-002</td>
                            <td class="px-4 py-3 text-sm text-gray-900">Producto B</td>
                            <td class="px-4 py-3 text-sm text-gray-900 text-right">5</td>
                            <td class="px-4 py-3 text-sm text-gray-900 text-right">$75.000</td>
                            <td class="px-4 py-3 text-sm font-semibold text-gray-900 text-right">$375.000</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <!-- Totales -->
            <section class="mb-6">
                <div class="flex justify-end">
                    <div class="w-80">
                        <div class="bg-gray-50 p-4 rounded-lg border border-gray-300">
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-700 font-medium">Subtotal:</span>
                                <span class="text-gray-900 font-semibold">$875.000</span>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-700 font-medium">IVA (19%):</span>
                                <span class="text-gray-900 font-semibold">$166.250</span>
                            </div>
                            <div class="flex justify-between pt-2 border-t-2 border-gray-400 mt-2">
                                <span class="text-lg font-bold text-gray-900">TOTAL:</span>
                                <span class="text-lg font-bold text-blue-600">$1.041.250</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Badges -->
            <section class="mb-6">
                <div class="flex gap-4 flex-wrap">
                    <span class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        ✓ Aprobado
                    </span>
                    <span class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        📦 En Proceso
                    </span>
                </div>
            </section>
        </main>

        <!-- Footer -->
        <footer class="bg-gray-800 text-white p-4 text-center text-sm">
            <p>ERP360 Comercial Ventas - Sistema de Gestión</p>
        </footer>
    </div>
</body>
</html>`,
  fileName: 'documento-tailwind.pdf'
};

// Ejemplo de uso con fetch
async function generarPDF() {
  try {
    const response = await fetch('http://localhost:3001/api/generar-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyEjemplo)
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = bodyEjemplo.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    
    console.log('PDF generado exitosamente');
  } catch (error) {
    console.error('Error generando PDF:', error);
  }
}

// Exportar para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { bodyEjemplo, generarPDF };
}

