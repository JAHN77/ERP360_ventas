import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DocumentItem, Cliente, Producto, Vendedor, Cotizacion } from '../../types';
import Card from '../ui/Card';
import { isWithinRange, isPositiveInteger, isNonNegativeNumber } from '../../utils/validation';
import { useData } from '../../hooks/useData';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { apiSearchClientes, apiSearchVendedores, apiCreateCotizacion, apiSearchProductos, apiSearchServices, apiGetClienteById } from '../../services/apiClient';
// apiSetClienteListaPrecios comentado temporalmente - lista de precios no implementada en frontend

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

interface CotizacionFormData {
    clienteId: string;
    vendedorId: string;
    items: DocumentItem[];
    subtotal: number;
    ivaValor: number;
    total: number;
    observacionesInternas?: string;
    cliente?: Cliente | null;
    vendedor?: Vendedor | null;
    formaPago?: string;
    valorAnticipo?: number;
    numOrdenCompra?: string;
    notaPago?: string;
    // domicilios removido por optimización de UI
}

interface CotizacionFormProps {
    onSubmit: (data: CotizacionFormData) => void;
    onCancel: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
    initialData?: Cotizacion | null;
    isEditing?: boolean;
}

const CotizacionForm: React.FC<CotizacionFormProps> = ({ onSubmit, onCancel, onDirtyChange, initialData, isEditing }) => {
    const { clientes, vendedores, productos } = useData();
    const { selectedSede } = useAuth();
    const { addNotification } = useNotifications();
    const [clienteId, setClienteId] = useState('');
    const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
    const [vendedorId, setVendedorId] = useState('');
    const [selectedVendedor, setSelectedVendedor] = useState<Vendedor | null>(null);
    const [clienteSearch, setClienteSearch] = useState('');
    const [clienteResults, setClienteResults] = useState<Cliente[]>([]);
    const [isClienteOpen, setIsClienteOpen] = useState(false);
    const [vendedorSearch, setVendedorSearch] = useState('');
    const [vendedorResults, setVendedorResults] = useState<Vendedor[]>([]);
    const [isVendedorOpen, setIsVendedorOpen] = useState(false);
    const [items, setItems] = useState<DocumentItem[]>([]);
    const [observacionesInternas, setObservacionesInternas] = useState('');
    const [formaPago, setFormaPago] = useState('1'); // Por defecto: Contado (1)
    const [valorAnticipo, setValorAnticipo] = useState<number | string>(0);
    const [numOrdenCompra, setNumOrdenCompra] = useState<string>('');
    const [notaPago, setNotaPago] = useState('');
    // Removido: domicilios

    const [currentProductId, setCurrentProductId] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
    const [currentQuantity, setCurrentQuantity] = useState<number | string>(1);
    const [currentPrice, setCurrentPrice] = useState<number | string>('');
    const [currentDiscount, setCurrentDiscount] = useState<number | string>(0);

    const searchRef = useRef<HTMLDivElement>(null);
    const clienteRef = useRef<HTMLDivElement>(null);
    const vendedorRef = useRef<HTMLDivElement>(null);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const [productResults, setProductResults] = useState<Producto[]>([]);
    // Lista de precios comentado temporalmente - no implementado en frontend
    // const [isSavingLista, setIsSavingLista] = useState(false);
    // const [listaPrecioTemp, setListaPrecioTemp] = useState<string>('');

    useEffect(() => {
        if (initialData) {
            setClienteId(initialData.clienteId);
            const cliente = clientes.find(c =>
                String(c.id) === String(initialData.clienteId) ||
                c.numeroDocumento === initialData.clienteId ||
                (c as any).codter === initialData.clienteId
            );
            setSelectedCliente(cliente || null);
            // Establecer el texto de búsqueda con el nombre del cliente
            if (cliente) {
                const nombreCliente = cliente.nombreCompleto || cliente.razonSocial || cliente.nomter || '';
                setClienteSearch(nombreCliente);
            } else {
                setClienteSearch(initialData.clienteId || '');
            }

            // Buscar vendedor de manera más robusta (por ID, código o codVendedor)
            let vendedorEncontrado: Vendedor | null = null;
            if (initialData.vendedorId) {
                // Buscar por ID primero
                vendedorEncontrado = vendedores.find(v =>
                    String(v.id) === String(initialData.vendedorId) ||
                    String(v.codiEmple) === String(initialData.vendedorId)
                ) || null;

                // Si no se encuentra por ID, buscar por código de vendedor
                if (!vendedorEncontrado && initialData.codVendedor) {
                    const codVendedor = String(initialData.codVendedor).trim();
                    vendedorEncontrado = vendedores.find(v => {
                        if (v.codigoVendedor && String(v.codigoVendedor).trim() === codVendedor) return true;
                        if ((v as any).codigo && String((v as any).codigo).trim() === codVendedor) return true;
                        return false;
                    }) || null;
                }

                // Si aún no se encuentra, intentar vendedorId como código
                if (!vendedorEncontrado) {
                    const codBuscado = String(initialData.vendedorId).trim();
                    vendedorEncontrado = vendedores.find(v => {
                        if (v.codigoVendedor && String(v.codigoVendedor).trim() === codBuscado) return true;
                        if ((v as any).codigo && String((v as any).codigo).trim() === codBuscado) return true;
                        if (String(v.codiEmple).trim() === codBuscado) return true;
                        return false;
                    }) || null;
                }
            }

            if (vendedorEncontrado) {
                setVendedorId(vendedorEncontrado.id || vendedorEncontrado.codiEmple || initialData.vendedorId || '');
                setSelectedVendedor(vendedorEncontrado);
                // Establecer el texto de búsqueda con el nombre del vendedor
                const nombreVendedor = `${vendedorEncontrado.primerNombre || ''} ${vendedorEncontrado.primerApellido || ''}`.trim() ||
                    vendedorEncontrado.nombreCompleto || '';
                setVendedorSearch(nombreVendedor);
            } else {
                setVendedorId(initialData.vendedorId || '');
                setSelectedVendedor(null);
                setVendedorSearch(initialData.vendedorId || '');
            }

            // Sanitize and recalculate items based on catalog data
            const sanitizedItems = (initialData.items || []).map(item => {
                const product = productos.find(p => p.id === item.productoId);
                if (product) {
                    // Recalculate with canonical tax rate
                    const tieneIva = (product as any).aplicaIva !== undefined ? (product as any).aplicaIva : ((product.tasaIva || 0) > 0);
                    const ivaPorcentaje = tieneIva ? (product.tasaIva || 19) : 0;

                    // Use existing quantity/discount
                    const quantity = item.cantidad || 0;
                    const discount = item.descuentoPorcentaje || 0;
                    const price = item.precioUnitario || 0; // Keep original price, or could update to current? Keep original for quotes usually.

                    const roundTo2 = (val: number) => Math.round(val * 100) / 100;
                    const subtotalBruto = price * quantity;
                    const descuentoValor = roundTo2(subtotalBruto * (discount / 100));
                    const subtotal = roundTo2(subtotalBruto - descuentoValor);
                    const valorIva = roundTo2(subtotal * (ivaPorcentaje / 100));
                    const total = roundTo2(subtotal + valorIva);

                    return {
                        ...item,
                        ivaPorcentaje,
                        valorIva,
                        subtotal,
                        total
                    };
                }
                return item;
            });
            setItems(sanitizedItems);
            setObservacionesInternas(initialData.observacionesInternas || '');
            // Convertir valores antiguos '01'/'02' a nuevos '1'/'2' si es necesario
            const formaPagoValue = initialData.formaPago || '1';
            setFormaPago(formaPagoValue === '01' ? '1' : formaPagoValue === '02' ? '2' : formaPagoValue);
            setValorAnticipo(initialData.valorAnticipo || 0);
            setNumOrdenCompra(initialData.numOrdenCompra?.toString() || '');
            setNotaPago((initialData as any).notaPago || '');
            // domicilios removido
        }
    }, [initialData, clientes, vendedores]);

    useEffect(() => {
        if (onDirtyChange) {
            const initialItems = initialData?.items || [];
            const dirty = clienteId !== (initialData?.clienteId || '')
                || vendedorId !== (initialData?.vendedorId || '')
                || JSON.stringify(items) !== JSON.stringify(initialItems)
                || observacionesInternas !== (initialData?.observacionesInternas || '')
                || notaPago !== ((initialData as any)?.notaPago || '');
            onDirtyChange(dirty);
        }
    }, [clienteId, vendedorId, items, observacionesInternas, onDirtyChange, initialData]);

    const currentItemSubtotalForDisplay = useMemo(() => {
        if (selectedProduct && isPositiveInteger(currentQuantity) && isWithinRange(Number(currentDiscount), 0, 100)) {
            const quantityNum = Number(currentQuantity);
            const discountNum = Number(currentDiscount);
            const priceNum = Number(currentPrice) || 0;

            // Calcular subtotal sin IVA (después de descuento)
            const subtotal = (priceNum * quantityNum) * (1 - (discountNum / 100));
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
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Debounced search helpers
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

                        // Construir nombreCompleto si no existe
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
                // Limpiar resultados si hay menos de 2 caracteres
                setClienteResults([]);
                setIsClienteOpen(false);
            }
        }, 300);
        return () => { clearTimeout(handler); controller.abort(); };
    }, [clienteSearch]);

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
                // Limpiar resultados si hay menos de 2 caracteres
                setVendedorResults([]);
                setIsVendedorOpen(false);
            }
        }, 300);
        return () => { clearTimeout(handler); controller.abort(); };
    }, [vendedorSearch]);

    // Búsqueda de productos y servicios server-side (debounce)
    // Búsqueda de productos y servicios server-side (debounce)
    useEffect(() => {
        const controller = new AbortController();
        const handler = setTimeout(async () => {
            const q = productSearchTerm.trim();
            if (q.length >= 2) {
                try {
                    // Buscar tanto en productos como en servicios
                    const [respProductos, respServicios] = await Promise.all([
                        apiSearchProductos(q, 20),
                        apiSearchServices(q, 20)
                    ]);

                    const productosData = (respProductos.success && respProductos.data) ? respProductos.data as any[] : [];
                    const serviciosData = (respServicios.success && respServicios.data) ? respServicios.data as any[] : [];

                    // Mapear productos
                    const mappedProducts = productosData.map((p: any) => ({
                        ...p,
                        unidadMedida: p.unidadMedidaNombre || p.unidadMedida || 'Unidad',
                        nombre: p.nombre || p.nomins,
                        aplicaIva: (p.tasaIva || 0) > 0,
                        ultimoCosto: p.ultimoCosto || 0,
                        stock: p.stock || 0,
                        controlaExistencia: p.stock || 0
                    }));

                    // Mapear servicios
                    const mappedServices = serviciosData.map((s: any) => ({
                        ...s,
                        unidadMedida: s.unidadMedidaNombre || s.unidadMedida || 'Unidad',
                        nombre: s.nombre || s.nomser,
                        aplicaIva: (s.tasaIva || 0) > 0,
                        ultimoCosto: s.ultimoCosto || s.precio || s.valser || 0,
                        stock: 0, // Los servicios no tienen stock
                        controlaExistencia: 0 // Los servicios no controlan existencia
                    }));

                    // Combinar y filtrar los que ya están en la lista (comparando como strings)
                    const existingIds = new Set(items.map(item => String(item.productoId)));
                    const allResults = [...mappedProducts, ...mappedServices];

                    const available = allResults.filter((p: any) => !existingIds.has(String(p.id)));
                    setProductResults(available);
                } catch (error) {
                    console.error('Error buscando productos y servicios:', error);
                }
            } else {
                setProductResults([]);
            }
        }, 300);
        return () => { clearTimeout(handler); controller.abort(); };
    }, [productSearchTerm, items]);

    const handleClienteChange = (id: string) => {
        setClienteId(id);
        const found = (clienteResults.length ? clienteResults : clientes).find(c => c.id === id) || null;
        setSelectedCliente(found);
    };
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
                const clienteData = { ...c, ...(resp.data as any) };
                setSelectedCliente(clienteData);

                // Auto-selección removida a petición del usuario (quiere selección manual obligatoria)
                // if (codVendedorCliente) { ... }
            } else {
                setSelectedCliente(c);
            }
        } catch (err) {
            console.error('Error al obtener detalles del cliente:', err);
            setSelectedCliente(c);
        }
    };

    // Lista de precios comentado temporalmente - no implementado en frontend
    // const handleGuardarListaPrecio = async () => {
    //     if (!clienteId) return;
    //     setIsSavingLista(true);
    //     try {
    //         const listaId = listaPrecioTemp?.trim();
    //         if (!listaId) return;
    //         await apiSetClienteListaPrecios(clienteId, listaId);
    //         // refrescar visual localmente
    //         setSelectedCliente(prev => prev ? ({ ...(prev as any), listaPrecioId: listaId } as any) : prev);
    //     } finally {
    //         setIsSavingLista(false);
    //     }
    // };
    const pickVendedor = (v: Vendedor) => {
        // Usar código de vendedor (codven) preferiblemente para evitar problemas de ID vs Código
        // El backend espera el código '015' para hacer el join, no el ID '15'
        const vendedorIdToUse = v.codigoVendedor || v.id || v.codiEmple || '';
        setVendedorId(vendedorIdToUse);
        setSelectedVendedor(v);
        // Establecer el nombre completo en el campo de búsqueda
        const nombreCompleto = `${v.primerNombre || ''} ${v.primerApellido || ''}`.trim() ||
            v.nombreCompleto ||
            `${v.codigoVendedor || ''}`.trim();
        setVendedorSearch(nombreCompleto);
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
        // Inicializar el precio con el costo/precio del producto seleccionado
        setCurrentPrice(product.ultimoCosto || (product as any).precio || (product as any).valser || 0);
        setIsProductDropdownOpen(false);
    };

    const handleAddItem = () => {
        // Usar selectedProduct directamente, ya que se guarda cuando se selecciona del dropdown
        let product = selectedProduct;

        if (!product && currentProductId) {
            // Buscar primero en productos del contexto (comparando como strings)
            product = productos.find(p => String(p.id) === String(currentProductId));

            // Si no se encuentra, buscar en los resultados de búsqueda
            if (!product) {
                product = productResults.find(p => String(p.id) === String(currentProductId));
            }
        }

        if (!product) {
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
        if (items.some(item => String(item.productoId) === String(product!.id))) {
            addNotification({ type: 'info', message: "El producto ya está en la lista." });
            return;
        }

        // Validar y obtener precio unitario del estado editable
        const precioUnitario = Number(currentPrice);

        // Permitir precio 0 si es intencional, pero validar que sea número finito
        if (!isFinite(precioUnitario) || precioUnitario < 0) {
            addNotification({ type: 'error', message: 'Precio inválido.' });
            return;
        }

        // Determinar IVA: usar aplicaIva si existe, sino usar tasaIva > 0
        const tieneIva = (product as any).aplicaIva !== undefined
            ? (product as any).aplicaIva
            : ((product.tasaIva || 0) > 0);
        const ivaPorcentaje = tieneIva ? (product.tasaIva || 19) : 0;

        const discountNum = Number(currentDiscount);

        // Calcular valores con redondeo a 2 decimales
        const roundTo2 = (value: number) => Math.round(value * 100) / 100;

        const subtotalBruto = precioUnitario * quantityNum;
        const descuentoValor = roundTo2(subtotalBruto * (discountNum / 100));
        const subtotal = roundTo2(subtotalBruto - descuentoValor);
        const valorIva = roundTo2(subtotal * (ivaPorcentaje / 100));
        const total = roundTo2(subtotal + valorIva);

        const newItem: DocumentItem & { unidadMedida?: string; referencia?: string } = {
            productoId: product.id,
            descripcion: product.nombre || 'Sin nombre',
            cantidad: quantityNum,
            precioUnitario: roundTo2(precioUnitario),
            ivaPorcentaje: roundTo2(ivaPorcentaje),
            descuentoPorcentaje: roundTo2(discountNum),
            subtotal: roundTo2(subtotal),
            valorIva: roundTo2(valorIva),
            total: roundTo2(total),
            unidadMedida: product.unidadMedida || (product as any).unidadMedidaNombre || 'Unidad',
            codigoMedida: product.unidadMedida || (product as any).unidadMedidaNombre || 'Unidad',
        };

        // Guardar referencia en el item si está disponible
        if ((product as any).referencia) {
            (newItem as any).referencia = (product as any).referencia;
        }


        setItems([...items, newItem]);



        // Limpiar campos
        setCurrentProductId('');
        setSelectedProduct(null);
        setCurrentQuantity(1);
        setCurrentDiscount(0);
        setCurrentPrice('');
        setProductSearchTerm('');
    };

    const handleRemoveItem = (productId: number | string) => {
        setItems(items.filter(item => String(item.productoId) !== String(productId)));
    }

    const handleItemChange = (productId: number | string, field: 'cantidad' | 'descuentoPorcentaje' | 'precioUnitario' | 'ivaPorcentaje' | 'descripcion', value: any) => {
        setItems(prevItems => {
            return prevItems.map(item => {
                // Compara como string para mayor seguridad
                if (String(item.productoId) === String(productId)) {
                    // Procesar el valor según el campo
                    let processedValue: any = value;

                    if (field === 'cantidad') {
                        const numericString = String(value).replace(/[^0-9]/g, '');
                        const cantidadIngresada = numericString === '' ? '' : parseInt(numericString, 10); // Permitir vacío temporalmente mientras escribe

                        // Si es vacío, retornamos vacío para el input, pero para cálculo usaremos 0 o 1
                        if (cantidadIngresada === '') {
                            processedValue = '';
                        } else {
                            // Validar stock solo si es producto (no servicio) y controla existencia
                            const product = productos.find(p => String(p.id) === String(productId));
                            const stockDisponible = product?.stock ?? null;
                            const controlaExistencia = product?.karins ?? false;

                            if (controlaExistencia && stockDisponible !== null && stockDisponible >= 0) {
                                processedValue = Math.max(1, Math.min(cantidadIngresada as number, stockDisponible));
                            } else {
                                processedValue = Math.max(1, cantidadIngresada as number);
                            }
                        }
                    } else if (field === 'descuentoPorcentaje' || field === 'ivaPorcentaje') {
                        const numericString = String(value).replace(/[^0-9.]/g, ''); // Permitir decimales
                        // Permitir vacío temporalmente
                        if (numericString === '') {
                            processedValue = '';
                        } else {
                            processedValue = Math.min(100, Math.max(0, parseFloat(numericString) || 0));
                        }
                    } else if (field === 'precioUnitario') {
                        const numericString = String(value).replace(/[^0-9.]/g, '');
                        if (numericString === '') {
                            processedValue = '';
                        } else {
                            processedValue = parseFloat(numericString) || 0;
                        }
                    } else if (field === 'descripcion') {
                        processedValue = value;
                    }

                    const newItem = { ...item, [field]: processedValue };

                    // Valores para cálculo (usar 0 si es vacío o inválido)
                    const calcCantidad = Number(newItem.cantidad) || 0;
                    const calcPrecio = Number(newItem.precioUnitario) || 0;
                    const calcDesc = Number(newItem.descuentoPorcentaje) || 0;
                    const calcIva = newItem.ivaPorcentaje === '' ? 0 : (Number(newItem.ivaPorcentaje) || 0);

                    // Recalcular totales
                    const roundTo2 = (val: number) => Math.round(val * 100) / 100;
                    const subtotalBruto = calcPrecio * calcCantidad;
                    const descuentoValor = roundTo2(subtotalBruto * (calcDesc / 100));
                    const subtotal = roundTo2(subtotalBruto - descuentoValor);
                    const valorIva = roundTo2(subtotal * (calcIva / 100));
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
    };

    const totals = useMemo(() => {
        // Calculate totals using catalog tax rates for accuracy
        let subtotalBruto = 0;
        let descuentoTotal = 0;
        let subtotalNeto = 0;
        let ivaValor = 0;

        items.forEach(item => {
            const product = productos.find(p => p.id === item.productoId);
            // Default to item's rate if product not found, but prefer product catalog rate
            const tasaIva = product ? ((product.tasaIva || 0) > 0 ? (product.tasaIva || 19) : 0) : (item.ivaPorcentaje || 0);

            const itemTotalBruto = item.precioUnitario * item.cantidad;
            const itemDescuento = itemTotalBruto * ((item.descuentoPorcentaje || 0) / 100);
            const itemSubtotal = itemTotalBruto - itemDescuento;
            const itemIva = itemSubtotal * (tasaIva / 100);

            subtotalBruto += itemTotalBruto;
            descuentoTotal += itemDescuento;
            subtotalNeto += itemSubtotal;
            ivaValor += itemIva;
        });

        const total = subtotalNeto + ivaValor;
        return { subtotalBruto, descuentoTotal, subtotalNeto, ivaValor, total };
    }, [items, productos]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCliente) {
            addNotification({ type: 'warning', message: 'Selecciona un cliente válido antes de continuar.' });
            return;
        }
        if (!selectedVendedor) {
            addNotification({ type: 'warning', message: 'Selecciona un vendedor válido antes de continuar.' });
            return;
        }
        onSubmit({
            clienteId,
            vendedorId,
            items,
            subtotal: totals.subtotalNeto,
            ivaValor: totals.ivaValor,
            total: totals.total,
            observacionesInternas: observacionesInternas.trim(),
            cliente: selectedCliente,
            vendedor: selectedVendedor,
            formaPago,
            valorAnticipo: Number(valorAnticipo) || 0,
            numOrdenCompra: (numOrdenCompra || '').trim() || undefined,
            notaPago: (notaPago || '').trim() || undefined,
        } as any);
    }

    const canSubmit = clienteId && vendedorId && items.length > 0;


    const getNumericInputClasses = (value: number | string, isValid: boolean) => `w-full px-3 py-2 text-sm text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-2 text-right ${!isValid ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
        }`;
    const disabledInputStyle = "w-full px-3 py-2 text-sm bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md cursor-not-allowed text-slate-500 dark:text-slate-400 text-right";
    const labelStyle = "block text-xs text-center font-medium text-slate-600 dark:text-slate-300 mb-1";

    const isQuantityValid = isPositiveInteger(currentQuantity);
    const isDiscountValid = isWithinRange(Number(currentDiscount), 0, 100);

    // Obtener código de bodega desde la bodega seleccionada en el header
    const bodegaCodigo = selectedSede?.codigo
        ? String(selectedSede.codigo).padStart(3, '0')
        : '001'; // Fallback si no hay bodega seleccionada

    return (
        <form onSubmit={handleSubmit}>
            {/* Información de bodega seleccionada */}
            {selectedSede ? (
                <div className="mb-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
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
                <div className="mb-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                        <i className="fas fa-exclamation-triangle"></i>
                        <span className="font-medium">Advertencia:</span>
                        <span>No hay bodega seleccionada. Por favor, selecciona una bodega en el header.</span>
                    </div>
                </div>
            )}

            <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div ref={clienteRef} className="relative">
                    <label htmlFor="cliente" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Cliente</label>
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
                            // Sanitizar entrada
                            const trimmed = clienteSearch.trim();
                            if (clienteSearch !== trimmed) {
                                setClienteSearch(trimmed);
                            }

                            // Solo buscar coincidencia si hay texto en el campo y no hay cliente seleccionado
                            if (trimmed.length >= 2 && !selectedCliente) {
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
                            // Usar setTimeout para permitir que el click del dropdown se procese primero
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
                            // Sanitizar entrada
                            const trimmed = vendedorSearch.trim();
                            if (vendedorSearch !== trimmed) {
                                setVendedorSearch(trimmed);
                            }

                            // Auto-seleccionar si hay coincidencia exacta
                            const list = vendedorResults.length > 0 ? vendedorResults : vendedores;
                            const exactMatch = list.find(v => {
                                const nombre = ((v.primerNombre || '') + ' ' + (v.primerApellido || '')).trim().toLowerCase();
                                const codigo = (v.codigoVendedor || '').toLowerCase();
                                const search = vendedorSearch.toLowerCase();
                                return nombre === search || codigo === search;
                            });
                            if (exactMatch) {
                                pickVendedor(exactMatch);
                            }
                            // Usar setTimeout para permitir que el click del dropdown se procese primero
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
                                    const codigo = ((v as any).codigo || v.codigoVendedor || '').toLowerCase();
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
                                    const codigo = ((v as any).codigo || v.codigoVendedor || '').toLowerCase();
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
                                return filtered.slice(0, 500).map(v => {
                                    const nombreCompleto = ((v.primerNombre || '') + ' ' + (v.primerApellido || '')).trim() || 'Sin nombre';
                                    const codigoDisplay = (v as any).codigo || v.codigoVendedor || '';
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
                <div className="relative">
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
                    <div className="hidden md:contents">
                        {/* Wrapper for info cards to appear in grid flow if needed, but given the request, 
                            it seems they just want the INPUTS aligned. 
                            However, the cards below might break the 3-col layout visually if inserted directly.
                            Let's keep the inputs in the top row.
                            
                            Wait, the user said "cliente vendedor y forma de pago deberian ir en la misam liena".
                            He likely means the INPUTS/SELECTS.
                            
                            The Cards appear *below* the inputs in the code (lines 873+ are conditional).
                            If I move the Payment Select into the grid above, the Cards will be pushed down.
                            
                            Let's place the "Forma de Pago" div inside the main grid.
                        */}
                    </div>
                )}
            </div>

            {/* Row for Selected Client/Vendor Info Cards - Full Width or 2-col */}
            {(selectedCliente || selectedVendedor) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                                        : selectedVendedor.nombreCompleto || (selectedVendedor as any).nombre || 'Sin nombre'}
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

            {/* Separator if needed, or just let them stack */}


            {/* Campos de observaciones y nota de pago - antes de añadir productos */}
            <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label htmlFor="observacionesInternas" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Observaciones Internas (para Supervisor)</label>
                    <textarea
                        id="observacionesInternas"
                        value={observacionesInternas}
                        onChange={(e) => setObservacionesInternas(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: El cliente solicita descuento especial, validar margen."
                    />
                </div>
                <div>
                    <label htmlFor="notaPago" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Nota de Pago</label>
                    <textarea
                        id="notaPago"
                        value={notaPago}
                        onChange={(e) => setNotaPago(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: Pago a 30 días, transferencia bancaria, etc."
                    />
                </div>
            </div>

            <div className="border-t border-b border-slate-200 dark:border-slate-700 py-4 mb-4">
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
                        <input
                            type="text"
                            value={(() => {
                                let u = String(selectedProduct?.unidadMedida || '').toUpperCase();
                                if (u.includes(',')) {
                                    u = [...new Set(u.split(',').map(p => p.trim()).filter(p => p))].join(', ');
                                }
                                if (u.length > 0 && u.length % 2 === 0) {
                                    const half = u.length / 2;
                                    if (u.substring(0, half) === u.substring(half)) u = u.substring(0, half);
                                }
                                return u;
                            })()}
                            disabled
                            className={`${disabledInputStyle} text-center !py-1.5`}
                            title={selectedProduct?.unidadMedida || ''}
                        />
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
                        <input
                            type="text"
                            value={currentPrice === '' ? '' : formatCurrency(Number(currentPrice))}
                            onChange={(e) => {
                                // Eliminar formato moneda para obtener valor numérico
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setCurrentPrice(val);
                            }}
                            disabled={!selectedProduct}
                            className={`${getNumericInputClasses(currentPrice !== '' ? Number(currentPrice) : 0, true)} !py-1.5`}
                        />
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
                    <h4 className="text-base font-semibold mb-3 text-slate-800 dark:text-slate-100">Items de la Cotización</h4>
                    {/* Table of items */}
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-700">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Referencia</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap min-w-[200px]">Producto</th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Unidad</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap w-24">Cant.</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap w-32">V. Unit.</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap w-20">Desc. %</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap w-20">IVA %</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap w-32">Subtotal</th>
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
                                        (item as any).nombre ||
                                        `Producto ${index + 1}`;

                                    const hasValidProductId = item.productoId && (typeof item.productoId === 'number' || typeof item.productoId === 'string') && Number(item.productoId) > 0;
                                    const shouldShowWarning = !hasValidProductId;

                                    return (
                                        <tr key={item.productoId || `item-${index}`}>
                                            <td className="px-4 py-2 text-sm text-slate-600 font-mono">
                                                {(item as any).referencia || product?.referencia || 'N/A'}
                                            </td>
                                            <td className="px-4 py-2 text-sm">
                                                <input
                                                    type="text"
                                                    value={item.descripcion}
                                                    onChange={(e) => handleItemChange(item.productoId, 'descripcion', e.target.value)}
                                                    className="w-full px-2 py-1 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                                                />
                                                {shouldShowWarning && (
                                                    <span className="text-[10px] text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-1.5 py-0.5 rounded border border-yellow-200 dark:border-yellow-800 flex items-center gap-1 w-fit mt-1">
                                                        <i className="fas fa-exclamation-triangle"></i> No en catálogo
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-center">
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-300 uppercase">
                                                    {(() => {
                                                        let u = String((item as any).unidadMedida || product?.unidadMedida || 'Unidad').toUpperCase();

                                                        // Fix para listas separadas por coma (ej: HORA,HORA)
                                                        if (u.includes(',')) {
                                                            const parts = u.split(',').map(p => p.trim()).filter(p => p);
                                                            const uniqueParts = [...new Set(parts)];
                                                            u = uniqueParts.join(', ');
                                                        }

                                                        // Fix genérico para duplicaciones pegadas (ej: HORAHORA)
                                                        if (u.length > 0 && u.length % 2 === 0) {
                                                            const half = u.length / 2;
                                                            if (u.substring(0, half) === u.substring(half)) {
                                                                u = u.substring(0, half);
                                                            }
                                                        }
                                                        return u;
                                                    })()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-right">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.cantidad}
                                                    onChange={(e) => handleItemChange(item.productoId, 'cantidad', e.target.value)}
                                                    className="w-20 px-2 py-1 text-right bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 font-medium"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-sm text-right">
                                                <input
                                                    type="text"
                                                    value={item.precioUnitario}
                                                    onChange={(e) => handleItemChange(item.productoId, 'precioUnitario', e.target.value)}
                                                    className="w-28 px-2 py-1 text-right bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 font-medium"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-sm text-right">
                                                <div className="relative inline-block w-20">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={item.descuentoPorcentaje}
                                                        onChange={(e) => handleItemChange(item.productoId, 'descuentoPorcentaje', e.target.value)}
                                                        className="w-full px-2 py-1 text-right pr-6 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-600 dark:text-slate-300"
                                                        placeholder="0"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-right">
                                                <div className="relative inline-block w-20">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={item.ivaPorcentaje}
                                                        onChange={(e) => handleItemChange(item.productoId, 'ivaPorcentaje', e.target.value)}
                                                        className="w-full px-2 py-1 text-right pr-6 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-600 dark:text-slate-300"
                                                        placeholder="19"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-right font-bold text-slate-800 dark:text-slate-100">{formatCurrency(item.subtotal)}</td>
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
                                                <p>Añada productos a la cotización utilizando el formulario superior.</p>
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
                                <span className="text-slate-500 dark:text-slate-400">IVA (19%):</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(totals.ivaValor)}</span>
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
                <button type="button" onClick={onCancel} className="px-6 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">Cancelar</button>
                <button type="submit" disabled={!canSubmit} className={`px-6 py-2 text-white font-semibold rounded-lg transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed ${isEditing ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    {isEditing ? (
                        <><i className="fas fa-save mr-2"></i>Guardar Cambios</>
                    ) : (
                        <><i className="fas fa-file-alt mr-2"></i>Previsualizar y Enviar a Aprobación</>
                    )}
                </button>
            </div>
        </form >
    );
};

export default CotizacionForm;