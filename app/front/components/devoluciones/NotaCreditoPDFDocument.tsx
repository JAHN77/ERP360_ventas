import React from 'react';
import { Page, Text, View, Document, Image, Link } from '@react-pdf/renderer';
import { NotaCredito, Factura, Cliente, DocumentPreferences } from '../../types';
import { pdfStyles, formatCurrency } from '../pdf/pdfTheme';

interface Props {
    notaCredito: NotaCredito;
    factura: Factura;
    cliente: Cliente;
    empresa: any;
    productos: any[];
    firmaVendedor?: string | null;
    preferences: DocumentPreferences;
}

const NotaCreditoPDFDocument: React.FC<Props> = ({ notaCredito, factura, cliente, empresa, productos, firmaVendedor, preferences }) => {

    const totalDescuentos = notaCredito.itemsDevueltos.reduce((acc, item) => {
        const itemTotal = (item.precioUnitario || 0) * (item.cantidad || 0);
        return acc + (itemTotal * ((item.descuentoPorcentaje || 0) / 100));
    }, 0);

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
                        <View style={[pdfStyles.documentBadge, { backgroundColor: '#fef2f2', borderColor: '#fee2e2' }]}>
                            <Text style={[pdfStyles.documentTitle, { color: '#b91c1c' }]}>NOTA DE CRÉDITO</Text>
                        </View>
                        <Text style={pdfStyles.documentNumber}>N° {String(notaCredito.numero || '').replace(/\D/g, '') || notaCredito.numero}</Text>
                    </View>
                </View>

                <View style={pdfStyles.infoGrid}>
                    <View style={pdfStyles.infoCard}>
                        <Text style={[pdfStyles.cardLabel, { backgroundColor: '#0f172a' }]}>CLIENTE</Text>
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
                                <Text style={pdfStyles.clientValue}>{cliente.ciudad || cliente.ciudadId || ''}</Text>
                            </View>
                        </View>
                    </View>
                    <View style={pdfStyles.infoCard}>
                        <Text style={[pdfStyles.cardLabel, { backgroundColor: '#475569' }]}>REFERENCIA</Text>
                        <View style={pdfStyles.cardContent}>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Fecha:</Text>
                                <Text style={pdfStyles.infoValue}>{new Date(notaCredito.fechaEmision).toLocaleDateString('es-CO')}</Text>
                            </View>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Factura:</Text>
                                <Text style={pdfStyles.infoValue}>{(factura.numeroFactura || '').replace('FAC-', '')}</Text>
                            </View>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Motivo:</Text>
                                <Text style={pdfStyles.infoValue}>{notaCredito.motivo}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={pdfStyles.tableContainer}>
                    <View style={pdfStyles.tableHeader}><Text style={[pdfStyles.tableHeaderText, { width: '13%' }]}>Código</Text><Text style={[pdfStyles.tableHeaderText, { width: '32%' }]}>Descripción</Text><Text style={[pdfStyles.tableHeaderText, { width: '10%', textAlign: 'center' }]}>Cant.</Text><Text style={[pdfStyles.tableHeaderText, { width: '15%', textAlign: 'right' }]}>Precio</Text><Text style={[pdfStyles.tableHeaderText, { width: '8%', textAlign: 'right' }]}>Desc.</Text><Text style={[pdfStyles.tableHeaderText, { width: '7%', textAlign: 'right' }]}>IVA</Text><Text style={[pdfStyles.tableHeaderText, { width: '15%', textAlign: 'right' }]}>Total</Text></View>
                    {notaCredito.itemsDevueltos.map((item, idx) => {
                        const product = productos.find(p => p.id === item.productoId);
                        const subtotalItem = (item.precioUnitario || 0) * (item.cantidad || 0);
                        const valorDescuento = subtotalItem * ((item.descuentoPorcentaje || 0) / 100);
                        const totalItem = subtotalItem - valorDescuento;

                        return (
                            <View key={idx} style={[pdfStyles.tableRow, { backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }]}><Text style={[pdfStyles.tableCellText, { width: '13%' }]}>{product?.codigo || product?.referencia || item.productoId || 'N/A'}</Text><Text style={[pdfStyles.tableCellText, { width: '32%' }]}>{item.descripcion || product?.nombre}</Text><Text style={[pdfStyles.tableCellText, { width: '10%', textAlign: 'center' }]}>{item.cantidad}</Text><Text style={[pdfStyles.tableCellText, { width: '15%', textAlign: 'right' }]}>{formatCurrency(item.precioUnitario)}</Text><Text style={[pdfStyles.tableCellText, { width: '8%', textAlign: 'right', color: '#ef4444' }]}>{item.descuentoPorcentaje > 0 ? `${item.descuentoPorcentaje}%` : '-'}</Text><Text style={[pdfStyles.tableCellText, { width: '7%', textAlign: 'right' }]}>{item.ivaPorcentaje > 0 ? `${item.ivaPorcentaje}%` : '0%'}</Text><Text style={[pdfStyles.tableCellText, { width: '15%', textAlign: 'right', fontWeight: 'bold' }]}>{formatCurrency(item.subtotal ?? totalItem)}</Text></View>
                        );
                    })}
                </View>

                <View style={{ flexDirection: 'row', marginTop: 10, marginBottom: 20, justifyContent: 'space-between' }}>
                    <View style={{ width: 150, paddingLeft: 10, justifyContent: 'center' }}>
                        {notaCredito.cufe ? (
                            <View style={{ alignItems: 'flex-start' }}>
                                <Link src={`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${notaCredito.cufe}`}>
                                    <Image
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${notaCredito.cufe}`}
                                        style={{ width: 85, height: 85, marginBottom: 4 }}
                                    />
                                </Link>
                                <Text style={{ fontSize: 7, color: '#64748b', marginLeft: 2 }}>
                                    Escanee para validar en DIAN
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    <View style={{ width: '50%' }}>
                        <View style={[pdfStyles.totalsCard, { width: '100%' }]}><View style={pdfStyles.totalRow}><Text style={pdfStyles.totalLabel}>Subtotal Bruto</Text><Text style={pdfStyles.totalValue}>{formatCurrency(notaCredito.subtotal + totalDescuentos)}</Text></View><View style={pdfStyles.totalRow}><Text style={[pdfStyles.totalLabel, { color: '#ef4444' }]}>Descuentos</Text><Text style={[pdfStyles.totalValue, { color: '#ef4444' }]}>-{formatCurrency(totalDescuentos)}</Text></View><View style={[pdfStyles.totalRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#e2e8f0' }]}><Text style={pdfStyles.totalLabel}>Subtotal Neto</Text><Text style={pdfStyles.totalValue}>{formatCurrency(notaCredito.subtotal)}</Text></View><View style={pdfStyles.totalRow}><Text style={pdfStyles.totalLabel}>IVA</Text><Text style={pdfStyles.totalValue}>{formatCurrency(notaCredito.iva)}</Text></View><View style={[pdfStyles.finalTotalRow, { backgroundColor: '#b91c1c' }]}><Text style={pdfStyles.finalTotalLabel}>TOTAL DEVUELTO</Text><Text style={pdfStyles.finalTotalValue}>{formatCurrency(notaCredito.total)}</Text></View></View>
                    </View>
                </View>

                {(preferences?.signatureType === 'physical' || preferences?.signatureType === 'digital') ? (
                    <View style={[pdfStyles.footer, { marginTop: 'auto' }]}>
                        <View style={pdfStyles.signatureBox}><View style={{ height: 40, justifyContent: 'flex-end', alignItems: 'center', marginBottom: 5 }}>{firmaVendedor && firmaVendedor.length > 5 ? (<Image src={firmaVendedor} style={{ height: 35, objectFit: 'contain' }} />) : null}</View><View style={pdfStyles.signatureLine} /><Text style={pdfStyles.footerText}>Firma Autorizada</Text></View>
                        <View style={pdfStyles.signatureBox}><View style={{ height: 40 }} /><View style={pdfStyles.signatureLine} /><Text style={pdfStyles.footerText}>Recibido por (Firma y Sello)</Text></View>
                    </View>
                ) : null}
            </Page>
        </Document>
    );
};

export default NotaCreditoPDFDocument;
