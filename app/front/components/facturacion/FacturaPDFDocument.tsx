import React from 'react';
import { Page, Text, View, Document, Link } from '@react-pdf/renderer';
import { Factura, Cliente, DocumentPreferences } from '../../types';
import { pdfStyles, formatCurrency } from '../pdf/pdfTheme';

interface Props {
    factura: Factura;
    cliente: Cliente;
    empresa: any;
    preferences: DocumentPreferences;
    productos: any[];
}

const FacturaPDFDocument: React.FC<Props> = ({ factura, cliente, empresa, preferences, productos }) => {

    const totalDescuentos = factura.items.reduce((acc, item) => {
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
                            <Text style={pdfStyles.companyDetails}>Tel: {empresa.telefono}</Text>
                            {preferences.detailLevel === 'full' && empresa.resolucionDian && (
                                <View style={{ marginTop: 2 }}>
                                    <Text style={pdfStyles.companyDetails}>Resolución DIAN: {empresa.resolucionDian}</Text>
                                    {empresa.rangoNumeracion && <Text style={pdfStyles.companyDetails}>Rango: {empresa.rangoNumeracion}</Text>}
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={pdfStyles.documentTitleSection}>
                        <View style={pdfStyles.documentBadge}>
                            <Text style={pdfStyles.documentTitle}>FACTURA DE VENTA</Text>
                        </View>
                        <Text style={pdfStyles.documentNumber}>{factura.numeroFactura}</Text>
                    </View>
                </View>

                {/* Info Grid */}
                <View style={pdfStyles.infoGrid}>
                    <View style={pdfStyles.infoCard}>
                        <Text style={[pdfStyles.cardLabel, { backgroundColor: '#dc2626' }]}>CLIENTE</Text>
                        <View style={pdfStyles.cardContent}>
                            <Text style={pdfStyles.clientName}>{cliente.nombreCompleto}</Text>
                            <Text style={pdfStyles.companyDetails}>{cliente.tipoDocumentoId}: {cliente.numeroDocumento}</Text>
                            <Text style={pdfStyles.companyDetails}>{cliente.direccion}, {cliente.ciudadId}</Text>
                            <Text style={pdfStyles.companyDetails}>{cliente.email} | {cliente.telefono}</Text>
                        </View>
                    </View>
                    <View style={pdfStyles.infoCard}>
                        <Text style={[pdfStyles.cardLabel, pdfStyles.cardLabelSecondary]}>DETALLES</Text>
                        <View style={pdfStyles.cardContent}>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Emisión:</Text>
                                <Text style={pdfStyles.infoValue}>{new Date(factura.fechaFactura).toLocaleDateString('es-CO')}</Text>
                            </View>
                            {factura.fechaVencimiento && (
                                <View style={pdfStyles.infoRow}>
                                    <Text style={pdfStyles.infoLabel}>Vencimiento:</Text>
                                    <Text style={pdfStyles.infoValue}>{new Date(factura.fechaVencimiento).toLocaleDateString('es-CO')}</Text>
                                </View>
                            )}
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Forma Pago:</Text>
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
                    {factura.items.map((item, idx) => {
                        const product = productos.find(p => p.id === item.productoId);
                        const referencia = product?.referencia || 'N/A';
                        const unidad = product?.unidadMedida || 'N/A';

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

                {/* Totals, CUFE and Observations */}
                <View style={{ marginBottom: 20 }}>
                    {preferences.detailLevel === 'full' && factura.cufe && (
                        <View style={{ marginBottom: 10, padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, backgroundColor: '#f8fafc' }}>
                            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#334155', marginBottom: 2 }}>CUFE:</Text>
                            <Text style={{ fontSize: 8, fontFamily: 'Courier', color: '#475569' }}>{factura.cufe}</Text>
                            <Link src={`https://catalogo-vpfe.dian.gov.co/document/searchqr?cufe=${factura.cufe}`} style={{ fontSize: 8, color: '#2563eb', marginTop: 4, textDecoration: 'none' }}>
                                Verificar en DIAN
                            </Link>
                        </View>
                    )}

                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', marginBottom: 4 }}>OBSERVACIONES</Text>
                    <View style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <Text style={{ fontSize: 9, color: '#334155' }}>{factura.observaciones || 'Factura generada electrónicamente conforme a la Resolución DIAN vigente.'}</Text>
                    </View>
                </View>

                {/* Totals */}
                {preferences.showPrices && (
                    <View style={pdfStyles.totalsSection}>
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
            </Page>
        </Document>
    );
};

export default FacturaPDFDocument;
