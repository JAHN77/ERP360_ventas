import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DocumentItem, Producto, Pedido } from '../../types';
import { useData } from '../../hooks/useData';
import { useNotifications } from '../../hooks/useNotifications';
import { isPositiveInteger, isWithinRange } from '../../utils/validation';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
}

interface PedidoEditFormProps {
    initialData: Pedido;
    onSubmit: (data: Pick<Pedido, 'items' | 'subtotal' | 'ivaValor' | 'total'>) => void;
    onCancel: () => void;
}

const PedidoEditForm: React.FC<PedidoEditFormProps> = ({ initialData, onSubmit, onCancel }) => {
    const { productos } = useData();
    const { addNotification } = useNotifications();
    const [items, setItems] = useState<DocumentItem[]>(initialData.items);
    const [errors, setErrors] = useState<Record<string, { cantidad?: string; descuento?: string }>>({});
    const [stockWarnings, setStockWarnings] = useState<Record<string, string>>({});

    // State for adding new items
    const [currentProductId, setCurrentProductId] = useState('');
    const [currentQuantity, setCurrentQuantity] = useState('1'); // Changed to string for input handling
    const [currentDiscount, setCurrentDiscount] = useState('0'); // New state for discount
    const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);

    // Derived state for validation
    const isQuantityValid = useMemo(() => isPositiveInteger(Number(currentQuantity)), [currentQuantity]);
    const isDiscountValid = useMemo(() => isWithinRange(Number(currentDiscount), 0, 100), [currentDiscount]);

    // Derived calculations for preview
    const currentItemSubtotalForDisplay = useMemo(() => {
        if (!selectedProduct) return 0;
        const qty = Number(currentQuantity) || 0;
        const price = selectedProduct.ultimoCosto;
        const taxRate = (selectedProduct.tasaIva !== undefined) ? Number(selectedProduct.tasaIva) : (selectedProduct.aplicaIva ? 19 : 0);
        const discount = Number(currentDiscount) || 0;

        const subtotal = price * qty;
        const discountAmount = subtotal * (discount / 100);
        const subtotalNeto = subtotal - discountAmount;
        const iva = subtotalNeto * (taxRate / 100);

        return subtotalNeto + iva;
    }, [selectedProduct, currentQuantity, currentDiscount]);

    const searchRef = useRef<HTMLDivElement>(null);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

    const validateItems = (currentItems: DocumentItem[]) => {
        const newErrors: Record<string, { cantidad?: string; descuento?: string }> = {};
        let hasError = false;
        currentItems.forEach(item => {
            if (!isPositiveInteger(item.cantidad)) {
                if (!newErrors[item.productoId]) newErrors[item.productoId] = {};
                newErrors[item.productoId].cantidad = 'Debe ser > 0';
                hasError = true;
            }
            if (!isWithinRange(item.descuentoPorcentaje, 0, 100)) {
                if (!newErrors[item.productoId]) newErrors[item.productoId] = {};
                newErrors[item.productoId].descuento = 'Debe ser 0-100';
                hasError = true;
            }
        });
        setErrors(newErrors);
        return !hasError;
    };

    useEffect(() => {
        validateItems(items);
    }, [items]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsProductDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const filteredProductsForSearch = useMemo(() => {
        const productsInList = new Set(items.map(item => item.productoId));
        const available = [...productos].filter(p => !productsInList.has(p.id));

        const sortedList = available.sort((a, b) => a.nombre.trim().localeCompare(b.nombre.trim()));

        const trimmedSearch = productSearchTerm.trim();
        // Requerir mínimo 2 caracteres para mostrar resultados
        if (!trimmedSearch || trimmedSearch.length < 2) {
            return [];
        }

        const lowercasedTerm = trimmedSearch.toLowerCase();
        return sortedList.filter(p =>
            p.nombre.toLowerCase().includes(lowercasedTerm) ||
            String(p.id).includes(lowercasedTerm)
        );
    }, [productSearchTerm, productos, items]);

    const totals = useMemo(() => {
        let calculatedSubtotalBruto = 0;
        let calculatedDescuentoTotal = 0;
        let calculatedIvaTotal = 0;

        items.forEach(item => {
            const product = productos.find(p => p.id === item.productoId);
            const qty = Number(item.cantidad || 0);
            const price = Number(item.precioUnitario || 0);
            const discountPct = Number(item.descuentoPorcentaje || 0);

            // Priority: Product Catalog (DB) > Item (Saved)
            const taxRate = (product && product.tasaIva !== undefined && product.tasaIva !== null)
                ? Number(product.tasaIva)
                : Number(item.ivaPorcentaje || 0);

            const itemSubtotalBruto = price * qty;
            const itemDiscount = itemSubtotalBruto * (discountPct / 100);
            const itemSubtotalNeto = itemSubtotalBruto - itemDiscount;
            const itemIva = itemSubtotalNeto * (taxRate / 100);

            calculatedSubtotalBruto += itemSubtotalBruto;
            calculatedDescuentoTotal += itemDiscount;
            calculatedIvaTotal += itemIva;
        });

        const subtotalNeto = calculatedSubtotalBruto - calculatedDescuentoTotal;
        const total = subtotalNeto + calculatedIvaTotal;
        return { subtotalBruto: calculatedSubtotalBruto, descuentoTotal: calculatedDescuentoTotal, subtotalNeto, iva: calculatedIvaTotal, total };
    }, [items, productos]); // Logic now depends on productos from DB

    const handleProductSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setProductSearchTerm(e.target.value);
        setIsProductDropdownOpen(true);
        if (currentProductId) {
            setCurrentProductId('');
            setSelectedProduct(null);
        }
    };

    const handleProductSelect = (product: Producto) => {
        setCurrentProductId(String(product.id));
        setSelectedProduct(product);
        setProductSearchTerm(product.nombre);
        setIsProductDropdownOpen(false);
        setCurrentQuantity('1');
        setCurrentDiscount('0');
    };

    const handleItemChange = (productId: number, field: keyof DocumentItem, value: any) => {
        setItems(prevItems => {
            return prevItems.map(item => {
                if (item.productoId === productId) {
                    let processedValue: string | number;

                    if (field === 'cantidad' || field === 'precioUnitario' || field === 'descuentoPorcentaje') {
                        const numericString = String(value).replace(/[^0-9]/g, '');
                        processedValue = numericString === '' ? 0 : parseInt(numericString, 10);

                        if (field === 'descuentoPorcentaje') {
                            processedValue = Math.min(100, processedValue);
                        }
                    } else {
                        processedValue = value;
                    }

                    const newItem = { ...item, [field]: processedValue };

                    // Priority: Product Catalog (DB) > Item (Saved)
                    const product = productos.find(p => p.id === productId);
                    const taxRate = (product && product.tasaIva !== undefined && product.tasaIva !== null)
                        ? Number(product.tasaIva)
                        : Number(newItem.ivaPorcentaje || 0);

                    // Force update the item's tax rate to match the catalog (DB source of truth)
                    if (product && product.tasaIva !== undefined) {
                        newItem.ivaPorcentaje = Number(product.tasaIva);
                    }

                    const totalSinDescuento = newItem.precioUnitario * newItem.cantidad;
                    const montoDescuento = totalSinDescuento * (newItem.descuentoPorcentaje / 100);
                    newItem.subtotal = totalSinDescuento - montoDescuento;
                    newItem.valorIva = newItem.subtotal * (taxRate / 100);
                    newItem.total = newItem.subtotal + newItem.valorIva;

                    if (productos.find(p => p.id === productId) && newItem.cantidad > (productos.find(p => p.id === productId)?.controlaExistencia ?? 0)) {
                        setStockWarnings(prev => ({ ...prev, [`${productId}`]: `${productos.find(p => p.id === productId)?.controlaExistencia ?? 0}` }));
                    } else {
                        setStockWarnings(prev => {
                            const newWarnings = { ...prev };
                            delete newWarnings[`${productId}`];
                            return newWarnings;
                        });
                    }
                    return newItem;
                }
                return item;
            });
        });
    };

    const handleRemoveItem = (productId: number) => {
        setItems(items.filter(item => item.productoId !== productId));
    }

    const handleAddItem = () => {
        const product = productos.find(p => p.id === Number(currentProductId));
        if (!product || !isQuantityValid || !isDiscountValid) return;

        if (items.some(item => item.productoId === product.id)) {
            addNotification({ type: 'info', message: "El producto ya está en la lista. Edítelo en la tabla si desea cambiar la cantidad." });
            return;
        }

        const quantityNum = Number(currentQuantity);
        const discountNum = Number(currentDiscount);

        // Use tasaIva first, fallback to aplicaIva logic
        const taxRate = (product.tasaIva !== undefined && product.tasaIva !== null)
            ? Number(product.tasaIva)
            : (product.aplicaIva ? 19 : 0);

        const price = product.ultimoCosto;
        const subtotalBruto = price * quantityNum;
        const discountAmount = subtotalBruto * (discountNum / 100);
        const subtotalNeto = subtotalBruto - discountAmount;
        const iva = subtotalNeto * (taxRate / 100);

        const newItem: DocumentItem = {
            productoId: product.id,
            descripcion: product.nombre,
            cantidad: quantityNum,
            precioUnitario: price,
            ivaPorcentaje: taxRate,
            descuentoPorcentaje: discountNum,
            subtotal: subtotalNeto,
            valorIva: iva,
            total: subtotalNeto + iva,
        };

        if (product && newItem.cantidad > (product.controlaExistencia ?? 0)) {
            setStockWarnings(prev => ({ ...prev, [`${product.id}`]: `${product.controlaExistencia ?? 0}` }));
        }

        setItems([...items, newItem]);

        // Reset inputs but keep focus on search often helps, but here we just reset
        setCurrentProductId('');
        setSelectedProduct(null);
        setCurrentQuantity('1');
        setCurrentDiscount('0');
        setProductSearchTerm('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validateItems(items)) {
            onSubmit({ items, subtotal: totals.subtotalNeto, ivaValor: totals.iva, total: totals.total });
        }
    }

    const hasErrors = Object.values(errors).some(fieldErrors => Object.keys(fieldErrors).length > 0);
    const canSubmit = items.length > 0 && !hasErrors;

    return (
        <form onSubmit={handleSubmit}>
            {/* Add new item section (Top) */}
            <div className="border-b border-slate-200 dark:border-slate-700 py-4 mb-4">
                <h4 className="text-base font-semibold mb-3 text-slate-800 dark:text-slate-100">Añadir Productos</h4>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-3 items-end">
                    <div ref={searchRef} className="relative lg:col-span-3">
                        <label htmlFor="producto-search" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Producto</label>
                        <input
                            type="text"
                            id="producto-search"
                            value={productSearchTerm}
                            onChange={handleProductSearchChange}
                            onFocus={() => setIsProductDropdownOpen(true)}
                            placeholder="Buscar por nombre..."
                            className="w-full pl-3 pr-8 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoComplete="off"
                            onBlur={() => {
                                const trimmed = productSearchTerm.trim();
                                if (productSearchTerm !== trimmed) {
                                    setProductSearchTerm(trimmed);
                                }
                            }}
                        />
                        {isProductDropdownOpen && productSearchTerm.trim().length >= 2 && (
                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-xl max-h-60 overflow-y-auto">
                                {filteredProductsForSearch.length === 0 ? (
                                    <div className="px-3 py-4 text-sm text-slate-500 italic text-center">
                                        {productSearchTerm.trim().length >= 2 ? `No se encontraron productos con "${productSearchTerm}"` : 'Ingrese al menos 2 caracteres'}
                                    </div>
                                ) : (
                                    filteredProductsForSearch.map(p => (
                                        <div
                                            key={p.id}
                                            onMouseDown={() => handleProductSelect(p)}
                                            className="px-3 py-2.5 text-sm hover:bg-blue-500 hover:text-white cursor-pointer border-b border-slate-200 dark:border-slate-700 last:border-b-0 transition-colors"
                                        >
                                            <div className="font-medium">{p.nombre}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                {formatCurrency(p.ultimoCosto)} | ID: {p.id}
                                                {p.referencia && ` | Ref: ${p.referencia}`}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs text-center font-medium text-slate-600 dark:text-slate-300 mb-1">Unidad</label>
                        <input type="text" value={selectedProduct?.unidadMedida || ''} disabled className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md text-slate-500 text-center cursor-not-allowed" />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs text-center font-medium text-slate-600 dark:text-slate-300 mb-1">Cantidad</label>
                        <input type="text" pattern="[0-9]*" inputMode="numeric" value={currentQuantity} onChange={e => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setCurrentQuantity(val);
                        }} className={`w-full px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-right ${isQuantityValid ? 'border-slate-300 dark:border-slate-600' : 'border-red-500'}`} />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs text-center font-medium text-slate-600 dark:text-slate-300 mb-1">Vr. Unit.</label>
                        <input type="text" value={selectedProduct ? formatCurrency(selectedProduct.ultimoCosto) : formatCurrency(0)} disabled className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md text-slate-500 text-right cursor-not-allowed" />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs text-center font-medium text-slate-600 dark:text-slate-300 mb-1">% Iva</label>
                        <input type="text" value={selectedProduct ? ((selectedProduct.tasaIva !== undefined) ? selectedProduct.tasaIva : (selectedProduct.aplicaIva ? '19' : '0')) : ''} disabled className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md text-slate-500 text-center cursor-not-allowed" />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs text-center font-medium text-slate-600 dark:text-slate-300 mb-1">% Descto</label>
                        <input type="text" pattern="[0-9]*" inputMode="numeric" value={currentDiscount} onChange={e => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setCurrentDiscount(val === '' ? '' : String(Math.min(100, parseInt(val, 10) || 0)));
                        }} className={`w-full px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-right ${isDiscountValid ? 'border-slate-300 dark:border-slate-600' : 'border-red-500'}`} />
                    </div>
                    <div className="lg:col-span-2">
                        <label className="block text-xs text-center font-medium text-slate-600 dark:text-slate-300 mb-1">Total</label>
                        <input type="text" value={formatCurrency(currentItemSubtotalForDisplay)} disabled className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-200 font-bold text-right cursor-not-allowed" />
                    </div>
                    <div className="lg:col-span-2">
                        <button type="button" onClick={handleAddItem} disabled={!currentProductId || !isQuantityValid || !isDiscountValid} className="w-full py-1.5 bg-sky-600 text-white font-semibold rounded-md hover:bg-sky-700 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed whitespace-nowrap text-sm">
                            <i className="fas fa-plus mr-1"></i>Añadir
                        </button>
                    </div>
                </div>

                {/* Stock info shown only if valid quantity and product selected */}
                {isQuantityValid && selectedProduct && (
                    <div className="mt-1 text-xs px-2">
                        <span className="text-slate-500 dark:text-slate-400">Stock disponible: </span>
                        <span className={`font-semibold ${((selectedProduct.stock ?? selectedProduct.controlaExistencia ?? 0)) < Number(currentQuantity) ? 'text-orange-500' : 'text-slate-600 dark:text-slate-300'}`}>
                            {selectedProduct.stock ?? selectedProduct.controlaExistencia ?? 0}
                        </span>
                    </div>
                )}
                {selectedProduct && Number(currentQuantity) > ((selectedProduct.stock ?? selectedProduct.controlaExistencia ?? 0)) && (
                    <div className="w-full flex items-center gap-2 text-orange-500 dark:text-orange-400 text-xs mt-2 p-2 bg-orange-50 dark:bg-orange-900/30 rounded-md border border-orange-200 dark:border-orange-800">
                        <i className="fas fa-exclamation-triangle"></i>
                        <span>Atención: La cantidad solicitada ({currentQuantity}) supera el stock disponible ({selectedProduct.stock ?? selectedProduct.controlaExistencia ?? 0}).</span>
                    </div>
                )}
            </div>

            {/* Items Table */}
            <div className="space-y-6">
                <div className="w-full">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">Items del Pedido</h4>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600">
                            {items.length} productos
                        </span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-700">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Producto</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-24">Unidad</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-28">Cantidad</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">Precio Unit.</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-24">Desc. %</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-20">IVA %</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">Total</th>
                                    <th className="px-4 py-3 text-center w-16">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {items.length > 0 ? (
                                    items.map(item => {
                                        const product = productos.find(p => p.id === item.productoId);
                                        const hasQuantityError = errors[`${item.productoId}`]?.cantidad;
                                        const hasDiscountError = errors[`${item.productoId}`]?.descuento;
                                        return (
                                            <tr key={item.productoId} className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="px-4 py-3 text-sm">
                                                    <div className="font-medium text-slate-800 dark:text-slate-100">{item.descripcion}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">REF: {item.productoId}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase border border-slate-200 dark:border-slate-600">
                                                        {item.unidadMedida || product?.unidadMedida || 'UND'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="relative" title={stockWarnings[`${item.productoId}`] ? `Stock disponible: ${stockWarnings[`${item.productoId}`]}` : ''}>
                                                        <input
                                                            type="text" pattern="[0-9]*" inputMode="numeric"
                                                            value={item.cantidad}
                                                            onChange={e => handleItemChange(item.productoId, 'cantidad', e.target.value)}
                                                            className={`w-full px-2 py-1.5 text-right font-medium text-sm bg-white dark:bg-slate-800 border rounded-md focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${hasQuantityError
                                                                ? 'border-red-500 focus:border-red-500'
                                                                : (stockWarnings[`${item.productoId}`]
                                                                    ? 'border-orange-500 focus:border-orange-500 text-orange-600'
                                                                    : 'border-slate-200 dark:border-slate-600 focus:border-blue-500')
                                                                }`}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="text" pattern="[0-9]*" inputMode="numeric"
                                                        value={item.precioUnitario}
                                                        onChange={e => handleItemChange(item.productoId, 'precioUnitario', e.target.value)}
                                                        className="w-full px-2 py-1.5 text-right text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 dark:text-slate-300"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="relative">
                                                        <input
                                                            type="text" pattern="[0-9]*" inputMode="numeric"
                                                            value={item.descuentoPorcentaje}
                                                            onChange={e => handleItemChange(item.productoId, 'descuentoPorcentaje', e.target.value)}
                                                            className={`w-full pl-2 pr-6 py-1.5 text-right text-sm bg-white dark:bg-slate-800 border rounded-md focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium ${hasDiscountError ? 'border-red-500 focus:border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-blue-500'}`}
                                                        />
                                                        <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[10px] text-slate-400">%</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right text-slate-500 dark:text-slate-400 font-medium">
                                                    {(product && product.tasaIva !== undefined) ? Number(product.tasaIva) : (item.ivaPorcentaje || 0)}%
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right font-bold text-slate-800 dark:text-slate-100">{formatCurrency(item.total)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(item.productoId)}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                        title="Eliminar item"
                                                    >
                                                        <i className="fas fa-trash-alt"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="px-5 py-12 text-center text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/20">
                                            <div className="flex flex-col items-center">
                                                <i className="fas fa-shopping-basket text-4xl mb-3 opacity-20"></i>
                                                <p className="font-medium text-slate-500">No hay productos en el pedido</p>
                                                <p className="text-xs mt-1 opacity-70">Utilice el buscador superior para agregar items</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <div className="w-full sm:w-80 bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
                        <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                            Resumen Económico
                        </h5>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                                <span>Subtotal Bruto:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totals.subtotalBruto)}</span>
                            </div>
                            {totals.descuentoTotal > 0 && (
                                <div className="flex justify-between items-center text-red-500">
                                    <span className="flex items-center gap-1.5"><i className="fas fa-tag text-[10px]"></i> Descuento:</span>
                                    <span className="font-semibold">-{formatCurrency(totals.descuentoTotal)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center pt-1">
                                <span className="font-medium text-slate-600 dark:text-slate-400">Subtotal Neto:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(totals.subtotalNeto)}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                                <span>IVA:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totals.iva)}</span>
                            </div>
                            <div className="flex justify-between items-end pt-3 mt-1 border-t-2 border-slate-100 dark:border-slate-700">
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-base">Total:</span>
                                <span className="font-black text-2xl text-blue-600 dark:text-blue-400 leading-none">{formatCurrency(totals.total)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions Footer */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg hover:shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-2 transition-all"
                >
                    <i className="fas fa-save"></i>
                    Guardar Cambios
                </button>
            </div>
        </form>
    );
};

export default PedidoEditForm;
