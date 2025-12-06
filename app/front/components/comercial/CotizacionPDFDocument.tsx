import React from 'react';
import { Page, Text, View, Document } from '@react-pdf/renderer';
import { Cotizacion, Cliente, Vendedor, DocumentPreferences } from '../../types';
import { pdfStyles, formatCurrency } from '../pdf/pdfTheme';

interface Props {
    cotizacion: Cotizacion;
    cliente: Cliente;
    vendedor: Vendedor;
    empresa: any;
    preferences: DocumentPreferences;
    productos: any[];
}

const CotizacionPDFDocument: React.FC<Props> = ({ cotizacion, cliente, vendedor, empresa, preferences, productos }) => {

    const totalDescuentos = cotizacion.items.reduce((acc, item) => {
        const itemTotal = (item.precioUnitario || 0) * (item.cantidad || 0);
        return acc + (itemTotal * ((item.descuentoPorcentaje || 0) / 100));
    }, 0);

    return (
        <Document>
            <Page size="A4" style={pdfStyles.page}>
                {/* Header */}
                <View style={pdfStyles.header}>
                    <View style={pdfStyles.logoSection}>
                        <View style={pdfStyles.logoPlaceholder} />
                        <View style={pdfStyles.companyInfo}>
                            <Text style={pdfStyles.companyName}>{empresa.nombre}</Text>
                            <Text style={pdfStyles.companyDetails}>NIT: {empresa.nit}</Text>
                            <Text style={pdfStyles.companyDetails}>{empresa.direccion}</Text>
                            <Text style={pdfStyles.companyDetails}>{empresa.telefono}</Text>
                        </View>
                    </View>
                    <View style={pdfStyles.documentTitleSection}>
                        <View style={[pdfStyles.documentBadge, { backgroundColor: '#f0f9ff', borderColor: '#e0f2fe' }]}>
                            <Text style={[pdfStyles.documentTitle, { color: '#0369a1' }]}>COTIZACIÓN</Text>
                        </View>
                        <Text style={pdfStyles.documentNumber}>{cotizacion.numeroCotizacion}</Text>
                    </View>
                </View>

                {/* Info Grid */}
                <View style={pdfStyles.infoGrid}>
                    <View style={pdfStyles.infoCard}>
                        <Text style={[pdfStyles.cardLabel, { backgroundColor: '#0ea5e9' }]}>CLIENTE</Text>
                        <View style={pdfStyles.cardContent}>
                            <Text style={pdfStyles.clientName}>{cliente.nombreCompleto}</Text>
                            <Text style={pdfStyles.companyDetails}>{cliente.tipoDocumentoId} {cliente.numeroDocumento}</Text>
                            <Text style={pdfStyles.companyDetails}>{cliente.direccion}, {cliente.ciudadId}</Text>
                            <Text style={pdfStyles.companyDetails}>{cliente.email} | {cliente.telefono}</Text>
                        </View>
                    </View>
                    <View style={pdfStyles.infoCard}>
                        <Text style={[pdfStyles.cardLabel, pdfStyles.cardLabelSecondary]}>CONDICIONES</Text>
                        <View style={pdfStyles.cardContent}>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Fecha:</Text>
                                <Text style={pdfStyles.infoValue}>{new Date(cotizacion.fechaCotizacion).toLocaleDateString('es-CO')}</Text>
                            </View>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Vence:</Text>
                                <Text style={pdfStyles.infoValue}>{new Date(cotizacion.fechaVencimiento).toLocaleDateString('es-CO')}</Text>
                            </View>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Vendedor:</Text>
                                <Text style={pdfStyles.infoValue}>{vendedor.primerNombre} {vendedor.primerApellido}</Text>
                            </View>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Cond. Pago:</Text>
                                <Text style={pdfStyles.infoValue}>{cliente.condicionPago || 'Contado'}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Table */}
                <View style={pdfStyles.tableContainer}>
                    <View style={pdfStyles.tableHeader}>
                        <Text style={[pdfStyles.tableHeaderText, pdfStyles.colCode]}>REFERENCIA</Text>
                        <Text style={[pdfStyles.tableHeaderText, pdfStyles.colDesc]}>DESCRIPCIÓN</Text>
                        <Text style={[pdfStyles.tableHeaderText, { width: '10%', paddingHorizontal: 4, textAlign: 'center' }]}>UNIDAD</Text>
                        <Text style={[pdfStyles.tableHeaderText, pdfStyles.colQty]}>CANT.</Text>
                        {preferences.showPrices ? (
                            <>
                                <Text style={[pdfStyles.tableHeaderText, pdfStyles.colPrice]}>P. UNIT</Text>
                                <Text style={[pdfStyles.tableHeaderText, { width: '10%', paddingHorizontal: 4, textAlign: 'right', color: '#334155' }]}>% DCTO</Text>
                                <Text style={[pdfStyles.tableHeaderText, pdfStyles.colTotal]}>SUBTOTAL</Text>
                            </>
                        ) : null}
                    </View>
                    {cotizacion.items.map((item, idx) => {
                        const product = productos.find(p => p.id === item.productoId);
                        const referencia = (item as any).referencia || product?.referencia || 'N/A';
                        const unidad = (item as any).unidadMedida || (item as any).codigoMedida || product?.unidadMedida || 'N/A';

                        return (
                            <View key={idx} style={[pdfStyles.tableRow, { backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }]}>
                                <Text style={[pdfStyles.tableCellText, pdfStyles.colCode]}>{referencia}</Text>
                                <Text style={[pdfStyles.tableCellText, pdfStyles.colDesc]}>{item.descripcion}</Text>
                                <Text style={[pdfStyles.tableCellText, { width: '10%', paddingHorizontal: 4, textAlign: 'center', fontSize: 9, color: '#334155' }]}>{unidad}</Text>
                                <Text style={[pdfStyles.tableCellText, pdfStyles.colQty]}>{item.cantidad}</Text>
                                {preferences.showPrices ? (
                                    <>
                                        <Text style={[pdfStyles.tableCellText, pdfStyles.colPrice]}>{formatCurrency(item.precioUnitario)}</Text>
                                        <Text style={[pdfStyles.tableCellText, { width: '10%', paddingHorizontal: 4, textAlign: 'right', fontSize: 9, color: '#ef4444' }]}>{(item.descuentoPorcentaje || 0).toFixed(2)}%</Text>
                                        <Text style={[pdfStyles.tableCellText, pdfStyles.colTotal]}>{formatCurrency(item.subtotal)}</Text>
                                    </>
                                ) : null}
                            </View>
                        );
                    })}
                </View>

                {/* Observaciones */}
                <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', marginBottom: 4 }}>OBSERVACIONES</Text>
                    <View style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <Text style={{ fontSize: 9, color: '#334155' }}>Costos de transporte no incluidos. La instalación se cotiza por separado.</Text>
                    </View>
                </View>

                {/* Totals */}
                {preferences.showPrices && (
                    <View style={pdfStyles.totalsSection}>
                        <View style={pdfStyles.totalsCard}>
                            <View style={pdfStyles.totalRow}>
                                <Text style={pdfStyles.totalLabel}>Subtotal Bruto</Text>
                                <Text style={pdfStyles.totalValue}>{formatCurrency(cotizacion.subtotal + totalDescuentos)}</Text>
                            </View>
                            <View style={pdfStyles.totalRow}>
                                <Text style={[pdfStyles.totalLabel, pdfStyles.textRed]}>Descuentos</Text>
                                <Text style={[pdfStyles.totalValue, pdfStyles.textRed]}>-{formatCurrency(totalDescuentos)}</Text>
                            </View>
                            <View style={[pdfStyles.totalRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#e2e8f0' }]}>
                                <Text style={pdfStyles.totalLabel}>Subtotal Neto</Text>
                                <Text style={pdfStyles.totalValue}>{formatCurrency(cotizacion.subtotal)}</Text>
                            </View>
                            <View style={pdfStyles.totalRow}>
                                <Text style={pdfStyles.totalLabel}>IVA</Text>
                                <Text style={pdfStyles.totalValue}>{formatCurrency(cotizacion.ivaValor)}</Text>
                            </View>
                            {cotizacion.domicilios && cotizacion.domicilios > 0 && (
                                <View style={pdfStyles.totalRow}>
                                    <Text style={pdfStyles.totalLabel}>Domicilios</Text>
                                    <Text style={pdfStyles.totalValue}>{formatCurrency(cotizacion.domicilios)}</Text>
                                </View>
                            )}
                            <View style={[pdfStyles.finalTotalRow, { backgroundColor: '#0ea5e9' }]}>
                                <Text style={pdfStyles.finalTotalLabel}>TOTAL</Text>
                                <Text style={pdfStyles.finalTotalValue}>{formatCurrency(cotizacion.total)}</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Terms and Signature */}
                {preferences.signatureType !== 'none' && (
                    <View style={{ marginTop: 'auto', paddingTop: 20 }}>
                        {preferences.detailLevel === 'full' && (
                            <View style={{ marginBottom: 20 }}>
                                <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#64748b', marginBottom: 2, textTransform: 'uppercase' }}>Términos y Condiciones</Text>
                                <Text style={{ fontSize: 8, color: '#334155' }}>1. Precios sujetos a cambio sin previo aviso. Validez de la oferta hasta la fecha indicada.</Text>
                                <Text style={{ fontSize: 8, color: '#334155' }}>2. Garantía de 12 meses sobre defectos de fabricación. No cubre mal uso.</Text>
                            </View>
                        )}

                        {preferences.signatureType === 'physical' ? (
                            <View style={[pdfStyles.footer, { borderTopWidth: 0 }]}>
                                <View style={pdfStyles.signatureBox}>
                                    <View style={pdfStyles.signatureLine} />
                                    <Text style={pdfStyles.footerText}>{vendedor.primerNombre} {vendedor.primerApellido}</Text>
                                    <Text style={pdfStyles.footerSubText}>Asesor Comercial, {empresa.nombre}</Text>
                                </View>
                                <View style={pdfStyles.signatureBox}>
                                    <View style={pdfStyles.signatureLine} />
                                    <Text style={pdfStyles.footerText}>Aprobado por Cliente</Text>
                                    <Text style={pdfStyles.footerSubText}>(Firma, Nombre y Sello)</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={{ alignItems: 'center', paddingTop: 10 }}>
                                <Text style={{ fontSize: 10, color: '#64748b' }}>Documento Aprobado Digitalmente</Text>
                            </View>
                        )}
                    </View>
                )}
            </Page>
        </Document>
    );
};

export default CotizacionPDFDocument;
