/**
 * EJEMPLO: Body para generar PDF de Cotización desde React Component
 * 
 * Este ejemplo muestra cómo convertir el componente CotizacionPDF.tsx a HTML estático
 * para enviarlo a la API de generación de PDFs
 */

// Función helper para formatear moneda
const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP', 
        minimumFractionDigits: 0 
    }).format(value);
};

/**
 * Genera el HTML completo para una cotización
 * Basado en el componente CotizacionPDF.tsx
 */
function generarHTMLCotizacion(data) {
    const {
        cotizacion,
        cliente,
        vendedor,
        empresa,
        preferences = {
            showPrices: true,
            signatureType: 'physical',
            detailLevel: 'full'
        }
    } = data;

    // Calcular total de descuentos
    const totalDescuentos = cotizacion.items.reduce((acc, item) => {
        const itemTotal = item.precioUnitario * item.cantidad;
        return acc + (itemTotal * (item.descuentoPorcentaje / 100));
    }, 0);

    // Generar filas de la tabla de items
    const itemsHTML = cotizacion.items.map((item) => {
        const product = cotizacion.productos?.find(p => p.id === item.productoId) || {};
        
        if (preferences.showPrices) {
            return `
                <tr class="text-sm">
                    <td class="p-3 text-slate-600 align-top">${product.referencia || 'N/A'}</td>
                    <td class="p-3 font-semibold text-slate-800 align-top">${item.descripcion}</td>
                    <td class="p-3 text-slate-600 align-top">${product.unidadMedida || 'UND'}</td>
                    <td class="p-3 text-right text-slate-600 align-top">${item.cantidad}</td>
                    <td class="p-3 text-right text-slate-600 align-top">${formatCurrency(item.precioUnitario)}</td>
                    <td class="p-3 text-right text-red-600 align-top">${item.descuentoPorcentaje.toFixed(2)}%</td>
                    <td class="p-3 text-right font-medium text-slate-800 align-top">${formatCurrency(item.total)}</td>
                    <td class="p-3 text-right text-slate-600 align-top">${formatCurrency(item.valorIva)}</td>
                </tr>
            `;
        } else {
            return `
                <tr class="text-sm">
                    <td class="p-3 text-slate-600 align-top">${product.referencia || 'N/A'}</td>
                    <td class="p-3 font-semibold text-slate-800 align-top">${item.descripcion}</td>
                    <td class="p-3 text-slate-600 align-top">${product.unidadMedida || 'UND'}</td>
                    <td class="p-3 text-right text-slate-600 align-top">${item.cantidad}</td>
                    <td></td>
                </tr>
            `;
        }
    }).join('');

    // Generar HTML completo
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cotización ${cotizacion.numeroCotizacion}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @page {
            margin: 0;
            size: A4;
        }
        body {
            margin: 0;
            padding: 0;
        }
    </style>
</head>
<body class="bg-white">
    <div class="p-10 text-slate-800 bg-white font-sans text-sm">
        <!-- Encabezado -->
        <header class="flex justify-between items-start mb-8 pb-4 border-b border-slate-200">
            <div class="flex items-start gap-4">
                <div class="h-16 w-16 bg-slate-100 flex items-center justify-center rounded-md text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <div>
                    <h2 class="text-lg font-bold text-slate-900">${empresa.nombre}</h2>
                    <p class="text-sm text-slate-600">NIT: ${empresa.nit}</p>
                    <p class="text-sm text-slate-600">${empresa.direccion}</p>
                    ${empresa.telefono ? `<p class="text-sm text-slate-600">Tel: ${empresa.telefono}</p>` : ''}
                </div>
            </div>
            <div class="text-right">
                <h1 class="text-2xl font-bold text-slate-900">COTIZACIÓN</h1>
                <p class="font-semibold text-xl text-red-600">${cotizacion.numeroCotizacion}</p>
                <div class="mt-4 text-sm text-slate-600">
                    <p><span class="font-semibold text-slate-700">Fecha de Emisión:</span> ${new Date(cotizacion.fechaCotizacion).toLocaleDateString('es-CO')}</p>
                    <p><span class="font-semibold text-slate-700">Válida hasta:</span> ${new Date(cotizacion.fechaVencimiento).toLocaleDateString('es-CO')}</p>
                </div>
            </div>
        </header>

        <!-- Datos del Cliente y Condiciones -->
        <section class="grid grid-cols-2 gap-x-6 my-8">
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-md">
                <h3 class="text-xs font-semibold text-slate-500 mb-1 tracking-wider uppercase">CLIENTE</h3>
                <p class="font-bold text-base text-slate-900">${cliente.nombreCompleto}</p>
                <p class="text-sm text-slate-600">${cliente.tipoDocumentoId || 'NIT'}: ${cliente.numeroDocumento}</p>
                <p class="text-sm text-slate-600">${cliente.direccion || ''}, ${cliente.ciudadId || ''}</p>
                <p class="text-sm text-slate-600">${cliente.email || ''} | ${cliente.telefono || ''}</p>
            </div>
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-md">
                <h3 class="text-xs font-semibold text-slate-500 mb-1 tracking-wider uppercase">CONDICIONES</h3>
                <p class="text-sm"><span class="font-semibold text-slate-700 w-32 inline-block">Vendedor:</span> ${vendedor.primerNombre} ${vendedor.primerApellido}</p>
                <p class="text-sm"><span class="font-semibold text-slate-700 w-32 inline-block">Cond. de Pago:</span> ${cliente.condicionPago || 'Contado'}</p>
                <p class="text-sm"><span class="font-semibold text-slate-700 w-32 inline-block">Tiempo de Entrega:</span> 5-7 días hábiles</p>
            </div>
        </section>

        <!-- Tabla de Items -->
        <section class="mb-8">
            <table class="w-full text-left">
                <thead class="rounded-lg">
                    <tr class="text-white text-sm font-semibold bg-blue-800">
                        <th class="p-3 text-left rounded-l-lg whitespace-nowrap">Referencia</th>
                        <th class="p-3 text-left w-2/5">Descripción</th>
                        <th class="p-3 text-left whitespace-nowrap">Unidad</th>
                        <th class="p-3 text-right whitespace-nowrap">Cant.</th>
                        ${preferences.showPrices ? `
                            <th class="p-3 text-right whitespace-nowrap">P. Unitario</th>
                            <th class="p-3 text-right whitespace-nowrap">% Dcto</th>
                            <th class="p-3 text-right whitespace-nowrap">Subtotal</th>
                            <th class="p-3 text-right rounded-r-lg whitespace-nowrap">Valor IVA</th>
                        ` : '<th class="p-3 text-right rounded-r-lg"></th>'}
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-200">
                    ${itemsHTML}
                </tbody>
            </table>
        </section>
        
        <!-- Totales y Observaciones -->
        <section class="flex justify-between items-start">
            <div class="w-1/2 text-slate-600">
                <h3 class="text-xs font-semibold text-slate-500 mb-1 tracking-wider uppercase">Observaciones</h3>
                <p class="p-2 border border-slate-200 rounded-md bg-slate-50 h-24 text-sm">
                    ${cotizacion.observaciones || 'Costos de transporte no incluidos. La instalación se cotiza por separado.'}
                </p>
            </div>
            ${preferences.showPrices ? `
                <div class="w-2/5">
                    <table class="w-full text-sm">
                        <tbody>
                            <tr class="text-slate-700">
                                <td class="py-1 pr-4 text-right">Subtotal Bruto</td>
                                <td class="py-1 text-right font-medium">${formatCurrency(cotizacion.subtotal + totalDescuentos)}</td>
                            </tr>
                            <tr class="text-red-500">
                                <td class="py-1 pr-4 text-right">Descuentos</td>
                                <td class="py-1 text-right font-medium">-${formatCurrency(totalDescuentos)}</td>
                            </tr>
                            <tr class="text-slate-800 font-semibold border-t border-blue-200">
                                <td class="py-1 pr-4 text-right">Subtotal Neto</td>
                                <td class="py-1 text-right">${formatCurrency(cotizacion.subtotal)}</td>
                            </tr>
                            <tr class="text-slate-700">
                                <td class="pt-1 pb-2 pr-4 text-right">IVA (${cotizacion.items[0]?.ivaPorcentaje || 19}%)</td>
                                <td class="pt-1 pb-2 pr-4 text-right font-medium">${formatCurrency(cotizacion.ivaValor)}</td>
                            </tr>
                            ${cotizacion.domicilios && cotizacion.domicilios > 0 ? `
                            <tr class="text-slate-700">
                                <td class="py-1 pr-4 text-right">Domicilios</td>
                                <td class="py-1 pr-4 text-right font-medium">${formatCurrency(cotizacion.domicilios)}</td>
                            </tr>
                            ` : ''}
                            <tr class="font-bold text-lg bg-blue-800 text-white shadow-lg">
                                <td class="p-2 text-right rounded-l-lg">TOTAL</td>
                                <td class="p-2 text-right rounded-r-lg">${formatCurrency(cotizacion.total)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            ` : ''}
        </section>
        
        <!-- Términos y Firmas -->
        ${preferences.signatureType !== 'none' ? `
            <footer class="mt-16 text-xs text-slate-600">
                ${preferences.detailLevel === 'full' ? `
                    <div class="mb-12">
                        <h3 class="text-xs font-semibold text-slate-500 mb-1 tracking-wider uppercase">Términos y Condiciones</h3>
                        <p>1. Precios sujetos a cambio sin previo aviso. Validez de la oferta hasta la fecha indicada.</p>
                        <p>2. Garantía de 12 meses sobre defectos de fabricación. No cubre mal uso.</p>
                    </div>
                ` : ''}
                ${preferences.signatureType === 'physical' ? `
                    <div class="grid grid-cols-2 gap-16 pt-8">
                        <div class="text-center">
                            <div class="border-t-2 border-slate-400 pt-2">
                                <p class="font-semibold text-slate-700">${vendedor.primerNombre} ${vendedor.primerApellido}</p>
                                <p>Asesor Comercial, ${empresa.nombre}</p>
                            </div>
                        </div>
                        <div class="text-center">
                            <div class="border-t-2 border-slate-400 pt-2">
                                <p class="font-semibold text-slate-700">Aprobado por Cliente</p>
                                <p>(Firma, Nombre y Sello)</p>
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${preferences.signatureType === 'digital' ? `
                    <div class="text-center pt-8">
                        <p>Documento Aprobado Digitalmente</p>
                    </div>
                ` : ''}
            </footer>
        ` : ''}
    </div>
</body>
</html>
    `;

    return html;
}

/**
 * Ejemplo de datos de cotización
 */
const datosEjemplo = {
    cotizacion: {
        numeroCotizacion: 'COT-2025-001',
        fechaCotizacion: '2025-11-09',
        fechaVencimiento: '2025-11-23',
        subtotal: 1000000,
        ivaValor: 190000,
        total: 1190000,
        domicilios: 0,
        observaciones: 'Cotización válida por 15 días',
        items: [
            {
                productoId: 1,
                descripcion: 'Producto A - Descripción detallada del producto',
                cantidad: 10,
                precioUnitario: 50000,
                descuentoPorcentaje: 5,
                total: 475000,
                valorIva: 90250,
                ivaPorcentaje: 19
            },
            {
                productoId: 2,
                descripcion: 'Producto B - Otra descripción',
                cantidad: 5,
                precioUnitario: 75000,
                descuentoPorcentaje: 0,
                total: 375000,
                valorIva: 71250,
                ivaPorcentaje: 19
            },
            {
                productoId: 3,
                descripcion: 'Producto C - Tercer producto',
                cantidad: 8,
                precioUnitario: 30000,
                descuentoPorcentaje: 10,
                total: 216000,
                valorIva: 41040,
                ivaPorcentaje: 19
            }
        ],
        productos: [
            { id: 1, referencia: 'REF-001', unidadMedida: 'UND' },
            { id: 2, referencia: 'REF-002', unidadMedida: 'UND' },
            { id: 3, referencia: 'REF-003', unidadMedida: 'UND' }
        ]
    },
    cliente: {
        nombreCompleto: 'Cliente de Prueba S.A.S',
        tipoDocumentoId: 'NIT',
        numeroDocumento: '900.123.456-7',
        direccion: 'Calle 123 #45-67',
        ciudadId: 'Bogotá',
        email: 'cliente@ejemplo.com',
        telefono: '+57 300 123 4567',
        condicionPago: '30 días'
    },
    vendedor: {
        primerNombre: 'Juan',
        primerApellido: 'Pérez'
    },
    empresa: {
        nombre: 'ERP360 Comercial',
        nit: '900.000.000-1',
        direccion: 'Carrera 10 #20-30, Bogotá',
        telefono: '+57 1 234 5678'
    },
    preferences: {
        showPrices: true,
        signatureType: 'physical',
        detailLevel: 'full'
    }
};

/**
 * Genera el body para la API
 */
function generarBodyCotizacion(data) {
    const html = generarHTMLCotizacion(data);
    const safeClientName = data.cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');
    
    return {
        html: html,
        fileName: `Cotizacion-${data.cotizacion.numeroCotizacion}-${safeClientName}.pdf`
    };
}

// Ejemplo de uso
if (require.main === module) {
    const body = generarBodyCotizacion(datosEjemplo);
    console.log('Body generado:');
    console.log(JSON.stringify(body, null, 2));
}

module.exports = {
    generarHTMLCotizacion,
    generarBodyCotizacion,
    datosEjemplo
};

