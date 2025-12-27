import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DocumentItem, Producto } from '../../types';
import Card from '../ui/Card';
import { useData } from '../../hooks/useData';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { apiSearchProveedores, apiSearchProductos } from '../../services/apiClient';

interface OrdenCompraFormData {
    codter: string;
    items: DocumentItem[];
    subtotal: number;
    ivaValor: number;
    total: number;
    observaciones?: string;
    proveedor?: any | null;
    feccom: string;
    bodegaId?: string;
    entradaAlmacen: boolean;
    contabilizaFactura: boolean;
    numeroFacturaProveedor?: string;
    plazoFactura?: number;
    fechaVenceFactura?: string;
    valret?: number;
    valfletes?: number;
    valajuste?: number;
    valdescuentos?: number;
    tercerizaFletes?: boolean;
    fletesCosto?: number;
    retenciones: {
        retefuente: boolean;
        retefuenteValor: number;
        reteica: boolean;
        reteicaValor: number;
        reteiva: boolean;
        reteivaValor: number;
    };
    cuentas: {
        retefuente: string;
        reteica: string;
    }
}

interface OrdenCompraFormProps {
    onSubmit: (data: OrdenCompraFormData) => void;
    onCancel: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
    initialData?: any | null;
}

const OrdenCompraForm: React.FC<OrdenCompraFormProps> = ({ onSubmit, onCancel, onDirtyChange, initialData }) => {
    const { almacenes } = useData();
    const { selectedSede } = useAuth();
    const { addNotification } = useNotifications();

    // --- State: Provider ---
    const [proveedorId, setProveedorId] = useState('');
    const [selectedProveedor, setSelectedProveedor] = useState<any | null>(null);
    const [proveedorSearch, setProveedorSearch] = useState('');
    const [proveedorResults, setProveedorResults] = useState<any[]>([]);
    const [isProveedorOpen, setIsProveedorOpen] = useState(false);

    // --- State: Header & Config ---
    const [feccom, setFeccom] = useState(new Date().toISOString().split('T')[0]);
    const [observaciones, setObservaciones] = useState('');
    const [bodegaId, setBodegaId] = useState('');
    const [entradaAlmacen, setEntradaAlmacen] = useState(true);
    const [contabilizaFactura, setContabilizaFactura] = useState(false);

    // Factura fields
    const [numeroFacturaProveedor, setNumeroFacturaProveedor] = useState('');
    const [plazoFactura, setPlazoFactura] = useState(0);
    const [fechaVenceFactura, setFechaVenceFactura] = useState(new Date().toISOString().split('T')[0]);

    // --- New Fields: Fletes & Ajustes ---
    const [fletesCosto, setFletesCosto] = useState<number>(0);
    const [tercerizaFletes, setTercerizaFletes] = useState(false);
    const [ajustePeso, setAjustePeso] = useState<number>(0);
    const [descuentosOtorgados, setDescuentosOtorgados] = useState<number>(0);
    const [fletesMercancia, setFletesMercancia] = useState<number>(0);

    // Config Adicional
    const [redondearDecimales, setRedondearDecimales] = useState(true);
    const [retencionCualquierBase, setRetencionCualquierBase] = useState(false);

    // Retenciones
    const [retefuente, setRetefuente] = useState(false);
    const [retefuenteValor, setRetefuenteValor] = useState(2.5);
    const [reteica, setReteica] = useState(false);
    const [reteicaValor, setReteicaValor] = useState(0);
    const [reteiva, setReteiva] = useState(false);
    const [reteivaValor, setReteivaValor] = useState(0);

    // Cuentas
    const [cuentaRetefuente, setCuentaRetefuente] = useState('COMPRAS 2.5%');
    const [cuentaReteica, setCuentaReteica] = useState('');

    // --- State: Items ---
    const [items, setItems] = useState<DocumentItem[]>([]);
    const [currentProductId, setCurrentProductId] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
    const [currentQuantity, setCurrentQuantity] = useState<number | string>(1);
    const [currentDiscount, setCurrentDiscount] = useState<number | string>(0);
    const [currentCost, setCurrentCost] = useState<number | string>(0);

    const searchRef = useRef<HTMLDivElement>(null);
    const proveedorRef = useRef<HTMLDivElement>(null);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const [productResults, setProductResults] = useState<Producto[]>([]);

    useEffect(() => {
        if (initialData) {
            setProveedorId(initialData.codter);
            setFeccom(initialData.feccom ? new Date(initialData.feccom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
            setObservaciones(initialData.observaciones || '');
            // Load other initial data if editing is fully supported
        }
        if (almacenes.length > 0 && !bodegaId) {
            setBodegaId(String(almacenes[0].id));
        }
    }, [initialData, almacenes]);

    const totals = useMemo(() => {
        let sub = 0;
        let iva = 0;
        items.forEach(item => {
            sub += item.subtotal;
            iva += item.valorIva;
        });

        // Calculations based on image fields
        const baseCompra = sub;
        const totalFletes = Number(fletesMercancia) || 0;
        const ajuste = Number(ajustePeso) || 0;
        const descuentos = Number(descuentosOtorgados) || 0;

        let subtotalConAjustes = baseCompra + ajuste + totalFletes - descuentos;

        // Final Tax (Using calculated IVA from items)
        const totalIva = iva;

        // TOTAL ORDEN
        const totalOrden = subtotalConAjustes + totalIva;

        // Retenciones
        // ReteFuente: Base * %
        const valRetF = retefuente ? (baseCompra * (retefuenteValor / 100)) : 0;

        // ReteICA: Base * ‰ (Milaje)
        // User explicitly noted the per-mille symbol, ensuring calculation matches (division by 1000)
        const valRetIca = reteica ? (baseCompra * (reteicaValor / 1000)) : 0;

        // ReteIVA: IVA * % (Generic approach, usually % of IVA value, not base)
        // Assuming reteivaValor entered as %, e.g. 15%
        const valRetIva = reteiva ? (iva * (reteivaValor / 100)) : 0;

        const totalRetenciones = valRetF + valRetIca + valRetIva;
        const totalFactura = totalOrden - totalRetenciones;

        return {
            subtotal: sub,
            ivaValor: iva,
            total: totalOrden,
            baseCompra,
            totalFletes,
            ajuste,
            descuentos,
            totalRetenciones,
            totalFactura,
            valRetF,
            valRetIca,
            valRetIva
        };
    }, [items, fletesMercancia, ajustePeso, descuentosOtorgados, retefuente, retefuenteValor, reteica, reteicaValor, reteiva, reteivaValor]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsProductDropdownOpen(false);
            }
            if (proveedorRef.current && !proveedorRef.current.contains(event.target as Node)) {
                setIsProveedorOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ... (Search effects omitted - rely on existing if not changing) ...
    // Note: Re-inserting the existing useEffects for search to ensure code integrity as they were in the middle

    useEffect(() => {
        const controller = new AbortController();
        const handler = setTimeout(async () => {
            const q = proveedorSearch.trim();
            if (q.length >= 2 && (!selectedProveedor || selectedProveedor.razonSocial !== q)) {
                try {
                    const resp = await apiSearchProveedores(q, 20);
                    if (resp.success && resp.data) {
                        setProveedorResults(resp.data);
                        setIsProveedorOpen(true);
                    } else {
                        setProveedorResults([]);
                    }
                } catch (error) {
                    console.error('Error searching providers:', error);
                }
            } else {
                if (!q) setIsProveedorOpen(false);
            }
        }, 300);
        return () => { clearTimeout(handler); controller.abort(); };
    }, [proveedorSearch, selectedProveedor]);

    useEffect(() => {
        const controller = new AbortController();
        const handler = setTimeout(async () => {
            const q = productSearchTerm.trim();
            if (q.length >= 2) {
                try {
                    // Pass the selected warehouse ID to get accurate costs
                    const activeBodega = bodegaId || selectedSede?.codigo || '001';
                    const resp = await apiSearchProductos(q, 20, activeBodega);
                    if (resp.success && resp.data) {
                        const productsInList = new Set(items.map(i => i.productoId));
                        const mapped = (resp.data as any[]).map(p => ({
                            ...p,
                            nombre: p.nombre || p.nomins,
                            unidadMedida: p.unidadMedida || p.unidadMedidaNombre || '',
                            ultimoCosto: p.ultimoCosto || 0,
                            costoInventario: p.costoInventario, // Use the warehouse specific cost if available
                            tasaIva: p.tasaIva || 0
                        })).filter(p => !productsInList.has(p.codins || p.id)); // Use codins for uniqueness check if available
                        setProductResults(mapped);
                    }
                } catch (error) {
                    console.error('Error searching products:', error);
                }
            }
        }, 300);
        return () => { clearTimeout(handler); controller.abort(); };
    }, [productSearchTerm, items, bodegaId, selectedSede]); // Add bodegaId dependency

    const handleProveedorSelect = (prov: any) => {
        setProveedorId(prov.numeroDocumento || prov.codter);
        setSelectedProveedor(prov);
        setProveedorSearch(prov.nombreCompleto || prov.razonSocial);
        setIsProveedorOpen(false);
        if (prov.plazo) setPlazoFactura(prov.plazo);
    };

    const handleProductSelect = (product: Producto) => {
        // Use codins if available as the identifier, logic mandates 'codins' for backend
        const productId = (product as any).codins || String(product.id);
        setCurrentProductId(productId);
        setSelectedProduct(product);
        setProductSearchTerm(product.nombre);

        // Priority: CostoInventario (ucoins) > UltimoCosto > 0
        const selectedCost = (product as any).costoInventario || product.ultimoCosto || 0;
        setCurrentCost(selectedCost);

        setIsProductDropdownOpen(false);
    };

    const handleAddItem = () => {
        if (!selectedProduct) {
            addNotification({ type: 'warning', message: 'Seleccione un producto.' });
            return;
        }
        const qty = Number(currentQuantity);
        const cost = Number(currentCost);
        const discount = Number(currentDiscount);

        if (!qty || qty <= 0) return;

        const subtotalBruto = cost * qty;
        const discountVal = subtotalBruto * (discount / 100);
        const subtotalNeto = subtotalBruto - discountVal;
        const tasaIva = selectedProduct.tasaIva || 0;
        const taxVal = subtotalNeto * (tasaIva / 100);
        const totalLine = subtotalNeto + taxVal;

        const newItem: DocumentItem = {
            productoId: (selectedProduct as any).codins || selectedProduct.id,
            descripcion: selectedProduct.nombre,
            cantidad: qty,
            precioUnitario: cost,
            ivaPorcentaje: tasaIva,
            descuentoPorcentaje: discount,
            subtotal: parseFloat(subtotalNeto.toFixed(2)),
            valorIva: parseFloat(taxVal.toFixed(2)),
            total: parseFloat(totalLine.toFixed(2)),
            unidadMedida: selectedProduct.unidadMedida || 'Und'
        };

        (newItem as any).referencia = (selectedProduct as any).referencia || (selectedProduct as any).refins;

        setItems([...items, newItem]);
        setSelectedProduct(null);
        setProductSearchTerm('');
        setCurrentQuantity(1);
        setCurrentCost(0);
        setCurrentDiscount(0);
    };

    const handleRemoveItem = (id: number) => {
        setItems(items.filter(i => i.productoId !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!proveedorId || items.length === 0) {
            addNotification({ type: 'warning', message: 'Complete la info requerida.' });
            return;
        }

        onSubmit({
            codter: proveedorId,
            items,
            subtotal: totals.subtotal,
            ivaValor: totals.ivaValor,
            total: totals.total,
            totals: {
                subtotal: totals.subtotal,
                iva: totals.ivaValor,
                total: totals.total,
                descuentos: descuentosOtorgados
            },
            observaciones,
            feccom,
            proveedor: selectedProveedor,
            codalm: bodegaId || selectedSede?.codigo || '001',
            bodegaId,
            entradaAlmacen,
            contabilizaFactura,
            numeroFacturaProveedor,
            plazoFactura,
            fechaVenceFactura,
            valret: totals.totalRetenciones,
            valfletes: fletesMercancia,
            valajuste: ajustePeso,
            valdescuentos: descuentosOtorgados,
            tercerizaFletes,
            fletesCosto,
            retenciones: {
                retefuente, retefuenteValor,
                reteica, reteicaValor,
                reteiva, reteivaValor
            },
            cuentas: {
                retefuente: cuentaRetefuente,
                reteica: cuentaReteica
            }
        } as any);
    };

    const Label = ({ children }: { children: React.ReactNode }) => (
        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            {children}
        </label>
    );

    const inputClass = "w-full h-9 px-3 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow";
    const readOnlyClass = "w-full h-9 px-3 text-sm border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 cursor-default";

    // Improved Toggle Button Component
    const RetentionToggle = ({
        label,
        active,
        onToggle,
        value,
        onValueChange,
        unit,
        showInput = true
    }: {
        label: string,
        active: boolean,
        onToggle: (v: boolean) => void,
        value?: number,
        onValueChange?: (v: number) => void,
        unit?: string,
        showInput?: boolean
    }) => (
        <div className={`
            flex items-center justify-between p-2 rounded-lg border transition-all duration-200
            ${active
                ? 'bg-blue-50/80 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:shadow-[0_0_10px_rgba(59,130,246,0.1)]'
                : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}
        `}>
            <div className="flex items-center gap-3 cursor-pointer select-none overflow-hidden" onClick={() => onToggle(!active)}>
                <div className={`
                    w-10 h-6 flex-shrink-0 rounded-full p-1 transition-colors duration-200 flex items-center
                    ${active ? 'bg-blue-600 dark:bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}
                `}>
                    <div className={`
                        w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200
                        ${active ? 'translate-x-4' : 'translate-x-0'}
                    `} />
                </div>
                <span className={`text-xs font-semibold truncate ${active ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400'}`}>
                    {label}
                </span>
            </div>

            {active && showInput && (
                <div className="flex items-center gap-1 animate-fadeIn flex-shrink-0">
                    <input
                        type="number"
                        value={value}
                        onChange={e => onValueChange && onValueChange(Number(e.target.value))}
                        className="w-16 h-7 text-xs text-right border border-blue-200 dark:border-blue-800 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 px-1 font-mono"
                    />
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{unit}</span>
                </div>
            )}
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="space-y-6">

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* --- LEFT: PROVIDER INFO --- */}
                <div className="xl:col-span-7 flex flex-col h-full">
                    <Card className="flex-1 p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100 dark:border-slate-700">
                            <i className="fas fa-truck text-blue-500 mb-0.5"></i>
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                                Información del Proveedor
                            </h3>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                                <div className="sm:col-span-8 relative" ref={proveedorRef}>
                                    <Label>Buscar Proveedor / Razón Social</Label>
                                    <div className="relative">
                                        <i className="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                                        <input
                                            type="text"
                                            value={proveedorSearch}
                                            onChange={e => {
                                                setProveedorSearch(e.target.value);
                                                setIsProveedorOpen(true);
                                                if (!e.target.value) { setSelectedProveedor(null); setProveedorId(''); }
                                            }}
                                            placeholder="Buscar..."
                                            className={`${inputClass} pl-9`}
                                        />
                                    </div>
                                    {isProveedorOpen && proveedorResults.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-xl rounded-md max-h-60 overflow-y-auto">
                                            {proveedorResults.map(p => (
                                                <div
                                                    key={p.id}
                                                    className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-50/50 dark:border-slate-700/50 last:border-0"
                                                    onClick={() => handleProveedorSelect(p)}
                                                >
                                                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{p.nombreCompleto || p.razonSocial}</div>
                                                    <div className="text-xs text-slate-500 mt-0.5 flex justify-between">
                                                        <span>NIT: {p.numeroDocumento}</span>
                                                        <span>{p.ciudad}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="sm:col-span-4">
                                    <Label>NIT / Documento</Label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={selectedProveedor?.numeroDocumento || ''}
                                        className={readOnlyClass}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                                <div className="sm:col-span-4">
                                    <Label>Ciudad</Label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={selectedProveedor?.ciudad || ''}
                                        className={readOnlyClass}
                                    />
                                </div>
                                <div className="sm:col-span-8">
                                    <Label>Dirección</Label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={selectedProveedor?.direccion || ''}
                                        className={readOnlyClass}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                                <div className="sm:col-span-6">
                                    <Label>Teléfono / Celular</Label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={[selectedProveedor?.telefono, selectedProveedor?.celular].filter(Boolean).join(' / ') || ''}
                                        className={readOnlyClass}
                                    />
                                </div>
                                <div className="sm:col-span-6">
                                    <Label>Email</Label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={selectedProveedor?.email || ''}
                                        className={`${readOnlyClass} truncate`}
                                        title={selectedProveedor?.email}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="col-span-1 sm:col-span-1">
                                    <Label>Plazo (Días)</Label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={selectedProveedor?.diasCredito || selectedProveedor?.plazo || '0'}
                                        className={`${readOnlyClass} text-center font-mono`}
                                    />
                                </div>
                                <div className="col-span-1 sm:col-span-3">
                                    <Label>Régimen Tributario</Label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={selectedProveedor?.regimen_tributario || selectedProveedor?.regimenTributario || 'No definido'}
                                        className={readOnlyClass}
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* --- RIGHT: ORDER SETTINGS --- */}
                <div className="xl:col-span-5 flex flex-col h-full">
                    <Card className="flex-1 p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100 dark:border-slate-700">
                            <i className="fas fa-cogs text-emerald-500 mb-0.5"></i>
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                                Configuración de Compra
                            </h3>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-4">
                                <div>
                                    <Label>Sede que recibe</Label>
                                    <div className="flex items-center px-3 h-9 bg-slate-100 dark:bg-slate-700/50 rounded-md border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300">
                                        <i className="fas fa-building mr-2 text-slate-400"></i>
                                        {selectedSede?.nombre || 'Sede Principal'}
                                    </div>
                                </div>
                                <div>
                                    <Label>Bodega Destino</Label>
                                    <select
                                        value={bodegaId}
                                        onChange={e => setBodegaId(e.target.value)}
                                        className={inputClass}
                                    >
                                        {almacenes.map(a => (
                                            <option key={a.id} value={a.id}>{a.codigo} - {a.nombre.replace(/MULTIACABADOS\s*-\s*/i, '')}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Nº Compra</Label>
                                    <input
                                        type="text"
                                        disabled
                                        placeholder="Automático"
                                        className={`${readOnlyClass} text-center italic text-slate-500`}
                                    />
                                </div>
                                <div>
                                    <Label>Fecha Emisión</Label>
                                    <input
                                        type="date"
                                        value={feccom}
                                        onChange={e => setFeccom(e.target.value)}
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <RetentionToggle
                                    label="Entrada Almacén"
                                    active={entradaAlmacen}
                                    onToggle={setEntradaAlmacen}
                                    showInput={false}
                                />
                                <RetentionToggle
                                    label="Factura Prov."
                                    active={contabilizaFactura}
                                    onToggle={setContabilizaFactura}
                                    showInput={false}
                                />
                            </div>

                            {contabilizaFactura && (
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 animate-fadeIn">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-1">
                                            <Label>Nº Factura</Label>
                                            <input type="text" value={numeroFacturaProveedor} onChange={e => setNumeroFacturaProveedor(e.target.value)} className={inputClass} />
                                        </div>
                                        <div className="col-span-2">
                                            <Label>Vencimiento</Label>
                                            <div className="flex gap-2">
                                                <input type="number" placeholder="Días" value={plazoFactura} onChange={e => setPlazoFactura(Number(e.target.value))} className={`${inputClass} w-16 px-1 text-center`} />
                                                <input type="date" value={fechaVenceFactura} onChange={e => setFechaVenceFactura(e.target.value)} className={inputClass} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                                <Label>Retenciones</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <RetentionToggle
                                        label="ReteFuente"
                                        active={retefuente}
                                        onToggle={setRetefuente}
                                        value={retefuenteValor}
                                        onValueChange={setRetefuenteValor}
                                        unit="%"
                                    />
                                    <RetentionToggle
                                        label="ReteICA"
                                        active={reteica}
                                        onToggle={setReteica}
                                        value={reteicaValor}
                                        onValueChange={setReteicaValor}
                                        unit="%"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* --- BOTTOM: ITEMS CARD --- */}
            <Card className="p-0 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Detalle de Productos</h3>
                    <div className="w-64">
                        <input
                            type="text"
                            value={observaciones}
                            onChange={e => setObservaciones(e.target.value)}
                            placeholder="Observaciones generales..."
                            className="w-full h-8 text-xs border border-slate-300 rounded px-2 bg-white dark:bg-slate-700 dark:border-slate-600"
                        />
                    </div>
                </div>

                <div className="p-5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex flex-col gap-4">
                        <Label className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold">Selecciona los Productos</Label>
                        <div className="grid grid-cols-12 gap-3 items-end">
                            {/* Producto Search */}
                            <div className="col-span-12 xl:col-span-4 relative" ref={searchRef}>
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1.5 block tracking-wide">Nombre del Producto</label>
                                <input
                                    type="text"
                                    value={productSearchTerm}
                                    onChange={e => { setProductSearchTerm(e.target.value); setIsProductDropdownOpen(true); }}
                                    onFocus={() => setIsProductDropdownOpen(true)}
                                    placeholder="Buscar insumo..."
                                    className="w-full h-10 bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded px-3 text-slate-800 dark:text-slate-200 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-400 dark:placeholder-slate-600 transition-all outline-none"
                                />
                                {isProductDropdownOpen && productResults.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 shadow-xl rounded-md max-h-60 overflow-y-auto ring-1 ring-black/5">
                                        {productResults.map(p => (
                                            <div
                                                key={p.id}
                                                className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-0 group"
                                                onClick={() => handleProductSelect(p)}
                                            >
                                                <div className="font-medium text-sm text-slate-700 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{p.nombre}</div>
                                                <div className="text-xs text-slate-500 flex justify-between mt-0.5">
                                                    <span>Ref: {(p as any).referencia || '-'}</span>
                                                    <span className="font-mono text-slate-400">${(p.costoInventario || p.ultimoCosto || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Unidad */}
                            <div className="col-span-6 xl:col-span-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1.5 block tracking-wide text-center">Unidad</label>
                                <div className="h-10 bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded flex items-center justify-center text-slate-600 dark:text-slate-300 text-sm font-medium">
                                    {selectedProduct?.unidadMedida || ''}
                                </div>
                            </div>

                            {/* IVA % */}
                            <div className="col-span-6 xl:col-span-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1.5 block tracking-wide text-center">IVA %</label>
                                <div className="h-10 bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded flex items-center justify-center text-slate-600 dark:text-slate-300 text-sm font-medium font-mono">
                                    {selectedProduct?.tasaIva || 0}
                                </div>
                            </div>

                            {/* Cantidad */}
                            <div className="col-span-6 xl:col-span-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1.5 block tracking-wide text-center">Cantidad</label>
                                <input
                                    type="number"
                                    value={currentQuantity}
                                    onChange={e => setCurrentQuantity(e.target.value)}
                                    className="w-full h-10 bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded px-3 text-slate-800 dark:text-white text-sm text-center font-bold focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                                />
                            </div>

                            {/* Costo Unitario */}
                            <div className="col-span-6 xl:col-span-2">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1.5 block tracking-wide">Vr. Unitario</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400 text-xs">$</span>
                                    <input
                                        type="number"
                                        value={currentCost}
                                        onChange={e => setCurrentCost(e.target.value)}
                                        className="w-full h-10 bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded pl-7 pr-3 text-slate-800 dark:text-slate-200 text-sm text-right font-mono focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Desc % */}
                            <div className="col-span-6 xl:col-span-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1.5 block tracking-wide text-center">Desc %</label>
                                <input
                                    type="number"
                                    value={currentDiscount}
                                    onChange={e => setCurrentDiscount(e.target.value)}
                                    className="w-full h-10 bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded px-3 text-slate-800 dark:text-slate-200 text-sm text-center focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                                />
                            </div>

                            {/* Total Preview */}
                            <div className="col-span-6 xl:col-span-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1.5 block tracking-wide">Vr. Total</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400 text-xs">$</span>
                                    <input
                                        type="text"
                                        readOnly
                                        value={(() => {
                                            const c = Number(currentCost) || 0;
                                            const q = Number(currentQuantity) || 0;
                                            const d = Number(currentDiscount) || 0;
                                            const sub = c * q;
                                            const desc = sub * (d / 100);
                                            const ivaPct = selectedProduct?.tasaIva || 0;
                                            const tax = (sub - desc) * (ivaPct / 100);
                                            return (sub - desc + tax).toLocaleString('es-CO', { maximumFractionDigits: 0 });
                                        })()}
                                        className="w-full h-10 bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded pl-7 pr-3 text-cyan-600 dark:text-cyan-400 text-sm font-bold text-right font-mono focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Add Button */}
                            <div className="col-span-12 xl:col-span-1">
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    disabled={!selectedProduct}
                                    className="w-full h-10 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md font-bold text-sm shadow-lg shadow-cyan-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <i className="fas fa-plus"></i> <span className="xl:hidden">Agregar</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto bg-white dark:bg-slate-800">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-[#2d3a4f] text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
                                <th className="px-3 py-3 text-center border-r border-slate-200 dark:border-slate-600/50 uppercase font-bold tracking-wider w-24">Ref</th>
                                <th className="px-3 py-3 border-r border-slate-200 dark:border-slate-600/50 uppercase font-bold tracking-wider">Nombre Producto</th>
                                <th className="px-3 py-3 text-center border-r border-slate-200 dark:border-slate-600/50 uppercase font-bold tracking-wider w-16">Und</th>
                                <th className="px-3 py-3 text-center border-r border-slate-200 dark:border-slate-600/50 uppercase font-bold tracking-wider w-16">% IVA</th>
                                <th className="px-3 py-3 text-center border-r border-slate-200 dark:border-slate-600/50 uppercase font-bold tracking-wider w-16">Cant</th>
                                <th className="px-3 py-3 text-right border-r border-slate-200 dark:border-slate-600/50 uppercase font-bold tracking-wider w-32">V. Unitario</th>
                                <th className="px-3 py-3 text-center border-r border-slate-200 dark:border-slate-600/50 uppercase font-bold tracking-wider w-16">% Desc</th>
                                <th className="px-3 py-3 text-right border-r border-slate-200 dark:border-slate-600/50 uppercase font-bold tracking-wider w-24">Descuento</th>
                                <th className="px-3 py-3 text-right border-r border-slate-200 dark:border-slate-600/50 uppercase font-bold tracking-wider w-24">Fletes</th>
                                <th className="px-3 py-3 text-right bg-slate-50 dark:bg-slate-700/50 uppercase font-bold tracking-wider w-32 text-cyan-600 dark:text-cyan-400">Total</th>
                                <th className="px-2 py-3 text-center w-8"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-4 py-12 text-center text-slate-500 italic bg-white dark:bg-[#1e293b]">
                                        No hay productos agregados a la lista
                                    </td>
                                </tr>
                            ) : items.map((item, idx) => {
                                const bruto = item.cantidad * item.precioUnitario;
                                const descVal = bruto * (item.descuentoPorcentaje / 100);
                                return (
                                    <tr key={`${item.productoId}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors bg-white dark:bg-[#1e293b]">
                                        <td className="px-3 py-3 text-center font-mono text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-slate-700/50 text-[11px]">{(item as any).referencia || '-'}</td>
                                        <td className="px-3 py-3 font-bold text-slate-700 dark:text-slate-200 border-r border-slate-100 dark:border-slate-700/50">{item.descripcion}</td>
                                        <td className="px-3 py-3 text-center text-slate-500 dark:text-slate-500 border-r border-slate-100 dark:border-slate-700/50 uppercase text-[11px]">{item.unidadMedida}</td>
                                        <td className="px-3 py-3 text-center text-slate-500 dark:text-slate-500 border-r border-slate-100 dark:border-slate-700/50">{item.ivaPorcentaje}%</td>
                                        <td className="px-3 py-3 text-center font-bold text-slate-800 dark:text-white border-r border-slate-100 dark:border-slate-700/50">{item.cantidad}</td>
                                        <td className="px-3 py-3 text-right font-mono text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-slate-700/50">${item.precioUnitario.toLocaleString()}</td>
                                        <td className="px-3 py-3 text-center text-slate-500 dark:text-slate-500 border-r border-slate-100 dark:border-slate-700/50">{item.descuentoPorcentaje > 0 ? item.descuentoPorcentaje : 0}</td>
                                        <td className="px-3 py-3 text-right font-mono text-slate-500 dark:text-slate-500 border-r border-slate-100 dark:border-slate-700/50">${descVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td className="px-3 py-3 text-right font-mono text-slate-500 dark:text-slate-500 border-r border-slate-100 dark:border-slate-700/50">$0</td>
                                        <td className="px-3 py-3 text-right font-bold text-cyan-600 dark:text-cyan-400 font-mono bg-slate-50 dark:bg-slate-700/20">${item.total.toLocaleString()}</td>
                                        <td className="px-2 py-3 text-center">
                                            <button
                                                onClick={() => handleRemoveItem(item.productoId)}
                                                className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors"
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* --- BOTTOM: TOTALS & ADJUSTMENTS --- */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start pt-4">

                {/* --- Left: Fletes, Ajustes & Archivos --- */}
                <div className="xl:col-span-7 space-y-6">

                    {/* Datos de Fletes */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-5 border border-slate-200 dark:border-slate-700/50">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider">Datos de Fletes</h4>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                            <div className="sm:col-span-7">
                                <Label>Valor Fletes (Costo)</Label>
                                <div className="relative mt-1">
                                    <span className="absolute left-3 top-2.5 text-slate-400">$</span>
                                    <input
                                        type="number"
                                        value={fletesCosto}
                                        onChange={e => setFletesCosto(Number(e.target.value))}
                                        className={`${inputClass} pl-7 text-right font-medium`}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="sm:col-span-5">
                                <div
                                    className={`flex items-center justify-between px-4 py-2.5 rounded-lg border cursor-pointer group transition-all duration-200 ${tercerizaFletes
                                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                                        : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600'
                                        }`}
                                    onClick={() => setTercerizaFletes(!tercerizaFletes)}
                                >
                                    <span className={`text-xs font-bold uppercase transition-colors ${tercerizaFletes ? 'text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-300'}`}>
                                        Terceriza Fletes
                                    </span>
                                    <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${tercerizaFletes ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                        <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${tercerizaFletes ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Ajustes Adicionales */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-5 border border-slate-200 dark:border-slate-700/50">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider">Ajustes Adicionales</h4>

                        <div className="space-y-3">
                            {/* Ajuste al Peso */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                                <div className="sm:col-span-5">
                                    <Label>Ajuste al Peso</Label>
                                </div>
                                <div className="sm:col-span-7">
                                    <input
                                        type="number"
                                        value={ajustePeso}
                                        onChange={e => setAjustePeso(Number(e.target.value))}
                                        className={`${inputClass} text-right`}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Descuentos */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                                <div className="sm:col-span-5">
                                    <Label>Descuentos Otorgados</Label>
                                </div>
                                <div className="sm:col-span-7 relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400">$</span>
                                    <input
                                        type="number"
                                        value={descuentosOtorgados}
                                        onChange={e => setDescuentosOtorgados(Number(e.target.value))}
                                        className={`${inputClass} pl-7 text-right text-red-500 font-medium`}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Fletes Mercancia */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                                <div className="sm:col-span-5">
                                    <Label>Fletes de Mercancía</Label>
                                </div>
                                <div className="sm:col-span-7">
                                    <input
                                        type="number"
                                        value={fletesMercancia}
                                        onChange={e => setFletesMercancia(Number(e.target.value))}
                                        className={`${inputClass} text-right`}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Archivos */}
                    <div className="group border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500/70 rounded-xl p-8 text-center transition-all cursor-pointer bg-slate-50 dark:bg-slate-800/30 hover:bg-white dark:hover:bg-slate-800/60">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                <i className="fas fa-cloud-upload-alt text-slate-400 dark:text-slate-500 text-xl group-hover:text-sky-500 dark:group-hover:text-sky-400"></i>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:text-sky-600 dark:group-hover:text-sky-400">Subir Archivos</h4>
                                <p className="text-xs text-slate-400 mt-1">Arrastra documentos o haz clic aquí</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Right: Totales --- */}
                <div className="xl:col-span-5">
                    <Card className="overflow-hidden border border-slate-200 dark:border-0 shadow-lg bg-white dark:bg-[#1e293b] text-slate-800 dark:text-white dark:ring-1 dark:ring-white/10">
                        {/* Header */}
                        <div className="bg-slate-50 dark:bg-[#0f172a]/50 p-6 border-b border-slate-100 dark:border-white/5 text-center">
                            <h3 className="text-xl font-bold text-sky-600 dark:text-sky-400 tracking-tight">Totales de la Compra</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wide opacity-70">Resumen Financiero</p>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Base de Compra */}
                            <div className="flex justify-between items-center group">
                                <span className="text-sm text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">Base de Compra</span>
                                <span className="font-mono text-slate-700 dark:text-slate-200">{totals.baseCompra.toLocaleString()}</span>
                            </div>

                            {/* Ajuste al peso */}
                            <div className="flex justify-between items-center group border-b border-slate-100 dark:border-white/5 pb-4">
                                <span className="text-sm text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">Ajuste al peso</span>
                                <div className="flex items-center gap-2 font-mono text-slate-700 dark:text-slate-200">
                                    <span className="text-slate-400 dark:text-slate-600 text-xs">$</span>
                                    <span>{totals.ajuste.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Total Fletes */}
                            <div className="flex justify-between items-center group pt-1">
                                <span className="text-sm text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">Total Fletes</span>
                                <div className="flex items-center gap-2 font-mono text-slate-700 dark:text-slate-200">
                                    <span className="text-slate-400 dark:text-slate-600 text-xs">$</span>
                                    <span>{totals.totalFletes.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Total IVA */}
                            <div className="flex justify-between items-center group border-b border-slate-100 dark:border-white/5 pb-4">
                                <span className="text-sm text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">Total IVA</span>
                                <span className="font-mono text-slate-700 dark:text-slate-200">{totals.ivaValor.toLocaleString()}</span>
                            </div>

                            {/* Total Orden Button */}
                            <div className="pt-2 pb-2">
                                <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/20 rounded-xl p-4 flex justify-between items-center">
                                    <span className="text-sky-600 dark:text-sky-400 font-bold text-sm uppercase tracking-wide">Total Orden</span>
                                    <span className="text-2xl font-bold text-sky-700 dark:text-white font-mono tracking-tight">{totals.total.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Retenciones Box */}
                            <div className="bg-slate-50 dark:bg-[#0f172a]/30 rounded-lg p-4 space-y-3 border border-slate-100 dark:border-white/5">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-tight">Retefuente</span>
                                    <span className="font-mono text-sm text-slate-600 dark:text-slate-400">{totals.valRetF.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-tight">Rete. ICA</span>
                                    <span className="font-mono text-sm text-slate-600 dark:text-slate-400">{totals.valRetIca.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-tight">Rete. IVA</span>
                                    <span className="font-mono text-sm text-slate-600 dark:text-slate-400">{totals.valRetIva.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Total Factura */}
                            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-white/10 m-0">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase">Total Factura</span>
                                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">{totals.totalFactura.toLocaleString()}</span>
                            </div>

                            {/* Flags */}
                            <div className="pt-4 flex justify-end gap-5">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={retencionCualquierBase}
                                            onChange={e => setRetencionCualquierBase(e.target.checked)}
                                            className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 checked:border-sky-500 checked:bg-sky-500 transition-all"
                                        />
                                        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                                            <i className="fas fa-check text-[10px]"></i>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors select-none">Ret. s/base</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={redondearDecimales}
                                            onChange={e => setRedondearDecimales(e.target.checked)}
                                            className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 checked:border-sky-500 checked:bg-sky-500 transition-all"
                                        />
                                        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                                            <i className="fas fa-check text-[10px]"></i>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors select-none">Redondear</span>
                                </label>
                            </div>

                        </div>
                    </Card>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700 mt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-5 py-2 text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-sm font-medium transition-shadow shadow-sm"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={items.length === 0 || !proveedorId}
                    className="px-8 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                    Guardar
                </button>
            </div>
        </form>
    );
};

export default OrdenCompraForm;
