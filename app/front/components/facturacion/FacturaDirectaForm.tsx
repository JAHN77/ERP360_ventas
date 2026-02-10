import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DocumentItem, Cliente, Producto, Vendedor } from '../../types';
import Card from '../ui/Card';
import { isWithinRange, isPositiveInteger } from '../../utils/validation';
import { useData } from '../../hooks/useData';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { apiSearchClientes, apiSearchVendedores, apiSearchProductos, apiSearchServices, apiGetClienteById, apiClient } from '../../services/apiClient';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

const round = (num: number, decimals: number = 2) => {
    const factor = Math.pow(10, decimals);
    return Math.round((num + Number.EPSILON) * factor) / factor;
};

const toProperCase = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
};

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
    const { selectedSede, selectedCompany, user } = useAuth();
    const { addNotification } = useNotifications();

    const [formData, setFormData] = useState<FacturaDirectaFormData>({
        number: nextInvoiceNumber || '',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        paymentFormId: '1',
        paymentMethodId: '9',
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
    const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(null);
    const [rowResults, setRowResults] = useState<Producto[]>([]);
    const [ivaIncluido, setIvaIncluido] = useState(0);
    const [codigoTarifa, setCodigoTarifa] = useState('');
    const [tarifaNombre, setTarifaNombre] = useState('');
    const [tarifasDisponibles, setTarifasDisponibles] = useState<{ codtar: string, nomtar: string }[]>([]);
    const [clienteTieneTarifa, setClienteTieneTarifa] = useState(false);
    const [vendedoresDisponibles, setVendedoresDisponibles] = useState<Vendedor[]>([]);
    const [usuarioTieneVendedor, setUsuarioTieneVendedor] = useState(false);
    const [precioListaMinimo, setPrecioListaMinimo] = useState(0);
    const tableRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (tableRef.current && !tableRef.current.contains(event.target as Node)) {
                setActiveSearchIdx(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const calculatedTotal = useMemo(() => {
        const q = Number(currentQuantity) || 0;
        const p = Number(currentUnitPrice) || 0;
        const d = Number(currentDiscount) || 0;

        const subtotal = (p * q) * (1 - (d / 100));
        return round(subtotal);
    }, [currentQuantity, currentUnitPrice, currentDiscount]);

    const clienteRef = useRef<HTMLDivElement>(null);
    const vendedorRef = useRef<HTMLDivElement>(null);
    const productRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (nextInvoiceNumber) {
            setFormData(prev => ({ ...prev, number: nextInvoiceNumber }));
        }
    }, [nextInvoiceNumber]);

    // Cargar parámetro IVA y tarifas vigentes al montar el componente
    useEffect(() => {
        const fetchIvaIncluido = async () => {
            try {
                const resp = await apiClient.request('/productos/iva-incluido');
                if (resp.success && resp.data) {
                    const data = resp.data as { ivaIncluido: any };
                    // Asegurar que sea 1 (true) o 0 (false)
                    const val = data.ivaIncluido === true || data.ivaIncluido === 1 || String(data.ivaIncluido) === '1' ? 1 : 0;
                    setIvaIncluido(val);
                }
            } catch (e) {
                console.error('Error obteniendo parámetro IVA:', e);
            }
        };
        const fetchTarifas = async () => {
            try {
                const resp = await apiClient.request('/productos/tarifas');
                if (resp.success && resp.data && Array.isArray(resp.data)) {
                    setTarifasDisponibles(resp.data as { codtar: string, nomtar: string }[]);
                }
            } catch (e) {
                console.error('Error obteniendo tarifas:', e);
            }
        };
        fetchIvaIncluido();
        fetchTarifas();
    }, []);

    // Asignar vendedor automáticamente desde el usuario logueado
    useEffect(() => {
        const fetchVendedorUsuario = async () => {
            if (user) {
                try {
                    const resp = await apiSearchVendedores(user.username, 1);
                    if (resp.success && resp.data && Array.isArray(resp.data) && resp.data.length > 0) {
                        const vendedor = resp.data[0];
                        setSelectedVendedor(vendedor);
                        setUsuarioTieneVendedor(true);
                        setVendedorSearch(vendedor.nombreCompleto || `${vendedor.primerNombre} ${vendedor.primerApellido}`);
                        setFormData(prev => ({ ...prev, seller: vendedor.codigoVendedor || vendedor.id || '' }));
                    } else {
                        // No tiene vendedor asociado: cargar lista de vendedores para combo
                        setUsuarioTieneVendedor(false);
                        try {
                            const respVendedores = await apiClient.request('/vendedores');
                            if (respVendedores.success && respVendedores.data && Array.isArray(respVendedores.data)) {
                                setVendedoresDisponibles(respVendedores.data as Vendedor[]);
                            }
                        } catch (e2) {
                            console.error('Error cargando vendedores:', e2);
                        }
                    }
                } catch (e) {
                    console.error('Error buscando vendedor del usuario:', e);
                    setUsuarioTieneVendedor(false);
                    // Cargar vendedores para combo como fallback
                    try {
                        const respVendedores = await apiClient.request('/vendedores');
                        if (respVendedores.success && respVendedores.data && Array.isArray(respVendedores.data)) {
                            setVendedoresDisponibles(respVendedores.data as Vendedor[]);
                        }
                    } catch (e2) {
                        console.error('Error cargando vendedores:', e2);
                    }
                }
            }
        };
        fetchVendedorUsuario();
    }, [user]);

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
                        const allClients = resp.data as Cliente[];
                        // Filter out clients without valid email
                        const validClients = allClients.filter(c => c.email && c.email.includes('@'));
                        setClienteResults(validClients);
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
                        const mapped = (resp.data as Vendedor[]).map(v => ({
                            ...v,
                            nombreCompleto: toProperCase(v.nombreCompleto || `${v.primerNombre} ${v.primerApellido}`)
                        }));
                        setVendedorResults(mapped);
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
                    // Pasar codtar del cliente seleccionado (solo si existe)
                    const codtar = codigoTarifa || '01'; // Fallback a MAYORISTA si no hay cliente
                    const resp = await apiSearchProductos(q, 20, undefined, codtar);
                    if (resp.success && resp.data) {
                        const mapped = (resp.data as any[]).map(p => ({
                            ...p,
                            ultimoCosto: Number(p.ultimoCosto) || 0,
                            tasaIva: Number(p.tasaIva) || 0,
                            aplicaIva: (Number(p.tasaIva) > 0),
                            stock: Number(String(p.stock || p.caninv || 0).replace(/,/g, '')) || 0
                        }));

                        // Excluir productos que ya están en el grid
                        const filtered = mapped.filter(p => {
                            const pCode = p.codigo || p.codins;
                            return !formData.items.some(item => item.codProducto === pCode);
                        });

                        setProductResults(filtered as Producto[]);
                    }
                } catch (e) { console.error(e); }
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [productSearchTerm, codigoTarifa, formData.items.length]); // Re-buscar si cambia la tarifa o cantidad de items

    const handleRowProductSearch = async (idx: number, query: string) => {
        handleUpdateItem(idx, 'descripcion', query);
        setActiveSearchIdx(idx);
        if (query.length < 2) {
            setRowResults([]);
            return;
        }
        try {
            // Pasar codtar del cliente seleccionado y codalm de la bodega seleccionada
            const codtar = codigoTarifa || '01'; // Fallback a MAYORISTA si no hay cliente
            const codalm = selectedSede?.codigo;
            const resp = await apiSearchProductos(query, 10, codalm, codtar);
            if (resp.success && resp.data) {
                const mapped = (resp.data as any[]).map(p => ({
                    ...p,
                    ultimoCosto: Number(p.ultimoCosto) || 0,
                    tasaIva: Number(p.tasaIva) || 0,
                    aplicaIva: (Number(p.tasaIva) > 0),
                    stock: Number(String(p.stock || p.caninv || 0).replace(/,/g, '')) || 0
                }));

                // Excluir productos que ya están en el grid
                const filtered = mapped.filter(p => {
                    const pCode = p.codigo || p.codins;
                    return !formData.items.some(item => item.codProducto === pCode);
                });

                setRowResults(filtered as Producto[]);
            }
        } catch (e) { console.error(e); }
    };

    const handleRowProductSelect = (idx: number, p: Producto) => {
        const newItems = [...formData.items];
        const codProducto = p.codigo || (p as any).codins || 'N/A';

        // Verificar si el producto ya existe en otra fila
        const existingItemIndex = newItems.findIndex((item, i) =>
            i !== idx &&
            item.codProducto === codProducto &&
            item.codProducto !== 'N/A'
        );

        if (existingItemIndex !== -1) {
            // El producto ya existe, incrementar la cantidad del existente
            const existingItem = newItems[existingItemIndex];
            existingItem.cantidad += 1;

            // Recalcular totales del item existente
            let basePExt = existingItem.precioUnitario;
            if (ivaIncluido === 1) {
                basePExt = existingItem.precioUnitario / (1 + (existingItem.ivaPorcentaje / 100));
            }
            const subtotalExisting = (basePExt * existingItem.cantidad) * (1 - (existingItem.descuentoPorcentaje / 100));
            const ivaExisting = subtotalExisting * (existingItem.ivaPorcentaje / 100);

            existingItem.subtotal = round(subtotalExisting);
            existingItem.valorIva = round(ivaExisting);
            existingItem.total = round(subtotalExisting + ivaExisting);

            // Eliminar la fila vacía actual
            newItems.splice(idx, 1);
        } else {
            // El producto no existe, agregarlo a la fila actual
            const currentQty = newItems[idx].cantidad;

            newItems[idx] = {
                ...newItems[idx],
                productoId: p.id,
                descripcion: p.nombre,
                codProducto: codProducto,
                referencia: p.referencia || '',
                precioUnitario: p.ultimoCosto || 0,
                ivaPorcentaje: p.tasaIva || 0,
                unidadMedida: p.unidadMedida || 'UND',
                unidadMedidaCodigo: (p as any).unidadMedidaCodigo || '',
                stock: (p as any).stock || (p as any).caninv || 0  // Agregar stock
            };

            // Recalcular con la cantidad actual
            const currentItem = newItems[idx];
            let basePCurr = currentItem.precioUnitario;
            if (ivaIncluido === 1) {
                basePCurr = currentItem.precioUnitario / (1 + (currentItem.ivaPorcentaje / 100));
            }
            const subtotalNew = (basePCurr * currentQty) * (1 - (currentItem.descuentoPorcentaje / 100));
            const ivaNew = subtotalNew * (currentItem.ivaPorcentaje / 100);

            currentItem.subtotal = round(subtotalNew);
            currentItem.valorIva = round(ivaNew);
            currentItem.total = round(subtotalNew + ivaNew);
        }

        setFormData(prev => ({ ...prev, items: newItems }));
        setActiveSearchIdx(null);
        setRowResults([]);
    };


    const pickCliente = async (c: Cliente) => {
        const nombreProper = toProperCase(c.nombreCompleto || c.razonSocial || '');
        setClienteSearch(nombreProper);
        setIsClienteOpen(false);
        setSelectedCliente({ ...c, nombreCompleto: nombreProper });

        let nit = c.numeroDocumento || '';
        let dv = c.digitoVerificacion || '';
        if (nit.includes('-')) {
            const parts = nit.split('-');
            nit = parts[0];
            dv = parts[1];
        }

        // Obtener codtar directamente del cliente seleccionado
        const codTarifaCliente = (c as any).codtar || '';

        if (codTarifaCliente) {
            // Cliente TIENE tarifa asignada
            setClienteTieneTarifa(true);
            setCodigoTarifa(codTarifaCliente);
            // Obtener nombre de la tarifa
            try {
                const respTarifa = await apiClient.executeQuery(
                    `SELECT nomtar FROM inv_listaprecios WHERE codtar = '${codTarifaCliente}'`
                );
                if (respTarifa.success && respTarifa.data && Array.isArray(respTarifa.data) && respTarifa.data.length > 0) {
                    setTarifaNombre(respTarifa.data[0].nomtar || '');
                } else {
                    setTarifaNombre('');
                }
            } catch (e) {
                console.error('Error obteniendo nombre de tarifa:', e);
                setTarifaNombre('');
            }
        } else {
            // Cliente NO tiene tarifa asignada: habilitar combo
            setClienteTieneTarifa(false);
            setCodigoTarifa('');
            setTarifaNombre('');
        }

        // Si hay un producto seleccionado en los inputs de "Añadir Producto", actualizar su precio
        if (selectedProduct) {
            const codProd = selectedProduct.codigo || (selectedProduct as any).codins;
            if (codProd) {
                try {
                    const resp = await apiSearchProductos(codProd, 1, selectedSede?.codigo, codTarifaCliente);
                    if (resp.success && resp.data && Array.isArray(resp.data) && resp.data.length > 0) {
                        const prodActualizado = resp.data[0];
                        // Usar el precio de lista directamente (bruto si ivaIncluido=1)
                        const precioVenta = prodActualizado.ultimoCosto || 0;
                        setCurrentUnitPrice(precioVenta);
                        setSelectedProduct(prev => prev ? ({ ...prev, ultimoCosto: precioVenta }) : null);
                        addNotification({ message: 'Precio del producto a añadir actualizado según tarifa del cliente', type: 'info' });
                    }
                } catch (e) {
                    console.error('Error al actualizar precio del producto seleccionado:', e);
                }
            }
        }

        // Actualizar precios de los items existentes según la nueva tarifa
        const updatedItems = await Promise.all(
            formData.items.map(async (item) => {
                // Si el item ya tiene un producto asignado, actualizar su precio
                if (item.codProducto && item.codProducto !== 'N/A') {
                    try {
                        // Buscar el producto con la nueva tarifa
                        const resp = await apiSearchProductos(item.codProducto, 1, selectedSede?.codigo, codTarifaCliente);
                        if (resp.success && resp.data && Array.isArray(resp.data) && resp.data.length > 0) {
                            const productoActualizado = resp.data[0];

                            // Mantener el precio unitario tal cual viene de la lista (bruto si ivaIncluido=1)
                            const nuevoPrecio = productoActualizado.ultimoCosto || item.precioUnitario;

                            let precioBase = nuevoPrecio;
                            if (ivaIncluido === 1) {
                                const tasaIva = (productoActualizado.tasaIva || 0) / 100;
                                precioBase = nuevoPrecio / (1 + tasaIva);
                            }

                            const subtotalNeto = (precioBase * item.cantidad) * (1 - (item.descuentoPorcentaje / 100));
                            const valorIva = subtotalNeto * (item.ivaPorcentaje / 100);
                            const totalLinea = subtotalNeto + valorIva;

                            return {
                                ...item,
                                precioUnitario: nuevoPrecio,
                                subtotal: round(subtotalNeto),
                                valorIva: round(valorIva),
                                total: round(totalLinea)
                            };
                        }
                    } catch (e) {
                        console.error('Error actualizando precio del item:', e);
                    }
                }
                // Si no se pudo actualizar, devolver el item sin cambios
                return item;
            })
        );

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
            },
            items: updatedItems // Actualizar items con nuevos precios
        }));

        // NUEVO: Auto-seleccionar vendedor si el cliente tiene uno asignado y el usuario no tiene uno fijo
        const codVenCliente = (c as any).codven || '';
        if (codVenCliente && !usuarioTieneVendedor) {
            const vEncontrado = vendedoresDisponibles.find(v => (v.codigoVendedor || v.id || (v as any).codiEmple) === codVenCliente);
            if (vEncontrado) {
                setSelectedVendedor(vEncontrado);
                setVendedorSearch(vEncontrado.nombreCompleto || `${vEncontrado.primerNombre} ${vEncontrado.primerApellido}`);
                setFormData(prev => ({ ...prev, seller: vEncontrado.codigoVendedor || vEncontrado.id || '' }));
            }
        }
    };

    const pickVendedor = (v: Vendedor) => {
        const nombreProper = toProperCase(v.nombreCompleto || `${v.primerNombre} ${v.primerApellido}`);
        setVendedorSearch(nombreProper);
        setSelectedVendedor({ ...v, nombreCompleto: nombreProper });
        setFormData(prev => ({ ...prev, seller: v.codigoVendedor || v.id || '' }));
        setIsVendedorOpen(false);
    };

    const handleProductSelect = (p: Producto) => {
        const nombreProper = toProperCase(p.nombre);
        setSelectedProduct({ ...p, nombre: nombreProper });
        setProductSearchTerm(nombreProper);
        setIsProductDropdownOpen(false);
        setCurrentQuantity(1);

        // precio_lista = Inv_detaprecios.valins (precio mínimo de referencia)
        const precioLista = (p as any).precio_lista || (p as any).precioConIva || p.ultimoCosto || 0;
        setPrecioListaMinimo(precioLista);

        // Se muestra el precio tal cual viene (con IVA si aplica)
        setCurrentUnitPrice(precioLista);
        setCurrentIva(p.tasaIva || 0);
        setCurrentDiscount(0);
    };

    const handleAddItem = () => {
        if (!selectedProduct) return;

        const quantityNum = Number(currentQuantity);
        const discountNum = Number(currentDiscount);
        const price = Number(currentUnitPrice);
        const ivaPorcentaje = Number(currentIva);

        // Limpieza del selector (siempre al final de la ejecución o ante fallo crítico de lógica)
        const cleanupSelector = () => {
            setSelectedProduct(null);
            setProductSearchTerm('');
            setCurrentQuantity(1);
            setCurrentUnitPrice(0);
            setCurrentIva(0);
            setCurrentDiscount(0);
            setPrecioListaMinimo(0);
            setIsProductDropdownOpen(false);
        };

        if (quantityNum <= 0) {
            addNotification({ message: 'La cantidad debe ser mayor a 0', type: 'warning' });
            return;
        }

        const stockDisponible = Number(String((selectedProduct as any).stock || (selectedProduct as any).caninv || 0).replace(/,/g, '')) || 0;
        if (quantityNum > stockDisponible) {
            addNotification({
                message: `La cantidad (${quantityNum}) supera la existencia disponible (${stockDisponible}).`,
                type: 'warning'
            });
            cleanupSelector(); // Limpiamos para evitar reintentos erróneos sobre el mismo producto
            return;
        }

        if (price <= 0) {
            addNotification({ message: 'El precio debe ser mayor a 0', type: 'warning' });
            return;
        }

        // Validación: precio no puede ser inferior al precio de lista (Inv_detaprecios.valins)
        if (precioListaMinimo > 0 && price < precioListaMinimo) {
            addNotification({ message: `El precio no puede ser inferior al precio de lista: ${precioListaMinimo.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}`, type: 'warning' });
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

        let unitPriceBase = price;
        if (ivaIncluido === 1) {
            unitPriceBase = price / (1 + (ivaPorcentaje / 100));
        }

        const brutoBase = unitPriceBase * quantityNum;
        const discountVal = brutoBase * (discountNum / 100);
        const subtotalNeto = brutoBase - discountVal;
        const valorIva = subtotalNeto * (ivaPorcentaje / 100);
        const totalLinea = subtotalNeto + valorIva;

        // Verificar si el producto ya existe
        const existingItemIndex = formData.items.findIndex(item =>
            (item.productoId === selectedProduct.id) ||
            (item.codProducto === (selectedProduct.codigo || (selectedProduct as any).codins))
        );

        if (existingItemIndex !== -1) {
            // Actualizar item existente
            const newItems = [...formData.items];
            const existingItem = newItems[existingItemIndex];
            const nuevaCantidadTotal = existingItem.cantidad + quantityNum;
            const stockActualItem = Number(String(existingItem.stock || 0).replace(/,/g, '')) || 0;

            if (nuevaCantidadTotal > stockActualItem) {
                addNotification({
                    message: `No se puede agregar. El total acumulado (${nuevaCantidadTotal}) superaría la existencia (${stockActualItem}).`,
                    type: 'warning'
                });
                cleanupSelector();
                return;
            }

            existingItem.cantidad = nuevaCantidadTotal;

            // Recalcular totales
            let unitPBase = existingItem.precioUnitario;
            if (ivaIncluido === 1) {
                unitPBase = existingItem.precioUnitario / (1 + (existingItem.ivaPorcentaje / 100));
            }

            const newBrutoBase = unitPBase * existingItem.cantidad;
            const newDiscountVal = newBrutoBase * (existingItem.descuentoPorcentaje / 100);
            const newSubtotalNeto = newBrutoBase - newDiscountVal;
            const newValorIva = newSubtotalNeto * (existingItem.ivaPorcentaje / 100);
            const newTotalLinea = newSubtotalNeto + newValorIva;

            existingItem.subtotal = round(newSubtotalNeto);
            existingItem.valorIva = round(newValorIva);
            existingItem.total = round(newTotalLinea);

            setFormData(prev => ({ ...prev, items: newItems }));
            addNotification({ message: 'Producto actualizado en la lista (cantidad sumada)', type: 'success' });
        } else {
            // Agregar nuevo item
            const newItem: DocumentItem = {
                productoId: selectedProduct.id,
                descripcion: toProperCase(selectedProduct.nombre),
                cantidad: quantityNum,
                precioUnitario: price,
                ivaPorcentaje: ivaPorcentaje,
                descuentoPorcentaje: discountNum,
                subtotal: round(subtotalNeto),
                valorIva: round(valorIva),
                total: round(totalLinea),
                codProducto: selectedProduct.codigo || (selectedProduct as any).codins || 'N/A',
                referencia: selectedProduct.referencia || '',
                unidadMedidaCodigo: (selectedProduct as any).unidadMedidaCodigo || '',
                unidadMedida: selectedProduct.unidadMedida || 'UND',
                stock: stockDisponible
            };
            setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
        }

        cleanupSelector();
    };

    const handleRemoveItem = (index: number) => {
        setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
    };

    const handleUpdateItem = (index: number, field: keyof DocumentItem, value: any) => {
        const newItems = [...formData.items];
        let finalValue = value;

        if (field === 'cantidad') {
            const qtyNum = Number(value);
            const itemOriginal = newItems[index];
            const stockActual = itemOriginal.stock || 0;

            if (qtyNum > stockActual) {
                addNotification({
                    message: `La cantidad (${qtyNum}) supera la existencia disponible (${stockActual}). Se restablecerá a 1.`,
                    type: 'warning'
                });
                finalValue = 1;
            } else if (qtyNum <= 0) {
                finalValue = 1;
            }
        }

        const item = { ...newItems[index], [field]: finalValue };

        const qty = Number(item.cantidad) || 0;
        const prc = Number(item.precioUnitario) || 0;
        const dPct = Number(item.descuentoPorcentaje) || 0;
        const iPct = Number(item.ivaPorcentaje) || 0;

        let baseP = prc;
        if (ivaIncluido === 1) {
            baseP = prc / (1 + (iPct / 100));
        }

        const lBruto = baseP * qty;
        const lDisc = lBruto * (dPct / 100);
        const lNeto = lBruto - lDisc;
        const lIva = lNeto * (iPct / 100);
        const lTotal = lNeto + lIva;

        item.subtotal = round(lNeto);
        item.valorIva = round(lIva);
        item.total = round(lTotal);

        newItems[index] = item;
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const totals = useMemo(() => {
        const result = formData.items.reduce((acc, item) => {
            let uPriceBase = item.precioUnitario;
            if (ivaIncluido === 1) {
                uPriceBase = item.precioUnitario / (1 + (item.ivaPorcentaje / 100));
            }

            const lBrutoBase = uPriceBase * item.cantidad;
            const lDiscount = lBrutoBase * (item.descuentoPorcentaje / 100);

            return {
                subtotalBruto: acc.subtotalBruto + lBrutoBase,
                descuentoTotal: acc.descuentoTotal + lDiscount,
                iva: acc.iva + (item.valorIva || 0)
            };
        }, { subtotalBruto: 0, descuentoTotal: 0, iva: 0 });

        return {
            subtotalBruto: round(result.subtotalBruto, 0),
            descuentoTotal: round(result.descuentoTotal, 0),
            iva: round(result.iva, 0),
            total: round((result.subtotalBruto - result.descuentoTotal) + result.iva, 0)
        };
    }, [formData.items, ivaIncluido]);

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
            {/* Consolidated Header Bar */}
            {selectedSede ? (
                <div className="p-2.5 px-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex flex-row flex-nowrap items-center gap-x-6 text-xs text-blue-800 dark:text-blue-200 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <i className="fas fa-warehouse text-blue-500"></i>
                        <span className="font-bold whitespace-nowrap">Bodega:</span>
                        <span className="whitespace-nowrap font-semibold text-sm">{toProperCase(selectedSede.nombre)}</span>
                    </div>

                    <div className="h-4 w-px bg-blue-200 dark:bg-blue-800 flex-shrink-0"></div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <i className="fas fa-file-invoice text-blue-500"></i>
                        <span className="font-bold whitespace-nowrap uppercase">N° Factura:</span>
                        <input
                            type="text"
                            value={formData.number}
                            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                            readOnly={selectedCompany?.db_name !== 'orquidea'}
                            className={`w-28 px-2 py-1.5 text-sm border rounded outline-none transition-colors ${selectedCompany?.db_name === 'orquidea'
                                ? 'bg-white border-blue-300 focus:border-blue-500 text-slate-800'
                                : 'bg-transparent border-transparent text-blue-800 dark:text-blue-200 font-bold cursor-default'
                                }`}
                        />
                    </div>

                    <div className="h-4 w-px bg-blue-200 dark:bg-blue-800 flex-shrink-0"></div>

                    <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
                        <i className="fas fa-user-tie text-blue-500"></i>
                        <span className="font-bold whitespace-nowrap uppercase shrink-0">Vendedor:</span>
                        {usuarioTieneVendedor ? (
                            <span className="whitespace-nowrap font-semibold text-sm truncate ml-1">{toProperCase(vendedorSearch)}</span>
                        ) : (
                            <select
                                value={selectedVendedor?.codigoVendedor || selectedVendedor?.id || ''}
                                onChange={(e) => {
                                    const vendedor = vendedoresDisponibles.find(v => (v.codigoVendedor || v.id) === e.target.value);
                                    if (vendedor) {
                                        setSelectedVendedor(vendedor);
                                        const nameProper = toProperCase(vendedor.nombreCompleto || `${vendedor.primerNombre} ${vendedor.primerApellido}`);
                                        setVendedorSearch(nameProper);
                                        setFormData(prev => ({ ...prev, seller: vendedor.codigoVendedor || vendedor.id || '' }));
                                    }
                                }}
                                className="bg-transparent border-b border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 text-sm py-0.5 px-2 outline-none focus:border-blue-500 transition-colors font-medium min-w-[140px] max-w-[220px] truncate"
                            >
                                <option value="" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">-- Seleccionar --</option>
                                {vendedoresDisponibles.map(v => (
                                    <option key={v.id} value={v.codigoVendedor || v.id} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                                        {toProperCase(v.nombreCompleto || `${v.primerNombre} ${v.primerApellido}`)}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="h-4 w-px bg-blue-200 dark:bg-blue-800 flex-shrink-0"></div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <i className="fas fa-calendar-alt text-blue-500"></i>
                        <span className="font-bold whitespace-nowrap">Fecha:</span>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-400 font-semibold"
                        />
                    </div>
                </div>
            ) : (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span className="font-medium">Advertencia:</span>
                    <span>No hay bodega seleccionada. Por favor, selecciona una bodega en el header.</span>
                </div>
            )}

            {/* Client and Payment Info */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div ref={clienteRef} className="relative md:col-span-4">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Cliente</label>
                    <button
                        type="button"
                        onClick={() => setIsClienteOpen(!isClienteOpen)}
                        className={`w-full px-3 py-1.5 text-sm border rounded-md text-left flex justify-between items-center transition-all ${formData.customer.identification_number && (!formData.customer.email || !formData.customer.email.includes('@'))
                            ? 'bg-red-50 border-red-300 text-red-700'
                            : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                            }`}
                    >
                        <span className="truncate">
                            {selectedCliente ? toProperCase(selectedCliente.nombreCompleto || selectedCliente.razonSocial || '') : 'Seleccionar cliente...'}
                        </span>
                        <i className={`fas fa-chevron-down text-xs transition-transform ${isClienteOpen ? 'rotate-180' : ''}`}></i>
                    </button>

                    {formData.customer.identification_number && (!formData.customer.email || !formData.customer.email.includes('@')) && (
                        <p className="text-[10px] text-red-500 mt-0.5">⚠️ Cliente sin email válido</p>
                    )}

                    {isClienteOpen && (
                        <div className="absolute z-[100] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-xl overflow-hidden">
                            <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <div className="relative">
                                    <i className="fas fa-search absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={clienteSearch}
                                        onChange={(e) => setClienteSearch(e.target.value)}
                                        placeholder="Filtrar por nombre o NIT..."
                                        className="w-full pl-7 pr-3 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                                {clienteResults.length > 0 ? (
                                    clienteResults.map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => pickCliente(c)}
                                            className="px-3 py-2 hover:bg-blue-500 hover:text-white cursor-pointer text-sm border-b last:border-0 border-slate-50 dark:border-slate-700 transition-colors"
                                        >
                                            <div className="font-medium">{toProperCase(c.nombreCompleto || c.razonSocial || '')}</div>
                                            <div className="text-[10px] opacity-70">NIT: {c.numeroDocumento}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-3 py-4 text-center text-slate-400 text-xs italic">
                                        {clienteSearch.length < 2 ? 'Escriba para buscar...' : 'No se encontraron clientes'}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Tarifa: readonly si el cliente la tiene, combo si no */}
                {selectedCliente && (
                    <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Tarifa Asignada</label>
                        {clienteTieneTarifa ? (
                            <input
                                type="text"
                                value={`${codigoTarifa} - ${tarifaNombre}`}
                                readOnly
                                className="w-full px-3 py-1.5 text-sm bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-md text-green-700 dark:text-green-400 font-semibold cursor-default outline-none"
                            />
                        ) : (
                            <select
                                value={codigoTarifa}
                                onChange={(e) => {
                                    const selected = tarifasDisponibles.find(t => t.codtar === e.target.value);
                                    setCodigoTarifa(e.target.value);
                                    setTarifaNombre(selected?.nomtar || '');
                                }}
                                className="w-full px-3 py-1.5 text-sm bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-600 rounded-md text-yellow-800 dark:text-yellow-300 font-semibold focus:ring-2 focus:ring-yellow-500 outline-none"
                            >
                                <option value="">-- Seleccione tarifa --</option>
                                {tarifasDisponibles.map(t => (
                                    <option key={t.codtar} value={t.codtar}>{t.codtar} - {t.nomtar}</option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

                <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Forma Pago</label>
                    <select
                        value={formData.paymentFormId}
                        onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => {
                                let newMethodId = prev.paymentMethodId;

                                if (val === '2') {
                                    // Cambiando a Crédito: Forzar 44
                                    newMethodId = '44';
                                } else if (val === '1') {
                                    // Cambiando a Contado
                                    // Si estaba en 44 (Crédito), restaurar a 9 (Efectivo) por defecto
                                    if (prev.paymentMethodId === '44') {
                                        newMethodId = '10'; // Changed from 9 to 10 for Efectivo
                                    }
                                    // Si estaba en 9 o 30, se mantiene
                                }

                                return {
                                    ...prev,
                                    paymentFormId: val,
                                    paymentMethodId: newMethodId
                                };
                            });
                        }}
                        className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="1">Contado</option>
                        <option value="2">Crédito</option>
                    </select>
                </div>

                <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Medio Pago</label>
                    <select
                        value={formData.paymentMethodId}
                        onChange={(e) => setFormData({ ...formData, paymentMethodId: e.target.value })}
                        disabled={formData.paymentFormId === '2'}
                        className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
                    >
                        <option value="10">Efectivo</option>
                        <option value="42">Consignación Bancaria</option>
                        <option value="20">Cheque</option>
                        <option value="48">Tarjeta Crédito</option>
                        <option value="49">Tarjeta Débito</option>
                        <option value="47">Transferencia Bancaria</option>
                        <option value="44" hidden={formData.paymentFormId !== '2'}>Nota Crédito (Solo para Crédito)</option>
                        <option value="9">Otros</option>
                    </select>
                </div>
            </div>

            {/* Row for Selected Client/Vendor Info Cards */}
            {
                (selectedCliente || selectedVendedor) && (
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
                                        {tarifaNombre && (
                                            <span className="bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded text-green-700 dark:text-green-400 font-semibold">
                                                <i className="fas fa-tag mr-1"></i>
                                                {codigoTarifa} - {tarifaNombre}
                                            </span>
                                        )}
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
                )
            }

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
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 tracking-wider">Añadir Productos</h3>
                <div ref={productRef} className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-end bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    {/* 1. Producto (4) */}
                    <div className="lg:col-span-4 relative">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Producto</label>
                        <button
                            type="button"
                            onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-left flex justify-between items-center transition-all focus:ring-2 focus:ring-blue-500"
                        >
                            <span className="truncate">
                                {selectedProduct ? toProperCase(selectedProduct.nombre) : 'Seleccionar producto...'}
                            </span>
                            <i className={`fas fa-search text-xs text-slate-400 transition-transform ${isProductDropdownOpen ? 'scale-110' : ''}`}></i>
                        </button>

                        {isProductDropdownOpen && (
                            <div className="absolute z-[100] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-xl overflow-hidden">
                                <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                    <div className="relative">
                                        <i className="fas fa-search absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={productSearchTerm}
                                            onChange={(e) => setProductSearchTerm(e.target.value)}
                                            placeholder="Filtrar por nombre o referencia..."
                                            className="w-full pl-7 pr-3 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                    {productResults.length > 0 ? (
                                        productResults.map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => handleProductSelect(p)}
                                                className="px-3 py-2 hover:bg-blue-500 hover:text-white cursor-pointer text-sm border-b last:border-0 border-slate-50 dark:border-slate-700 transition-colors"
                                            >
                                                <div className="font-medium">{toProperCase(p.nombre)}</div>
                                                <div className="text-[10px] opacity-70 flex justify-between">
                                                    <span>REF: {p.referencia || p.codigo}</span>
                                                    <span>Stock: {(p as any).stock || 0}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-3 py-4 text-center text-slate-400 text-xs italic">
                                            {productSearchTerm.length < 2 ? 'Escriba para buscar...' : 'No se encontraron productos'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. Cantidad (1) */}
                    <div className="lg:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 text-center">Cant.</label>
                        <input
                            type="number"
                            min="1"
                            value={currentQuantity}
                            onChange={(e) => setCurrentQuantity(e.target.value)}
                            onBlur={(e) => {
                                if (!selectedProduct) return;
                                const qty = Number(e.target.value);
                                const stock = (selectedProduct as any).stock || (selectedProduct as any).caninv || 0;
                                if (qty > stock) {
                                    addNotification({
                                        message: `La cantidad (${qty}) supera la existencia (${stock}). Se restablecerá a 1.`,
                                        type: 'warning'
                                    });
                                    setCurrentQuantity(1);
                                } else if (qty <= 0) {
                                    setCurrentQuantity(1);
                                }
                            }}
                            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-center focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        />
                    </div>

                    {/* 3. Precio Unitario (1) */}
                    <div className="lg:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 text-right">Precio</label>
                        <input
                            type="number"
                            min="0"
                            value={currentUnitPrice}
                            onChange={(e) => {
                                const newPrice = Number(e.target.value);
                                if (precioListaMinimo > 0 && newPrice < precioListaMinimo && newPrice > 0) {
                                    addNotification({ message: `Precio mínimo: ${precioListaMinimo.toLocaleString()}`, type: 'warning' });
                                }
                                setCurrentUnitPrice(e.target.value);
                            }}
                            className={`w-full px-2 py-1.5 text-sm border rounded-md text-right focus:ring-2 focus:ring-blue-500 outline-none ${precioListaMinimo > 0 && Number(currentUnitPrice) < precioListaMinimo && Number(currentUnitPrice) > 0
                                ? 'bg-red-50 border-red-400 text-red-700 font-bold'
                                : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                                }`}
                        />
                    </div>

                    {/* 4. IVA (1) */}
                    <div className="lg:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 text-center">IVA %</label>
                        <input
                            type="number"
                            min="0"
                            value={currentIva}
                            onChange={(e) => setCurrentIva(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-right focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    {/* 5. Descuento (1) */}
                    <div className="lg:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 text-center">Desc %</label>
                        <input
                            type="number"
                            min="0"
                            value={currentDiscount}
                            onChange={(e) => setCurrentDiscount(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-right focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    {/* 6. Stock (1) - Info */}
                    <div className="lg:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Stock</label>
                        <div className="w-full px-1 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-md text-center text-slate-600 dark:text-slate-400 font-medium">
                            {selectedProduct ? ((selectedProduct as any).stock || (selectedProduct as any).caninv || 0) : '-'}
                        </div>
                    </div>

                    {/* 7. Unidad (1) - Info */}
                    <div className="lg:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">UND</label>
                        <div className="w-full px-1 py-1.5 text-[10px] bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-md text-center text-slate-500 font-medium uppercase truncate">
                            {selectedProduct?.unidadMedida || 'UNIDAD'}
                        </div>
                    </div>

                    {/* 8. Total (1) - Info */}
                    <div className="lg:col-span-1">
                        <label className="block text-[10px] font-bold text-blue-500 uppercase mb-1 text-right">Total</label>
                        <div className="w-full px-1 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md text-right text-blue-700 dark:text-blue-300 font-bold">
                            {calculatedTotal.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                        </div>
                    </div>

                    {/* 9. Botón (1) */}
                    <div className="lg:col-span-1 flex items-end">
                        <button
                            type="button"
                            onClick={handleAddItem}
                            disabled={!selectedProduct}
                            className={`w-full py-1.5 rounded-md flex items-center justify-center gap-2 transition-all ${!selectedProduct
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md'
                                }`}
                        >
                            <i className="fas fa-shopping-cart text-sm"></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div ref={tableRef} className="rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-xs">
                        <tr>
                            <th className="px-2 py-3">Código</th>
                            <th className="px-2 py-3">Producto</th>
                            <th className="px-2 py-3 text-right">Existencia</th>
                            <th className="px-2 py-3 text-center">Unidad</th>
                            <th className="px-2 py-3 text-right">Cantidad</th>
                            <th className="px-2 py-3 text-right">Vr. Precio de Lista</th>
                            <th className="px-2 py-3 text-right">% IVA</th>
                            <th className="px-2 py-3 text-right">% DESC.</th>
                            <th className="px-2 py-3 text-right">TOTAL</th>
                            <th className="px-2 py-3 text-center">ACCIÓN</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                        {formData.items.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="px-4 py-8 text-center text-slate-400 italic">
                                    No hay productos añadidos
                                </td>
                            </tr>
                        ) : (
                            formData.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="px-4 py-3 font-mono text-xs">{item.codProducto || item.referencia || 'N/A'}</td>
                                    <td className="px-4 py-3 relative">
                                        <input
                                            type="text"
                                            value={item.descripcion}
                                            readOnly
                                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded px-2 py-1 text-sm outline-none transition-all cursor-default font-medium text-slate-700 dark:text-slate-200"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-sm">
                                        <span className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded text-blue-700 dark:text-blue-400">
                                            {((item as any).stock || 0).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-[10px] text-slate-500 font-mono uppercase">{item.unidadMedida || 'UND'}</td>
                                    <td className="px-4 py-3 text-right">
                                        <input
                                            type="number"
                                            value={item.cantidad}
                                            onChange={(e) => handleUpdateItem(idx, 'cantidad', e.target.value)}
                                            className="w-20 text-right bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1 py-1 text-sm font-bold focus:border-blue-500 outline-none"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <input
                                            type="number"
                                            value={item.precioUnitario}
                                            onChange={(e) => handleUpdateItem(idx, 'precioUnitario', e.target.value)}
                                            className="w-28 text-right bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <input
                                            type="number"
                                            value={item.ivaPorcentaje}
                                            readOnly
                                            className="w-16 text-right bg-transparent border-none px-1 py-1 text-sm outline-none cursor-default text-slate-500"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <input
                                            type="number"
                                            value={item.descuentoPorcentaje}
                                            readOnly
                                            className="w-16 text-right bg-transparent border-none px-1 py-1 text-sm outline-none cursor-default text-slate-500"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                                        {item.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}
                                    </td>
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
