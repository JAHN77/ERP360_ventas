import ExcelJS from 'exceljs';
import { Factura, NotaCredito, Cliente, InvProducto, Vendedor } from '../types';

// Helper para formatear moneda
const formatCurrencyValue = (value: number): string => {
    return new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP', 
        minimumFractionDigits: 0 
    }).format(value);
};

// Helper para formatear fecha
const formatDate = (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('es-CO');
};

// Helper para aplicar estilos de encabezado
const applyHeaderStyle = (cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1e40af' } // Blue-800
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
    };
};

// Helper para aplicar estilos de celda de datos
const applyDataStyle = (cell: ExcelJS.Cell, isNumber: boolean = false, isCurrency: boolean = false) => {
    if (isCurrency) {
        cell.numFmt = '$#,##0';
        cell.alignment = { horizontal: 'right' };
    } else if (isNumber) {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
    }
    cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
};

// Helper para aplicar estilos de KPI
const applyKPIStyle = (cell: ExcelJS.Cell, isTotal: boolean = false) => {
    cell.font = { bold: true, size: isTotal ? 14 : 12, color: { argb: isTotal ? 'FF1e40af' : 'FF1e293b' } };
    if (isTotal) {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF1F5F9' }
        };
    }
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
};

/**
 * Exporta un informe profesional de Ventas por Período
 * Estructura:
 * - Hoja 1: DATA_Ventas (datos crudos)
 * - Hoja 2: Informe_Periodo (presentación con KPIs, tabla resumen, instrucciones para tablas dinámicas)
 */
