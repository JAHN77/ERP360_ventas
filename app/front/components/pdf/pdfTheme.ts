import { StyleSheet } from '@react-pdf/renderer';

export const pdfStyles = StyleSheet.create({
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
        width: 50,
        height: 50,
        backgroundColor: '#f1f5f9',
        marginRight: 10,
        borderRadius: 4,
    },
    companyInfo: {
        marginLeft: 10,
    },
    companyName: {
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: '#0f172a', // slate-900
        marginBottom: 4,
    },
    companyDetails: {
        fontSize: 9,
        color: '#64748b', // slate-500
        marginBottom: 2,
    },
    documentTitleSection: {
        alignItems: 'flex-end',
    },
    documentBadge: {
        backgroundColor: '#fef2f2', // red-50
        borderColor: '#fee2e2', // red-100 (Default, can be overridden)
        borderWidth: 1,
        borderRadius: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        marginBottom: 4,
    },
    documentTitle: {
        color: '#b91c1c', // red-700 (Default)
        fontSize: 12,
        fontWeight: 'heavy',
        textTransform: 'uppercase',
    },
    documentNumber: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e293b', // slate-800
    },

    // Grid Information
    infoGrid: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 20,
    },
    infoCard: {
        flex: 1,
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
    cardLabelSecondary: {
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
        width: 85,
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
        overflow: 'hidden',
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

    // Column Utilities
    colCode: { width: '15%', paddingHorizontal: 4 },
    colDesc: { width: '35%', paddingHorizontal: 4 },
    colQty: { width: '10%', paddingHorizontal: 4, textAlign: 'right' },
    colPrice: { width: '15%', paddingHorizontal: 4, textAlign: 'right' },
    colDisc: { width: '10%', paddingHorizontal: 4, textAlign: 'right' },
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
        width: '50%',
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
    },

    // Text colors
    textRed: { color: '#ef4444' }
});

export const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
};
