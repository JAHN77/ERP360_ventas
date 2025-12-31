import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';
import { useNotifications } from '../hooks/useNotifications';
import { apiClient } from '../services/apiClient';
import PageHeader from '../components/ui/PageHeader';
import Card, { CardContent, CardHeader } from '../components/ui/Card';
import { OrdenCompra, DocumentoDetalle, Cliente, InvProducto } from '../types';

// --- MOCK DATA FOR DEMO ---
const MOCK_OCS: OrdenCompra[] = [
    {
        id: 'oc-001',
        numeroOrden: '28',
        fechaOrden: '2025-05-16',
        proveedorId: '890101',
        proveedorNombre: 'COOPERATIVA DE PRODUCTOS DE LECHE DE LA COSTA',
        proveedorNit: '890.101.234-1',
        estado: 'PENDIENTE',
        subtotal: 1344300,
        ivaValor: 0,
        total: 1344300,
        fletes: 0,
        items: [
            {
                productoId: 101,
                codProducto: 'CB001',
                descripcion: 'CHOCO BROWNIE MINI X 6 U',
                cantidad: 300,
                precioUnitario: 4481,
                total: 1344300,
                descuentoPorcentaje: 0,
                ivaPorcentaje: 0,
                subtotal: 1344300,
                valorIva: 0
            }
        ]
    },
    {
        id: 'oc-002',
        numeroOrden: '29',
        fechaOrden: '2025-05-20',
        proveedorId: '800200',
        proveedorNombre: 'DISTRIBUIDORA DE LICORES DEL CARIBE',
        proveedorNit: '800.200.555-9',
        estado: 'PENDIENTE',
        subtotal: 500000,
        ivaValor: 95000,
        total: 595000,
        fletes: 25000,
        items: [
            {
                productoId: 202,
                codProducto: 'OLD001',
                descripcion: 'WHISKY OLD PARR 750ML',
                cantidad: 12,
                precioUnitario: 85000,
                total: 1020000,
                descuentoPorcentaje: 0,
                ivaPorcentaje: 19,
                subtotal: 1020000,
                valorIva: 193800
            }
        ]
    }
];

