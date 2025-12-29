import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DocumentItem, Cliente, Producto, Cotizacion, Vendedor } from '../../types';
import Card from '../ui/Card';
import { isWithinRange, isPositiveInteger, isNonNegativeNumber } from '../../utils/validation';
import { useData } from '../../hooks/useData';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { apiSearchClientes, apiSearchVendedores, apiSearchProductos, apiGetClienteById } from '../../services/apiClient';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
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
    notaPago?: string;
    formaPago?: string;
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
    const { addNotification } = useNotifications();
    const [clienteId, setClienteId] = useState('');
    const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
    const [vendedorId, setVendedorId] = useState('');
    const [selectedVendedor, setSelectedVendedor] = useState<Vendedor | null>(null);
    const [cotizacionId, setCotizacionId] = useState('');
    const [tipoPedido, setTipoPedido] = useState<'sin-cotizacion' | 'con-cotizacion'>('sin-cotizacion');
    const [cotizacionSearch, setCotizacionSearch] = useState('');
    const [cotizacionResults, setCotizacionResults] = useState<Cotizacion[]>([]);
    const [isCotizacionOpen, setIsCotizacionOpen] = useState(false);
    const [selectedCotizacion, setSelectedCotizacion] = useState<Cotizacion | null>(null);
    const [clienteSearch, setClienteSearch] = useState('');
    const [clienteResults, setClienteResults] = useState<Cliente[]>([]);
    const [isClienteOpen, setIsClienteOpen] = useState(false);
    const [vendedorSearch, setVendedorSearch] = useState('');
    const [vendedorResults, setVendedorResults] = useState<Vendedor[]>([]);
    const [isVendedorOpen, setIsVendedorOpen] = useState(false);
    const [items, setItems] = useState<DocumentItem[]>([]);
    const [fechaEntregaEstimada, setFechaEntregaEstimada] = useState('');
    const [instruccionesEntrega, setInstruccionesEntrega] = useState('');
    const [notaPago, setNotaPago] = useState('');
    const [formaPago, setFormaPago] = useState('1'); // Por defecto: Contado (1)

    const [currentProductId, setCurrentProductId] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
    const [currentQuantity, setCurrentQuantity] = useState<number | string>(1);
    const [currentDiscount, setCurrentDiscount] = useState<number | string>(0);

    const searchRef = useRef<HTMLDivElement>(null);
    const clienteRef = useRef<HTMLDivElement>(null);
    const vendedorRef = useRef<HTMLDivElement>(null);
    const cotizacionRef = useRef<HTMLDivElement>(null);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const [productResults, setProductResults] = useState<Producto[]>([]);

    useEffect(() => {
        if (onDirtyChange) {
            const dirty = cotizacionId !== '' || clienteId !== '' || vendedorId !== '' || items.length > 0 || fechaEntregaEstimada !== '' || instruccionesEntrega !== '' || notaPago !== '' || formaPago !== '1';
            onDirtyChange(dirty);
        }
    }, [cotizacionId, clienteId, vendedorId, items, fechaEntregaEstimada, instruccionesEntrega, notaPago, formaPago, onDirtyChange]);

    const currentItemSubtotalForDisplay = useMemo(() => {
        if (selectedProduct && isPositiveInteger(currentQuantity) && isWithinRange(Number(currentDiscount), 0, 100)) {
            const quantityNum = Number(currentQuantity);
            const discountNum = Number(currentDiscount);
            // Calcular subtotal sin IVA (después de descuento)
            const subtotal = (selectedProduct.ultimoCosto * quantityNum) * (1 - (discountNum / 100));
            // Determinar IVA: usar aplicaIva si existe, sino usar tasaIva > 0
            const tieneIva = (selectedProduct as any).aplicaIva !== undefined
                ? (selectedProduct as any).aplicaIva
                : ((selectedProduct.tasaIva || 0) > 0);
            const ivaPorcentaje = tieneIva ? (selectedProduct.tasaIva || 19) : 0;
            // Retornar total CON IVA
            return subtotal * (1 + (ivaPorcentaje / 100));
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
            if (cotizacionRef.current && !cotizacionRef.current.contains(event.target as Node)) {
                setIsCotizacionOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Debounced search para cotizaciones
    useEffect(() => {
        if (tipoPedido !== 'con-cotizacion') {
            setCotizacionResults([]);
            setIsCotizacionOpen(false);
            return;
        }

        const controller = new AbortController();
        const handler = setTimeout(() => {
            const q = cotizacionSearch.trim();
            if (q.length >= 2) {
                // Filtrar cotizaciones aprobadas que coincidan con la búsqueda
                const cotizacionesAprobadas = cotizaciones.filter(c => c.estado === 'APROBADA');
                const resultados = cotizacionesAprobadas.filter(c => {
                    const numeroCotizacion = (c.numeroCotizacion || '').toLowerCase();
                    const cliente = clientes.find(cli => cli.id === c.clienteId);
                    const nombreCliente = (cliente?.nombreCompleto || cliente?.razonSocial || '').toLowerCase();
                    const busqueda = q.toLowerCase();
                    return numeroCotizacion.includes(busqueda) || nombreCliente.includes(busqueda);
                });
                setCotizacionResults(resultados);
                setIsCotizacionOpen(true);
            } else {
                setCotizacionResults([]);
                setIsCotizacionOpen(false);
            }
        }, 300);
        return () => { clearTimeout(handler); controller.abort(); };
    }, [cotizacionSearch, tipoPedido, cotizaciones, clientes]);

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
                        // Filter out clients without email
                        const clientsWithEmail = dataArray.filter(c => c.email && c.email.trim().length > 0);

                        const clientesProcesados = clientsWithEmail.map((c: any) => ({
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

    const handleTipoPedidoChange = (tipo: 'sin-cotizacion' | 'con-cotizacion') => {
        setTipoPedido(tipo);
        if (tipo === 'sin-cotizacion') {
            // Limpiar cotización cuando se cambia a sin cotización
            setCotizacionId('');
            setSelectedCotizacion(null);
            setCotizacionSearch('');
            setItems([]);
            setClienteId('');
            setSelectedCliente(null);
            setClienteSearch('');
            setVendedorId('');
            setSelectedVendedor(null);
            setVendedorSearch('');
        }
    };

    const handleCotizacionSelect = (cotizacion: Cotizacion) => {
        setSelectedCotizacion(cotizacion);
        setCotizacionId(cotizacion.id);
        setCotizacionSearch(`${cotizacion.numeroCotizacion} - ${clientes.find(c => c.id === cotizacion.clienteId)?.nombreCompleto || ''}`);
        setIsCotizacionOpen(false);
        handleCotizacionChange(cotizacion.id);
    };

    const handleCotizacionChange = (cId: string) => {
        setCotizacionId(cId);
        const cotizacion = cotizaciones.find(c => c.id === cId);
        if (cotizacion) {
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

            const normalizedItems = cotizacion.items.map(item => {
                // Buscar el producto para obtener unidadMedida y referencia si no están en el item
                const product = productos.find(p => p.id === item.productoId);

                const cantidad = Number(item.cantidad) || 0;
                const precioUnitario = roundTo2(item.precioUnitario || 0);
                const descuentoPorcentaje = roundTo2(item.descuentoPorcentaje || 0);
                const ivaPorcentaje = roundTo2(item.ivaPorcentaje || 0);

                // Recalculate values to ensure consistency (fix for inconsistent DB data)
                const subtotalBruto = precioUnitario * cantidad;
                const descuentoValor = subtotalBruto * (descuentoPorcentaje / 100);
                const subtotal = subtotalBruto - descuentoValor;
                const valorIva = subtotal * (ivaPorcentaje / 100);
                const total = subtotal + valorIva;

                return {
                    ...item,
                    cantidad,
                    precioUnitario,
                    descuentoPorcentaje,
                    ivaPorcentaje,
                    subtotal: roundTo2(subtotal),
                    valorIva: roundTo2(valorIva),
                    total: roundTo2(total),
                    // Preservar unidadMedida y referencia del item, o buscarlas en el producto
                    unidadMedida: (item as any).unidadMedida || item.codigoMedida || product?.unidadMedida || 'Unidad',
                    codigoMedida: item.codigoMedida || (item as any).unidadMedida || product?.unidadMedida || 'Unidad',
                    referencia: (item as any).referencia || product?.referencia || undefined
                } as DocumentItem & { unidadMedida?: string; referencia?: string };
            });

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
        // Usar selectedProduct directamente, ya que se guarda cuando se selecciona del dropdown
        // Si no está disponible, buscar en productos o productResults
        let product = selectedProduct;

        if (!product && currentProductId) {
            // Buscar primero en productos del contexto
            product = productos.find(p => p.id === Number(currentProductId));

            // Si no se encuentra, buscar en los resultados de búsqueda
            if (!product) {
                product = productResults.find(p => p.id === Number(currentProductId));
            }
        }

        if (!product) {
            if (selectedProduct?.id) { console.error('Product selected but not found in lists', selectedProduct.id); }
            addNotification({ type: 'warning', message: 'Por favor, selecciona un producto válido antes de agregarlo.' });
            return;
        }

        // Validar cantidad
        if (!isPositiveInteger(currentQuantity)) {
            addNotification({ type: 'warning', message: 'La cantidad debe ser un número entero positivo mayor que cero.' });
            return;
        }

        // Validar stock disponible si el producto controla existencia
        const quantityNum = Number(currentQuantity);
        const stockDisponible = product.stock ?? null;
        const controlaExistencia = product.karins ?? false;

        if (controlaExistencia && stockDisponible !== null && stockDisponible >= 0) {
            if (quantityNum > stockDisponible) {
                addNotification({ type: 'warning', message: `La cantidad solicitada (${quantityNum}) supera el stock disponible (${stockDisponible}). Por favor, ajuste la cantidad.` });
                return;
            }
        }

        // Validar descuento
        const discountValue = Number(currentDiscount);
        if (!isWithinRange(discountValue, 0, 100)) {
            addNotification({ type: 'warning', message: 'El descuento debe estar entre 0 y 100.' });
            return;
        }

        // Validar que el producto no esté ya en la lista
        if (items.some(item => item.productoId === product.id)) {
            addNotification({ type: 'info', message: "El producto ya está en la lista." });
            return;
        }

        // Validar y obtener precio unitario
        const precioUnitario = Number(product.ultimoCosto || (product as any).precio || (product as any).precioPublico || 0);
        if (!precioUnitario || precioUnitario <= 0 || !isFinite(precioUnitario)) {
            console.error('❌ Precio inválido para producto:', {
                productId: product.id,
                nombre: product.nombre,
                ultimoCosto: product.ultimoCosto,
                precio: (product as any).precio,
                precioPublico: (product as any).precioPublico
            });
            addNotification({ type: 'error', message: `El producto "${product.nombre}" no tiene un precio válido. Por favor, verifica el precio del producto.` });
            return;
        }

        // Determinar IVA: usar aplicaIva si existe, sino usar tasaIva > 0
        const tieneIva = (product as any).aplicaIva !== undefined
            ? (product as any).aplicaIva
            : ((product.tasaIva || 0) > 0);
        const ivaPorcentaje = tieneIva ? (product.tasaIva || 19) : 0;

        const discountNum = Number(currentDiscount);

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


        const newItem: DocumentItem & { unidadMedida?: string; referencia?: string } = {
            productoId: product.id,
            descripcion: product.nombre || 'Sin nombre',
            cantidad: quantityNum,
            precioUnitario: precioUnitarioRounded,
            ivaPorcentaje: roundTo2(ivaPorcentaje),
            descuentoPorcentaje: roundTo2(discountNum),
            subtotal: subtotal,
            valorIva: valorIva,
            total: total,
            descuentoValor: descuentoValor,
            unidadMedida: product.unidadMedida || (product as any).unidadMedidaNombre || 'Unidad',
            codigoMedida: product.unidadMedida || (product as any).unidadMedidaNombre || 'Unidad',
        };

        // Guardar referencia en el item si está disponible
        if ((product as any).referencia) {
            (newItem as any).referencia = (product as any).referencia;
        }
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

    const handleItemChange = (productId: number, field: 'cantidad' | 'descuentoPorcentaje', value: any) => {
        setItems(prevItems => {
            return prevItems.map(item => {
                if (item.productoId === productId) {
                    // Procesar el valor según el campo
                    let processedValue: number;

                    if (field === 'cantidad') {
                        const numericString = String(value).replace(/[^0-9]/g, '');
                        const cantidadIngresada = numericString === '' ? 1 : parseInt(numericString, 10);

                        // Buscar el producto para obtener el stock disponible
                        const product = productos.find(p =>
                            String(p.id) === String(productId) ||
                            p.id === productId
                        );

                        // Obtener stock disponible y si controla existencia
                        const stockDisponible = product?.stock ?? null;
                        const controlaExistencia = product?.karins ?? false;

                        // Si el producto controla existencia y hay stock disponible, limitar a ese stock
                        if (controlaExistencia && stockDisponible !== null && stockDisponible >= 0) {
                            processedValue = Math.max(1, Math.min(cantidadIngresada, stockDisponible));
                        } else {
                            // Si no controla existencia o no hay stock definido, permitir cualquier cantidad >= 1
                            processedValue = Math.max(1, cantidadIngresada);
                        }
                    } else if (field === 'descuentoPorcentaje') {
                        const numericString = String(value).replace(/[^0-9]/g, '');
                        processedValue = numericString === '' ? 0 : Math.min(100, Math.max(0, parseInt(numericString, 10)));
                    } else {
                        return item; // Campo no soportado
                    }

                    const newItem = { ...item, [field]: processedValue };

                    // Recalcular totales
                    const roundTo2 = (val: number) => {
                        if (!isFinite(val) || isNaN(val)) return 0;
                        return Math.round(Number(val) * 100) / 100;
                    };
                    const subtotalBruto = roundTo2(newItem.precioUnitario * newItem.cantidad);
                    const descuentoValor = roundTo2(subtotalBruto * (newItem.descuentoPorcentaje / 100));
                    const subtotal = roundTo2(subtotalBruto - descuentoValor);
                    const valorIva = roundTo2(subtotal * (newItem.ivaPorcentaje / 100));
                    const total = roundTo2(subtotal + valorIva);

                    return {
                        ...newItem,
                        subtotal: roundTo2(subtotal),
                        valorIva: roundTo2(valorIva),
                        total: roundTo2(total)
                    };
                }
                return item;
            });
        });
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
            instruccionesEntrega,
            notaPago: notaPago.trim() || undefined,
            formaPago: formaPago
        });
    }

    const canSubmit = clienteId && items.length > 0;

    const isQuantityValid = isPositiveInteger(currentQuantity);
    const isDiscountValid = isWithinRange(Number(currentDiscount), 0, 100);

    const getNumericInputClasses = (value: number | string, isValid: boolean) => `w-full px-3 py-2 text-sm text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-2 text-right ${!isValid ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
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

            <div className="mb-6">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">Tipo de Pedido</label>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => handleTipoPedidoChange('sin-cotizacion')}
                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${tipoPedido === 'sin-cotizacion'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                            }`}
                    >
                        Sin Cotización
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTipoPedidoChange('con-cotizacion')}
                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${tipoPedido === 'con-cotizacion'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                            }`}
                    >
                        Con Cotización
                    </button>
                </div>

                {/* Campo de búsqueda de cotizaciones y Forma de Pago */}
                {tipoPedido === 'con-cotizacion' && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                        <div ref={cotizacionRef} className="relative md:col-span-3">
                            <label htmlFor="cotizacion-search" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                                Buscar Cotización <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="cotizacion-search"
                                type="text"
                                value={cotizacionSearch}
                                onChange={(e) => {
                                    setCotizacionSearch(e.target.value);
                                    setIsCotizacionOpen(true);
                                    if (!e.target.value.trim()) {
                                        setCotizacionId('');
                                        setSelectedCotizacion(null);
                                        handleCotizacionChange('');
                                    }
                                }}
                                onFocus={() => {
                                    if (cotizacionSearch.trim().length >= 2) {
                                        setIsCotizacionOpen(true);
                                    }
                                }}
                                placeholder="Buscar por número de cotización o cliente (min 2 caracteres)..."
                                className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {isCotizacionOpen && cotizacionResults.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
                                    {cotizacionResults.map((cotizacion) => {
                                        const cliente = clientes.find(c => c.id === cotizacion.clienteId);
                                        return (
                                            <div
                                                key={cotizacion.id}
                                                onClick={() => handleCotizacionSelect(cotizacion)}
                                                className="px-4 py-2 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-200 dark:border-slate-700 last:border-b-0"
                                            >
                                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                                    {cotizacion.numeroCotizacion}
                                                </div>
                                                <div className="text-xs text-slate-600 dark:text-slate-400">
                                                    Cliente: {cliente?.nombreCompleto || cliente?.razonSocial || 'N/A'}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-500">
                                                    Total: {formatCurrency(cotizacion.total || 0)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {isCotizacionOpen && cotizacionSearch.trim().length >= 2 && cotizacionResults.length === 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg p-4 text-sm text-slate-600 dark:text-slate-400">
                                    No se encontraron cotizaciones aprobadas
                                </div>
                            )}
                        </div>
                        <div className="md:col-span-1">
                            <label htmlFor="formaPagoCtx" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Forma de Pago</label>
                            <select
                                id="formaPagoCtx"
                                value={formaPago}
                                onChange={(e) => setFormaPago(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="1">Contado</option>
                                <option value="2">Crédito</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {
                tipoPedido === 'sin-cotizacion' && (
                    <div className="grid md:grid-cols-3 gap-6 mb-6">
                        <div ref={clienteRef} className="relative">
                            <label htmlFor="cliente" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Cliente <span className="text-red-500">*</span></label>
                            <input
                                id="cliente"
                                value={clienteSearch}
                                onChange={(e) => {
                                    setClienteSearch(e.target.value);
                                    setIsClienteOpen(true);
                                    setClienteId('');
                                    setSelectedCliente(null);
                                }}
                                onFocus={() => { if (clienteSearch.trim().length >= 2) setIsClienteOpen(true); }}
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
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') setIsClienteOpen(false);
                                    if (e.key === 'Enter') {
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
                                        if (filtered.length > 0) { e.preventDefault(); pickCliente(filtered[0] as any); }
                                    }
                                }}
                                placeholder="Buscar cliente (min 2, nombre o documento)"
                                className="w-full pl-3 pr-8 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            {isClienteOpen && clienteSearch.trim().length >= 2 && (
                                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-xl max-h-60 overflow-y-auto">
                                    {(() => {
                                        const listaMostrar = clienteResults.length > 0 ? clienteResults : clientes;
                                        // Filter out clients without email
                                        const validClients = listaMostrar.filter(c => c.email && c.email.trim().length > 0);

                                        // Filtrar primero por ID válido, luego por búsqueda
                                        const filtered = validClients.filter(c => {
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
                                onChange={(e) => {
                                    setVendedorSearch(e.target.value);
                                    setIsVendedorOpen(true);
                                    setVendedorId('');
                                    setSelectedVendedor(null);
                                }}
                                onFocus={() => { if (vendedorSearch.trim().length >= 2) setIsVendedorOpen(true); }}
                                onBlur={() => {
                                    const list = vendedorResults.length > 0 ? vendedorResults : vendedores;
                                    const exactMatch = list.find(v => {
                                        const nombre = ((v.primerNombre || '') + ' ' + (v.primerApellido || '')).trim().toLowerCase();
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
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') setIsVendedorOpen(false);
                                    if (e.key === 'Enter') {
                                        const list = vendedorResults.length > 0 ? vendedorResults : vendedores;
                                        const filtered = list.filter(v => {
                                            const nombre = ((v.primerNombre || '') + ' ' + (v.primerApellido || '')).toLowerCase();
                                            const codigo = (v.codigo || v.codigoVendedor || '').toLowerCase();
                                            const search = vendedorSearch.toLowerCase();
                                            return nombre.includes(search) || codigo.includes(search);
                                        });
                                        if (filtered.length > 0) { e.preventDefault(); pickVendedor(filtered[0] as any); }
                                    }
                                }}
                                placeholder="Buscar vendedor (min 2, nombre o código)"
                                className="w-full pl-3 pr-8 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            {isVendedorOpen && vendedorSearch.trim().length >= 2 && (
                                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-xl max-h-60 overflow-y-auto">
                                    {(() => {
                                        const listaMostrar = vendedorResults.length > 0 ? vendedorResults : vendedores;
                                        const filtered = listaMostrar.filter(v => {
                                            const nombre = ((v.primerNombre || '') + ' ' + (v.primerApellido || '')).toLowerCase();
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
                                            const nombreCompleto = ((v.primerNombre || '') + ' ' + (v.primerApellido || '')).trim() || 'Sin nombre';
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
                        <div>
                            <label htmlFor="formaPago" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Forma de Pago</label>
                            <select
                                id="formaPago"
                                value={formaPago}
                                onChange={(e) => setFormaPago(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="1">Contado</option>
                                <option value="2">Crédito</option>
                            </select>
                        </div>
                        {(selectedCliente || selectedVendedor) && (
                            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedCliente && (
                                    <Card className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
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
                                {selectedVendedor && (
                                    <Card className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                        <div className="space-y-1">
                                            <p className="text-base font-semibold text-slate-800 dark:text-slate-100 truncate">
                                                {selectedVendedor.primerNombre && selectedVendedor.primerApellido
                                                    ? `${selectedVendedor.primerNombre} ${selectedVendedor.primerApellido}`.trim()
                                                    : selectedVendedor.nombreCompleto || selectedVendedor.nombre || 'Sin nombre'}
                                            </p>
                                            <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                {(selectedVendedor.codigoVendedor || (selectedVendedor as any).codigo) && (
                                                    <span><i className="fas fa-id-badge mr-1"></i>Código: {selectedVendedor.codigoVendedor || (selectedVendedor as any).codigo}</span>
                                                )}
                                                {((selectedVendedor as any).codigoCaja || (selectedVendedor as any).codigo_caja) && (
                                                    <span><i className="fas fa-cash-register mr-1"></i>Caja: {(selectedVendedor as any).codigoCaja || (selectedVendedor as any).codigo_caja}</span>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                )}
                            </div>
                        )}
                    </div>
                )
            }

            {
                tipoPedido === 'con-cotizacion' && (selectedCliente || selectedVendedor) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {selectedCliente && (
                            <Card className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
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
                        {selectedVendedor && (
                            <Card className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                <div className="space-y-1">
                                    <p className="text-base font-semibold text-slate-800 dark:text-slate-100 truncate">
                                        {selectedVendedor.primerNombre && selectedVendedor.primerApellido
                                            ? `${selectedVendedor.primerNombre} ${selectedVendedor.primerApellido}`.trim()
                                            : selectedVendedor.nombreCompleto || selectedVendedor.nombre || 'Sin nombre'}
                                    </p>
                                    <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                        {(selectedVendedor.codigoVendedor || (selectedVendedor as any).codigo) && (
                                            <span><i className="fas fa-id-badge mr-1"></i>Código: {selectedVendedor.codigoVendedor || (selectedVendedor as any).codigo}</span>
                                        )}
                                        {((selectedVendedor as any).codigoCaja || (selectedVendedor as any).codigo_caja) && (
                                            <span><i className="fas fa-cash-register mr-1"></i>Caja: {(selectedVendedor as any).codigoCaja || (selectedVendedor as any).codigo_caja}</span>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        )}
                    </div>
                )
            }

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
                <div className="md:col-span-2">
                    <label htmlFor="notaPago" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Nota de Pago</label>
                    <textarea
                        id="notaPago"
                        value={notaPago}
                        onChange={e => setNotaPago(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: Pago a 30 días, transferencia bancaria, etc."
                    />
                </div>
            </div>

            <div className="border-t border-b border-slate-200 dark:border-slate-700 py-4 mb-4">
                <h4 className="text-base font-semibold mb-3 text-slate-800 dark:text-slate-100">
                    {cotizacionId ? 'Añadir Productos Adicionales' : 'Añadir Productos'}
                </h4>
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
                        <input type="text" value={selectedProduct?.unidadMedida || ''} disabled className={`${disabledInputStyle} text-center !py-1.5`} title={selectedProduct?.unidadMedida || ''} />
                    </div>
                    <div className="lg:col-span-1">
                        <label className={labelStyle}>Cantidad</label>
                        <input type="text" pattern="[0-9]*" inputMode="numeric" value={currentQuantity} onChange={e => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setCurrentQuantity(val);
                        }} className={`${getNumericInputClasses(currentQuantity, isQuantityValid)} !py-1.5`} />
                    </div>
                    <div className="lg:col-span-1">
                        <label className={labelStyle}>Vr. Unit.</label>
                        <input type="text" value={selectedProduct ? formatCurrency(selectedProduct.ultimoCosto) : formatCurrency(0)} disabled className={`${disabledInputStyle} !py-1.5`} title={selectedProduct ? formatCurrency(selectedProduct.ultimoCosto) : formatCurrency(0)} />
                    </div>
                    <div className="lg:col-span-1">
                        <label className={labelStyle}>% Iva</label>
                        <input type="text" value={selectedProduct ? (selectedProduct.aplicaIva ? '19' : '0') : ''} disabled className={`${disabledInputStyle} text-center !py-1.5`} />
                    </div>
                    <div className="lg:col-span-1">
                        <label className={labelStyle}>% Descto</label>
                        <input type="text" pattern="[0-9]*" inputMode="numeric" value={currentDiscount} onChange={e => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setCurrentDiscount(val === '' ? '' : Math.min(100, parseInt(val, 10) || 0));
                        }} className={`${getNumericInputClasses(currentDiscount, isDiscountValid)} !py-1.5`} />
                    </div>
                    <div className="lg:col-span-2">
                        <label className={labelStyle}>Totales</label>
                        <input type="text" value={formatCurrency(currentItemSubtotalForDisplay)} disabled className={`${disabledInputStyle} font-bold !py-1.5`} title={formatCurrency(currentItemSubtotalForDisplay)} />
                    </div>
                    <div className="lg:col-span-2">
                        <button type="button" onClick={handleAddItem} disabled={!currentProductId || !isQuantityValid || !isDiscountValid} className="w-full py-1.5 bg-sky-600 text-white font-semibold rounded-md hover:bg-sky-700 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed whitespace-nowrap text-sm">
                            <i className="fas fa-plus mr-1"></i>Añadir
                        </button>
                    </div>
                </div>

                {/* Stock info shown only if valid quantity and product selected */}
                {isQuantityValid && selectedProduct && (
                    <div className="mt-1 text-xs px-2 flex gap-4">
                        <div className="text-slate-500 dark:text-slate-400">
                            Stock disponible: <span className={`font-semibold ${((selectedProduct.stock ?? selectedProduct.controlaExistencia ?? 0)) < Number(currentQuantity) ? 'text-orange-500' : 'text-slate-600 dark:text-slate-300'}`}>
                                {selectedProduct.stock ?? selectedProduct.controlaExistencia ?? 0}
                            </span>
                        </div>
                    </div>
                )}
                {selectedProduct && Number(currentQuantity) > ((selectedProduct.stock ?? selectedProduct.controlaExistencia ?? 0)) && (
                    <div className="w-full flex items-center gap-2 text-orange-500 dark:text-orange-400 text-xs mt-2 p-2 bg-orange-50 dark:bg-orange-900/30 rounded-md border border-orange-200 dark:border-orange-800">
                        <i className="fas fa-exclamation-triangle"></i>
                        <span>Atención: La cantidad solicitada ({currentQuantity}) supera el stock disponible ({selectedProduct.stock ?? selectedProduct.controlaExistencia ?? 0}).</span>
                    </div>
                )}
            </div>

            <div className="space-y-6">
                <div className="w-full">
                    <h4 className="text-base font-semibold mb-3 text-slate-800 dark:text-slate-100">Items del Pedido</h4>
                    {/* Table of items */}
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-700">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Referencia</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Producto</th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Unidad</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Cant.</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Precio</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Desc. %</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">IVA %</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Total</th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {items.length > 0 ? items.map((item, index) => {
                                    const product = productos.find(p =>
                                        String(p.id) === String(item.productoId) ||
                                        p.id === item.productoId
                                    );

                                    const productoNombre = product?.nombre ||
                                        item.descripcion ||
                                        item.nombre ||
                                        `Producto ${index + 1}`;

                                    const hasValidProductId = item.productoId && (typeof item.productoId === 'number' || typeof item.productoId === 'string') && Number(item.productoId) > 0;
                                    const shouldShowWarning = !hasValidProductId;

                                    return (
                                        <tr key={item.productoId || `item-${index}`}>
                                            <td className="px-4 py-2 text-sm text-slate-600 font-mono">
                                                {(item as any).referencia || product?.referencia || 'N/A'}
                                            </td>
                                            <td className="px-4 py-2 text-sm">
                                                <div className="font-medium text-slate-800 dark:text-slate-100">{productoNombre}</div>
                                                {shouldShowWarning && (
                                                    <span className="text-[10px] text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-1.5 py-0.5 rounded border border-yellow-200 dark:border-yellow-800 flex items-center gap-1 w-fit mt-1">
                                                        <i className="fas fa-exclamation-triangle"></i> No en catálogo
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-center">
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-300 uppercase">
                                                    {(item as any).unidadMedida || item.codigoMedida || product?.unidadMedida || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-right">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.cantidad}
                                                    onChange={(e) => {
                                                        const newValue = e.target.value;
                                                        if (newValue === '' || parseInt(newValue, 10) > 0) {
                                                            handleItemChange(item.productoId, 'cantidad', newValue);
                                                        }
                                                    }}
                                                    className="w-20 px-2 py-1 text-right bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-sm text-right font-medium text-slate-700 dark:text-slate-300">{formatCurrency(item.precioUnitario)}</td>
                                            <td className="px-4 py-2 text-sm text-right">
                                                <div className="relative inline-block">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={item.descuentoPorcentaje}
                                                        onChange={(e) => {
                                                            const newValue = e.target.value;
                                                            if (newValue === '' || (parseInt(newValue, 10) >= 0 && parseInt(newValue, 10) <= 100)) {
                                                                handleItemChange(item.productoId, 'descuentoPorcentaje', newValue);
                                                            }
                                                        }}
                                                        className="w-16 px-2 py-1 pr-6 text-right bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-right text-slate-500">{item.ivaPorcentaje}%</td>
                                            <td className="px-4 py-2 text-sm text-right font-bold text-slate-800 dark:text-slate-100">{formatCurrency(item.total)}</td>
                                            <td className="px-4 py-2 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(item.productoId)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                    title="Eliminar producto"
                                                >
                                                    <i className="fas fa-trash-alt"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                }) : (
                                    <tr>
                                        <td colSpan={9} className="text-center py-12 text-slate-500 bg-slate-50/50 dark:bg-slate-800/50">
                                            <div className="flex flex-col items-center gap-2">
                                                <i className="fas fa-box-open text-3xl opacity-20"></i>
                                                <p>Añada productos al pedido utilizando el formulario superior.</p>
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
                        <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Resumen de Totales</h4>

                        <div className="space-y-3">
                            <div className="flex justify-between text-sm items-center">
                                <span className="text-slate-500 dark:text-slate-400">Subtotal Bruto:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(totals.subtotalBruto)}</span>
                            </div>

                            {totals.descuentoTotal > 0 && (
                                <div className="flex justify-between text-sm items-center">
                                    <span className="text-red-500 flex items-center gap-1.5">
                                        <i className="fas fa-tag text-[10px]"></i> Descuento:
                                    </span>
                                    <span className="font-semibold text-red-500">-{formatCurrency(totals.descuentoTotal)}</span>
                                </div>
                            )}

                            <div className="flex justify-between text-sm items-center pt-1">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">Subtotal Neto:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(totals.subtotalNeto)}</span>
                            </div>

                            <div className="flex justify-between text-sm items-center">
                                <span className="text-slate-500 dark:text-slate-400">IVA:</span>
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
        </form >
    );
};

export default PedidoForm;
