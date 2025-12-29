import React from 'react';
import { Page, Text, View, Document, Image } from '@react-pdf/renderer';
import { Pedido, Cliente, DocumentPreferences, Cotizacion } from '../../types';
import { pdfStyles, formatCurrency } from '../pdf/pdfTheme';

interface Props {
    pedido: Pedido;
    cliente: Cliente;
    empresa: any;
    preferences: DocumentPreferences;
    productos: any[];
    cotizacionOrigen?: Cotizacion | undefined;
    firmaVendedor?: string | null;
}

const PedidoPDFDocument: React.FC<Props> = ({ pedido, cliente, empresa, preferences, productos, cotizacionOrigen, firmaVendedor }) => {

    const totalDescuentos = pedido.items.reduce((acc, item) => {
        const itemTotal = (item.precioUnitario || 0) * (item.cantidad || 0);
        return acc + (itemTotal * ((item.descuentoPorcentaje || 0) / 100));
    }, 0);

    return (
        <Document>
            <Page size="A4" style={pdfStyles.page}>
                {/* Header */}
                <View style={[pdfStyles.header, { alignItems: 'flex-start' }]}>
                    <View style={pdfStyles.logoSection}>
                        <View style={{ width: 85, height: 60, marginRight: 15, justifyContent: 'center', alignItems: 'center' }}>
                            {empresa.logoExt ? (
                                <Image src={empresa.logoExt} style={pdfStyles.logo} />
                            ) : (
                                <View style={pdfStyles.logoPlaceholder} />
                            )}
                        </View>
                        <View style={pdfStyles.companyInfo}>
                            <Text style={pdfStyles.companyName}>{empresa.nombre || empresa.razonSocial || 'MULTIACABADOS'}</Text>
                            <Text style={pdfStyles.companyDetails}>
                                <Text style={pdfStyles.companyDetailLabel}>NIT: </Text>{empresa.nit} • {empresa.regimen || 'Responsable de IVA'}
                            </Text>
                            <View style={{ marginTop: 3, marginBottom: 2 }}>
                                <Text style={pdfStyles.companyAddress}>
                                    <Text style={pdfStyles.companyDetailLabel}>Dirección: </Text>{empresa.direccion}
                                </Text>
                                <Text style={pdfStyles.companyDetails}>{empresa.ciudad}</Text>
                            </View>
                            <View style={{ gap: 1 }}>
                                <Text style={pdfStyles.companyDetails}>
                                    <Text style={pdfStyles.companyDetailLabel}>Tel: </Text>{empresa.telefono}
                                </Text>
                                <Text style={pdfStyles.companyDetails}>
                                    <Text style={pdfStyles.companyDetailLabel}>Email: </Text>{empresa.email}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <View style={pdfStyles.documentTitleSection}>
                        <View style={[pdfStyles.documentBadge, { backgroundColor: '#f0f9ff', borderColor: '#e0f2fe' }]}>
                            <Text style={[pdfStyles.documentTitle, { color: '#0369a1' }]}>ORDEN DE COMPRA</Text>
                        </View>
                        <Text style={pdfStyles.documentNumber}>N° {(pedido.numeroPedido || '').replace('PED-', '')}</Text>
                    </View>
                </View>

                {/* Info Grid */}
                <View style={pdfStyles.infoGrid}>
                    <View style={pdfStyles.infoCard}>
                        <Text style={[pdfStyles.cardLabel, { backgroundColor: '#0ea5e9' }]}>DIRECCIÓN DE ENTREGA</Text>
                        <View style={pdfStyles.cardContent}>
                            <Text style={pdfStyles.clientName}>{cliente.nombreCompleto}</Text>
                            <View style={{ flexDirection: 'row', marginTop: 3, marginBottom: 1.5 }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', width: 55 }}>Dirección:</Text>
                                <Text style={{ fontSize: 9, color: '#334155', flex: 1 }}>{cliente.direccion}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', marginBottom: 1.5 }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', width: 55 }}>Ciudad:</Text>
                                <Text style={{ fontSize: 9, color: '#334155', flex: 1 }}>{cliente.ciudadId}</Text>
                            </View>
                            <View style={{ flexDirection: 'row' }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', width: 55 }}>Teléfono:</Text>
                                <Text style={{ fontSize: 9, color: '#334155', flex: 1 }}>{cliente.telefono}</Text>
                            </View>
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
                                <Text style={pdfStyles.infoValue}>{(cotizacionOrigen?.numeroCotizacion || 'Venta Directa').replace('C-', '')}</Text>
                            </View>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Cond. Pago:</Text>
                                <Text style={pdfStyles.infoValue}>{cliente.condicionPago || 'Contado'}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Table */}
                <View style={[pdfStyles.tableContainer, { marginBottom: 10 }]}> {/* Reduced marginBottom slightly */}
                    <View style={pdfStyles.tableHeader}>
                        <Text style={[pdfStyles.tableHeaderText, { width: '10%' }]}>Referencia</Text>
                        <Text style={[pdfStyles.tableHeaderText, { width: '31%' }]}>Descripción</Text>
                        <Text style={[pdfStyles.tableHeaderText, { width: '8%', textAlign: 'center' }]}>Unidad</Text>
                        <Text style={[pdfStyles.tableHeaderText, { width: '8%', textAlign: 'right' }]}>Cant.</Text>
                        {preferences.showPrices ? (
                            <>
                                <Text style={[pdfStyles.tableHeaderText, { width: '13%', textAlign: 'right' }]}>Precio</Text>
                                <Text style={[pdfStyles.tableHeaderText, { width: '10%', textAlign: 'right' }]}>Desc.</Text>
                                <Text style={[pdfStyles.tableHeaderText, { width: '7%', textAlign: 'right' }]}>IVA</Text>
                                <Text style={[pdfStyles.tableHeaderText, { width: '13%', textAlign: 'right' }]}>Total</Text>
                            </>
                        ) : null}
                    </View>
                    {pedido.items.map((item, idx) => {
                        const product = productos.find(p => p.id === item.productoId);
                        const referencia = (item as any).referencia || product?.referencia || 'N/A';
                        const unidad = (item as any).unidadMedida || (item as any).codigoMedida || product?.unidadMedida || 'N/A';

                        return (
                            <View key={idx} style={[pdfStyles.tableRow, { backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }]}>
                                <Text style={[pdfStyles.tableCellText, { width: '10%', fontSize: 8 }]}>{referencia}</Text>
                                <Text style={[pdfStyles.tableCellText, { width: '31%', fontSize: 8 }]}>{item.descripcion}</Text>
                                <Text style={[pdfStyles.tableCellText, { width: '8%', paddingHorizontal: 2, textAlign: 'center', fontSize: 8, color: '#334155' }]}>{unidad}</Text>
                                <Text style={[pdfStyles.tableCellText, { width: '8%', textAlign: 'right', fontSize: 8 }]}>{item.cantidad}</Text>
                                {preferences.showPrices ? (
                                    <>
                                        <Text style={[pdfStyles.tableCellText, { width: '13%', textAlign: 'right', fontSize: 8 }]}>{formatCurrency(item.precioUnitario)}</Text>
                                        <Text style={[pdfStyles.tableCellText, { width: '10%', paddingHorizontal: 2, textAlign: 'right', fontSize: 8, color: '#ef4444' }]}>{(item.descuentoPorcentaje || 0).toFixed(2)}%</Text>
                                        <Text style={[pdfStyles.tableCellText, { width: '7%', textAlign: 'right', fontSize: 8, color: '#64748b' }]}>{(item.ivaPorcentaje || 0).toFixed(0)}%</Text>
                                        <Text style={[pdfStyles.tableCellText, { width: '13%', textAlign: 'right', fontSize: 8, fontWeight: 'bold' }]}>{formatCurrency(item.total || item.subtotal)}</Text>
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
