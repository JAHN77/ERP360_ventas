import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DocumentItem, Cliente, Producto, Cotizacion, Vendedor } from '../../types';
import Card from '../ui/Card';
import { isPositiveInteger, isWithinRange } from '../../utils/validation';
import { useData } from '../../hooks/useData';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
}

interface PedidoFormData {
    clienteId: string;
    vendedorId?: string;
    cotizacionId?: string;
    items: DocumentItem[];
    subtotal: number;
    iva: number;
    total: number;
    fechaEntregaEstimada?: string;
    instruccionesEntrega?: string;
}

interface PedidoFormProps {
  onSubmit: (data: PedidoFormData) => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const PedidoForm: React.FC<PedidoFormProps> = ({ onSubmit, onCancel, onDirtyChange }) => {
    const { clientes, cotizaciones, productos, vendedores } = useData();
    const [clienteId, setClienteId] = useState('');
    const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
    const [vendedorId, setVendedorId] = useState('');
    const [selectedVendedor, setSelectedVendedor] = useState<Vendedor | null>(null);
    const [cotizacionId, setCotizacionId] = useState('');
    const [items, setItems] = useState<DocumentItem[]>([]);
    const [fechaEntregaEstimada, setFechaEntregaEstimada] = useState('');
    const [instruccionesEntrega, setInstruccionesEntrega] = useState('');

    const [currentProductId, setCurrentProductId] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
    const [currentQuantity, setCurrentQuantity] = useState<number|string>(1);
    const [currentDiscount, setCurrentDiscount] = useState<number|string>(0);
    
    const searchRef = useRef<HTMLDivElement>(null);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    
    useEffect(() => {
        if (onDirtyChange) {
            const dirty = cotizacionId !== '' || clienteId !== '' || vendedorId !== '' || items.length > 0 || fechaEntregaEstimada !== '' || instruccionesEntrega !== '';
            onDirtyChange(dirty);
        }
    }, [cotizacionId, clienteId, vendedorId, items, fechaEntregaEstimada, instruccionesEntrega, onDirtyChange]);

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
        setSelectedCliente(clientes.find(c => c.id === id) || null);
    };
    
    const handleVendedorChange = (id: string) => {
        setVendedorId(id);
        setSelectedVendedor(vendedores.find(v => v.id === id || v.codiEmple === id) || null);
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
        setCurrentQuantity(1);
    };

    const handleCotizacionChange = (cId: string) => {
        setCotizacionId(cId);
        const cotizacion = cotizaciones.find(c => c.id === cId);
        if(cotizacion) {
            // Llenar cliente y vendedor automáticamente desde la cotización
            handleClienteChange(cotizacion.clienteId);
            if (cotizacion.vendedorId) {
                // Buscar vendedor por ID o codiEmple
                const vendedor = vendedores.find(v => 
                    String(v.id) === String(cotizacion.vendedorId) || 
                    v.codiEmple === cotizacion.vendedorId
                );
                if (vendedor) {
                    handleVendedorChange(vendedor.id || vendedor.codiEmple || '');
                } else {
                    // Si no se encuentra, usar el vendedorId directamente
                    handleVendedorChange(cotizacion.vendedorId);
                }
            }
            setItems(cotizacion.items);
        } else {
            // Limpiar campos cuando no hay cotización
            setItems([]);
            handleClienteChange('');
            handleVendedorChange('');
        }
    }

    const handleAddItem = () => {
        const product = productos.find(p => p.id === Number(currentProductId));
        if (!product || !isPositiveInteger(currentQuantity) || !isWithinRange(Number(currentDiscount), 0, 100)) return;
        
        if (items.some(item => item.productoId === product.id)) {
            alert("El producto ya está en la lista.");
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
        
        setCurrentProductId('');
        setSelectedProduct(null);
        setCurrentQuantity(1);
        setCurrentDiscount(0);
        setProductSearchTerm('');
    };
    
    const handleRemoveItem = (productId: number) => {
        setItems(items.filter(item => item.productoId !== productId));
    }

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
        onSubmit({ 
            clienteId, 
            vendedorId: vendedorId || undefined,
            cotizacionId: cotizacionId || undefined, 
            items, 
            subtotal: totals.subtotalNeto, 
            iva: totals.iva, 
            total: totals.total, 
            fechaEntregaEstimada, 
            instruccionesEntrega 
        });
    }
    
    const canSubmit = clienteId && items.length > 0;

    const isQuantityValid = isPositiveInteger(currentQuantity);
    const isDiscountValid = isWithinRange(Number(currentDiscount), 0, 100);

    const getNumericInputClasses = (value: number | string, isValid: boolean) => `w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-2 ${
      !isValid ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
    }`;

