import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register a standard font if you have one, otherwise fallback to Helvetica
// Font.register({ family: 'Open Sans', src: '...' });

const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontFamily: 'Helvetica',
        fontSize: 10, // Restored to 10 for better readability on A4
        color: '#334155', // Slate-700
    },
    // ID Header
    idHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 5,
    },
    companyTitle: {
        fontSize: 14, // Smaller title
        fontWeight: 'bold',
        color: '#1e293b',
        textTransform: 'uppercase',
    },
    docTitle: {
        fontSize: 14, // Smaller doc title
        fontWeight: 'bold',
        color: '#2563eb',
        textTransform: 'uppercase',
    },
    // Two Column Layout
    topSection: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 8, // Much tighter margin
    },
    column: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 4,
        padding: 6, // Reduced padding
        paddingTop: 10,
        position: 'relative',
    },
    // Pill Headers
    pillHeader: {
        position: 'absolute',
        top: -8,
        left: 8,
        backgroundColor: '#0ea5e9',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    pillText: {
        color: '#ffffff',
        fontSize: 7, // Smaller pill text
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    // Info Rows
    infoRow: {
        flexDirection: 'row',
        marginBottom: 2,
    },
    label: {
        width: 60, // Adjusted width
        fontWeight: 'bold',
        color: '#64748b',
    },
    value: {
        flex: 1,
        color: '#334155',
    },

    // Address Block styling
    addressBlock: {
        marginTop: 2,
    },
    addressText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 1,
    },
    subText: {
        fontSize: 8,
        color: '#475569',
        marginBottom: 1,
    },

    // Table
    table: {
        marginTop: 5, // Tighter table margin
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderBottomWidth: 1,
        borderBottomColor: '#cbd5e1',
        paddingVertical: 4, // Slimmer header
        paddingHorizontal: 4,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingVertical: 4, // Slimmer rows
        paddingHorizontal: 4,
        alignItems: 'center',
    },
    th: {
        fontSize: 7, // Smaller headers
        fontWeight: 'bold',
        color: '#475569',
        textTransform: 'uppercase',
    },
    td: {
        fontSize: 8,
        color: '#334155',
    },
    // Columns width (unchanged)
    colRef: { width: '15%' },
    colDesc: { width: '35%' },
    colUnit: { width: '10%', textAlign: 'center' },
    colQty: { width: '10%', textAlign: 'center' },
    colPrice: { width: '15%', textAlign: 'right' },
    colDisc: { width: '10%', textAlign: 'center' },
    colTotal: { width: '15%', textAlign: 'right' },

    // Totals
    totalsSection: {
        marginTop: 5, // Tighter
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    totalsBox: {
        width: 200,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 1, // Tighter total rows
    },
    totalLabel: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#64748b',
    },
    totalValue: {
        fontSize: 8,
        color: '#1e293b',
        textAlign: 'right',
    },
    finalTotal: {
        borderTopWidth: 1,
        borderTopColor: '#cbd5e1',
        marginTop: 2,
        paddingTop: 2,
    },
    finalTotalText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#0ea5e9',
    },

    // Footer
    footer: {
        marginTop: 10, // Much tighter footer margin (was 30)
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 5,
    },
    obsTitle: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#64748b',
        marginBottom: 1,
    },
    obsText: {
        fontSize: 8,
        fontStyle: 'italic',
        color: '#334155',
    },
});

interface OrdenCompraPDFProps {
    data: any;
    empresa?: any;
}

