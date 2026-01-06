import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { useData } from '../../hooks/useData';
import { useNotifications } from '../../hooks/useNotifications';
import { apiClient } from '../../services/apiClient';

interface ManualInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ManualInvoiceModal: React.FC<ManualInvoiceModalProps> = ({ isOpen, onClose }) => {
    const { clientes, productos, vendedores, datosEmpresa } = useData();
    const { addNotification } = useNotifications();

    // Form State matching the JSON structure
    const [formData, setFormData] = useState({
        number: '',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        paymentFormId: '1', // 1=Contado, 2=Credito
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
        lines: [] as any[]
    });

    const [jsonPreview, setJsonPreview] = useState<string | null>(null);
    const [localClientes, setLocalClientes] = useState<any[]>([]);
    const [localProductos, setLocalProductos] = useState<any[]>([]);

    useEffect(() => {
        if (clientes.length > 0) setLocalClientes(clientes);
        if (productos.length > 0) setLocalProductos(productos);

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
        };
        fetchData();
    }, [clientes, productos]);

    const activeClientes = localClientes.length > 0 ? localClientes : clientes;
    const activeProductos = localProductos.length > 0 ? localProductos : productos;

    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [newLine, setNewLine] = useState({
        code: '',
        description: '',
        quantity: 1,
        price_amount: 0,
        unit_measure_id: '70', // Unidad default
        tax_percent: 19
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
            setNewLine(prev => ({
                ...prev,
                code: prod.codigo || '',
                description: prod.nombre || '',
                price_amount: prod.precioPublico || 0,
                unit_measure_id: prod.unidadMedida || '70'
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
            tax_percent: 19
        });
        setSelectedProductId('');
    };

    const removeLine = (index: number) => {
        setFormData(prev => ({
            ...prev,
            lines: prev.lines.filter((_, i) => i !== index)
        }));
    };

    const calculateTotals = () => {
        const lineExtensionAmount = formData.lines.reduce((sum, line) => sum + (line.price_amount * line.quantity), 0);
        const taxAmount = formData.lines.reduce((sum, line) => sum + ((line.price_amount * line.quantity) * (line.tax_percent / 100)), 0);
        const payableAmount = lineExtensionAmount + taxAmount;
        return { lineExtensionAmount, taxAmount, payableAmount };
    };

    const totals = calculateTotals();

    const handleGenerateJson = () => {
        // Construct the JSON payload matching the user's example
        const payload = {
            number: parseInt(formData.number) || 0,
            legal_monetary_totals: {
                tax_inclusive_amount: totals.payableAmount,
                line_extension_amount: totals.lineExtensionAmount,
                charge_total_amount: 0,
                tax_exclusive_amount: totals.lineExtensionAmount,
                payable_amount: totals.payableAmount,
                allowance_total_amount: 0
            },
            identification_number: 901994818, // Fixed Orquidea NIT
            payment_forms: [
                {
                    payment_method_id: 1,
                    duration_measure: "0",
                    payment_due_date: formData.dueDate,
                    payment_form_id: parseInt(formData.paymentFormId)
                }
            ],
            tax_totals: [
                {
                    tax_amount: totals.taxAmount,
                    taxable_amount: totals.lineExtensionAmount,
                    percent: 19,
                    tax_id: 1
                }
            ],
            resolution_id: 101,
            sync: true,
            type_document_id: 1,
            invoice_lines: formData.lines.map(line => ({
                base_quantity: line.quantity,
                code: line.code,
                tax_totals: [
                    {
                        tax_amount: (line.price_amount * line.quantity) * (line.tax_percent / 100),
                        taxable_amount: line.price_amount * line.quantity,
                        percent: line.tax_percent,
                        tax_id: 1
                    }
                ],
                free_of_charge_indicator: false,
                line_extension_amount: line.price_amount * line.quantity,
                type_item_identification_id: 3,
                unit_measure_id: parseInt(line.unit_measure_id) || 642, // Default to 642 as per model
                description: line.description,
                price_amount: line.price_amount,
                invoiced_quantity: line.quantity
            })),
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
    };

    const copyToClipboard = () => {
        if (jsonPreview) {
            navigator.clipboard.writeText(jsonPreview);
            addNotification({ message: 'JSON copiado al portapapeles', type: 'success' });
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nueva Factura Manual (Orquidea)" size="xl">
            <div className="space-y-6 p-4">
                {/* Header Info */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium">Número Factura</label>
                        <input type="number" className="w-full border p-2 rounded" value={formData.number} onChange={e => setFormData({ ...formData, number: e.target.value })} placeholder="Ej: 5" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Fecha Emisión</label>
                        <input type="date" className="w-full border p-2 rounded" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Fecha Vencimiento</label>
                        <input type="date" className="w-full border p-2 rounded" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Vendedor</label>
                        <input type="text" className="w-full border p-2 rounded" value={formData.seller} onChange={e => setFormData({ ...formData, seller: e.target.value })} />
                    </div>
                </div>

                <hr />

                {/* Customer Info */}
                <h3 className="font-bold">Datos del Cliente</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-3">
                        <label className="block text-sm font-medium">Seleccionar Cliente Existente</label>
                        <select className="w-full border p-2 rounded" value={selectedClientId} onChange={handleClientSelect}>
                            <option value="">-- Seleccionar --</option>
                            {clientes.map(c => (
                                <option key={c.id} value={c.id}>{c.razonSocial || `${c.primerNombre} ${c.primerApellido}`}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Nombre / Razón Social</label>
                        <input type="text" className="w-full border p-2 rounded" value={formData.customer.name} onChange={e => setFormData({ ...formData, customer: { ...formData.customer, name: e.target.value } })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Identificación (NIT/CC)</label>
                        <input type="text" className="w-full border p-2 rounded" value={formData.customer.identification_number} onChange={e => setFormData({ ...formData, customer: { ...formData.customer, identification_number: e.target.value } })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">DV</label>
                        <input type="text" className="w-full border p-2 rounded" value={formData.customer.dv} onChange={e => setFormData({ ...formData, customer: { ...formData.customer, dv: e.target.value } })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Dirección</label>
                        <input type="text" className="w-full border p-2 rounded" value={formData.customer.address} onChange={e => setFormData({ ...formData, customer: { ...formData.customer, address: e.target.value } })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Email</label>
                        <input type="email" className="w-full border p-2 rounded" value={formData.customer.email} onChange={e => setFormData({ ...formData, customer: { ...formData.customer, email: e.target.value } })} />
                    </div>
                </div>

                <hr />

                {/* Lines */}
                <h3 className="font-bold">Items</h3>
                <div className="bg-gray-50 p-4 rounded">
                    <div className="grid grid-cols-12 gap-2 mb-2">
                        <div className="col-span-3">
                            <label className="block text-xs font-medium mb-1">Producto</label>
                            <select
                                className="w-full border p-1.5 rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                value={selectedProductId}
                                onChange={handleProductSelect}
                            >
                                <option value="">-- Seleccionar / Manual --</option>
                                {productos.map(p => (
                                    <option key={p.id} value={p.id}>{p.codigo} - {p.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-medium mb-1">Código</label>
                            <input
                                type="text"
                                className="w-full border p-1.5 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={newLine.code}
                                onChange={e => setNewLine({ ...newLine, code: e.target.value })}
                                placeholder="Código"
                            />
                        </div>
                        <div className="col-span-4">
                            <label className="block text-xs font-medium mb-1">Descripción</label>
                            <input
                                type="text"
                                className="w-full border p-1.5 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={newLine.description}
                                onChange={e => setNewLine({ ...newLine, description: e.target.value })}
                                placeholder="Descripción del producto"
                            />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-medium mb-1">Cant</label>
                            <input
                                type="number"
                                className="w-full border p-1.5 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={newLine.quantity}
                                onChange={e => setNewLine({ ...newLine, quantity: Number(e.target.value) })}
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-medium mb-1">Precio</label>
                            <input
                                type="number"
                                className="w-full border p-1.5 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={newLine.price_amount}
                                onChange={e => setNewLine({ ...newLine, price_amount: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={addLine}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
                            disabled={!newLine.description || newLine.price_amount <= 0}
                        >
                            <i className="fas fa-plus"></i> Agregar Item
                        </button>
                    </div>
                </div>

                {/* Lines Table */}
                <table className="w-full text-sm border">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="p-2 text-left">Código</th>
                            <th className="p-2 text-left">Descripción</th>
                            <th className="p-2 text-right">Cant</th>
                            <th className="p-2 text-right">Precio</th>
                            <th className="p-2 text-right">Total</th>
                            <th className="p-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {formData.lines.map((line, idx) => (
                            <tr key={idx} className="border-t">
                                <td className="p-2">{line.code}</td>
                                <td className="p-2">{line.description}</td>
                                <td className="p-2 text-right">{line.quantity}</td>
                                <td className="p-2 text-right">{line.price_amount}</td>
                                <td className="p-2 text-right">{(line.quantity * line.price_amount).toLocaleString()}</td>
                                <td className="p-2 text-center">
                                    <button onClick={() => removeLine(idx)} className="text-red-600">X</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end space-y-1 flex-col items-end">
                    <div>Subtotal: {totals.lineExtensionAmount.toLocaleString()}</div>
                    <div>IVA (19%): {totals.taxAmount.toLocaleString()}</div>
                    <div className="font-bold text-lg">Total: {totals.payableAmount.toLocaleString()}</div>
                </div>

                {/* JSON Preview Area */}
                {jsonPreview && (
                    <div className="mt-4">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-bold text-sm">JSON Generado (Vista Previa)</h4>
                            <button onClick={copyToClipboard} className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300">
                                <i className="fas fa-copy"></i> Copiar
                            </button>
                        </div>
                        <textarea
                            className="w-full h-48 border p-2 rounded text-xs font-mono bg-slate-50"
                            value={jsonPreview}
                            readOnly
                        />
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 border rounded">Cancelar</button>
                    <button onClick={handleGenerateJson} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                        <i className="fas fa-code mr-2"></i> Generar JSON
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ManualInvoiceModal;