    return (
        <form onSubmit={handleSubmit}>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                    <label htmlFor="cotizacion" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Cotización de Origen (Opcional)</label>
                    <select id="cotizacion" value={cotizacionId} onChange={e => handleCotizacionChange(e.target.value)} className="w-full pl-3 pr-8 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Pedido Directo (sin cotización)</option>
                        {cotizaciones.filter(c => c.estado === 'APROBADA').map(c => <option key={c.id} value={c.id}>{c.numeroCotizacion} - {clientes.find(cli => cli.id === c.clienteId)?.nombreCompleto}</option>)}
                    </select>
                </div>
            </div>
            
            {/* Sección de Cliente y Vendedor - Solo visible cuando NO hay cotización o para mostrar información */}
            {!cotizacionId && (
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label htmlFor="cliente" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Cliente <span className="text-red-500">*</span></label>
                        <select id="cliente" value={clienteId} onChange={e => handleClienteChange(e.target.value)} required className="w-full pl-3 pr-8 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="" disabled>Seleccione un cliente</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombreCompleto}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="vendedor" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Vendedor</label>
                        <select id="vendedor" value={vendedorId} onChange={e => handleVendedorChange(e.target.value)} className="w-full pl-3 pr-8 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Seleccione un vendedor (opcional)</option>
                            {vendedores.map(v => <option key={v.id || v.codiEmple} value={v.id || v.codiEmple}>{v.nombreCompleto || v.nombre}</option>)}
                        </select>
                    </div>
                </div>
            )}
            
            {/* Mostrar información del cliente y vendedor cuando hay cotización */}
            {cotizacionId && (selectedCliente || selectedVendedor) && (
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                    {selectedCliente && (
                        <Card className="p-3 text-sm bg-slate-50 dark:bg-slate-700/50">
                            <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Cliente</p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedCliente.nombreCompleto}</p>
                            <p className="text-slate-500 dark:text-slate-400">{selectedCliente.direccion}, {selectedCliente.ciudadId}</p>
                            <p className="text-slate-500 dark:text-slate-400">{selectedCliente.email} | {selectedCliente.telefono}</p>
                        </Card>
                    )}
                    {selectedVendedor && (
                        <Card className="p-3 text-sm bg-slate-50 dark:bg-slate-700/50">
                            <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Vendedor</p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedVendedor.nombreCompleto || selectedVendedor.nombre}</p>
                            {selectedVendedor.email && <p className="text-slate-500 dark:text-slate-400">{selectedVendedor.email}</p>}
                            {selectedVendedor.telefono && <p className="text-slate-500 dark:text-slate-400">{selectedVendedor.telefono}</p>}
                        </Card>
                    )}
                </div>
            )}
            
            {/* Mostrar información del cliente cuando NO hay cotización pero está seleccionado */}
            {!cotizacionId && selectedCliente && (
                <div className="mb-6">
                    <Card className="p-3 text-sm bg-slate-50 dark:bg-slate-700/50">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">{selectedCliente.nombreCompleto}</p>
                        <p className="text-slate-500 dark:text-slate-400">{selectedCliente.direccion}, {selectedCliente.ciudadId}</p>
                        <p className="text-slate-500 dark:text-slate-400">{selectedCliente.email} | {selectedCliente.telefono}</p>
                    </Card>
                </div>
            )}
            
             <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                    <label htmlFor="fechaEntregaEstimada" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Fecha de Entrega Estimada</label>
                    <input 
                        type="date"
                        id="fechaEntregaEstimada"
                        value={fechaEntregaEstimada}
                        onChange={e => setFechaEntregaEstimada(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="md:col-span-2">
                    <label htmlFor="instruccionesEntrega" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Instrucciones de Entrega</label>
                    <textarea
                        id="instruccionesEntrega"
                        value={instruccionesEntrega}
                        onChange={e => setInstruccionesEntrega(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: Entregar en portería, contactar a Juan Pérez."
                    />
                </div>
            </div>

            {!cotizacionId && (
                <div className="border-t border-b border-slate-200 dark:border-slate-700 py-6 mb-6">
                    <h4 className="text-md font-semibold mb-3">Añadir Productos</h4>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
                        <div ref={searchRef} className="relative md:col-span-2">
                            <label htmlFor="producto-search" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Producto</label>
                            <input
                                type="text"
                                id="producto-search"
                                value={productSearchTerm}
                                onChange={handleProductSearchChange}
                                onFocus={() => setIsProductDropdownOpen(true)}
                                placeholder="Buscar por nombre o ID..."
                                className="w-full pl-3 pr-8 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                                        {p.nombre} - {formatCurrency(p.ultimoCosto)} <span className="text-xs text-slate-500 dark:text-slate-400">(ID: {p.id})</span>
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
                        <div>
                            <label htmlFor="cantidad" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Cantidad</label>
                            <input type="text" pattern="[0-9]*" inputMode="numeric" id="cantidad" value={currentQuantity} onChange={e => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setCurrentQuantity(val);
                            }} className={getNumericInputClasses(currentQuantity, isQuantityValid)} />
                            <div className="h-5 text-center text-xs mt-1">
                                {!isQuantityValid && <span className="text-red-500">Debe ser &gt; 0</span>}
                                {isQuantityValid && selectedProduct && (
                                    <>
                                        <span className="text-slate-500 dark:text-slate-400">Stock: </span>
                                        <span className={`font-semibold ${(selectedProduct.controlaExistencia ?? 0) < Number(currentQuantity) ? 'text-orange-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                            {selectedProduct.controlaExistencia ?? 0}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                         <div>
                            <label htmlFor="descuento" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Desc. (%)</label>
                            <input type="text" pattern="[0-9]*" inputMode="numeric" id="descuento" value={currentDiscount} onChange={e => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setCurrentDiscount(val === '' ? '' : Math.min(100, parseInt(val, 10) || 0));
                            }} className={getNumericInputClasses(currentDiscount, isDiscountValid)} />
                            <div className="h-5 text-center text-xs mt-1">
                                {!isDiscountValid && <span className="text-red-500">Debe ser 0-100</span>}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1 invisible">&nbsp;</label>
                            <button type="button" onClick={handleAddItem} disabled={!currentProductId || !isQuantityValid || !isDiscountValid} className="w-full px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-600">Añadir</button>
                            <div className="h-5"></div>
                        </div>
                        {selectedProduct && Number(currentQuantity) > (selectedProduct.controlaExistencia ?? 0) && (
                            <div className="md:col-span-5 flex items-center gap-2 text-orange-500 dark:text-orange-400 text-xs mt-2 p-2 bg-orange-50 dark:bg-orange-900/30 rounded-md border border-orange-200 dark:border-orange-800">
                                <i className="fas fa-exclamation-triangle"></i>
                                <span>Atención: La cantidad solicitada ({currentQuantity}) supera el stock disponible ({selectedProduct.controlaExistencia ?? 0}).</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                    <h4 className="text-md font-semibold mb-3">Items del Pedido</h4>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                             <thead className="bg-slate-50 dark:bg-slate-700">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Producto</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Unidad</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Cant.</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Precio</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Desc. %</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">IVA %</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Total</th>
                                    {!cotizacionId && <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Acción</th>}
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {items.length > 0 ? items.map(item => {
                                    const product = productos.find(p => p.id === item.productoId);
                                    return (
                                        <tr key={item.productoId}>
                                            <td className="px-4 py-2 text-sm">{item.descripcion}</td>
                                            <td className="px-4 py-2 text-sm text-center">{product?.unidadMedida}</td>
                                            <td className="px-4 py-2 text-sm text-right">{item.cantidad}</td>
                                            <td className="px-4 py-2 text-sm text-right">{formatCurrency(item.precioUnitario)}</td>
                                            <td className="px-4 py-2 text-sm text-right">{item.descuentoPorcentaje}</td>
                                            <td className="px-4 py-2 text-sm text-right">{item.ivaPorcentaje}</td>
                                            <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(item.total)}</td>
                                            {!cotizacionId && <td className="px-4 py-2 text-center"><button type="button" onClick={() => handleRemoveItem(item.productoId)} className="text-red-500 hover:text-red-700"><i className="fas fa-trash-alt"></i></button></td>}
                                        </tr>
                                    )
                                }) : ( <tr><td colSpan={8} className="text-center py-8 text-slate-500">Añada productos al pedido.</td></tr> )}
                            </tbody>
                        </table>
                    </div>
                </div>
                 <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg space-y-1 h-fit">
                    <h4 className="font-semibold text-md text-slate-800 dark:text-slate-100 mb-2">Resumen</h4>
                     <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Subtotal Bruto:</span>
                        <span className="font-medium">{formatCurrency(totals.subtotalBruto)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-red-500 dark:text-red-400">
                        <span className="">Descuento:</span>
                        <span className="font-medium">-{formatCurrency(totals.descuentoTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-slate-200 dark:border-slate-600 pt-1 mt-1">
                        <span className="text-slate-800 dark:text-slate-100">Subtotal Neto:</span>
                        <span className="">{formatCurrency(totals.subtotalNeto)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">IVA ({items[0]?.ivaPorcentaje || 19}%):</span>
                        <span className="font-medium">{formatCurrency(totals.iva)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t border-slate-200 dark:border-slate-600 pt-2 mt-2">
                        <span className="text-slate-800 dark:text-slate-100">Total:</span>
                        <span className="text-blue-600 dark:text-blue-400">{formatCurrency(totals.total)}</span>
                    </div>
                </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4">
                <button type="button" onClick={onCancel} className="px-6 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">Cancelar</button>
                <button type="submit" disabled={!canSubmit} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed">
                    <i className="fas fa-save mr-2"></i>
                    Crear Pedido
                </button>
            </div>
        </form>
    );
};

export default PedidoForm;
