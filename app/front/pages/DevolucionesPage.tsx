import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Table, { Column } from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import { useTable } from '../hooks/useTable';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { useNotifications } from '../hooks/useNotifications';
import { generateAccountingNote, generateEmailForReturn } from '../services/geminiService';
import { Factura, NotaCredito, DocumentItem } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import ProtectedComponent from '../components/auth/ProtectedComponent';
import NotaCreditoPreviewModal from '../components/devoluciones/NotaCreditoPreviewModal';
import DocumentPreviewModal from '../components/comercial/DocumentPreviewModal';
import NotaCreditoPDFDocument from '../components/devoluciones/NotaCreditoPDFDocument';
import { useData } from '../hooks/useData';
import { fetchFacturasDetalle } from '../services/apiClient';
import { useClientesConFacturasAceptadas } from '../hooks/useClientesConFacturasAceptadas';
import SendEmailModal from '../components/comercial/SendEmailModal';
import apiClient from '../services/apiClient';
import { pdf } from '@react-pdf/renderer';

const formatCurrency = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

interface DevolucionItem {
    productoId: number;
    cantidadDevuelta: number;
    motivo: string; // Texto final que se enviará (puede ser personalizado)
    motivoSeleccion: string; // Valor seleccionado en el combo (incluye "Otro")
}

