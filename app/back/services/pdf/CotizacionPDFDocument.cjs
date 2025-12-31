const React = require('react');
const { Page, Text, View, Document, Image } = require('@react-pdf/renderer');
const { pdfStyles, formatCurrency } = require('./pdfTheme.cjs');

const CotizacionPDFDocument = ({
    cotizacion,
    cliente,
    vendedor,
    empresa
}) => {
    // Calcular descuento total
    const totalDescuentos = (cotizacion.items || []).reduce((acc, item) => {
        const itemTotal = (item.precioUnitario || 0) * (item.cantidad || 0);
        return acc + (itemTotal * ((item.descuentoPorcentaje || 0) / 100));
    }, 0);

    // Formatear el número de cotización (quitar C- si existe)
    const displayNum = (cotizacion.numeroCotizacion || '').replace('C-', '');

    // Convertir JSX a React.createElement para compatibilidad con Node.js puro (.cjs)
    return React.createElement(Document, {},
        React.createElement(Page, { size: "A4", style: pdfStyles.page },
            // Header
            React.createElement(View, { style: pdfStyles.header },
                React.createElement(View, { style: pdfStyles.logoSection },
                    empresa.logoExt 
                        ? React.createElement(Image, { src: empresa.logoExt, style: pdfStyles.logo })
                        : React.createElement(View, { style: { width: 60, height: 60, backgroundColor: '#f1f5f9', marginRight: 10, borderRadius: 4 } }),
                    React.createElement(View, { style: pdfStyles.companyInfo },
                        React.createElement(Text, { style: pdfStyles.companyName }, empresa.nombre || empresa.razonSocial),
                        React.createElement(Text, { style: pdfStyles.companyDetails }, `NIT: ${empresa.nit}`),
                        React.createElement(Text, { style: pdfStyles.companyDetails }, `Tel: ${empresa.telefono}`),
                        React.createElement(Text, { style: pdfStyles.companyDetails }, `Email: ${empresa.email}`),
                        React.createElement(Text, { style: pdfStyles.companyDetails }, empresa.direccion)
                    )
                ),
                React.createElement(View, { style: pdfStyles.documentTitleSection },
                    React.createElement(View, { style: [pdfStyles.documentBadge, { backgroundColor: '#f0f9ff', borderColor: '#e0f2fe' }] },
                        React.createElement(Text, { style: [pdfStyles.documentTitle, { color: '#0369a1' }] }, "COTIZACIÓN")
                    ),
                    React.createElement(Text, { style: pdfStyles.documentNumber }, `#${displayNum}`)
                )
            ),

            // Info Grid
            React.createElement(View, { style: pdfStyles.infoGrid },
                React.createElement(View, { style: pdfStyles.infoCard },
                    React.createElement(Text, { style: [pdfStyles.cardLabel, { backgroundColor: '#0ea5e9' }] }, "CLIENTE"),
                    React.createElement(View, { style: pdfStyles.cardContent },
                        React.createElement(Text, { style: pdfStyles.clientName }, cliente.nombreCompleto || cliente.razonSocial),
                        React.createElement(View, { style: { flexDirection: 'row', marginTop: 3, marginBottom: 1.5 } },
                            React.createElement(Text, { style: { fontSize: 9, fontWeight: 'bold', color: '#64748b', width: 55 } }, "NIT/CC:"),
                            React.createElement(Text, { style: { fontSize: 9, color: '#334155', flex: 1 } }, `${cliente.tipoDocumentoId || ''} ${cliente.numeroDocumento || cliente.id}`)
                        ),
                        React.createElement(View, { style: { flexDirection: 'row', marginBottom: 1.5 } },
                            React.createElement(Text, { style: { fontSize: 9, fontWeight: 'bold', color: '#64748b', width: 55 } }, "Dirección:"),
                            React.createElement(Text, { style: { fontSize: 9, color: '#334155', flex: 1 } }, cliente.direccion || 'N/A')
                        ),
                        React.createElement(View, { style: { flexDirection: 'row', marginBottom: 1.5 } },
                            React.createElement(Text, { style: { fontSize: 9, fontWeight: 'bold', color: '#64748b', width: 55 } }, "Ciudad:"),
                            React.createElement(Text, { style: { fontSize: 9, color: '#334155', flex: 1 } }, cliente.ciudadId || cliente.ciudad || 'N/A')
                        )
                    )
                ),
                React.createElement(View, { style: pdfStyles.infoCard },
                    React.createElement(Text, { style: [pdfStyles.cardLabel, { backgroundColor: '#475569' }] }, "CONDICIONES"),
                    React.createElement(View, { style: pdfStyles.cardContent },
                        React.createElement(View, { style: pdfStyles.infoRow },
                            React.createElement(Text, { style: pdfStyles.infoLabel }, "Fecha:"),
                            React.createElement(Text, { style: pdfStyles.infoValue }, new Date(cotizacion.fechaCotizacion).toLocaleDateString('es-CO'))
                        ),
                        React.createElement(View, { style: pdfStyles.infoRow },
                            React.createElement(Text, { style: pdfStyles.infoLabel }, "Vence:"),
                            React.createElement(Text, { style: pdfStyles.infoValue }, new Date(cotizacion.fechaVencimiento).toLocaleDateString('es-CO'))
                        ),
                        React.createElement(View, { style: pdfStyles.infoRow },
                            React.createElement(Text, { style: pdfStyles.infoLabel }, "Vendedor:"),
                            React.createElement(Text, { style: pdfStyles.infoValue }, vendedor.nombreCompleto || vendedor.nombre || 'N/A')
                        ),
                        React.createElement(View, { style: pdfStyles.infoRow },
                            React.createElement(Text, { style: pdfStyles.infoLabel }, "Cond. Pago:"),
                            React.createElement(Text, { style: pdfStyles.infoValue }, (cotizacion.formaPago === '1' || cotizacion.formaPago === '01') ? 'Contado' : 'Crédito')
                        )
                    )
                )
            ),

            // Table
            React.createElement(View, { style: pdfStyles.tableContainer },
                React.createElement(View, { style: pdfStyles.tableHeader },
                    React.createElement(Text, { style: [pdfStyles.tableHeaderText, pdfStyles.colCode] }, "ID / Ref"),
                    React.createElement(Text, { style: [pdfStyles.tableHeaderText, pdfStyles.colDesc] }, "Descripción"),
                    React.createElement(Text, { style: [pdfStyles.tableHeaderText, { width: '10%', textAlign: 'center' }] }, "Und"),
                    React.createElement(Text, { style: [pdfStyles.tableHeaderText, pdfStyles.colQty] }, "Cant."),
                    React.createElement(Text, { style: [pdfStyles.tableHeaderText, pdfStyles.colPrice] }, "Precio Unit."),
                    React.createElement(Text, { style: [pdfStyles.tableHeaderText, { width: '10%', textAlign: 'right' }] }, "Dcto."),
                    React.createElement(Text, { style: [pdfStyles.tableHeaderText, pdfStyles.colTotal] }, "Total")
                ),
                (cotizacion.items || []).map((item, idx) => 
                    React.createElement(View, { key: idx, style: [pdfStyles.tableRow, { backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }] },
                        React.createElement(Text, { style: [pdfStyles.tableCellText, pdfStyles.colCode] }, item.codProducto || item.productoId || 'N/A'),
                        React.createElement(Text, { style: [pdfStyles.tableCellText, pdfStyles.colDesc] }, item.descripcion),
                        React.createElement(Text, { style: [pdfStyles.tableCellText, { width: '10%', textAlign: 'center' }] }, item.unidadMedida || 'UND'),
                        React.createElement(Text, { style: [pdfStyles.tableCellText, pdfStyles.colQty] }, item.cantidad),
                        React.createElement(Text, { style: [pdfStyles.tableCellText, pdfStyles.colPrice] }, formatCurrency(item.precioUnitario)),
                        React.createElement(Text, { style: [pdfStyles.tableCellText, { width: '10%', textAlign: 'right', color: '#ef4444' }] }, `${(item.descuentoPorcentaje || 0).toFixed(0)}%`),
                        React.createElement(Text, { style: [pdfStyles.tableCellText, pdfStyles.colTotal] }, formatCurrency(item.total))
                    )
                )
            ),

            // Totals Section
            React.createElement(View, { style: pdfStyles.totalsSection },
                React.createElement(View, { style: pdfStyles.totalsCard },
                    React.createElement(View, { style: pdfStyles.totalRow },
                        React.createElement(Text, { style: pdfStyles.totalLabel }, "Subtotal Bruto"),
                        React.createElement(Text, { style: pdfStyles.totalValue }, formatCurrency(cotizacion.subtotal + totalDescuentos))
                    ),
                    React.createElement(View, { style: pdfStyles.totalRow },
                        React.createElement(Text, { style: [pdfStyles.totalLabel, { color: '#ef4444' }] }, "Descuentos"),
                        React.createElement(Text, { style: [pdfStyles.totalValue, { color: '#ef4444' }] }, `-${formatCurrency(totalDescuentos)}`)
                    ),
                    React.createElement(View, { style: [pdfStyles.totalRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#e2e8f0' }] },
                        React.createElement(Text, { style: pdfStyles.totalLabel }, "Subtotal Neto"),
                        React.createElement(Text, { style: pdfStyles.totalValue }, formatCurrency(cotizacion.subtotal))
                    ),
                    React.createElement(View, { style: pdfStyles.totalRow },
                        React.createElement(Text, { style: pdfStyles.totalLabel }, "IVA (19%)"),
                        React.createElement(Text, { style: pdfStyles.totalValue }, formatCurrency(cotizacion.ivaValor))
                    ),
                    React.createElement(View, { style: [pdfStyles.finalTotalRow, { backgroundColor: '#0ea5e9' }] },
                        React.createElement(Text, { style: pdfStyles.finalTotalLabel }, "TOTAL"),
                        React.createElement(Text, { style: pdfStyles.finalTotalValue }, formatCurrency(cotizacion.total))
                    )
                )
            ),

            // Observations
            React.createElement(View, { style: { marginBottom: 20 } },
                React.createElement(Text, { style: { fontSize: 9, fontWeight: 'bold', color: '#64748b', marginBottom: 4 } }, "OBSERVACIONES"),
                React.createElement(View, { style: { padding: 8, backgroundColor: '#f8fafc', borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' } },
                    React.createElement(Text, { style: { fontSize: 8, color: '#334155' } }, cotizacion.observaciones || 'Condiciones comerciales estándar aplicables. Precios sujetos a cambio sin previo aviso.')
                )
            ),

            // Signatures
            React.createElement(View, { style: [pdfStyles.footer, { marginTop: 'auto' }] },
                React.createElement(View, { style: pdfStyles.signatureBox },
                    React.createElement(View, { style: pdfStyles.signatureLine }),
                    React.createElement(Text, { style: pdfStyles.footerText }, vendedor.nombreCompleto || vendedor.nombre || 'Asesor Comercial'),
                    React.createElement(Text, { style: pdfStyles.footerSubText }, empresa.nombre)
                ),
                React.createElement(View, { style: pdfStyles.signatureBox },
                    React.createElement(View, { style: pdfStyles.signatureLine }),
                    React.createElement(Text, { style: pdfStyles.footerText }, "Aprobado por Cliente"),
                    React.createElement(Text, { style: pdfStyles.footerSubText }, "(Firma, Nombre y Sello)")
                )
            ),

            React.createElement(View, { style: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' } },
                React.createElement(Text, { style: { fontSize: 7, color: '#94a3b8', textAlign: 'center' } }, "Documento generado automáticamente por ERP 360")
            )
        )
    );
};

module.exports = CotizacionPDFDocument;
