import React from 'react';
import { Page, Text, View, Document, Image } from '@react-pdf/renderer';
import { Remision, Pedido, Cliente, DocumentPreferences } from '../../types';
import { pdfStyles, formatCurrency } from '../pdf/pdfTheme';

interface Props {
    remision: Remision;
    pedido: Pedido;
    cliente: Cliente;
    empresa: any;
    preferences: DocumentPreferences;
    productos: any[];
    firmaVendedor?: string | null;
}

const RemisionPDFDocument: React.FC<Props> = ({ remision, pedido, cliente, empresa, preferences, productos, firmaVendedor }) => {

    const safePreferences = preferences || { showPrices: false, signatureType: 'physical' as const, detailLevel: 'summary' as const };
    const formatCurrencySafe = (val: any) => formatCurrency(Number(val) || 0);

    // Calcular totales si es necesario (copiado de lógica anterior o simplificado)
    const itemsWithCalculations = (remision.items || []).map(item => {
        const subtotalBruto = (item.precioUnitario || 0) * (item.cantidad || 0);
        const valorDescuento = subtotalBruto * ((item.descuentoPorcentaje || 0) / 100);
        const subtotal = item.subtotal ?? (subtotalBruto - valorDescuento);
        const valorIva = item.valorIva ?? (subtotal * ((item.ivaPorcentaje || 0) / 100));

        return {
            ...item,
            subtotalBruto,
            valorDescuento,
            subtotal,
            valorIva,
            total: subtotal + valorIva
        };
    });

    const totals = itemsWithCalculations.reduce((acc, item) => ({
        subtotalBruto: acc.subtotalBruto + item.subtotalBruto,
        descuentoTotal: acc.descuentoTotal + item.valorDescuento,
        subtotalNeto: acc.subtotalNeto + item.subtotal,
        iva: acc.iva + item.valorIva,
        total: acc.total + item.total
    }), { subtotalBruto: 0, descuentoTotal: 0, subtotalNeto: 0, iva: 0, total: 0 });

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
                            <Text style={[pdfStyles.documentTitle, { color: '#0369a1' }]}>REMISIÓN</Text>
                        </View>
                        <Text style={pdfStyles.documentNumber}>N° {(remision.numeroRemision || '').replace('REM-', '')}</Text>
                    </View>
                </View>

                <View style={pdfStyles.infoGrid}>
                    <View style={pdfStyles.infoCard}>
                        <Text style={[pdfStyles.cardLabel, { backgroundColor: '#0ea5e9' }]}>DESTINATARIO</Text>
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
                            <View style={{ flexDirection: 'row' }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', width: 55 }}>Ciudad:</Text>
                                <Text style={{ fontSize: 9, color: '#334155', flex: 1 }}>{cliente.ciudadId}</Text>
                            </View>
                        </View>
                    </View>
                    <View style={pdfStyles.infoCard}>
                        <Text style={[pdfStyles.cardLabel, pdfStyles.cardLabelSecondary]}>DETALLES</Text>
                        <View style={pdfStyles.cardContent}>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Fecha:</Text>
                                <Text style={pdfStyles.infoValue}>{new Date(remision.fechaRemision).toLocaleDateString('es-CO')}</Text>
                            </View>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Pedido:</Text>
                                <Text style={pdfStyles.infoValue}>{(pedido.numeroPedido || '').replace('PED-', '')}</Text>
                            </View>
                            <View style={pdfStyles.infoRow}>
                                <Text style={pdfStyles.infoLabel}>Despacho:</Text>
                                <Text style={pdfStyles.infoValue}>
                                    {remision.metodoEnvio === 'transportadoraExterna' ? 'Transp. Externa' :
                                        remision.metodoEnvio === 'transportePropio' ? 'Propio' : 'Recoge'}
                                </Text>
                            </View>
                            {remision.transportadora && (
                                <View style={pdfStyles.infoRow}>
                                    <Text style={pdfStyles.infoLabel}>Transp:</Text>
                                    <Text style={pdfStyles.infoValue}>{remision.transportadora}</Text>
                                </View>
                            )}
                            {remision.numeroGuia && (
                                <View style={pdfStyles.infoRow}>
                                    <Text style={pdfStyles.infoLabel}>Guía:</Text>
                                    <Text style={pdfStyles.infoValue}>{remision.numeroGuia}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                <View style={pdfStyles.tableContainer}>
                    <View style={pdfStyles.tableHeader}>
                        <Text style={[pdfStyles.tableHeaderText, { width: '10%', paddingHorizontal: 2 }]}>Código</Text>
                        <Text style={[pdfStyles.tableHeaderText, { width: '34%', paddingHorizontal: 2 }]}>Descripción</Text>
                        <Text style={[pdfStyles.tableHeaderText, { width: '8%', paddingHorizontal: 2, textAlign: 'right' }]}>Cant.</Text>
                        {safePreferences.showPrices ? (
                            <>
                                <Text style={[pdfStyles.tableHeaderText, { width: '13%', paddingHorizontal: 2, textAlign: 'right' }]}>Precio</Text>
                                <Text style={[pdfStyles.tableHeaderText, { width: '10%', paddingHorizontal: 2, textAlign: 'right' }]}>Desc.</Text>
                                <Text style={[pdfStyles.tableHeaderText, { width: '8%', paddingHorizontal: 2, textAlign: 'right' }]}>IVA</Text>
                                <Text style={[pdfStyles.tableHeaderText, { width: '17%', paddingHorizontal: 2, textAlign: 'right' }]}>Total</Text>
                            </>
                        ) : (
                            <Text style={[pdfStyles.tableHeaderText, { flex: 1 }]}></Text>
                        )}
                    </View>
                    {itemsWithCalculations.map((item, idx) => {
                        const product = productos.find(p =>
                            String(p.id) === String(item.productoId) ||
                            p.id === item.productoId
                        );
                        const productoNombre = product?.nombre || item.descripcion;
                        const referencia = product?.referencia || 'N/A';

                        return (
                            <View key={idx} style={[pdfStyles.tableRow, { backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }]}>
                                <Text style={[pdfStyles.tableCellText, { width: '10%', paddingHorizontal: 2 }]}>{referencia}</Text>
                                <Text style={[pdfStyles.tableCellText, { width: '34%', paddingHorizontal: 2 }]}>{productoNombre}</Text>
                                <Text style={[pdfStyles.tableCellText, { width: '8%', paddingHorizontal: 2, textAlign: 'right' }]}>{item.cantidad}</Text>
                                {safePreferences.showPrices ? (
                                    <>
                                        <Text style={[pdfStyles.tableCellText, { width: '13%', paddingHorizontal: 2, textAlign: 'right' }]}>{formatCurrencySafe(item.precioUnitario)}</Text>
                                        <Text style={[pdfStyles.tableCellText, { width: '10%', paddingHorizontal: 2, textAlign: 'right', color: item.descuentoPorcentaje > 0 ? '#ef4444' : '#334155' }]}>
                                            {item.descuentoPorcentaje > 0 ? `${item.descuentoPorcentaje}%` : '-'}
                                        </Text>
                                        <Text style={[pdfStyles.tableCellText, { width: '8%', paddingHorizontal: 2, textAlign: 'right', color: '#64748b' }]}>
                                            {(item.ivaPorcentaje || 0) > 0 ? `${item.ivaPorcentaje}%` : '0%'}
                                        </Text>
                                        <Text style={[pdfStyles.tableCellText, { width: '17%', paddingHorizontal: 2, textAlign: 'right', fontWeight: 'bold' }]}>{formatCurrencySafe(item.subtotal)}</Text>
                                    </>
                                ) : (
                                    <Text style={[pdfStyles.tableCellText, { flex: 1 }]}></Text>
                                )}
                            </View>
                        );
                    })}
                </View>

                {remision.observaciones ? (
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', marginBottom: 4 }}>OBSERVACIONES</Text>
                        <View style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' }}>
                            <Text style={{ fontSize: 9, color: '#334155' }}>{remision.observaciones}</Text>
                        </View>
                    </View>
                ) : null}

                {safePreferences.showPrices ? (
                    <View style={pdfStyles.totalsSection}>
                        <View style={pdfStyles.totalsCard}>
                            <View style={pdfStyles.totalRow}>
                                <Text style={pdfStyles.totalLabel}>Subtotal Bruto</Text>
                                <Text style={pdfStyles.totalValue}>{formatCurrencySafe(totals.subtotalBruto)}</Text>
                            </View>
                            <View style={pdfStyles.totalRow}>
                                <Text style={[pdfStyles.totalLabel, pdfStyles.textRed]}>Descuentos</Text>
                                <Text style={[pdfStyles.totalValue, pdfStyles.textRed]}>-{formatCurrencySafe(totals.descuentoTotal)}</Text>
                            </View>
                            <View style={[pdfStyles.totalRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#e2e8f0' }]}>
                                <Text style={pdfStyles.totalLabel}>Subtotal Neto</Text>
                                <Text style={pdfStyles.totalValue}>{formatCurrencySafe(totals.subtotalNeto)}</Text>
                            </View>
                            <View style={pdfStyles.totalRow}>
                                <Text style={pdfStyles.totalLabel}>IVA</Text>
                                <Text style={pdfStyles.totalValue}>{formatCurrencySafe(totals.iva)}</Text>
                            </View>
                            <View style={[pdfStyles.finalTotalRow, { backgroundColor: '#0ea5e9' }]}>
                                <Text style={pdfStyles.finalTotalLabel}>TOTAL</Text>
                                <Text style={pdfStyles.finalTotalValue}>{formatCurrencySafe(totals.total)}</Text>
                            </View>
                        </View>
                    </View>
                ) : null}

                {(safePreferences?.signatureType === 'physical' || safePreferences?.signatureType === 'digital') ? (
                    <View style={pdfStyles.footer}>
                        <View style={pdfStyles.signatureBox}>
                            <View style={{ height: 40, justifyContent: 'flex-end', alignItems: 'center', marginBottom: 5 }}>
                                {firmaVendedor && firmaVendedor.length > 5 ? (
                                    <Image src={firmaVendedor} style={{ height: 35, objectFit: 'contain' }} />
                                ) : null}
                            </View>
                            <View style={pdfStyles.signatureLine} />
                            <Text style={pdfStyles.footerText}>ENTREGADO POR</Text>
                            <Text style={pdfStyles.footerSubText}>(Nombre y Firma)</Text>
                        </View>
                        <View style={pdfStyles.signatureBox}>
                            <View style={{ height: 40 }} />
                            <View style={pdfStyles.signatureLine} />
                            <Text style={pdfStyles.footerText}>RECIBIDO A CONFORMIDAD</Text>
                            <Text style={pdfStyles.footerSubText}>(Nombre, Firma, C.C. y Sello)</Text>
                        </View>
                    </View>
                ) : (
                    <View style={[pdfStyles.footer, { justifyContent: 'center', borderTopWidth: 0 }]}>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontSize: 10, color: '#64748b' }}>Documento validado digitalmente.</Text>
                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#334155' }}>ID de Entrega: {remision.id}</Text>
                        </View>
                    </View>
                )}
            </Page>
        </Document>
    );
};

export default RemisionPDFDocument;
