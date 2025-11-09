import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DocumentItem, Producto, Pedido } from '../../types';
import { useData } from '../../hooks/useData';
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
    const [items, setItems] = useState<DocumentItem[]>(initialData.items);
    const [errors, setErrors] = useState<Record<string, { cantidad?: string; descuento?: string }>>({});
    const [stockWarnings, setStockWarnings] = useState<Record<string, string>>({});

    // State for adding new items
    const [currentProductId, setCurrentProductId] = useState('');
    const [currentQuantity, setCurrentQuantity] = useState(1);
    const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);

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
        const subtotalBruto = items.reduce((acc, item) => acc + (item.precioUnitario * item.cantidad), 0);
        const descuentoTotal = items.reduce((acc, item) => {
            const itemTotalBruto = item.precioUnitario * item.cantidad;
            return acc + (itemTotalBruto * (item.descuentoPorcentaje / 100));
        }, 0);
        const subtotalNeto = subtotalBruto - descuentoTotal;
        const iva = items.reduce((acc, item) => acc + item.valorIva, 0);
        const total = subtotalNeto + iva;
        return { subtotalBruto, descuentoTotal, subtotalNeto, iva, total };
    }, [items]);
    
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
        setCurrentQuantity(1);
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
                    
                    // Recalculate totals
                    const totalSinDescuento = newItem.precioUnitario * newItem.cantidad;
                    const montoDescuento = totalSinDescuento * (newItem.descuentoPorcentaje / 100);
                    newItem.subtotal = totalSinDescuento - montoDescuento;
                    newItem.valorIva = newItem.subtotal * (newItem.ivaPorcentaje / 100);
                    newItem.total = newItem.subtotal + newItem.valorIva;

                    const product = productos.find(p => p.id === productId);
                    if (product && newItem.cantidad > (product.controlaExistencia ?? 0)) {
                        setStockWarnings(prev => ({...prev, [`${productId}`]: `${product.controlaExistencia ?? 0}`}));
                    } else {
                        setStockWarnings(prev => {
                            const newWarnings = {...prev};
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
        if (!product || !isPositiveInteger(currentQuantity)) return;

        if (items.some(item => item.productoId === product.id)) {
            alert("El producto ya está en la lista.");
            return;
        }

        const quantityNum = Number(currentQuantity);
        const subtotal = product.ultimoCosto * quantityNum;
        const iva = subtotal * ((product.aplicaIva ? 19 : 0) / 100);

        const newItem: DocumentItem = {
            productoId: product.id,
            descripcion: product.nombre,
            cantidad: quantityNum,
            precioUnitario: product.ultimoCosto,
            ivaPorcentaje: product.aplicaIva ? 19 : 0,
            descuentoPorcentaje: 0,
            subtotal: subtotal,
            valorIva: iva,
            total: subtotal + iva,
        };
        
        if (product && newItem.cantidad > (product.controlaExistencia ?? 0)) {
            setStockWarnings(prev => ({...prev, [`${product.id}`]: `${product.controlaExistencia ?? 0}`}));
        }

        setItems([...items, newItem]);
        setCurrentProductId('');
        setSelectedProduct(null);
        setCurrentQuantity(1);
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
            {/* Items Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 mb-6">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase w-2/5 whitespace-nowrap">Producto</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Unidad</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Cantidad</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Precio Unit.</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Desc. %</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">% IVA</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Total</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {items.map(item => {
                            const product = productos.find(p => p.id === item.productoId);
                            const hasQuantityError = errors[`${item.productoId}`]?.cantidad;
                            const hasDiscountError = errors[`${item.productoId}`]?.descuento;
                            return (
                                <tr key={item.productoId}>
                                    <td className="px-3 py-2 text-sm">{item.descripcion}</td>
                                    <td className="px-3 py-2 text-sm">{product?.unidadMedida}</td>
                                    <td className="px-3 py-2 text-sm">
                                        <div className="relative" title={stockWarnings[`${item.productoId}`] ? `Stock disponible: ${stockWarnings[`${item.productoId}`]}` : ''}>
                                            <input 
                                                type="text" pattern="[0-9]*" inputMode="numeric"
                                                value={item.cantidad}
                                                onChange={e => handleItemChange(item.productoId, 'cantidad', e.target.value)}
                                                className={`w-20 px-2 py-1 text-right bg-slate-100 dark:bg-slate-700 border rounded-md ${hasQuantityError ? 'border-red-500' : (stockWarnings[`${item.productoId}`] ? 'border-orange-500' : 'border-slate-300 dark:border-slate-600')}`}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-sm">
                                        <input 
                                            type="text" pattern="[0-9]*" inputMode="numeric"
                                            value={item.precioUnitario}
                                            onChange={e => handleItemChange(item.productoId, 'precioUnitario', e.target.value)}
                                            className="w-28 px-2 py-1 text-right bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md"
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-sm">
                                         <input 
                                            type="text" pattern="[0-9]*" inputMode="numeric"
                                            value={item.descuentoPorcentaje}
                                            onChange={e => handleItemChange(item.productoId, 'descuentoPorcentaje', e.target.value)}
                                            className={`w-20 px-2 py-1 text-right bg-slate-100 dark:bg-slate-700 border rounded-md ${hasDiscountError ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-sm text-right">{item.ivaPorcentaje}</td>
                                    <td className="px-3 py-2 text-sm text-right font-medium">{formatCurrency(item.total)}</td>
                                    <td className="px-3 py-2 text-center">
                                        <button type="button" onClick={() => handleRemoveItem(item.productoId)} className="text-red-500 hover:text-red-700"><i className="fas fa-trash-alt"></i></button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Add new item section */}
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg mb-6">
                <label className="block text-sm text-left font-semibold text-slate-700 dark:text-slate-300 mb-2">Añadir Producto</label>
                <div className="flex items-start gap-3 flex-wrap">
                    <div ref={searchRef} className="relative flex-grow min-w-[250px]">
                        <label className="block text-xs text-left font-medium text-slate-600 dark:text-slate-300 mb-1">Producto</label>
                        <input
                            type="text"
                            value={productSearchTerm}
                            onChange={handleProductSearchChange}
                            onFocus={() => setIsProductDropdownOpen(true)}
                            placeholder="Buscar por nombre o ID..."
                            className="w-full pl-3 pr-8 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md"
                            autoComplete="off"
                        />
                        {isProductDropdownOpen && (
                            <>
                                {productSearchTerm.trim().length >= 2 ? (
                                    filteredProductsForSearch.length > 0 ? (
                                        <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                            {filteredProductsForSearch.map(p => (
                                                <li
                                                    key={p.id}
                                                    onMouseDown={() => handleProductSelect(p)}
                                                    className="px-4 py-2 text-sm text-slate-800 dark:text-slate-200 hover:bg-blue-500 hover:text-white cursor-pointer"
                                                >
                                                    {p.nombre}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg">
                                            <li className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400">
                                                No se encontraron productos con "{productSearchTerm}"
                                            </li>
                                        </ul>
                                    )
                                ) : (
                                    <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg">
                                        <li className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400">
                                            Ingrese al menos 2 caracteres
                                        </li>
                                    </ul>
                                )}
                            </>
                        )}
                         <div className="h-5"></div>
                    </div>
                    <div className="flex-shrink-0 w-24">
                        <label className="block text-xs text-center font-medium text-slate-600 dark:text-slate-300 mb-1">Cantidad</label>
                        <input
                            type="text" pattern="[0-9]*" inputMode="numeric"
                            value={currentQuantity}
                            onChange={e => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setCurrentQuantity(val === '' ? 0 : parseInt(val, 10));
                            }}
                            className="w-full px-2 py-1 text-right bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md"
                        />
                        <div className="h-5">
                            {selectedProduct && (
                                <div className="text-xs text-center mt-1">
                                    <span className="text-slate-500 dark:text-slate-400">Stock: </span>
                                    <span className={`font-semibold ${(selectedProduct.controlaExistencia ?? 0) < currentQuantity ? 'text-orange-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {selectedProduct.controlaExistencia ?? 0}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="self-end">
                        <button type="button" onClick={handleAddItem} disabled={!currentProductId || !isPositiveInteger(currentQuantity)} className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:bg-slate-400">Añadir</button>
                    </div>
                    {selectedProduct && currentQuantity > (selectedProduct.controlaExistencia ?? 0) && (
                        <div className="w-full flex items-center gap-2 text-orange-500 dark:text-orange-400 text-xs mt-2 p-2 bg-orange-50 dark:bg-orange-900/30 rounded-md border border-orange-200 dark:border-orange-800">
                            <i className="fas fa-exclamation-triangle"></i>
                            <span>Atención: La cantidad solicitada ({currentQuantity}) supera el stock disponible ({selectedProduct.controlaExistencia ?? 0}).</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-6">
                 <div className="w-full max-w-sm space-y-2 text-slate-700 dark:text-slate-300 text-sm">
                    <div className="flex justify-between">
                        <span>Subtotal Bruto</span>
                        <span>{formatCurrency(totals.subtotalBruto)}</span>
                    </div>
                    <div className="flex justify-between text-red-600 dark:text-red-500">
                        <span>Descuento</span>
                        <span>-{formatCurrency(totals.descuentoTotal)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t border-slate-300 dark:border-slate-600 pt-2 mt-2">
                        <span>Subtotal Neto</span>
                        <span>{formatCurrency(totals.subtotalNeto)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>IVA (19%)</span>
                        <span>{formatCurrency(totals.iva)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xl border-t-2 border-slate-400 dark:border-slate-500 pt-2 mt-2 text-blue-600 dark:text-blue-400">
                        <span>TOTAL</span>
                        <span>{formatCurrency(totals.total)}</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="pt-5 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4">
                <button type="button" onClick={onCancel} className="px-6 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Cancelar</button>
                <button type="submit" disabled={!canSubmit} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-slate-400">
                    <i className="fas fa-save mr-2"></i>Guardar Cambios
                </button>
            </div>
        </form>
    );
};

export default PedidoEditForm;
