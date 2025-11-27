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
import { useData } from '../hooks/useData';
import { fetchFacturasDetalle } from '../services/apiClient';

const formatCurrency = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2 }).format(value);

interface DevolucionItem {
    productoId: number;
    cantidadDevuelta: number;
    motivo: string; // Texto final que se enviará (puede ser personalizado)
    motivoSeleccion: string; // Valor seleccionado en el combo (incluye "Otro")
}

const DevolucionesPage: React.FC = () => {
    const { 
        almacenes = [], 
        clientes = [], 
        facturas = [], 
        remisiones = [],
        productos = [], 
        motivosDevolucion = [], 
        notasCredito = [], 
        crearNotaCredito 
    } = useData();

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

    // Form State
    const [almacenId, setAlmacenId] = useState('');
    const [clienteId, setClienteId] = useState('');
    const [facturaId, setFacturaId] = useState('');
    const [isTotalDevolucion, setIsTotalDevolucion] = useState(false);
    const [transmisionDian, setTransmisionDian] = useState(false);
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
    
    // Hooks
    const { addNotification } = useNotifications();
    
    const isFormDisabled = !!savedNota || isSaving;
    
    // Memoized derived data
    // Filtrar clientes que tienen facturas timbradas a la DIAN (ya facturadas)
    const clientesConFacturasTimbradas = useMemo(() => {
        // Filtrar facturas que están timbradas (tienen cufe o estado ENVIADA/ACEPTADA)
        const facturasTimbradas = facturas.filter(f => {
            // Excluir facturas anuladas o rechazadas
            if (f.estado === 'ANULADA' || f.estado === 'RECHAZADA') {
                return false;
            }
            
            // Una factura está timbrada si:
            // 1. Tiene CUFE (código único de factura electrónica)
            // 2. Tiene fechaTimbrado
            // 3. O está en estado ENVIADA/ACEPTADA (estados que indican factura aprobada)
            const tieneCufe = !!(f.cufe && String(f.cufe).trim() !== '');
            const tieneFechaTimbrado = !!(f.fechaTimbrado);
            const estaEnviadaOAceptada = f.estado === 'ENVIADA' || f.estado === 'ACEPTADA';
            
            return tieneCufe || tieneFechaTimbrado || estaEnviadaOAceptada;
        });
        
        // Obtener los IDs de clientes únicos de esas facturas timbradas
        const clientesIdsConFacturasTimbradas = new Set<string>();
        
        facturasTimbradas.forEach(factura => {
            // Buscar cliente de forma flexible (por id, numeroDocumento o codter)
            const cliente = clientes.find(c => 
                String(c.id) === String(factura.clienteId) ||
                c.numeroDocumento === factura.clienteId ||
                c.codter === factura.clienteId
            );
            
            if (cliente) {
                clientesIdsConFacturasTimbradas.add(String(cliente.id));
            }
        });
        
        // Filtrar clientes que están en la lista de clientes con facturas timbradas
        return clientes.filter(c => clientesIdsConFacturasTimbradas.has(String(c.id)));
    }, [facturas, clientes]);


    // Filtrar facturas del cliente seleccionado que estén timbradas a la DIAN
    const facturasFiltradas = useMemo(() => {
        // Debug: verificar estado de clienteId
        if (process.env.NODE_ENV === 'development') {
            console.log('[Devoluciones] Estado del filtro:', {
                clienteId,
                tipoClienteId: typeof clienteId,
                clienteIdLength: clienteId ? String(clienteId).length : 0,
                totalFacturas: facturas.length,
                totalClientes: clientes.length
            });
        }
        
        if (!clienteId || clienteId === '' || clienteId === 'undefined' || clienteId === 'null') {
            if (process.env.NODE_ENV === 'development') {
                console.log('[Devoluciones] No hay clienteId seleccionado o está vacío');
            }
            return [];
        }
        
        // Buscar el cliente seleccionado para obtener su ID interno y códigos relacionados
        const clienteSeleccionado = clientes.find(c => 
            String(c.id) === String(clienteId) ||
            c.numeroDocumento === clienteId ||
            c.codter === clienteId
        );
        
        if (!clienteSeleccionado) {
            if (process.env.NODE_ENV === 'development') {
                console.log('[Devoluciones] Cliente seleccionado no encontrado en la lista de clientes');
            }
            return [];
        }
        
        const TOLERANCIA = 0.0001;
        
        // Obtener todos los identificadores posibles del cliente (normalizados)
        const clienteIdsNormalizados = new Set<string>();
        [clienteSeleccionado.id, clienteSeleccionado.numeroDocumento, clienteSeleccionado.codter]
            .filter(id => id != null && id !== undefined && String(id).trim() !== '')
            .forEach(id => {
                const idStr = String(id).trim();
                clienteIdsNormalizados.add(idStr);
                // También agregar versiones sin espacios al inicio/final
                clienteIdsNormalizados.add(idStr.trim());
            });
        
        if (process.env.NODE_ENV === 'development') {
            console.log('[Devoluciones] IDs del cliente para comparar:', Array.from(clienteIdsNormalizados));
        }
        
        const facturasFiltradasResult = facturas.filter(f => {
            // Comparar clienteId de la factura con todos los identificadores posibles del cliente
            // Las facturas pueden tener clienteId como codter, numeroDocumento o id interno
            const facturaClienteId = String(f.clienteId || '').trim();
            
            // Comparación flexible: verificar si el clienteId de la factura coincide con cualquier identificador del cliente
            const coincideCliente = clienteIdsNormalizados.has(facturaClienteId) ||
                facturaClienteId === String(clienteSeleccionado.id).trim() ||
                facturaClienteId === String(clienteSeleccionado.numeroDocumento || '').trim() ||
                facturaClienteId === String(clienteSeleccionado.codter || '').trim();
            
            if (!coincideCliente) {
                return false;
            }
            
            if (process.env.NODE_ENV === 'development' && facturas.indexOf(f) < 3) {
                console.log('[Devoluciones] Factura coincide con cliente:', {
                    facturaId: f.id,
                    numeroFactura: f.numeroFactura,
                    facturaClienteId: facturaClienteId,
                    clienteIdSeleccionado: String(clienteSeleccionado.id),
                    coincide: coincideCliente
                });
            }
            
            // Si una factura ya está seleccionada, mantenerla en la lista independientemente del estado
            if (f.id === facturaId) {
                return true;
            }

            // Excluir facturas anuladas, rechazadas o en borrador
            if (f.estado === 'ANULADA' || f.estado === 'RECHAZADA' || f.estado === 'BORRADOR') {
                return false;
            }

            // SOLO mostrar facturas timbradas a la DIAN
            // Una factura está timbrada si:
            // 1. Tiene CUFE (código único de factura electrónica)
            // 2. Tiene fechaTimbrado
            // 3. O está en estado ENVIADA/ACEPTADA (estados que indican factura aprobada por DIAN)
            const tieneCufe = !!(f.cufe && String(f.cufe).trim() !== '' && String(f.cufe).trim() !== 'null');
            const tieneFechaTimbrado = !!(f.fechaTimbrado && String(f.fechaTimbrado).trim() !== '' && String(f.fechaTimbrado).trim() !== 'null');
            const estaEnviadaOAceptada = f.estado === 'ENVIADA' || f.estado === 'ACEPTADA';
            
            const estaTimbrada = tieneCufe || tieneFechaTimbrado || estaEnviadaOAceptada;
            
            if (!estaTimbrada) {
                return false;
            }

            // Verificar que no tenga devolución total
            const estadoDevolucionFactura = String(
                (f as any).estadoDevolucion ||
                (f as any).estado_devolucion ||
                ''
            ).trim().toUpperCase();

            if (estadoDevolucionFactura === 'DEVOLUCION_TOTAL') {
                return false;
            }

            // Verificar que haya cantidad pendiente para devolver
            // Si la factura no tiene items cargados, asumir que tiene cantidad pendiente
            const notasDeFactura = Array.isArray(notasCredito)
                ? notasCredito.filter(nc => String(nc.facturaId) === String(f.id))
                : [];

            // Si no hay items cargados, aún así mostrar la factura (puede que los items se carguen después)
            if (!f.items || !Array.isArray(f.items) || f.items.length === 0) {
                return true; // Mostrar aunque no tenga items (se cargarán después)
            }

            const hayCantidadPendiente = (f.items || []).some(factItem => {
                const cantidadDevuelta = notasDeFactura.reduce((acc, nota) => {
                    if (!Array.isArray(nota.itemsDevueltos)) return acc;
                    const match = nota.itemsDevueltos.find(dev => Number(dev.productoId) === Number(factItem.productoId));
                    return acc + (match?.cantidad || 0);
                }, 0);

                const pendiente = (factItem.cantidad || 0) - cantidadDevuelta;
                return pendiente > TOLERANCIA;
            });

            if (!hayCantidadPendiente) {
                return false;
            }
            
            return true;
        });
        
        if (process.env.NODE_ENV === 'development' && facturasFiltradasResult.length === 0 && clienteId) {
            console.warn('[Devoluciones] No se encontraron facturas para el cliente:', {
                clienteId,
                clienteNombre: clienteSeleccionado.nombreCompleto,
                clienteCodter: clienteSeleccionado.codter,
                clienteNumeroDoc: clienteSeleccionado.numeroDocumento,
                totalFacturas: facturas.length,
                facturasConEstadoEnviada: facturas.filter(f => f.estado === 'ENVIADA' || f.estado === 'ACEPTADA').length,
                facturasConCufe: facturas.filter(f => f.cufe && String(f.cufe).trim() !== '').length
            });
        }
        
        return facturasFiltradasResult;
    }, [clienteId, facturaId, facturas, clientes, notasCredito]);
    
    // Buscar factura de forma flexible: primero en facturasFiltradas, luego en todas las facturas
    // Si la factura tiene items cargados localmente, usarlos
    const selectedFactura = useMemo(() => {
        if (!facturaId) return undefined;
        
        // Primero buscar en facturasFiltradas
        let factura = facturasFiltradas.find(f => {
            const fIdStr = String(f.id);
            const facturaIdStr = String(facturaId);
            return fIdStr === facturaIdStr;
        });
        
        // Si no se encuentra, buscar en todas las facturas (comparación flexible)
        if (!factura) {
            factura = facturas.find(f => {
                const fIdStr = String(f.id);
                const facturaIdStr = String(facturaId);
                return fIdStr === facturaIdStr;
            });
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
        
        // Búsqueda flexible de cliente
        return clientes.find(c => 
            String(c.id) === String(clienteId) ||
            c.numeroDocumento === clienteId ||
            c.codter === clienteId
        );
    }, [clienteId, clientes]);

    // Items disponibles para la factura seleccionada: combinar items de selectedFactura y facturaItemsCargados
    const itemsDisponiblesFactura = useMemo(() => {
        if (!selectedFactura) return [];
        
        // Priorizar items de selectedFactura, pero si no tiene o está vacío, usar facturaItemsCargados
        const itemsDeFactura = selectedFactura.items && Array.isArray(selectedFactura.items) && selectedFactura.items.length > 0
            ? selectedFactura.items
            : null;
        
        const itemsCargados = facturaItemsCargados.length > 0 ? facturaItemsCargados : null;
        
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
                        type: 'error'
                    });
                }
            } catch (error) {
                console.error('[Devoluciones] Error cargando items de la factura:', error);
                addNotification({
                    message: 'Error al cargar los productos de la factura. Por favor, recargue la página.',
                    type: 'error'
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

    const handleAlmacenChange = (id: string) => {
        setAlmacenId(id);
    };
    
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
                            type: 'error'
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
                            type: 'error'
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
                    type: 'error'
                });
                setIsTotalDevolucion(false);
                return;
            }
        } else {
            setDevolucionItems([]);
        }
    };
    
    const resetForm = useCallback(() => {
        setAlmacenId('');
        setClienteId('');
        setFacturaId('');
        resetFormPartially();
    }, []);
    
    const summary = useMemo(() => {
        if (devolucionItems.length === 0 || itemsDisponiblesFactura.length === 0) {
            return { subtotalBruto: 0, iva: 0, total: 0, descuento: 0 };
        }
        let subBruto = 0, tax = 0, disc = 0;
        let ivaRate = 0;
        devolucionItems.forEach(devItem => {
            const factItem = itemsDisponiblesFactura.find(i => i.productoId === devItem.productoId);
            if(factItem) {
                const itemSubtotalBruto = factItem.precioUnitario * devItem.cantidadDevuelta;
                const itemDescuento = itemSubtotalBruto * (factItem.descuentoPorcentaje / 100);
                
                subBruto += itemSubtotalBruto;
                disc += itemDescuento;
                if(factItem.ivaPorcentaje > 0) ivaRate = factItem.ivaPorcentaje;
            }
        });
        const subNeto = subBruto - disc;
        tax = subNeto * (ivaRate / 100);
        const finalTotal = subNeto + tax;

        return { subtotalBruto: subBruto, iva: tax, total: finalTotal, descuento: disc };
    }, [devolucionItems, itemsDisponiblesFactura]);
    
    const costoTotalDevolucion = useMemo(() => {
        if (devolucionItems.length === 0) return 0;
        return devolucionItems.reduce((total, devItem) => {
            const product = productos.find(p => p.id === devItem.productoId);
            const cost = product?.ultimoCosto || 0;
            return total + (cost * devItem.cantidadDevuelta);
        }, 0);
    }, [devolucionItems, productos]);

    const handleSave = async () => {
        // Validaciones iniciales
        if (!selectedFactura) {
            addNotification({
                message: 'Por favor, seleccione una factura para realizar la devolución.',
                type: 'error'
            });
            return;
        }

        if (!selectedCliente) {
            addNotification({
                message: 'Por favor, seleccione un cliente para realizar la devolución.',
                type: 'error'
            });
            return;
        }

        if (itemsDisponiblesFactura.length === 0) {
            console.error('[Devoluciones] Error: La factura no tiene items cargados:', {
                facturaId: selectedFactura.id,
                numeroFactura: selectedFactura.numeroFactura,
                itemsDisponibles: itemsDisponiblesFactura.length
            });
            addNotification({
                message: 'La factura seleccionada no tiene productos cargados. Por favor, recargue la página o seleccione otra factura.',
                type: 'error'
            });
            return;
        }

        if (devolucionItems.length === 0) {
            addNotification({
                message: 'Debe seleccionar al menos un producto para devolver.',
                type: 'warning'
            });
            return;
        }

        if (isFormDisabled) {
            return;
        }

        const motivosPendientes = devolucionItems.filter(item => {
            if (item.motivoSeleccion === 'Otro') {
                return !item.motivo || item.motivo.trim().length === 0;
            }
            return !item.motivo || item.motivo.trim().length === 0;
        });

        if (motivosPendientes.length > 0) {
            addNotification({
                message: 'Debe especificar el motivo de la devolución en todos los items. Si elige "Otro", escriba el detalle.',
                type: 'warning'
            });
            return;
        }

        setIsSaving(true);
        
        try {
            console.log('[Devoluciones] Iniciando guardado de nota de crédito:', {
                facturaId: selectedFactura.id,
                clienteId: selectedCliente.id,
                itemsCount: devolucionItems.length,
                isTotalDevolucion
            });
            const itemsParaNota = devolucionItems.map(devItem => {
                const factItem = itemsDisponiblesFactura.find(i => i.productoId === devItem.productoId);
                if (!factItem) throw new Error(`Item de factura no encontrado para producto ${devItem.productoId}`);
                const itemSubtotalBruto = factItem.precioUnitario * devItem.cantidadDevuelta;
                const itemDescuento = itemSubtotalBruto * (factItem.descuentoPorcentaje / 100);
                const subtotal = itemSubtotalBruto - itemDescuento;
                const valorIva = subtotal * (factItem.ivaPorcentaje / 100);

                return { ...factItem, cantidad: devItem.cantidadDevuelta, motivo: devItem.motivo, motivoSeleccion: devItem.motivoSeleccion, subtotal, valorIva, total: subtotal + valorIva };
            });

            const motivoPrincipal = devolucionItems.length > 0
                ? (devolucionItems[0].motivo && devolucionItems[0].motivo.trim().length > 0
                    ? devolucionItems[0].motivo
                    : devolucionItems[0].motivoSeleccion || 'Devolución general')
                : 'Devolución general';
            
            const nuevaNota = await crearNotaCredito(selectedFactura, itemsParaNota, motivoPrincipal);
            
            if (!nuevaNota) {
                throw new Error('No se recibió respuesta del servidor al crear la nota de crédito');
            }
            
            setSavedNota(nuevaNota);
            addNotification({ 
                message: `Nota de Crédito ${nuevaNota.numero || nuevaNota.id} guardada con éxito.`, 
                type: 'success' 
            });
            
            // Limpiar formulario después de guardar exitosamente
            resetFormPartially();
            setFacturaId('');
            
            // Generate accounting note after successful save
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
                setAccountingNote({
                    loading: false,
                    text: 'No se pudo generar la nota explicativa automáticamente. Puede intentarlo más tarde o escribirla manualmente.',
                    error: true
                });
                addNotification({
                    message: 'La nota de crédito se guardó, pero la IA no pudo generar la nota explicativa.',
                    type: 'warning'
                });
            }

        } catch (error) {
            console.error('[Devoluciones] Error al guardar nota de crédito:', error);
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido al guardar la nota de crédito';
            addNotification({ 
                message: `Error al guardar la nota de crédito: ${errorMessage}. Por favor, verifique la consola para más detalles.`, 
                type: 'error' 
            });
        } finally {
            setIsSaving(false);
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
        { header: 'Fecha', accessor: 'fechaEmision'},
        { header: 'Factura Afectada', accessor: 'facturaId', cell: item => facturas.find(f=>f.id === item.facturaId)?.numeroFactura || 'N/A' },
        { header: 'Cliente', accessor: 'clienteId', cell: item => clientes.find(c=>c.id === item.clienteId)?.nombreCompleto || 'N/A' },
        { header: 'Valor Total', accessor: 'total', cell: item => formatCurrency(item.total) },
        { header: 'Estado DIAN', accessor: 'estadoDian', cell: item => item.estadoDian ? <StatusBadge status={item.estadoDian}/> : <StatusBadge status={'PENDIENTE'} /> },
        { header: 'Acciones', accessor: 'id', cell: (item) => (
            <div className="flex items-center space-x-3 text-slate-500 dark:text-slate-400 text-lg">
                <button onClick={() => handleOpenPrintModal(item)} className="hover:text-blue-500" title="Imprimir"><i className="fas fa-print"></i></button>
                <button onClick={() => handleOpenDetailModal(item)} className="hover:text-blue-500" title="Ver"><i className="fas fa-eye"></i></button>
                <button onClick={() => handleOpenPrintModal(item)} className="hover:text-blue-500" title="Descargar"><i className="fas fa-download"></i></button>
            </div>
        )}
    ];


    return (
        <div>
            <header className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Módulo de Devoluciones</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Gestione el registro y seguimiento de sus notas de crédito.</p>
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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label htmlFor="almacen-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Almacén (Opcional)</label>
                                    <select id="almacen-select" value={almacenId} onChange={e => handleAlmacenChange(e.target.value)} disabled={isFormDisabled} className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed">
                                        <option value="">Seleccione un almacén...</option>
                                        {almacenes && almacenes.length > 0 ? (
                                            almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)
                                        ) : (
                                            <option value="" disabled>Cargando almacenes...</option>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="cliente-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cliente</label>
                                    <select 
                                        id="cliente-select" 
                                        value={clienteId || ''} 
                                        onChange={e => {
                                            const selectedValue = e.target.value;
                                            if (process.env.NODE_ENV === 'development') {
                                                console.log('[Devoluciones] Select onChange - valor seleccionado:', selectedValue);
                                            }
                                            handleClienteChange(selectedValue);
                                        }} 
                                        disabled={isFormDisabled} 
                                        className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Seleccione un cliente...</option>
                                        {clientesConFacturasTimbradas.length > 0 ? (
                                            clientesConFacturasTimbradas.map(c => {
                                                const clienteValue = String(c.id || '');
                                                return (
                                                    <option key={c.id} value={clienteValue}>
                                                        {c.nombreCompleto || c.razonSocial || 'Sin nombre'}
                                                    </option>
                                                );
                                            })
                                        ) : (
                                            <option value="" disabled>No hay clientes con facturas timbradas a la DIAN</option>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="factura-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Factura</label>
                                    <select id="factura-select" value={facturaId} onChange={e => handleFacturaChange(e.target.value)} disabled={!clienteId || isFormDisabled} className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed">
                                        <option value="">Seleccione una factura...</option>
                                        {facturasFiltradas && facturasFiltradas.length > 0 ? (
                                            facturasFiltradas.map(f => <option key={f.id} value={f.id}>{f.numeroFactura} - {f.fechaFactura}</option>)
                                        ) : clienteId ? (
                                            <option value="" disabled>No hay facturas disponibles para este cliente</option>
                                        ) : (
                                            <option value="" disabled>Seleccione un cliente primero</option>
                                        )}
                                    </select>
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
                                    
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg mb-4">
                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 text-sm">
                                            <div className="space-y-3 min-w-0">
                                                <div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Cliente:</p>
                                                    <p className="font-bold uppercase truncate">{selectedCliente?.nombreCompleto}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Fecha Factura:</p>
                                                    <p className="font-bold">{selectedFactura.fechaFactura}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-3 min-w-0">
                                                <div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">NIT:</p>
                                                    <p className="font-bold">{selectedCliente?.numeroDocumento}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Factura No:</p>
                                                    <p className="font-bold text-blue-600 dark:text-blue-400">{selectedFactura.numeroFactura}</p>
                                                </div>
                                                 <div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Valor Total:</p>
                                                    <p className="font-bold">{formatCurrency(selectedFactura.total)}</p>
                                                </div>
                                                 <div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Saldo Actual:</p>
                                                    <p className="font-bold">{formatCurrency(selectedFactura.total)}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-4 w-full lg:w-auto shrink-0">
                                                <div className="w-full mx-auto lg:mx-0">
                                                    <label htmlFor="tipo-devolucion" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 text-center sm:text-left whitespace-nowrap">Tipo de Devolución</label>
                                                    <ToggleSwitch
                                                        id="tipo-devolucion"
                                                        checked={isTotalDevolucion}
                                                        onChange={handleTotalDevolucionToggle}
                                                        disabled={isFormDisabled}
                                                        labelLeft="Parcial"
                                                        labelRight="Total"
                                                        size="compact"
                                                        width="equal"
                                                        className="w-full max-w-[520px]"
                                                    />
                                                </div>
                                                <div className="w-full mx-auto lg:mx-0">
                                                    <label htmlFor="transmision-dian" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 text-center sm:text-left whitespace-nowrap">Transmisión DIAN</label>
                                                    <ToggleSwitch
                                                        id="transmision-dian"
                                                        checked={transmisionDian}
                                                        onChange={setTransmisionDian}
                                                        disabled={isFormDisabled}
                                                        labelLeft="Sin Referencias"
                                                        labelRight="Con Referencias"
                                                        size="compact"
                                                        width="equal"
                                                        className="w-full max-w-[600px]"
                                                    />
                                                </div>
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
                                                                            <td className="px-4 py-2 text-center">{almacenId || '001'}</td>
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
            )}

            {activeTab === 'history' && (
                 <Card>
                    <CardHeader><CardTitle>Historial de Devoluciones</CardTitle></CardHeader>
                    <CardContent className="p-0">
                         <Table columns={historyColumns} data={paginatedData} onSort={requestSort} sortConfig={sortConfig} />
                    </CardContent>
                 </Card>
            )}

            <Modal isOpen={geminiEmail.modalOpen} onClose={() => setGeminiEmail({ ...geminiEmail, modalOpen: false })} title="✨ Correo Sugerido por IA">
                 {geminiEmail.loading ? (
                    <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-t-sky-400 border-slate-200 dark:border-slate-700 rounded-full animate-spin"></div></div>
                ) : (
                    <div>
                        <textarea value={geminiEmail.text} readOnly rows={10} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 dark:text-slate-200"></textarea>
                         <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end space-x-3 rounded-b-lg -m-6 mt-4">
                            <button onClick={() => navigator.clipboard.writeText(geminiEmail.text).then(() => addNotification({message: 'Copiado al portapapeles', type: 'info'}))} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Copiar Texto</button>
                            <button onClick={() => setGeminiEmail({ ...geminiEmail, modalOpen: false })} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Cerrar</button>
                         </div>
                    </div>
                )}
            </Modal>

            {selectedNotaParaVer && (() => {
                const clienteNota = clientes.find(c => c.id === selectedNotaParaVer.clienteId);
                const facturaNota = facturas.find(f => f.id === selectedNotaParaVer.facturaId);
                return (
                    <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`Detalle Nota de Crédito: ${selectedNotaParaVer.numero}`} size="3xl">
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                <div><p className="font-semibold text-slate-600 dark:text-slate-400">Cliente:</p><p>{clienteNota?.nombreCompleto}</p></div>
                                <div><p className="font-semibold text-slate-600 dark:text-slate-400">Factura Afectada:</p><p>{facturaNota?.numeroFactura}</p></div>
                                <div><p className="font-semibold text-slate-600 dark:text-slate-400">Fecha Emisión:</p><p>{selectedNotaParaVer.fechaEmision}</p></div>
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
                                                    <td className="px-4 py-2">{item.descripcion || 'N/A'}</td>
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
            })()}

            {notaParaImprimir && (
                <NotaCreditoPreviewModal notaCredito={notaParaImprimir} onClose={() => setNotaParaImprimir(null)} />
            )}
        </div>
    );
};

export default DevolucionesPage;