const DevolucionesPage: React.FC = () => {
    const {
        crearNotaCredito,
        datosEmpresa,
        almacenes,
        productos,
        motivosDevolucion,
        notasCredito,
        clientes, // Restoring strict needed
        facturas // Restoring strict needed
    } = useData();

    // Nueva lógica estricta para clientes y facturas
    const { clientes: clientesEstrictos, isLoading: isLoadingClientes } = useClientesConFacturasAceptadas();

    const DEFAULT_MOTIVOS = useMemo(() => ([
        'Producto defectuoso',
        'Producto en mal estado',
        'Error en el despacho',
        'Diferencia en cantidades',
        'Cliente no aceptó la mercancía',
        'Otro'
    ]), []);

    const motivosDisponibles = useMemo(() => {
        if (Array.isArray(motivosDevolucion) && motivosDevolucion.length > 0) {
            const limpios = motivosDevolucion
                .map(m => (typeof m === 'string' ? m.trim() : ''))
                .filter(m => m.length > 0);
            if (!limpios.includes('Otro')) {
                limpios.push('Otro');
            }
            return limpios;
        }
        return DEFAULT_MOTIVOS;
    }, [motivosDevolucion, DEFAULT_MOTIVOS]);

    const getMotivoDefault = useCallback(() => motivosDisponibles[0] || 'Otro', [motivosDisponibles]);

    // Component State
    const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
    const [activeSubTab, setActiveSubTab] = useState<'contable' | 'kardex'>('contable');
    const [draftNotaToPreview, setDraftNotaToPreview] = useState<NotaCredito | null>(null);
    const [isConfirmingSave, setIsConfirmingSave] = useState(false);

    // Form State

    const [clienteId, setClienteId] = useState('');
    const [facturaId, setFacturaId] = useState('');
    const [isTotalDevolucion, setIsTotalDevolucion] = useState(false);
    const [transmisionDian, setTransmisionDian] = useState(false);
    const [tipoNota, setTipoNota] = useState<'DEVOLUCION' | 'ANULACION'>('DEVOLUCION');
    const [devolucionItems, setDevolucionItems] = useState<DevolucionItem[]>([]);
    const [cantidadesYaDevueltas, setCantidadesYaDevueltas] = useState<Map<number, number>>(new Map());
    // Estado local para items de factura cargados dinámicamente (cuando no están en el DataContext)
    const [facturaItemsCargados, setFacturaItemsCargados] = useState<DocumentItem[]>([]);

    // UI State
    const [isSaving, setIsSaving] = useState(false); // UPDATE: Add saving state for UX
    const [savedNota, setSavedNota] = useState<NotaCredito | null>(null);
    const [accountingNote, setAccountingNote] = useState({ loading: false, text: '', error: false });
    const [geminiEmail, setGeminiEmail] = useState({ loading: false, text: '', modalOpen: false });
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedNotaParaVer, setSelectedNotaParaVer] = useState<NotaCredito | null>(null);
    const [notaParaImprimir, setNotaParaImprimir] = useState<NotaCredito | null>(null);
    const [notaToEmail, setNotaToEmail] = useState<NotaCredito | null>(null);
    const [nextNoteNumber, setNextNoteNumber] = useState<string>('');

    useEffect(() => {
        const fetchNextNumber = async () => {
            try {
                const res = await apiClient.getNextCreditNoteNumber();
                if (res.success && res.data) {
                    setNextNoteNumber(res.data.nextNumber);
                }
            } catch (err) {
                console.error("Error fetching next credit note number", err);
            }
        };
        fetchNextNumber();
    }, []);

    // Hooks
    const { addNotification } = useNotifications();

    const isFormDisabled = !!savedNota || isSaving;

    // Memoized derived data
    // Los clientes listados son exclusivamente los que vienen del endpoint estricto
    const clientesDisponibles = useMemo(() => {
        return clientesEstrictos;
    }, [clientesEstrictos]);

    useEffect(() => {
        if (!isLoadingClientes && clientesDisponibles.length === 0) {
            addNotification({
                message: 'No hay clientes ni facturas disponibles para devolución.',
                type: 'warning'
            });
        }
    }, [isLoadingClientes, clientesDisponibles, addNotification]);


    // Filtrar facturas del cliente seleccionado usando los datos estrictos
    const facturasFiltradas = useMemo(() => {
        if (!clienteId) return [];

        const clienteEstricto = clientesDisponibles.find(c => String(c.id) === String(clienteId));
        if (!clienteEstricto) return [];

        return clienteEstricto.facturasAceptadas;
    }, [clienteId, clientesDisponibles]);

    // Buscar factura de forma flexible: primero en facturasFiltradas, luego en todas las facturas
    // Si la factura tiene items cargados localmente, usarlos
    const selectedFactura = useMemo(() => {
        if (!facturaId) return undefined;

        // Primero buscar en facturasFiltradas (que son FacturaAceptada)
        const facturaAceptada = facturasFiltradas.find(f => String(f.id) === String(facturaId));

        let factura: Factura | undefined;

        if (facturaAceptada) {
            // Si la encontrada es FacturaAceptada, mapear a Factura, preservando items si ya existen
            // Intentar encontrar la factura completa en el contexto global si es posible para tener más datos
            const facturaCompleta = facturas.find(f => String(f.id) === String(facturaId));

            if (facturaCompleta) {
                factura = facturaCompleta;
            } else {
                // Si no está en global, usar la data básica de FacturasAceptadas
                factura = {
                    id: facturaAceptada.id,
                    numeroFactura: facturaAceptada.numeroFactura,
                    fechaFactura: facturaAceptada.fechaFactura,
                    total: facturaAceptada.total,
                    codalm: facturaAceptada.codalm,
                    cufe: facturaAceptada.cufe,
                    clienteId: clienteId, // Asumimos cliente actual
                    items: [], // Se cargarán los ítems
                    subtotal: 0, // Placeholder
                    descuentoValor: 0, // Placeholder
                    ivaValor: 0, // Placeholder
                    estado: 'ACEPTADA',
                    empresaId: 1, // Default
                    remisionesIds: []
                } as Factura;
            }
        } else {
            // Fallback antiguo
            factura = facturas.find(f => String(f.id) === String(facturaId));
        }


        // Si la factura no se encontró pero hay items cargados localmente,
        // crear un objeto factura básico para permitir mostrar los items
        if (!factura && facturaItemsCargados.length > 0) {
            // Buscar cualquier referencia de la factura en facturasFiltradas o facturas por ID
            // como fallback, crear una estructura mínima
            factura = {
                id: facturaId,
                numeroFactura: `Factura ${facturaId}`,
                fechaFactura: new Date().toISOString(),
                total: 0,
                items: facturaItemsCargados
            } as Factura;
        }

        // Si la factura existe pero no tiene items, y hay items cargados localmente, usarlos
        if (factura && (!factura.items || !Array.isArray(factura.items) || factura.items.length === 0) && facturaItemsCargados.length > 0) {
            factura = {
                ...factura,
                items: facturaItemsCargados
            };
        }

        return factura;
    }, [facturaId, facturasFiltradas, facturas, facturaItemsCargados]);

    const selectedCliente = useMemo(() => {
        if (!clienteId) return undefined;
        return clientesDisponibles.find(c => String(c.id) === String(clienteId));
    }, [clienteId, clientesDisponibles]);

    // Items disponibles para la factura seleccionada: combinar items de selectedFactura y facturaItemsCargados
    const itemsDisponiblesFactura = useMemo(() => {
        if (!selectedFactura) return [];

        // Priorizar items de selectedFactura, pero si no tiene o está vacío, usar facturaItemsCargados
        const itemsDeFactura = selectedFactura.items && Array.isArray(selectedFactura.items) && selectedFactura.items.length > 0
            ? selectedFactura.items
            : null;

        const itemsCargados = facturaItemsCargados.length > 0 ? facturaItemsCargados : null;

        if (process.env.NODE_ENV === 'development') {
            console.log('[Devoluciones] Calculando itemsDisponiblesFactura:', {
                facturaId: selectedFactura.id,
                itemsDeFacturaLength: itemsDeFactura?.length || 0,
                itemsCargadosLength: itemsCargados?.length || 0
            });
        }

        // Si hay items en la factura, usarlos; si no, usar los cargados localmente
        return itemsDeFactura || itemsCargados || [];
    }, [selectedFactura, facturaItemsCargados]);

    // Cargar items de la factura cuando se selecciona una factura y no tiene items cargados
    useEffect(() => {
        const cargarItemsFactura = async () => {
            if (!facturaId || !selectedFactura) {
                return;
            }

            // Si la factura ya tiene items cargados o hay items cargados localmente, no hacer nada
            const tieneItemsEnFactura = selectedFactura.items && Array.isArray(selectedFactura.items) && selectedFactura.items.length > 0;
            const tieneItemsCargadosLocalmente = facturaItemsCargados.length > 0;

            if (tieneItemsEnFactura || tieneItemsCargadosLocalmente) {
                if (process.env.NODE_ENV === 'development') {
                    console.log('[Devoluciones] Factura ya tiene items cargados:', {
                        enFactura: tieneItemsEnFactura,
                        localmente: tieneItemsCargadosLocalmente
                    });
                }
                return;
            }

            // Si la factura no tiene items, intentar cargarlos desde el backend
            try {
                // Usar el ID de la factura seleccionada directamente para mayor confiabilidad
                const idFacturaParaBackend = selectedFactura.id;

                if (process.env.NODE_ENV === 'development') {
                    console.log('[Devoluciones] Cargando items de la factura desde el backend:', {
                        facturaId: facturaId,
                        selectedFacturaId: idFacturaParaBackend,
                        numeroFactura: selectedFactura.numeroFactura
                    });
                }

                // Cargar detalles de facturas filtrando por facturaId
                // Pasar directamente el facturaId como string o number, no como objeto
                const detallesResponse = await fetchFacturasDetalle(idFacturaParaBackend);
                if (detallesResponse.success && detallesResponse.data) {
                    // El backend ya filtra por facturaId, así que usamos directamente los datos
                    const itemsFactura = Array.isArray(detallesResponse.data)
                        ? detallesResponse.data
                        : [];

                    if (itemsFactura.length > 0) {
                        // Mapear items del backend a la estructura esperada
                        const itemsMapeados = itemsFactura.map((d: any) => ({
                            productoId: d.productoId || null,
                            cantidad: Number(d.cantidad || d.qtyins || 0),
                            precioUnitario: Number(d.precioUnitario || d.valins || 0),
                            descuentoPorcentaje: Number(d.descuentoPorcentaje || d.desins || 0),
                            ivaPorcentaje: Number(d.ivaPorcentaje || 0),
                            descripcion: d.descripcion || d.observa || '',
                            subtotal: Number(d.subtotal || 0),
                            valorIva: Number(d.valorIva || d.ivains || 0),
                            total: Number(d.total || 0),
                            codProducto: d.codProducto || d.codins || ''
                        })).filter(item => item.productoId != null);

                        // Guardar items en estado local para usar en selectedFactura
                        setFacturaItemsCargados(itemsMapeados);

                        if (process.env.NODE_ENV === 'development') {
                            console.log('[Devoluciones] Items de factura cargados desde el backend y guardados en estado local:', itemsMapeados.length);
                        }
                    } else {
                        if (process.env.NODE_ENV === 'development') {
                            console.warn('[Devoluciones] No se encontraron items para la factura en el backend:', {
                                facturaId: facturaId,
                                selectedFacturaId: idFacturaParaBackend,
                                numeroFactura: selectedFactura.numeroFactura,
                                responseData: detallesResponse.data
                            });
                        }
                        addNotification({
                            message: 'La factura seleccionada no tiene productos asociados.',
                            type: 'warning'
                        });
                    }
                } else {
                    console.error('[Devoluciones] Error en respuesta del backend al cargar items:', detallesResponse);
                    addNotification({
                        message: 'Error al cargar los productos de la factura. Por favor, intente nuevamente.',
                        type: 'warning'
                    });
                }
            } catch (error) {
                console.error('[Devoluciones] Error cargando items de la factura:', error);
                addNotification({
                    message: 'Error al cargar los productos de la factura. Por favor, recargue la página.',
                    type: 'warning'
                });
            }
        };

        cargarItemsFactura();
    }, [facturaId, selectedFactura, addNotification]);

    useEffect(() => {
        if (selectedFactura && Array.isArray(notasCredito)) {
            const devueltasMap = new Map<number, number>();
            notasCredito
                .filter(nc => nc && nc.facturaId === selectedFactura.id)
                .forEach(nc => {
                    const items = Array.isArray(nc.itemsDevueltos) ? nc.itemsDevueltos : [];
                    items.forEach(itemDevuelto => {
                        if (itemDevuelto && typeof itemDevuelto.productoId === 'number') {
                            const currentTotal = devueltasMap.get(itemDevuelto.productoId) || 0;
                            devueltasMap.set(itemDevuelto.productoId, currentTotal + (itemDevuelto.cantidad || 0));
                        }
                    });
                });
            setCantidadesYaDevueltas(devueltasMap);
        } else {
            setCantidadesYaDevueltas(new Map());
        }
    }, [selectedFactura, notasCredito]);



    const handleClienteChange = (id: string) => {
        if (process.env.NODE_ENV === 'development') {
            console.log('[Devoluciones] handleClienteChange llamado con:', {
                id,
                tipo: typeof id,
                idLength: id ? String(id).length : 0
            });
        }

        // Asegurar que el ID se guarda correctamente
        const clienteIdValue = id && id.trim() !== '' && id !== 'undefined' && id !== 'null' ? id.trim() : '';
        setClienteId(clienteIdValue);
        setFacturaId('');
        setFacturaItemsCargados([]); // Limpiar items cargados al cambiar cliente
        resetFormPartially();

        if (process.env.NODE_ENV === 'development') {
            console.log('[Devoluciones] clienteId actualizado a:', clienteIdValue);
        }
    };

    const handleFacturaChange = (id: string) => {
        setFacturaId(id);
        setFacturaItemsCargados([]); // Limpiar items cargados al cambiar factura
        resetFormPartially();
    };

    const resetFormPartially = () => {
        setDevolucionItems([]);
        setIsTotalDevolucion(false);
        setSavedNota(null);
        setAccountingNote({ loading: false, text: '', error: false });
    };

    const handleCantidadChange = (productoId: number, cantidad: number) => {
        const factItem = selectedFactura?.items.find(i => i.productoId === productoId);
        if (!factItem) return;

        const yaDevueltos = cantidadesYaDevueltas.get(productoId) || 0;
        const cantidadMaxima = factItem.cantidad - yaDevueltos;

        let safeCantidad = cantidad;

        if (cantidad > cantidadMaxima) {
            addNotification({
                message: `Cantidad excede lo pendiente por devolver (${cantidadMaxima.toFixed(2)}). Se ha ajustado.`,
                type: 'warning'
            });
            safeCantidad = cantidadMaxima;
        }

        safeCantidad = Math.max(0, safeCantidad);

        setDevolucionItems(prev => {
            const existing = prev.find(i => i.productoId === productoId);
            if (safeCantidad > 0) {
                if (existing) {
                    return prev.map(i => i.productoId === productoId ? {
                        ...i,
                        cantidadDevuelta: safeCantidad
                    } : i);
                }
                const motivoSeleccion = getMotivoDefault();
                const motivo = motivoSeleccion === 'Otro' ? '' : motivoSeleccion;
                return [...prev, { productoId, cantidadDevuelta: safeCantidad, motivo, motivoSeleccion }];
            }
            return prev.filter(i => i.productoId !== productoId);
        });
    };

    const handleMotivoSelect = (productoId: number, motivoSeleccion: string) => {
        setDevolucionItems(prev => {
            const existing = prev.find(i => i.productoId === productoId);
            if (!existing) {
                // Si no existe el item aún (cantidad 0), no crear entrada
                return prev;
            }
            const nuevoMotivo = motivoSeleccion === 'Otro'
                ? (existing.motivoSeleccion === 'Otro' ? existing.motivo : '')
                : motivoSeleccion;

            return prev.map(i => i.productoId === productoId ? {
                ...i,
                motivoSeleccion,
                motivo: nuevoMotivo
            } : i);
        });
    };

    const handleMotivoCustomChange = (productoId: number, motivoPersonalizado: string) => {
        setDevolucionItems(prev => prev.map(i => i.productoId === productoId ? {
            ...i,
            motivoSeleccion: 'Otro',
            motivo: motivoPersonalizado
        } : i));
    };

    const handleTotalDevolucionToggle = async (isTotal: boolean) => {
        if (isFormDisabled) return;
        setIsTotalDevolucion(isTotal);
        if (isTotal && selectedFactura) {
            // Función auxiliar para configurar devolución total con items
            const configurarDevolucionTotal = (itemsDisponibles: DocumentItem[]) => {
                const allItems = itemsDisponibles
                    .filter(item => item && item.productoId) // Filtrar items válidos
                    .map(item => {
                        const yaDevueltos = cantidadesYaDevueltas.get(item.productoId) || 0;
                        const cantidadADevolver = Math.max(0, (item.cantidad || 0) - yaDevueltos);
                        const motivoSeleccion = getMotivoDefault();
                        return {
                            productoId: item.productoId,
                            cantidadDevuelta: cantidadADevolver,
                            motivoSeleccion,
                            motivo: motivoSeleccion === 'Otro' ? '' : motivoSeleccion,
                        };
                    })
                    .filter(item => item.cantidadDevuelta > 0);

                if (allItems.length === 0) {
                    addNotification({
                        message: 'No hay cantidades disponibles para devolver en esta factura. Puede que todos los items ya hayan sido devueltos.',
                        type: 'warning'
                    });
                    setIsTotalDevolucion(false);
                    return;
                }

                setDevolucionItems(allItems);
                addNotification({
                    message: `Devolución total configurada: ${allItems.length} producto(s) para devolver.`,
                    type: 'success'
                });
            };

            // Verificar que la factura tenga items cargados
            // Si ya hay items disponibles (de selectedFactura o facturaItemsCargados), usarlos
            if (itemsDisponiblesFactura.length > 0) {
                // Configurar la devolución total con los items disponibles
                configurarDevolucionTotal(itemsDisponiblesFactura);
                return;
            }

            // Si no hay items disponibles, intentar cargarlos desde el backend
            console.log('[Devoluciones] La factura seleccionada no tiene items cargados. Intentando cargar desde el backend...', {
                facturaId: selectedFactura.id,
                numeroFactura: selectedFactura.numeroFactura
            });

            // Intentar cargar los items desde el backend
            try {
                addNotification({
                    message: 'Cargando productos de la factura...',
                    type: 'info'
                });

                // Pasar directamente el facturaId como string o number, no como objeto
                const detallesResponse = await fetchFacturasDetalle(selectedFactura.id);
                if (detallesResponse.success && detallesResponse.data) {
                    // El backend ya filtra por facturaId, así que usamos directamente los datos
                    const itemsFactura = Array.isArray(detallesResponse.data)
                        ? detallesResponse.data
                        : [];

                    if (itemsFactura.length === 0) {
                        addNotification({
                            message: 'La factura seleccionada no tiene productos asociados. Por favor, seleccione otra factura.',
                            type: 'warning'
                        });
                        setIsTotalDevolucion(false);
                        return;
                    }

                    // Mapear items del backend a la estructura esperada
                    const itemsMapeados = itemsFactura.map((d: any) => ({
                        productoId: d.productoId || null,
                        cantidad: Number(d.cantidad || d.qtyins || 0),
                        precioUnitario: Number(d.precioUnitario || d.valins || 0),
                        descuentoPorcentaje: Number(d.descuentoPorcentaje || d.desins || 0),
                        ivaPorcentaje: Number(d.ivaPorcentaje || 0),
                        descripcion: d.descripcion || d.observa || '',
                        subtotal: Number(d.subtotal || 0),
                        valorIva: Number(d.valorIva || d.ivains || 0),
                        total: Number(d.total || 0),
                        codProducto: d.codProducto || d.codins || ''
                    })).filter(item => item.productoId != null);

                    if (itemsMapeados.length === 0) {
                        addNotification({
                            message: 'La factura no tiene productos válidos asociados.',
                            type: 'warning'
                        });
                        setIsTotalDevolucion(false);
                        return;
                    }

                    // Guardar items en estado local para que selectedFactura los use
                    setFacturaItemsCargados(itemsMapeados);

                    // Configurar la devolución total directamente con los items cargados
                    // No usar setTimeout, configurar inmediatamente con los items cargados
                    configurarDevolucionTotal(itemsMapeados);
                    return;
                } else {
                    throw new Error('No se pudieron cargar los items de la factura');
                }
            } catch (error) {
                console.error('[Devoluciones] Error cargando items de la factura:', error);
                addNotification({
                    message: 'Error al cargar los productos de la factura. Por favor, recargue la página o seleccione otra factura.',
                    type: 'warning'
                });
                setIsTotalDevolucion(false);
                return;
            }
        } else {
            setDevolucionItems([]);
        }
    };

    const resetForm = useCallback(() => {

        setClienteId('');
        setFacturaId('');
        resetFormPartially();
    }, []);

    const summary = useMemo(() => {
        if (devolucionItems.length === 0 || itemsDisponiblesFactura.length === 0) {
            return { subtotalBruto: 0, iva: 0, total: 0, descuento: 0 };
        }
        let subBruto = 0, totalIva = 0, disc = 0;

        devolucionItems.forEach(devItem => {
            const factItem = itemsDisponiblesFactura.find(i => i.productoId === devItem.productoId);
            if (factItem) {
                const itemSubtotalBruto = factItem.precioUnitario * devItem.cantidadDevuelta;
                const itemDescuento = itemSubtotalBruto * (factItem.descuentoPorcentaje / 100);
                const subNetoItem = itemSubtotalBruto - itemDescuento;

                subBruto += itemSubtotalBruto;
                disc += itemDescuento;

                // Correct calculation: Sum tax per item
                if (factItem.ivaPorcentaje > 0) {
                    totalIva += subNetoItem * (factItem.ivaPorcentaje / 100);
                }
            }
        });

        const finalTotal = (subBruto - disc) + totalIva;

        return { subtotalBruto: subBruto, iva: totalIva, total: finalTotal, descuento: disc };
    }, [devolucionItems, itemsDisponiblesFactura]);

    const costoTotalDevolucion = useMemo(() => {
        if (devolucionItems.length === 0) return 0;
        return devolucionItems.reduce((total, devItem) => {
            const product = productos.find(p => p.id === devItem.productoId);
            const cost = product?.ultimoCosto || 0;
            return total + (cost * devItem.cantidadDevuelta);
        }, 0);
    }, [devolucionItems, productos]);

    const executeSave = async () => {
        if (!draftNotaToPreview || !selectedFactura || !selectedCliente) return;

        setIsConfirmingSave(true);

        try {
            console.log('[Devoluciones] Confirmando guardado de nota de crédito desde preview:', {
                numeroDraft: draftNotaToPreview.numero,
                total: draftNotaToPreview.total
            });

            const itemsParaNota = devolucionItems.map(devItem => {
                const factItem = itemsDisponiblesFactura.find(i => i.productoId === devItem.productoId);
                if (!factItem) throw new Error(`Item de factura no encontrado para producto ${devItem.productoId}`);

                // Recalculate item values for consistency
                const itemSubtotalBruto = factItem.precioUnitario * devItem.cantidadDevuelta;
                const itemDescuento = itemSubtotalBruto * (factItem.descuentoPorcentaje / 100);
                const subtotal = itemSubtotalBruto - itemDescuento;
                const valorIva = subtotal * (factItem.ivaPorcentaje / 100);

                return {
                    ...factItem,
                    cantidad: devItem.cantidadDevuelta,
                    motivo: devItem.motivo,
                    motivoSeleccion: devItem.motivoSeleccion,
                    subtotal,
                    valorIva,
                    total: subtotal + valorIva
                };
            });

            const motivoPrincipal = devolucionItems.length > 0
                ? (devolucionItems[0].motivo && devolucionItems[0].motivo.trim().length > 0
                    ? devolucionItems[0].motivo
                    : devolucionItems[0].motivoSeleccion || 'Devolución general')
                : 'Devolución general';

            const nuevaNota = await crearNotaCredito(selectedFactura, itemsParaNota, motivoPrincipal, tipoNota);

            if (!nuevaNota) {
                throw new Error('No se recibió respuesta del servidor al crear la nota de crédito');
            }

            setSavedNota(nuevaNota);
            addNotification({
                message: `Nota de Crédito ${nuevaNota.numero || nuevaNota.id} guardada con éxito.`,
                type: 'success'
            });

            // Close modal
            setDraftNotaToPreview(null);
            setIsConfirmingSave(false);

            // Limpiar formulario y posterior lógica
            resetFormPartially();
            setFacturaId('');

            // Generate accounting note logic...
            setAccountingNote({ loading: true, text: '', error: false });
            const motivos = [...new Set(devolucionItems.map(i => i.motivo))].join(', ');
            const subtotalNeto = summary.subtotalBruto - summary.descuento;
            try {
                const note = await generateAccountingNote(
                    formatCurrency(summary.total),
                    formatCurrency(subtotalNeto),
                    formatCurrency(summary.iva),
                    formatCurrency(costoTotalDevolucion),
                    motivos
                );
                setAccountingNote({ loading: false, text: note, error: false });
            } catch (iaError) {
                console.error('Error generando la nota con Gemini:', iaError);
                // ... error handling
                setAccountingNote({ loading: false, text: 'Error generando nota automática.', error: true });
            }

        } catch (error) {
            console.error('[Devoluciones] Error al guardar nota de crédito:', error);
            setIsConfirmingSave(false);
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido al guardar';
            addNotification({
                message: `Error al guardar: ${errorMessage}`,
                type: 'warning'
            });
        }
    };

    const handleSave = async () => {
        // Validaciones iniciales
        if (!selectedFactura) {
            addNotification({ message: 'Seleccione una factura.', type: 'warning' }); return;
        }
        if (!selectedCliente) {
            addNotification({ message: 'Seleccione un cliente.', type: 'warning' }); return;
        }
        if (itemsDisponiblesFactura.length === 0) {
            addNotification({ message: 'Factura sin productos.', type: 'warning' }); return;
        }
        if (devolucionItems.length === 0) {
            addNotification({ message: 'Seleccione al menos un producto.', type: 'warning' }); return;
        }
        if (isFormDisabled) return;

        const motivosPendientes = devolucionItems.filter(item => {
            if (item.motivoSeleccion === 'Otro') return !item.motivo || item.motivo.trim().length === 0;
            return !item.motivo || item.motivo.trim().length === 0;
        });

        if (motivosPendientes.length > 0) {
            addNotification({ message: 'Especifique el motivo de cada item.', type: 'warning' }); return;
        }

        // Prepare Draft for Preview
        try {
            const itemsParaDraft: DocumentItem[] = devolucionItems.map(devItem => {
                const factItem = itemsDisponiblesFactura.find(i => i.productoId === devItem.productoId);
                if (!factItem) throw new Error('Item no encontrado');

                const itemSubtotalBruto = factItem.precioUnitario * devItem.cantidadDevuelta;
                const itemDescuento = itemSubtotalBruto * (factItem.descuentoPorcentaje / 100);
                const subtotal = itemSubtotalBruto - itemDescuento;
                const valorIva = subtotal * (factItem.ivaPorcentaje / 100);

                return {
                    id: factItem.id, // ID from factura detail
                    productoId: factItem.productoId,
                    producto: {
                        id: factItem.productoId,
                        nombre: factItem.descripcion,
                        referencia: productos.find(p => p.id === factItem.productoId)?.referencia || '',
                        // Add other required Produto props if necessary, mostly used for display
                    } as any,
                    descripcion: factItem.descripcion,
                    cantidad: devItem.cantidadDevuelta,
                    precioUnitario: factItem.precioUnitario,
                    descuentoPorcentaje: factItem.descuentoPorcentaje,
                    ivaPorcentaje: factItem.ivaPorcentaje,
                    subtotal: subtotal, // This is explicitly the net subtotal in DocumentItem type? usually yes
                    total: subtotal + valorIva,
                    // Extra props for calculation display in PDF
                    valorIva: valorIva
                };
            });

            const draftNota: NotaCredito = {
                id: 'draft',
                numero: nextNoteNumber || 'BORRADOR', // Will function as preview title
                clienteId: selectedCliente.id,
                facturaId: selectedFactura.id,
                fechaEmision: new Date().toISOString(),
                subtotal: summary.subtotalBruto - summary.descuento,
                iva: summary.iva,
                total: summary.total,
                estadoDian: 'Borrador',
                itemsDevueltos: itemsParaDraft,
                motivo: devolucionItems[0]?.motivo || 'Devolución',
                // Add any other required props
            } as any;

            setDraftNotaToPreview(draftNota);

        } catch (e) {
            console.error('Error creating draft:', e);
            addNotification({ message: 'Error al generar vista previa.', type: 'warning' });
        }
    };

    const handleGenerateEmail = async () => {
        if (!savedNota || !selectedCliente || !selectedFactura) return;
        setGeminiEmail({ ...geminiEmail, loading: true, modalOpen: true });
        try {
            const emailText = await generateEmailForReturn(selectedCliente.nombreCompleto || '', selectedFactura.numeroFactura, savedNota.numero, formatCurrency(savedNota.total));
            setGeminiEmail({ ...geminiEmail, loading: false, text: emailText, modalOpen: true });
        } catch (error) {
            setGeminiEmail({ loading: false, text: "Error al generar el correo.", modalOpen: true });
        }
    };

    const handleSendEmail = (nota: NotaCredito) => {
        setNotaToEmail(nota);
    };

    const handleConfirmSendEmail = async (emailData: { to: string; subject: string; body: string }) => {
        if (!notaToEmail) return;
        addNotification({ message: 'Preparando envío de correo...', type: 'info' });

        try {
            // Recuperar datos completos para el PDF (cliente, factura)
            const clienteNota = clientes.find(c => String(c.id) === String(notaToEmail.clienteId) || c.numeroDocumento === notaToEmail.clienteId);
            const facturaNota = facturas.find(f => String(f.id) === String(notaToEmail.facturaId));

            if (!clienteNota) {
                addNotification({ message: 'Error: No se encontró cliente asociado.', type: 'warning' });
                return;
            }

            // Generar PDF Blob usando el componente existente
            const blob = await pdf(
                <NotaCreditoPDFDocument
                    notaCredito={notaToEmail}
                    factura={facturaNota || { numeroFactura: 'N/A' } as any}
                    cliente={clienteNota}
                    empresa={{
                        nombre: datosEmpresa.nombre || 'Mi Empresa',
                        nit: datosEmpresa.nit || '',
                        direccion: datosEmpresa.direccion || ''
                    }}
                    productos={productos}
                />
            ).toBlob();

            // Convertir a Base64
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;

                const response = await apiClient.sendNotaCreditoEmail(notaToEmail.id, {
                    destinatario: emailData.to,
                    asunto: emailData.subject,
                    mensaje: emailData.body,
                    pdfBase64: base64data
                });

                if (response.success) {
                    addNotification({ message: '✅ Correo enviado exitosamente.', type: 'success' });
                    setNotaToEmail(null);
                } else {
                    addNotification({ message: `❌ Error enviando correo: ${response.message || 'Error desconocido'}`, type: 'error' });
                }
            };

        } catch (error) {
            console.error('Error email nota credito:', error);
            addNotification({ message: 'Error al enviar el correo.', type: 'error' });
        }
    };

    const handleOpenDetailModal = (nota: NotaCredito) => {
        setSelectedNotaParaVer(nota);
        setIsDetailModalOpen(true);
    };

    const handleOpenPrintModal = (nota: NotaCredito) => {
        setNotaParaImprimir(nota);
    };



    // ✅ Protección: Asegurar que notasCredito sea siempre un array
    const safeNotasCredito = Array.isArray(notasCredito) ? notasCredito : [];
    const { paginatedData, requestSort, sortConfig } = useTable<NotaCredito>({
        data: safeNotasCredito,
        searchKeys: [
            'numero',
            'motivo',
            'estadoDian',
            item => clientes.find(c => c.id === item.clienteId)?.nombreCompleto || ''
        ]
    });
    const historyColumns: Column<NotaCredito>[] = [
        { header: 'Devolución No.', accessor: 'numero', cell: item => <button onClick={() => handleOpenDetailModal(item)} className="text-blue-500 font-semibold hover:underline">{item.numero}</button> },
        { header: 'Fecha', accessor: 'fechaEmision', cell: item => new Date(item.fechaEmision).toLocaleDateString() },
        { header: 'Factura Afectada', accessor: 'facturaId', cell: item => facturas.find(f => String(f.id) === String(item.facturaId))?.numeroFactura || 'N/A' },
        {
            header: 'Cliente',
            accessor: 'clienteId',
            cell: item => {
                const match = clientes.find(c => String(c.id) === String(item.clienteId) || c.numeroDocumento === item.clienteId || c.codter === item.clienteId);
                if (!match && process.env.NODE_ENV === 'development') console.log('Client match failed for:', item.clienteId, 'Available clients:', clientes.length);
                return match?.nombreCompleto || 'N/A';
            }
        },
        { header: 'Valor Total', accessor: 'total', cell: item => formatCurrency(item.total) },
        { header: 'Estado DIAN', accessor: 'estadoDian', cell: item => (String(item.estadoDian) === '1' || String(item.estadoDian) === 'Transmitido' || (item.cufe && String(item.cufe).length > 10)) ? <StatusBadge status={'APROBADA'} /> : <StatusBadge status={'RECHAZADA'} /> },
        {
            header: 'Acciones', accessor: 'id', cell: (item) => (
                <div className="flex items-center space-x-3 text-slate-500 dark:text-slate-400 text-lg">
                    <button onClick={() => handleOpenPrintModal(item)} className="hover:text-blue-500" title="Imprimir"><i className="fas fa-print"></i></button>
                    <button onClick={() => handleOpenDetailModal(item)} className="hover:text-blue-500" title="Ver"><i className="fas fa-eye"></i></button>
                    <button onClick={() => handleSendEmail(item)} className="hover:text-blue-500" title="Enviar Email"><i className="fas fa-paper-plane"></i></button>
                    <button onClick={() => handleOpenPrintModal(item)} className="hover:text-blue-500" title="Descargar"><i className="fas fa-download"></i></button>
                </div>
            )
        }
    ];


    return (
        <div className="animate-fade-in space-y-2">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                        Módulo de Devoluciones
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Gestione el registro y seguimiento de sus notas de crédito.
                    </p>
                </div>
            </header>

            <div className="mb-6 border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-2" aria-label="Tabs">
                    <button onClick={() => setActiveTab('form')} className={`whitespace-nowrap py-3 px-4 border-b-2 font-semibold text-sm rounded-t-lg ${activeTab === 'form' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:border-slate-300'}`}>
                        Registrar Devolución
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`whitespace-nowrap py-3 px-4 border-b-2 font-semibold text-sm rounded-t-lg ${activeTab === 'history' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:border-slate-300'}`}>
                        Historial de Devoluciones
                    </button>
                </nav>
            </div>

            {activeTab === 'form' && (
                <Card>
                    <CardContent>
                        <section>
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">1. Selección de Factura</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                <div>
                                    <label htmlFor="cliente-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cliente</label>
                                    <select
                                        id="cliente-select"
                                        value={clienteId || ''}
                                        onChange={e => {
                                            const selectedValue = e.target.value;
                                            handleClienteChange(selectedValue);
                                        }}
                                        disabled={isFormDisabled || isLoadingClientes}
                                        className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                                    >
                                        <option value="">
                                            {isLoadingClientes ? 'Cargando clientes...' : 'Seleccione un cliente...'}
                                        </option>
                                        {clientesDisponibles && clientesDisponibles.length > 0 ? (
                                            clientesDisponibles.map(c => {
                                                const clienteValue = String(c.id || '');
                                                return (
                                                    <option key={c.id} value={clienteValue}>
                                                        {c.nombreCompleto || c.numeroDocumento}
                                                    </option>
                                                );
                                            })
                                        ) : (
                                            !isLoadingClientes && <option value="" disabled>No hay clientes con facturas ACEPTADAS</option>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="factura-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Factura</label>
                                    <select id="factura-select" value={facturaId} onChange={e => handleFacturaChange(e.target.value)} disabled={!clienteId || isFormDisabled} className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed">
                                        <option value="">Seleccione una factura...</option>
                                        {facturasFiltradas && facturasFiltradas.length > 0 ? (
                                            facturasFiltradas.map(f => <option key={f.id} value={f.id}>{f.numeroFactura} - {new Date(f.fechaFactura).toLocaleDateString()}</option>)
                                        ) : clienteId ? (
                                            <option value="" disabled>No hay facturas disponibles para este cliente</option>
                                        ) : (
                                            <option value="" disabled>Seleccione un cliente primero</option>
                                        )}
                                    </select>
                                </div>
                            </div>

                            {/* Toggle para Tipo de Nota (Devolución vs Anulación) */}
                            <div className="mt-6 flex items-center space-x-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Operación</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">Seleccione si es una devolución parcial o anulación total</span>
                                </div>

                                <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                                    <button
                                        onClick={() => setTipoNota('DEVOLUCION')}
                                        disabled={isFormDisabled}
                                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${tipoNota === 'DEVOLUCION'
                                            ? 'bg-blue-500 text-white shadow-sm'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                    >
                                        Devolución
                                    </button>
                                    <button
                                        onClick={() => {
                                            setTipoNota('ANULACION');
                                            // Si es anulación, activar devolución total automáticamente
                                            if (!isTotalDevolucion) {
                                                handleTotalDevolucionToggle(true);
                                            }
                                        }}
                                        disabled={isFormDisabled}
                                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${tipoNota === 'ANULACION'
                                            ? 'bg-red-500 text-white shadow-sm'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                    >
                                        Anulación
                                    </button>
                                </div>

                                <div className="flex-1 border-l border-slate-200 dark:border-slate-700 pl-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Devolución Total</span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">Marcar todos los items para devolver</span>
                                        </div>
                                        <ToggleSwitch
                                            id="devolucion-total-toggle"
                                            checked={isTotalDevolucion}
                                            onChange={handleTotalDevolucionToggle}
                                            labelLeft="Parcial"
                                            labelRight="Total"
                                            disabled={!selectedFactura || isFormDisabled || tipoNota === 'ANULACION'} // Deshabilitar si es anulación (siempre es total)
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Mensaje informativo cuando faltan opciones obligatorias */}
                        {(!clienteId || !facturaId || !selectedFactura) && (
                            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <i className="fas fa-info-circle text-blue-600 dark:text-blue-400 mt-0.5"></i>
                                    <div>
                                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">Complete las opciones obligatorias para continuar</p>
                                        <p className="text-xs text-blue-600 dark:text-blue-400">
                                            {!clienteId && <span className="inline-block mr-2">• Seleccione un cliente</span>}
                                            {!facturaId && <span className="inline-block mr-2">• Seleccione una factura</span>}
                                            {facturaId && !selectedFactura && <span className="inline-block mr-2">• La factura seleccionada no se encontró</span>}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Mostrar la lógica de devolución cuando Cliente y Factura estén completas (Almacén es opcional) */}
                        {clienteId && facturaId && selectedFactura && (
                            <>
                                <section className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">2. Detalles y Cantidades a Devolver</h2>

                                    <div className="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                            {/* Cliente Info */}
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cliente</p>
                                                <p className="font-bold text-slate-800 dark:text-slate-100 truncate" title={selectedCliente?.nombreCompleto}>
                                                    {selectedCliente?.nombreCompleto}
                                                </p>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                                                    NIT: {selectedCliente?.numeroDocumento}
                                                </p>
                                            </div>

                                            {/* Factura Info */}
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Factura</p>
                                                <p className="font-bold text-blue-600 dark:text-blue-400 text-lg">
                                                    {selectedFactura.numeroFactura}
                                                </p>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    {new Date(selectedFactura.fechaFactura).toLocaleDateString()}
                                                </p>
                                            </div>

                                            {/* Valores */}
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Valor Total</p>
                                                <p className="font-bold text-slate-800 dark:text-slate-100 text-lg">
                                                    {formatCurrency(selectedFactura.total)}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-500">Saldo:</span>
                                                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                                        {formatCurrency(selectedFactura.total)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Configuración DIAN */}
                                            <div className="flex flex-col justify-center">
                                                <label htmlFor="transmision-dian" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                                                    Transmisión DIAN
                                                </label>
                                                <ToggleSwitch
                                                    id="transmision-dian"
                                                    checked={transmisionDian}
                                                    onChange={setTransmisionDian}
                                                    disabled={isFormDisabled}
                                                    labelLeft="Sin Ref."
                                                    labelRight="Con Ref."
                                                    size="compact"
                                                    width="equal"
                                                    className="w-full"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <div className="lg:col-span-3">
                                            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                                                    <thead className="bg-slate-100 dark:bg-slate-800">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left font-semibold w-2/5">Producto</th>
                                                            <th className="px-4 py-2 text-right font-semibold">Cant. Fact.</th>
                                                            <th className="px-4 py-2 text-right font-semibold">Ya Dev.</th>
                                                            <th className="px-4 py-2 text-right font-semibold">Pendiente</th>
                                                            <th className="px-4 py-2 text-center font-semibold">Cant. a Devolver</th>
                                                            <th className="px-4 py-2 text-left font-semibold">Motivo</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700">
                                                        {(() => {
                                                            if (process.env.NODE_ENV === 'development') {
                                                                console.log('[Devoluciones] Renderizando items:', {
                                                                    count: itemsDisponiblesFactura.length,
                                                                    items: itemsDisponiblesFactura
                                                                });
                                                            }
                                                            return null;
                                                        })()}
                                                        {itemsDisponiblesFactura.map(item => {
                                                            const devItem = devolucionItems.find(d => d.productoId === item.productoId);
                                                            const product = productos.find(p => p.id === item.productoId);
                                                            const yaDevueltos = cantidadesYaDevueltas.get(item.productoId) || 0;
                                                            const cantidadPendiente = item.cantidad - yaDevueltos;
                                                            return (
                                                                <tr key={item.productoId}>
                                                                    <td className="px-4 py-3 align-top">
                                                                        <p className="font-semibold text-slate-800 dark:text-slate-200">{item.descripcion}</p>
                                                                        <p className="text-xs text-slate-500 dark:text-slate-400">Cód: {product?.referencia || 'N/A'}</p>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right align-top">{item.cantidad.toFixed(2)}</td>
                                                                    <td className="px-4 py-3 text-right align-top text-orange-600">{yaDevueltos.toFixed(2)}</td>
                                                                    <td className="px-4 py-3 text-right align-top font-bold">{cantidadPendiente.toFixed(2)}</td>
                                                                    <td className="px-4 py-3 text-center align-top">
                                                                        <input
                                                                            type="number"
                                                                            value={devItem?.cantidadDevuelta ?? ''}
                                                                            onChange={e => handleCantidadChange(item.productoId, parseFloat(e.target.value) || 0)}
                                                                            max={cantidadPendiente}
                                                                            min="0"
                                                                            step="any"
                                                                            className="w-24 px-2 py-1 text-right text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                                                                            disabled={isTotalDevolucion || cantidadPendiente <= 0 || isFormDisabled}
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 py-3 align-top">
                                                                        <select
                                                                            value={devItem?.motivoSeleccion || devItem?.motivo || getMotivoDefault()}
                                                                            onChange={e => handleMotivoSelect(item.productoId, e.target.value)}
                                                                            className="w-full px-2 py-1 text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                                                                            disabled={isTotalDevolucion || !devItem || devItem.cantidadDevuelta === 0 || isFormDisabled}
                                                                        >
                                                                            {motivosDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
                                                                        </select>
                                                                        {devItem && (devItem.motivoSeleccion === 'Otro') && (
                                                                            <input
                                                                                type="text"
                                                                                value={devItem.motivo || ''}
                                                                                onChange={e => handleMotivoCustomChange(item.productoId, e.target.value)}
                                                                                placeholder="Describa el motivo"
                                                                                className="mt-2 w-full px-2 py-1 text-sm bg-white dark:bg-slate-900/70 border border-dashed border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                                disabled={isFormDisabled}
                                                                            />
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    {devolucionItems.length > 0 && (
                                        <div className="mt-6">
                                            <div className="border-b border-slate-200 dark:border-slate-700">
                                                <nav className="-mb-px flex space-x-2" aria-label="Tabs">
                                                    <button onClick={() => setActiveSubTab('contable')} className={`whitespace-nowrap py-2 px-3 border-b-2 font-semibold text-sm rounded-t-md ${activeSubTab === 'contable' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:border-slate-300'}`}>
                                                        Registro Contable
                                                    </button>
                                                    <button onClick={() => setActiveSubTab('kardex')} className={`whitespace-nowrap py-2 px-3 border-b-2 font-semibold text-sm rounded-t-md ${activeSubTab === 'kardex' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:border-slate-300'}`}>
                                                        Movimiento Kardex
                                                    </button>
                                                </nav>
                                            </div>

                                            <div className="pt-6">
                                                {activeSubTab === 'contable' && (
                                                    <div>
                                                        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">Comprobante Contable de Nota de Crédito</h3>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Modo de transmisión a la DIAN: <span className="font-semibold text-blue-600 dark:text-blue-400">{transmisionDian ? 'Con Referencias' : 'Sin Referencias'}</span></p>
                                                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                                                                <thead className="bg-slate-50 dark:bg-slate-900/40">
                                                                    <tr>
                                                                        <th className="px-4 py-2 text-left font-semibold">CÓDIGO PUC</th>
                                                                        <th className="px-4 py-2 text-left font-semibold">DESCRIPCIÓN</th>
                                                                        <th className="px-4 py-2 text-center font-semibold">TERCERO</th>
                                                                        <th className="px-4 py-2 text-center font-semibold">C. COSTO</th>
                                                                        <th className="px-4 py-2 text-right font-semibold">DÉBITO</th>
                                                                        <th className="px-4 py-2 text-right font-semibold">CRÉDITO</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700">
                                                                    {[
                                                                        { puc: '417505', desc: 'Devoluciones en ventas', deb: summary.subtotalBruto - summary.descuento, cred: 0 },
                                                                        { puc: '240801', desc: 'IVA por pagar (generado)', deb: summary.iva, cred: 0 },
                                                                        { puc: '130505', desc: 'Clientes Nacionales', deb: 0, cred: summary.total },
                                                                        { puc: '143501', desc: 'Mercancías no fabricadas', deb: costoTotalDevolucion, cred: 0 },
                                                                        { puc: '613501', desc: 'Costo de ventas', deb: 0, cred: costoTotalDevolucion },
                                                                    ].map(row => (
                                                                        <tr key={row.puc}>
                                                                            <td className="px-4 py-2 text-left">{row.puc}</td>
                                                                            <td className="px-4 py-2 text-left">{row.desc}</td>
                                                                            <td className="px-4 py-2 text-center">{selectedCliente?.numeroDocumento}</td>
                                                                            <td className="px-4 py-2 text-center">{selectedFactura?.codalm || '001'}</td>
                                                                            <td className="px-4 py-2 text-right">{formatCurrency(row.deb)}</td>
                                                                            <td className="px-4 py-2 text-right">{formatCurrency(row.cred)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                                <tfoot className="bg-slate-50 dark:bg-slate-700/50 font-bold">
                                                                    <tr>
                                                                        <td colSpan={4} className="px-4 py-2 text-right">Sumas Iguales:</td>
                                                                        <td className="px-4 py-2 text-right">{formatCurrency(summary.subtotalBruto - summary.descuento + summary.iva + costoTotalDevolucion)}</td>
                                                                        <td className="px-4 py-2 text-right">{formatCurrency(summary.total + costoTotalDevolucion)}</td>
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                        <div className="mt-4">
                                                            <h4 className="font-semibold text-sm">Nota Explicativa ✨</h4>
                                                            <div className="p-3 mt-1 min-h-[60px] bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 text-sm italic">
                                                                {accountingNote.loading ? (
                                                                    <div className="flex items-center gap-2 text-slate-500"><div className="w-4 h-4 border-2 border-t-sky-400 border-slate-200 dark:border-slate-700 rounded-full animate-spin"></div>Generando nota...</div>
                                                                ) : accountingNote.error ? (
                                                                    <p className="text-red-500">{accountingNote.text}</p>
                                                                ) : (
                                                                    <p className="text-slate-600 dark:text-slate-300">{accountingNote.text || 'La nota generada por IA aparecerá aquí después de guardar.'}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {activeSubTab === 'kardex' && (
                                                    <div>
                                                        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">Movimiento de Inventario (Entrada por Devolución)</h3>
                                                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                                                                <thead className="bg-slate-100 dark:bg-slate-800">
                                                                    <tr>
                                                                        {['CÓDIGO', 'PRODUCTO', 'CANTIDAD', 'TIPO MOVIMIENTO', 'COSTO UNITARIO', 'COSTO TOTAL'].map(header => (
                                                                            <th key={header} className="px-4 py-2 text-left font-semibold">{header}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700">
                                                                    {devolucionItems.map(item => {
                                                                        const product = productos.find(p => p.id === item.productoId)!;
                                                                        const costoUnitario = product.ultimoCosto || 0;
                                                                        const costoTotal = costoUnitario * item.cantidadDevuelta;
                                                                        return (
                                                                            <tr key={item.productoId}>
                                                                                <td className="px-4 py-2">{product.referencia}</td>
                                                                                <td className="px-4 py-2">{product.nombre}</td>
                                                                                <td className="px-4 py-2">{item.cantidadDevuelta.toFixed(2)}</td>
                                                                                <td className="px-4 py-2"><StatusBadge status={"Entrada"} /></td>
                                                                                <td className="px-4 py-2 text-right">{formatCurrency(costoUnitario)}</td>
                                                                                <td className="px-4 py-2 text-right">{formatCurrency(costoTotal)}</td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                                <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold">
                                                                    <tr>
                                                                        <td colSpan={5} className="px-4 py-2 text-right">Valor Total del Movimiento:</td>
                                                                        <td className="px-4 py-2 text-right">{formatCurrency(costoTotalDevolucion)}</td>
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-8 flex items-center justify-end space-x-4">
                                        <ProtectedComponent permission='devoluciones:manage'>
                                            <button onClick={handleGenerateEmail} disabled={!savedNota} className="px-4 py-2 border border-sky-500 rounded-lg text-sm font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 disabled:opacity-50 disabled:cursor-not-allowed">✨ Redactar Correo</button>
                                        </ProtectedComponent>
                                        <button disabled={!savedNota} onClick={() => handleOpenPrintModal(savedNota!)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"><i className="fas fa-print mr-2"></i>Imprimir</button>
                                        <button onClick={resetForm} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Limpiar</button>
                                        <ProtectedComponent permission='devoluciones:create'>
                                            <button onClick={handleSave} disabled={devolucionItems.length === 0 || isFormDisabled} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-slate-400 dark:disabled:bg-slate-500 disabled:cursor-not-allowed">
                                                {isSaving ? <><i className="fas fa-spinner fa-spin mr-2"></i>Guardando...</> : <><i className="fas fa-save mr-2"></i>Guardar</>}
                                            </button>
                                        </ProtectedComponent>
                                    </div>
                                </section>
                            </>
                        )}
                    </CardContent>
                </Card>
            )
            }

            {
                activeTab === 'history' && (
                    <Card>
                        <CardHeader><CardTitle>Historial de Devoluciones</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <Table columns={historyColumns} data={paginatedData} onSort={requestSort} sortConfig={sortConfig} />
                        </CardContent>
                    </Card>
                )
            }

            <Modal isOpen={geminiEmail.modalOpen} onClose={() => setGeminiEmail({ ...geminiEmail, modalOpen: false })} title="✨ Correo Sugerido por IA">
                {geminiEmail.loading ? (
                    <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-t-sky-400 border-slate-200 dark:border-slate-700 rounded-full animate-spin"></div></div>
                ) : (
                    <div>
                        <textarea value={geminiEmail.text} readOnly rows={10} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 dark:text-slate-200"></textarea>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end space-x-3 rounded-b-lg -m-6 mt-4">
                            <button onClick={() => navigator.clipboard.writeText(geminiEmail.text).then(() => addNotification({ message: 'Copiado al portapapeles', type: 'info' }))} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Copiar Texto</button>
                            <button onClick={() => setGeminiEmail({ ...geminiEmail, modalOpen: false })} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Cerrar</button>
                        </div>
                    </div>
                )}
            </Modal>

            {notaToEmail && (
                <SendEmailModal
                    isOpen={true}
                    onClose={() => setNotaToEmail(null)}
                    onSend={handleConfirmSendEmail}
                    to={notaToEmail.clienteId ? (clientes.find(c => String(c.id) === String(notaToEmail.clienteId) || c.codter === notaToEmail.clienteId)?.email || '') : ''}
                    subject={`Nota de Crédito - ${notaToEmail.numero} - ${datosEmpresa?.nombre || ''}`}
                    body={`Cordial saludo,\n\nAdjuntamos la nota de crédito número ${notaToEmail.numero}.\n\nAtentamente,\n${datosEmpresa?.nombre || ''}`}
                />
            )}


            {
                selectedNotaParaVer && (() => {
                    const clienteNota = clientes.find(c => c.id === selectedNotaParaVer.clienteId);
                    const facturaNota = facturas.find(f => f.id === selectedNotaParaVer.facturaId);
                    return (
                        <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`Detalle Nota de Crédito: ${selectedNotaParaVer.numero}`} size="3xl">
                            <div className="space-y-4 text-sm">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                    <div><p className="font-semibold text-slate-600 dark:text-slate-400">Cliente:</p><p>{
                                        clientes.find(c => String(c.id) === String(selectedNotaParaVer.clienteId) || c.numeroDocumento === selectedNotaParaVer.clienteId || c.codter === selectedNotaParaVer.clienteId)?.nombreCompleto || 'N/A'
                                    }</p></div>
                                    <div><p className="font-semibold text-slate-600 dark:text-slate-400">Factura Afectada:</p><p>{
                                        facturas.find(f => String(f.id) === String(selectedNotaParaVer.facturaId))?.numeroFactura || 'N/A'
                                    }</p></div>
                                    <div><p className="font-semibold text-slate-600 dark:text-slate-400">Fecha Emisión:</p><p>{new Date(selectedNotaParaVer.fechaEmision).toLocaleDateString()}</p></div>
                                    <div><p className="font-semibold text-slate-600 dark:text-slate-400">Estado DIAN:</p>
                                        {(String(selectedNotaParaVer.estadoDian) === '1' || String(selectedNotaParaVer.estadoDian) === 'Transmitido') ?
                                            <span className="text-green-600 font-bold">Aprobado</span> :
                                            <span className="text-red-600 font-bold">Rechazado</span>
                                        }
                                    </div>
                                    <div><p className="font-semibold text-slate-600 dark:text-slate-400">Total Nota Crédito:</p><p className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(selectedNotaParaVer.total)}</p></div>
                                    <div className="col-span-1 sm:col-span-2"><p className="font-semibold text-slate-600 dark:text-slate-400">Motivo:</p><p>{selectedNotaParaVer.motivo}</p></div>
                                </div>
                                <h4 className="text-base font-semibold pt-4 border-t border-slate-200 dark:border-slate-700">Items Devueltos</h4>
                                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                    <table className="w-full divide-y divide-slate-200 dark:divide-slate-700">
                                        <thead className="bg-slate-50 dark:bg-slate-700">
                                            <tr className="text-sm font-medium text-slate-500 dark:text-slate-300 uppercase">
                                                <th className="px-4 py-2 text-left">Producto</th>
                                                <th className="px-4 py-2 text-right">Cantidad</th>
                                                <th className="px-4 py-2 text-right">Precio Unit.</th>
                                                <th className="px-4 py-2 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                            {Array.isArray(selectedNotaParaVer.itemsDevueltos) && selectedNotaParaVer.itemsDevueltos.length > 0 ? (
                                                selectedNotaParaVer.itemsDevueltos.map((item: DocumentItem) => (
                                                    <tr key={item.productoId} className="text-sm">
                                                        <td className="px-4 py-2">
                                                            <div>
                                                                <p className="font-medium text-slate-800 dark:text-slate-200">{item.descripcion || 'Producto sin nombre'}</p>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">Cód: {item.codProducto || item.productoId || 'N/A'}</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2 text-right whitespace-nowrap">{item.cantidad || 0}</td>
                                                        <td className="px-4 py-2 text-right whitespace-nowrap">{formatCurrency(item.precioUnitario || 0)}</td>
                                                        <td className="px-4 py-2 font-semibold text-right whitespace-nowrap">{formatCurrency(item.total || 0)}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-4 text-center text-slate-500 dark:text-slate-400">
                                                        No hay items devueltos registrados
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </Modal>
                    );
                })()
            }

            {
                // General Document Preview Modal for Approval Flow
                draftNotaToPreview && selectedFactura && selectedCliente && (() => {
                    return (
                        <DocumentPreviewModal
                            isOpen={true}
                            onClose={() => setDraftNotaToPreview(null)}
                            onEdit={() => setDraftNotaToPreview(null)}
                            onConfirm={executeSave}
                            confirmLabel={isConfirmingSave ? "Guardando..." : "Aprobar y Guardar"}
                            title={`Vista Previa - Nota de Crédito Provicional`}
                            documentType="nota_credito"
                            clientName={selectedCliente.nombreCompleto}
                        >
                            <NotaCreditoPDFDocument
                                notaCredito={draftNotaToPreview}
                                factura={selectedFactura}
                                cliente={selectedCliente as any}
                                empresa={{
                                    nombre: datosEmpresa.nombre || 'Mi Empresa',
                                    nit: datosEmpresa.nit || '',
                                    direccion: datosEmpresa.direccion || ''
                                }}
                                productos={productos}
                            />
                        </DocumentPreviewModal>
                    );
                })()
            }
            {
                notaParaImprimir && (
                    <NotaCreditoPreviewModal notaCredito={notaParaImprimir} onClose={() => setNotaParaImprimir(null)} />
                )
            }
            {
                notaToEmail && (() => {
                    const clienteNota = clientes.find(c => String(c.id) === String(notaToEmail.clienteId) || c.numeroDocumento === notaToEmail.clienteId || c.codter === notaToEmail.clienteId);
                    return (
                        <SendEmailModal
                            isOpen={!!notaToEmail}
                            onClose={() => setNotaToEmail(null)}
                            onSend={handleConfirmSendEmail}
                            to={clienteNota?.email || ''}
                            subject={`Nota de Crédito ${notaToEmail.numero} de ${datosEmpresa.nombre}`}
                            body={`Estimado/a ${clienteNota?.nombreCompleto || 'Cliente'},\n\nAdjuntamos la Nota de Crédito ${notaToEmail.numero}.\n\nAtentamente,\n${datosEmpresa.nombre}`}
                        />
                    );
                })()
            }
        </div >
    );
};

export default DevolucionesPage;