export const exportVentasPorPeriodoExcel = async (
    facturas: Factura[],
    notasCredito: NotaCredito[],
    clientes: Cliente[],
    productos: InvProducto[],
    vendedores: Vendedor[],
    categorias: any[],
    startDate: Date,
    endDate: Date,
    fileName: string = 'Informe_Ventas_Por_Periodo'
) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ERP360';
    workbook.created = new Date();

    // ========== HOJA 1: DATA_Ventas (Datos Crudos) ==========
    const dataSheet = workbook.addWorksheet('DATA_Ventas');
    
    // Preparar datos crudos de ventas
    const ventasData: any[] = [];
    facturas
        .filter(f => {
            const invoiceDate = new Date(f.fechaFactura);
            return invoiceDate >= startDate && 
                   invoiceDate <= endDate && 
                   f.estado !== 'ANULADA' && 
                   f.estado !== 'BORRADOR';
        })
        .forEach(factura => {
            const devolucionesTotal = notasCredito
                .filter(nc => String(nc.facturaId) === String(factura.id))
                .reduce((sum, nc) => sum + (nc.total || 0), 0);
            
            const cliente = clientes.find(c => c.id === factura.clienteId);
            const vendedor = vendedores.find(v => 
                String(v.id) === String(factura.vendedorId) || 
                v.codiEmple === factura.vendedorId
            );

            (factura.items || []).forEach(item => {
                const producto = productos.find(p => p.id === item.productoId);
                const categoria = categorias.find(c => c.id === producto?.categoriaId);
                
                const subtotalBruto = item.precioUnitario * item.cantidad;
                const descuento = subtotalBruto * (item.descuentoPorcentaje || 0) / 100;
                const subtotalNeto = subtotalBruto - descuento;
                const valorIva = subtotalNeto * ((item.ivaPorcentaje || 0) / 100);
                const totalVenta = subtotalNeto + valorIva;
                const costoUnitario = producto?.ultimoCosto || 0;
                const totalCosto = costoUnitario * item.cantidad;
                
                ventasData.push({
                    Fecha: formatDate(factura.fechaFactura),
                    ID_Factura: factura.numeroFactura || `FAC-${factura.id}`,
                    ID_Cliente: cliente?.numeroDocumento || factura.clienteId || '',
                    Cliente_Nombre: cliente?.nombreCompleto || cliente?.razonSocial || 'Desconocido',
                    ID_Producto: producto?.id || item.productoId,
                    Producto_Referencia: producto?.referencia || 'N/A',
                    Producto_Descripcion: item.descripcion || producto?.nombre || 'N/A',
                    Categoria: categoria?.nombre || 'Sin categoría',
                    Vendedor: vendedor?.nombreCompleto || vendedor?.nombre || 'Sin vendedor',
                    Unidades: item.cantidad,
                    Precio_Unitario: item.precioUnitario,
                    Costo_Unitario: costoUnitario,
                    Descuento_Porcentaje: item.descuentoPorcentaje || 0,
                    Descuento_Valor: descuento,
                    Subtotal_Bruto: subtotalBruto,
                    Subtotal_Neto: subtotalNeto,
                    IVA_Porcentaje: item.ivaPorcentaje || 0,
                    IVA_Valor: valorIva,
                    Total_Venta: totalVenta,
                    Total_Costo: totalCosto,
                    Margen_Bruto: totalVenta - totalCosto,
                    Margen_Porcentaje: totalVenta > 0 ? ((totalVenta - totalCosto) / totalVenta * 100) : 0
                });
            });
        });

    // Encabezados de DATA_Ventas
    const dataHeaders = [
        'Fecha', 'ID_Factura', 'ID_Cliente', 'Cliente_Nombre', 'ID_Producto', 'Producto_Referencia',
        'Producto_Descripcion', 'Categoria', 'Vendedor', 'Unidades', 'Precio_Unitario', 'Costo_Unitario',
        'Descuento_Porcentaje', 'Descuento_Valor', 'Subtotal_Bruto', 'Subtotal_Neto', 'IVA_Porcentaje',
        'IVA_Valor', 'Total_Venta', 'Total_Costo', 'Margen_Bruto', 'Margen_Porcentaje'
    ];

    dataSheet.addRow(dataHeaders);
    const headerRow = dataSheet.getRow(1);
    dataHeaders.forEach((_, colIndex) => {
        const cell = headerRow.getCell(colIndex + 1);
        applyHeaderStyle(cell);
    });

    // Agregar datos
    ventasData.forEach(row => {
        const excelRow = dataSheet.addRow([
            row.Fecha, row.ID_Factura, row.ID_Cliente, row.Cliente_Nombre,
            row.ID_Producto, row.Producto_Referencia, row.Producto_Descripcion,
            row.Categoria, row.Vendedor, row.Unidades, row.Precio_Unitario,
            row.Costo_Unitario, row.Descuento_Porcentaje, row.Descuento_Valor,
            row.Subtotal_Bruto, row.Subtotal_Neto, row.IVA_Porcentaje, row.IVA_Valor,
            row.Total_Venta, row.Total_Costo, row.Margen_Bruto, row.Margen_Porcentaje
        ]);
        
        excelRow.eachCell((cell, colNumber) => {
            const header = dataHeaders[colNumber - 1];
            const isNumber = ['Unidades', 'Descuento_Porcentaje', 'IVA_Porcentaje', 'Margen_Porcentaje'].includes(header);
            const isCurrency = [
                'Precio_Unitario', 'Costo_Unitario', 'Descuento_Valor', 'Subtotal_Bruto',
                'Subtotal_Neto', 'IVA_Valor', 'Total_Venta', 'Total_Costo', 'Margen_Bruto'
            ].includes(header);
            applyDataStyle(cell, isNumber, isCurrency);
        });
    });

    // Ajustar ancho de columnas
    dataSheet.columns.forEach((column, index) => {
        column.width = Math.min(20, Math.max(12, dataHeaders[index].length + 2));
    });

    // ========== HOJA 2: Informe_Periodo (Presentación) ==========
    const reportSheet = workbook.addWorksheet('Informe_Periodo');
    
    // Título
    const titleRow = reportSheet.addRow(['Informe de Rendimiento de Ventas por Período']);
    reportSheet.mergeCells('A1:G1');
    const titleCell = reportSheet.getCell('A1');
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1e40af' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 30;

    // Rango de fechas
    reportSheet.addRow([]);
    const dateRangeRow = reportSheet.addRow([
        `Datos analizados del ${formatDate(startDate)} al ${formatDate(endDate)}`
    ]);
    reportSheet.mergeCells('A3:G3');
    const dateRangeCell = reportSheet.getCell('A3');
    dateRangeCell.font = { size: 11, italic: true, color: { argb: 'FF64748b' } };
    dateRangeCell.alignment = { horizontal: 'center' };

    reportSheet.addRow([]);

    // Calcular KPIs
    const totalVentas = ventasData.reduce((sum, r) => sum + (r.Total_Venta || 0), 0);
    const totalCosto = ventasData.reduce((sum, r) => sum + (r.Total_Costo || 0), 0);
    const margenBruto = totalVentas - totalCosto;
    const margenPorcentaje = totalVentas > 0 ? (margenBruto / totalVentas * 100) : 0;
    const unidadesVendidas = ventasData.reduce((sum, r) => sum + (r.Unidades || 0), 0);
    const numTransacciones = new Set(ventasData.map(r => r.ID_Factura)).size;
    const ticketPromedio = numTransacciones > 0 ? totalVentas / numTransacciones : 0;

    // Sección de KPIs
    reportSheet.addRow(['KPIs Clave']);
    reportSheet.mergeCells('A6:G6');
    const kpiTitleCell = reportSheet.getCell('A6');
    kpiTitleCell.font = { bold: true, size: 12, color: { argb: 'FF1e293b' } };
    kpiTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
    };
    
    reportSheet.addRow([]);

    // Tarjetas de KPIs
    const kpiData = [
        ['Ventas Totales ($)', totalVentas, true],
        ['Costo Total de Ventas (CMV) ($)', totalCosto, true],
        ['Margen Bruto ($)', margenBruto, true],
        ['Margen Bruto (%)', margenPorcentaje, false],
        ['Unidades Vendidas', unidadesVendidas, false],
        ['N° de Transacciones', numTransacciones, false],
        ['Ticket Promedio ($)', ticketPromedio, true]
    ];

    kpiData.forEach(([label, value, isCurrency], index) => {
        const row = Math.floor(index / 3) + 8;
        const col = (index % 3) * 2 + 1;
        
        const labelCell = reportSheet.getCell(row, col);
        labelCell.value = label as string;
        labelCell.font = { size: 10, color: { argb: 'FF64748b' } };
        
        const valueCell = reportSheet.getCell(row, col + 1);
        valueCell.value = value as number;
        if (isCurrency) {
            valueCell.numFmt = '$#,##0';
        } else if (label === 'Margen Bruto (%)') {
            valueCell.numFmt = '#,##0.00"%';
        } else {
            valueCell.numFmt = '#,##0';
        }
        applyKPIStyle(valueCell, index === 0); // Primera fila es total
    });

    reportSheet.addRow([]);
    reportSheet.addRow([]);

    // Tabla Resumen Agrupada por Mes
    const summaryRow = reportSheet.addRow(['Resumen por Mes']);
    reportSheet.mergeCells(`A${reportSheet.rowCount}:G${reportSheet.rowCount}`);
    const summaryTitleCell = reportSheet.getCell(`A${reportSheet.rowCount}`);
    summaryTitleCell.font = { bold: true, size: 12, color: { argb: 'FF1e293b' } };
    summaryTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
    };

    reportSheet.addRow([]);

    // Agrupar por mes
    const monthlyData = new Map<string, {
        ventas: number;
        costo: number;
        unidades: number;
        transacciones: Set<string>;
    }>();

    ventasData.forEach(row => {
        const date = new Date(row.Fecha);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
        
        if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, {
                ventas: 0,
                costo: 0,
                unidades: 0,
                transacciones: new Set()
            });
        }
        
        const monthData = monthlyData.get(monthKey)!;
        monthData.ventas += row.Total_Venta || 0;
        monthData.costo += row.Total_Costo || 0;
        monthData.unidades += row.Unidades || 0;
        monthData.transacciones.add(row.ID_Factura);
    });

    // Encabezados de tabla resumen
    const summaryHeaders = ['Mes', 'Ventas Totales ($)', 'Costo Total ($)', 'Margen Bruto ($)', 'Margen (%)', 'Unidades', 'Transacciones', 'Ticket Promedio ($)'];
    reportSheet.addRow(summaryHeaders);
    const summaryHeaderRow = reportSheet.getRow(reportSheet.rowCount);
    summaryHeaders.forEach((_, colIndex) => {
        const cell = summaryHeaderRow.getCell(colIndex + 1);
        applyHeaderStyle(cell);
    });

    // Agregar datos mensuales ordenados
    Array.from(monthlyData.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([monthKey, data]) => {
            const date = new Date(monthKey + '-01');
            const monthName = date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
            const margen = data.ventas - data.costo;
            const margenPct = data.ventas > 0 ? (margen / data.ventas * 100) : 0;
            const ticketProm = data.transacciones.size > 0 ? data.ventas / data.transacciones.size : 0;

            const summaryRow = reportSheet.addRow([
                monthName,
                data.ventas,
                data.costo,
                margen,
                margenPct,
                data.unidades,
                data.transacciones.size,
                ticketProm
            ]);

            summaryRow.eachCell((cell, colNumber) => {
                if (colNumber === 1) {
                    cell.font = { bold: true };
                } else {
                    const header = summaryHeaders[colNumber - 1];
                    const isCurrency = header.includes('($)') || header.includes('($)');
                    const isPercent = header.includes('%');
                    if (isCurrency) {
                        cell.numFmt = '$#,##0';
                    } else if (isPercent) {
                        cell.numFmt = '#,##0.00"%';
                    } else {
                        cell.numFmt = '#,##0';
                    }
                    applyDataStyle(cell, true, isCurrency);
                }
            });
        });

    // Fila de totales
    const totalRow = reportSheet.addRow([
        'TOTAL',
        totalVentas,
        totalCosto,
        margenBruto,
        margenPorcentaje,
        unidadesVendidas,
        numTransacciones,
        ticketPromedio
    ]);
    
    totalRow.eachCell((cell, colNumber) => {
        if (colNumber === 1) {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF1F5F9' }
            };
        } else {
            const header = summaryHeaders[colNumber - 1];
            const isCurrency = header.includes('($)');
            const isPercent = header.includes('%');
            if (isCurrency) {
                cell.numFmt = '$#,##0';
            } else if (isPercent) {
                cell.numFmt = '#,##0.00"%';
            } else {
                cell.numFmt = '#,##0';
            }
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF1F5F9' }
            };
            applyDataStyle(cell, true, isCurrency);
        }
    });

    // Instrucciones para crear Tabla Dinámica
    reportSheet.addRow([]);
    reportSheet.addRow([]);
    const instructionsRow = reportSheet.addRow(['📊 INSTRUCCIONES PARA CREAR TABLA DINÁMICA']);
    reportSheet.mergeCells(`A${reportSheet.rowCount}:G${reportSheet.rowCount}`);
    const instructionsCell = reportSheet.getCell(`A${reportSheet.rowCount}`);
    instructionsCell.font = { bold: true, size: 11, color: { argb: 'FF1e40af' } };
    instructionsCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
    };

    reportSheet.addRow([
        '1. Selecciona la hoja "DATA_Ventas"',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '2. Inserta > Tabla Dinámica > Usar tabla o rango existente',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '3. Arrastra "Fecha" a FILAS (para agrupar por Año, Trimestre, Mes)',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '4. Arrastra "Total_Venta" a VALORES > Suma',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '5. Arrastra "Margen_Bruto" a VALORES > Suma',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '6. Agrega "Categoria" o "Vendedor" a FILTROS para segmentar',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);

    // Ajustar anchos de columnas en la hoja de informe
    reportSheet.columns.forEach(column => {
        column.width = 18;
    });
    reportSheet.getColumn(1).width = 25;

    // Descargar archivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Exporta un informe profesional de Ventas por Cliente
 * Estructura:
 * - Hoja 1: DATA_Ventas_Cliente (datos crudos)
 * - Hoja 2: Informe_Cliente (presentación con KPIs, ranking de clientes, instrucciones)
 */
export const exportVentasPorClienteExcel = async (
    facturas: Factura[],
    notasCredito: NotaCredito[],
    clientes: Cliente[],
    productos: InvProducto[],
    categorias: any[],
    fileName: string = 'Informe_Ventas_Por_Cliente'
) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ERP360';
    workbook.created = new Date();

    // ========== HOJA 1: DATA_Ventas_Cliente (Datos Crudos) ==========
    const dataSheet = workbook.addWorksheet('DATA_Ventas_Cliente');
    
    // Preparar datos crudos de ventas por cliente
    const ventasData: any[] = [];
    facturas
        .filter(f => f.estado !== 'ANULADA' && f.estado !== 'BORRADOR')
        .forEach(factura => {
            const devolucionesTotal = notasCredito
                .filter(nc => String(nc.facturaId) === String(factura.id))
                .reduce((sum, nc) => sum + (nc.total || 0), 0);
            
            const cliente = clientes.find(c => c.id === factura.clienteId);
            const totalNeto = (factura.total || 0) - devolucionesTotal;

            (factura.items || []).forEach(item => {
                const producto = productos.find(p => p.id === item.productoId);
                const categoria = categorias.find(c => c.id === producto?.categoriaId);
                
                const subtotalBruto = item.precioUnitario * item.cantidad;
                const descuento = subtotalBruto * (item.descuentoPorcentaje || 0) / 100;
                const subtotalNeto = subtotalBruto - descuento;
                const valorIva = subtotalNeto * ((item.ivaPorcentaje || 0) / 100);
                const totalVenta = subtotalNeto + valorIva;
                const costoUnitario = producto?.ultimoCosto || 0;
                const totalCosto = costoUnitario * item.cantidad;
                const margenBruto = totalVenta - totalCosto;
                
                ventasData.push({
                    Fecha: formatDate(factura.fechaFactura),
                    ID_Factura: factura.numeroFactura || `FAC-${factura.id}`,
                    ID_Cliente: cliente?.numeroDocumento || factura.clienteId || '',
                    Cliente_Nombre: cliente?.nombreCompleto || cliente?.razonSocial || 'Desconocido',
                    Cliente_Direccion: cliente?.direccion || '',
                    Cliente_Ciudad: cliente?.ciudadId || '',
                    ID_Producto: producto?.id || item.productoId,
                    Producto_Descripcion: item.descripcion || producto?.nombre || 'N/A',
                    Categoria: categoria?.nombre || 'Sin categoría',
                    Unidades: item.cantidad,
                    Total_Venta: totalVenta,
                    Total_Costo: totalCosto,
                    Margen_Bruto: margenBruto,
                    Margen_Porcentaje: totalVenta > 0 ? (margenBruto / totalVenta * 100) : 0
                });
            });
        });

    // Encabezados de DATA_Ventas_Cliente
    const dataHeaders = [
        'Fecha', 'ID_Factura', 'ID_Cliente', 'Cliente_Nombre', 'Cliente_Direccion', 'Cliente_Ciudad',
        'ID_Producto', 'Producto_Descripcion', 'Categoria', 'Unidades',
        'Total_Venta', 'Total_Costo', 'Margen_Bruto', 'Margen_Porcentaje'
    ];

    dataSheet.addRow(dataHeaders);
    const headerRow = dataSheet.getRow(1);
    dataHeaders.forEach((_, colIndex) => {
        const cell = headerRow.getCell(colIndex + 1);
        applyHeaderStyle(cell);
    });

    // Agregar datos
    ventasData.forEach(row => {
        const excelRow = dataSheet.addRow([
            row.Fecha, row.ID_Factura, row.ID_Cliente, row.Cliente_Nombre,
            row.Cliente_Direccion, row.Cliente_Ciudad, row.ID_Producto,
            row.Producto_Descripcion, row.Categoria, row.Unidades,
            row.Total_Venta, row.Total_Costo, row.Margen_Bruto, row.Margen_Porcentaje
        ]);
        
        excelRow.eachCell((cell, colNumber) => {
            const header = dataHeaders[colNumber - 1];
            const isNumber = ['Unidades', 'Margen_Porcentaje'].includes(header);
            const isCurrency = ['Total_Venta', 'Total_Costo', 'Margen_Bruto'].includes(header);
            applyDataStyle(cell, isNumber, isCurrency);
        });
    });

    // Ajustar ancho de columnas
    dataSheet.columns.forEach((column, index) => {
        column.width = Math.min(25, Math.max(12, dataHeaders[index].length + 2));
    });

    // ========== HOJA 2: Informe_Cliente (Presentación) ==========
    const reportSheet = workbook.addWorksheet('Informe_Cliente');
    
    // Título
    const titleRow = reportSheet.addRow(['Análisis de Cartera de Clientes']);
    reportSheet.mergeCells('A1:H1');
    const titleCell = reportSheet.getCell('A1');
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1e40af' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 30;

    reportSheet.addRow([]);

    // Agrupar por cliente
    const clienteSalesMap = new Map<string, {
        clienteNombre: string;
        clienteId: string;
        totalSales: number;
        totalCosto: number;
        orderCount: number;
        lastOrder: string;
        firstOrder: string;
        items: number;
    }>();

    ventasData.forEach(row => {
        const clienteKey = row.ID_Cliente || row.Cliente_Nombre;
        if (!clienteSalesMap.has(clienteKey)) {
            clienteSalesMap.set(clienteKey, {
                clienteNombre: row.Cliente_Nombre,
                clienteId: row.ID_Cliente,
                totalSales: 0,
                totalCosto: 0,
                orderCount: 0,
                lastOrder: '',
                firstOrder: '',
                items: 0
            });
        }

        const clienteData = clienteSalesMap.get(clienteKey)!;
        clienteData.totalSales += row.Total_Venta || 0;
        clienteData.totalCosto += row.Total_Costo || 0;
        clienteData.items += row.Unidades || 0;
        
        if (!clienteData.lastOrder || row.Fecha > clienteData.lastOrder) {
            clienteData.lastOrder = row.Fecha;
        }
        if (!clienteData.firstOrder || row.Fecha < clienteData.firstOrder) {
            clienteData.firstOrder = row.Fecha;
        }
    });

    // Contar facturas únicas por cliente
    const facturasPorCliente = new Map<string, Set<string>>();
    ventasData.forEach(row => {
        const clienteKey = row.ID_Cliente || row.Cliente_Nombre;
        if (!facturasPorCliente.has(clienteKey)) {
            facturasPorCliente.set(clienteKey, new Set());
        }
        facturasPorCliente.get(clienteKey)!.add(row.ID_Factura);
    });

    facturasPorCliente.forEach((facturasSet, clienteKey) => {
        const clienteData = clienteSalesMap.get(clienteKey);
        if (clienteData) {
            clienteData.orderCount = facturasSet.size;
        }
    });

    // Calcular KPIs
    const totalClientes = clienteSalesMap.size;
    const totalVentas = Array.from(clienteSalesMap.values()).reduce((sum, c) => sum + c.totalSales, 0);
    const ventaPromedio = totalClientes > 0 ? totalVentas / totalClientes : 0;
    const frecuenciaPromedio = Array.from(clienteSalesMap.values()).reduce((sum, c) => sum + c.orderCount, 0) / totalClientes;

    // Sección de KPIs
    reportSheet.addRow(['KPIs Clave']);
    reportSheet.mergeCells('A3:H3');
    const kpiTitleCell = reportSheet.getCell('A3');
    kpiTitleCell.font = { bold: true, size: 12, color: { argb: 'FF1e293b' } };
    kpiTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
    };
    
    reportSheet.addRow([]);

    // Tarjetas de KPIs
    const kpiData = [
        ['Total de Clientes', totalClientes, false],
        ['Venta Promedio por Cliente ($)', ventaPromedio, true],
        ['Frecuencia Promedio de Compra', frecuenciaPromedio.toFixed(2), false]
    ];

    kpiData.forEach(([label, value], index) => {
        const row = index + 5;
        const labelCell = reportSheet.getCell(row, 1);
        labelCell.value = label as string;
        labelCell.font = { size: 10, color: { argb: 'FF64748b' } };
        
        const valueCell = reportSheet.getCell(row, 2);
        valueCell.value = typeof value === 'string' ? parseFloat(value) : (value as number);
        if (typeof value === 'string' && value.includes('.')) {
            valueCell.numFmt = '#,##0.00';
        } else if ((label as string).includes('($)')) {
            valueCell.numFmt = '$#,##0';
        } else {
            valueCell.numFmt = '#,##0';
        }
        applyKPIStyle(valueCell);
    });

    reportSheet.addRow([]);
    reportSheet.addRow([]);

    // Ranking de Clientes
    const rankingTitleRow = reportSheet.addRow(['Ranking de Clientes']);
    reportSheet.mergeCells(`A${reportSheet.rowCount}:H${reportSheet.rowCount}`);
    const rankingTitleCell = reportSheet.getCell(`A${reportSheet.rowCount}`);
    rankingTitleCell.font = { bold: true, size: 12, color: { argb: 'FF1e293b' } };
    rankingTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
    };

    reportSheet.addRow([]);

    // Encabezados de ranking
    const rankingHeaders = [
        'Cliente', 'Ventas Totales ($)', 'Margen Bruto ($)', 'Margen (%)',
        'Nº Facturas', 'Ticket Promedio ($)', 'Fecha Última Compra', '% Contribución'
    ];
    reportSheet.addRow(rankingHeaders);
    const rankingHeaderRow = reportSheet.getRow(reportSheet.rowCount);
    rankingHeaders.forEach((_, colIndex) => {
        const cell = rankingHeaderRow.getCell(colIndex + 1);
        applyHeaderStyle(cell);
    });

    // Ordenar clientes por ventas totales (mayor a menor)
    const clientesOrdenados = Array.from(clienteSalesMap.entries())
        .map(([clienteKey, data]) => ({
            ...data,
            clienteKey,
            margenBruto: data.totalSales - data.totalCosto,
            margenPorcentaje: data.totalSales > 0 ? ((data.totalSales - data.totalCosto) / data.totalSales * 100) : 0,
            ticketPromedio: data.orderCount > 0 ? data.totalSales / data.orderCount : 0,
            contribucion: totalVentas > 0 ? (data.totalSales / totalVentas * 100) : 0
        }))
        .sort((a, b) => b.totalSales - a.totalSales);

    // Agregar datos de ranking
    clientesOrdenados.forEach((cliente, index) => {
        const rankingRow = reportSheet.addRow([
            cliente.clienteNombre,
            cliente.totalSales,
            cliente.margenBruto,
            cliente.margenPorcentaje,
            cliente.orderCount,
            cliente.ticketPromedio,
            formatDate(cliente.lastOrder),
            cliente.contribucion
        ]);

        rankingRow.eachCell((cell, colNumber) => {
            if (colNumber === 1) {
                cell.font = { bold: true };
                if (index < 10) {
                    // Resaltar top 10
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFFBEB' }
                    };
                }
            } else {
                const header = rankingHeaders[colNumber - 1];
                const isCurrency = header.includes('($)');
                const isPercent = header.includes('%') || header.includes('Porcentaje');
                if (isCurrency) {
                    cell.numFmt = '$#,##0';
                } else if (isPercent) {
                    cell.numFmt = '#,##0.00"%';
                } else {
                    cell.numFmt = '#,##0';
                }
                applyDataStyle(cell, true, isCurrency);
                
                if (index < 10 && colNumber > 1) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFFBEB' }
                    };
                }
            }
        });
    });

    // Fila de totales
    const totalVentasRanking = clientesOrdenados.reduce((sum, c) => sum + c.totalSales, 0);
    const totalMargen = clientesOrdenados.reduce((sum, c) => sum + c.margenBruto, 0);
    const totalFacturas = clientesOrdenados.reduce((sum, c) => sum + c.orderCount, 0);
    const promedioTicket = totalFacturas > 0 ? totalVentasRanking / totalFacturas : 0;

    const totalRowRanking = reportSheet.addRow([
        'TOTAL',
        totalVentasRanking,
        totalMargen,
        totalVentasRanking > 0 ? (totalMargen / totalVentasRanking * 100) : 0,
        totalFacturas,
        promedioTicket,
        '',
        100
    ]);
    
    totalRowRanking.eachCell((cell, colNumber) => {
        if (colNumber === 1) {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF1F5F9' }
            };
        } else if (colNumber !== 7) { // Skip fecha
            const header = rankingHeaders[colNumber - 1];
            const isCurrency = header.includes('($)');
            const isPercent = header.includes('%');
            if (isCurrency) {
                cell.numFmt = '$#,##0';
            } else if (isPercent) {
                cell.numFmt = '#,##0.00"%';
            } else {
                cell.numFmt = '#,##0';
            }
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF1F5F9' }
            };
            applyDataStyle(cell, true, isCurrency);
        }
    });

    // Top 10 Clientes (Tabla estática)
    reportSheet.addRow([]);
    reportSheet.addRow([]);
    const top10TitleRow = reportSheet.addRow(['Top 10 Clientes por Ventas']);
    reportSheet.mergeCells(`A${reportSheet.rowCount}:D${reportSheet.rowCount}`);
    const top10TitleCell = reportSheet.getCell(`A${reportSheet.rowCount}`);
    top10TitleCell.font = { bold: true, size: 12, color: { argb: 'FF1e293b' } };
    top10TitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
    };

    reportSheet.addRow([]);

    const top10Headers = ['#', 'Cliente', 'Ventas Totales ($)', '% Contribución'];
    reportSheet.addRow(top10Headers);
    const top10HeaderRow = reportSheet.getRow(reportSheet.rowCount);
    top10Headers.forEach((_, colIndex) => {
        const cell = top10HeaderRow.getCell(colIndex + 1);
        applyHeaderStyle(cell);
    });

    clientesOrdenados.slice(0, 10).forEach((cliente, index) => {
        const top10Row = reportSheet.addRow([
            index + 1,
            cliente.clienteNombre,
            cliente.totalSales,
            cliente.contribucion
        ]);

        top10Row.eachCell((cell, colNumber) => {
            if (colNumber === 1) {
                cell.font = { bold: true };
                cell.alignment = { horizontal: 'center' };
            } else if (colNumber === 2) {
                cell.font = { bold: true };
            } else {
                const header = top10Headers[colNumber - 1];
                const isCurrency = header.includes('($)');
                const isPercent = header.includes('%');
                if (isCurrency) {
                    cell.numFmt = '$#,##0';
                } else if (isPercent) {
                    cell.numFmt = '#,##0.00"%';
                }
                applyDataStyle(cell, true, isCurrency);
            }
        });
    });

    // Instrucciones para crear Tabla Dinámica
    reportSheet.addRow([]);
    reportSheet.addRow([]);
    const instructionsRow = reportSheet.addRow(['📊 INSTRUCCIONES PARA CREAR TABLA DINÁMICA Y GRÁFICO DE PARETO']);
    reportSheet.mergeCells(`A${reportSheet.rowCount}:H${reportSheet.rowCount}`);
    const instructionsCell = reportSheet.getCell(`A${reportSheet.rowCount}`);
    instructionsCell.font = { bold: true, size: 11, color: { argb: 'FF1e40af' } };
    instructionsCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
    };

    reportSheet.addRow([
        '1. Selecciona la hoja "DATA_Ventas_Cliente"',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '2. Inserta > Tabla Dinámica > Usar tabla o rango existente',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '3. Arrastra "Cliente_Nombre" a FILAS',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '4. Arrastra "Total_Venta" a VALORES > Suma',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '5. Ordena por "Total_Venta" de Mayor a Menor',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '6. Crea una columna calculada "% Acumulado" = SUMA(Total_Venta) / TOTAL',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '7. Inserta un gráfico combinado (Barras + Línea) para visualizar el principio de Pareto',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);

    // Ajustar anchos de columnas
    reportSheet.columns.forEach(column => {
        column.width = 20;
    });
    reportSheet.getColumn(1).width = 30; // Columna Cliente más ancha

    // Descargar archivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Exporta un informe profesional de Movimiento de Inventario
 * Estructura:
 * - Hoja 1: DATA_Movimientos (datos crudos de movimientos)
 * - Hoja 2: DATA_Productos (tabla maestra de productos)
 * - Hoja 3: Informe_Inventario (presentación con KPIs, estado de stock, alertas)
 */
export const exportMovimientosInventarioExcel = async (
    facturas: Factura[],
    notasCredito: NotaCredito[],
    productos: InvProducto[],
    categorias: any[],
    activityLog: any[],
    fileName: string = 'Informe_Movimientos_Inventario'
) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ERP360';
    workbook.created = new Date();

    // Helper para parsear detalles de activity log
    const parseDetails = (details: string): Record<string, string> => {
        if (details.includes(' | ')) {
            const parts = details.split(' | ');
            const data: Record<string, string> = {};
            parts.forEach(part => {
                const [key, ...value] = part.split(': ');
                if (key && value.length > 0) {
                    data[key.trim()] = value.join(': ').trim();
                }
            });
            return data;
        }
        return { Cantidad: '0', CostoU: '0', Ref: 'N/A' };
    };

    // ========== HOJA 1: DATA_Movimientos (Datos Crudos) ==========
    const movimientosSheet = workbook.addWorksheet('DATA_Movimientos');
    
    // Preparar datos crudos de movimientos
    const movimientosData: any[] = [];
    const productMap = new Map<number, InvProducto>();
    productos.forEach(p => productMap.set(p.id, p));

    // Entradas desde Activity Log
    activityLog
        .filter(log => log.action === 'Entrada de Inventario')
        .forEach(log => {
            const details = parseDetails(log.details || '');
            const quantity = parseInt(details['Cantidad'] || '0', 10);
            const cost = parseFloat(details['CostoU'] || '0');
            const producto = productMap.get(log.entity?.id || 0);
            const categoria = categorias.find(c => c.id === producto?.categoriaId);

            movimientosData.push({
                Fecha: formatDate(new Date(log.timestamp)),
                SKU: producto?.referencia || `PROD-${log.entity?.id || 'N/A'}`,
                Producto: log.entity?.name || producto?.nombre || 'Desconocido',
                Categoria: categoria?.nombre || 'Sin categoría',
                Tipo_Movimiento: 'Entrada',
                Cantidad: quantity,
                Costo_Unitario: cost,
                Valor_Total: quantity * cost,
                Referencia: details['Ref'] || log.entity?.id?.toString() || 'N/A',
                Usuario: log.user?.nombre || 'Sistema'
            });
        });

    // Salidas desde Facturación (ventas)
    facturas
        .filter(f => f.estado !== 'ANULADA' && f.estado !== 'BORRADOR')
        .forEach(factura => {
            (factura.items || []).forEach(item => {
                const producto = productMap.get(item.productoId);
                const categoria = categorias.find(c => c.id === producto?.categoriaId);
                const costoUnitario = item.precioUnitario || producto?.ultimoCosto || 0;
                const total = item.total ?? item.cantidad * costoUnitario;

                movimientosData.push({
                    Fecha: formatDate(factura.fechaFactura),
                    SKU: producto?.referencia || `PROD-${item.productoId}`,
                    Producto: producto?.nombre || item.descripcion || `Producto ${item.productoId}`,
                    Categoria: categoria?.nombre || 'Sin categoría',
                    Tipo_Movimiento: 'Salida Venta',
                    Cantidad: -item.cantidad, // Negativo para salidas
                    Costo_Unitario: costoUnitario,
                    Valor_Total: -total,
                    Referencia: factura.numeroFactura || `FAC-${factura.id}`,
                    Usuario: 'Sistema (Factura)'
                });
            });
        });

    // Entradas por Notas de Crédito (devoluciones)
    notasCredito.forEach(nota => {
        (nota.itemsDevueltos || []).forEach(item => {
            const producto = productMap.get(item.productoId);
            const categoria = categorias.find(c => c.id === producto?.categoriaId);
            const costoUnitario = item.precioUnitario || producto?.ultimoCosto || 0;
            const total = item.total ?? item.cantidad * costoUnitario;

            movimientosData.push({
                Fecha: formatDate(nota.fechaEmision || new Date()),
                SKU: producto?.referencia || `PROD-${item.productoId}`,
                Producto: producto?.nombre || item.descripcion || `Producto ${item.productoId}`,
                Categoria: categoria?.nombre || 'Sin categoría',
                Tipo_Movimiento: 'Ajuste+',
                Cantidad: item.cantidad,
                Costo_Unitario: costoUnitario,
                Valor_Total: total,
                Referencia: nota.numero || `NC-${nota.id}`,
                Usuario: 'Sistema (Devolución)'
            });
        });
    });

    // Ordenar por fecha (más reciente primero)
    movimientosData.sort((a, b) => {
        const dateA = new Date(a.Fecha);
        const dateB = new Date(b.Fecha);
        return dateB.getTime() - dateA.getTime();
    });

    // Encabezados de DATA_Movimientos
    const movimientosHeaders = [
        'Fecha', 'SKU', 'Producto', 'Categoria', 'Tipo_Movimiento',
        'Cantidad', 'Costo_Unitario', 'Valor_Total', 'Referencia', 'Usuario'
    ];

    movimientosSheet.addRow(movimientosHeaders);
    const movimientosHeaderRow = movimientosSheet.getRow(1);
    movimientosHeaders.forEach((_, colIndex) => {
        const cell = movimientosHeaderRow.getCell(colIndex + 1);
        applyHeaderStyle(cell);
    });

    // Agregar datos
    movimientosData.forEach(row => {
        const excelRow = movimientosSheet.addRow([
            row.Fecha, row.SKU, row.Producto, row.Categoria, row.Tipo_Movimiento,
            row.Cantidad, row.Costo_Unitario, row.Valor_Total, row.Referencia, row.Usuario
        ]);
        
        excelRow.eachCell((cell, colNumber) => {
            const header = movimientosHeaders[colNumber - 1];
            const isNumber = ['Cantidad'].includes(header);
            const isCurrency = ['Costo_Unitario', 'Valor_Total'].includes(header);
            applyDataStyle(cell, isNumber, isCurrency);
        });
    });

    // Ajustar ancho de columnas
    movimientosSheet.columns.forEach((column, index) => {
        column.width = Math.min(25, Math.max(12, movimientosHeaders[index].length + 2));
    });

    // ========== HOJA 2: DATA_Productos (Tabla Maestra) ==========
    const productosSheet = workbook.addWorksheet('DATA_Productos');
    
    // Preparar datos maestros de productos
    const productosData = productos.map(producto => {
        const categoria = categorias.find(c => c.id === producto.categoriaId);
        return {
            SKU: producto.referencia || `PROD-${producto.id}`,
            Producto: producto.nombre || 'Sin nombre',
            Categoria: categoria?.nombre || 'Sin categoría',
            Stock_Minimo: producto.stockMinimo || 0,
            Costo_Actual: producto.ultimoCosto || 0,
            Stock_Actual: producto.stock || producto.controlaExistencia || 0,
            Unidad_Medida: producto.unidadMedida || 'Unidad'
        };
    });

    // Encabezados de DATA_Productos
    const productosHeaders = [
        'SKU', 'Producto', 'Categoria', 'Stock_Minimo', 'Costo_Actual',
        'Stock_Actual', 'Unidad_Medida', 'Valor_Stock', 'Alerta'
    ];

    productosSheet.addRow(productosHeaders);
    const productosHeaderRow = productosSheet.getRow(1);
    productosHeaders.forEach((_, colIndex) => {
        const cell = productosHeaderRow.getCell(colIndex + 1);
        applyHeaderStyle(cell);
    });

    // Agregar datos con cálculos
    productosData.forEach(producto => {
        const valorStock = (producto.Stock_Actual || 0) * (producto.Costo_Actual || 0);
        const alerta = (producto.Stock_Actual || 0) < (producto.Stock_Minimo || 0) ? 'Reponer' : 'OK';
        
        const excelRow = productosSheet.addRow([
            producto.SKU, producto.Producto, producto.Categoria,
            producto.Stock_Minimo, producto.Costo_Actual, producto.Stock_Actual,
            producto.Unidad_Medida, valorStock, alerta
        ]);
        
        excelRow.eachCell((cell, colNumber) => {
            const header = productosHeaders[colNumber - 1];
            const isNumber = ['Stock_Minimo', 'Stock_Actual'].includes(header);
            const isCurrency = ['Costo_Actual', 'Valor_Stock'].includes(header);
            
            if (header === 'Alerta') {
                if (alerta === 'Reponer') {
                    cell.font = { bold: true, color: { argb: 'FFDC2626' } }; // Rojo
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFEBEE' }
                    };
                } else {
                    cell.font = { color: { argb: 'FF059669' } }; // Verde
                }
                cell.alignment = { horizontal: 'center' };
            }
            
            applyDataStyle(cell, isNumber, isCurrency);
        });
    });

    // Ajustar ancho de columnas
    productosSheet.columns.forEach((column, index) => {
        column.width = Math.min(25, Math.max(12, productosHeaders[index].length + 2));
    });

    // ========== HOJA 3: Informe_Inventario (Presentación) ==========
    const reportSheet = workbook.addWorksheet('Informe_Inventario');
    
    // Título
    const titleRow = reportSheet.addRow(['Informe de Gestión de Inventario']);
    reportSheet.mergeCells('A1:J1');
    const titleCell = reportSheet.getCell('A1');
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1e40af' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 30;

    // Fecha del estado
    reportSheet.addRow([]);
    const dateRow = reportSheet.addRow([
        `Estado al ${formatDate(new Date())}`
    ]);
    reportSheet.mergeCells('A2:J2');
    const dateCell = reportSheet.getCell('A2');
    dateCell.font = { size: 11, italic: true, color: { argb: 'FF64748b' } };
    dateCell.alignment = { horizontal: 'center' };

    reportSheet.addRow([]);

    // Calcular KPIs
    const valorTotalInventario = productosData.reduce((sum, p) => 
        sum + ((p.Stock_Actual || 0) * (p.Costo_Actual || 0)), 0
    );
    const numSKUsTotales = productosData.length;
    const numSKUsBajoReorden = productosData.filter(p => 
        (p.Stock_Actual || 0) < (p.Stock_Minimo || 0)
    ).length;
    
    // Calcular rotación (simplificado: unidades vendidas / promedio de stock)
    const unidadesVendidas = movimientosData
        .filter(m => m.Tipo_Movimiento === 'Salida Venta')
        .reduce((sum, m) => sum + Math.abs(m.Cantidad || 0), 0);
    const promedioStock = productosData.reduce((sum, p) => sum + (p.Stock_Actual || 0), 0) / (productosData.length || 1);
    const rotacionInventario = promedioStock > 0 ? unidadesVendidas / promedioStock : 0;
    
    // Calcular Días de Inventario (DOH) = Stock Actual / (Ventas Diarias Promedio)
    // Ventas diarias promedio = Total ventas en últimos 30 días / 30
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 30);
    const ventasUltimos30Dias = movimientosData
        .filter(m => {
            const fecha = new Date(m.Fecha);
            return fecha >= fechaLimite && m.Tipo_Movimiento === 'Salida Venta';
        })
        .reduce((sum, m) => sum + Math.abs(m.Cantidad || 0), 0);
    const ventasDiariasPromedio = ventasUltimos30Dias / 30;
    const diasInventario = ventasDiariasPromedio > 0 ? promedioStock / ventasDiariasPromedio : 0;

    // Sección de KPIs
    reportSheet.addRow(['KPIs Clave']);
    reportSheet.mergeCells('A4:J4');
    const kpiTitleCell = reportSheet.getCell('A4');
    kpiTitleCell.font = { bold: true, size: 12, color: { argb: 'FF1e293b' } };
    kpiTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
    };
    
    reportSheet.addRow([]);

    // Tarjetas de KPIs
    const kpiData = [
        ['Valor Total del Inventario ($)', valorTotalInventario, true],
        ['N° de SKUs Totales', numSKUsTotales, false],
        ['N° de SKUs Bajo Punto de Reorden', numSKUsBajoReorden, false],
        ['Rotación de Inventario (Promedio)', rotacionInventario.toFixed(2), false],
        ['Días de Inventario (DOH)', diasInventario.toFixed(1), false]
    ];

    kpiData.forEach(([label, value], index) => {
        const row = index + 6;
        const labelCell = reportSheet.getCell(row, 1);
        labelCell.value = label as string;
        labelCell.font = { size: 10, color: { argb: 'FF64748b' } };
        
        const valueCell = reportSheet.getCell(row, 2);
        if (typeof value === 'string' && value.includes('.')) {
            valueCell.value = parseFloat(value);
            valueCell.numFmt = '#,##0.00';
        } else {
            valueCell.value = typeof value === 'string' ? parseInt(value, 10) : (value as number);
            if ((label as string).includes('($)')) {
                valueCell.numFmt = '$#,##0';
            } else {
                valueCell.numFmt = '#,##0';
            }
        }
        applyKPIStyle(valueCell, index === 0);
        
        // Resaltar alertas
        if (label === 'N° de SKUs Bajo Punto de Reorden' && (value as number) > 0) {
            valueCell.font = { bold: true, color: { argb: 'FFDC2626' } };
            valueCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFEBEE' }
            };
        }
    });

    reportSheet.addRow([]);
    reportSheet.addRow([]);

    // Estado de Stock por Categoría
    const estadoStockTitleRow = reportSheet.addRow(['Estado de Stock por Categoría']);
    reportSheet.mergeCells(`A${reportSheet.rowCount}:J${reportSheet.rowCount}`);
    const estadoStockTitleCell = reportSheet.getCell(`A${reportSheet.rowCount}`);
    estadoStockTitleCell.font = { bold: true, size: 12, color: { argb: 'FF1e293b' } };
    estadoStockTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
    };

    reportSheet.addRow([]);

    // Agrupar por categoría
    const categoriaStockMap = new Map<string, {
        categoria: string;
        stockInicial: number;
        entradas: number;
        salidas: number;
        ajustes: number;
        stockFinal: number;
        valorStock: number;
        productos: any[];
    }>();

    productosData.forEach(producto => {
        if (!categoriaStockMap.has(producto.Categoria)) {
            categoriaStockMap.set(producto.Categoria, {
                categoria: producto.Categoria,
                stockInicial: 0,
                entradas: 0,
                salidas: 0,
                ajustes: 0,
                stockFinal: 0,
                valorStock: 0,
                productos: []
            });
        }

        const categoriaData = categoriaStockMap.get(producto.Categoria)!;
        categoriaData.stockFinal += producto.Stock_Actual || 0;
        categoriaData.valorStock += (producto.Stock_Actual || 0) * (producto.Costo_Actual || 0);
        categoriaData.productos.push(producto);
    });

    // Calcular movimientos por categoría
    movimientosData.forEach(movimiento => {
        const categoria = movimiento.Categoria || 'Sin categoría';
        if (!categoriaStockMap.has(categoria)) {
            categoriaStockMap.set(categoria, {
                categoria,
                stockInicial: 0,
                entradas: 0,
                salidas: 0,
                ajustes: 0,
                stockFinal: 0,
                valorStock: 0,
                productos: []
            });
        }

        const categoriaData = categoriaStockMap.get(categoria)!;
        if (movimiento.Tipo_Movimiento === 'Entrada') {
            categoriaData.entradas += movimiento.Cantidad || 0;
        } else if (movimiento.Tipo_Movimiento === 'Salida Venta') {
            categoriaData.salidas += Math.abs(movimiento.Cantidad || 0);
        } else if (movimiento.Tipo_Movimiento === 'Ajuste+') {
            categoriaData.ajustes += movimiento.Cantidad || 0;
        }
    });

    // Encabezados de estado de stock
    const estadoStockHeaders = [
        'Categoria', 'Stock Inicial', 'Entradas', 'Salidas', 'Ajustes',
        'Stock Final', 'Valor Stock ($)', 'Productos', 'Alertas'
    ];
    reportSheet.addRow(estadoStockHeaders);
    const estadoStockHeaderRow = reportSheet.getRow(reportSheet.rowCount);
    estadoStockHeaders.forEach((_, colIndex) => {
        const cell = estadoStockHeaderRow.getCell(colIndex + 1);
        applyHeaderStyle(cell);
    });

    // Agregar datos por categoría
    Array.from(categoriaStockMap.entries())
        .sort((a, b) => b[1].valorStock - a[1].valorStock)
        .forEach(([categoria, data]) => {
            const productosBajoMinimo = data.productos.filter(p => 
                (p.Stock_Actual || 0) < (p.Stock_Minimo || 0)
            ).length;

            const estadoStockRow = reportSheet.addRow([
                data.categoria,
                data.stockInicial,
                data.entradas,
                data.salidas,
                data.ajustes,
                data.stockFinal,
                data.valorStock,
                data.productos.length,
                productosBajoMinimo > 0 ? `${productosBajoMinimo} productos bajo mínimo` : 'OK'
            ]);

            estadoStockRow.eachCell((cell, colNumber) => {
                if (colNumber === 1) {
                    cell.font = { bold: true };
                } else if (colNumber === 9) {
                    // Columna de alertas
                    if (productosBajoMinimo > 0) {
                        cell.font = { bold: true, color: { argb: 'FFDC2626' } };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFEBEE' }
                        };
                    } else {
                        cell.font = { color: { argb: 'FF059669' } };
                    }
                    cell.alignment = { horizontal: 'center' };
                } else {
                    const header = estadoStockHeaders[colNumber - 1];
                    const isCurrency = header.includes('($)');
                    const isNumber = !isCurrency && header !== 'Categoria' && header !== 'Productos' && header !== 'Alertas';
                    if (isCurrency) {
                        cell.numFmt = '$#,##0';
                    } else if (isNumber) {
                        cell.numFmt = '#,##0';
                    }
                    applyDataStyle(cell, isNumber, isCurrency);
                }
            });
        });

    // Top 10 Slow Movers (mayor días de inventario)
    reportSheet.addRow([]);
    reportSheet.addRow([]);
    const slowMoversTitleRow = reportSheet.addRow(['Top 10 Productos con Mayor Días de Inventario (Slow Movers)']);
    reportSheet.mergeCells(`A${reportSheet.rowCount}:E${reportSheet.rowCount}`);
    const slowMoversTitleCell = reportSheet.getCell(`A${reportSheet.rowCount}`);
    slowMoversTitleCell.font = { bold: true, size: 12, color: { argb: 'FF92400e' } };
    slowMoversTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFBEB' }
    };

    reportSheet.addRow([]);

    const slowMoversHeaders = ['#', 'Producto', 'Stock Actual', 'Días de Inventario', 'Valor Stock ($)'];
    reportSheet.addRow(slowMoversHeaders);
    const slowMoversHeaderRow = reportSheet.getRow(reportSheet.rowCount);
    slowMoversHeaders.forEach((_, colIndex) => {
        const cell = slowMoversHeaderRow.getCell(colIndex + 1);
        applyHeaderStyle(cell);
    });

    // Calcular días de inventario por producto
    const productosConDias = productosData.map(producto => {
        const ventasProducto = movimientosData
            .filter(m => {
                const fecha = new Date(m.Fecha);
                return fecha >= fechaLimite && 
                       m.Tipo_Movimiento === 'Salida Venta' &&
                       m.SKU === producto.SKU;
            })
            .reduce((sum, m) => sum + Math.abs(m.Cantidad || 0), 0);
        const ventasDiariasProducto = ventasProducto / 30;
        const diasProducto = ventasDiariasProducto > 0 
            ? (producto.Stock_Actual || 0) / ventasDiariasProducto 
            : (producto.Stock_Actual || 0) > 0 ? 999 : 0; // Si no hay ventas, mostrar 999

        return {
            ...producto,
            diasInventario: diasProducto,
            valorStock: (producto.Stock_Actual || 0) * (producto.Costo_Actual || 0)
        };
    })
    .filter(p => p.Stock_Actual > 0)
    .sort((a, b) => b.diasInventario - a.diasInventario)
    .slice(0, 10);

    productosConDias.forEach((producto, index) => {
        const slowMoversRow = reportSheet.addRow([
            index + 1,
            producto.Producto,
            producto.Stock_Actual,
            producto.diasInventario.toFixed(1),
            producto.valorStock
        ]);

        slowMoversRow.eachCell((cell, colNumber) => {
            if (colNumber === 1) {
                cell.font = { bold: true };
                cell.alignment = { horizontal: 'center' };
            } else if (colNumber === 2) {
                cell.font = { bold: true };
            } else {
                const header = slowMoversHeaders[colNumber - 1];
                const isCurrency = header.includes('($)');
                const isNumber = !isCurrency && header !== '#';
                if (isCurrency) {
                    cell.numFmt = '$#,##0';
                } else if (isNumber) {
                    cell.numFmt = '#,##0.00';
                }
                applyDataStyle(cell, isNumber, isCurrency);
            }
        });
    });

    // Top 10 Fast Movers (menor días de inventario)
    reportSheet.addRow([]);
    reportSheet.addRow([]);
    const fastMoversTitleRow = reportSheet.addRow(['Top 10 Productos con Menor Días de Inventario (Fast Movers)']);
    reportSheet.mergeCells(`A${reportSheet.rowCount}:E${reportSheet.rowCount}`);
    const fastMoversTitleCell = reportSheet.getCell(`A${reportSheet.rowCount}`);
    fastMoversTitleCell.font = { bold: true, size: 12, color: { argb: 'FF059669' } };
    fastMoversTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0FDF4' }
    };

    reportSheet.addRow([]);

    const fastMoversHeaders = ['#', 'Producto', 'Stock Actual', 'Días de Inventario', 'Valor Stock ($)'];
    reportSheet.addRow(fastMoversHeaders);
    const fastMoversHeaderRow = reportSheet.getRow(reportSheet.rowCount);
    fastMoversHeaders.forEach((_, colIndex) => {
        const cell = fastMoversHeaderRow.getCell(colIndex + 1);
        applyHeaderStyle(cell);
    });

    const productosFastMovers = productosData.map(producto => {
        const ventasProducto = movimientosData
            .filter(m => {
                const fecha = new Date(m.Fecha);
                return fecha >= fechaLimite && 
                       m.Tipo_Movimiento === 'Salida Venta' &&
                       m.SKU === producto.SKU;
            })
            .reduce((sum, m) => sum + Math.abs(m.Cantidad || 0), 0);
        const ventasDiariasProducto = ventasProducto / 30;
        const diasProducto = ventasDiariasProducto > 0 
            ? (producto.Stock_Actual || 0) / ventasDiariasProducto 
            : 0;

        return {
            ...producto,
            diasInventario: diasProducto,
            valorStock: (producto.Stock_Actual || 0) * (producto.Costo_Actual || 0)
        };
    })
    .filter(p => p.diasInventario > 0 && p.Stock_Actual > 0)
    .sort((a, b) => a.diasInventario - b.diasInventario)
    .slice(0, 10);

    productosFastMovers.forEach((producto, index) => {
        const fastMoversRow = reportSheet.addRow([
            index + 1,
            producto.Producto,
            producto.Stock_Actual,
            producto.diasInventario.toFixed(1),
            producto.valorStock
        ]);

        fastMoversRow.eachCell((cell, colNumber) => {
            if (colNumber === 1) {
                cell.font = { bold: true };
                cell.alignment = { horizontal: 'center' };
            } else if (colNumber === 2) {
                cell.font = { bold: true };
            } else {
                const header = fastMoversHeaders[colNumber - 1];
                const isCurrency = header.includes('($)');
                const isNumber = !isCurrency && header !== '#';
                if (isCurrency) {
                    cell.numFmt = '$#,##0';
                } else if (isNumber) {
                    cell.numFmt = '#,##0.00';
                }
                applyDataStyle(cell, isNumber, isCurrency);
            }
        });
    });

    // Instrucciones para Formato Condicional y Tablas Dinámicas
    reportSheet.addRow([]);
    reportSheet.addRow([]);
    const instructionsRow = reportSheet.addRow(['📊 INSTRUCCIONES PARA FORMATO CONDICIONAL Y TABLAS DINÁMICAS']);
    reportSheet.mergeCells(`A${reportSheet.rowCount}:J${reportSheet.rowCount}`);
    const instructionsCell = reportSheet.getCell(`A${reportSheet.rowCount}`);
    instructionsCell.font = { bold: true, size: 11, color: { argb: 'FF1e40af' } };
    instructionsCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
    };

    reportSheet.addRow([
        '1. Formato Condicional en DATA_Productos:',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '   - Selecciona la columna "Alerta" > Inicio > Formato Condicional > Reglas de celdas',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '   - Si el valor es "Reponer", aplica color de fondo rojo claro',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '   - Selecciona la columna "Stock_Actual" > Inicio > Formato Condicional > Escalas de color',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '   - Para colorear según valores bajos (rojo) y altos (verde)',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '2. Crear Tabla Dinámica de Estado de Stock:',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '   - Selecciona DATA_Movimientos > Insertar > Tabla Dinámica',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '   - Arrastra "Categoria" a FILAS',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '   - Arrastra "Cantidad" a VALORES > Suma (para Stock Final)',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);
    reportSheet.addRow([
        '   - Agrega filtro por "Tipo_Movimiento" para segmentar',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);

    // Ajustar anchos de columnas
    reportSheet.columns.forEach(column => {
        column.width = 18;
    });
    reportSheet.getColumn(1).width = 25; // Columna Categoría/Producto más ancha

    // Descargar archivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
