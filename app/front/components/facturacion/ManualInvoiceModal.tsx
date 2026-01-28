import React, { useState, useEffect, useRef } from 'react';
import Modal from '../ui/Modal';
import { useData } from '../../hooks/useData';
import { useNotifications } from '../../hooks/useNotifications';
import { apiClient } from '../../services/apiClient';

interface ManualInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    nextInvoiceNumber: number;
}

const ManualInvoiceModal: React.FC<ManualInvoiceModalProps> = ({ isOpen, onClose, nextInvoiceNumber }) => {
    const { clientes, productos, datosEmpresa, vendedores } = useData();
    const { addNotification } = useNotifications();

    // Form State matching the JSON structure
    const [formData, setFormData] = useState({
        number: '',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        paymentFormId: '1', // 1=Contado, 2=Credito
        paymentMethodId: '10', // 10=Efectivo default
        seller: '',
        orderNumber: '',
        customer: {
            identification_number: '',
            name: '',
            address: '',
            phone: '',
            email: '',
            type_document_id: '31', // NIT
            type_liability_id: '1',
            type_regime_id: '1',
            merchant_registration: 'No tiene',
            id_location: '08001', // Barranquilla default
            dv: ''
        },
        notes: '',
        lines: [] as any[]
    });

    const [jsonPreview, setJsonPreview] = useState<string | null>(null);
    const [localClientes, setLocalClientes] = useState<any[]>([]);
    const [localProductos, setLocalProductos] = useState<any[]>([]);
    const [localVendedores, setLocalVendedores] = useState<any[]>([]);
    const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(null);
    const [rowResults, setRowResults] = useState<any[]>([]);
    const tableRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (tableRef.current && !tableRef.current.contains(event.target as Node)) {
                setActiveSearchIdx(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Initialize number when modal opens or nextInvoiceNumber changes
    useEffect(() => {
        if (isOpen && nextInvoiceNumber) {
            setFormData(prev => ({ ...prev, number: nextInvoiceNumber.toString() }));
        }
    }, [isOpen, nextInvoiceNumber]);

    const isOrquidea = datosEmpresa?.nombre?.toLowerCase().includes('orquidea');

    // Fallback vendors for Orquidea if API fails
    const ORQUIDEA_VENDORS = [
        { id: '1', codigo: '001', nombre: 'LUIS FERNANDO GARZON' },
        { id: '2', codigo: '002', nombre: 'EMMANUEL MONROY ZABALA' }
    ];

    useEffect(() => {
        if (clientes.length > 0) setLocalClientes(clientes);
        if (productos.length > 0) setLocalProductos(productos);
        if (vendedores.length > 0) setLocalVendedores(vendedores);

        const fetchData = async () => {
            if (clientes.length === 0) {
                try {
                    const c = await apiClient.getClientes();
                    if (c && Array.isArray(c)) setLocalClientes(c);
                    else if (c && c.data && Array.isArray(c.data)) setLocalClientes(c.data);
                } catch (e) { console.error(e); }
            }
            if (productos.length === 0) {
                try {
                    const p = await apiClient.getProductos();
                    if (p && Array.isArray(p)) setLocalProductos(p);
                    else if (p && p.data && Array.isArray(p.data)) setLocalProductos(p.data);
                } catch (e) { console.error(e); }
            }

            // Always try to fetch vendors if local is empty, even if context is empty
            if (localVendedores.length === 0 && vendedores.length === 0) {
                try {
                    console.log('Fetching vendedores manually...');
                    const v = await apiClient.getVendedores();
                    console.log('Vendedores response:', v);
                    if (v && v.success && Array.isArray(v.data) && v.data.length > 0) {
                        setLocalVendedores(v.data);
                    } else if (v && Array.isArray(v) && v.length > 0) {
                        setLocalVendedores(v);
                    } else if (isOrquidea) {
                        console.warn('Using fallback vendors for Orquidea');
                        setLocalVendedores(ORQUIDEA_VENDORS);
                    }
                } catch (e) {
                    console.error('Error fetching vendedores:', e);
                    if (isOrquidea) {
                        console.warn('Using fallback vendors for Orquidea (after error)');
                        setLocalVendedores(ORQUIDEA_VENDORS);
                    }
                }
            } else if (localVendedores.length === 0 && isOrquidea && vendedores.length === 0) {
                // If we didn't even try to fetch because of some logic gap, force fallback
                setLocalVendedores(ORQUIDEA_VENDORS);
            }
        };
        fetchData();
    }, [clientes, productos, vendedores, localVendedores.length, isOrquidea]);

    const activeClientes = localClientes.length > 0 ? localClientes : clientes;
    const activeProductos = localProductos.length > 0 ? localProductos : productos;
    const activeVendedores = localVendedores.length > 0 ? localVendedores : vendedores;

    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [newLine, setNewLine] = useState({
        code: '',
        description: '',
        quantity: 1,
        price_amount: 0,
        unit_measure_id: '70', // Unidad default
        unit_display: 'UNIDAD',
        tax_percent: 19,
        discount_percent: 0
    });

    // Load existing client data
    const handleClientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const clientId = e.target.value;
        setSelectedClientId(clientId);
        const client = activeClientes.find(c => String(c.id) === clientId);
        if (client) {
            let nit = client.numeroDocumento || '';
            let dv = client.digitoVerificacion || '';

            // Check if NIT contains hyphen and split if needed
            if (nit.includes('-')) {
                const parts = nit.split('-');
                nit = parts[0];
                dv = parts[1];
            }

            setFormData(prev => ({
                ...prev,
                customer: {
                    ...prev.customer,
                    identification_number: nit,
                    name: client.razonSocial || `${client.primerNombre} ${client.primerApellido}`.trim(),
                    address: client.direccion || '',
                    phone: client.celular || client.telefono || '',
                    email: client.email || '',
                    dv: dv
                }
            }));
        }
    };

    // Load existing product data for new line
    const handleProductSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const prodId = e.target.value;
        setSelectedProductId(prodId);
        const prod = activeProductos.find(p => String(p.id) === prodId);
        if (prod) {
            // Use precioPublico, ultimoCosto, or 0 as fallback
            const price = prod.precioPublico || prod.ultimoCosto || 0;
            setNewLine(prev => ({
                ...prev,
                code: prod.codigo || '',
                description: prod.nombre || '',
                price_amount: price,
                unit_measure_id: prod.unidadMedidaCodigo || '003', // Use numeric code
                unit_display: prod.unidadMedidaNombre || 'UNIDAD',
                tax_percent: prod.impuesto || 19,
                discount_percent: 0
            }));
        }
    };

    const addLine = () => {
        setFormData(prev => ({
            ...prev,
            lines: [...prev.lines, { ...newLine }]
        }));
        // Reset new line
        setNewLine({
            code: '',
            description: '',
            quantity: 1,
            price_amount: 0,
            unit_measure_id: '70',
            unit_display: 'UNIDAD',
            tax_percent: 19,
            discount_percent: 0
        });
        setSelectedProductId('');
    };

    const removeLine = (index: number) => {
        setFormData(prev => ({
            ...prev,
            lines: prev.lines.filter((_, i) => i !== index)
        }));
    };

    const handleUpdateLine = (index: number, field: string, value: any) => {
        const newLines = [...formData.lines];
        newLines[index] = { ...newLines[index], [field]: value };
        setFormData(prev => ({ ...prev, lines: newLines }));
    };

    const handleRowProductSearch = async (idx: number, query: string) => {
        handleUpdateLine(idx, 'description', query);
        setActiveSearchIdx(idx);
        if (query.length < 2) {
            setRowResults([]);
            return;
        }
        try {
            const resp = await apiClient.searchServices(query, 10);
            if (resp.success && resp.data) {
                setRowResults(resp.data as any[]);
            }
        } catch (e) { console.error(e); }
    };

    const handleRowProductSelect = (idx: number, p: any) => {
        const newLines = [...formData.lines];
        newLines[idx] = {
            ...newLines[idx],
            code: p.codigo || p.codins || 'N/A',
            description: p.nombre || p.nomser || '',
            price_amount: Number(p.ultimoCosto || p.valser || 0),
            unit_measure_id: p.unidadMedidaCodigo || '003',
            unit_display: p.unidadMedidaNombre || 'UNIDAD',
            tax_percent: Number(p.tasaIva || 19)
        };
        setFormData(prev => ({ ...prev, lines: newLines }));
        setActiveSearchIdx(null);
        setRowResults([]);
    };

    const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

    const calculateTotals = () => {
        const result = formData.lines.reduce((acc, line) => {
            const subtotal = line.price_amount * line.quantity;
            const discountAmount = subtotal * (line.discount_percent / 100);
            const taxBase = subtotal - discountAmount;
            const taxAmount = taxBase * (line.tax_percent / 100);

            return {
                lineExtensionAmount: round(acc.lineExtensionAmount + subtotal), // Gross subtotal
                discountAmount: round(acc.discountAmount + discountAmount),
                taxBase: round(acc.taxBase + taxBase),
                taxAmount: round(acc.taxAmount + taxAmount)
            };
        }, { lineExtensionAmount: 0, discountAmount: 0, taxBase: 0, taxAmount: 0 });

        return {
            ...result,
            payableAmount: round(result.taxBase + result.taxAmount)
        };
    };

    const totals = calculateTotals();

    const [previewMode, setPreviewMode] = useState<'json' | 'db' | null>(null);

    const handleGenerateJson = () => {
        // Construct the JSON payload matching the user's example
        const payload = {
            number: parseInt(formData.number) || 0,
            legal_monetary_totals: {
                tax_inclusive_amount: totals.payableAmount,
                line_extension_amount: totals.lineExtensionAmount,
                charge_total_amount: 0,
                tax_exclusive_amount: totals.taxBase,
                payable_amount: totals.payableAmount,
                allowance_total_amount: totals.discountAmount
            },
            identification_number: 901994818, // Fixed Orquidea NIT
            payment_forms: [
                {
                    payment_method_id: formData.paymentFormId === '2' ? 44 : parseInt(formData.paymentMethodId),
                    duration_measure: "0",
                    payment_due_date: formData.dueDate,
                    payment_form_id: parseInt(formData.paymentFormId) || 1
                }
            ],
            tax_totals: [
                {
                    tax_amount: totals.taxAmount,
                    taxable_amount: totals.taxBase,
                    percent: 19,
                    tax_id: 1
                }
            ],
            resolution_id: 101,
            sync: true,
            notes: formData.notes || "sin ob",
            type_document_id: 1,
            invoice_lines: formData.lines.map(line => {
                const lineGross = line.price_amount * line.quantity;
                const lineDiscount = lineGross * (line.discount_percent / 100);
                const lineNet = lineGross - lineDiscount;
                const taxAmt = lineNet * (line.tax_percent / 100);

                return {
                    base_quantity: line.quantity,
                    code: line.code,
                    tax_totals: [
                        {
                            tax_amount: round(taxAmt),
                            taxable_amount: round(lineNet),
                            percent: line.tax_percent,
                            tax_id: 1
                        }
                    ],
                    free_of_charge_indicator: false,
                    line_extension_amount: round(lineNet),
                    allowance_charges: line.discount_percent > 0 ? [{
                        charge_indicator: false,
                        allowance_charge_reason: "Descuento comercial",
                        amount: round(lineDiscount),
                        base_amount: round(lineGross)
                    }] : undefined,
                    type_item_identification_id: 4,
                    unit_measure_id: (() => {
                        const code = String(line.unit_measure_id || '').trim();
                        if (code === '001') return 730; // HORA
                        if (code === '002') return 606; // DIA
                        return 70; // UNIDAD / Default
                    })(),
                    unit_measure: (() => {
                        const code = String(line.unit_measure_id || '').trim();
                        if (code === '001') return 'hora';
                        if (code === '002') return 'día';
                        return 'unidad';
                    })(),
                    description: line.description,
                    price_amount: round(line.price_amount),
                    invoiced_quantity: line.quantity
                };
            }),
            customer: {
                type_liability_id: parseInt(formData.customer.type_liability_id) || 1,
                dv: formData.customer.dv,
                address: formData.customer.address,
                identification_number: parseInt(formData.customer.identification_number),
                phone: formData.customer.phone,
                merchant_registration: formData.customer.merchant_registration || "No tiene",
                type_regime_id: parseInt(formData.customer.type_regime_id) || 1,
                name: formData.customer.name,
                id_location: formData.customer.id_location || "08001",
                type_document_id: formData.customer.type_document_id || "31",
                tax_detail_id: 1,
                email: formData.customer.email
            }
        };

        setJsonPreview(JSON.stringify(payload, null, 2));
        setPreviewMode('json');
    };

    const handleGenerateDbPreview = () => {
        const formatDate = (dateStr: string) => `${dateStr} 00:00:00.000`;
        const now = new Date();
        const formatDateTime = (date: Date) => {
            const pad = (n: number) => n.toString().padStart(2, '0');
            const pad3 = (n: number) => n.toString().padStart(3, '0');
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad3(date.getMilliseconds())}`;
        };

        const total = totals.payableAmount;
        const efectivo = formData.paymentMethodId === '10' ? total : 0;
        const credito = formData.paymentMethodId === '30' ? total : 0;
        const transferencia = formData.paymentMethodId === '31' ? total : 0; // Transferencia Débito

        // Construct INSERT based on user's schema
        const headerSql = `INSERT INTO ven_facturas (
    codalm, numfact, tipfac, codter, doccoc, fecfac, venfac, codven, 
    valvta, valiva, valotr, valant, valdev, abofac, valdcto, valret, valrica, valriva, 
    netfac, valcosto, codcue, efectivo, cheques, credito, tarjetacr, TarjetaDB, Transferencia, 
    valpagado, resolucion_dian, Observa, TARIFA_CREE, RETECREE, codusu, fecsys, estfac, 
    VALDOMICILIO, CUFE, sey_key, estado_envio, placa, lugar_entrega, numped, tarjeta, vales, 
    IdCaja, afecta_inventario, Valnotas
) VALUES (
    '001', '${formData.number}', 'FV', '${selectedClientId || formData.customer.identification_number}', '1', '${formatDate(formData.date)}', '${formatDate(formData.dueDate)}', '${formData.seller || '001'}',
    ${totals.lineExtensionAmount.toFixed(2)}, ${totals.taxAmount.toFixed(2)}, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
    ${totals.payableAmount.toFixed(2)}, 0.00, '13050501', ${efectivo.toFixed(2)}, 0.00, ${credito.toFixed(2)}, 0.00, 0.00, ${transferencia.toFixed(2)},
    ${totals.payableAmount.toFixed(2)}, '02', '${formData.lines.map(l => l.description).join(', ').substring(0, 100) || 'Factura Manual'}', 0.0000, 0, 'ADMIN', '${formatDateTime(now)}', '1',
    0.00, NULL, NULL, 0, NULL, NULL, NULL, 0.00, 0.00,
    1, 1, 0.00
);`;

        const detailsSql = formData.lines.map(line => {
            const totalLine = round(line.price_amount * line.quantity);
            return `INSERT INTO ven_detafact (
    factura_numero, producto_codigo, descripcion,
    cantidad, precio_unitario, total_linea
) VALUES (
    '${formData.number}', '${line.code}', '${line.description}',
    ${line.quantity}, ${line.price_amount.toFixed(2)}, ${totalLine.toFixed(2)}
);`;
        }).join('\n');

        setJsonPreview(`${headerSql}\n\n-- Detalle (ven_detafact structure assumed as previous, please confirm if changed)\n${detailsSql}`);
        setPreviewMode('db');
    };

    const copyToClipboard = () => {
        if (jsonPreview) {
            navigator.clipboard.writeText(jsonPreview);
            addNotification({ message: 'Copiado al portapapeles', type: 'success' });
        }
    };

    const [isSending, setIsSending] = useState(false);

    const handleSendAndSave = async () => {
        if (!confirm('¿Está seguro de enviar esta factura a la DIAN y guardarla en la base de datos?')) return;

        setIsSending(true);
        try {
            // 1. Generate JSON Payload
            const payload = {
                number: parseInt(formData.number) || 0,
                legal_monetary_totals: {
                    tax_inclusive_amount: totals.payableAmount,
                    line_extension_amount: totals.lineExtensionAmount,
                    charge_total_amount: 0,
                    tax_exclusive_amount: totals.taxBase,
                    payable_amount: totals.payableAmount,
                    allowance_total_amount: totals.discountAmount
                },
                identification_number: 901994818, // Fixed Orquidea NIT
                payment_forms: [
                    {
                        payment_method_id: formData.paymentFormId === '2' ? 44 : parseInt(formData.paymentMethodId),
                        duration_measure: "0",
                        payment_due_date: formData.dueDate,
                        payment_form_id: parseInt(formData.paymentFormId) || 1
                    }
                ],
                tax_totals: [
                    {
                        tax_amount: totals.taxAmount,
                        taxable_amount: totals.taxBase,
                        percent: 19,
                        tax_id: 1
                    }
                ],
                resolution_id: 101,
                sync: true,
                notes: formData.notes || "sin ob",
                type_document_id: 1,
                invoice_lines: formData.lines.map(line => {
                    const lineGross = line.price_amount * line.quantity;
                    const lineDiscount = lineGross * (line.discount_percent / 100);
                    const lineNet = lineGross - lineDiscount;
                    const taxAmt = lineNet * (line.tax_percent / 100);

                    return {
                        base_quantity: line.quantity,
                        code: line.code,
                        tax_totals: [
                            {
                                tax_amount: round(taxAmt),
                                taxable_amount: round(lineNet),
                                percent: line.tax_percent,
                                tax_id: 1
                            }
                        ],
                        free_of_charge_indicator: false,
                        line_extension_amount: round(lineNet),
                        allowance_charges: line.discount_percent > 0 ? [{
                            charge_indicator: false,
                            allowance_charge_reason: "Descuento",
                            amount: round(lineDiscount),
                            base_amount: round(lineGross)
                        }] : undefined,
                        type_item_identification_id: 4,
                        unit_measure_id: (() => {
                            const code = String(line.unit_measure_id || '').trim();
                            if (code === '001') return 730; // HORA
                            if (code === '002') return 606; // DIA
                            return 70; // UNIDAD / Default
                        })(),
                        description: line.description,
                        price_amount: round(line.price_amount),
                        invoiced_quantity: line.quantity
                    };
                }),
                customer: {
                    type_liability_id: parseInt(formData.customer.type_liability_id) || 1,
                    dv: formData.customer.dv,
                    address: formData.customer.address,
                    identification_number: parseInt(formData.customer.identification_number),
                    phone: formData.customer.phone,
                    merchant_registration: formData.customer.merchant_registration || "No tiene",
                    type_regime_id: parseInt(formData.customer.type_regime_id) || 1,
                    name: formData.customer.name,
                    id_location: formData.customer.id_location || "08001",
                    type_document_id: formData.customer.type_document_id || "31",
                    tax_detail_id: 1,
                    email: formData.customer.email
                }
            };

            // 2. Send to DIAN via Backend
            const dianResponse = await apiClient.sendManualDianTest(payload);

            if (!dianResponse.success) {
                throw new Error(dianResponse.message || 'Error enviando a DIAN');
            }

            const cufe = (dianResponse as any).dianResult?.cufe || (dianResponse as any).dianResult?.uuid || (dianResponse.data as any)?.cufe || 'CUFE_PENDIENTE_TEST';
            addNotification({ message: `Factura enviada a DIAN. CUFE: ${cufe.substring(0, 10)}...`, type: 'success' });

            // 3. Generate SQL with real CUFE and Execute
            const isOrquidea = datosEmpresa?.nombre?.toLowerCase().includes('orquidea');

            let sqlQuery = '';
            const formatDate = (dateStr: string) => `${dateStr} 00:00:00.000`;
            const now = new Date();
            const formatDateTime = (date: Date) => {
                const pad = (n: number) => n.toString().padStart(2, '0');
                const pad3 = (n: number) => n.toString().padStart(3, '0');
                return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad3(date.getMilliseconds())}`;
            };

            const total = totals.payableAmount;
            const efectivo = formData.paymentMethodId === '10' ? total : 0;
            const credito = formData.paymentMethodId === '30' ? total : 0;
            const transferencia = formData.paymentMethodId === '31' ? total : 0;

            if (isOrquidea) {
                const codterFormatted = `${formData.customer.identification_number}-${formData.customer.dv}`;
                const headerSql = `
DECLARE @NewId INT;
IF EXISTS (SELECT 1 FROM ven_facturas WHERE numfact = '${formData.number}' AND tipfac = 'FV')
BEGIN
    SELECT @NewId = ID FROM ven_facturas WHERE numfact = '${formData.number}' AND tipfac = 'FV';
    UPDATE ven_facturas SET
        codter = '${codterFormatted}',
        doccoc = '${formData.number}',
        fecfac = '${formatDate(formData.date)}',
        venfac = '${formatDate(formData.dueDate)}',
        codven = '${formData.seller || '001'}',
        valvta = ${totals.lineExtensionAmount.toFixed(2)},
        valiva = ${totals.taxAmount.toFixed(2)},
        netfac = ${totals.payableAmount.toFixed(2)},
        efectivo = ${efectivo.toFixed(2)},
        credito = ${credito.toFixed(2)},
        Transferencia = ${transferencia.toFixed(2)},
        valpagado = ${totals.payableAmount.toFixed(2)},
        Observa = '${formData.lines.map(l => l.description).join(', ').substring(0, 100) || 'Factura Manual'}',
        CUFE = '${cufe}',
        estado_envio = 1
    WHERE ID = @NewId;

    -- Limpiar detalles anteriores (por ID o por número/tipo para mayor seguridad)
    DELETE FROM ven_detafact WHERE id_factura = @NewId OR (numfac = '${formData.number}' AND tipfact = 'FV');
END
ELSE
BEGIN
    INSERT INTO ven_facturas (
        codalm, numfact, tipfac, codter, doccoc, fecfac, venfac, codven, 
        valvta, valiva, valotr, valant, valdev, abofac, valdcto, valret, valrica, valriva, 
        netfac, valcosto, codcue, efectivo, cheques, credito, tarjetacr, TarjetaDB, Transferencia, 
        valpagado, resolucion_dian, Observa, TARIFA_CREE, RETECREE, codusu, fecsys, estfac, 
        VALDOMICILIO, CUFE, sey_key, estado_envio, placa, lugar_entrega, numped, tarjeta, vales, 
        IdCaja, afecta_inventario, Valnotas
    ) VALUES (
        '001', '${formData.number}', 'FV', '${codterFormatted}', '${formData.number}', '${formatDate(formData.date)}', '${formatDate(formData.dueDate)}', '${formData.seller || '001'}',
        ${totals.lineExtensionAmount.toFixed(2)}, ${totals.taxAmount.toFixed(2)}, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
        ${totals.payableAmount.toFixed(2)}, 0.00, '13050501', ${efectivo.toFixed(2)}, 0.00, ${credito.toFixed(2)}, 0.00, 0.00, ${transferencia.toFixed(2)},
        ${totals.payableAmount.toFixed(2)}, '02', '${formData.lines.map(l => l.description).join(', ').substring(0, 100) || 'Factura Manual'}', 0.0000, 0, 'ADMIN', '${formatDateTime(now)}', '1',
        0.00, '${cufe}', NULL, 1, NULL, NULL, NULL, 0.00, 0.00,
        1, 1, 0.00
    );
    SET @NewId = SCOPE_IDENTITY();
END`;
                const detailsSql = formData.lines.map(line => {
                    const subtotalLine = line.price_amount * line.quantity;
                    const discountAmount = subtotalLine * (line.discount_percent / 100);
                    const taxBase = subtotalLine - discountAmount;
                    const ivaLine = taxBase * (line.tax_percent / 100);

                    return `INSERT INTO ven_detafact (
    codalm, numfac, tipfact, codins, observa,
    qtyins, valins, PRECIOUND, PRECIO_LISTA,
    ivains, valdescuento, EXCEDENTE, id_factura
) VALUES (
    '001', '${formData.number}', 'FV', '${line.code}', '${line.description.substring(0, 50)}',
    ${line.quantity}, ${line.price_amount.toFixed(2)}, ${line.price_amount.toFixed(2)}, ${line.price_amount.toFixed(2)},
    ${ivaLine.toFixed(2)}, ${discountAmount.toFixed(2)}, 0, @NewId
);`;
                }).join('\n');
                sqlQuery = `${headerSql}\n${detailsSql}`;
            } else {
                // Generic Fallback
                const headerSql = `INSERT INTO ven_facturas (
    numero_factura, fecha_emision, fecha_vencimiento, 
    cliente_id, vendedor, total_bruto, total_impuesto, total_neto,
    estado, sincronizado_dian, cufe
) VALUES (
    '${formData.number}', '${formData.date}', '${formData.dueDate}',
    '${selectedClientId || formData.customer.identification_number}', '${formData.seller}', 
    ${totals.lineExtensionAmount}, ${totals.taxAmount}, ${totals.payableAmount},
    'A', 1, '${cufe}'
);`;
                const detailsSql = formData.lines.map(line => {
                    const total = line.price_amount * line.quantity;
                    return `INSERT INTO ven_detafact (
    factura_numero, producto_codigo, descripcion,
    cantidad, precio_unitario, total_linea
) VALUES (
    '${formData.number}', '${line.code}', '${line.description}',
    ${line.quantity}, ${line.price_amount}, ${total}
);`;
                }).join('\n');
                sqlQuery = `${headerSql}\n${detailsSql}`;
            }

            // 4. Execute SQL
            const saveResponse = await apiClient.executeQuery(sqlQuery);
            if (!saveResponse.success) {
                throw new Error('Factura enviada a DIAN pero falló guardado en DB: ' + saveResponse.message);
            }

            addNotification({ message: 'Factura guardada exitosamente en DB', type: 'success' });
            onClose();

        } catch (error: any) {
            console.error(error);
            addNotification({ message: error.message || 'Error en el proceso', type: 'error' });
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Nueva Factura Manual ${isOrquidea ? '(Orquidea)' : ''}`} maxWidth="max-w-6xl">
            <div className="space-y-8 p-8 bg-white dark:bg-slate-800 rounded-lg">

                {/* Header Section */}
                <div className="bg-slate-50 dark:bg-slate-700/30 p-6 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-slate-600 pb-2">Información General</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Número Factura</label>
                            <input
                                type="number"
                                className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                                value={formData.number}
                                onChange={e => setFormData({ ...formData, number: e.target.value })}
                                placeholder="Ej: 5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Fecha Emisión</label>
                            <input type="date" className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Fecha Vencimiento</label>
                            <input type="date" className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Forma de Pago</label>
                            <select
                                className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm appearance-none"
                                value={formData.paymentFormId}
                                onChange={e => {
                                    const val = e.target.value;
                                    setFormData(prev => ({
                                        ...prev,
                                        paymentFormId: val,
                                        paymentMethodId: val === '2' ? '30' : prev.paymentMethodId
                                    }));
                                }}
                            >
                                <option value="1">Contado</option>
                                <option value="2">Crédito</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Medio de Pago</label>
                            <select
                                className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm appearance-none"
                                value={formData.paymentMethodId}
                                onChange={e => setFormData({ ...formData, paymentMethodId: e.target.value })}
                            >
                                {formData.paymentFormId === '1' ? (
                                    <>
                                        <option value="10">Efectivo</option>
                                        <option value="31">Transferencia Débito</option>
                                    </>
                                ) : (
                                    <option value="30">Crédito</option>
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Vendedor</label>
                            <select
                                className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm appearance-none"
                                value={formData.seller}
                                onChange={e => setFormData({ ...formData, seller: e.target.value })}
                            >
                                <option value="">-- SELEC. VENDEDOR --</option>
                                {activeVendedores.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {v.nombre || v.nombreCompleto || v.nomven || v.codigo || v.codigoVendedor || v.id}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Observaciones / Notas (Saldrán en la factura)</label>
                            <textarea
                                className="w-full h-16 border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm resize-none"
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Escriba aquí notas u observaciones que deban aparecer en el documento impreso..."
                            />
                        </div>
                    </div>
                </div>

                {/* Customer Section */}
                <div className="bg-slate-50 dark:bg-slate-700/30 p-6 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-slate-600 pb-2">Datos del Cliente</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="col-span-1 md:col-span-3">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Buscar Cliente Existente</label>
                            <select className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm appearance-none" value={selectedClientId} onChange={handleClientSelect}>
                                <option value="">-- SELECCIONAR CLIENTE --</option>
                                {activeClientes.map(c => (
                                    <option key={c.id} value={c.id}>{c.razonSocial || `${c.primerNombre} ${c.primerApellido}`} - {c.numeroDocumento}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nombre / Razón Social</label>
                            <input type="text" className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm" value={formData.customer.name} onChange={e => setFormData({ ...formData, customer: { ...formData.customer, name: e.target.value } })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Identificación (NIT/CC)</label>
                            <input type="text" className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm" value={formData.customer.identification_number} onChange={e => setFormData({ ...formData, customer: { ...formData.customer, identification_number: e.target.value } })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">DV</label>
                            <input type="text" className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm" value={formData.customer.dv} onChange={e => setFormData({ ...formData, customer: { ...formData.customer, dv: e.target.value } })} />
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Dirección</label>
                            <input type="text" className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm" value={formData.customer.address} onChange={e => setFormData({ ...formData, customer: { ...formData.customer, address: e.target.value } })} />
                        </div>
                        <div className="col-span-1 md:col-span-3">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Email</label>
                            <input type="email" className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm" value={formData.customer.email} onChange={e => setFormData({ ...formData, customer: { ...formData.customer, email: e.target.value } })} />
                        </div>
                    </div>
                </div>

                {/* Items Section */}
                <div className="bg-slate-50 dark:bg-slate-700/30 p-6 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-slate-600 pb-2">Items de Factura</h3>

                    {/* Add Item Form */}
                    <div className="mb-6 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Añadir Productos</h4>
                        <div className="grid grid-cols-12 gap-4 items-end">
                            {/* Producto - Takes more space */}
                            <div className="col-span-12 md:col-span-6 lg:col-span-4 xl:col-span-3">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Producto / Servicio</label>
                                <select
                                    className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg text-sm bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm appearance-none"
                                    value={selectedProductId}
                                    onChange={handleProductSelect}
                                >
                                    <option value="">Buscar por nombre...</option>
                                    {activeProductos.map(p => (
                                        <option key={p.id} value={p.id}>{p.codigo} - {p.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Unidad */}
                            <div className="col-span-6 md:col-span-2 lg:col-span-2 xl:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Unidad</label>
                                <input
                                    type="text"
                                    className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 text-slate-500 cursor-not-allowed text-center font-medium"
                                    value={newLine.unit_display || 'UNIDAD'}
                                    readOnly
                                />
                            </div>

                            {/* Cantidad */}
                            <div className="col-span-6 md:col-span-2 lg:col-span-2 xl:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Cantidad</label>
                                <input
                                    type="number"
                                    className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg text-sm bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-center font-bold"
                                    value={newLine.quantity}
                                    onChange={e => setNewLine({ ...newLine, quantity: Number(e.target.value) })}
                                />
                            </div>

                            {/* Precio */}
                            <div className="col-span-6 md:col-span-2 lg:col-span-2 xl:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Vr. Unit.</label>
                                <input
                                    type="number"
                                    className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg text-sm bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-right font-medium"
                                    value={newLine.price_amount}
                                    onChange={e => setNewLine({ ...newLine, price_amount: Number(e.target.value) })}
                                />
                            </div>

                            {/* IVA */}
                            <div className="col-span-6 md:col-span-2 lg:col-span-1 xl:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">% Iva</label>
                                <input
                                    type="number"
                                    className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-center font-medium"
                                    value={newLine.tax_percent}
                                    onChange={e => setNewLine({ ...newLine, tax_percent: Number(e.target.value) })}
                                />
                            </div>

                            {/* Descuento */}
                            <div className="col-span-6 md:col-span-2 lg:col-span-1 xl:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">% Descto</label>
                                <input
                                    type="number"
                                    className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg text-sm bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-center font-medium"
                                    value={newLine.discount_percent}
                                    onChange={e => setNewLine({ ...newLine, discount_percent: Number(e.target.value) })}
                                />
                            </div>

                            {/* Totales */}
                            <div className="col-span-12 md:col-span-3 lg:col-span-2 xl:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Subtotal</label>
                                <div className="w-full h-10 border border-slate-300 dark:border-slate-600 px-3 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 flex items-center justify-end font-bold text-slate-700 dark:text-slate-200">
                                    ${((newLine.price_amount * newLine.quantity) * (1 - newLine.discount_percent / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>

                            {/* Botón Añadir */}
                            <div className="col-span-12 md:col-span-3 lg:col-span-2 xl:col-span-1">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        addLine();
                                    }}
                                    className={`w-full h-10 rounded-lg transition-all shadow-sm flex items-center justify-center font-bold text-sm transform active:scale-95 ${!newLine.description ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-500 hover:bg-slate-600 text-white'}`}
                                    disabled={!newLine.description}
                                >
                                    + Añadir
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div ref={tableRef} className="rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
                        <table className="w-full text-sm border-collapse bg-white dark:bg-slate-800">
                            <thead>
                                <tr className="bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 uppercase text-xs tracking-wider">
                                    <th className="p-3 text-left font-bold border-b border-slate-200 dark:border-slate-600">Referencia</th>
                                    <th className="p-3 text-left font-bold border-b border-slate-200 dark:border-slate-600">Producto</th>
                                    <th className="p-3 text-center font-bold border-b border-slate-200 dark:border-slate-600">Unidad</th>
                                    <th className="p-3 text-center font-bold border-b border-slate-200 dark:border-slate-600">Cant.</th>
                                    <th className="p-3 text-right font-bold border-b border-slate-200 dark:border-slate-600">Precio</th>
                                    <th className="p-3 text-center font-bold border-b border-slate-200 dark:border-slate-600">Desc. %</th>
                                    <th className="p-3 text-center font-bold border-b border-slate-200 dark:border-slate-600">IVA %</th>
                                    <th className="p-3 text-right font-bold border-b border-slate-200 dark:border-slate-600">Total</th>
                                    <th className="p-3 text-center border-b border-slate-200 dark:border-slate-600">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {formData.lines.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-slate-400 italic bg-slate-50/50 dark:bg-slate-800/50">
                                            <div className="flex flex-col items-center gap-2">
                                                <i className="fas fa-box-open text-2xl mb-1"></i>
                                                <span>No hay items agregados a la factura</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    formData.lines.map((line, idx) => {
                                        const lineSubtotal = line.price_amount * line.quantity;
                                        const lineDiscount = lineSubtotal * (line.discount_percent / 100);
                                        const totalLine = lineSubtotal - lineDiscount; // NEW: Excludes IVA in table

                                        return (
                                            <tr key={idx} className="border-b border-slate-100 dark:border-slate-700 hover:bg-blue-50/50 dark:hover:bg-slate-700/30 transition-colors last:border-0">
                                                <td className="p-3 font-mono text-slate-500 dark:text-slate-400 text-[10px]">{line.code}</td>
                                                <td className="p-3 relative">
                                                    <input
                                                        type="text"
                                                        value={line.description}
                                                        onChange={e => handleRowProductSearch(idx, e.target.value)}
                                                        onFocus={() => setActiveSearchIdx(idx)}
                                                        placeholder="Buscar servicio..."
                                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none transition-all"
                                                    />
                                                    {activeSearchIdx === idx && rowResults.length > 0 && (
                                                        <div className="absolute z-[100] left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-xl max-h-48 overflow-y-auto">
                                                            {rowResults.map(p => (
                                                                <div key={p.id} onClick={() => handleRowProductSelect(idx, p)} className="px-3 py-2.5 hover:bg-blue-500 hover:text-white cursor-pointer text-xs border-b last:border-0 border-slate-200 dark:border-slate-700">
                                                                    <div className="font-bold">{p.nombre || p.nomser}</div>
                                                                    <div className="opacity-70 text-[10px]">{p.referencia || p.codigo || p.codser} - ${Number(p.ultimoCosto || p.valser || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] px-2 py-1 rounded-full font-bold">
                                                        {line.unit_display || 'UNIDAD'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="number"
                                                        value={line.quantity}
                                                        onChange={e => handleUpdateLine(idx, 'quantity', Number(e.target.value))}
                                                        className="w-20 text-center bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1 py-1 text-sm font-bold focus:border-blue-500 outline-none"
                                                    />
                                                </td>
                                                <td className="p-3 text-right">
                                                    <input
                                                        type="number"
                                                        value={line.price_amount}
                                                        onChange={e => handleUpdateLine(idx, 'price_amount', Number(e.target.value))}
                                                        className="w-28 text-right bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none"
                                                    />
                                                </td>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="number"
                                                        value={line.discount_percent}
                                                        onChange={e => handleUpdateLine(idx, 'discount_percent', Number(e.target.value))}
                                                        className="w-16 text-center bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1 py-1 text-sm focus:border-blue-500 outline-none"
                                                    />
                                                </td>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="number"
                                                        value={line.tax_percent}
                                                        onChange={e => handleUpdateLine(idx, 'tax_percent', Number(e.target.value))}
                                                        className="w-16 text-center bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1 py-1 text-sm focus:border-blue-500 outline-none"
                                                    />
                                                </td>
                                                <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-100">${totalLine.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td className="p-3 text-center border-b border-slate-100 dark:border-slate-700">
                                                    <button onClick={() => removeLine(idx)} className="text-slate-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20" title="Eliminar Item">
                                                        <i className="fas fa-trash-alt"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 dark:bg-slate-700/50 font-medium text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-600">
                                    <td colSpan={7} className="p-3 text-right">Subtotal Bruto:</td>
                                    <td className="p-3 text-right font-bold">${totals.lineExtensionAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td></td>
                                </tr>
                                {totals.discountAmount > 0 && (
                                    <tr className="bg-slate-50 dark:bg-slate-700/50 font-medium text-orange-600 dark:text-orange-400">
                                        <td colSpan={7} className="p-3 text-right">Descuento:</td>
                                        <td className="p-3 text-right font-bold">-${totals.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td></td>
                                    </tr>
                                )}
                                <tr className="bg-slate-50 dark:bg-slate-700/50 font-medium text-slate-600 dark:text-slate-300">
                                    <td colSpan={7} className="p-3 text-right">Subtotal Neto:</td>
                                    <td className="p-3 text-right font-bold">${totals.taxBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td></td>
                                </tr>
                                <tr className="bg-slate-50 dark:bg-slate-700/50 font-medium text-slate-600 dark:text-slate-300">
                                    <td colSpan={7} className="p-3 text-right">IVA (19%):</td>
                                    <td className="p-3 text-right font-bold">${totals.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td></td>
                                </tr>
                                <tr className="bg-blue-50 dark:bg-blue-900/30 font-bold text-lg text-blue-700 dark:text-blue-300 border-t-2 border-blue-100 dark:border-blue-800">
                                    <td colSpan={7} className="p-3 text-right">Total a Pagar:</td>
                                    <td className="p-3 text-right font-bold text-blue-600 dark:text-blue-400">${totals.payableAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Preview Area */}
                {jsonPreview && (
                    <div className="mt-4 border rounded-lg overflow-hidden">
                        <div className="bg-slate-200 dark:bg-slate-700 p-2 flex justify-between items-center">
                            <h4 className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300">
                                {previewMode === 'json' ? 'JSON Generado (Vista Previa)' : 'Simulación Base de Datos (SQL INSERT)'}
                            </h4>
                            <button onClick={copyToClipboard} className="text-xs bg-white dark:bg-slate-600 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-500 transition-colors">
                                <i className="fas fa-copy mr-1"></i> Copiar
                            </button>
                        </div>
                        <textarea
                            className="w-full h-48 p-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 outline-none resize-none"
                            value={jsonPreview}
                            readOnly
                        />
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-600">
                    <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors" disabled={isSending}>Cancelar</button>

                    <button onClick={handleGenerateDbPreview} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5" disabled={isSending}>
                        <i className="fas fa-database mr-2"></i> Ver Guardado DB
                    </button>

                    <button onClick={handleGenerateJson} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-lg shadow-green-600/30 transition-all transform hover:-translate-y-0.5" disabled={isSending}>
                        <i className="fas fa-code mr-2"></i> Generar JSON
                    </button>

                    <button onClick={handleSendAndSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all transform hover:-translate-y-0.5 flex items-center" disabled={isSending}>
                        {isSending ? (
                            <>
                                <i className="fas fa-spinner fa-spin mr-2"></i> Procesando...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-paper-plane mr-2"></i> Enviar a DIAN y Guardar
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ManualInvoiceModal;
