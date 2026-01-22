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
    productos: any[];
}

const FacturaPDFDocument: React.FC<FacturaPDFDocumentProps> = ({
    factura,
    vendedor,
    cliente,
    empresa,
    preferences,
    firmaVendedor,
    productos,
}) => {
    // Safety check for preferences
    const safePreferences = preferences || { showPrices: true, signatureType: 'digital' as const, detailLevel: 'full' as const };

    // Ensure numeric values
    const subtotal = Number(factura.subtotal) || 0;
    const total = Number(factura.total) || 0;
    const ivaValor = Number(factura.ivaValor) || 0;

    const totalDescuentos = (factura.items || []).reduce((sum, item) => {
        const itemSubtotal = Number(item.subtotal) || 0;
        const discountPct = Number(item.descuentoPorcentaje) || 0;
        return sum + (itemSubtotal * (discountPct / 100));
    }, 0);

    const formatCurrencySafe = (val: any) => formatCurrency(Number(val) || 0);

    return (
        <Document>
            <Page size="A4" style={pdfStyles.page}>
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
                                    <Text style={pdfStyles.companyDetailLabel}>Dirección: </Text>{(empresa.direccion || '').replace(/^(Dirección|irección)\s*[:=]\s*/i, '')}
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
                        <Text style={pdfStyles.documentNumber}>N° {String(factura.numeroFactura || '').replace('FAC-', '')}</Text>
                    </View>
                </View>

                <View style={pdfStyles.infoGrid}>
                    <View style={pdfStyles.infoCard}>
                        <Text style={[pdfStyles.cardLabel, { backgroundColor: '#dc2626' }]}>CLIENTE</Text>
                        <View style={pdfStyles.cardContent}>
                            <Text style={pdfStyles.clientName}>{cliente.nombreCompleto}</Text>
                            <View style={[pdfStyles.clientRow, { marginTop: 3 }]}>
                                <Text style={pdfStyles.clientLabel}>NIT/CC:</Text>
                                <Text style={pdfStyles.clientValue}>{cliente.tipoDocumentoId} {cliente.numeroDocumento}</Text>
                            </View>
                            <View style={pdfStyles.clientRow}>
                                <Text style={pdfStyles.clientLabel}>Dirección:</Text>
                                <Text style={pdfStyles.clientValue} numberOfLines={1}>{(cliente.direccion || '').replace(/\s+/g, ' ').trim()}</Text>
                            </View>
                            <View style={pdfStyles.clientRow}>
                                <Text style={pdfStyles.clientLabel}>Ciudad:</Text>
                                <Text style={pdfStyles.clientValue}>{cliente.ciudadId}</Text>
                            </View>
                            <View style={pdfStyles.clientRow}>
                                <Text style={pdfStyles.clientLabel}>Teléfono:</Text>
                                <Text style={pdfStyles.clientValue}>{cliente.telefono}</Text>
                            </View>
                            <View style={pdfStyles.clientRow}>
                                <Text style={pdfStyles.clientLabel}>Email:</Text>
                                <Text style={pdfStyles.clientValue}>{cliente.email}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={pdfStyles.infoCard}>
                        <Text style={[pdfStyles.cardLabel, pdfStyles.cardLabelSecondary]}>DETALLES</Text>
                        <View style={pdfStyles.cardContent}>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Fecha:</Text>
                                <Text style={pdfStyles.infoValue}>{new Date(factura.fechaFactura).toLocaleDateString('es-CO')}</Text>
                            </View>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Vence:</Text>
                                <Text style={pdfStyles.infoValue}>{factura.fechaVencimiento ? new Date(factura.fechaVencimiento).toLocaleDateString('es-CO') : 'N/A'}</Text>
                            </View>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Vendedor:</Text>
                                <Text style={pdfStyles.infoValue}>{vendedor?.nombreCompleto || 'N/A'}</Text>
                            </View>
                            {Number(cliente.plazo) > 0 && (
                                <View style={pdfStyles.infoRow}>
                                    <Text style={pdfStyles.infoLabel}>Plazo:</Text>
                                    <Text style={pdfStyles.infoValue}>{cliente.plazo} Días</Text>
                                </View>
                            )}
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>F. Pago:</Text>
                                <Text style={pdfStyles.infoValue}>{factura.formaPago || 'Contado'}</Text>
                            </View>
                            {factura.remisionesNumeros && (
                                <View style={pdfStyles.infoRow}>
                                    <Text style={pdfStyles.infoLabel}>Remisión:</Text>
                                    <Text style={pdfStyles.infoValue}>{factura.remisionesNumeros}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                <View style={[pdfStyles.tableContainer, { marginBottom: 10 }]}>
                    <View style={pdfStyles.tableHeader}>
                        <Text style={[pdfStyles.tableHeaderText, { width: '12%', paddingLeft: 4 }]}>Ref.</Text>
                        <Text style={[pdfStyles.tableHeaderText, { width: '35%', paddingHorizontal: 4 }]}>Descripción</Text>
                        <Text style={[pdfStyles.tableHeaderText, { width: '8%', textAlign: 'center' }]}>Cant.</Text>
                        <Text style={[pdfStyles.tableHeaderText, { width: '13%', textAlign: 'right' }]}>Precio</Text>
                        <Text style={[pdfStyles.tableHeaderText, { width: '10%', textAlign: 'right' }]}>Dcto.</Text>
                        <Text style={[pdfStyles.tableHeaderText, { width: '7%', textAlign: 'right' }]}>IVA</Text>
                        <Text style={[pdfStyles.tableHeaderText, { width: '15%', textAlign: 'right', paddingRight: 4 }]}>Neto</Text>
                    </View>
                    {(factura.items || []).map((item, index) => {
                        const product = productos.find(p => p.id === item.productoId);
                        const referencia = item.referencia || product?.referencia || item.codProducto || 'N/A';
                        const itemTotal = Number(item.total) || 0; // Use local const for clarity

                        return (
                            <View key={index} style={[pdfStyles.tableRow, { backgroundColor: index % 2 === 1 ? '#f8fafc' : '#ffffff' }]}>
                                <Text style={[pdfStyles.tableCellText, { width: '12%', fontSize: 8, paddingLeft: 4 }]}>{referencia}</Text>
                                <Text style={[pdfStyles.tableCellText, { width: '35%', fontSize: 8, paddingHorizontal: 4 }]}>{item.descripcion}</Text>
                                <Text style={[pdfStyles.tableCellText, { width: '8%', textAlign: 'center', fontSize: 8 }]}>{item.cantidad}</Text>
                                <Text style={[pdfStyles.tableCellText, { width: '13%', textAlign: 'right', fontSize: 8 }]}>
                                    {safePreferences.showPrices ? formatCurrencySafe(item.precioUnitario) : '***'}
                                </Text>
                                <Text style={[pdfStyles.tableCellText, { width: '10%', textAlign: 'right', fontSize: 8, color: '#ef4444' }]}>
                                    {(item.descuentoPorcentaje || 0) > 0 ? `${(item.descuentoPorcentaje || 0).toFixed(0)}%` : '-'}
                                </Text>
                                <Text style={[pdfStyles.tableCellText, { width: '7%', textAlign: 'right', fontSize: 8, color: '#64748b' }]}>
                                    {(item.ivaPorcentaje || 0).toFixed(0)}%
                                </Text>
                                <Text style={[pdfStyles.tableCellText, { width: '15%', textAlign: 'right', fontSize: 8, fontWeight: 'bold', paddingRight: 4 }]}>
                                    {safePreferences.showPrices ? formatCurrencySafe(itemTotal) : '***'}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                {safePreferences.showPrices ? (
                    <View style={[pdfStyles.totalsSection, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
                        <View style={{ width: 150, paddingLeft: 10, justifyContent: 'center' }}>
                            {factura.cufe ? (
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
                            ) : null}
                        </View>

                        <View style={pdfStyles.totalsCard}>
                            <View style={pdfStyles.totalRow}>
                                <Text style={pdfStyles.totalLabel}>Subtotal Bruto</Text>
                                <Text style={pdfStyles.totalValue}>{formatCurrencySafe(subtotal + totalDescuentos)}</Text>
                            </View>
                            <View style={pdfStyles.totalRow}>
                                <Text style={[pdfStyles.totalLabel, pdfStyles.textRed]}>Descuentos</Text>
                                <Text style={[pdfStyles.totalValue, pdfStyles.textRed]}>-{formatCurrencySafe(totalDescuentos)}</Text>
                            </View>
                            <View style={[pdfStyles.totalRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#e2e8f0' }]}>
                                <Text style={pdfStyles.totalLabel}>Subtotal Neto</Text>
                                <Text style={pdfStyles.totalValue}>{formatCurrencySafe(subtotal)}</Text>
                            </View>
                            <View style={pdfStyles.totalRow}>
                                <Text style={pdfStyles.totalLabel}>IVA</Text>
                                <Text style={pdfStyles.totalValue}>{formatCurrencySafe(ivaValor)}</Text>
                            </View>
                            <View style={[pdfStyles.finalTotalRow, { backgroundColor: '#0f172a' }]}>
                                <Text style={pdfStyles.finalTotalLabel}>TOTAL</Text>
                                <Text style={pdfStyles.finalTotalValue}>{formatCurrencySafe(total)}</Text>
                            </View>
                        </View>
                    </View>
                ) : null}

                <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', marginBottom: 4 }}>OBSERVACIONES</Text>
                    <View style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <Text style={{ fontSize: 9, color: '#334155' }}>{factura.observaciones || 'Factura generada electrónicamente conforme a la Resolución DIAN vigente.'}</Text>
                    </View>
                </View>

                {(safePreferences?.signatureType === 'physical' || safePreferences?.signatureType === 'digital') ? (
                    <View style={[pdfStyles.footer, { marginTop: 'auto', paddingTop: 20 }]}>
                        <View style={pdfStyles.signatureBox}>
                            <View style={{ height: 40, justifyContent: 'flex-end', alignItems: 'center', marginBottom: 5 }}>
                                {firmaVendedor && firmaVendedor.length > 5 ? (
                                    <Image src={firmaVendedor} style={{ height: 35, objectFit: 'contain' }} />
                                ) : null}
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
                ) : null}

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
