import { StyleSheet } from '@react-pdf/renderer';

export const pdfStyles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'Helvetica',
        fontSize: 9, // Reduced base font size from 10 to 9
        color: '#334155', // slate-700
        backgroundColor: '#FFFFFF',
        lineHeight: 1.4, // Improved line spacing
        letterSpacing: 0.2, // Improved letter spacing
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
        objectFit: 'contain',
    },
    companyInfo: {
        marginLeft: 10,
    },
    companyName: {
        fontSize: 14, // Reduced from 16 to prevent overlapping
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
        width: 180, // Defined space for address
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
        backgroundColor: '#e6f2ff', // blue-50
        borderColor: '#93c5fd', // blue-300
        borderWidth: 1,
        borderRadius: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        marginBottom: 4,
    },
    documentTitle: {
        color: '#1e40af', // blue-800
        fontSize: 12,
        fontWeight: 'heavy',
        textTransform: 'uppercase',
    },
    documentNumber: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e3a8a', // blue-900
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
        backgroundColor: '#1e3a8a', // Nisa Blue (Dark)
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
        backgroundColor: '#64748b', // slate-500
    },
    cardContent: {
        marginTop: 15,
    },
    clientName: {
        fontSize: 8, // Further reduced from 9 to save space
        fontWeight: 'bold',
        color: '#1e3a8a', // Nisa Blue
        marginBottom: 2,
    },
    // New optimized styles for Client Info Card
    clientRow: {
        flexDirection: 'row',
        marginBottom: 1,
    },
    clientLabel: {
        fontSize: 7, // Smaller font for labels
        fontWeight: 'bold',
        color: '#64748b',
        width: 45, // Reduced width (was 55 inline) to give more space to values
    },
    clientValue: {
        fontSize: 7, // Smaller font for values
        color: '#334155',
        flex: 1, // Takes remaining space
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
        color: '#475569',
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
        backgroundColor: '#eff6ff', // blue-50
        borderBottomWidth: 1,
        borderBottomColor: '#bfdbfe', // blue-200
        paddingVertical: 6,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingVertical: 6,
    },

    // Column Utilities - Optimized widths to prevent text wrapping
    colCode: { width: '11%', paddingHorizontal: 2 },
    colDesc: { width: '39%', paddingHorizontal: 2 },
    colQty: { width: '10%', paddingHorizontal: 2, textAlign: 'right' },
    colPrice: { width: '13%', paddingHorizontal: 2, textAlign: 'right' },
    colDisc: { width: '13%', paddingHorizontal: 2, textAlign: 'right' },
    colTotal: { width: '14%', paddingHorizontal: 2, textAlign: 'right', fontWeight: 'bold' },

    tableHeaderText: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#1e40af', // blue-800
    },
    tableCellText: {
        fontSize: 8,
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
        backgroundColor: '#1e3a8a', // Nisa Blue (Dark)
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
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};