const EntradaInventarioPage: React.FC = () => {
    const { selectedSede } = useAuth();
    const { almacenes, clientes, productos } = useData();
    const { addNotification } = useNotifications();

    // Form State
    const [warehouseCode, setWarehouseCode] = useState('');
    const [entryNumber, setEntryNumber] = useState('00000025');
    const [providerCode, setProviderCode] = useState('');
    const [providerName, setProviderName] = useState('');

    // Autocomplete State - Provider
    const [providerSuggestions, setProviderSuggestions] = useState<Cliente[]>([]);
    const [showProviderSuggestions, setShowProviderSuggestions] = useState(false);

    // OC State
    const [ocNumber, setOcNumber] = useState('');
    const [ocDate, setOcDate] = useState('');
    const [remissionNumber, setRemissionNumber] = useState('');
    const [remissionDate, setRemissionDate] = useState(new Date().toISOString().split('T')[0]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [fletes, setFletes] = useState(0);
    const [ajustePeso, setAjustePeso] = useState(0);

    // Items Grid
    const [items, setItems] = useState<DocumentoDetalle[]>([]);

    // Autocomplete State - Products
    const [productSuggestions, setProductSuggestions] = useState<InvProducto[]>([]);
    const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);

    // UI State
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [recentMovements, setRecentMovements] = useState<any[]>([]);
    const [viewPdfData, setViewPdfData] = useState<any>(null); // For viewing past entries
    const [providerId, setProviderId] = useState(''); // Store provider ID from OC

    // Click Outside Handling
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const productSuggestionsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
                setShowProviderSuggestions(false);
            }
            if (productSuggestionsRef.current && !productSuggestionsRef.current.contains(event.target as Node)) {
                setActiveRowIndex(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Initialize Warehouse
    useEffect(() => {
        if (selectedSede) {
            const bod = almacenes.find(a => a.id === String(selectedSede.id));
            if (bod) setWarehouseCode(String(bod.codigo || bod.id));
            else if (almacenes.length > 0) setWarehouseCode(String(almacenes[0].codigo || almacenes[0].id));
        }
    }, [selectedSede, almacenes]);

    // Fetch Recent Movements
    const fetchRecentMovements = async () => {
        if (!warehouseCode) return;
        try {
            const { apiClient } = await import('../services/apiClient');
            // Filter by ENTRADA and current warehouse
            const res = await apiClient.getInventoryMovements(1, 10, '', 'fecsys', 'desc', warehouseCode, 'ENTRADA');
            if (res.success) {
                setRecentMovements(res.data);
            }
        } catch (error) {
            console.error('Error fetching recent movements:', error);
        }
    };

    useEffect(() => {
        if (warehouseCode) {
            fetchRecentMovements();
        }
    }, [warehouseCode]);

    const handleViewPdf = async (mov: any) => {
        setIsProcessing(true);
        try {
            const docRef = mov.numcom || mov.dockar;
            const { apiClient } = await import('../services/apiClient');
            // Fetch all movements for this document
            const res = await apiClient.getInventoryMovements(1, 100, docRef, 'fecha', 'desc');

            if (res.success && res.data && res.data.length > 0) {
                // Filter by exact date/time to show only THIS entry's items
                // (Since searching by Doc Ref returns all entries for that OC)
                const targetTime = new Date(mov.fecha).getTime();
                const filteredData = res.data.filter((m: any) => {
                    const itemTime = new Date(m.fecha).getTime();
                    return Math.abs(itemTime - targetTime) < 1000; // 1s tolerance or exact match
                });

                // Map to DocumentoDetalle format
                const mappedItems = filteredData.map((m: any) => ({
                    codProducto: m.codigoProducto,
                    descripcion: m.nombreProducto,
                    cantidad: Number(m.cantidad),
                    precioUnitario: Number(m.costo), // In kardex, cost is stored
                    total: Number(m.cantidad) * Number(m.costo),
                    fletes: 0
                }));

                const totalVal = mappedItems.reduce((acc: number, item: any) => acc + item.total, 0);

                setViewPdfData({
                    ocNumber: mov.numcom || mov.dockar,
                    fecha: mov.fecha,
                    items: mappedItems,
                    totals: { val: totalVal },
                    ajustePeso: 0, // Not stored in kardex explicitly usually unless in observa?
                    fletes: 0
                });
                setShowPdfModal(true);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    // Derived Warehouse Info
    const currentWarehouse = useMemo(() => {
        return almacenes.find(a => a.codigo === warehouseCode || a.id === warehouseCode);
    }, [warehouseCode, almacenes]);

    // Derived Totals
    const totals = useMemo(() => {
        return items.reduce((acc, item) => ({
            qty: acc.qty + item.cantidad,
            val: acc.val + (item.total || (item.cantidad * item.precioUnitario)) + (item.fletes || 0)
        }), { qty: 0, val: 0 });
    }, [items]);

    // --- Provider Handlers ---
    const handleProviderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setProviderCode(val);

        if (val.length > 1) {
            const filtered = clientes.filter(c =>
                (c.numeroDocumento.includes(val) || c.codter.includes(val) || (c.razonSocial || c.nombreCompleto || '').toLowerCase().includes(val.toLowerCase()))
                && (c.isproveedor || c.tipter === 2)
            ).slice(0, 10);
            setProviderSuggestions(filtered);
            setShowProviderSuggestions(true);
        } else {
            setProviderSuggestions([]);
            setShowProviderSuggestions(false);
        }
    };

    const selectProvider = (p: Cliente) => {
        setProviderCode(p.codter || p.numeroDocumento);
        setProviderName(p.razonSocial || p.nombreCompleto || 'Sin Nombre');
        setShowProviderSuggestions(false);
    };

    const handleProviderBlur = async () => {
        // Delayed to allow click selection
        setTimeout(async () => {
            if (showProviderSuggestions) return; // Don't trigger if suggestion list is open (click handled elsewhere)

            if (!providerCode) return;
            if (providerName) return; // Already selected

            const found = clientes.find(c =>
                (c.codter === providerCode || c.numeroDocumento === providerCode) &&
                (c.isproveedor || c.tipter === 2)
            );

            if (found) {
                setProviderName(found.nombreCompleto || found.razonSocial || 'Sin Nombre');
            } else {
                // Try API if not in local list
                try {
                    const res = await apiClient.searchClientes(providerCode);
                    if (res.success && res.data && Array.isArray(res.data) && res.data.length > 0) {
                        const apiFound = res.data[0];
                        setProviderName(apiFound.nombreCompleto || apiFound.razonSocial || 'Sin Nombre');
                    } else {
                        // Keep manual input but warn
                        // addNotification({ message: 'Proveedor no encontrado', type: 'warning' }); 
                    }
                } catch (e) { console.error(e); }
            }
        }, 200);
    };

    // --- OC Handlers ---
    const handleOcBlur = async () => {
        if (!ocNumber) return;

        try {
            const { apiFetchOrdenCompraByNumber } = await import('../services/apiClient');
            const res = await apiFetchOrdenCompraByNumber(ocNumber, selectedSede?.codigo);

            if (res.success && res.data) {
                const oc = res.data;
                setOcDate(oc.feccom ? oc.feccom.split('T')[0] : '');
                setProviderCode(oc.proveedorDocumento || oc.codter);
                setProviderName(oc.proveedorNombre || oc.nomter);

                // Calculate pro-rated fletes
                const totalBase = Number(oc.valcom) || 1;
                const totalFletes = Number(oc.valfletes) || 0;

                const mappedItems = (oc.items || []).map((item: any) => {
                    const cantidad = Number(item.cancom || item.cantidad || 0);
                    const precioUnitario = Number(item.vuncom || item.precioUnitario || 0);
                    const ivaPorcentaje = Number(item.ivains || item.piva || 0);

                    const subtotal = cantidad * precioUnitario;
                    const valorIva = subtotal * (ivaPorcentaje / 100);
                    const total = subtotal + valorIva;

                    // Distribute fletes based on value contribution
                    const itemFletes = (subtotal / totalBase) * totalFletes;

                    return {
                        id: item.id,
                        productoId: item.id_insumo || 0,
                        codProducto: item.codins || '',
                        descripcion: item.productoNombre || item.nomins || '',
                        cantidad: cantidad,
                        precioUnitario: precioUnitario,
                        total: total, // Calculated total including IVA
                        subtotal: subtotal,
                        ivaPorcentaje: ivaPorcentaje,
                        valorIva: valorIva,
                        descuentoPorcentaje: 0,
                        unidadMedida: item.unidadMedida || '',
                        fletes: itemFletes
                    };
                });

                setItems(mappedItems);
                // Fletes might be in 'fletes' column or similar if it exists in maeo
                setFletes(oc.valfletes || 0);
                setAjustePeso(Number(oc.AJUSTE_PESO || oc.ajuste_peso || 0));
                setProviderId(oc.proveedorDocumento || '');
                addNotification({ message: `Orden de Compra #${ocNumber} cargada`, type: 'success' });
            } else {
                addNotification({ message: 'Orden de Compra no encontrada', type: 'warning' });
                // Clean fields if not found? Maybe user made a typo, keep input.
            }
        } catch (error) {
            console.error('Error loading OC:', error);
            addNotification({ message: 'Error cargando la orden de compra', type: 'error' });
        }
    };

    // --- Item Handlers ---
    const handleItemChange = (index: number, field: keyof DocumentoDetalle, value: any) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        (item as any)[field] = value;

        if (field === 'cantidad' || field === 'precioUnitario') {
            item.subtotal = item.cantidad * item.precioUnitario;
            item.valorIva = item.subtotal * (item.ivaPorcentaje / 100);
            item.total = item.subtotal + item.valorIva;
        }

        // Search Trigger for Reference
        if (field === 'codProducto') {
            setActiveRowIndex(index);
            const query = String(value).toLowerCase();
            if (query.length > 1) {
                const filtered = productos.filter(p =>
                    (p.codins || '').toLowerCase().includes(query) ||
                    (p.codigo || '').toLowerCase().includes(query) ||
                    (p.nombre || p.nomins || '').toLowerCase().includes(query)
                ).slice(0, 10);
                setProductSuggestions(filtered);
            } else {
                setProductSuggestions([]);
            }
        }

        newItems[index] = item;
        setItems(newItems);
    };

    const selectProduct = (index: number, p: InvProducto) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        item.productoId = p.id;
        item.codProducto = p.codins || p.codigo || '';
        item.descripcion = p.nombre || p.nomins;
        item.precioUnitario = p.ultimoCosto || p.costoPromedio || 0;
        item.cantidad = item.cantidad || 1;
        item.subtotal = item.cantidad * item.precioUnitario;
        item.ivaPorcentaje = p.tasaIva || 0;
        item.valorIva = item.subtotal * (item.ivaPorcentaje / 100);
        item.total = item.subtotal + item.valorIva;
        item.descuentoPorcentaje = 0;

        newItems[index] = item;
        setItems(newItems);
        setActiveRowIndex(null); // Close suggestions
    };

    const handleAddRow = () => {
        setItems([...items, {
            productoId: 0,
            codProducto: '',
            descripcion: '',
            cantidad: 1,
            precioUnitario: 0,
            total: 0,
            subtotal: 0,
            ivaPorcentaje: 0,
            valorIva: 0,
            descuentoPorcentaje: 0
        }]);
    };

    const handleRemoveRow = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleProcess = async () => {
        if (items.length === 0) {
            addNotification({ message: 'No hay items para procesar', type: 'warning' });
            return;
        }
        if (!warehouseCode) {
            addNotification({ message: 'Seleccione un almacén', type: 'warning' });
            return;
        }

        const confirmed = window.confirm('¿Está seguro de procesar esta entrada de almacén?');
        if (!confirmed) return;

        setIsProcessing(true);
        try {
            console.log('📦 [DEBUG] Items a procesar:', items);
            const promises = items.map(item => {
                if (!item.productoId) {
                    console.error('❌ Error: Item sin productoId:', item);
                    // alert(`Error: El item ${item.descripcion} no tiene un ID de producto válido. No se procesará.`);
                    return Promise.resolve({ success: false, message: 'Item sin ID de producto', error: 'Item sin ID de producto' });
                }
                return apiClient.registerInventoryEntry({
                    productoId: item.productoId,
                    cantidad: item.cantidad,
                    costoUnitario: item.precioUnitario,
                    documentoRef: `OC-${ocNumber} REM-${remissionNumber}`,
                    motivo: `Entrada por OC ${ocNumber}`,
                    codalm: warehouseCode,
                    codcon: '10',
                    numComprobante: parseInt(ocNumber) || 0,
                    numRemision: parseInt(String(remissionNumber).replace(/\D/g, '')) || 0,
                    clienteId: providerId
                });
            });

            const results = await Promise.all(promises);

            // Check for failures
            const failures = results.filter(r => r && !r.success);
            if (failures.length > 0) {
                console.error('Failed entries:', failures);
                const firstError = failures[0].message || failures[0].error || 'Unknown error';
                throw new Error(`Error en ${failures.length} items: ${firstError}`);
            }

            addNotification({ message: 'Entrada procesada correctamente', type: 'success' });
            setShowPdfModal(true);
            setEntryNumber(prev => String(Number(prev) + 1).padStart(8, '0'));

            // Actualizar la tabla de movimientos recientes
            await fetchRecentMovements();
        } catch (error: any) {
            console.error(error);
            addNotification({ message: error.message || 'Error al procesar algunos items', type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in p-2 md:p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
            <PageHeader
                title="Entrada de Almacén"
                description="Control de Entrada de Mercancías por Orden de Compra"
            />

            <Card className="shadow-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-visible relative z-10">
                <CardHeader className="bg-slate-100/50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 pb-6 pt-6 relative z-20">
                    {/* Row 1: Almacén & Entrada No */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        <div className="lg:col-span-8 flex items-center gap-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 w-24">ALMACÉN:</label>
                            <div className="flex-1 flex gap-2">
                                <input
                                    className="w-20 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-center"
                                    value={warehouseCode}
                                    readOnly
                                />
                                <select
                                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none w-0 min-w-0"
                                    value={warehouseCode}
                                    onChange={(e) => setWarehouseCode(e.target.value)}
                                >
                                    {almacenes.map(a => (
                                        <option key={a.id} value={a.codigo || a.id}>{a.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="lg:col-span-4 flex items-center gap-2 lg:justify-end">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">ENTRADA Nº</label>
                            <input
                                className="w-32 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded text-sm font-mono font-bold text-right bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400"
                                value={entryNumber}
                                onChange={e => setEntryNumber(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Row 2: Address & Provider */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4 relative">
                        <div className="lg:col-span-6 flex items-center gap-2">
                            <label className="text-sm font-bold text-slate-500 dark:text-slate-400 w-24">ALMACÉN:</label>
                            <input
                                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded text-sm bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                value={currentWarehouse?.nombre || 'Almacén no disponible'}
                                readOnly
                            />
                        </div>

                        <div className="lg:col-span-6 flex items-center gap-2 relative">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 w-24">PROVEEDOR:</label>
                            <div className="flex-1 flex gap-2 relative">
                                <div className="relative w-32">
                                    <input
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={providerCode}
                                        onChange={handleProviderChange}
                                        onBlur={handleProviderBlur}
                                        placeholder="NIT/Cód"
                                        autoComplete="off"
                                    />
                                    {/* Provider Suggestions Dropdown */}
                                    {showProviderSuggestions && providerSuggestions.length > 0 && (
                                        <div ref={suggestionsRef} className="absolute top-full left-0 w-[400px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-xl z-50 mt-1 max-h-60 overflow-y-auto">
                                            {providerSuggestions.map(p => (
                                                <div
                                                    key={p.id}
                                                    className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0"
                                                    onMouseDown={() => selectProvider(p)} // onMouseDown fires before onBlur
                                                >
                                                    <div className="text-sm font-bold text-slate-900 dark:text-white">{p.razonSocial || p.nombreCompleto}</div>
                                                    <div className="text-xs text-slate-500">{p.numeroDocumento} - {p.codter}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <input
                                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded text-sm bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                    value={providerName}
                                    readOnly
                                    placeholder="Nombre del Proveedor"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                        {/* ... (OC fields unchanged) ... */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Orden de Compra</label>
                            <div className="flex items-center gap-2">
                                <input
                                    className="w-full px-3 py-1.5 border border-yellow-300 dark:border-yellow-700 rounded text-sm bg-yellow-50 dark:bg-yellow-900/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                                    value={ocNumber}
                                    onChange={e => setOcNumber(e.target.value)}
                                    onBlur={handleOcBlur}
                                    onKeyDown={(e) => e.key === 'Enter' && handleOcBlur()}
                                    placeholder="Buscar OC"
                                />
                                {ocNumber && (
                                    <button
                                        onClick={handleOcBlur}
                                        className="text-slate-400 hover:text-blue-500 transition-colors focus:outline-none"
                                        title="Buscar Orden de Compra"
                                    >
                                        <i className="fas fa-search"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fecha O.C.</label>
                            <input type="date" className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded text-sm bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300" value={ocDate} readOnly />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">No. Remisión</label>
                            <input className="w-full px-3 py-1.5 border border-blue-300 dark:border-blue-700 rounded text-sm bg-blue-50 dark:bg-blue-900/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" value={remissionNumber} onChange={e => setRemissionNumber(e.target.value)} placeholder="Ej: REM-001" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fecha Remisión</label>
                            <input type="date" className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white" value={remissionDate} onChange={e => setRemissionDate(e.target.value)} />
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0 bg-white dark:bg-slate-900 overflow-visible relative z-10">
                    <div className="overflow-x-visible">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-800 text-slate-100 uppercase text-xs font-bold tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 border-r border-slate-700 w-48">Referencia / Búsqueda</th>
                                    <th className="px-4 py-3 border-r border-slate-700">Descripción</th>
                                    <th className="px-4 py-3 border-r border-slate-700 text-center w-24">Cant.</th>
                                    <th className="px-4 py-3 border-r border-slate-700 text-center w-32">Valor Unit.</th>
                                    <th className="px-4 py-3 border-r border-slate-700 text-center w-24">IVA</th>
                                    <th className="px-4 py-3 border-r border-slate-700 text-center w-32">Total</th>
                                    <th className="px-4 py-3 border-r border-slate-700 text-center w-20">Fletes</th>
                                    <th className="px-4 py-3 text-center w-16">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-900/50">
                                            <div className="flex flex-col items-center gap-2">
                                                <i className="fas fa-box-open text-3xl opacity-50"></i>
                                                <p>No hay items cargados.</p>
                                                <button onClick={handleAddRow} className="mt-2 text-blue-600 hover:underline text-xs font-bold">+ Agregar Fila Manualmente</button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-colors relative">
                                        <td className="p-2 border-r border-slate-100 dark:border-slate-800 relative">
                                            <input
                                                className="w-full px-2 py-1 border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 rounded bg-transparent font-mono text-xs focus:bg-white dark:focus:bg-slate-900 dark:text-slate-200 outline-none transition-all placeholder:font-sans"
                                                value={item.codProducto || ''}
                                                onChange={(e) => handleItemChange(idx, 'codProducto', e.target.value)}
                                                placeholder="Cód o Nombre..."
                                                autoComplete="off"
                                            />
                                            {/* Product Suggestions Dropdown */}
                                            {activeRowIndex === idx && productSuggestions.length > 0 && (
                                                <div ref={productSuggestionsRef} className="absolute top-10 left-0 w-[400px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-2xl z-50 max-h-60 overflow-y-auto">
                                                    {productSuggestions.map(p => (
                                                        <div
                                                            key={p.id}
                                                            className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 flex justify-between items-center group"
                                                            onMouseDown={() => selectProduct(idx, p)}
                                                        >
                                                            <div>
                                                                <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600">{p.nombre || p.nomins}</div>
                                                                <div className="text-xs text-slate-500 font-mono">{p.codins || p.codigo}</div>
                                                            </div>
                                                            <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                                                ${(p.ultimoCosto || 0).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 border-r border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium">
                                            {item.descripcion || <span className="text-slate-400 italic">Producto no seleccionado</span>}
                                        </td>
                                        <td className="p-2 border-r border-slate-100 dark:border-slate-800 text-center">
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                                value={item.cantidad}
                                                onChange={(e) => handleItemChange(idx, 'cantidad', Number(e.target.value))}
                                                min="0"
                                            />
                                        </td>
                                        <td className="p-2 border-r border-slate-100 dark:border-slate-800 text-center">
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                                value={item.precioUnitario}
                                                onChange={(e) => handleItemChange(idx, 'precioUnitario', Number(e.target.value))}
                                                min="0"
                                            />
                                        </td>
                                        <td className="px-4 py-2 border-r border-slate-100 dark:border-slate-800 text-center text-xs">
                                            <div className="font-bold text-slate-700 dark:text-slate-300">{item.ivaPorcentaje}%</div>
                                            <div className="text-slate-400 text-[10px]">${item.valorIva.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                        </td>
                                        <td className="px-4 py-2 border-r border-slate-100 dark:border-slate-800 text-right font-bold text-slate-800 dark:text-slate-200">
                                            ${(item.total).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2 border-r border-slate-100 dark:border-slate-800 text-right text-slate-600 dark:text-slate-400 text-xs">
                                            ${(item.fletes || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="px-2 py-1 text-center">
                                            <button
                                                onClick={() => handleRemoveRow(idx)}
                                                className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            >
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="p-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                            <button onClick={handleAddRow} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 px-3 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                <i className="fas fa-plus"></i> Añadir Item
                            </button>
                        </div>
                    </div>
                </CardContent>

                <div className="bg-slate-100 dark:bg-black/20 p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 relative z-20">
                    <div className="flex items-center gap-4">
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Items Seleccionados: <span className="text-slate-900 dark:text-white font-bold">{items.length}</span></div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">
                                Total Entrada
                                {ajustePeso !== 0 && <span className="ml-2 lowercase text-[10px] font-normal text-slate-400">(+ Ajuste: ${ajustePeso})</span>}
                            </div>
                            <div className="text-2xl font-bold text-slate-800 dark:text-white">${(totals.val + ajustePeso).toLocaleString()}</div>
                        </div>

                        <button
                            onClick={handleProcess}
                            disabled={isProcessing || items.length === 0}
                            className={`flex items-center gap-2 px-8 py-2 rounded-lg font-bold text-white shadow-lg transition-all transform hover:-translate-y-0.5
                                ${isProcessing || items.length === 0
                                    ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed shadow-none'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/30'}
                            `}
                        >
                            {isProcessing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                            PROCESAR
                        </button>
                    </div>
                </div>
            </Card>



            {/* Recent Entries Section */}
            <div className="mt-8">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <i className="fas fa-history text-blue-500"></i> Últimas Entradas Registradas
                </h3>
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">Documento</th>
                                    <th className="px-4 py-3">Producto</th>
                                    <th className="px-4 py-3 text-right">Cantidad</th>
                                    <th className="px-4 py-3 text-right">Costo</th>
                                    <th className="px-4 py-3">Usuario</th>
                                    <th className="px-4 py-3 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {recentMovements.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">
                                            No hay entradas recientes en este almacén.
                                        </td>
                                    </tr>
                                ) : (
                                    recentMovements.map((mov, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                {new Date(mov.fecha).toLocaleDateString()} <span className="text-xs text-slate-400">{new Date(mov.fecha).toLocaleTimeString((undefined), { hour: '2-digit', minute: '2-digit' })}</span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                                                {mov.numcom ? `OC-${mov.numcom}` : (mov.dockar || 'N/A')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-800 dark:text-slate-200">{mov.nombreProducto}</div>
                                                <div className="text-xs text-slate-400">{mov.codigoProducto}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                                                {Number(mov.cantidad).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                                                ${Number(mov.costo).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                                                {mov.usuario}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleViewPdf(mov)}
                                                    className="text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded text-xs shadow"
                                                >
                                                    <i className="fas fa-file-pdf"></i> PDF
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* Document Preview Modal Component (kept as is) */}
            {
                showPdfModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] animate-fade-in" onClick={() => { setShowPdfModal(false); setViewPdfData(null); }}>
                        <div className="bg-slate-200 dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl h-auto max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-300 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center p-4 border-b border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <i className="fas fa-print text-slate-400"></i> Vista Previa de Documento {viewPdfData ? '(Histórico)' : ''}
                                </h3>
                                <button onClick={() => { setShowPdfModal(false); setViewPdfData(null); }} className="text-slate-400 hover:text-red-500 p-2 transition-colors"><i className="fas fa-times fa-lg"></i></button>
                            </div>
                            <div className="flex-1 overflow-auto flex justify-center p-8 bg-slate-300 dark:bg-slate-950/50">
                                <div className="bg-white shadow-2xl p-10 min-h-[800px] w-full max-w-3xl text-slate-900 print:shadow-none print:w-full">
                                    {/* Header */}
                                    <div className="border-2 border-slate-900 p-4 mb-6 rounded-sm">
                                        <div className="font-bold text-2xl mb-1 text-slate-900">DISTRIMARKET DE LA GUAJIRA SAS</div>
                                        <div className="text-base font-semibold mb-1 text-slate-700">NIT: 900592639-1</div>
                                        <div className="text-sm text-slate-600">Almacén: {currentWarehouse?.nombre || 'Principal'}</div>
                                    </div>

                                    <div className="text-center mb-10">
                                        <div className="font-bold text-lg mb-1 uppercase text-slate-800">ALMACÉN {currentWarehouse?.codigo} - {currentWarehouse?.nombre}</div>
                                        <div className="font-bold text-lg mb-1 uppercase text-slate-800">ENTRADA DE ALMACÉN POR CONCEPTO DE</div>
                                        <div className="font-bold text-xl uppercase text-slate-900">ENTRADA POR ORDEN DE COMPRA Nº: {viewPdfData ? viewPdfData.ocNumber : ocNumber}</div>
                                    </div>

                                    <div className="flex justify-between items-end mb-4 border-b-2 border-slate-900 pb-2">
                                        <div className="text-sm font-semibold">Fecha: {new Date(viewPdfData ? viewPdfData.fecha : new Date()).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                        <div className="text-sm font-bold">Página 1 de 1</div>
                                    </div>

                                    <table className="w-full text-xs border-collapse border border-slate-900 mb-8">
                                        <thead className="bg-slate-100">
                                            <tr>
                                                <th className="border border-slate-900 p-2 text-left font-bold text-slate-900">Código</th>
                                                <th className="border border-slate-900 p-2 text-left w-1/2 font-bold text-slate-900">Descripción del Insumo</th>
                                                <th className="border border-slate-900 p-2 text-right font-bold text-slate-900">Cant. Entrada</th>
                                                <th className="border border-slate-900 p-2 text-right font-bold text-slate-900">Vr. Unitario</th>
                                                <th className="border border-slate-900 p-2 text-right font-bold text-slate-900">Fletes</th>
                                                <th className="border border-slate-900 p-2 text-right font-bold text-slate-900">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(viewPdfData ? viewPdfData.items : items).map((item: any, i: number) => (
                                                <tr key={i} className="even:bg-slate-50">
                                                    <td className="border border-slate-400 p-2 text-slate-700">{item.codProducto}</td>
                                                    <td className="border border-slate-400 p-2 font-medium text-slate-900">{item.descripcion}</td>
                                                    <td className="border border-slate-400 p-2 text-right text-slate-700">{item.cantidad.toFixed(2)}</td>
                                                    <td className="border border-slate-400 p-2 text-right text-slate-700">${item.precioUnitario.toLocaleString()}</td>
                                                    <td className="border border-slate-400 p-2 text-right text-slate-700">${(item.fletes || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                                    <td className="border border-slate-400 p-2 text-right text-slate-900 font-semibold">${item.total.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    <div className="flex justify-end pr-4">
                                        <div className="w-64 border-t-2 border-slate-900 pt-2">
                                            <div className="flex justify-between mb-1 text-sm text-slate-800">
                                                <span className="font-semibold">Subtotal Insumos</span>
                                                <span>${(viewPdfData ? viewPdfData.totals.val : totals.val).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between mb-1 text-sm text-slate-800">
                                                <span className="font-semibold">Total Fletes</span>
                                                <span>${(((viewPdfData ? viewPdfData.items : items) as any[]).reduce((sum, item) => sum + (item.fletes || 0), 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                            </div>
                                            {(viewPdfData ? viewPdfData.ajustePeso : ajustePeso) !== 0 && (
                                                <div className="flex justify-between mb-1 text-sm text-slate-800">
                                                    <span className="font-semibold">Ajuste Peso</span>
                                                    <span>${(viewPdfData ? viewPdfData.ajustePeso : ajustePeso).toLocaleString()}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between mt-2 pt-2 border-t border-slate-400 text-lg">
                                                <span className="font-bold text-slate-900">Total Entrada</span>
                                                <span className="font-bold text-slate-900">${((viewPdfData ? viewPdfData.totals.val : totals.val) + (viewPdfData ? viewPdfData.ajustePeso : ajustePeso)).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 border-t border-slate-300 dark:border-slate-700 flex justify-end gap-3 bg-white dark:bg-slate-900">
                                <button onClick={() => { setShowPdfModal(false); setViewPdfData(null); }} className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition-colors">Cancelar</button>
                                <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg shadow-blue-500/30 transition-all transform active:scale-95" onClick={() => window.print()}>
                                    <i className="fas fa-print mr-2"></i> Imprimir Documento
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default EntradaInventarioPage;
