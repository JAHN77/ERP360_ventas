import React from 'react';
import { Document, Page, Text, View, Image, Link } from '@react-pdf/renderer';
import { Factura, Vendedor, Empresa, DocumentPreferences } from '../../types';
import { pdfStyles, formatCurrency } from '../pdf/pdfTheme';

interface FacturaPDFDocumentProps {
    factura: Factura;
    vendedor?: Vendedor;
    cliente: any;
    empresa: Empresa;
    preferences: DocumentPreferences;
    firmaVendedor?: string | null;
}

const FacturaPDFDocument: React.FC<FacturaPDFDocumentProps> = ({
    factura,
    vendedor,
    cliente,
    empresa,
    preferences,
    firmaVendedor,
}) => {
    const totalDescuentos = factura.items.reduce((sum, item) => sum + (item.subtotal * (item.descuentoPorcentaje / 100)), 0);

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
                        <View style={pdfStyles.documentBadge}>
                            <Text style={pdfStyles.documentTitle}>FACTURA DE VENTA</Text>
                        </View>
                        <Text style={pdfStyles.documentNumber}>{String(factura.numeroFactura || '').replace('FAC-', '')}</Text>
                    </View>
                </View>

                {/* Info Grid */}
                <View style={pdfStyles.infoGrid}>
                    <View style={pdfStyles.infoCard}>
                        <Text style={[pdfStyles.cardLabel, { backgroundColor: '#dc2626' }]}>CLIENTE</Text>
                        <View style={pdfStyles.cardContent}>
                            <Text style={pdfStyles.clientName}>{cliente.nombreCompleto}</Text>
                            <View style={{ flexDirection: 'row', marginTop: 3, marginBottom: 1.5 }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', width: 55 }}>NIT/CC:</Text>
                                <Text style={{ fontSize: 9, color: '#334155', flex: 1 }}>{cliente.tipoDocumentoId} {cliente.numeroDocumento}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', marginBottom: 1.5 }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', width: 55 }}>Dirección:</Text>
                                <Text style={{ fontSize: 9, color: '#334155', flex: 1 }}>{cliente.direccion}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', marginBottom: 1.5 }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', width: 55 }}>Ciudad:</Text>
                                <Text style={{ fontSize: 9, color: '#334155', flex: 1 }}>{cliente.ciudadId}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', marginBottom: 1.5 }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', width: 55 }}>Teléfono:</Text>
                                <Text style={{ fontSize: 9, color: '#334155', flex: 1 }}>{cliente.telefono}</Text>
                            </View>
                            <View style={{ flexDirection: 'row' }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', width: 55 }}>Email:</Text>
                                <Text style={{ fontSize: 9, color: '#334155', flex: 1 }}>{cliente.email}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={pdfStyles.infoCard}>
                        <Text style={[pdfStyles.cardLabel, pdfStyles.cardLabelSecondary]}>DETALLES</Text>
                        <View style={pdfStyles.cardContent}>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Fecha:</Text>
                                <Text style={pdfStyles.infoValue}>{factura.fechaFactura}</Text>
                            </View>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Vence:</Text>
                                <Text style={pdfStyles.infoValue}>{factura.fechaVencimiento || 'N/A'}</Text>
                            </View>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Vendedor:</Text>
                                <Text style={pdfStyles.infoValue}>{vendedor?.nombreCompleto || 'N/A'}</Text>
                            </View>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>F. Pago:</Text>
                                <Text style={pdfStyles.infoValue}>{factura.formaPago || 'Contado'}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Items Table */}
                <View style={pdfStyles.tableContainer}>
                    <View style={pdfStyles.tableHeader}>
                        <Text style={[pdfStyles.tableHeaderText, pdfStyles.colCode]}>Ref.</Text>
                        <Text style={[pdfStyles.tableHeaderText, pdfStyles.colDesc]}>Descripción</Text>
                        <Text style={[pdfStyles.tableHeaderText, pdfStyles.colQty]}>Cant.</Text>
                        <Text style={[pdfStyles.tableHeaderText, pdfStyles.colPrice]}>Precio</Text>
                        <Text style={[pdfStyles.tableHeaderText, pdfStyles.colDisc]}>Dcto.</Text>
                        <Text style={[pdfStyles.tableHeaderText, pdfStyles.colTotal]}>Neto</Text>
                    </View>
                    {factura.items.map((item, index) => (
                        <View key={index} style={pdfStyles.tableRow}>
                            <Text style={[pdfStyles.tableCellText, pdfStyles.colCode]}>{item.codProducto || 'N/A'}</Text>
                            <Text style={[pdfStyles.tableCellText, pdfStyles.colDesc]}>{item.descripcion}</Text>
                            <Text style={[pdfStyles.tableCellText, pdfStyles.colQty]}>{item.cantidad}</Text>
                            <Text style={[pdfStyles.tableCellText, pdfStyles.colPrice]}>
                                {preferences.showPrices ? formatCurrency(item.precioUnitario) : '***'}
                            </Text>
                            <Text style={[pdfStyles.tableCellText, pdfStyles.colDisc]}>
                                {item.descuentoPorcentaje > 0 ? `${item.descuentoPorcentaje}%` : '0%'}
                            </Text>
                            <Text style={[pdfStyles.tableCellText, pdfStyles.colTotal]}>
                                {preferences.showPrices ? formatCurrency(item.total) : '***'}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Totals Section */}
                {preferences.showPrices && (
                    <View style={[pdfStyles.totalsSection, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
                        {/* QR Code Section (Left Side) */}
                        <View style={{ width: 150, paddingLeft: 10, justifyContent: 'center' }}>
                            {factura.cufe && (
                                <View style={{ alignItems: 'flex-start' }}>
                                    <Link src={`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${factura.cufe}`}>
                                        <Image
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${factura.cufe}`}
                                            style={{ width: 85, height: 85, marginBottom: 4 }}
                                        />
                                    </Link>
                                    <Text style={{ fontSize: 7, color: '#64748b', marginLeft: 2 }}>
                                        Haga clic en el QR para validar en DIAN
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Totals Card */}
                        <View style={pdfStyles.totalsCard}>
                            <View style={pdfStyles.totalRow}>
                                <Text style={pdfStyles.totalLabel}>Subtotal Bruto</Text>
                                <Text style={pdfStyles.totalValue}>{formatCurrency(factura.subtotal + totalDescuentos)}</Text>
                            </View>
                            <View style={pdfStyles.totalRow}>
                                <Text style={[pdfStyles.totalLabel, pdfStyles.textRed]}>Descuentos</Text>
                                <Text style={[pdfStyles.totalValue, pdfStyles.textRed]}>-{formatCurrency(totalDescuentos)}</Text>
                            </View>
                            <View style={[pdfStyles.totalRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#e2e8f0' }]}>
                                <Text style={pdfStyles.totalLabel}>Subtotal Neto</Text>
                                <Text style={pdfStyles.totalValue}>{formatCurrency(factura.subtotal)}</Text>
                            </View>
                            <View style={pdfStyles.totalRow}>
                                <Text style={pdfStyles.totalLabel}>IVA</Text>
                                <Text style={pdfStyles.totalValue}>{formatCurrency(factura.ivaValor)}</Text>
                            </View>
                            <View style={[pdfStyles.finalTotalRow, { backgroundColor: '#0f172a' }]}>
                                <Text style={pdfStyles.finalTotalLabel}>TOTAL</Text>
                                <Text style={pdfStyles.finalTotalValue}>{formatCurrency(factura.total)}</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Observaciones */}
                <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', marginBottom: 4 }}>OBSERVACIONES</Text>
                    <View style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <Text style={{ fontSize: 9, color: '#334155' }}>{factura.observaciones || 'Factura generada electrónicamente conforme a la Resolución DIAN vigente.'}</Text>
                    </View>
                </View>

                {/* Signatures at the Bottom */}
                {preferences.signatureType === 'physical' && (
                    <View style={[pdfStyles.footer, { marginTop: 'auto', paddingTop: 20 }]}>
                        <View style={pdfStyles.signatureBox}>
                            <View style={{ height: 40, justifyContent: 'flex-end', alignItems: 'center', marginBottom: 5 }}>
                                {firmaVendedor && <Image src={firmaVendedor} style={{ height: 35, objectFit: 'contain' }} />}
                            </View>
                            <View style={pdfStyles.signatureLine} />
                            <Text style={pdfStyles.footerText}>Vendedor Autorizado</Text>
                            <Text style={pdfStyles.footerSubText}>{vendedor?.nombreCompleto || 'Firma Responsable'}</Text>
                        </View>
                        <View style={pdfStyles.signatureBox}>
                            <View style={{ height: 40 }} />
                            <View style={pdfStyles.signatureLine} />
                            <Text style={pdfStyles.footerText}>Recibido Conforme</Text>
                            <Text style={pdfStyles.footerSubText}>Nombre, C.C. y Fecha</Text>
                        </View>
                    </View>
                )}



                {/* Footer Note */}
                <View style={{ marginTop: 2, paddingTop: 5, borderTopWidth: 0 }}>
                    <Text style={{ fontSize: 7, color: '#94a3b8', textAlign: 'center' }}>
                        Esta factura es un título valor según el Art. 774 del Código de Comercio.
                    </Text>
                </View>
            </Page>
        </Document>
    );
};

export default FacturaPDFDocument;
