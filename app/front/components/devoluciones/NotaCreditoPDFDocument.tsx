import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font, Link } from '@react-pdf/renderer';
import { NotaCredito, Factura, Cliente } from '../../types';

// Registrar fuentes si se desea usar alguna específica (opcional, usaremos estándar por ahora)
// Font.register({ family: 'Roboto', src: 'path/to/font.ttf' });

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'Helvetica',
        fontSize: 10,
        color: '#334155', // slate-700
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 10,
    },
    logoSection: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    logoPlaceholder: {
        width: 60,
        height: 60,
        backgroundColor: '#f1f5f9',
        marginRight: 10,
        borderRadius: 4,
    },
    logo: {
        width: 85,
        height: 60,
        marginRight: 15,
        objectFit: 'contain',
    },
    companyInfo: {
        marginLeft: 10,
    },
    companyName: {
        fontSize: 16,
        fontWeight: 'extrabold',
        textTransform: 'uppercase',
        color: '#1e293b', // slate-800
        marginBottom: 2,
        letterSpacing: 0.5,
    },
    companyDetails: {
        fontSize: 6.5,
        color: '#475569', // slate-600
        marginBottom: 1,
        lineHeight: 1.1,
    },
    companyAddress: {
        fontSize: 7,
        color: '#475569',
        width: 180,
        lineHeight: 1.2,
    },
    companyDetailLabel: {
        fontWeight: 'bold',
        color: '#64748b',
    },
    documentTitleSection: {
        alignItems: 'flex-end',
    },
    documentBadge: {
        backgroundColor: '#fef2f2', // red-50
        borderColor: '#fee2e2', // red-100
        borderWidth: 1,
        borderRadius: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        marginBottom: 4,
    },
    documentTitle: {
        color: '#b91c1c', // red-700
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    documentNumber: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e293b', // slate-800
    },
    signatureText: {
        fontSize: 8,
        color: '#64748b',
        textTransform: 'uppercase',
        fontWeight: 'bold',
    },

    // Grid Information
    infoGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    infoCard: {
        width: '48%',
        backgroundColor: '#f8fafc', // slate-50
        borderWidth: 1,
        borderColor: '#e2e8f0', // slate-200
        borderRadius: 6,
        padding: 10,
        position: 'relative',
    },
    cardLabel: {
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: '#2563eb', // blue-600
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderTopLeftRadius: 5,
        borderBottomRightRadius: 5,
    },
    cardLabelRef: {
        backgroundColor: '#475569', // slate-600
    },
    cardContent: {
        marginTop: 15,
    },
    clientName: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 3,
        borderBottomWidth: 0.5,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 2,
    },
    infoLabel: {
        fontWeight: 'bold',
        color: '#64748b',
        width: 70,
    },
    infoValue: {
        flex: 1,
        textAlign: 'right',
        color: '#0f172a',
    },

    // Table
    tableContainer: {
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9', // slate-100
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 6,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingVertical: 6,
    },
    colCode: { width: '15%', paddingHorizontal: 4 },
    colDesc: { width: '35%', paddingHorizontal: 4 },
    colQty: { width: '10%', paddingHorizontal: 4, textAlign: 'right' },
    colPrice: { width: '15%', paddingHorizontal: 4, textAlign: 'right' },
    colDisc: { width: '10%', paddingHorizontal: 4, textAlign: 'right', color: '#ef4444' }, // red-500
    colTotal: { width: '15%', paddingHorizontal: 4, textAlign: 'right', fontWeight: 'bold' },

    tableHeaderText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#334155',
    },
    tableCellText: {
        fontSize: 9,
        color: '#334155',
    },

    // Totals
    totalsSection: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 30,
    },
    totalsCard: {
        width: '100%',
        backgroundColor: '#f8fafc',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 10,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    totalLabel: {
        fontSize: 9,
        color: '#64748b',
    },
    totalValue: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    finalTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        backgroundColor: '#0f172a', // slate-900
        padding: 8,
        borderRadius: 4,
    },
    finalTotalLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#ffffff',
        textTransform: 'uppercase',
    },
    finalTotalValue: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#ffffff',
    },

    // Footer
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 'auto',
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    signatureBox: {
        width: '40%',
        alignItems: 'center',
    },
    signatureLine: {
        height: 1,
        width: '100%',
        backgroundColor: '#cbd5e1', // slate-300
        marginBottom: 5,
        borderStyle: 'dashed',
        borderWidth: 1,
    },
    footerText: {
        fontSize: 8,
        color: '#64748b',
        textTransform: 'uppercase',
        fontWeight: 'bold',
    },
    footerSubText: {
        fontSize: 8,
        color: '#94a3b8',
    }
});

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

