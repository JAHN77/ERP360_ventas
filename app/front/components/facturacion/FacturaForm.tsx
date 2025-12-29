import React, { useState, useMemo, useEffect, useRef } from 'react';
// FIX: Imported correct types to resolve module not found errors.
import { DocumentItem, Cliente, Producto } from '../../types';
import Card from '../ui/Card';
import { isPositiveInteger, isWithinRange } from '../../utils/validation';
import { useData } from '../../hooks/useData';
import { useNotifications } from '../../hooks/useNotifications';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

interface FacturaFormData {
    clienteId: string;
    vendedorId: string;
    items: DocumentItem[];
    subtotal: number;
    iva: number;
    total: number;
}

interface FacturaFormProps {
    onSubmit: (data: FacturaFormData) => void;
    onCancel: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
    isSubmitting?: boolean;
}

const FacturaForm: React.FC<FacturaFormProps> = ({ onSubmit, onCancel, onDirtyChange, isSubmitting = false }) => {
    const { clientes, productos, vendedores } = useData();
    const { addNotification } = useNotifications();
    const [clienteId, setClienteId] = useState('');
    const [vendedorId, setVendedorId] = useState('');
    const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
    const [items, setItems] = useState<DocumentItem[]>([]);

    const [currentProductId, setCurrentProductId] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
    const [currentQuantity, setCurrentQuantity] = useState<number | string>(1);
    const [currentDiscount, setCurrentDiscount] = useState<number | string>(0);

    const searchRef = useRef<HTMLDivElement>(null);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

    useEffect(() => {
        if (onDirtyChange) {
            const dirty = clienteId !== '' || items.length > 0;
            onDirtyChange(dirty);
        }
    }, [clienteId, items, onDirtyChange]);

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

    const handleClienteChange = (id: string) => {
        setClienteId(id);
        const cliente = clientes.find(c => c.id === id);
        setSelectedCliente(cliente || null);

        // Auto-select salesperson if linked to client
        if (cliente && cliente.codven) {
            const linkedVendedor = vendedores.find(v => v.codigoVendedor === cliente.codven || v.id === cliente.codven);
            if (linkedVendedor) {
                setVendedorId(linkedVendedor.id);
            }
        }
    };

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
    };

    const handleAddItem = () => {
        const product = productos.find(p => p.id === Number(currentProductId));
        if (!product || !isPositiveInteger(currentQuantity) || !isWithinRange(Number(currentDiscount), 0, 100)) return;

        if (items.some(item => item.productoId === product.id)) {
            addNotification({ type: 'info', message: "El producto ya está en la lista." });
            return;
        }

        const quantityNum = Number(currentQuantity);
        const discountNum = Number(currentDiscount);
        const precioUnitario = product.ultimoCosto;
        const ivaPorcentaje = product.aplicaIva ? 19 : 0;

        const subtotal = (precioUnitario * quantityNum) * (1 - (discountNum / 100));
        const valorIva = subtotal * (ivaPorcentaje / 100);
        const total = subtotal + valorIva;

        const newItem: DocumentItem = {
            productoId: product.id,
            descripcion: product.nombre,
            cantidad: quantityNum,
            precioUnitario: precioUnitario,
            ivaPorcentaje: ivaPorcentaje,
            descuentoPorcentaje: discountNum,
            subtotal: subtotal,
            valorIva: valorIva,
            total: total,
        };

        setItems([...items, newItem]);

        // Reset fields
        setCurrentProductId('');
        setSelectedProduct(null);
        setCurrentQuantity(1);
        setCurrentDiscount(0);
        setProductSearchTerm('');
    };

    const handleRemoveItem = (productId: number) => {
        setItems(items.filter(item => item.productoId !== productId));
    };

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ clienteId, vendedorId, items, subtotal: totals.subtotalNeto, iva: totals.iva, total: totals.total });
    };

    const canSubmit = clienteId && items.length > 0;

    const isQuantityValid = isPositiveInteger(currentQuantity);
    const isDiscountValid = isWithinRange(Number(currentDiscount), 0, 100);

    const getNumericInputClasses = (isValid: boolean) => `w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-2 ${!isValid ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
        }`;


    return (
        <form onSubmit={handleSubmit}>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                    <label htmlFor="cliente" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Cliente</label>
                    <select id="cliente" value={clienteId} onChange={e => handleClienteChange(e.target.value)} required className="w-full pl-3 pr-8 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="" disabled>Seleccione un cliente</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombreCompleto}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="vendedor" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Vendedor</label>
                    <select id="vendedor" value={vendedorId} onChange={e => setVendedorId(e.target.value)} className="w-full pl-3 pr-8 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Sin vendedor (Opcional)</option>
                        {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombreCompleto || v.primerNombre + ' ' + (v.primerApellido || '')}</option>)}
                    </select>
                </div>
                {selectedCliente && (
                    <Card className="p-3 text-sm bg-slate-50 dark:bg-slate-700/50">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">{selectedCliente.nombreCompleto}</p>
                        <p className="text-slate-500 dark:text-slate-400">{selectedCliente.direccion}, {selectedCliente.ciudadId}</p>
                        <p className="text-slate-500 dark:text-slate-400">{selectedCliente.email} | {selectedCliente.telefono}</p>
                    </Card>
                )}
            </div>

            <div className="border-t border-b border-slate-200 dark:border-slate-700 py-4 mb-6">
                <h4 className="text-md font-semibold mb-3 text-slate-800 dark:text-slate-100">Añadir Productos</h4>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-3 items-end">
                    <div ref={searchRef} className="relative lg:col-span-3">
                        <label htmlFor="producto-search" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Producto</label>
                        <input
                            type="text"
                            id="producto-search"
                            value={productSearchTerm}
                            onChange={handleProductSearchChange}
                            onFocus={() => setIsProductDropdownOpen(true)}
                            placeholder="Buscar por nombre o ID..."
                            className="w-full pl-3 pr-8 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoComplete="off"
                        />
                        {isProductDropdownOpen && (
                            <>
                                {productSearchTerm.trim().length >= 2 ? (
                                    filteredProductsForSearch.length > 0 ? (
                                        <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                            {filteredProductsForSearch.map(p => (
                                                <li
                                                    key={p.id}
                                                    onMouseDown={() => handleProductSelect(p)}
                                                    className="px-4 py-2 text-sm text-slate-800 dark:text-slate-200 hover:bg-blue-500 hover:text-white cursor-pointer"
                                                >
                                                    {p.nombre} - {formatCurrency(p.ultimoCosto)} <span className="text-xs text-slate-500 dark:text-slate-400">(ID: {p.id})</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg">
                                            <li className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400">
                                                No se encontraron productos con "{productSearchTerm}"
                                            </li>
                                        </ul>
                                    )
                                ) : (
                                    <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg">
                                        <li className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400">
                                            Ingrese al menos 2 caracteres
                                        </li>
                                    </ul>
                                )}
                            </>
                        )}
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs text-center font-medium text-slate-600 dark:text-slate-300 mb-1">Unidad</label>
                        <input type="text" value={selectedProduct?.unidadMedida || ''} disabled className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md text-slate-500 text-center cursor-not-allowed" />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs text-center font-medium text-slate-600 dark:text-slate-300 mb-1">Cantidad</label>
                        <input type="text" pattern="[0-9]*" inputMode="numeric" id="cantidad" value={currentQuantity} onChange={e => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setCurrentQuantity(val);
                        }} className={`w-full px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-2 ${!isQuantityValid ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'}`} />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs text-center font-medium text-slate-600 dark:text-slate-300 mb-1">Vr. Unit.</label>
                        <input type="text" value={selectedProduct ? formatCurrency(selectedProduct.ultimoCosto) : formatCurrency(0)} disabled className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md text-slate-500 text-right cursor-not-allowed" />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs text-center font-medium text-slate-600 dark:text-slate-300 mb-1">% Iva</label>
                        <input type="text" value={selectedProduct ? (selectedProduct.aplicaIva ? '19' : '0') : ''} disabled className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md text-slate-500 text-center cursor-not-allowed" />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-xs text-center font-medium text-slate-600 dark:text-slate-300 mb-1">% Descto</label>
                        <input type="text" pattern="[0-9]*" inputMode="numeric" id="descuento" value={currentDiscount} onChange={e => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setCurrentDiscount(val === '' ? '' : Math.min(100, parseInt(val, 10) || 0));
                        }} className={`w-full px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-2 ${!isDiscountValid ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'}`} />
                    </div>
                    <div className="lg:col-span-2">
                        <label className="block text-xs text-center font-medium text-slate-600 dark:text-slate-300 mb-1">Total</label>
                        <input type="text" value={selectedProduct ? formatCurrency((selectedProduct.ultimoCosto * Number(currentQuantity || 0)) * (1 - (Number(currentDiscount || 0) / 100)) * (1 + (selectedProduct.aplicaIva ? 0.19 : 0))) : formatCurrency(0)} disabled className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-200 font-bold text-right cursor-not-allowed" />
                    </div>
                    <div className="lg:col-span-2">
                        <button type="button" onClick={handleAddItem} disabled={!currentProductId || !isQuantityValid || !isDiscountValid} className="w-full py-1.5 bg-sky-600 text-white font-semibold rounded-md hover:bg-sky-700 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed whitespace-nowrap text-sm">
                            <i className="fas fa-plus mr-1"></i>Añadir
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="w-full">
                    <h4 className="text-base font-semibold mb-3 text-slate-800 dark:text-slate-100">Items de la Factura</h4>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-700">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Producto</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Cant.</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Precio</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Desc. %</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Total</th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {items.length > 0 ? items.map(item => (
                                    <tr key={item.productoId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="px-4 py-3 text-sm">
                                            <div className="font-medium text-slate-800 dark:text-slate-100">{item.descripcion}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">ID: {item.productoId}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-medium">{item.cantidad}</td>
                                        <td className="px-4 py-3 text-sm text-right text-slate-600 dark:text-slate-400">{formatCurrency(item.precioUnitario)}</td>
                                        <td className="px-4 py-3 text-sm text-right">
                                            <span className={item.descuentoPorcentaje > 0 ? 'text-red-500' : 'text-slate-400'}>
                                                {item.descuentoPorcentaje}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-bold text-slate-800 dark:text-slate-100">{formatCurrency(item.total)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(item.productoId)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                            >
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-slate-500 bg-slate-50/50 dark:bg-slate-800/50">
                                            <div className="flex flex-col items-center gap-2">
                                                <i className="fas fa-receipt text-3xl opacity-20"></i>
                                                <p>Añada productos a la factura utilizando el buscador superior.</p>
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
                        <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Resumen de Facturación</h4>

                        <div className="space-y-3">
                            <div className="flex justify-between text-sm items-center">
                                <span className="text-slate-500 dark:text-slate-400">Subtotal Bruto:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(totals.subtotalBruto)}</span>
                            </div>

                            {totals.descuentoTotal > 0 && (
                                <div className="flex justify-between text-sm items-center">
                                    <span className="text-red-500">Descuento:</span>
                                    <span className="font-semibold text-red-500">-{formatCurrency(totals.descuentoTotal)}</span>
                                </div>
                            )}

                            <div className="flex justify-between text-sm items-center pt-1">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">Subtotal Neto:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(totals.subtotalNeto)}</span>
                            </div>

                            <div className="flex justify-between text-sm items-center">
                                <span className="text-slate-500 dark:text-slate-400">IVA ({items[0]?.ivaPorcentaje || 19}%):</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(totals.iva)}</span>
                            </div>

                            <div className="pt-3 border-t-2 border-slate-100 dark:border-slate-700 mt-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-base font-bold text-slate-800 dark:text-slate-100">Total:</span>
                                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400 leading-none">
                                        {formatCurrency(totals.total)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4">
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-6 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Cancelar</button>
                <button type="submit" disabled={!canSubmit || isSubmitting} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center">
                    {isSubmitting ? (
                        <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Creando Factura...
                        </>
                    ) : (
                        <>
                            <i className="fas fa-save mr-2"></i>
                            Crear Factura
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};

export default FacturaForm;
