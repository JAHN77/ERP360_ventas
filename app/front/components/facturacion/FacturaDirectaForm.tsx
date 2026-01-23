import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DocumentItem, Cliente, Producto, Vendedor } from '../../types';
import Card from '../ui/Card';
import { isWithinRange, isPositiveInteger } from '../../utils/validation';
import { useData } from '../../hooks/useData';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { apiSearchClientes, apiSearchVendedores, apiSearchProductos, apiSearchServices, apiGetClienteById, apiClient } from '../../services/apiClient';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

interface FacturaDirectaFormData {
    number: string;
    date: string;
    dueDate: string;
    paymentFormId: string;
    paymentMethodId: string;
    seller: string;
    customer: {
        identification_number: string;
        name: string;
        address: string;
        phone: string;
        email: string;
        dv: string;
        type_document_id: string;
        type_liability_id: string;
        type_regime_id: string;
        id_location: string;
    };
    items: DocumentItem[];
    observacionesInternas?: string;
    notaPago?: string;
}

interface FacturaDirectaFormProps {
    onSubmit: (data: FacturaDirectaFormData) => Promise<void>;
    onCancel: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
    nextInvoiceNumber?: string;
    onPreview?: (data: FacturaDirectaFormData) => void;
}

const FacturaDirectaForm: React.FC<FacturaDirectaFormProps> = ({ onSubmit, onCancel, onDirtyChange, nextInvoiceNumber, onPreview }) => {
    const { clientes, vendedores, productos, datosEmpresa } = useData();
    const { selectedSede, selectedCompany } = useAuth();
    const { addNotification } = useNotifications();

    const [formData, setFormData] = useState<FacturaDirectaFormData>({
        number: nextInvoiceNumber || '',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        paymentFormId: '1',
        paymentMethodId: '10',
        seller: '',
        customer: {
            identification_number: '',
            name: '',
            address: '',
            phone: '',
            email: '',
            dv: '',
            type_document_id: '31',
            type_liability_id: '1',
            type_regime_id: '1',
            id_location: '08001',
        },
        items: []
    });

    const [clienteSearch, setClienteSearch] = useState('');
    const [clienteResults, setClienteResults] = useState<Cliente[]>([]);
    const [isClienteOpen, setIsClienteOpen] = useState(false);
    const [vendedorSearch, setVendedorSearch] = useState('');
    const [vendedorResults, setVendedorResults] = useState<Vendedor[]>([]);
    const [isVendedorOpen, setIsVendedorOpen] = useState(false);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const [productResults, setProductResults] = useState<Producto[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
    const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
    const [selectedVendedor, setSelectedVendedor] = useState<Vendedor | null>(null);
    const [currentQuantity, setCurrentQuantity] = useState<number | string>(1);
    const [currentUnitPrice, setCurrentUnitPrice] = useState<number | string>(0);
    const [currentIva, setCurrentIva] = useState<number | string>(0);
    const [currentDiscount, setCurrentDiscount] = useState<number | string>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [observacionesInternas, setObservacionesInternas] = useState('');
    const [notaPago, setNotaPago] = useState('');

    const calculatedTotal = useMemo(() => {
        const q = Number(currentQuantity) || 0;
        const p = Number(currentUnitPrice) || 0;
        const d = Number(currentDiscount) || 0;
        const i = Number(currentIva) || 0;

        const subtotal = (p * q) * (1 - (d / 100));
        const valorIva = subtotal * (i / 100);
        return subtotal + valorIva;
    }, [currentQuantity, currentUnitPrice, currentDiscount, currentIva]);

    const clienteRef = useRef<HTMLDivElement>(null);
    const vendedorRef = useRef<HTMLDivElement>(null);
    const productRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (nextInvoiceNumber) {
            setFormData(prev => ({ ...prev, number: nextInvoiceNumber }));
        }
    }, [nextInvoiceNumber]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (clienteRef.current && !clienteRef.current.contains(event.target as Node)) setIsClienteOpen(false);
            if (vendedorRef.current && !vendedorRef.current.contains(event.target as Node)) setIsVendedorOpen(false);
            if (productRef.current && !productRef.current.contains(event.target as Node)) setIsProductDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search for clients
    useEffect(() => {
        const handler = setTimeout(async () => {
            const q = clienteSearch.trim();
            if (q.length >= 2) {
                try {
                    const resp = await apiSearchClientes(q, 20);
                    if (resp.success && resp.data) {
                        setClienteResults(resp.data as Cliente[]);
                    }
                } catch (e) { console.error(e); }
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [clienteSearch]);

    // Debounced search for vendors
    useEffect(() => {
        const handler = setTimeout(async () => {
            const q = vendedorSearch.trim();
            if (q.length >= 2) {
                try {
                    const resp = await apiSearchVendedores(q, 20);
                    if (resp.success && resp.data) {
                        setVendedorResults(resp.data as Vendedor[]);
                    }
                } catch (e) { console.error(e); }
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [vendedorSearch]);

    // Debounced search for products
    useEffect(() => {
        const handler = setTimeout(async () => {
            const q = productSearchTerm.trim();
            if (q.length >= 2) {
                try {
                    // Usar apiSearchServices en lugar de apiSearchProductos para Factura Directa (servicios)
                    const resp = await apiSearchServices(q, 20);
                    if (resp.success && resp.data) {
                        const dataArray = resp.data as any[];
                        const mapped = dataArray.map(p => ({
                            ...p,
                            // El backend ya mapea nomser -> nombre, codser -> codigo, valser -> ultimoCosto
                            // Aseguramos que los valores sean numéricos
                            ultimoCosto: Number(p.ultimoCosto) || 0,
                            tasaIva: Number(p.tasaIva) || 0,
                            aplicaIva: (Number(p.tasaIva) > 0)
                        }));
                        setProductResults(mapped as Producto[]);
                    }
                } catch (e) { console.error(e); }
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [productSearchTerm]);

    const pickCliente = async (c: Cliente) => {
        setClienteSearch(c.nombreCompleto || c.razonSocial || '');
        setIsClienteOpen(false);
        setSelectedCliente(c);

        let nit = c.numeroDocumento || '';
        let dv = c.digitoVerificacion || '';
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
                name: c.razonSocial || c.nombreCompleto || '',
                address: c.direccion || '',
                phone: (c as any).celter || c.celular || (c as any).telter || c.telefono || '',
                email: c.email || '',
                dv: dv
            }
        }));
    };

    const pickVendedor = (v: Vendedor) => {
        setVendedorSearch(v.nombreCompleto || `${v.primerNombre} ${v.primerApellido}`);
        setSelectedVendedor(v);
        setFormData(prev => ({ ...prev, seller: v.codigoVendedor || v.id || '' }));
        setIsVendedorOpen(false);
    };

    const handleProductSelect = (p: Producto) => {
        setSelectedProduct(p);
        setProductSearchTerm(p.nombre);
        setIsProductDropdownOpen(false);
        setCurrentQuantity(1);
        setCurrentUnitPrice(p.ultimoCosto || 0);
        setCurrentIva(p.tasaIva || 0);
        setCurrentDiscount(0);
    };

    const handleAddItem = () => {
        if (!selectedProduct) return;

        const quantityNum = Number(currentQuantity);
        const discountNum = Number(currentDiscount);
        const price = Number(currentUnitPrice);
        const ivaPorcentaje = Number(currentIva);

        if (quantityNum <= 0) {
            addNotification({ message: 'La cantidad debe ser mayor a 0', type: 'warning' });
            return;
        }
        if (price <= 0) {
            addNotification({ message: 'El precio debe ser mayor a 0', type: 'warning' });
            return;
        }
        if (ivaPorcentaje < 0) {
            addNotification({ message: 'El IVA no puede ser negativo', type: 'warning' });
            return;
        }
        if (discountNum < 0) {
            addNotification({ message: 'El descuento no puede ser negativo', type: 'warning' });
            return;
        }

        const subtotal = (price * quantityNum) * (1 - (discountNum / 100));
        const valorIva = subtotal * (ivaPorcentaje / 100);
        const total = subtotal + valorIva;

        const newItem: DocumentItem = {
            productoId: selectedProduct.id,
            descripcion: selectedProduct.nombre,
            cantidad: quantityNum,
            precioUnitario: price,
            ivaPorcentaje: ivaPorcentaje,
            descuentoPorcentaje: discountNum,
            subtotal: subtotal,
            valorIva: valorIva,
            total: total,
            codProducto: selectedProduct.codigo || (selectedProduct as any).codins || 'N/A',
            referencia: selectedProduct.referencia || ''
        };

        setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
        setSelectedProduct(null);
        setProductSearchTerm('');
        setCurrentQuantity(1);
        setCurrentUnitPrice(0);
        setCurrentIva(0);
        setCurrentDiscount(0);
    };

    const handleRemoveItem = (index: number) => {
        setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
    };

    const totals = useMemo(() => {
        return formData.items.reduce((acc, item) => ({
            subtotalBruto: acc.subtotalBruto + (item.precioUnitario * item.cantidad),
            descuentoTotal: acc.descuentoTotal + ((item.precioUnitario * item.cantidad) * (item.descuentoPorcentaje / 100)),
            iva: acc.iva + item.valorIva,
            total: acc.total + item.total
        }), { subtotalBruto: 0, descuentoTotal: 0, iva: 0, total: 0 });
    }, [formData.items]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.items.length === 0) {
            addNotification({ message: 'Debe añadir al menos un producto', type: 'warning' });
            return;
        }
        if (!formData.customer.email || !formData.customer.email.includes('@')) {
            addNotification({ message: 'El cliente debe tener un correo electrónico válido', type: 'error' });
            return;
        }
        setIsSubmitting(true);
        try {
            await onSubmit({
                ...formData,
                observacionesInternas,
                notaPago
            } as any);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Bodega Alert */}
            {selectedSede ? (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
                    <i className="fas fa-warehouse"></i>
                    <span className="font-medium">Bodega:</span>
                    <span>{selectedSede.nombre} ({selectedSede.codigo})</span>
                </div>
            ) : (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span className="font-medium">Advertencia:</span>
                    <span>No hay bodega seleccionada. Por favor, selecciona una bodega en el header.</span>
                </div>
            )}

            {/* General Info */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">N° Factura</label>
                    <input
                        type="text"
                        value={formData.number}
                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                        readOnly={selectedCompany?.db_name !== 'orquidea'}
                        className={`w-full px-3 py-1.5 text-sm border rounded-md outline-none ${selectedCompany?.db_name === 'orquidea'
                            ? 'bg-white border-blue-500 focus:ring-2 focus:ring-blue-500'
                            : 'bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed'
                            }`}
                    />
                </div>

                <div ref={clienteRef} className="relative md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Cliente</label>
                    <input
                        type="text"
                        value={clienteSearch}
                        onChange={(e) => { setClienteSearch(e.target.value); setIsClienteOpen(true); }}
                        placeholder="Buscar cliente..."
                        className={`w-full px-3 py-1.5 text-sm border rounded-md focus:ring-2 outline-none ${formData.customer.identification_number && (!formData.customer.email || !formData.customer.email.includes('@'))
                            ? 'bg-red-50 border-red-300 focus:ring-red-500 text-red-700'
                            : 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                            }`}
                    />
                    {formData.customer.identification_number && (!formData.customer.email || !formData.customer.email.includes('@')) && (
                        <p className="text-[10px] text-red-500 mt-0.5">⚠️ El cliente seleccionado no tiene email válido</p>
                    )}
                    {isClienteOpen && clienteResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {clienteResults.map(c => (
                                <div key={c.id} onClick={() => pickCliente(c)} className="px-3 py-2 hover:bg-blue-500 hover:text-white cursor-pointer text-sm">
                                    {c.nombreCompleto || c.razonSocial} - {c.numeroDocumento}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div ref={vendedorRef} className="relative md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Vendedor</label>
                    <input
                        type="text"
                        value={vendedorSearch}
                        onChange={(e) => { setVendedorSearch(e.target.value); setIsVendedorOpen(true); }}
                        placeholder="Buscar vendedor..."
                        className="w-full px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {isVendedorOpen && vendedorResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {vendedorResults.map(v => (
                                <div key={v.id} onClick={() => pickVendedor(v)} className="px-3 py-2 hover:bg-blue-500 hover:text-white cursor-pointer text-sm">
                                    {v.nombreCompleto || `${v.primerNombre} ${v.primerApellido}`}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Forma Pago</label>
                    <select
                        value={formData.paymentFormId}
                        onChange={(e) => setFormData({ ...formData, paymentFormId: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="1">Contado</option>
                        <option value="2">Crédito</option>
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Medio Pago</label>
                    <select
                        value={formData.paymentMethodId}
                        onChange={(e) => setFormData({ ...formData, paymentMethodId: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="10">Efectivo</option>
                        <option value="31">Transferencia</option>
                        <option value="30">Crédito</option>
                    </select>
                </div>
            </div>

            {/* Row for Selected Client/Vendor Info Cards */}
            {(selectedCliente || selectedVendedor) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedCliente && (
                        <Card className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg shadow-none">
                            <div className="space-y-1">
                                <p className="text-base font-semibold text-slate-800 dark:text-slate-100 truncate">
                                    {selectedCliente.nombreCompleto || selectedCliente.razonSocial || (selectedCliente as any).nomter || 'Sin nombre'}
                                </p>
                                {(selectedCliente.direccion || (selectedCliente as any).dirter) && (
                                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                        <i className="fas fa-map-marker-alt mr-1"></i>
                                        {selectedCliente.direccion || (selectedCliente as any).dirter}
                                        {selectedCliente.ciudad && `, ${selectedCliente.ciudad}`}
                                    </p>
                                )}
                                <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    {selectedCliente.numeroDocumento && (
                                        <span><i className="fas fa-id-card mr-1"></i>Doc: {selectedCliente.numeroDocumento}</span>
                                    )}
                                    {(selectedCliente.email || selectedCliente.telefono || (selectedCliente as any).celular || (selectedCliente as any).celter) && (
                                        <span>
                                            <i className="fas fa-phone mr-1"></i>
                                            {[
                                                selectedCliente.telefono || (selectedCliente as any).telefono,
                                                (selectedCliente as any).celular || (selectedCliente as any).celter
                                            ].filter(Boolean).join(' | ')}
                                        </span>
                                    )}
                                    {/* Mostrar email explícitamente para validación visual */}
                                    <span className={(!selectedCliente.email || !selectedCliente.email.includes('@')) ? 'text-red-500 font-bold' : ''}>
                                        <i className={`fas ${(!selectedCliente.email || !selectedCliente.email.includes('@')) ? 'fa-exclamation-circle' : 'fa-envelope'} mr-1`}></i>
                                        {selectedCliente.email || '🚫 Sin Email'}
                                    </span>
                                </div>
                            </div>
                        </Card>
                    )}
                    {selectedVendedor && (
                        <Card className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg shadow-none">
                            <div className="space-y-1">
                                <p className="text-base font-semibold text-slate-800 dark:text-slate-100 truncate">
                                    {selectedVendedor.primerNombre && selectedVendedor.primerApellido
                                        ? `${selectedVendedor.primerNombre} ${selectedVendedor.primerApellido}`.trim()
                                        : selectedVendedor.nombreCompleto || (selectedVendedor as any).nombre || 'Sin nombre'}
                                </p>
                                <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    {(selectedVendedor.codigoVendedor || (selectedVendedor as any).codigo) && (
                                        <span><i className="fas fa-id-badge mr-1"></i>Código: {selectedVendedor.codigoVendedor || (selectedVendedor as any).codigo}</span>
                                    )}
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            )}

            {/* Observations and Payment Note */}
            <div className="grid md:grid-cols-4 gap-3">
                <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">F. Emisión</label>
                    <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">F. Vencimiento</label>
                    <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Observaciones</label>
                    <input
                        type="text"
                        value={observacionesInternas}
                        onChange={(e) => setObservacionesInternas(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Notas internas..."
                    />
                </div>
                <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nota Pago</label>
                    <input
                        type="text"
                        value={notaPago}
                        onChange={(e) => setNotaPago(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nota de pago..."
                    />
                </div>
            </div>


            {/* Add Products Section */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 uppercase tracking-wider">Añadir Productos</h3>
                <div ref={productRef} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                    <div className="lg:col-span-2 relative">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Producto</label>
                        <input
                            type="text"
                            value={productSearchTerm}
                            onChange={(e) => { setProductSearchTerm(e.target.value); setIsProductDropdownOpen(true); }}
                            placeholder="Buscar por nombre..."
                            className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        {isProductDropdownOpen && productResults.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                {productResults.map(p => (
                                    <div key={p.id} onClick={() => handleProductSelect(p)} className="px-3 py-2 hover:bg-blue-500 hover:text-white cursor-pointer text-sm">
                                        {p.codigo} - {p.nombre}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 text-center">Unidad</label>
                        <input type="text" readOnly value={selectedProduct?.unidadMedida || 'UNIDAD'} className="w-full px-3 py-2 text-sm bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-center text-slate-500" />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 text-center">Cant.</label>
                        <input
                            type="number"
                            min="1"
                            value={currentQuantity}
                            onChange={(e) => setCurrentQuantity(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-center focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 text-right">Vr. Unit.</label>
                        <input
                            type="number"
                            min="0"
                            value={currentUnitPrice}
                            onChange={(e) => setCurrentUnitPrice(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-right focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 text-center">% Iva</label>
                        <input
                            type="number"
                            min="0"
                            value={currentIva}
                            onChange={(e) => setCurrentIva(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-center focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 text-center">% Desc.</label>
                        <input
                            type="number"
                            min="0"
                            value={currentDiscount}
                            onChange={(e) => setCurrentDiscount(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-center focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 text-center">Total</label>
                        <input
                            type="text"
                            readOnly
                            value={formatCurrency(calculatedTotal)}
                            className="w-full px-3 py-2 text-sm bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-center text-slate-700 font-bold outline-none"
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <button
                            type="button"
                            onClick={handleAddItem}
                            disabled={!selectedProduct}
                            className="w-full py-2 bg-slate-500 hover:bg-slate-600 text-white font-bold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            + Añadir
                        </button>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3">Referencia</th>
                            <th className="px-4 py-3">Producto</th>
                            <th className="px-4 py-3 text-center">Cant.</th>
                            <th className="px-4 py-3 text-right">Precio</th>
                            <th className="px-4 py-3 text-center">Desc %</th>
                            <th className="px-4 py-3 text-center">IVA %</th>
                            <th className="px-4 py-3 text-right">Total</th>
                            <th className="px-4 py-3 text-center">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                        {formData.items.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-slate-400 italic">
                                    No hay productos añadidos
                                </td>
                            </tr>
                        ) : (
                            formData.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="px-4 py-3 font-mono text-xs">{item.referencia || item.codProducto || 'N/A'}</td>
                                    <td className="px-4 py-3 font-medium">{item.descripcion}</td>
                                    <td className="px-4 py-3 text-center font-bold">{item.cantidad}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(item.precioUnitario)}</td>
                                    <td className="px-4 py-3 text-center">{item.descuentoPorcentaje}%</td>
                                    <td className="px-4 py-3 text-center">{item.ivaPorcentaje}%</td>
                                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(item.total)}</td>
                                    <td className="px-4 py-3 text-center">
                                        <button type="button" onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700">
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Totals and Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                <div className="w-full md:w-1/2">
                    {/* Placeholder for alignment if needed, or just leave empty as we moved observations up */}
                </div>

                <div className="w-full md:w-80 space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Subtotal Bruto:</span>
                        <span className="font-semibold">{formatCurrency(totals.subtotalBruto)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-red-500">
                        <span>Descuento Total:</span>
                        <span className="font-semibold">-{formatCurrency(totals.descuentoTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">IVA:</span>
                        <span className="font-semibold">{formatCurrency(totals.iva)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-blue-600 dark:text-blue-400 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span>Total:</span>
                        <span>{formatCurrency(totals.total)}</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-4 pt-6">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-lg hover:bg-slate-300 transition-colors"
                >
                    Cancelar
                </button>

                {onPreview && (
                    <button
                        type="button"
                        onClick={() => onPreview({ ...formData, observacionesInternas, notaPago })}
                        disabled={formData.items.length === 0 || !formData.customer.identification_number || !formData.customer.email || !formData.customer.email.includes('@')}
                        title={
                            formData.items.length === 0 ? "Añade productos primero" :
                                !formData.customer.identification_number ? "Selecciona un cliente" :
                                    (!formData.customer.email || !formData.customer.email.includes('@')) ? "El cliente debe tener un email válido" :
                                        ""
                        }
                        className="px-6 py-2 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fas fa-eye"></i> Previsualizar
                    </button>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting || formData.items.length === 0 || !formData.customer.identification_number || !formData.customer.email || !formData.customer.email.includes('@')}
                    title={
                        formData.items.length === 0 ? "Añade productos primero" :
                            !formData.customer.identification_number ? "Selecciona un cliente" :
                                (!formData.customer.email || !formData.customer.email.includes('@')) ? "El cliente debe tener un email válido" :
                                    ""
                    }
                    className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-blue-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                    Guardar y Timbrar Factura
                </button>
            </div>
        </form>
    );
};

export default FacturaDirectaForm;