interface Props {
    notaCredito: NotaCredito;
    factura: Factura;
    cliente: Cliente;
    empresa: any;
    productos: any[];
    firmaVendedor?: string | null;
}

const NotaCreditoPDFDocument: React.FC<Props> = ({ notaCredito, factura, cliente, empresa, productos, firmaVendedor }) => {

    const totalDescuentos = notaCredito.itemsDevueltos.reduce((acc, item) => {
        const itemTotal = item.precioUnitario * item.cantidad;
        return acc + (itemTotal * (item.descuentoPorcentaje / 100));
    }, 0);

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={[styles.header, { alignItems: 'flex-start' }]}>
                    <View style={styles.logoSection}>
                        <View style={{ width: 85, height: 60, marginRight: 15, justifyContent: 'center', alignItems: 'center' }}>
                            {empresa.logoExt ? (
                                <Image src={empresa.logoExt} style={styles.logo} />
                            ) : (
                                <View style={styles.logoPlaceholder} />
                            )}
                        </View>
                        <View style={styles.companyInfo}>
                            <Text style={styles.companyName}>{empresa.nombre || empresa.razonSocial || 'MULTIACABADOS'}</Text>
                            <Text style={styles.companyDetails}>
                                <Text style={styles.companyDetailLabel}>NIT: </Text>{empresa.nit} • {empresa.regimen || 'Responsable de IVA'}
                            </Text>
                            <View style={{ marginTop: 3, marginBottom: 2 }}>
                                <Text style={styles.companyAddress}>
                                    <Text style={styles.companyDetailLabel}>Dirección: </Text>{empresa.direccion}
                                </Text>
                                <Text style={styles.companyDetails}>{empresa.ciudad}</Text>
                            </View>
                            <View style={{ gap: 1 }}>
                                <Text style={styles.companyDetails}>
                                    <Text style={styles.companyDetailLabel}>Tel: </Text>{empresa.telefono}
                                </Text>
                                <Text style={styles.companyDetails}>
                                    <Text style={styles.companyDetailLabel}>Email: </Text>{empresa.email}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.documentTitleSection}>
                        <View style={styles.documentBadge}>
                            <Text style={styles.documentTitle}>NOTA DE CRÉDITO</Text>
                        </View>
                        <Text style={styles.documentNumber}>N° {String(notaCredito.numero || '').replace(/\D/g, '') || notaCredito.numero}</Text>
                    </View>
                </View>

                {/* Info Grid */}
                <View style={styles.infoGrid}>
                    <View style={styles.infoCard}>
                        <Text style={styles.cardLabel}>CLIENTE</Text>
                        <View style={styles.cardContent}>
                            <Text style={styles.clientName}>{cliente.nombreCompleto}</Text>
                            <View style={{ flexDirection: 'row', marginTop: 3, marginBottom: 1.5 }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', width: 55 }}>NIT/CC:</Text>
                                <Text style={{ fontSize: 9, color: '#334155', flex: 1 }}>{cliente.tipoDocumentoId} {cliente.numeroDocumento}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', marginBottom: 1.5 }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', width: 55 }}>Dirección:</Text>
                                <Text style={{ fontSize: 9, color: '#334155', flex: 1 }}>{cliente.direccion}</Text>
                            </View>
                            <View style={{ flexDirection: 'row' }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', width: 55 }}>Ciudad:</Text>
                                <Text style={{ fontSize: 9, color: '#334155', flex: 1 }}>{cliente.ciudadId}</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.infoCard}>
                        <Text style={[styles.cardLabel, styles.cardLabelRef]}>REFERENCIA</Text>
                        <View style={styles.cardContent}>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Fecha:</Text>
                                <Text style={styles.infoValue}>{new Date(notaCredito.fechaEmision).toLocaleDateString('es-CO')}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Factura:</Text>
                                <Text style={styles.infoValue}>{(factura.numeroFactura || '').replace('FAC-', '')}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Motivo:</Text>
                                <Text style={styles.infoValue}>{notaCredito.motivo}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Table */}
                <View style={styles.tableContainer}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderText, styles.colCode]}>Código</Text>
                        <Text style={[styles.tableHeaderText, styles.colDesc]}>Descripción</Text>
                        <Text style={[styles.tableHeaderText, styles.colQty]}>Cantidad</Text>
                        <Text style={[styles.tableHeaderText, styles.colPrice]}>Precio</Text>
                        <Text style={[styles.tableHeaderText, styles.colDisc]}>Desc.</Text>
                        <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
                    </View>
                    {notaCredito.itemsDevueltos.map((item, idx) => {
                        const product = productos.find(p => p.id === item.productoId);
                        const subtotalItem = (item.precioUnitario || 0) * (item.cantidad || 0);
                        const valorDescuento = subtotalItem * ((item.descuentoPorcentaje || 0) / 100);
                        const totalItem = subtotalItem - valorDescuento;

                        return (
                            <View key={idx} style={[styles.tableRow, { backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }]}>
                                <Text style={[styles.tableCellText, styles.colCode]}>
                                    {product?.codigo || product?.referencia || item.productoId || 'N/A'}
                                </Text>
                                <Text style={[styles.tableCellText, styles.colDesc]}>{item.descripcion || product?.nombre}</Text>
                                <Text style={[styles.tableCellText, styles.colQty]}>{item.cantidad}</Text>
                                <Text style={[styles.tableCellText, styles.colPrice]}>{formatCurrency(item.precioUnitario)}</Text>
                                <Text style={[styles.tableCellText, styles.colDisc]}>{item.descuentoPorcentaje > 0 ? `${item.descuentoPorcentaje}%` : '-'}</Text>
                                <Text style={[styles.tableCellText, styles.colTotal]}>{formatCurrency(item.subtotal ?? totalItem)}</Text>
                            </View>
                        );
                    })}
                </View>

                {/* Totals and CUFE Wrapper */}
                <View style={{ flexDirection: 'row', marginTop: 10, marginBottom: 20, justifyContent: 'space-between' }}>

                    {/* CUFE/QR Section (Left Side) */}
                    <View style={{ width: 150, paddingLeft: 10, justifyContent: 'center' }}>
                        {notaCredito.cufe && (
                            <View style={{ alignItems: 'flex-start' }}>
                                <Link src={`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${notaCredito.cufe}`}>
                                    <Image
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${notaCredito.cufe}`}
                                        style={{ width: 85, height: 85, marginBottom: 4 }}
                                    />
                                </Link>
                                <Text style={{ fontSize: 7, color: '#64748b', marginLeft: 2 }}>
                                    Haga clic en el QR para validar en DIAN
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Totals Section (Right Side) */}
                    <View style={{ width: '50%' }}>
                        <View style={styles.totalsCard}>
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Subtotal Bruto</Text>
                                <Text style={styles.totalValue}>{formatCurrency(notaCredito.subtotal + totalDescuentos)}</Text>
                            </View>
                            <View style={styles.totalRow}>
                                <Text style={[styles.totalLabel, { color: '#ef4444' }]}>Descuentos</Text>
                                <Text style={[styles.totalValue, { color: '#ef4444' }]}>-{formatCurrency(totalDescuentos)}</Text>
                            </View>
                            <View style={[styles.totalRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#e2e8f0' }]}>
                                <Text style={styles.totalLabel}>Subtotal Neto</Text>
                                <Text style={styles.totalValue}>{formatCurrency(notaCredito.subtotal)}</Text>
                            </View>
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>IVA</Text>
                                <Text style={styles.totalValue}>{formatCurrency(notaCredito.iva)}</Text>
                            </View>
                            <View style={styles.finalTotalRow}>
                                <Text style={styles.finalTotalLabel}>TOTAL DEVUELTO</Text>
                                <Text style={styles.finalTotalValue}>{formatCurrency(notaCredito.total)}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Signatures (Bottom) */}
                <View style={[styles.footer, { marginTop: 'auto' }]}>
                    <View style={styles.signatureBox}>
                        <View style={{ height: 40, justifyContent: 'flex-end', alignItems: 'center', marginBottom: 5 }}>
                            {firmaVendedor && <Image src={firmaVendedor} style={{ height: 35, objectFit: 'contain' }} />}
                        </View>
                        <View style={styles.signatureLine} />
                        <Text style={styles.signatureText}>Firma Autorizada</Text>
                    </View>
                    <View style={styles.signatureBox}>
                        <View style={{ height: 40 }} />
                        <View style={styles.signatureLine} />
                        <Text style={styles.signatureText}>Recibido por (Firma y Sello)</Text>
                    </View>
                </View>
            </Page>
        </Document>
    );
};

export default NotaCreditoPDFDocument;
