import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DocumentItem, Cliente, Producto, Cotizacion, Vendedor } from '../../types';
import Card from '../ui/Card';
import { isWithinRange, isPositiveInteger, isNonNegativeNumber } from '../../utils/validation';
import { useData } from '../../hooks/useData';
import { useAuth } from '../../hooks/useAuth';
import { apiSearchClientes, apiSearchVendedores, apiSearchProductos, apiGetClienteById } from '../../services/apiClient';

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
  isSubmitting?: boolean;
}

const PedidoForm: React.FC<PedidoFormProps> = ({ onSubmit, onCancel, onDirtyChange, isSubmitting = false }) => {
    const { clientes, cotizaciones, productos, vendedores } = useData();
    const { selectedSede } = useAuth();
    const [clienteId, setClienteId] = useState('');
    const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
    const [vendedorId, setVendedorId] = useState('');
    const [selectedVendedor, setSelectedVendedor] = useState<Vendedor | null>(null);
    const [cotizacionId, setCotizacionId] = useState('');
    const [clienteSearch, setClienteSearch] = useState('');
    const [clienteResults, setClienteResults] = useState<Cliente[]>([]);
    const [isClienteOpen, setIsClienteOpen] = useState(false);
    const [vendedorSearch, setVendedorSearch] = useState('');
    const [vendedorResults, setVendedorResults] = useState<Vendedor[]>([]);
    const [isVendedorOpen, setIsVendedorOpen] = useState(false);
    const [items, setItems] = useState<DocumentItem[]>([]);
    const [fechaEntregaEstimada, setFechaEntregaEstimada] = useState('');
    const [instruccionesEntrega, setInstruccionesEntrega] = useState('');

    const [currentProductId, setCurrentProductId] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
    const [currentQuantity, setCurrentQuantity] = useState<number|string>(1);
    const [currentDiscount, setCurrentDiscount] = useState<number|string>(0);
    
    const searchRef = useRef<HTMLDivElement>(null);
    const clienteRef = useRef<HTMLDivElement>(null);
    const vendedorRef = useRef<HTMLDivElement>(null);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const [productResults, setProductResults] = useState<Producto[]>([]);
    
    useEffect(() => {
        if (onDirtyChange) {
            const dirty = cotizacionId !== '' || clienteId !== '' || vendedorId !== '' || items.length > 0 || fechaEntregaEstimada !== '' || instruccionesEntrega !== '';
            onDirtyChange(dirty);
        }
    }, [cotizacionId, clienteId, vendedorId, items, fechaEntregaEstimada, instruccionesEntrega, onDirtyChange]);

    const currentItemSubtotalForDisplay = useMemo(() => {
        if (selectedProduct && isPositiveInteger(currentQuantity) && isWithinRange(Number(currentDiscount), 0, 100)) {
            const quantityNum = Number(currentQuantity);
            const discountNum = Number(currentDiscount);
            return (selectedProduct.ultimoCosto * quantityNum) * (1 - (discountNum / 100));
        }
        return 0;
    }, [selectedProduct, currentQuantity, currentDiscount]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsProductDropdownOpen(false);
            }
            if (clienteRef.current && !clienteRef.current.contains(event.target as Node)) {
                setIsClienteOpen(false);
            }
            if (vendedorRef.current && !vendedorRef.current.contains(event.target as Node)) {
                setIsVendedorOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Debounced search para clientes
    useEffect(() => {
        const controller = new AbortController();
        const handler = setTimeout(async () => {
            const q = clienteSearch.trim();
            if (q.length >= 2) {
                try {
                    const resp = await apiSearchClientes(q, 20);
                    if (resp.success && resp.data) {
                        const dataArray = resp.data as any[];
                        const clientesProcesados = dataArray.map((c: any) => ({
                            ...c,
                            nombreCompleto: c.nombreCompleto || c.razonSocial || `${c.primerNombre || ''} ${c.primerApellido || ''}`.trim() || c.nomter || ''
                        }));
                        setClienteResults(clientesProcesados);
                    } else {
                        setClienteResults([]);
                    }
                    setIsClienteOpen(true);
                } catch (error) {
                    console.error('Error buscando clientes:', error);
                    setClienteResults([]);
                }
            } else {
                setClienteResults([]);
                setIsClienteOpen(false);
            }
        }, 300);
        return () => { clearTimeout(handler); controller.abort(); };
    }, [clienteSearch, cotizacionId]);

    // Debounced search para vendedores
    useEffect(() => {
        const controller = new AbortController();
        const handler = setTimeout(async () => {
            const q = vendedorSearch.trim();
            if (q.length >= 2) {
                try {
                    const resp = await apiSearchVendedores(q, 20);
                    if (resp.success && resp.data) {
                        const dataArray = resp.data as any[];
                        setVendedorResults(dataArray);
                    } else {
                        setVendedorResults([]);
                    }
                    setIsVendedorOpen(true);
                } catch (error) {
                    console.error('Error buscando vendedores:', error);
                    setVendedorResults([]);
                }
            } else {
                setVendedorResults([]);
                setIsVendedorOpen(false);
            }
        }, 300);
        return () => { clearTimeout(handler); controller.abort(); };
    }, [vendedorSearch, cotizacionId]);

    // Búsqueda de productos server-side (debounce)
    useEffect(() => {
        const controller = new AbortController();
        const handler = setTimeout(async () => {
            const q = productSearchTerm.trim();
            if (q.length >= 2) {
                try {
                    const resp = await apiSearchProductos(q, 20);
                    if (resp.success && resp.data) {
                        const dataArray = resp.data as any[];
        const productsInList = new Set(items.map(item => item.productoId));
                        const mappedProducts = dataArray.map((p: any) => ({
                            ...p,
                            unidadMedida: p.unidadMedidaNombre || p.unidadMedida || 'Unidad',
                            nombre: p.nombre || p.nomins,
                            aplicaIva: (p.tasaIva || 0) > 0,
                            ultimoCosto: p.ultimoCosto || 0,
                            stock: p.stock || 0,
                            controlaExistencia: p.stock || 0
                        }));
                        const available = mappedProducts.filter((p: any) => !productsInList.has(p.id));
                        setProductResults(available);
                    }
                } catch (error) {
                    console.error('Error buscando productos:', error);
                }
            } else {
                setProductResults([]);
            }
        }, 300);
        return () => { clearTimeout(handler); controller.abort(); };
    }, [productSearchTerm, items, cotizacionId]);

    const pickCliente = async (c: Cliente) => {
        // Validar que el cliente tenga un ID válido (no vacío, no null, no undefined, y no solo espacios)
        if (!c || !c.id || String(c.id).trim() === '') {
            console.warn('⚠️ Intento de seleccionar cliente sin ID válido:', c);
            return; // No seleccionar si no tiene ID válido
        }
        
        setClienteId(c.id);
        setClienteSearch(c.nombreCompleto || c.razonSocial || '');
        setIsClienteOpen(false);
        try {
            const resp = await apiGetClienteById(c.id);
            if (resp.success && resp.data) {
                setSelectedCliente({ ...c, ...(resp.data as any) });
            } else {
                setSelectedCliente(c);
            }
        } catch {
            setSelectedCliente(c);
        }
    };

    const pickVendedor = (v: Vendedor) => {
        setVendedorId(v.id);
        setSelectedVendedor(v);
        setVendedorSearch(`${v.primerNombre || ''} ${v.primerApellido || ''}`.trim());
        setIsVendedorOpen(false);
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

    const handleCotizacionChange = (cId: string) => {
        setCotizacionId(cId);
        const cotizacion = cotizaciones.find(c => c.id === cId);
        if(cotizacion) {
            // Llenar cliente y vendedor automáticamente desde la cotización
            const cliente = clientes.find(c => c.id === cotizacion.clienteId);
            if (cliente) {
                setClienteId(cliente.id);
                setSelectedCliente(cliente);
                setClienteSearch(cliente.nombreCompleto || cliente.razonSocial || '');
            }
            if (cotizacion.vendedorId) {
                const vendedor = vendedores.find(v => 
                    String(v.id) === String(cotizacion.vendedorId) || 
                    v.codiEmple === cotizacion.vendedorId
                );
                if (vendedor) {
                    setVendedorId(vendedor.id || vendedor.codiEmple || '');
                    setSelectedVendedor(vendedor);
                    setVendedorSearch(`${vendedor.primerNombre || ''} ${vendedor.primerApellido || ''}`.trim());
                }
            }
            
            // Normalizar y redondear valores de items para evitar problemas de overflow
            const roundTo2 = (value: number) => {
                if (!isFinite(value) || isNaN(value)) return 0;
                return Math.round(Number(value) * 100) / 100;
            };
            
            const normalizedItems = cotizacion.items.map(item => ({
                ...item,
                cantidad: Number(item.cantidad) || 0,
                precioUnitario: roundTo2(item.precioUnitario || 0),
                descuentoPorcentaje: roundTo2(item.descuentoPorcentaje || 0),
                ivaPorcentaje: roundTo2(item.ivaPorcentaje || 0),
                subtotal: roundTo2(item.subtotal || 0),
                valorIva: roundTo2(item.valorIva || 0),
                total: roundTo2(item.total || 0)
            }));
            
            setItems(normalizedItems);
        } else {
            // Limpiar campos cuando no hay cotización
            setItems([]);
            setClienteId('');
            setSelectedCliente(null);
            setClienteSearch('');
            setVendedorId('');
            setSelectedVendedor(null);
            setVendedorSearch('');
        }
    }

    const handleAddItem = () => {
        if (!selectedProduct || !isPositiveInteger(currentQuantity) || !isWithinRange(Number(currentDiscount), 0, 100)) return;
        
        if (items.some(item => item.productoId === selectedProduct.id)) {
            alert("El producto ya está en la lista.");
            return;
        }

        const quantityNum = Number(currentQuantity);
        const discountNum = Number(currentDiscount);
        const precioUnitario = Number(selectedProduct.ultimoCosto) || 0;
        const ivaPorcentaje = selectedProduct.aplicaIva ? 19 : 0;

        // Calcular valores y redondear a 2 decimales para evitar problemas de precisión
        // IMPORTANTE: Redondear en cada paso para evitar acumulación de errores de precisión
        const roundTo2 = (value: number) => {
            if (!isFinite(value) || isNaN(value)) return 0;
            return Math.round(Number(value) * 100) / 100;
        };
        
        const precioUnitarioRounded = roundTo2(precioUnitario);
        const subtotalBruto = roundTo2(precioUnitarioRounded * quantityNum);
        const descuentoValor = roundTo2(subtotalBruto * (discountNum / 100));
        const subtotal = roundTo2(subtotalBruto - descuentoValor);
        const valorIva = roundTo2(subtotal * (ivaPorcentaje / 100));
        const total = roundTo2(subtotal + valorIva);

        const newItem: DocumentItem = {
            productoId: selectedProduct.id,
            descripcion: selectedProduct.nombre,
            cantidad: quantityNum,
            precioUnitario: precioUnitarioRounded,
            ivaPorcentaje: roundTo2(ivaPorcentaje),
            descuentoPorcentaje: roundTo2(discountNum),
            subtotal: subtotal,
            valorIva: valorIva,
            total: total,
            descuentoValor: descuentoValor
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
        const roundTo2 = (value: number) => Math.round(value * 100) / 100;
        
        const subtotalBruto = items.reduce((acc, item) => acc + (item.precioUnitario * item.cantidad), 0);
        const descuentoTotal = items.reduce((acc, item) => {
            const itemTotalBruto = item.precioUnitario * item.cantidad;
            return acc + (itemTotalBruto * (item.descuentoPorcentaje / 100));
        }, 0);
        const subtotalNeto = subtotalBruto - descuentoTotal;
        const iva = items.reduce((acc, item) => acc + item.valorIva, 0);
        const total = subtotalNeto + iva;
        
        // Redondear todos los totales a 2 decimales
        return { 
            subtotalBruto: roundTo2(subtotalBruto), 
            descuentoTotal: roundTo2(descuentoTotal), 
            subtotalNeto: roundTo2(subtotalNeto), 
            iva: roundTo2(iva), 
            total: roundTo2(total) 
        };
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

    const getNumericInputClasses = (value: number | string, isValid: boolean) => `w-full px-3 py-2 text-sm text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-2 text-right ${
      !isValid ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
    }`;
    const disabledInputStyle = "w-full px-3 py-2 text-sm bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md cursor-not-allowed text-slate-500 dark:text-slate-400 text-right";
    const labelStyle = "block text-xs text-center font-medium text-slate-600 dark:text-slate-300 mb-1";

    // Obtener código de bodega desde la bodega seleccionada en el header
    const bodegaCodigo = selectedSede?.codigo 
      ? String(selectedSede.codigo).padStart(3, '0')
      : '001'; // Fallback si no hay bodega seleccionada

    return (
        <form onSubmit={handleSubmit}>
            {/* Información de bodega seleccionada */}
            {selectedSede ? (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
                      <i className="fas fa-warehouse"></i>
                      <span className="font-medium">Bodega:</span>
                      <span>{selectedSede.nombre}</span>
                      {selectedSede.codigo && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">({selectedSede.codigo})</span>
                      )}
                  </div>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                      <i className="fas fa-exclamation-triangle"></i>
                      <span className="font-medium">Advertencia:</span>
                      <span>No hay bodega seleccionada. Por favor, selecciona una bodega en el header.</span>
                  </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                    <label htmlFor="cotizacion" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Cotización de Origen (Opcional)</label>
                    <select id="cotizacion" value={cotizacionId} onChange={e => handleCotizacionChange(e.target.value)} className="w-full pl-3 pr-8 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Pedido Directo (sin cotización)</option>
                        {cotizaciones.filter(c => c.estado === 'APROBADA').map(c => <option key={c.id} value={c.id}>{c.numeroCotizacion} - {clientes.find(cli => cli.id === c.clienteId)?.nombreCompleto}</option>)}
                    </select>
                </div>
            </div>
            
            {/* Sección de Cliente y Vendedor - Solo visible cuando NO hay cotización */}
            {!cotizacionId && (
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div ref={clienteRef} className="relative">
                        <label htmlFor="cliente" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Cliente <span className="text-red-500">*</span></label>
                        <input
                            id="cliente"
                            value={clienteSearch}
                            onChange={(e)=>{
                                setClienteSearch(e.target.value);
                                setIsClienteOpen(true);
                                setClienteId('');
                                setSelectedCliente(null);
                            }}
                            onFocus={() => { if(clienteSearch.trim().length>=2) setIsClienteOpen(true); }}
                            onBlur={() => {
                                // Solo buscar coincidencia si hay texto en el campo y no hay cliente seleccionado
                                if (clienteSearch.trim().length >= 2 && !selectedCliente) {
                                    const list = clienteResults.length > 0 ? clienteResults : clientes;
                                    const exactMatch = list.find(c => {
                                        // Validar que el cliente tenga un ID válido
                                        if (!c || !c.id || String(c.id).trim() === '') {
                                            return false; // Ignorar clientes sin ID válido
                                        }
                                        const nombre = (c.nombreCompleto || c.razonSocial || `${c.primerNombre || ''} ${c.primerApellido || ''}`.trim()).toLowerCase();
                                        const doc = (c.numeroDocumento || '').toLowerCase();
                                        const search = clienteSearch.toLowerCase();
                                        return nombre === search || doc === search;
                                    });
                                    if (exactMatch && !selectedCliente) {
                                        pickCliente(exactMatch);
                                    }
                                }
                                // Si el campo está vacío o solo espacios, limpiar la selección
                                if (clienteSearch.trim() === '' && selectedCliente) {
                                    setClienteId('');
                                    setSelectedCliente(null);
                                }
                                setTimeout(() => {
                                    setIsClienteOpen(false);
                                }, 200);
                            }}
                            onKeyDown={(e)=>{ 
                                if(e.key==='Escape') setIsClienteOpen(false);
                                if(e.key==='Enter'){ 
                                    const list = clienteResults.length > 0 ? clienteResults : clientes;
                                    const filtered = list.filter(c => {
                                        // Validar que el cliente tenga un ID válido
                                        if (!c || !c.id || String(c.id).trim() === '') {
                                            return false; // Ignorar clientes sin ID válido
                                        }
                                        const nombre = c.nombreCompleto || c.razonSocial || `${c.primerNombre || ''} ${c.primerApellido || ''}`.trim().toLowerCase();
                                        const doc = (c.numeroDocumento || '').toLowerCase();
                                        const search = clienteSearch.toLowerCase();
                                        return nombre.includes(search) || doc.includes(search);
                                    });
                                    if(filtered.length>0){ e.preventDefault(); pickCliente(filtered[0] as any);}
                                }
                            }}
                            placeholder="Buscar cliente (min 2, nombre o documento)"
                            className="w-full pl-3 pr-8 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        {isClienteOpen && clienteSearch.trim().length >= 2 && (
                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-xl max-h-60 overflow-y-auto">
                                {(() => {
                                    const listaMostrar = clienteResults.length > 0 ? clienteResults : clientes;
                                    // Filtrar primero por ID válido, luego por búsqueda
                                    const filtered = listaMostrar.filter(c => {
                                        // Validar que el cliente tenga un ID válido
                                        if (!c || !c.id || String(c.id).trim() === '') {
                                            return false; // Ignorar clientes sin ID válido
                                        }
                                        const nombre = (c.nombreCompleto || c.razonSocial || `${c.primerNombre || ''} ${c.primerApellido || ''}`.trim() || '').toLowerCase();
                                        const doc = (c.numeroDocumento || '').toLowerCase();
                                        const search = clienteSearch.toLowerCase();
                                        return nombre.includes(search) || doc.includes(search);
                                    });
                                    if (filtered.length === 0) {
                                        return (
                                            <div className="px-3 py-4 text-sm text-slate-500 italic text-center">
                                                No se encontraron clientes con "{clienteSearch}"
                                            </div>
                                        );
                                    }
                                    return filtered.slice(0, 20).map(c => {
                                        const nombreDisplay = c.nombreCompleto || c.razonSocial || `${c.primerNombre || ''} ${c.primerApellido || ''}`.trim() || 'Sin nombre';
                                        const docDisplay = c.numeroDocumento || '';
                                        return (
                                            <div 
                                                key={c.id} 
                                                onMouseDown={() => pickCliente(c)} 
                                                className="px-3 py-2.5 text-sm hover:bg-blue-500 hover:text-white cursor-pointer border-b border-slate-200 dark:border-slate-700 last:border-b-0 transition-colors"
                                            >
                                                <div className="font-medium">{nombreDisplay}</div>
                                                {docDisplay && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Doc: {docDisplay}</div>}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        )}
                    </div>
                    <div ref={vendedorRef} className="relative">
                        <label htmlFor="vendedor" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Vendedor</label>
                        <input
                            id="vendedor"
                            value={vendedorSearch}
                            onChange={(e)=>{
                                setVendedorSearch(e.target.value);
                                setIsVendedorOpen(true);
                                setVendedorId('');
                                setSelectedVendedor(null);
                            }}
                            onFocus={() => { if(vendedorSearch.trim().length>=2) setIsVendedorOpen(true); }}
                            onBlur={() => {
                                const list = vendedorResults.length > 0 ? vendedorResults : vendedores;
                                const exactMatch = list.find(v => {
                                    const nombre = ((v.primerNombre||'') + ' ' + (v.primerApellido||'')).trim().toLowerCase();
                                    const codigo = (v.codigo || v.codigoVendedor || '').toLowerCase();
                                    const search = vendedorSearch.toLowerCase();
                                    return nombre === search || codigo === search;
                                });
                                if (exactMatch) {
                                    pickVendedor(exactMatch);
                                }
                                setTimeout(() => {
                                    setIsVendedorOpen(false);
                                }, 200);
                            }}
                            onKeyDown={(e)=>{ 
                                if(e.key==='Escape') setIsVendedorOpen(false);
                                if(e.key==='Enter'){ 
                                    const list = vendedorResults.length > 0 ? vendedorResults : vendedores;
                                    const filtered = list.filter(v => {
                                        const nombre = ((v.primerNombre||'') + ' ' + (v.primerApellido||'')).toLowerCase();
                                        const codigo = (v.codigo || v.codigoVendedor || '').toLowerCase();
                                        const search = vendedorSearch.toLowerCase();
                                        return nombre.includes(search) || codigo.includes(search);
                                    });
                                    if(filtered.length>0){ e.preventDefault(); pickVendedor(filtered[0] as any);}
                                }
                            }}
                            placeholder="Buscar vendedor (min 2, nombre o código)"
                            className="w-full pl-3 pr-8 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        {isVendedorOpen && vendedorSearch.trim().length >= 2 && (
                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-xl max-h-60 overflow-y-auto">
                                {(() => {
                                    const listaMostrar = vendedorResults.length > 0 ? vendedorResults : vendedores;
                                    const filtered = listaMostrar.filter(v => {
                                        const nombre = ((v.primerNombre||'') + ' ' + (v.primerApellido||'')).toLowerCase();
                                        const codigo = (v.codigo || v.codigoVendedor || '').toLowerCase();
                                        const search = vendedorSearch.toLowerCase();
                                        return nombre.includes(search) || codigo.includes(search);
                                    });
                                    if (filtered.length === 0) {
                                        return (
                                            <div className="px-3 py-4 text-sm text-slate-500 italic text-center">
                                                No se encontraron vendedores con "{vendedorSearch}"
                                            </div>
                                        );
                                    }
                                    return filtered.slice(0, 20).map(v => {
                                        const nombreCompleto = ((v.primerNombre||'') + ' ' + (v.primerApellido||'')).trim() || 'Sin nombre';
                                        const codigoDisplay = v.codigo || v.codigoVendedor || '';
                                        return (
                                            <div 
                                                key={v.id} 
                                                onMouseDown={() => pickVendedor(v)} 
                                                className="px-3 py-2.5 text-sm hover:bg-blue-500 hover:text-white cursor-pointer border-b border-slate-200 dark:border-slate-700 last:border-b-0 transition-colors"
                                            >
                                                <div className="font-medium">{nombreCompleto}</div>
                                                {codigoDisplay && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Código: {codigoDisplay}</div>}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        )}
                    </div>
                    {selectedCliente && (
                        <Card className="md:col-span-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="space-y-1">
                                <p className="text-base font-semibold text-slate-800 dark:text-slate-100 truncate">
                                    {selectedCliente.nombreCompleto || selectedCliente.razonSocial || selectedCliente.nomter || 'Sin nombre'}
                                </p>
                                {(selectedCliente.dirter || selectedCliente.direccion) && (
                                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                        <i className="fas fa-map-marker-alt mr-1"></i>
                                        {selectedCliente.dirter || selectedCliente.direccion}
                                        {selectedCliente.ciudad && `, ${selectedCliente.ciudad}`}
                                    </p>
                                )}
                                <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    {selectedCliente.numeroDocumento && (
                                        <span><i className="fas fa-id-card mr-1"></i>Doc: {selectedCliente.numeroDocumento}</span>
                                    )}
                                    {(selectedCliente.email || selectedCliente.telefono || (selectedCliente as any).celular || selectedCliente.celter) && (
                                        <span>
                                            <i className="fas fa-phone mr-1"></i>
                                            {[
                                                selectedCliente.telefono || (selectedCliente as any).telefono,
                                                (selectedCliente as any).celular || selectedCliente.celter
                                            ].filter(Boolean).join(' | ')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            )}
            
            {/* Mostrar información del cliente y vendedor cuando hay cotización */}
            {cotizacionId && (selectedCliente || selectedVendedor) && (
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                    {selectedCliente && (
                        <Card className="p-3 text-sm bg-slate-50 dark:bg-slate-700/50">
                            <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Cliente</p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedCliente.nombreCompleto}</p>
                            {(selectedCliente.direccion || selectedCliente.dirter) && (
                                <p className="text-slate-500 dark:text-slate-400">{selectedCliente.direccion || selectedCliente.dirter}{selectedCliente.ciudad && `, ${selectedCliente.ciudad}`}</p>
                            )}
                            {(selectedCliente.email || selectedCliente.telefono || selectedCliente.celter) && (
                                <p className="text-slate-500 dark:text-slate-400">{selectedCliente.email || ''} {selectedCliente.telefono || selectedCliente.celter || ''}</p>
                            )}
                        </Card>
                    )}
                    {selectedVendedor && (
                        <Card className="p-3 text-sm bg-slate-50 dark:bg-slate-700/50">
                            <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Vendedor</p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedVendedor.nombreCompleto || `${selectedVendedor.primerNombre || ''} ${selectedVendedor.primerApellido || ''}`.trim() || selectedVendedor.nombre}</p>
                        </Card>
                    )}
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

            <div className="border-t border-b border-slate-200 dark:border-slate-700 py-4 mb-4">
                <h4 className="text-base font-semibold mb-3 text-slate-800 dark:text-slate-100">
                    {cotizacionId ? 'Añadir Productos Adicionales' : 'Añadir Productos'}
                </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-8 gap-2 lg:gap-3">
                        <div ref={searchRef} className="relative lg:col-span-3">
                            <label htmlFor="producto-search" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Producto</label>
                            <input
                                type="text"
                                id="producto-search"
                                value={productSearchTerm}
                                onChange={handleProductSearchChange}
                                onFocus={() => setIsProductDropdownOpen(true)}
                                placeholder="Buscar por nombre..."
                                className="w-full pl-3 pr-8 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoComplete="off"
                            />
                            {isProductDropdownOpen && productSearchTerm.trim().length >= 2 && (
                                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-xl max-h-60 overflow-y-auto">
                                    {productResults.length === 0 ? (
                                        <div className="px-3 py-4 text-sm text-slate-500 italic text-center">
                                            {productSearchTerm.trim().length >= 2 ? `No se encontraron productos con "${productSearchTerm}"` : 'Ingrese al menos 2 caracteres'}
                                        </div>
                                    ) : (
                                        productResults.map(p => (
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
                            <label className={labelStyle}>Unidad</label>
                            <input type="text" value={selectedProduct?.unidadMedida || ''} disabled className={`${disabledInputStyle} text-center`} />
                        </div>
                        <div className="lg:col-span-1">
                            <label className={labelStyle}>Cantidad</label>
                            <input type="text" pattern="[0-9]*" inputMode="numeric" value={currentQuantity} onChange={e => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setCurrentQuantity(val);
                            }} className={getNumericInputClasses(currentQuantity, isQuantityValid)} />
                            <div className="h-5 text-center text-xs mt-0.5">
                                {!isQuantityValid && <span className="text-red-500"> &gt; 0</span>}
                                {isQuantityValid && selectedProduct && (
                                    <>
                                        <span className="text-slate-500 dark:text-slate-400">Stock: </span>
                                        <span className={`font-semibold ${((selectedProduct.stock ?? selectedProduct.controlaExistencia ?? 0)) < Number(currentQuantity) ? 'text-orange-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                            {selectedProduct.stock ?? selectedProduct.controlaExistencia ?? 0}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="lg:col-span-1">
                            <label className={labelStyle}>Vr. Unit.</label>
                            <input type="text" value={selectedProduct ? formatCurrency(selectedProduct.ultimoCosto) : formatCurrency(0)} disabled className={disabledInputStyle} />
                        </div>
                        <div className="lg:col-span-1">
                            <label className={labelStyle}>% Iva</label>
                            <input type="text" value={selectedProduct ? (selectedProduct.aplicaIva ? '19' : '0') : ''} disabled className={`${disabledInputStyle} text-center`} />
                        </div>
                        <div className="lg:col-span-1">
                            <label className={labelStyle}>Totales</label>
                            <input type="text" value={formatCurrency(currentItemSubtotalForDisplay)} disabled className={`${disabledInputStyle} font-bold`} />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                        <div className="w-auto">
                            <label className={labelStyle}>% Descto</label>
                            <input type="text" pattern="[0-9]*" inputMode="numeric" value={currentDiscount} onChange={e => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setCurrentDiscount(val === '' ? '' : Math.min(100, parseInt(val, 10) || 0));
                            }} className={getNumericInputClasses(currentDiscount, isDiscountValid)} />
                        </div>
                        <div className="flex items-end">
                            <button type="button" onClick={handleAddItem} disabled={!currentProductId || !isQuantityValid || !isDiscountValid} className="px-6 py-2 bg-sky-600 text-white font-semibold rounded-md hover:bg-sky-700 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed whitespace-nowrap">
                                <i className="fas fa-plus mr-2"></i>Añadir Producto
                            </button>
                        </div>
                    </div>
                    {selectedProduct && Number(currentQuantity) > ((selectedProduct.stock ?? selectedProduct.controlaExistencia ?? 0)) && (
                        <div className="w-full flex items-center gap-2 text-orange-500 dark:text-orange-400 text-xs mt-2 p-2 bg-orange-50 dark:bg-orange-900/30 rounded-md border border-orange-200 dark:border-orange-800">
                            <i className="fas fa-exclamation-triangle"></i>
                            <span>Atención: La cantidad solicitada ({currentQuantity}) supera el stock disponible ({selectedProduct.stock ?? selectedProduct.controlaExistencia ?? 0}).</span>
                        </div>
                    )}
                </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <h4 className="text-base font-semibold mb-3 text-slate-800 dark:text-slate-100">Items del Pedido</h4>
                    {/* Table of items */}
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
                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {items.length > 0 ? items.map((item, index) => {
                                    // Buscar producto por ID (puede ser numérico o string)
                                    const product = productos.find(p => 
                                        String(p.id) === String(item.productoId) ||
                                        p.id === item.productoId
                                    );
                                    
                                    // Obtener nombre del producto: primero del producto encontrado, luego del item
                                    const productoNombre = product?.nombre || 
                                                          item.descripcion || 
                                                          item.nombre || 
                                                          `Producto ${index + 1}`;
                                    
                                    return (
                                        <tr key={item.productoId || `item-${index}`}>
                                            <td className="px-4 py-2 text-sm">
                                                {productoNombre}
                                                {!product && (
                                                    <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400" title="Producto no encontrado en el catálogo">
                                                        <i className="fas fa-exclamation-triangle"></i>
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-center">{product?.unidadMedida}</td>
                                            <td className="px-4 py-2 text-sm text-right">{item.cantidad}</td>
                                            <td className="px-4 py-2 text-sm text-right">{formatCurrency(item.precioUnitario)}</td>
                                            <td className="px-4 py-2 text-sm text-right">{item.descuentoPorcentaje}</td>
                                            <td className="px-4 py-2 text-sm text-right">{item.ivaPorcentaje}</td>
                                            <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(item.total)}</td>
                                            <td className="px-4 py-2 text-center">
                                                <button type="button" onClick={() => handleRemoveItem(item.productoId)} className="text-red-500 hover:text-red-700"><i className="fas fa-trash-alt"></i></button>
                                            </td>
                                        </tr>
                                    )
                                }) : (
                                    <tr><td colSpan={8} className="text-center py-8 text-slate-500">Añada productos al pedido.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                 <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg space-y-1 h-fit">
                    <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-3">Resumen</h4>
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
                        <span className="text-slate-500 dark:text-slate-400">IVA (19%):</span>
                        <span className="font-medium">{formatCurrency(totals.iva)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t border-slate-200 dark:border-slate-600 pt-2 mt-2">
                        <span className="text-slate-800 dark:text-slate-100">Total:</span>
                        <span className="text-blue-600 dark:text-blue-400">{formatCurrency(totals.total)}</span>
                    </div>
                </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4">
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-6 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Cancelar</button>
                <button type="submit" disabled={!canSubmit || isSubmitting} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center">
                    {isSubmitting ? (
                        <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Creando Pedido...
                        </>
                    ) : (
                        <>
                    <i className="fas fa-save mr-2"></i>
                    Crear Pedido
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};

export default PedidoForm;