const OrdenCompraPDFDocument: React.FC<OrdenCompraPDFProps> = ({ data, empresa }) => {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return new Date().toLocaleDateString();
        return new Date(dateString).toLocaleDateString();
    };

    // Calculate due date (vencimiento) - fallback to 30 days if not present
    const fechaVencimiento = new Date(data.feccom || new Date());
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* Header ID */}
                <View style={styles.idHeader}>
                    <View>
                        <Text style={styles.companyTitle}>{empresa?.nombre || 'MI EMPRESA'}</Text>
                        <Text style={{ fontSize: 9 }}>NIT: {empresa?.nit || '800.000.000'} - {empresa?.regimen || 'Responsable de IVA'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.docTitle}>ORDEN DE COMPRA</Text>
                        <Text style={{ fontSize: 10, color: '#64748b' }}>#{data.numcom || data.numeroOrden || 'BORRADOR'}</Text>
                    </View>
                </View>

                {/* Two Columns: Provider & Conditions */}
                <View style={styles.topSection}>
                    {/* Provider Column */}
                    <View style={styles.column}>
                        <View style={styles.pillHeader}>
                            <Text style={styles.pillText}>PROVEEDOR</Text>
                        </View>
                        <View style={styles.addressBlock}>
                            <Text style={styles.addressText}>{data.proveedorNombre || 'PROVEEDOR GENERAL'}</Text>
                            <Text style={styles.subText}>{data.proveedorDocumento || ''}</Text>
                            <Text style={styles.subText}>{data.proveedorDireccion || ''}</Text>
                            <Text style={styles.subText}>
                                {data.proveedorTelefono ? `Tel: ${data.proveedorTelefono}` : ''}
                                {data.proveedorEmail ? ` | ${data.proveedorEmail}` : ''}
                            </Text>
                            <Text style={styles.subText}>{data.proveedorCiudad || ''}</Text>
                        </View>
                    </View>

                    {/* Conditions Column */}
                    <View style={styles.column}>
                        <View style={[styles.pillHeader, { backgroundColor: '#475569' }]}>
                            <Text style={styles.pillText}>CONDICIONES</Text>
                        </View>
                        <View style={{ marginTop: 5 }}>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Fecha:</Text>
                                <Text style={styles.value}>{formatDate(data.feccom)}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Vence:</Text>
                                <Text style={styles.value}>{formatDate(fechaVencimiento.toISOString())}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Estado:</Text>
                                <Text style={styles.value}>{data.estcom === 'A' ? 'Aprobada' : 'Pendiente'}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Moneda:</Text>
                                <Text style={styles.value}>COP</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Items Table */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, styles.colRef]}>Referencia</Text>
                        <Text style={[styles.th, styles.colDesc]}>Descripción</Text>
                        <Text style={[styles.th, styles.colUnit]}>Unidad</Text>
                        <Text style={[styles.th, styles.colQty]}>Cant.</Text>
                        <Text style={[styles.th, styles.colPrice]}>P. Unit</Text>
                        <Text style={[styles.th, styles.colDisc]}>% Dcto</Text>
                        <Text style={[styles.th, styles.colTotal]}>Subtotal</Text>
                    </View>

                    {data.items && data.items.map((item: any, index: number) => (
                        <View key={index} style={styles.tableRow}>
                            <Text style={[styles.td, styles.colRef]}>
                                {(item.referencia || item.productoReferencia || item.refins || '').substring(0, 12)}
                            </Text>
                            <Text style={[styles.td, styles.colDesc]}>
                                {(item.descripcion || item.productoNombre || item.nomins || '').substring(0, 35)}
                            </Text>
                            <Text style={[styles.td, styles.colUnit]}>
                                {item.unidadMedida || 'UND'}
                            </Text>
                            <Text style={[styles.td, styles.colQty]}>
                                {item.cantidad || item.cancom || 0}
                            </Text>
                            <Text style={[styles.td, styles.colPrice]}>
                                {formatCurrency(Number(item.precioUnitario) || Number(item.vuncom) || 0)}
                            </Text>
                            <Text style={[styles.td, styles.colDisc, { color: (item.descuentoPorcentaje || item.desins) > 0 ? '#ef4444' : '#94a3b8' }]}>
                                {item.descuentoPorcentaje || item.desins ? `${item.descuentoPorcentaje || item.desins}%` : '0%'}
                            </Text>
                            <Text style={[styles.td, styles.colTotal, { fontWeight: 'bold' }]}>
                                {formatCurrency(
                                    (Number(item.total) || Number(item.netcom)) ||
                                    ((Number(item.cantidad) || Number(item.cancom) || 0) * (Number(item.precioUnitario) || Number(item.vuncom) || 0))
                                )}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Totals & Notes */}
                <View style={styles.totalsSection}>
                    <View style={styles.totalsBox}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Subtotal</Text>
                            <Text style={styles.totalValue}>
                                {formatCurrency(data.valcom || data.subtotal || 0)}
                            </Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Descuentos</Text>
                            <Text style={styles.totalValue}>
                                {formatCurrency(0)} {/* Adjust if discounts are global */}
                            </Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>IVA</Text>
                            <Text style={styles.totalValue}>
                                {formatCurrency(data.ivacom || data.ivaValor || 0)}
                            </Text>
                        </View>
                        <View style={[styles.totalRow, styles.finalTotal]}>
                            <Text style={[styles.totalLabel, { color: '#0ea5e9', fontSize: 11 }]}>TOTAL A PAGAR</Text>
                            <Text style={styles.finalTotalText}>
                                {formatCurrency(data.netcom || data.total || 0)}
                            </Text>
                        </View>
                    </View>
                </View>

                {data.observaciones && (
                    <View style={styles.footer}>
                        <Text style={styles.obsTitle}>OBSERVACIONES:</Text>
                        <Text style={styles.obsText}>{data.observaciones}</Text>
                    </View>
                )}

            </Page>
        </Document>
    );
};

export default OrdenCompraPDFDocument;
