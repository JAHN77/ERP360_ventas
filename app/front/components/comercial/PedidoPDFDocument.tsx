import React from 'react';
import { Page, Text, View, Document } from '@react-pdf/renderer';
import { Pedido, Cliente, DocumentPreferences, Cotizacion } from '../../types';
import { pdfStyles, formatCurrency } from '../pdf/pdfTheme';

interface Props {
    pedido: Pedido;
    cliente: Cliente;
    empresa: any;
    preferences: DocumentPreferences;
    productos: any[];
    cotizacionOrigen?: Cotizacion | undefined;
}

const PedidoPDFDocument: React.FC<Props> = ({ pedido, cliente, empresa, preferences, productos, cotizacionOrigen }) => {

    const totalDescuentos = pedido.items.reduce((acc, item) => {
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
                            <Text style={[pdfStyles.documentTitle, { color: '#0369a1' }]}>ORDEN DE COMPRA</Text>
                        </View>
                        <Text style={pdfStyles.documentNumber}>{pedido.numeroPedido}</Text>
                    </View>
                </View>

                {/* Info Grid */}
                <View style={pdfStyles.infoGrid}>
                    <View style={pdfStyles.infoCard}>
                        <Text style={[pdfStyles.cardLabel, { backgroundColor: '#0ea5e9' }]}>DIRECCIÓN DE ENTREGA</Text>
                        <View style={pdfStyles.cardContent}>
                            <Text style={pdfStyles.clientName}>{cliente.nombreCompleto}</Text>
                            <Text style={pdfStyles.companyDetails}>{cliente.direccion}, {cliente.ciudadId}</Text>
                            <Text style={pdfStyles.companyDetails}>{cliente.telefono}</Text>
                        </View>
                    </View>
                    <View style={pdfStyles.infoCard}>
                        <Text style={[pdfStyles.cardLabel, pdfStyles.cardLabelSecondary]}>CONDICIONES DEL PEDIDO</Text>
                        <View style={pdfStyles.cardContent}>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Fecha:</Text>
                                <Text style={pdfStyles.infoValue}>{new Date(pedido.fechaPedido).toLocaleDateString('es-CO')}</Text>
                            </View>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Cotización Ref:</Text>
                                <Text style={pdfStyles.infoValue}>{cotizacionOrigen?.numeroCotizacion || 'Venta Directa'}</Text>
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
                                <Text style={[pdfStyles.tableHeaderText, pdfStyles.colPrice]}>PRECIO</Text>
                                <Text style={[pdfStyles.tableHeaderText, pdfStyles.colTotal]}>SUBTOTAL</Text>
                            </>
                        ) : null}
                    </View>
                    {pedido.items.map((item, idx) => {
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
                        <Text style={{ fontSize: 9, color: '#334155' }}>{pedido.observaciones || 'Sujeto a términos y condiciones estándar.'}</Text>
                    </View>
                </View>

                {/* Totals */}
                {preferences.showPrices && (
                    <View style={pdfStyles.totalsSection}>
                        <View style={pdfStyles.totalsCard}>
                            <View style={pdfStyles.totalRow}>
                                <Text style={pdfStyles.totalLabel}>Subtotal Bruto</Text>
                                <Text style={pdfStyles.totalValue}>{formatCurrency(pedido.subtotal + totalDescuentos)}</Text>
                            </View>
                            <View style={pdfStyles.totalRow}>
                                <Text style={[pdfStyles.totalLabel, pdfStyles.textRed]}>Descuentos</Text>
                                <Text style={[pdfStyles.totalValue, pdfStyles.textRed]}>-{formatCurrency(totalDescuentos)}</Text>
                            </View>
                            <View style={[pdfStyles.totalRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#e2e8f0' }]}>
                                <Text style={pdfStyles.totalLabel}>Subtotal Neto</Text>
                                <Text style={pdfStyles.totalValue}>{formatCurrency(pedido.subtotal)}</Text>
                            </View>
                            <View style={pdfStyles.totalRow}>
                                <Text style={pdfStyles.totalLabel}>IVA</Text>
                                <Text style={pdfStyles.totalValue}>{formatCurrency(pedido.ivaValor)}</Text>
                            </View>
                            <View style={[pdfStyles.finalTotalRow, { backgroundColor: '#0ea5e9' }]}>
                                <Text style={pdfStyles.finalTotalLabel}>TOTAL</Text>
                                <Text style={pdfStyles.finalTotalValue}>{formatCurrency(pedido.total)}</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Footer */}
                {preferences.signatureType === 'physical' && (
                    <View style={[pdfStyles.footer, { borderTopWidth: 0, marginTop: 40 }]}>
                        <View style={[pdfStyles.signatureBox, { width: '100%' }]}>
                            <View style={[pdfStyles.signatureLine, { width: '50%' }]} />
                            <Text style={pdfStyles.footerText}>APROBADO POR</Text>
                            <Text style={pdfStyles.footerSubText}>(Firma, Nombre y Sello)</Text>
                        </View>
                    </View>
                )}
            </Page>
        </Document>
    );
};

export default PedidoPDFDocument;
