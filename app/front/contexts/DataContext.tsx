import React, { createContext, useState, ReactNode, useMemo, useCallback, useEffect, useRef } from 'react';
import { initialActivityLog } from '../data/activityLog';
import {
    Cliente, InvProducto, Factura, Pedido, Cotizacion, Remision, NotaCredito, Vendedor, DocumentItem,
    Departamento, Ciudad, TipoDocumento, TipoPersona, RegimenFiscal, Usuario, Producto, Medida,
    ActivityLog, Categoria, DocumentoDetalle, GlobalSearchResults, Transportadora, ArchivoAdjunto
} from '../types';
import { Role } from '../config/rolesConfig';
import {
    fetchClientes, fetchProductos, fetchFacturas, fetchFacturasDetalle,
    fetchCotizaciones, fetchCotizacionesDetalle, fetchPedidos, fetchPedidosDetalle,
    fetchRemisiones, fetchRemisionesDetalle, fetchNotasCredito, fetchMedidas, fetchCategorias,
    testApiConnection, fetchVendedores, apiCreateCliente, fetchBodegas, apiCreateNotaCredito,
    apiRegisterInventoryEntry
} from '../services/apiClient';
import { generarRemisionPDFenBlob, generarFacturaPDFenBlob } from '../utils/pdfGenerator';
import { defaultPreferences } from '../hooks/useDocumentPreferences';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../utils/logger';

// --- HELPER FUNCTIONS FOR CASE CONVERSION ---

const snakeToCamel = (str: string) => str.replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace('-', '').replace('_', ''));

const convertKeysToCamelCase = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => convertKeysToCamelCase(v));
    } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc: { [key: string]: any }, key) => {
            const camelKey = snakeToCamel(key);
            acc[camelKey] = convertKeysToCamelCase(obj[key]);
            return acc;
        }, {});
    }
    return obj;
};

const camelToSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

const convertKeysToSnakeCase = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => convertKeysToSnakeCase(v));
    } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc: { [key: string]: any }, key) => {
            const snakeKey = camelToSnake(key);
            acc[snakeKey] = convertKeysToSnakeCase(obj[key]);
            return acc;
        }, {});
    }
    return obj;
};

// --- DATA CONTEXT INTERFACE ---

interface DataContextType {
    // Loading states
    isLoading: boolean;
    isMainDataLoaded: boolean;

    // Core data
    clientes: Cliente[];
    productos: InvProducto[];
    facturas: Factura[];
    cotizaciones: Cotizacion[];
    pedidos: Pedido[];
    remisiones: Remision[];
    notasCredito: NotaCredito[];
    archivosAdjuntos: ArchivoAdjunto[];

    // Catalogs
    medidas: Medida[];
    categorias: Categoria[];
    departamentos: Departamento[];
    ciudades: Ciudad[];
    tiposDocumento: TipoDocumento[];
    tiposPersona: TipoPersona[];
    regimenesFiscal: RegimenFiscal[];
    vendedores: Vendedor[];
    transportadoras: Transportadora[];
    almacenes: Array<{ id: string | number; nombre: string; codigo?: string }>;

    // Activity log
    activityLog: ActivityLog[];

    // Company data
    datosEmpresa: any;

    // Computed data
    getSalesDataByPeriod: (start: Date, end: Date) => Array<{ date: string; sales: number }>;
    getSalesByCliente: () => Array<{ id: string; clientName: string; totalSales: number; orderCount: number; lastOrder: string }>;
    getSalesDataByClient: () => Array<{ id: string; clientName: string; totalSales: number; orderCount: number; lastOrder: string }>; // Alias para compatibilidad
    getSalesByVendedor: () => Array<{ id: string; name: string; totalSales: number; orderCount: number }>;
    getTopProductos: (limit?: number) => Array<{ producto: InvProducto; cantidad: number }>;
    getGlobalSearchResults: (query: string) => GlobalSearchResults;
    globalSearch: (query: string) => GlobalSearchResults; // Alias para compatibilidad

    // Actions
    addActivityLog: (action: string, details: string, entity: { type: string; id: string | number; name: string }) => void;
    refreshData: () => Promise<void>;
    ingresarStockProducto: (productoId: number, cantidad: number, motivo: string, usuario: Usuario, costoUnitario?: number, documentoReferencia?: string) => Promise<InvProducto>;
    crearCliente: (data: Partial<Cliente>) => Promise<Cliente | null>;
    actualizarCliente: (id: string, data: Partial<Cliente>) => Promise<Cliente | null>;
    getCotizacionById: (id: string) => Cotizacion | undefined;
    crearCotizacion: (data: Cotizacion) => Promise<Cotizacion>;
    actualizarCotizacion: (id: string | number, data: Partial<Cotizacion>, baseCotizacion?: Cotizacion) => Promise<Cotizacion | undefined>;
    crearPedido: (data: Pedido) => Promise<Pedido>;
    actualizarPedido: (id: string, data: Partial<Pedido>, updatedBy?: string) => Promise<Pedido | undefined>;
    aprobarPedido: (id: string) => Promise<Pedido | undefined>;
    marcarPedidoListoParaDespacho: (id: string) => Promise<Pedido | undefined>;
    aprobarCotizacion: (id: string | Cotizacion, itemIds?: number[]) => Promise<{ cotizacion: Cotizacion, pedido: Pedido } | Cotizacion | undefined>;
    aprobarRemision: (id: string) => Promise<Remision | undefined>;
    crearRemision: ((data: Remision) => Promise<Remision>) & ((pedido: Pedido, items: Array<{ productoId: number; cantidad: number }>, logisticData?: any) => Promise<{ nuevaRemision: Remision; mensaje: string }>);
    crearFactura: (data: Factura) => Promise<Factura>;
    crearNotaCredito: (factura: Factura, items: DocumentItem[], motivo: string, tipoNota?: 'DEVOLUCION' | 'ANULACION') => Promise<NotaCredito>;
    crearFacturaDesdeRemisiones: (remisionIds: string[]) => Promise<{ nuevaFactura: Factura } | null>;
    timbrarFactura: (facturaId: string) => Promise<Factura | undefined>;
    refreshFacturasYRemisiones: () => Promise<void>;
    motivosDevolucion: string[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// --- DATA PROVIDER COMPONENT ---

interface DataProviderProps {
    children: ReactNode;
}

// Mock data for development
const motivosDevolucion = ['Dañado en transporte'];

const generateTempId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `tmp-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
};

export const DataProvider = ({ children }: DataProviderProps) => {
    // DataProvider depende de AuthProvider, así que debe estar dentro de AuthProvider
    const { user, selectedSede, isLoadingBodegas } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isMainDataLoaded, setIsMainDataLoaded] = useState(false);

    // Core data states
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [productos, setProductos] = useState<InvProducto[]>([]);
    const [facturas, setFacturas] = useState<Factura[]>([]);
    const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
    const [pedidos, setPedidos] = useState<Pedido[]>([]);
    const [remisiones, setRemisiones] = useState<Remision[]>([]);
    const [notasCredito, setNotasCredito] = useState<NotaCredito[]>([]);
    const [archivosAdjuntos, setArchivosAdjuntos] = useState<ArchivoAdjunto[]>([]);

    // Catalog states
    const [medidas, setMedidas] = useState<Medida[]>([]);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
    const [ciudades, setCiudades] = useState<Ciudad[]>([]);
    const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([]);
    const [tiposPersona, setTiposPersona] = useState<TipoPersona[]>([]);
    const [regimenesFiscal, setRegimenesFiscal] = useState<RegimenFiscal[]>([]);
    const [vendedores, setVendedores] = useState<Vendedor[]>([]);
    const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
    const [almacenes, setAlmacenes] = useState<Array<{ id: string | number; nombre: string; codigo?: string }>>([]);

    // Activity log
    const [activityLog, setActivityLog] = useState<ActivityLog[]>(initialActivityLog);

    // Phase 1: Load essential catalogs first
    // PRIORIDAD: Esperar a que las bodegas se carguen primero en AuthContext antes de cargar otros datos
    useEffect(() => {
        // No cargar nada hasta que las bodegas estén listas
        if (isLoadingBodegas) {
            logger.log({ prefix: 'DataContext' }, '⏳ Esperando a que se carguen las bodegas en AuthContext...');
            return;
        }

        const fetchEssentialCatalogs = async () => {
            try {
                logger.log({ prefix: 'DataContext' }, '🚀 Iniciando carga de catálogos esenciales (bodegas ya cargadas)');

                // Helper para extraer datos de estructura anidada
                const extractArrayData = (response: any): any[] => {
                    if (!response.success) return [];
                    const raw = response.data;
                    if (Array.isArray(raw)) return raw;
                    if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as any).data)) {
                        return (raw as any).data;
                    }
                    return [];
                };

                // PRIORIDAD 1: Cargar almacenes (bodegas) PRIMERO - son críticos para el resto de la aplicación
                logger.log({ prefix: 'DataContext' }, '📦 Cargando almacenes (bodegas) como prioridad...');
                let bodegasResp;
                try {
                    bodegasResp = await fetchBodegas();
                } catch (fetchError) {
                    logger.warn({ prefix: 'DataContext' }, 'Error de red al cargar almacenes (backend puede no estar disponible):', fetchError);
                    bodegasResp = { success: false, data: [] };
                }

                if (bodegasResp && bodegasResp.success && bodegasResp.data && Array.isArray(bodegasResp.data) && bodegasResp.data.length > 0) {
                    const bodegasData = extractArrayData(bodegasResp);
                    // El backend ahora devuelve: id (codalm), codigo (codalm), nombre (nomalm), direccion (diralm), ciudad (ciualm)
                    const processedAlmacenes = (bodegasData as any[]).map((b: any) => ({
                        id: b.id || b.codigo || b.codalm || String(b.id),
                        nombre: b.nombre || b.nomalm || 'Sin nombre',
                        codigo: b.codigo || b.codalm || String(b.id).padStart(3, '0'),
                        direccion: b.direccion || b.diralm || '',
                        ciudad: b.ciudad || b.ciualm || ''
                    }));
                    // Ordenar almacenes por código (001, 002, 003, etc.)
                    const almacenesOrdenados = processedAlmacenes.sort((a, b) => {
                        const codigoA = String(a.codigo || '').padStart(3, '0');
                        const codigoB = String(b.codigo || '').padStart(3, '0');
                        return codigoA.localeCompare(codigoB);
                    });
                    logger.log({ prefix: 'DataContext' }, `✅ Almacenes cargados desde BD: ${almacenesOrdenados.length}`, almacenesOrdenados.map(a => `${a.codigo} - ${a.nombre}`));
                    setAlmacenes(almacenesOrdenados);
                } else {
                    const reason = !bodegasResp ? 'Sin respuesta' : !bodegasResp.success ? 'Respuesta no exitosa' : !bodegasResp.data ? 'Sin datos' : 'Array vacío';
                    logger.warn({ prefix: 'DataContext' }, `⚠️ No se pudieron cargar almacenes desde la BD (${reason}). Continuando sin almacenes.`);
                    setAlmacenes([]);
                }

                // PRIORIDAD 2: Cargar otros catálogos esenciales en paralelo (después de bodegas)
                // Test API connection (pero no fallar si no hay conexión, solo continuar)
                try {
                    const connectionTest = await testApiConnection();
                    if (!connectionTest.success) {
                        logger.warn({ prefix: 'DataContext' }, 'No se puede conectar con el servidor API, continuando con datos mock');
                        // No lanzar error, solo continuar sin cargar datos del servidor
                    }
                } catch (connectionError) {
                    logger.warn({ prefix: 'DataContext' }, 'Error al probar conexión API, continuando con datos mock:', connectionError);
                    // Continuar sin lanzar error
                }

                // Cargar medidas y categorías en paralelo (después de bodegas)
                const [medidasResponse, categoriasResponse] = await Promise.all([
                    fetchMedidas().catch(err => {
                        logger.warn({ prefix: 'DataContext' }, 'Error cargando medidas:', err);
                        return { success: false, data: [] };
                    }),
                    fetchCategorias().catch(err => {
                        logger.warn({ prefix: 'DataContext' }, 'Error cargando categorías:', err);
                        return { success: false, data: [] };
                    })
                ]);

                // Procesar medidas
                if (medidasResponse && medidasResponse.success) {
                    const medidasData = extractArrayData(medidasResponse);
                    if (medidasData.length > 0) {
                        setMedidas(medidasData);
                    }
                }

                // Procesar categorías
                if (categoriasResponse && categoriasResponse.success) {
                    const categoriasData = extractArrayData(categoriasResponse);
                    if (categoriasData.length > 0) {
                        setCategorias(categoriasData);
                    }
                }

                // Load mock data for other catalogs (temporary)
                setDepartamentos([]);
                setCiudades([]);
                setTiposDocumento([]);
                setTiposPersona([]);
                setRegimenesFiscal([]);

                // Vendedores desde la BD (con manejo de errores individual)
                let vendedoresResp;
                try {
                    vendedoresResp = await fetchVendedores();
                } catch (error) {
                    logger.warn({ prefix: 'DataContext' }, 'Error cargando vendedores:', error);
                    vendedoresResp = { success: false, data: [] };
                }
                if (vendedoresResp.success) {
                    const vendedoresData = extractArrayData(vendedoresResp);
                    // Normalizar el campo activo de vendedores: convertir boolean a number (true -> 1, false -> 0)
                    const processedVendedores = (vendedoresData as any[]).map((v: any) => {
                        // Normalizar activo: puede venir como boolean (true/false) o number (1/0)
                        let activoNormalizado = 1; // Por defecto activo (ya que el backend filtra solo activos)
                        if (v.activo !== undefined && v.activo !== null) {
                            if (v.activo === true || v.activo === 1 || v.activo === '1' || String(v.activo) === 'true') {
                                activoNormalizado = 1;
                            } else if (v.activo === false || v.activo === 0 || v.activo === '0' || String(v.activo) === 'false') {
                                activoNormalizado = 0;
                            } else {
                                // Intentar convertir a número
                                activoNormalizado = Number(v.activo) || 1; // Default a 1 si no se puede convertir
                            }
                        }

                        return {
                            ...v,
                            activo: activoNormalizado, // Siempre número: 1 (activo) o 0 (inactivo)
                            codiEmple: v.codiEmple || v.id, // Asegurar que codiEmple esté disponible
                            nombreCompleto: v.nombreCompleto || `${v.primerNombre || ''} ${v.primerApellido || ''}`.trim()
                        };
                    });
                    setVendedores(processedVendedores as any);
                } else {
                    setVendedores([]);
                }

                setTransportadoras([]);

                logger.log({ prefix: 'DataContext' }, '✅ Catálogos esenciales cargados');
                setIsLoading(false);
            } catch (error) {
                logger.error({ prefix: 'DataContext' }, 'Error cargando catálogos esenciales:', error);
                setIsLoading(false);
            }
        };

        fetchEssentialCatalogs();
    }, [isLoadingBodegas]);

    // Phase 2: Load heavy transactional data in the background with pagination
    useEffect(() => {
        const fetchMainTransactionalData = async () => {
            try {
                // Obtener código de bodega seleccionada
                const codalm = selectedSede?.codigo ? String(selectedSede.codigo).padStart(3, '0') : undefined;

                // Load essential data first (clientes and productos)
                const [clientesResponse, productosResponse] = await Promise.all([
                    fetchClientes(),
                    fetchProductos(codalm)
                ]);


                // Helper para extraer datos de estructura anidada
                const extractArrayData = (response: any): any[] => {
                    if (!response.success) return [];
                    const raw = response.data;
                    if (Array.isArray(raw)) return raw;
                    if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as any).data)) {
                        return (raw as any).data;
                    }
                    return [];
                };

                // Manejar estructura anidada: response.data.data o response.data
                const clientesData = extractArrayData(clientesResponse);
                const productosData = extractArrayData(productosResponse);

                // Process productos with medidas and stock
                const productosConMedida = (productosData as any[]).map((p: InvProducto) => {
                    const unidadMedidaNombre = medidas.find((m) => m.id === p.idMedida)?.nombre || 'Unidad';
                    const precioVenta = Number(
                        (p as any).precio ?? (p as any).precioPublico ?? (p as any).precioMayorista ?? (p as any).precioMinorista ?? (p as any).ultimoCosto ?? 0
                    );

                    return {
                        ...p,
                        unidadMedida: unidadMedidaNombre,
                        precio: precioVenta,
                        precioPublico: Number((p as any).precioPublico ?? precioVenta),
                        precioMayorista: Number((p as any).precioMayorista ?? 0),
                        precioMinorista: Number((p as any).precioMinorista ?? 0),
                        ultimoCosto: Number((p as any).ultimoCosto ?? 0),
                        // Asegurar que stock esté disponible (viene del backend desde inv_invent)
                        stock: Number(p.stock ?? 0),
                        controlaExistencia: Number(p.stock ?? p.controlaExistencia ?? 0)
                    } as InvProducto;
                });
                productosConMedida.sort((a: InvProducto, b: InvProducto) => (a.nombre || '').trim().localeCompare((b.nombre || '').trim()));
                setProductos(productosConMedida);

                // Process clientes
                // Normalizar el campo activo: convertir boolean a number (true -> 1, false -> 0)
                const processedClientes = (clientesData as any[]).map((c: Cliente) => {
                    // Normalizar activo: puede venir como boolean (true/false), number (1/0), string ('1'/'0'/'true'/'false')
                    let activoNormalizado = 0;
                    const activoValor = c.activo;
                    if (
                        (typeof activoValor === 'boolean' && activoValor === true) || activoValor === 1 || String(activoValor) === 'true' || String(activoValor) === '1'
                    ) {
                        activoNormalizado = 1;
                    } else if (
                        (typeof activoValor === 'boolean' && activoValor === false) || activoValor === 0 || String(activoValor) === 'false' || String(activoValor) === '0'
                    ) {
                        activoNormalizado = 0;
                    } else {
                        // Intentar convertir a número
                        activoNormalizado = Number(activoValor) || 0;
                    }

                    // Mapear fecha de ingreso: puede venir como fechaIngreso, FECING, o createdAt
                    const fechaIngreso = c.createdAt || (c as any).fechaIngreso || (c as any).FECING;

                    return {
                        ...c,
                        activo: activoNormalizado, // Siempre número: 1 (activo) o 0 (inactivo)
                        nombreCompleto: c.razonSocial || `${c.primerNombre || ''} ${c.primerApellido || ''}`.trim(),
                        condicionPago: c.diasCredito > 0 ? `Crédito ${c.diasCredito} días` : 'Contado',
                        createdAt: fechaIngreso || new Date().toISOString() // Asegurar que siempre haya una fecha
                    };
                });
                processedClientes.sort((a: Cliente, b: Cliente) => (a.nombreCompleto || '').trim().localeCompare((b.nombreCompleto || '').trim()));
                setClientes(processedClientes);

                // Load activity log from local storage
                try {
                    const savedLog = localStorage.getItem('erp360_activityLog');
                    setActivityLog(savedLog ? JSON.parse(savedLog) : initialActivityLog);
                } catch (error) {
                    setActivityLog(initialActivityLog);
                }

                setIsMainDataLoaded(true);

                // Load transactional data in background (lazy loading)
                setTimeout(() => {
                    loadTransactionalData(productosConMedida);
                }, 100);
            } catch (error) {
                logger.error({ prefix: 'DataContext' }, 'Error cargando datos esenciales:', error);
            }
        };

        const loadTransactionalData = async (productosConMedida: InvProducto[]) => {
            try {
                // OPTIMIZACIÓN: Cargar datos transaccionales con paginación y lazy loading
                // No cargar todos los datos al inicio, solo cargar cuando sea necesario
                const [
                    facturasResponse, cotizacionesResponse,
                    pedidosResponse, notasCreditoResponse
                ] = await Promise.all([
                    // Cargar solo primera página de facturas (optimización: no cargar todos)
                    fetchFacturas().catch(() => ({ success: false, data: [] })),
                    // Cargar solo primera página de cotizaciones
                    fetchCotizaciones().catch(() => ({ success: false, data: [] })),
                    // Cargar pedidos con paginación razonable (100 items en lugar de 10000)
                    fetchPedidos(1, 100).catch(() => ({ success: false, data: [], pagination: {} })),
                    // Cargar notas de crédito con paginación
                    fetchNotasCredito().catch(() => ({ success: false, data: [] }))
                ]);

                // Cargar detalles de cotizaciones, pedidos y facturas para que los items se muestren correctamente
                // Los detalles de remisiones se pueden cargar bajo demanda
                const [
                    cotizacionesDetalleResponse,
                    pedidosDetalleResponse,
                    facturasDetalleResponse
                ] = await Promise.all([
                    fetchCotizacionesDetalle().catch(() => ({ success: false, data: [] })),
                    fetchPedidosDetalle().catch(() => ({ success: false, data: [] })),
                    fetchFacturasDetalle().catch(() => ({ success: false, data: [] }))
                ]);

                // Remisiones detalles se cargan bajo demanda
                const remisionesResponse = { success: true, data: [] };
                const remisionesDetalleResponse = { success: true, data: [] };

                if (!pedidosResponse.success) {
                    logger.error({ prefix: 'DataContext' }, 'Error en pedidos:', pedidosResponse);
                } else {
                    logger.log({ prefix: 'DataContext', level: 'debug' }, 'Pedidos response exitosa:', pedidosResponse);
                }
                if (!remisionesResponse.success) {
                    logger.error({ prefix: 'DataContext' }, 'Error en remisiones:', remisionesResponse);
                } else {
                    logger.log({ prefix: 'DataContext', level: 'debug' }, 'Remisiones response exitosa:', {
                        success: remisionesResponse.success,
                        dataType: typeof remisionesResponse.data,
                        isArray: Array.isArray(remisionesResponse.data),
                        dataLength: Array.isArray(remisionesResponse.data) ? remisionesResponse.data.length : 'N/A',
                        rawData: remisionesResponse.data
                    });
                }
                if (!remisionesDetalleResponse.success) {
                    logger.error({ prefix: 'DataContext' }, 'Error en remisiones detalle:', remisionesDetalleResponse);
                } else {
                    logger.log({ prefix: 'DataContext', level: 'debug' }, 'Remisiones detalle response exitosa:', {
                        success: remisionesDetalleResponse.success,
                        dataType: typeof remisionesDetalleResponse.data,
                        isArray: Array.isArray(remisionesDetalleResponse.data),
                        dataLength: Array.isArray(remisionesDetalleResponse.data) ? remisionesDetalleResponse.data.length : 'N/A'
                    });
                }

                // Helper para extraer datos de estructura anidada
                const extractData = (response: any, label: string = 'data'): any[] => {
                    if (!response.success) {
                        logger.warn({ prefix: 'DataContext' }, `extractData: ${label} response no exitosa`);
                        return [];
                    }
                    const raw = response.data;
                    if (Array.isArray(raw)) {
                        logger.log({ prefix: 'DataContext', level: 'debug' }, `extractData: ${label} es array directo, longitud: ${raw.length}`);
                        return raw;
                    }
                    if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as any).data)) {
                        logger.log({ prefix: 'DataContext', level: 'debug' }, `extractData: ${label} tiene estructura anidada, longitud: ${(raw as any).data.length}`);
                        return (raw as any).data;
                    }
                    logger.warn({ prefix: 'DataContext' }, `extractData: ${label} no tiene formato esperado:`, {
                        rawType: typeof raw,
                        isObject: raw && typeof raw === 'object',
                        hasData: raw && typeof raw === 'object' && 'data' in raw,
                        raw
                    });
                    return [];
                };

                const facturasData = extractData(facturasResponse);
                const facturasDetalleData = extractData(facturasDetalleResponse);
                const cotizacionesData = extractData(cotizacionesResponse);
                const cotizacionesDetalleData = extractData(cotizacionesDetalleResponse);
                const pedidosData = extractData(pedidosResponse);
                const pedidosDetalleData = extractData(pedidosDetalleResponse);
                const remisionesData = extractData(remisionesResponse, 'remisiones');
                const remisionesDetalleData = extractData(remisionesDetalleResponse, 'remisionesDetalle');
                const notasCreditoData = extractData(notasCreditoResponse);

                // Process facturas with detalles
                const facturasConDetalles = (facturasData as any[]).map(f => {
                    // Procesar remisionesIds: puede venir como string separado por comas o como array
                    let remisionesIds: string[] = [];
                    if (f.remisionesIds) {
                        if (Array.isArray(f.remisionesIds)) {
                            remisionesIds = f.remisionesIds.map((id: any) => String(id));
                        } else if (typeof f.remisionesIds === 'string' && f.remisionesIds.trim()) {
                            remisionesIds = f.remisionesIds.split(',').map((id: string) => id.trim()).filter((id: string) => id.length > 0);
                        }
                    }
                    // Si no hay remisionesIds pero hay remisionId (singular), usarlo
                    if (remisionesIds.length === 0 && f.remisionId) {
                        remisionesIds = [String(f.remisionId)];
                    }

                    // Buscar items que pertenezcan a esta factura (matching flexible por ID)
                    const facturaIdStr = String(f.id || f.ID || '');
                    const items = (facturasDetalleData as any[]).filter(d => {
                        const detalleFacturaId = String(d.facturaId || d.factura_id || d.id_factura || '');
                        // Comparar tanto por ID numérico como por string
                        return facturaIdStr === detalleFacturaId ||
                            (facturaIdStr && detalleFacturaId && parseInt(facturaIdStr, 10) === parseInt(detalleFacturaId, 10));
                    }).map(d => ({
                        // Mapear campos del detalle a la estructura esperada
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
                    }));

                    // Mapear todos los campos de la tabla ven_facturas
                    return {
                        // Campos principales
                        id: String(f.id || f.ID || ''),
                        numeroFactura: f.numeroFactura || f.numfact || '',
                        fechaFactura: f.fechaFactura || f.fecfac || '',
                        fechaVencimiento: f.fechaVencimiento || f.venfac || undefined,
                        clienteId: f.clienteId || f.codter || '',
                        vendedorId: f.vendedorId || f.codven || undefined,
                        empresaId: f.empresaId || f.codalm || '001',
                        // Valores financieros
                        subtotal: Number(f.subtotal || f.valvta || 0),
                        descuentoValor: Number(f.descuentoValor || f.valdcto || 0),
                        ivaValor: Number(f.ivaValor || f.valiva || 0),
                        total: Number(f.total || f.netfac || 0),
                        otrosValores: Number(f.otrosValores || f.valotr || 0),
                        anticipos: Number(f.anticipos || f.valant || 0),
                        devoluciones: Number(f.devoluciones || f.valdev || 0),
                        abonos: Number(f.abonos || f.abofac || 0),
                        retenciones: Number(f.retenciones || f.valret || 0),
                        retencionICA: Number(f.retencionICA || f.valrica || 0),
                        retencionIVA: Number(f.retencionIVA || f.valriva || 0),
                        costo: Number(f.costo || f.valcosto || 0),
                        valorPagado: Number(f.valorPagado || f.valpagado || 0),
                        valorDomicilio: Number(f.valorDomicilio || f.VALDOMICILIO || 0),
                        valorNotas: Number(f.valorNotas || f.Valnotas || 0),
                        // Formas de pago
                        efectivo: Number(f.efectivo || 0),
                        cheques: Number(f.cheques || 0),
                        credito: Number(f.credito || 0),
                        tarjetaCredito: Number(f.tarjetaCredito || f.tarjetacr || 0),
                        tarjetaDebito: Number(f.tarjetaDebito || f.TarjetaDB || 0),
                        transferencia: Number(f.transferencia || f.Transferencia || 0),
                        // Información adicional
                        tipoFactura: f.tipoFactura || f.tipfac || '01',
                        documentoContable: f.documentoContable || f.doccoc || undefined,
                        cuenta: f.cuenta || f.codcue || undefined,
                        observaciones: f.observaciones || f.Observa || '',
                        resolucionDian: f.resolucionDian || f.resolucion_dian || undefined,
                        tarifaCREE: Number(f.tarifaCREE || f.TARIFA_CREE || 0),
                        retencionCREE: Number(f.retencionCREE || f.RETECREE || 0),
                        usuarioId: f.usuarioId || f.codusu || undefined,
                        fechaSistema: f.fechaSistema || f.fecsys || undefined,
                        estado: f.estado || f.estfac || 'BORRADOR',
                        estadoEnvio: f.estadoEnvio || f.estado_envio || undefined,
                        seyKey: f.seyKey || f.sey_key || undefined,
                        cufe: f.cufe || f.CUFE || undefined,
                        cajaId: f.cajaId || f.IdCaja || undefined,
                        // Extraer motivo de rechazo de observaciones si existe
                        motivoRechazo: f.motivoRechazo || (f.estado === 'RECHAZADA' ? (f.observaciones || f.Observa || null) : null),
                        // Items y relaciones
                        items: items,
                        remisionesIds: remisionesIds,
                        remisionId: f.remisionId || undefined,
                        pedidoId: f.pedidoId || undefined,
                        estadoDevolucion: f.estadoDevolucion || f.estado_devolucion || undefined,
                        fechaTimbrado: f.fechaTimbrado || f.fecha_timbrado || undefined
                    };
                });

                logger.log({ prefix: 'DataContext', level: 'debug' }, 'Facturas procesadas con detalles:', {
                    facturasCount: facturasConDetalles.length,
                    facturasConItems: facturasConDetalles.filter(f => f.items && f.items.length > 0).length,
                    totalItems: facturasConDetalles.reduce((sum, f) => sum + (f.items?.length || 0), 0)
                });

                setFacturas(facturasConDetalles);

                // Process cotizaciones with detalles
                // CRÍTICO: Comparar IDs como strings para evitar problemas de tipo
                const cotizacionesConDetalles = (cotizacionesData as any[]).map(c => {
                    const cotizacionIdStr = String(c.id || '').trim();
                    const items = (cotizacionesDetalleData as any[]).filter(d => {
                        const detalleCotizacionIdStr = String(d.cotizacionId || '').trim();
                        // Comparar como strings para evitar problemas de tipo
                        const match = cotizacionIdStr === detalleCotizacionIdStr ||
                            String(c.id) === String(d.cotizacionId) ||
                            Number(c.id) === Number(d.cotizacionId);
                        return match;
                    });

                    logger.log({ prefix: 'DataContext', level: 'debug' }, `Cotización ${cotizacionIdStr} - Items encontrados: ${items.length}`, {
                        cotizacionId: cotizacionIdStr,
                        itemsCount: items.length,
                        totalDetalles: cotizacionesDetalleData.length,
                        itemsIds: items.map(i => i.id).slice(0, 5)
                    });

                    return {
                        ...c,
                        items: items
                    };
                });

                logger.log({ prefix: 'DataContext', level: 'debug' }, 'Cotizaciones procesadas con detalles:', {
                    cotizacionesCount: cotizacionesConDetalles.length,
                    cotizacionesConItems: cotizacionesConDetalles.filter(c => c.items && c.items.length > 0).length,
                    totalItems: cotizacionesConDetalles.reduce((sum, c) => sum + (c.items?.length || 0), 0)
                });

                setCotizaciones(cotizacionesConDetalles);

                // Process pedidos with detalles
                const pedidosConDetalles = (pedidosData as any[]).map(p => {
                    const items = (pedidosDetalleData as any[]).filter(d => {
                        // Comparar IDs asegurándonos de que sean del mismo tipo
                        const pedidoId = String(p.id);
                        const detallePedidoId = String(d.pedidoId);
                        return pedidoId === detallePedidoId;
                    });
                    return {
                        ...p,
                        items: items
                    };
                });
                setPedidos(pedidosConDetalles);

                // Process remisiones with detalles
                logger.log({ prefix: 'DataContext', level: 'debug' }, 'Remisiones recibidas del backend:', remisionesData?.length || 0);
                logger.log({ prefix: 'DataContext', level: 'debug' }, 'Detalles de remisiones recibidos:', remisionesDetalleData?.length || 0);

                // Mapear remisiones con sus items de productos
                const remisionesConDetalles = (remisionesData as any[]).map(r => {
                    // Buscar items que pertenezcan a esta remisión
                    // Usar id, numrec o remisionId para hacer el match
                    const remisionIdStr = String(r.id || r.numrec || '');
                    const remisionNumrec = r.numrec;
                    const items = (remisionesDetalleData as any[]).filter(d => {
                        const detalleRemisionId = String(d.remisionId || d.numrec || '');
                        const detalleNumrec = d.numrec;
                        // Match por ID o por numrec
                        return detalleRemisionId === remisionIdStr ||
                            (remisionNumrec && detalleNumrec && String(remisionNumrec) === String(detalleNumrec));
                    }).map(d => ({
                        // Mapear campos del detalle de remisión a la estructura esperada
                        productoId: d.productoId || null,
                        cantidad: Number(d.cantidad) || Number(d.cantidadEnviada) || 0,
                        cantidadEnviada: Number(d.cantidadEnviada) || Number(d.cantidad) || 0,
                        cantidadFacturada: Number(d.cantidadFacturada) || 0,
                        cantidadDevuelta: Number(d.cantidadDevuelta) || 0,
                        precioUnitario: Number(d.precioUnitario) || 0,
                        descuentoPorcentaje: Number(d.descuentoPorcentaje) || 0,
                        ivaPorcentaje: Number(d.ivaPorcentaje) || 0,
                        descripcion: d.descripcion || '',
                        subtotal: Number(d.subtotal) || 0,
                        valorIva: Number(d.valorIva) || 0,
                        total: Number(d.total) || 0,
                        codProducto: d.codProducto || ''
                    }));

                    // Mapear campos de la remisión a la estructura esperada por el frontend
                    return {
                        id: String(r.id || r.numrec || ''),
                        numeroRemision: r.numeroRemision || `REM-${String(r.numrec || '').padStart(4, '0')}`,
                        fechaRemision: r.fechaRemision || (r.fecrec ? new Date(r.fecrec).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
                        pedidoId: r.pedidoId ? String(r.pedidoId) : undefined,
                        facturaId: r.facturaId || undefined,
                        clienteId: r.clienteId || r.codter || '',
                        codter: r.codter || r.clienteId || '',
                        vendedorId: r.vendedorId || r.codVendedor || undefined,
                        codVendedor: r.codVendedor || r.CODVEN || r.vendedorId || undefined,
                        subtotal: Number(r.subtotal) || 0,
                        descuentoValor: Number(r.descuentoValor) || 0,
                        ivaValor: Number(r.ivaValor) || 0,
                        total: Number(r.total) || 0,
                        observaciones: r.observaciones || r.observa || '',
                        // Mapear estado: si viene como 'D' de la BD, convertirlo a 'ENTREGADO'
                        estado: (() => {
                            const estadoRaw = r.estado || 'BORRADOR';
                            const estadoStr = String(estadoRaw).trim().toUpperCase();
                            // Si viene como 'D' (código de BD), mapear a 'ENTREGADO'
                            if (estadoStr === 'D') return 'ENTREGADO';
                            // Si ya viene como 'ENTREGADO', mantenerlo
                            if (estadoStr === 'ENTREGADO') return 'ENTREGADO';
                            // Para otros estados, usar el mapeo estándar o el valor original
                            return estadoRaw;
                        })(),
                        empresaId: r.empresaId || r.codalm || '001',
                        codalm: r.codalm || r.empresaId || '001',
                        items: items.length > 0 ? items : [],
                        // Campos opcionales
                        estadoEnvio: r.estadoEnvio || undefined,
                        metodoEnvio: r.metodoEnvio || undefined,
                        transportadoraId: r.transportadoraId || undefined,
                        transportadora: r.transportadora || undefined,
                        numeroGuia: r.numeroGuia || undefined,
                        fechaDespacho: r.fechaDespacho || undefined,
                        fechaCreacion: r.fechaCreacion || r.fecsys || undefined,
                        codUsuario: r.codUsuario || r.codusu || undefined
                    };
                });

                logger.log({ prefix: 'DataContext', level: 'debug' }, 'Remisiones procesadas con detalles:', remisionesConDetalles.length);
                logger.log({ prefix: 'DataContext', level: 'debug' }, 'Ejemplo de remisión procesada:', remisionesConDetalles[0] ? {
                    id: remisionesConDetalles[0].id,
                    numeroRemision: remisionesConDetalles[0].numeroRemision,
                    pedidoId: remisionesConDetalles[0].pedidoId,
                    clienteId: remisionesConDetalles[0].clienteId,
                    itemsCount: remisionesConDetalles[0].items?.length || 0
                } : 'No hay remisiones');

                setRemisiones(remisionesConDetalles);

                setNotasCredito(notasCreditoData);

                setArchivosAdjuntos([]);
            } catch (error) {
                logger.error({ prefix: 'DataContext' }, 'Error cargando datos transaccionales:', error);
            }
        };

        if (!isLoading && !isMainDataLoaded) {
            fetchMainTransactionalData();
        }
    }, [isLoading, isMainDataLoaded, medidas, selectedSede?.codigo]);

    // Recargar productos cuando cambie la bodega seleccionada (useEffect independiente)
    // IMPORTANTE: Usar useRef para evitar recargas múltiples de la misma bodega
    const lastLoadedSedeRef = useRef<string | null>(null);
    const isLoadingProductsRef = useRef<boolean>(false);

    useEffect(() => {
        // Solo proceder si hay una bodega seleccionada y tenemos las medidas cargadas
        if (!selectedSede?.codigo || !medidas || medidas.length === 0) {
            // Si no hay bodega seleccionada, limpiar productos o mantener los actuales
            lastLoadedSedeRef.current = null; // Reset cuando no hay bodega
            return;
        }

        const codalm = String(selectedSede.codigo).padStart(3, '0');
        const sedeKey = `${selectedSede.id}-${codalm}`;

        // Evitar recargar si ya cargamos esta bodega O si ya estamos cargando
        if (lastLoadedSedeRef.current === sedeKey || isLoadingProductsRef.current) {
            logger.log({ prefix: 'DataContext', level: 'debug' }, 'Productos ya cargados o cargando para esta bodega, omitiendo recarga:', {
                codalm,
                nombre: selectedSede.nombre,
                yaCargado: lastLoadedSedeRef.current === sedeKey,
                cargando: isLoadingProductsRef.current
            });
            return;
        }

        // Marcar que estamos cargando esta bodega
        lastLoadedSedeRef.current = sedeKey;
        isLoadingProductsRef.current = true;

        logger.log({ prefix: 'DataContext', level: 'debug' }, 'Recargando productos para bodega:', {
            codalm,
            nombre: selectedSede.nombre,
            id: selectedSede.id
        });

        fetchProductos(codalm).then(productosResponse => {
            isLoadingProductsRef.current = false;
            if (productosResponse.success) {
                // Helper para extraer datos de estructura anidada
                const extractArrayData = (response: any): any[] => {
                    if (!response.success) return [];
                    const raw = response.data;
                    if (Array.isArray(raw)) return raw;
                    if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as any).data)) {
                        return (raw as any).data;
                    }
                    return [];
                };
                const productosData = extractArrayData(productosResponse);
                const productosConMedida = (productosData as any[]).map((p: InvProducto) => {
                    const unidadMedidaNombre = medidas.find((m) => m.id === p.idMedida)?.nombre || 'Unidad';
                    const precioVenta = Number(
                        (p as any).precio ?? (p as any).precioPublico ?? (p as any).precioMayorista ?? (p as any).precioMinorista ?? (p as any).ultimoCosto ?? 0
                    );
                    return {
                        ...p,
                        unidadMedida: unidadMedidaNombre,
                        precio: precioVenta,
                        precioPublico: Number((p as any).precioPublico ?? precioVenta),
                        precioMayorista: Number((p as any).precioMayorista ?? 0),
                        precioMinorista: Number((p as any).precioMinorista ?? 0),
                        ultimoCosto: Number((p as any).ultimoCosto ?? 0),
                        stock: Number(p.stock ?? 0),
                        controlaExistencia: Number(p.stock ?? p.controlaExistencia ?? 0)
                    } as InvProducto;
                });
                productosConMedida.sort((a: InvProducto, b: InvProducto) => (a.nombre || '').trim().localeCompare((b.nombre || '').trim()));
                setProductos(productosConMedida);
                logger.log({ prefix: 'DataContext', level: 'debug' }, 'Productos recargados para bodega:', {
                    codalm,
                    cantidad: productosConMedida.length
                });
            } else {
                logger.warn({ prefix: 'DataContext' }, 'No se pudieron cargar productos para la bodega:', codalm);
            }
        }).catch(error => {
            isLoadingProductsRef.current = false;
            logger.error({ prefix: 'DataContext' }, 'Error actualizando productos por bodega:', error);
            // Si hay error, resetear la referencia para permitir reintento
            if (lastLoadedSedeRef.current === sedeKey) {
                lastLoadedSedeRef.current = null;
            }
        });
    }, [selectedSede?.codigo, selectedSede?.id, medidas]);

    // Definir refreshData ANTES del useEffect que lo usa
    // IMPORTANTE: refreshData NO debe depender de selectedSede para evitar bucles
    const refreshData = useCallback(async (codalmOverride?: string) => {
        setIsMainDataLoaded(false);
        setIsLoading(true);

        // Helper para extraer datos de estructura anidada
        const extractArrayData = (response: any): any[] => {
            if (!response.success) return [];
            const raw = response.data;
            if (Array.isArray(raw)) return raw;
            if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as any).data)) {
                return (raw as any).data;
            }
            return [];
        };

        // Reload essential catalogs
        try {
            const medidasResponse = await fetchMedidas();
            if (medidasResponse.success) {
                const medidasData = extractArrayData(medidasResponse);
                if (medidasData.length > 0) {
                    setMedidas(medidasData);
                }
            }

            const categoriasResponse = await fetchCategorias();
            if (categoriasResponse.success) {
                const categoriasData = extractArrayData(categoriasResponse);
                if (categoriasData.length > 0) {
                    setCategorias(categoriasData);
                }
            }

            // Recargar productos con filtro de bodega actual o el override
            // Usar codalmOverride si está disponible, sino usar selectedSede?.codigo
            const codalm = codalmOverride || (selectedSede?.codigo ? String(selectedSede.codigo).padStart(3, '0') : undefined);
            const productosResponse = await fetchProductos(codalm);
            if (productosResponse.success) {
                const productosData = extractArrayData(productosResponse);
                const productosConMedida = (productosData as any[]).map((p: InvProducto) => ({
                    ...p,
                    unidadMedida: medidas.find((m) => m.id === p.idMedida)?.nombre || 'Unidad',
                    stock: p.stock ?? 0,
                    controlaExistencia: p.stock ?? p.controlaExistencia ?? 0
                }));
                productosConMedida.sort((a: InvProducto, b: InvProducto) => (a.nombre || '').trim().localeCompare((b.nombre || '').trim()));
                setProductos(productosConMedida);
            }

            setIsLoading(false);
        } catch (error) {
            logger.error({ prefix: 'refreshData' }, 'Error refreshing data:', error);
            setIsLoading(false);
        }
    }, [medidas]); // Removido selectedSede?.codigo para evitar bucle

    // ✅ ELIMINADO: useEffect que recargaba todos los datos al cambiar bodega
    // Esto causaba un bucle infinito porque:
    // 1. selectedSede cambia -> useEffect se dispara
    // 2. refreshData() se llama -> actualiza productos
    // 3. Esto causa re-render -> useEffect se dispara de nuevo
    // Los productos ya se recargan automáticamente en el useEffect independiente más abajo
    // cuando cambia selectedSede?.codigo, así que no necesitamos este efecto redundante

    // --- COMPUTED DATA FUNCTIONS ---

    const getSalesDataByPeriod = useCallback((start: Date, end: Date) => {
        const salesData: Array<{ date: string; sales: number }> = [];
        const currentDate = new Date(start);
        currentDate.setHours(0, 0, 0, 0);

        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);

        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const currentDayStart = new Date(currentDate);
            currentDayStart.setHours(0, 0, 0, 0);
            const currentDayEnd = new Date(currentDate);
            currentDayEnd.setHours(23, 59, 59, 999);

            const daySales = facturas
                .filter(f => {
                    if (!f.fechaFactura) return false;
                    const fechaFactura = new Date(f.fechaFactura);
                    fechaFactura.setHours(0, 0, 0, 0);
                    return fechaFactura >= currentDayStart &&
                        fechaFactura <= currentDayEnd &&
                        f.estado !== 'ANULADA' &&
                        f.estado !== 'BORRADOR';
                })
                .reduce((total, factura) => {
                    const devolucionesTotal = notasCredito
                        .filter(nc => String(nc.facturaId) === String(factura.id))
                        .reduce((sum, nc) => sum + (nc.total || 0), 0);
                    return total + ((factura.total || 0) - devolucionesTotal);
                }, 0);

            salesData.push({ date: dateStr, sales: Math.round(daySales) });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return salesData;
    }, [facturas, notasCredito]);

    const getSalesByCliente = useCallback(() => {
        const salesMap = new Map<string, { totalSales: number; orderCount: number; lastOrder: string }>();

        facturas
            .filter(f => f.estado !== 'ANULADA' && f.estado !== 'BORRADOR')
            .forEach(f => {
                const clienteKey = String(f.clienteId ?? '').trim();
                if (!clienteKey) {
                    return;
                }

                const devolucionesTotal = notasCredito
                    .filter(nc => String(nc.facturaId) === String(f.id))
                    .reduce((sum, nc) => sum + (nc.total || 0), 0);

                const totalNeto = (f.total || 0) - devolucionesTotal;
                const current = salesMap.get(clienteKey) ?? { totalSales: 0, orderCount: 0, lastOrder: f.fechaFactura };

                current.totalSales += totalNeto;
                current.orderCount += 1;
                if (f.fechaFactura && (!current.lastOrder || f.fechaFactura > current.lastOrder)) {
                    current.lastOrder = f.fechaFactura;
                }

                salesMap.set(clienteKey, current);
            });

        const findClienteNombre = (clientId: string): string => {
            const cliente = clientes.find(c => {
                const idStr = String(c.id ?? '').trim();
                const numeroDocumento = String((c as any).numeroDocumento ?? '').trim();
                const codter = String((c as any).codter ?? '').trim();
                return clientId === idStr || clientId === numeroDocumento || clientId === codter;
            });
            return cliente?.nombreCompleto || cliente?.razonSocial || (cliente as any)?.nombre || 'Desconocido';
        };

        return Array.from(salesMap.entries())
            .map(([clientId, salesData]) => ({
                id: clientId,
                clientName: findClienteNombre(clientId),
                totalSales: salesData.totalSales,
                orderCount: salesData.orderCount,
                lastOrder: salesData.lastOrder
            }))
            .sort((a, b) => b.totalSales - a.totalSales);
    }, [facturas, notasCredito, clientes]);

    const getSalesByVendedor = useCallback(() => {
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

        const vendedorSales = facturas
            .filter(f => {
                // Filtrar facturas del mes actual y válidas
                const fechaFactura = new Date(f.fechaFactura);
                return fechaFactura >= firstDayOfMonth &&
                    f.estado !== 'ANULADA' &&
                    f.estado !== 'BORRADOR' &&
                    f.estado !== 'BORRADOR';
            })
            .reduce((acc, f) => {
                // Buscar vendedor de forma flexible (por id, codiEmple, o codigoVendedor)
                let vendedorEncontrado = null;
                if (f.vendedorId) {
                    const vendedorIdStr = String(f.vendedorId).trim();
                    vendedorEncontrado = vendedores.find(v =>
                        String(v.id) === vendedorIdStr ||
                        String(v.codiEmple || '') === vendedorIdStr ||
                        String(v.codigoVendedor || '') === vendedorIdStr ||
                        String(v.codigo || '') === vendedorIdStr
                    );
                }

                const vendedorKey = vendedorEncontrado
                    ? String(vendedorEncontrado.id || vendedorEncontrado.codiEmple || 'sin_vendedor')
                    : 'sin_vendedor';

                if (!acc[vendedorKey]) {
                    acc[vendedorKey] = {
                        totalSales: 0,
                        orderCount: 0,
                        vendedor: vendedorEncontrado
                    };
                }

                const devolucionesTotal = notasCredito
                    .filter(nc => String(nc.facturaId) === String(f.id))
                    .reduce((sum, nc) => sum + (nc.total || 0), 0);

                acc[vendedorKey].totalSales += (f.total || 0) - devolucionesTotal;
                acc[vendedorKey].orderCount += 1;

                return acc;
            }, {} as Record<string, { totalSales: number; orderCount: number; vendedor: any }>);

        return Object.entries(vendedorSales)
            .map(([vendedorKey, salesData]) => {
                const vendedor = salesData.vendedor;
                const nombreVendedor = vendedor
                    ? `${vendedor.primerNombre || ''} ${vendedor.primerApellido || ''}`.trim() || vendedor.nombre || 'Sin Nombre'
                    : 'Sin Vendedor';

                return {
                    id: vendedorKey,
                    name: nombreVendedor,
                    totalSales: salesData.totalSales,
                    orderCount: salesData.orderCount
                };
            })
            .sort((a, b) => b.totalSales - a.totalSales);
    }, [facturas, notasCredito, vendedores]);

    const getTopProductos = useCallback((limit = 5) => {
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        firstDayOfMonth.setHours(0, 0, 0, 0);

        // Filtrar facturas del mes actual, válidas y con items
        const facturasValidas = facturas.filter(f => {
            if (!f.fechaFactura) return false;
            const fechaFactura = new Date(f.fechaFactura);
            fechaFactura.setHours(0, 0, 0, 0);
            return fechaFactura >= firstDayOfMonth &&
                f.estado !== 'ANULADA' &&
                f.estado !== 'BORRADOR' &&
                f.items &&
                Array.isArray(f.items) &&
                f.items.length > 0;
        });

        const facturasConItems = facturasValidas.filter(f => f.items && f.items.length > 0);
        const totalItems = facturasConItems.reduce((sum, f) => sum + (f.items?.length || 0), 0);

        logger.log({ prefix: 'getTopProductos', level: 'debug' }, 'Facturas válidas del mes:', {
            totalFacturas: facturas.length,
            facturasValidas: facturasValidas.length,
            facturasConItems: facturasConItems.length,
            totalItems: totalItems,
            primeraFactura: facturasValidas[0] ? {
                id: facturasValidas[0].id,
                fechaFactura: facturasValidas[0].fechaFactura,
                estado: facturasValidas[0].estado,
                tieneItems: !!(facturasValidas[0].items && facturasValidas[0].items.length > 0),
                itemsCount: facturasValidas[0].items?.length || 0
            } : null
        });

        // Agrupar ventas por producto
        const itemsValidos = facturasConItems
            .flatMap(f => f.items || [])
            .filter(item => {
                const tieneProductoId = item.productoId != null && item.productoId !== undefined;
                const tieneCantidad = item.cantidad != null && Number(item.cantidad) > 0;
                if (!tieneProductoId || !tieneCantidad) {
                    logger.log({ prefix: 'getTopProductos', level: 'debug' }, 'Item inválido:', {
                        tieneProductoId,
                        tieneCantidad,
                        productoId: item.productoId,
                        cantidad: item.cantidad
                    });
                }
                return tieneProductoId && tieneCantidad;
            });

        logger.log({ prefix: 'getTopProductos', level: 'debug' }, 'Items válidos:', {
            totalItems: itemsValidos.length,
            primerosItems: itemsValidos.slice(0, 3).map(item => ({
                productoId: item.productoId,
                cantidad: item.cantidad
            }))
        });

        const productSales = itemsValidos.reduce((acc, item) => {
            const productoId = Number(item.productoId);
            if (!isNaN(productoId) && productoId > 0) {
                const cantidad = Number(item.cantidad || 0);
                acc[productoId] = (acc[productoId] || 0) + cantidad;
            }
            return acc;
        }, {} as Record<number, number>);

        logger.log({ prefix: 'getTopProductos', level: 'debug' }, 'Ventas por producto:', {
            productosConVentas: Object.keys(productSales).length,
            totalProductos: productos.length,
            productosIds: Object.keys(productSales).slice(0, 10)
        });

        const resultados = Object.entries(productSales)
            .map(([productoId, cantidad]) => {
                const producto = productos.find(p => {
                    const pId = Number(p.id);
                    const itemId = Number(productoId);
                    return pId === itemId;
                });
                return {
                    producto,
                    cantidad: Number(cantidad),
                    productoId: Number(productoId)
                };
            })
            .filter((item): item is { producto: InvProducto; cantidad: number; productoId: number } => Boolean(item.producto))
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, limit);

        logger.log({ prefix: 'getTopProductos', level: 'debug' }, 'Top productos resultantes:', {
            cantidad: resultados.length,
            productos: resultados.map(r => ({ nombre: r.producto.nombre, cantidad: r.cantidad }))
        });

        return resultados;
    }, [facturas, productos]);

    const getGlobalSearchResults = useCallback((query: string): GlobalSearchResults => {
        if (!query || typeof query !== 'string' || !query.trim()) {
            return {
                cotizaciones: [],
                pedidos: [],
                facturas: [],
                remisiones: [],
                productos: [],
                clientes: []
            };
        }

        const searchTerm = String(query).toLowerCase().trim();

        // Función helper para hacer búsqueda segura con toLowerCase
        const safeToLowerCase = (value: any): string => {
            if (value === null || value === undefined) return '';
            return String(value).toLowerCase();
        };

        // Función helper para buscar en cliente
        const findClienteNombre = (clienteId: string | number | undefined): string => {
            if (!clienteId) return '';
            if (!Array.isArray(clientes) || clientes.length === 0) return '';
            const cliente = clientes.find(cli => {
                if (!cli) return false;
                // Comparar IDs como strings para evitar problemas de tipo
                return String(cli.id || '') === String(clienteId || '');
            });
            return cliente?.nombreCompleto ? String(cliente.nombreCompleto).toLowerCase() : '';
        };

        // Función helper para obtener número de documento (soporta diferentes nombres de propiedad)
        const getNumeroDocumento = (item: any, ...fieldNames: string[]): string => {
            for (const fieldName of fieldNames) {
                if (item?.[fieldName]) {
                    return safeToLowerCase(item[fieldName]);
                }
            }
            return '';
        };

        const results: GlobalSearchResults = {
            cotizaciones: (Array.isArray(cotizaciones) ? cotizaciones : []).filter(c => {
                if (!c) return false;
                // Intentar múltiples nombres de propiedad para compatibilidad
                const numeroCotizacion = getNumeroDocumento(c, 'numeroCotizacion', 'numcot', 'numero_cotizacion');
                const clienteNombre = findClienteNombre(c.clienteId || (c as any).codter || (c as any).cliente_id);
                return numeroCotizacion.includes(searchTerm) || clienteNombre.includes(searchTerm);
            }).slice(0, 5),

            pedidos: (Array.isArray(pedidos) ? pedidos : []).filter(p => {
                if (!p) return false;
                const numeroPedido = getNumeroDocumento(p, 'numeroPedido', 'numero_pedido', 'numeroPedido');
                const clienteNombre = findClienteNombre(p.clienteId || (p as any).cliente_id);
                return numeroPedido.includes(searchTerm) || clienteNombre.includes(searchTerm);
            }).slice(0, 5),

            facturas: (Array.isArray(facturas) ? facturas : []).filter(f => {
                if (!f) return false;
                const numeroFactura = getNumeroDocumento(f, 'numeroFactura', 'numero_factura', 'numeroFactura');
                const clienteNombre = findClienteNombre(f.clienteId || (f as any).cliente_id);
                return numeroFactura.includes(searchTerm) || clienteNombre.includes(searchTerm);
            }).slice(0, 5),

            remisiones: (Array.isArray(remisiones) ? remisiones : []).filter(r => {
                if (!r) return false;
                const numeroRemision = getNumeroDocumento(r, 'numeroRemision', 'numero_remision', 'numeroRemision');
                const clienteNombre = findClienteNombre(r.clienteId || (r as any).cliente_id);
                return numeroRemision.includes(searchTerm) || clienteNombre.includes(searchTerm);
            }).slice(0, 5),

            productos: (Array.isArray(productos) ? productos : []).filter(p => {
                if (!p) return false;
                const nombre = safeToLowerCase(p.nombre || p.nomins);
                const codigo = safeToLowerCase((p as any).codigo || p.codins);
                const referencia = safeToLowerCase(p.referencia);
                return nombre.includes(searchTerm) ||
                    codigo.includes(searchTerm) ||
                    referencia.includes(searchTerm);
            }).slice(0, 5),

            clientes: (Array.isArray(clientes) ? clientes : []).filter(c => {
                if (!c) return false;
                const nombreCompleto = safeToLowerCase(c.nombreCompleto || c.razonSocial || c.nomter);
                const numeroDocumento = safeToLowerCase(c.numeroDocumento || (c as any).codter || (c as any).numero_documento);
                return nombreCompleto.includes(searchTerm) || numeroDocumento.includes(searchTerm);
            }).slice(0, 5)
        };

        return results;
    }, [cotizaciones, pedidos, facturas, remisiones, productos, clientes]);

    // --- ACTION FUNCTIONS ---

    const addActivityLog = useCallback((action: string, details: string, entity: { type: string; id: string | number; name: string }) => {
        if (!user) return;

        const newLog: ActivityLog = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            user: {
                id: user.id,
                nombre: user.primerNombre,
                rol: user.rol
            },
            action,
            details,
            entity
        };

        setActivityLog(prev => [newLog, ...prev.slice(0, 99)]);

        // Save to localStorage
        try {
            const updatedLog = [newLog, ...activityLog.slice(0, 99)];
            localStorage.setItem('erp360_activityLog', JSON.stringify(updatedLog));
        } catch (error) {
            logger.error({ prefix: 'addActivityLog' }, 'Error saving activity log:', error);
        }
    }, [user, activityLog]);

    const ingresarStockProducto = useCallback(async (
        productoId: number,
        cantidad: number,
        motivo: string,
        usuarioResponsable: Usuario,
        costoUnitario: number = 0,
        documentoReferencia?: string
    ): Promise<InvProducto> => {
        if (!productoId) {
            throw new Error('Debe seleccionar un producto válido.');
        }
        if (!cantidad || cantidad <= 0) {
            throw new Error('La cantidad debe ser mayor a cero.');
        }
        if (!usuarioResponsable) {
            throw new Error('No hay información del usuario que registra la entrada.');
        }

        const codalm = selectedSede?.codigo
            ? String(selectedSede.codigo).padStart(3, '0')
            : '001';

        const payload = {
            productoId,
            cantidad,
            costoUnitario,
            motivo,
            documentoReferencia,
            codalm,
            usuario: {
                id: usuarioResponsable.id,
                nombre: usuarioResponsable.nombre || `${usuarioResponsable.primerNombre || ''} ${usuarioResponsable.primerApellido || ''}`.trim(),
                rol: usuarioResponsable.rol,
                username: usuarioResponsable.username
            }
        };

        const response = await apiRegisterInventoryEntry(payload);

        if (!response.success) {
            throw new Error(response.message || response.error || 'No se pudo registrar la entrada de inventario.');
        }

        const movimiento = (response.data as any)?.movimiento ?? null;
        const productoRespuesta = (response.data as any)?.producto ?? response.data;
        if (!productoRespuesta) {
            throw new Error('La respuesta del servidor no contiene la información del producto actualizado.');
        }

        const productoCamel = convertKeysToCamelCase(productoRespuesta);
        const productoExistente = productos.find(p => String(p.id) === String(productoId));

        const unidadMedidaNombre = medidas.find((m) => m.id === productoCamel.idMedida)?.nombre
            || productoExistente?.unidadMedida
            || 'Unidad';

        const precioVentaActualizado = Number(
            (productoCamel as any).precio ?? (productoCamel as any).precioPublico ?? (productoCamel as any).precioMayorista ?? (productoCamel as any).precioMinorista ?? (productoCamel as any).ultimoCosto ?? productoExistente?.precio ?? 0
        );

        const productoNormalizado: InvProducto = {
            ...(productoExistente || {} as InvProducto),
            ...productoCamel,
            id: Number(productoCamel.id ?? productoId),
            codins: productoCamel.codins || (productoCamel as any).codigo || productoExistente?.codins || (productoExistente as any)?.codigo || '',
            nombre: productoCamel.nombre || productoCamel.nomins || productoExistente?.nombre || '',
            nomins: productoCamel.nomins || productoCamel.nombre || productoExistente?.nomins || productoCamel.nombre || '',
            unidadMedida: unidadMedidaNombre,
            stock: productoCamel.stock ?? productoExistente?.stock ?? 0,
            controlaExistencia: productoCamel.stock ?? productoExistente?.controlaExistencia ?? 0,
            precioInventario: productoCamel.precioInventario ?? productoExistente?.precioInventario ?? 0,
            precio: precioVentaActualizado,
            ultimoCosto: Number((productoCamel as any).ultimoCosto ?? productoExistente?.ultimoCosto ?? 0)
        };

        setProductos(prev => {
            const updated = prev.some(p => String(p.id) === String(productoNormalizado.id))
                ? prev.map(p => String(p.id) === String(productoNormalizado.id) ? productoNormalizado : p)
                : [...prev, productoNormalizado];
            return [...updated].sort((a, b) => (a.nombre || '').trim().localeCompare((b.nombre || '').trim()));
        });

        const cantidadRegistrada = Number(movimiento?.cantidad ?? cantidad);
        const costoRegistrado = Number(movimiento?.costoUnitario ?? costoUnitario ?? 0);
        const valorRegistrado = Number(movimiento?.valorTotal ?? (costoRegistrado * cantidadRegistrada));
        const referenciaRegistrada = String(movimiento?.documentoReferencia ?? documentoReferencia ?? '').trim();
        const motivoRegistrado = String(movimiento?.motivo ?? motivo ?? '').trim();

        const detallesPayload = {
            cantidad: Number.isFinite(cantidadRegistrada) ? cantidadRegistrada : cantidad,
            costoUnitario: Number.isFinite(costoRegistrado) ? costoRegistrado : 0,
            valorTotal: Number.isFinite(valorRegistrado) ? valorRegistrado : (cantidadRegistrada || cantidad) * (costoRegistrado || costoUnitario || 0),
            referencia: referenciaRegistrada || null,
            motivo: motivoRegistrado || null
        };
        const detallesLog = JSON.stringify(detallesPayload);

        try {
            addActivityLog(
                'Entrada de Inventario',
                detallesLog,
                {
                    type: 'Producto',
                    id: productoNormalizado.id,
                    name: productoNormalizado.nombre || productoNormalizado.nomins || productoNormalizado.codins || `Producto ${productoNormalizado.id}`
                }
            );
        } catch (logError) {
            logger.warn({ prefix: 'ingresarStockProducto' }, 'No se pudo registrar en el activity log:', logError);
        }

        return productoNormalizado;
    }, [selectedSede?.codigo, productos, medidas, addActivityLog]);

    // Función específica para recargar facturas y remisiones después de timbrar una factura
    const refreshFacturasYRemisiones = useCallback(async () => {
        try {
            const [
                facturasResponse,
                facturasDetalleResponse,
                remisionesResponse,
                remisionesDetalleResponse
            ] = await Promise.all([
                fetchFacturas(),
                fetchFacturasDetalle(),
                fetchRemisiones(),
                fetchRemisionesDetalle()
            ]);

            // Helper para extraer datos de estructura anidada
            const extractData = (response: any): any[] => {
                if (!response.success) return [];
                const raw = response.data;
                if (Array.isArray(raw)) return raw;
                if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as any).data)) {
                    return (raw as any).data;
                }
                return [];
            };

            const facturasData = extractData(facturasResponse);
            const facturasDetalleData = extractData(facturasDetalleResponse);
            const remisionesData = extractData(remisionesResponse);
            const remisionesDetalleData = extractData(remisionesDetalleResponse);

            // Process facturas with detalles
            const facturasConDetalles = (facturasData as any[]).map(f => {
                // Procesar remisionesIds: puede venir como string separado por comas o como array
                let remisionesIds: string[] = [];
                if (f.remisionesIds) {
                    if (Array.isArray(f.remisionesIds)) {
                        remisionesIds = f.remisionesIds.map((id: any) => String(id));
                    } else if (typeof f.remisionesIds === 'string' && f.remisionesIds.trim()) {
                        remisionesIds = f.remisionesIds.split(',').map((id: string) => id.trim()).filter((id: string) => id.length > 0);
                    }
                }
                // Si no hay remisionesIds pero hay remisionId (singular), usarlo
                if (remisionesIds.length === 0 && f.remisionId) {
                    remisionesIds = [String(f.remisionId)];
                }

                // Buscar items que pertenezcan a esta factura (matching flexible por ID)
                const facturaIdStr = String(f.id || f.ID || '');
                const items = (facturasDetalleData as any[]).filter(d => {
                    const detalleFacturaId = String(d.facturaId || d.factura_id || d.id_factura || '');
                    // Comparar tanto por ID numérico como por string
                    return facturaIdStr === detalleFacturaId ||
                        (facturaIdStr && detalleFacturaId && parseInt(facturaIdStr, 10) === parseInt(detalleFacturaId, 10));
                }).map(d => ({
                    // Mapear campos del detalle a la estructura esperada
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
                }));

                return {
                    ...f,
                    items: items,
                    remisionesIds: remisionesIds,
                    estadoDevolucion: f.estadoDevolucion || f.estado_devolucion || undefined
                };
            });

            logger.log({ prefix: 'refreshFacturasYRemisiones', level: 'debug' }, 'Facturas procesadas con detalles:', {
                facturasCount: facturasConDetalles.length,
                facturasConItems: facturasConDetalles.filter(f => f.items && f.items.length > 0).length,
                totalItems: facturasConDetalles.reduce((sum, f) => sum + (f.items?.length || 0), 0)
            });

            setFacturas(facturasConDetalles);

            // Process remisiones with detalles
            const remisionesConDetalles = (remisionesData as any[]).map(r => {
                const items = (remisionesDetalleData as any[]).filter(d => {
                    const remisionId = String(r.id || r.numrec || '');
                    const detalleRemisionId = String(d.remisionId || d.numrec || '');
                    const remisionNumrec = r.numrec;
                    const detalleNumrec = d.numrec;
                    // Match por ID o por numrec
                    return remisionId === detalleRemisionId ||
                        (remisionNumrec && detalleNumrec && String(remisionNumrec) === String(detalleNumrec));
                }).map(d => {
                    // Mapear campos del detalle de remisión a la estructura esperada
                    return {
                        productoId: d.productoId || d.producto_id || d.codins || d.codProducto || 0,
                        codProducto: d.codProducto || d.cod_producto || d.codins || '',
                        cantidad: Number(d.cantidad || d.cantidadEnviada || d.cantidad_enviada || 0),
                        cantidadEnviada: Number(d.cantidadEnviada || d.cantidad_enviada || d.cantidad || 0),
                        cantidadFacturada: Number(d.cantidadFacturada || d.cantidad_facturada || 0),
                        cantidadDevuelta: Number(d.cantidadDevuelta || d.cantidad_devuelta || 0),
                        precioUnitario: Number(d.precioUnitario || d.precio_unitario || d.valorUnitario || d.valor_unitario || 0),
                        descuentoPorcentaje: Number(d.descuentoPorcentaje || d.descuento_porcentaje || d.descuentoPorc || 0),
                        ivaPorcentaje: Number(d.ivaPorcentaje || d.iva_porcentaje || d.ivaPorc || 0),
                        subtotal: Number(d.subtotal || d.sub_total || 0),
                        valorIva: Number(d.valorIva || d.valor_iva || d.ivaValor || d.iva_valor || 0),
                        total: Number(d.total || 0),
                        descripcion: d.descripcion || d.descrip || d.nombre || `Producto ${d.productoId || d.producto_id || ''}`,
                        remisionId: d.remisionId || d.remision_id || d.numrec || r.id || r.numrec,
                        detaPedidoId: d.detaPedidoId || d.deta_pedido_id || null
                    };
                });

                // Mapear estado: si viene como 'D' de la BD, convertirlo a 'ENTREGADO'
                const estadoMapeado = (() => {
                    const estadoRaw = r.estado || 'BORRADOR';
                    const estadoStr = String(estadoRaw).trim().toUpperCase();
                    // Si viene como 'D' (código de BD), mapear a 'ENTREGADO'
                    if (estadoStr === 'D') return 'ENTREGADO';
                    // Si ya viene como 'ENTREGADO', mantenerlo
                    if (estadoStr === 'ENTREGADO') return 'ENTREGADO';
                    // Para otros estados, usar el mapeo estándar o el valor original
                    return estadoRaw;
                })();

                return {
                    ...r,
                    estado: estadoMapeado,
                    items: items
                };
            });
            setRemisiones(remisionesConDetalles);

            logger.log({ prefix: 'refreshFacturasYRemisiones' }, 'Facturas y remisiones recargadas:', {
                facturas: facturasConDetalles.length,
                remisiones: remisionesConDetalles.length
            });
        } catch (error) {
            logger.error({ prefix: 'refreshFacturasYRemisiones' }, 'Error recargando facturas y remisiones:', error);
        }
    }, []);

    // Función específica para recargar pedidos y remisiones después de crear una remisión
    const refreshPedidosYRemisiones = useCallback(async () => {
        try {
            const [
                pedidosResponse,
                pedidosDetalleResponse,
                remisionesResponse,
                remisionesDetalleResponse
            ] = await Promise.all([
                fetchPedidos(),
                fetchPedidosDetalle(),
                fetchRemisiones(),
                fetchRemisionesDetalle()
            ]);

            // Helper para extraer datos de estructura anidada
            const extractData = (response: any): any[] => {
                if (!response.success) return [];
                const raw = response.data;
                if (Array.isArray(raw)) return raw;
                if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as any).data)) {
                    return (raw as any).data;
                }
                return [];
            };

            const pedidosData = extractData(pedidosResponse);
            const pedidosDetalleData = extractData(pedidosDetalleResponse);
            const remisionesData = extractData(remisionesResponse);
            const remisionesDetalleData = extractData(remisionesDetalleResponse);

            // Process pedidos with detalles
            const pedidosConDetalles = (pedidosData as any[]).map(p => {
                const items = (pedidosDetalleData as any[]).filter(d => {
                    const pedidoId = String(p.id);
                    const detallePedidoId = String(d.pedidoId);
                    return pedidoId === detallePedidoId;
                });
                return {
                    ...p,
                    items: items
                };
            });
            setPedidos(pedidosConDetalles);

            // Process remisiones with detalles
            const remisionesConDetalles = (remisionesData as any[]).map(r => {
                const items = (remisionesDetalleData as any[]).filter(d => {
                    const remisionId = String(r.id || r.numrec || '');
                    const detalleRemisionId = String(d.remisionId || d.numrec || '');
                    const remisionNumrec = r.numrec;
                    const detalleNumrec = d.numrec;
                    // Match por ID o por numrec
                    return remisionId === detalleRemisionId ||
                        (remisionNumrec && detalleNumrec && String(remisionNumrec) === String(detalleNumrec));
                }).map(d => {
                    // Mapear campos del detalle de remisión a la estructura esperada
                    return {
                        productoId: d.productoId || d.producto_id || d.codins || d.codProducto || 0,
                        codProducto: d.codProducto || d.cod_producto || d.codins || '',
                        cantidad: Number(d.cantidad || d.cantidadEnviada || d.cantidad_enviada || 0),
                        cantidadEnviada: Number(d.cantidadEnviada || d.cantidad_enviada || d.cantidad || 0),
                        cantidadFacturada: Number(d.cantidadFacturada || d.cantidad_facturada || 0),
                        cantidadDevuelta: Number(d.cantidadDevuelta || d.cantidad_devuelta || 0),
                        precioUnitario: Number(d.precioUnitario || d.precio_unitario || d.valorUnitario || d.valor_unitario || 0),
                        descuentoPorcentaje: Number(d.descuentoPorcentaje || d.descuento_porcentaje || d.descuentoPorc || 0),
                        ivaPorcentaje: Number(d.ivaPorcentaje || d.iva_porcentaje || d.ivaPorc || 0),
                        subtotal: Number(d.subtotal || d.sub_total || 0),
                        valorIva: Number(d.valorIva || d.valor_iva || d.ivaValor || d.iva_valor || 0),
                        total: Number(d.total || 0),
                        descripcion: d.descripcion || d.descrip || d.nombre || `Producto ${d.productoId || d.producto_id || ''}`,
                        remisionId: d.remisionId || d.remision_id || d.numrec || r.id || r.numrec,
                        detaPedidoId: d.detaPedidoId || d.deta_pedido_id || null
                    };
                });
                return {
                    ...r,
                    items: items
                };
            });
            setRemisiones(remisionesConDetalles);

            logger.log({ prefix: 'refreshPedidosYRemisiones' }, 'Pedidos y remisiones recargados:', {
                pedidos: pedidosConDetalles.length,
                remisiones: remisionesConDetalles.length
            });
        } catch (error) {
            logger.error({ prefix: 'refreshPedidosYRemisiones' }, 'Error recargando pedidos y remisiones:', error);
        }
    }, []);

    // --- MUTATIONS ---
    const crearCliente = useCallback(async (data: Partial<Cliente>) => {
        try {
            const resp = await apiCreateCliente({
                numeroDocumento: data.numeroDocumento,
                razonSocial: data.razonSocial,
                primerNombre: data.primerNombre,
                segundoNombre: data.segundoNombre,
                primerApellido: data.primerApellido,
                segundoApellido: data.segundoApellido,
                direccion: data.direccion,
                ciudadId: data.ciudadId,
                vendedorId: (data as any).vendedorId || data.codven,
                email: data.email,
                telefono: (data as any).telefono || data.telter,
                celular: data.celular || data.celter,
                diasCredito: data.diasCredito || 0,
                formaPago: (data as any).formaPago || 'CONTADO',
                regimenTributario: (data as any).regimenTributario || 'NO_RESPONSABLE_IVA',
            } as any);
            if (resp.success && resp.data) {
                await refreshData();
                const created = (resp.data as any);
                return { ...(data as any), id: String(created.id) } as Cliente;
            }
        } catch (e) {
            logger.error({ prefix: 'crearCliente' }, 'Error al crear cliente:', e);
        }
        return null;
    }, [refreshData]);

    const actualizarCliente = useCallback(async (id: string, data: Partial<Cliente>) => {
        logger.warn({ prefix: 'actualizarCliente' }, 'No implementado aún en backend');
        await refreshData();
        const found = clientes.find(c => c.id === id) || null;
        return found;
    }, [refreshData, clientes]);

    const datosEmpresa = useMemo(() => ({
        id: 1,
        nombre: 'Innovatech Colombia SAS',
        nit: '900.123.456-7',
        direccion: 'Avenida Siempre Viva 123',
        ciudad: 'Bogotá D.C.',
        telefono: '601-555-1234',
        resolucionDian: 'Res. DIAN No. 18760000001 de 2023-01-01',
        rangoNumeracion: 'FC-1 al FC-1000',
        regimen: 'Responsable de IVA'
    }), []);

    const getCotizacionById = useCallback((id: string) => cotizaciones.find(c => c.id === id), [cotizaciones]);

    const crearCotizacion = useCallback(async (data: Cotizacion): Promise<Cotizacion> => {
        try {
            const { apiCreateCotizacion } = await import('../services/apiClient');

            // Obtener código de bodega desde la bodega seleccionada en el header
            const bodegaCodigo = selectedSede?.codigo
                ? String(selectedSede.codigo).padStart(3, '0')
                : '001'; // Fallback si no hay bodega seleccionada

            if (!selectedSede) {
                logger.warn({ prefix: 'crearCotizacion' }, 'No hay bodega seleccionada, usando fallback:', bodegaCodigo);
            } else {
                logger.log({ prefix: 'crearCotizacion', level: 'debug' }, 'Usando bodega seleccionada:', selectedSede.nombre, 'Código:', bodegaCodigo);
            }

            // Buscar el cliente para obtener su codter (numeroDocumento)
            const cliente = clientes.find(c => c.id === data.clienteId || String(c.id) === String(data.clienteId));
            const clienteCodter = cliente?.numeroDocumento || (cliente as any)?.codter || data.clienteId;

            logger.log({ prefix: 'crearCotizacion', level: 'debug' }, 'Datos del cliente:', {
                clienteIdRecibido: data.clienteId,
                clienteEncontrado: cliente ? {
                    id: cliente.id,
                    numeroDocumento: cliente.numeroDocumento,
                    codter: (cliente as any).codter,
                    nombreCompleto: cliente.nombreCompleto
                } : 'NO ENCONTRADO',
                codterAUsar: clienteCodter
            });

            // Mapear observacionesInternas a observaciones para el backend
            // Si el numeroCotizacion es 'COT-PREVIEW', no enviarlo para que el backend genere uno automáticamente
            const { numeroCotizacion, id: _tempId, ...dataSinNumero } = data as any;
            const payload = {
                ...dataSinNumero,
                clienteId: clienteCodter, // Usar codter en lugar del ID interno
                // Solo incluir numeroCotizacion si no es 'COT-PREVIEW' (el backend generará uno automáticamente)
                ...(numeroCotizacion && numeroCotizacion !== 'COT-PREVIEW' ? { numeroCotizacion } : {}),
                observaciones: data.observacionesInternas || data.observaciones || '',
                // Asegurar que todos los campos requeridos estén presentes
                fechaCotizacion: data.fechaCotizacion || new Date().toISOString().split('T')[0],
                fechaVencimiento: data.fechaVencimiento || data.fechaCotizacion || new Date().toISOString().split('T')[0],
                items: data.items || [],
                // Usar código de bodega desde la bodega seleccionada en el header
                empresaId: bodegaCodigo
            };

            // Validación final: asegurar que nunca se envíe "AUTO" o "COT-PREVIEW"
            if (payload.numeroCotizacion === 'AUTO' ||
                payload.numeroCotizacion === 'COT-PREVIEW' ||
                (payload.numeroCotizacion && payload.numeroCotizacion.toUpperCase() === 'AUTO')) {
                logger.warn({ prefix: 'crearCotizacion' }, 'Payload contiene numeroCotizacion inválido, eliminándolo');
                delete payload.numeroCotizacion;
            }

            logger.log({ prefix: 'crearCotizacion', level: 'debug' }, 'Payload a enviar:', {
                ...payload,
                items: `[${payload.items.length} items]`,
                numeroCotizacion: payload.numeroCotizacion || '(no enviado, backend generará)'
            });

            const resp = await apiCreateCotizacion(payload);
            if (resp.success && resp.data) {
                await refreshData();
                const responseData = resp.data as Record<string, any>;
                const nuevaCotizacion: Cotizacion = {
                    ...data,
                    ...responseData,
                    id: responseData.id ?? data.id,
                    numeroCotizacion: responseData.numeroCotizacion || responseData.numero_cotizacion || data.numeroCotizacion,
                    estado: (responseData.estado || data.estado || 'ENVIADA') as Cotizacion['estado']
                };
                setCotizaciones(prev => {
                    const exists = prev.some(c => String(c.id) === String(nuevaCotizacion.id));
                    if (exists) {
                        return prev.map(c => (String(c.id) === String(nuevaCotizacion.id) ? nuevaCotizacion : c));
                    }
                    return [nuevaCotizacion, ...prev];
                });
                return nuevaCotizacion;
            }
            // Si la respuesta no es exitosa, usar el mensaje del backend
            const errorMessage = resp.message || resp.error || 'No se pudo crear la cotización';
            throw new Error(errorMessage);
        } catch (e) {
            logger.error({ prefix: 'crearCotizacion' }, 'Error al crear cotización:', e);
            // Si el error ya tiene un mensaje, usarlo; si no, crear uno genérico
            if (e instanceof Error) {
                throw e;
            }
            throw new Error('Error desconocido al crear cotización');
        }
    }, [refreshData, clientes, selectedSede]);

    const actualizarCotizacion = useCallback(async (id: string | number, data: Partial<Cotizacion>, baseCotizacion?: Cotizacion): Promise<Cotizacion | undefined> => {
        try {
            const { apiUpdateCotizacion } = await import('../services/apiClient');
            const idStr = String(id);
            const currentQuote = cotizaciones.find(c => String(c.id) === idStr) || baseCotizacion;
            if (!currentQuote) {
                logger.error({ prefix: 'actualizarCotizacion' }, 'Cotización no encontrada:', idStr);
                return undefined;
            }

            logger.log({ prefix: 'actualizarCotizacion', level: 'debug' }, 'Actualizando cotización:', { id: idStr, data, currentQuoteId: currentQuote.id });

            const payload: any = {};
            if (data.estado !== undefined) payload.estado = data.estado;
            if (data.fechaCotizacion !== undefined) payload.fechaCotizacion = data.fechaCotizacion;
            if (data.fechaVencimiento !== undefined) payload.fechaVencimiento = data.fechaVencimiento;
            if (data.observaciones !== undefined) payload.observaciones = data.observaciones;
            if (data.observacionesInternas !== undefined) payload.observacionesInternas = data.observacionesInternas;

            logger.log({ prefix: 'actualizarCotizacion', level: 'debug' }, 'Payload:', payload);

            // Asegurar que el ID sea convertido a número si es necesario para el backend
            const idParaBackend = typeof id === 'number' ? id : (isNaN(Number(id)) ? id : Number(id));
            logger.log({ prefix: 'actualizarCotizacion', level: 'debug' }, 'ID para backend:', idParaBackend, 'tipo:', typeof idParaBackend);

            const resp = await apiUpdateCotizacion(idParaBackend, payload);

            logger.log({ prefix: 'actualizarCotizacion', level: 'debug' }, 'Respuesta del API:', {
                success: resp.success,
                hasData: !!resp.data,
                message: resp.message,
                data: resp.data
            });

            if (resp.success && resp.data) {
                const updatedQuote = { ...currentQuote, ...data, ...(resp.data as any) } as Cotizacion;

                setCotizaciones(prev => {
                    const exists = prev.some(c => String(c.id) === idStr);
                    if (exists) {
                        return prev.map(c => (String(c.id) === idStr ? updatedQuote : c));
                    }
                    return [updatedQuote, ...prev];
                });

                await refreshData();

                logger.log({ prefix: 'actualizarCotizacion', level: 'debug' }, 'Cotización actualizada exitosamente:', updatedQuote.numeroCotizacion);

                if (user?.nombre) {
                    const estadoChange = data.estado ? ` (Estado: ${currentQuote.estado} → ${data.estado})` : '';
                    addActivityLog(
                        'Actualización Cotización',
                        `Cotización ${updatedQuote.numeroCotizacion} actualizada${estadoChange}`,
                        { type: 'Cotización', id: updatedQuote.id, name: updatedQuote.numeroCotizacion }
                    );
                }

                return updatedQuote;
            }

            const errorMsg = resp.message || `No se pudo actualizar la cotización. Respuesta: ${JSON.stringify(resp)}`;
            logger.error({ prefix: 'actualizarCotizacion' }, 'Error en respuesta:', errorMsg, resp);
            throw new Error(errorMsg);
        } catch (e) {
            logger.error({ prefix: 'actualizarCotizacion' }, 'Error al actualizar cotización:', e);
            if (e instanceof Error) {
                throw e;
            }
            throw new Error('Error desconocido al actualizar cotización');
        }
    }, [cotizaciones, user, addActivityLog, refreshData]);

    const crearPedido = useCallback(async (data: Pedido): Promise<Pedido> => {
        try {
            const { apiCreatePedido } = await import('../services/apiClient');

            // Convertir clienteId numérico a codter si es necesario
            let clienteCodter = data.clienteId;
            if (data.clienteId) {
                // Buscar cliente por ID numérico o por codter/numeroDocumento
                const cliente = clientes.find(c =>
                    String(c.id) === String(data.clienteId) ||
                    c.numeroDocumento === data.clienteId ||
                    (c as any).codter === data.clienteId
                );

                if (cliente) {
                    // Usar numeroDocumento o codter, priorizando numeroDocumento
                    clienteCodter = cliente.numeroDocumento || (cliente as any).codter || data.clienteId;
                    logger.log({ prefix: 'crearPedido', level: 'debug' }, 'Cliente encontrado:', {
                        id: cliente.id,
                        nombre: cliente.nombreCompleto || cliente.razonSocial,
                        numeroDocumento: cliente.numeroDocumento,
                        codter: (cliente as any).codter,
                        clienteIdOriginal: data.clienteId,
                        clienteCodterFinal: clienteCodter
                    });
                } else {
                    logger.warn({ prefix: 'crearPedido' }, 'Cliente no encontrado, usando clienteId original:', data.clienteId);
                }
            }

            // Convertir vendedorId a codi_emple si es necesario
            let vendedorCodiEmple = data.vendedorId;
            if (data.vendedorId) {
                // Buscar vendedor por ID o codi_emple
                const vendedor = vendedores.find(v =>
                    String(v.id) === String(data.vendedorId) ||
                    v.codiEmple === data.vendedorId
                );

                if (vendedor) {
                    vendedorCodiEmple = vendedor.codiEmple || data.vendedorId;
                    logger.log({ prefix: 'crearPedido', level: 'debug' }, 'Vendedor encontrado:', {
                        id: vendedor.id,
                        nombre: vendedor.nombreCompleto,
                        codiEmple: vendedor.codiEmple,
                        vendedorIdOriginal: data.vendedorId,
                        vendedorCodiEmpleFinal: vendedorCodiEmple
                    });
                } else {
                    logger.warn({ prefix: 'crearPedido' }, 'Vendedor no encontrado, usando vendedorId original:', data.vendedorId);
                }
            }

            // Generar fechaPedido automáticamente si no se proporciona
            const fechaPedido = data.fechaPedido || new Date().toISOString().split('T')[0];

            // Obtener código de bodega desde la bodega seleccionada en el header
            let bodegaCodigo: string | undefined;

            if (selectedSede?.codigo) {
                bodegaCodigo = String(selectedSede.codigo).padStart(3, '0');
                logger.log({ prefix: 'crearPedido', level: 'debug' }, 'Usando bodega seleccionada:', selectedSede.nombre, 'Código:', bodegaCodigo);
            } else {
                // Si no hay bodega seleccionada, intentar obtener la primera bodega disponible
                // o usar el valor que viene en data.empresaId
                if (data.empresaId) {
                    bodegaCodigo = String(data.empresaId).padStart(3, '0');
                    logger.warn({ prefix: 'crearPedido' }, 'No hay bodega seleccionada, usando empresaId del data:', bodegaCodigo);
                } else {
                    // Si tampoco hay empresaId, lanzar error más descriptivo
                    logger.error({ prefix: 'crearPedido' }, 'No hay bodega seleccionada ni empresaId proporcionado');
                    throw new Error('No hay bodega seleccionada. Por favor, seleccione una bodega antes de crear el pedido.');
                }
            }

            // Función para normalizar y redondear valores numéricos a 2 decimales
            // Asegura que los valores sean números puros, no strings con formato
            const roundTo2Decimals = (value: number | string | undefined | null): number => {
                if (value === null || value === undefined) return 0;
                // Si es string, limpiar formato primero
                if (typeof value === 'string') {
                    // Remover símbolos de moneda, espacios y formateo
                    let cleaned = value.trim().replace(/[$\s]/g, '');
                    // Si tiene coma y punto, la coma es decimal (formato europeo: 1.234,56)
                    if (cleaned.includes(',') && cleaned.includes('.')) {
                        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
                    } else if (cleaned.includes(',')) {
                        // Solo coma, verificar si es decimal o separador de miles
                        const parts = cleaned.split(',');
                        if (parts.length === 2 && parts[1].length <= 2) {
                            cleaned = cleaned.replace(',', '.'); // Es decimal
                        } else {
                            cleaned = cleaned.replace(/,/g, ''); // Es separador de miles
                        }
                    }
                    value = parseFloat(cleaned);
                }
                // Asegurar que sea un número válido
                const num = Number(value);
                if (!isFinite(num) || isNaN(num)) return 0;
                // Redondear a 2 decimales
                return Math.round(num * 100) / 100;
            };

            // Normalizar items para evitar problemas de overflow
            // Asegurar que todos los valores sean números puros
            const normalizedItems = data.items?.map(item => ({
                ...item,
                productoId: Number(item.productoId) || 0,
                cantidad: Number(item.cantidad) || 0,
                precioUnitario: roundTo2Decimals(item.precioUnitario),
                descuentoPorcentaje: roundTo2Decimals(item.descuentoPorcentaje),
                ivaPorcentaje: roundTo2Decimals(item.ivaPorcentaje),
                subtotal: roundTo2Decimals(item.subtotal),
                valorIva: roundTo2Decimals(item.valorIva),
                total: roundTo2Decimals(item.total),
                // Asegurar que descuentoValor también esté normalizado si existe
                descuentoValor: item.descuentoValor ? roundTo2Decimals(item.descuentoValor) : 0
            })) || [];

            const payload = {
                ...data,
                items: normalizedItems,
                fechaPedido: fechaPedido, // Asegurar que siempre haya fechaPedido
                clienteId: clienteCodter, // Usar codter en lugar de ID numérico
                vendedorId: vendedorCodiEmple, // Usar codi_emple en lugar de ID numérico
                empresaId: data.empresaId || bodegaCodigo, // Usar bodega seleccionada o la que viene en data
                estado: data.estado || 'ENVIADA', // Estado por defecto
                observaciones: data.observaciones || '',
                subtotal: roundTo2Decimals(data.subtotal),
                descuentoValor: roundTo2Decimals(data.descuentoValor),
                ivaValor: roundTo2Decimals(data.ivaValor),
                total: roundTo2Decimals(data.total),
                impoconsumoValor: roundTo2Decimals(data.impoconsumoValor)
            };

            logger.log({ prefix: 'crearPedido', level: 'debug' }, 'Enviando payload:', {
                fechaPedido: payload.fechaPedido,
                clienteId: payload.clienteId,
                vendedorId: payload.vendedorId,
                cotizacionId: payload.cotizacionId,
                itemsCount: payload.items?.length || 0,
                total: payload.total
            });

            const resp = await apiCreatePedido(payload);

            logger.log({ prefix: 'crearPedido', level: 'debug' }, 'Respuesta recibida:', {
                success: resp.success,
                hasData: !!resp.data,
                message: resp.message,
                error: resp.error
            });

            if (resp.success && resp.data) {
                await refreshData();
                const responseData = resp.data as { id: string | number };
                // Construir el pedido completo con todos los campos necesarios
                const pedidoCreado: Pedido = {
                    ...data,
                    id: String(responseData.id),
                    // Asegurar que numeroPedido esté presente
                    numeroPedido: data.numeroPedido || `PED-${String(responseData.id).padStart(3, '0')}`
                };
                logger.log({ prefix: 'crearPedido', level: 'info' }, 'Pedido creado exitosamente:', {
                    id: pedidoCreado.id,
                    numeroPedido: pedidoCreado.numeroPedido,
                    itemsCount: pedidoCreado.items?.length || 0
                });
                return pedidoCreado;
            }

            // Mostrar más detalles del error
            let errorMessage = resp.message || resp.error || 'No se pudo crear el pedido';

            // Si hay información de debug (almacenes disponibles), incluirla en el mensaje
            const debugInfo = (resp as any).debug;
            if (debugInfo && debugInfo.ejemplosAlmacenes) {
                const almacenes = debugInfo.ejemplosAlmacenes;
                if (almacenes.length > 0) {
                    const almacenesList = almacenes.map((a: any) =>
                        `"${a.codalm}" (${a.nomalm || 'Sin nombre'}, activo: ${a.activo ? 'Sí' : 'No'})`
                    ).join(', ');
                    errorMessage += `\n\nAlmacenes disponibles en la base de datos: ${almacenesList}`;
                } else {
                    errorMessage += '\n\n⚠️ No hay almacenes registrados en la base de datos. Por favor, cree al menos un almacén antes de crear pedidos.';
                }
            }

            logger.error({ prefix: 'crearPedido' }, 'Error en respuesta:', {
                message: errorMessage,
                success: resp.success,
                data: resp.data,
                error: resp.error,
                debug: (resp as any).debug
            });
            throw new Error(errorMessage);
        } catch (e) {
            logger.error({ prefix: 'crearPedido' }, 'Error completo:', e);
            if (e instanceof Error) {
                throw e;
            }
            throw new Error('No se pudo crear el pedido');
        }
    }, [refreshData, clientes, vendedores, selectedSede]);

    const actualizarPedido = useCallback(async (id: string, data: Partial<Pedido>, updatedBy?: string): Promise<Pedido | undefined> => {
        try {
            const currentPedido = pedidos.find(p => p.id === id);
            if (!currentPedido) return undefined;

            const updatedPedido: Pedido = { ...currentPedido, ...data };
            setPedidos(prev => prev.map(p => (p.id === id ? updatedPedido : p)));

            if (user?.nombre || updatedBy) {
                addActivityLog(
                    'Actualización Pedido',
                    `Pedido ${updatedPedido.numeroPedido} actualizado`,
                    { type: 'Pedido', id: updatedPedido.id, name: updatedPedido.numeroPedido }
                );
            }
            return updatedPedido;
        } catch (e) {
            logger.error({ prefix: 'actualizarPedido' }, 'Error al actualizar pedido:', e);
            return undefined;
        }
    }, [pedidos, user, addActivityLog]);

    const aprobarPedido = useCallback(async (id: string): Promise<Pedido | undefined> => {
        try {
            const pedido = pedidos.find(p => p.id === id);
            if (!pedido) {
                logger.error({ prefix: 'aprobarPedido' }, 'Pedido no encontrado:', id);
                return undefined;
            }

            // Solo se pueden aprobar pedidos en estado ENVIADA o BORRADOR
            if (pedido.estado !== 'ENVIADA' && pedido.estado !== 'BORRADOR') {
                logger.warn({ prefix: 'aprobarPedido' }, `No se puede aprobar un pedido en estado: ${pedido.estado}`);
                return undefined;
            }

            // Llamar a la API para actualizar el estado en la base de datos
            const { apiUpdatePedido } = await import('../services/apiClient');
            const idNum = typeof pedido.id === 'number' ? pedido.id : parseInt(String(pedido.id), 10);

            logger.log({ prefix: 'aprobarPedido', level: 'debug' }, 'Actualizando pedido en BD:', {
                id: idNum,
                estadoActual: pedido.estado,
                estadoNuevo: 'CONFIRMADO'
            });

            const resp = await apiUpdatePedido(idNum, { estado: 'CONFIRMADO' });

            if (!resp.success || !resp.data) {
                logger.error({ prefix: 'aprobarPedido' }, 'Error en respuesta de API:', resp);
                throw new Error(resp.message || 'No se pudo actualizar el pedido en la base de datos');
            }

            // Actualizar el estado local con los datos de la respuesta
            const pedidoAprobado: Pedido = {
                ...pedido,
                estado: ((resp.data as any)?.estado || 'CONFIRMADO') as Pedido['estado'],
                ...(resp.data as any)
            };
            setPedidos(prev => prev.map(p => (p.id === id ? pedidoAprobado : p)));

            // Recargar datos para asegurar sincronización
            await refreshData();

            if (user?.nombre) {
                addActivityLog(
                    'Aprobación Pedido',
                    `Pedido ${pedidoAprobado.numeroPedido} aprobado`,
                    { type: 'Pedido', id: pedidoAprobado.id, name: pedidoAprobado.numeroPedido }
                );
            }

            logger.log({ prefix: 'aprobarPedido', level: 'debug' }, 'Pedido aprobado exitosamente:', pedidoAprobado.numeroPedido);
            return pedidoAprobado;
        } catch (e) {
            logger.error({ prefix: 'aprobarPedido' }, 'Error al aprobar pedido:', e);
            return undefined;
        }
    }, [pedidos, user, addActivityLog, refreshData]);

    const marcarPedidoListoParaDespacho = useCallback(async (id: string): Promise<Pedido | undefined> => {
        try {
            const pedido = pedidos.find(p => p.id === id);
            if (!pedido) return undefined;

            const pedidoActualizado: Pedido = { ...pedido, estado: 'EN_PROCESO' };
            setPedidos(prev => prev.map(p => (p.id === id ? pedidoActualizado : p)));

            if (user?.nombre) {
                addActivityLog(
                    'Pedido Listo para Despacho',
                    `Pedido ${pedidoActualizado.numeroPedido} marcado como listo para despacho`,
                    { type: 'Pedido', id: pedidoActualizado.id, name: pedidoActualizado.numeroPedido }
                );
            }
            return pedidoActualizado;
        } catch (e) {
            logger.error({ prefix: 'marcarPedidoListoParaDespacho' }, 'Error al marcar pedido listo para despacho:', e);
            return undefined;
        }
    }, [pedidos, user, addActivityLog]);

    const aprobarCotizacion = useCallback(async (idOrCotizacion: string | Cotizacion, itemIds?: number[]): Promise<{ cotizacion: Cotizacion, pedido: Pedido } | Cotizacion | undefined> => {
        try {
            // Obtener la cotización
            const cotizacion = typeof idOrCotizacion === 'string'
                ? cotizaciones.find(c => c.id === idOrCotizacion)
                : idOrCotizacion;

            if (!cotizacion) {
                logger.error({ prefix: 'aprobarCotizacion' }, 'Cotización no encontrada para aprobar');
                return undefined;
            }

            // Asegurar que la cotización tenga items
            if (!cotizacion.items || cotizacion.items.length === 0) {
                logger.error({ prefix: 'aprobarCotizacion' }, 'La cotización no tiene items');
                throw new Error('La cotización no tiene items para aprobar');
            }

            logger.log({ prefix: 'aprobarCotizacion', level: 'info' }, 'Aprobando cotización:', {
                id: cotizacion.id,
                numero: cotizacion.numeroCotizacion,
                itemsCount: cotizacion.items?.length || 0,
                itemIds: itemIds?.length || 0,
                itemIdsArray: itemIds
            });

            // Guardar los items originales antes de actualizar el estado
            const itemsOriginales = cotizacion.items || [];
            logger.log({ prefix: 'aprobarCotizacion', level: 'debug' }, 'Items originales guardados:', {
                count: itemsOriginales.length,
                productoIds: itemsOriginales.map(i => i.productoId)
            });

            // Primero actualizar el estado de la cotización a APROBADA en el backend
            logger.log({ prefix: 'aprobarCotizacion', level: 'info' }, 'Actualizando estado de cotización a APROBADA...');
            const cotizacionActualizada = await actualizarCotizacion(cotizacion.id, { estado: 'APROBADA' }, cotizacion);
            if (!cotizacionActualizada) {
                logger.error({ prefix: 'aprobarCotizacion' }, 'No se pudo actualizar el estado de la cotización');
                throw new Error('No se pudo actualizar el estado de la cotización');
            }
            logger.log({ prefix: 'aprobarCotizacion', level: 'info' }, 'Cotización actualizada exitosamente');

            // Actualizar el estado local, asegurando que se mantengan los items originales
            const cotizacionAprobada: Cotizacion = {
                ...cotizacionActualizada,
                estado: 'APROBADA',
                items: cotizacionActualizada.items && cotizacionActualizada.items.length > 0
                    ? cotizacionActualizada.items
                    : itemsOriginales
            };
            logger.log({ prefix: 'aprobarCotizacion', level: 'debug' }, 'Cotización aprobada preparada:', {
                id: cotizacionAprobada.id,
                numero: cotizacionAprobada.numeroCotizacion,
                itemsCount: cotizacionAprobada.items?.length || 0
            });
            setCotizaciones(prev => prev.map(c => (c.id === cotizacion.id ? cotizacionAprobada : c)));

            // Si se proporcionan itemIds, crear un pedido con esos items
            // IMPORTANTE: Si se proporcionan itemIds, SIEMPRE debemos crear el pedido
            if (itemIds && itemIds.length > 0) {
                logger.log({ prefix: 'aprobarCotizacion', level: 'info' }, '🚀 INICIANDO CREACIÓN DE PEDIDO...', {
                    itemIdsCount: itemIds.length,
                    itemIds: itemIds,
                    cotizacionId: cotizacion.id,
                    numeroCotizacion: cotizacion.numeroCotizacion
                });

                // Usar los items de la cotización aprobada (que incluyen los originales si es necesario)
                const itemsDisponibles = cotizacionAprobada.items || itemsOriginales;
                logger.log({ prefix: 'aprobarCotizacion', level: 'debug' }, 'Items disponibles para pedido:', {
                    count: itemsDisponibles.length,
                    productoIds: itemsDisponibles.map(i => i.productoId)
                });

                const itemsParaPedido = itemsDisponibles.filter(item => itemIds.includes(item.productoId));
                logger.log({ prefix: 'aprobarCotizacion', level: 'debug' }, 'Items filtrados para pedido:', {
                    count: itemsParaPedido.length,
                    productoIds: itemsParaPedido.map(i => i.productoId)
                });

                if (itemsParaPedido.length === 0) {
                    logger.error({ prefix: 'aprobarCotizacion' }, 'No se encontraron items para crear el pedido', {
                        itemsDisponibles: itemsDisponibles.length,
                        itemIdsBuscados: itemIds,
                        itemsDisponiblesIds: itemsDisponibles.map(i => i.productoId)
                    });
                    throw new Error('No se encontraron items para crear el pedido. Verifique que los items de la cotización estén correctamente cargados.');
                }

                // Obtener el codter del cliente desde la lista de clientes
                // Buscar por ID numérico o por codter/numeroDocumento
                const cliente = clientes.find(c =>
                    String(c.id) === String(cotizacion.clienteId) ||
                    c.numeroDocumento === cotizacion.clienteId ||
                    (c as any).codter === cotizacion.clienteId
                );
                const clienteCodter = cliente?.numeroDocumento || (cliente as any)?.codter || cotizacion.clienteId;

                // El vendedorId de la cotización ya debería ser el codi_emple, pero verificamos
                const vendedorCodiEmple = cotizacion.vendedorId || '';

                logger.log({ prefix: 'aprobarCotizacion', level: 'debug' }, 'Mapeando datos:', {
                    clienteIdOriginal: cotizacion.clienteId,
                    clienteCodter: clienteCodter,
                    clienteEncontrado: cliente ? { id: cliente.id, nombre: cliente.nombreCompleto || cliente.razonSocial } : null,
                    vendedorIdOriginal: cotizacion.vendedorId,
                    vendedorCodiEmple: vendedorCodiEmple,
                    itemsCount: itemsParaPedido.length
                });

                // Mapear items asegurando que tengan toda la información necesaria
                const itemsMapeados = itemsParaPedido.map(item => {
                    // Buscar el producto en el catálogo para obtener información adicional
                    const producto = productos.find(p =>
                        String(p.id) === String(item.productoId) ||
                        p.id === item.productoId
                    );

                    return {
                        ...item,
                        pedidoId: '',
                        // Asegurar que la descripción tenga el nombre del producto si está disponible
                        descripcion: item.descripcion || producto?.nombre || (item as any).nombre || `Producto ${item.productoId}`,
                        // Asegurar que la unidad de medida esté disponible
                        unidadMedida: (item as any).unidadMedida || producto?.unidadMedida || 'Unidad'
                    };
                });

                // Asegurar que el cotizacionId sea un número si es posible, o el ID como string
                let cotizacionIdParaPedido: string | number = cotizacion.id;
                if (typeof cotizacion.id === 'string') {
                    const idNum = parseInt(cotizacion.id, 10);
                    if (!isNaN(idNum)) {
                        cotizacionIdParaPedido = idNum;
                    }
                }

                logger.log({ prefix: 'aprobarCotizacion', level: 'debug' }, 'Preparando pedido con cotizacionId:', {
                    cotizacionIdOriginal: cotizacion.id,
                    cotizacionIdParaPedido: cotizacionIdParaPedido,
                    tipo: typeof cotizacionIdParaPedido
                });

                // Obtener el código de almacén correcto
                // Prioridad: 1) selectedSede, 2) codalm de la cotización, 3) empresaId de la cotización
                let empresaIdParaPedido: string | number;
                if (selectedSede?.codigo) {
                    empresaIdParaPedido = String(selectedSede.codigo).padStart(3, '0');
                    logger.log({ prefix: 'aprobarCotizacion', level: 'info' }, 'Usando almacén de selectedSede:', {
                        codigo: empresaIdParaPedido,
                        nombre: selectedSede.nombre
                    });
                } else if ((cotizacion as any).codalm) {
                    empresaIdParaPedido = String((cotizacion as any).codalm).padStart(3, '0');
                    logger.log({ prefix: 'aprobarCotizacion', level: 'info' }, 'Usando codalm de la cotización:', empresaIdParaPedido);
                } else if (cotizacion.empresaId) {
                    empresaIdParaPedido = typeof cotizacion.empresaId === 'string'
                        ? String(cotizacion.empresaId).padStart(3, '0')
                        : String(cotizacion.empresaId).padStart(3, '0');
                    logger.log({ prefix: 'aprobarCotizacion', level: 'info' }, 'Usando empresaId de la cotización:', empresaIdParaPedido);
                } else {
                    logger.error({ prefix: 'aprobarCotizacion' }, 'No se pudo determinar el almacén para el pedido');
                    throw new Error('No se pudo determinar el almacén para crear el pedido. Por favor, seleccione una bodega en el header.');
                }

                // Obtener forma de pago de la cotización, normalizando valores antiguos
                let formaPagoPedido = cotizacion.formaPago || '1';
                formaPagoPedido = formaPagoPedido === '01' ? '1' : formaPagoPedido === '02' ? '2' : formaPagoPedido;

                const nuevoPedido: Pedido = {
                    id: '', // Se asignará cuando se cree
                    numeroPedido: `PED-${cotizacionAprobada.numeroCotizacion}`,
                    fechaPedido: new Date().toISOString().split('T')[0],
                    clienteId: clienteCodter, // Usar codter en lugar de ID numérico
                    vendedorId: vendedorCodiEmple, // Ya debería ser codi_emple
                    cotizacionId: cotizacionIdParaPedido,
                    subtotal: itemsParaPedido.reduce((sum, item) => sum + (item.subtotal || 0), 0),
                    descuentoValor: itemsParaPedido.reduce((sum, item) => {
                        const itemTotal = (item.precioUnitario || 0) * (item.cantidad || 0);
                        return sum + (itemTotal * ((item.descuentoPorcentaje || 0) / 100));
                    }, 0),
                    ivaValor: itemsParaPedido.reduce((sum, item) => sum + ((item as any).ivaValor || item.valorIva || 0), 0),
                    total: itemsParaPedido.reduce((sum, item) => sum + (item.total || 0), 0),
                    estado: 'BORRADOR', // Estado inicial: pedido creado desde cotización aprobada, necesita aprobación
                    observaciones: `Pedido creado desde cotización ${cotizacion.numeroCotizacion}`,
                    items: itemsMapeados,
                    fechaEntregaEstimada: cotizacion.fechaVencimiento,
                    empresaId: empresaIdParaPedido,
                    formaPago: formaPagoPedido
                };

                logger.log({ prefix: 'aprobarCotizacion', level: 'info' }, 'Llamando a crearPedido con:', {
                    numeroPedido: nuevoPedido.numeroPedido,
                    clienteId: nuevoPedido.clienteId,
                    vendedorId: nuevoPedido.vendedorId,
                    cotizacionId: nuevoPedido.cotizacionId,
                    itemsCount: nuevoPedido.items.length,
                    total: nuevoPedido.total,
                    empresaId: nuevoPedido.empresaId,
                    items: nuevoPedido.items.map(i => ({ productoId: i.productoId, cantidad: i.cantidad }))
                });

                let pedidoCreado: Pedido | null = null;
                try {
                    pedidoCreado = await crearPedido(nuevoPedido);
                    logger.log({ prefix: 'aprobarCotizacion', level: 'info' }, 'crearPedido retornó:', {
                        success: !!pedidoCreado,
                        pedidoId: pedidoCreado?.id,
                        numeroPedido: pedidoCreado?.numeroPedido,
                        tieneItems: !!(pedidoCreado?.items && pedidoCreado.items.length > 0)
                    });
                } catch (errorCrearPedido) {
                    logger.error({ prefix: 'aprobarCotizacion' }, 'Error al crear pedido:', {
                        error: errorCrearPedido,
                        message: errorCrearPedido instanceof Error ? errorCrearPedido.message : 'Error desconocido',
                        stack: errorCrearPedido instanceof Error ? errorCrearPedido.stack : undefined,
                        nuevoPedido: {
                            numeroPedido: nuevoPedido.numeroPedido,
                            clienteId: nuevoPedido.clienteId,
                            itemsCount: nuevoPedido.items.length
                        }
                    });
                    // IMPORTANTE: Si falla la creación del pedido, revertir el estado de la cotización
                    // o al menos lanzar un error claro
                    throw new Error(`Error al crear el pedido: ${errorCrearPedido instanceof Error ? errorCrearPedido.message : 'Error desconocido'}`);
                }

                if (!pedidoCreado) {
                    logger.error({ prefix: 'aprobarCotizacion' }, 'crearPedido retornó null o undefined', {
                        nuevoPedido: {
                            numeroPedido: nuevoPedido.numeroPedido,
                            clienteId: nuevoPedido.clienteId,
                            itemsCount: nuevoPedido.items.length
                        }
                    });
                    throw new Error('No se pudo crear el pedido: crearPedido retornó null o undefined. Verifique los logs del servidor para más detalles.');
                }

                if (!pedidoCreado.id) {
                    logger.error({ prefix: 'aprobarCotizacion' }, 'Pedido creado pero sin ID', {
                        pedidoCreado: pedidoCreado
                    });
                    throw new Error('El pedido se creó pero no tiene ID. Esto indica un problema en el backend.');
                }

                logger.log({ prefix: 'aprobarCotizacion', level: 'info' }, '✅ Pedido creado exitosamente:', {
                    id: pedidoCreado.id,
                    numeroPedido: pedidoCreado.numeroPedido,
                    itemsCount: pedidoCreado.items?.length || 0
                });

                if (user?.nombre) {
                    addActivityLog(
                        'Aprobación Cotización y Creación Pedido',
                        `Cotización ${cotizacionAprobada.numeroCotizacion} aprobada y pedido ${pedidoCreado.numeroPedido} creado`,
                        { type: 'Cotización', id: cotizacionAprobada.id, name: cotizacionAprobada.numeroCotizacion }
                    );
                }

                // NO recargar todos los datos automáticamente para evitar bucles
                // Solo recargar pedidos y cotizaciones específicamente si es necesario
                // await refreshData(); // Comentado para evitar bucles

                // Validación final antes de retornar
                if (!pedidoCreado || !pedidoCreado.id) {
                    logger.error({ prefix: 'aprobarCotizacion' }, 'ERROR CRÍTICO: Intentando retornar pedido sin ID');
                    throw new Error('Error crítico: El pedido no tiene ID válido');
                }

                logger.log({ prefix: 'aprobarCotizacion', level: 'info' }, '✅ Retornando resultado con cotización y pedido:', {
                    cotizacionId: cotizacionAprobada.id,
                    pedidoId: pedidoCreado.id,
                    numeroPedido: pedidoCreado.numeroPedido
                });

                return { cotizacion: cotizacionAprobada, pedido: pedidoCreado };
            }

            // Si no se proporcionan itemIds, solo aprobar la cotización
            // PERO si se llamó desde handleCreateAndApprove, siempre debería haber itemIds
            logger.log({ prefix: 'aprobarCotizacion', level: 'warn' }, '⚠️ No se proporcionaron itemIds, solo aprobando cotización sin crear pedido', {
                itemIds: itemIds,
                itemIdsLength: itemIds?.length || 0,
                cotizacionId: cotizacion.id
            });

            if (user?.nombre) {
                addActivityLog(
                    'Aprobación Cotización',
                    `Cotización ${cotizacionAprobada.numeroCotizacion} aprobada`,
                    { type: 'Cotización', id: cotizacionAprobada.id, name: cotizacionAprobada.numeroCotizacion }
                );
            }

            // Recargar datos para asegurar sincronización
            await refreshData();

            logger.log({ prefix: 'aprobarCotizacion', level: 'info' }, 'Retornando solo cotización (sin pedido)');
            return cotizacionAprobada;
        } catch (e) {
            logger.error({ prefix: 'aprobarCotizacion' }, '❌ ERROR EN aprobarCotizacion:', {
                error: e,
                message: e instanceof Error ? e.message : 'Error desconocido',
                stack: e instanceof Error ? e.stack : undefined,
                itemIds: itemIds,
                itemIdsLength: itemIds?.length || 0
            });

            // Si se proporcionaron itemIds pero falló, el error debe ser claro
            if (itemIds && itemIds.length > 0) {
                const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
                throw new Error(`Error al aprobar la cotización y crear el pedido: ${errorMsg}`);
            }

            if (e instanceof Error) {
                throw e;
            }
            throw new Error('Error desconocido al aprobar cotización');
        }
    }, [cotizaciones, clientes, productos, user, addActivityLog, crearPedido, actualizarCotizacion, refreshData]);

    const aprobarRemision = useCallback(async (id: string | number): Promise<Remision | undefined> => {
        try {
            // Normalizar el ID para búsqueda (convertir a string para comparación)
            const idStr = String(id);
            const idNum = typeof id === 'number' ? id : parseInt(idStr, 10);

            if (isNaN(idNum)) {
                logger.error({ prefix: 'aprobarRemision' }, 'ID inválido, no se puede convertir a número:', id);
                return undefined;
            }

            // Buscar la remisión con comparación flexible (string o number)
            // Si el array está vacío, simplemente continuar con la actualización directa
            const remision = remisiones.length > 0 ? remisiones.find(r => {
                const rIdStr = String(r.id);
                const rIdNum = typeof r.id === 'number' ? r.id : parseInt(rIdStr, 10);
                return rIdStr === idStr || rIdNum === idNum;
            }) : null;

            // Si se encuentra en el array local, validar el estado
            if (remision) {
                // Solo se pueden marcar como entregadas remisiones en estado EN_TRANSITO o BORRADOR
                if (remision.estado !== 'EN_TRANSITO' && remision.estado !== 'BORRADOR') {
                    logger.warn({ prefix: 'aprobarRemision' }, `No se puede marcar como entregada una remisión en estado: ${remision.estado}`);
                    return undefined;
                }
            } else {
                // Si no se encuentra en el array local, log informativo pero continuar
                // Esto es normal cuando las remisiones se cargan con paginación
                logger.log({ prefix: 'aprobarRemision', level: 'debug' }, 'Remisión no encontrada en estado local (puede ser normal con paginación), actualizando directamente en BD:', {
                    idBuscado: id,
                    idTipo: typeof id,
                    remisionesEnEstado: remisiones.length
                });
            }

            // Llamar a la API para actualizar el estado en la base de datos
            // El backend validará el estado actual y si se puede actualizar
            const { apiUpdateRemision } = await import('../services/apiClient');
            const remisionIdNum = remision ? (typeof remision.id === 'number' ? remision.id : parseInt(String(remision.id), 10)) : idNum;

            logger.log({ prefix: 'aprobarRemision', level: 'debug' }, 'Actualizando remisión en BD:', {
                id: remisionIdNum,
                estadoActual: remision?.estado || 'desconocido',
                estadoNuevo: 'ENTREGADO'
            });

            const resp = await apiUpdateRemision(remisionIdNum, { estado: 'ENTREGADO' });

            if (!resp.success || !resp.data) {
                logger.error({ prefix: 'aprobarRemision' }, 'Error en respuesta de API:', resp);
                throw new Error(resp.message || 'No se pudo actualizar la remisión en la base de datos');
            }

            // Construir la remisión entregada desde la respuesta de la API
            const remisionEntregada: Remision = remision ? {
                ...remision,
                estado: ((resp.data as any).estado || 'ENTREGADO') as Remision['estado'],
                ...(resp.data as any)
            } : {
                id: (resp.data as any).id,
                numeroRemision: (resp.data as any).numeroRemision || `REM-${idNum}`,
                estado: ((resp.data as any).estado || 'ENTREGADO') as Remision['estado'],
                fechaRemision: (resp.data as any).fechaRemision || new Date().toISOString().split('T')[0],
                pedidoId: (resp.data as any).pedidoId || null,
                clienteId: (resp.data as any).clienteId || '',
                items: [],
                observaciones: (resp.data as any).observaciones || '',
                codalm: (resp.data as any).codalm || '',
                codven: (resp.data as any).codven || null
            };

            // Actualizar el estado local solo si hay remisiones cargadas
            // Si el array está vacío (paginación), no intentar actualizar
            if (remisiones.length > 0) {
                setRemisiones(prev => prev.map(r => {
                    const rIdStr = String(r.id);
                    const rIdNum = typeof r.id === 'number' ? r.id : parseInt(rIdStr, 10);
                    const idStr = String(id);
                    const idNum = typeof id === 'number' ? id : parseInt(idStr, 10);

                    if (rIdStr === idStr || rIdNum === idNum) {
                        return remisionEntregada;
                    }
                    return r;
                }));
            }

            // Recargar remisiones para asegurar sincronización completa
            await refreshPedidosYRemisiones();

            if (user?.nombre) {
                addActivityLog(
                    'Entrega Remisión',
                    `Remisión ${remisionEntregada.numeroRemision} marcada como Entregada`,
                    { type: 'Remisión', id: remisionEntregada.id, name: remisionEntregada.numeroRemision }
                );
            }

            logger.log({ prefix: 'aprobarRemision', level: 'debug' }, 'Remisión marcada como entregada exitosamente:', remisionEntregada.numeroRemision);
            return remisionEntregada;
        } catch (e) {
            logger.error({ prefix: 'aprobarRemision' }, 'Error al marcar remisión como entregada:', e);
            return undefined;
        }
    }, [remisiones, user, addActivityLog, refreshPedidosYRemisiones]);

    const crearRemision = useCallback(async (
        pedidoOrData: Pedido | Remision,
        items?: Array<{ productoId: number; cantidad: number }>,
        logisticData?: any
    ): Promise<any> => {
        try {
            const { apiCreateRemision } = await import('../services/apiClient');

            // Obtener código de bodega desde la bodega seleccionada en el header
            const bodegaCodigo = selectedSede?.codigo
                ? String(selectedSede.codigo).padStart(3, '0')
                : '001'; // Fallback si no hay bodega seleccionada

            if (!selectedSede) {
                logger.warn({ prefix: 'crearRemision' }, 'No hay bodega seleccionada, usando fallback:', bodegaCodigo);
            } else {
                logger.log({ prefix: 'crearRemision', level: 'debug' }, 'Usando bodega seleccionada:', selectedSede.nombre, 'Código:', bodegaCodigo);
            }

            let payload: any;
            let isFromPedido = false;

            // Si se pasa un Pedido con items, construir el objeto Remision
            if (items && Array.isArray(items) && 'numeroPedido' in pedidoOrData) {
                isFromPedido = true;
                const pedido = pedidoOrData as Pedido;

                // Buscar cliente para obtener codter
                const cliente = clientes.find(c =>
                    String(c.id) === String(pedido.clienteId) ||
                    c.numeroDocumento === pedido.clienteId ||
                    (c as any).codter === pedido.clienteId
                );
                const clienteCodter = cliente?.numeroDocumento || (cliente as any)?.codter || pedido.clienteId;

                // Construir items con información completa del producto
                const itemsCompletos = items.map(item => {
                    const producto = productos.find(p =>
                        String(p.id) === String(item.productoId) ||
                        p.id === item.productoId
                    );
                    const itemPedido = pedido.items.find(ip =>
                        String(ip.productoId) === String(item.productoId)
                    );

                    const precioUnitario = itemPedido?.precioUnitario || producto?.ultimoCosto || 0;
                    const descuentoPorcentaje = itemPedido?.descuentoPorcentaje || 0;
                    const ivaPorcentaje = itemPedido?.ivaPorcentaje || producto?.tasaIva || 0;
                    const subtotal = precioUnitario * item.cantidad;
                    const descuentoValor = subtotal * (descuentoPorcentaje / 100);
                    const subtotalConDescuento = subtotal - descuentoValor;
                    const valorIva = subtotalConDescuento * (ivaPorcentaje / 100);
                    const total = subtotalConDescuento + valorIva;

                    // Obtener codProducto (codins) del producto
                    const codProducto = producto?.codins || itemPedido?.codProducto || '';
                    if (!codProducto) {
                        logger.warn({ prefix: 'crearRemision' }, `Producto sin codins: productoId=${item.productoId}, producto=${producto?.nombre || 'N/A'}`);
                    }

                    // NOTA: ven_detapedidos NO tiene columna 'id' como clave primaria
                    // Por lo tanto, detaPedidoId siempre será null
                    // La relación se mantiene a través de pedidoId en el encabezado de la remisión
                    const detaPedidoId = null;

                    return {
                        productoId: item.productoId,
                        cantidad: item.cantidad,
                        codProducto: codProducto, // CRÍTICO: Incluir codProducto para el backend
                        cantidadEnviada: item.cantidad, // CRÍTICO: Usar cantidadEnviada en lugar de solo cantidad
                        detaPedidoId: detaPedidoId, // Opcional pero importante para relacionar con el pedido
                        precioUnitario: precioUnitario,
                        descuentoPorcentaje: descuentoPorcentaje,
                        ivaPorcentaje: ivaPorcentaje,
                        descripcion: producto?.nombre || itemPedido?.descripcion || `Producto ${item.productoId}`,
                        subtotal: subtotalConDescuento,
                        valorIva: valorIva,
                        total: total,
                        cantidadFacturada: 0, // Inicializar en 0
                        cantidadDevuelta: 0 // Inicializar en 0
                    };
                });

                // Calcular totales
                const subtotal = itemsCompletos.reduce((sum, item) => sum + item.subtotal, 0);
                const ivaValor = itemsCompletos.reduce((sum, item) => sum + item.valorIva, 0);
                const total = itemsCompletos.reduce((sum, item) => sum + item.total, 0);

                // Determinar si es remisión total o parcial
                const totalPedido = pedido.items.reduce((sum, item) => sum + item.cantidad, 0);
                const totalRemitido = items.reduce((sum, item) => sum + item.cantidad, 0);
                const estadoEnvio = totalRemitido >= totalPedido ? 'Total' : 'Parcial';

                // Obtener ID numérico del pedido
                const pedidoIdNum = typeof pedido.id === 'number' ? pedido.id : parseInt(String(pedido.id), 10);

                // Obtener vendedorId del pedido, convertir a codi_emple si es necesario
                let vendedorCodiEmple = null;
                if (pedido.vendedorId) {
                    const vendedor = vendedores.find(v =>
                        String(v.id) === String(pedido.vendedorId) ||
                        v.codiEmple === pedido.vendedorId
                    );
                    vendedorCodiEmple = vendedor?.codiEmple || pedido.vendedorId;
                }

                payload = {
                    pedidoId: isNaN(pedidoIdNum) ? null : pedidoIdNum, // CRÍTICO: Incluir pedidoId
                    clienteId: clienteCodter,
                    vendedorId: vendedorCodiEmple || null, // Enviar null si no hay vendedor
                    fechaRemision: new Date().toISOString().split('T')[0],
                    fechaDespacho: logisticData?.fechaDespacho || null,
                    subtotal: subtotal,
                    descuentoValor: pedido.descuentoValor || 0,
                    ivaValor: ivaValor,
                    total: total,
                    observaciones: logisticData?.observaciones || '',
                    estado: 'BORRADOR',
                    empresaId: bodegaCodigo, // CRÍTICO: Incluir empresaId (código de bodega)
                    items: itemsCompletos
                };

                logger.log({ prefix: 'crearRemision', level: 'debug' }, 'Creando remisión desde pedido:', {
                    pedidoId: pedidoIdNum,
                    pedidoNumero: pedido.numeroPedido,
                    itemsCount: items.length,
                    estadoEnvio: estadoEnvio,
                    total: total
                });
            } else {
                // Si se pasa un objeto Remision directamente
                const data = pedidoOrData as Remision;
                payload = {
                    ...data,
                    observaciones: data.observaciones || '',
                    empresaId: bodegaCodigo
                };
            }

            logger.log({ prefix: 'crearRemision', level: 'debug' }, 'Enviando payload a API:', {
                pedidoId: payload.pedidoId,
                clienteId: payload.clienteId,
                vendedorId: payload.vendedorId,
                itemsCount: payload.items?.length || 0,
                empresaId: payload.empresaId,
                transportadoraId: payload.transportadoraId
            });

            const resp = await apiCreateRemision(payload);

            logger.log({ prefix: 'crearRemision', level: 'debug' }, 'Respuesta de API:', {
                success: resp.success,
                message: resp.message,
                error: resp.error,
                hasData: !!resp.data
            });

            if (resp.success && resp.data) {
                // Recargar pedidos y remisiones para obtener los estados actualizados del backend
                // El backend actualiza automáticamente el estado del pedido cuando se crea una remisión
                await refreshPedidosYRemisiones();

                const responseData = resp.data as { id: string };
                const nuevaRemision = {
                    ...payload,
                    id: responseData.id,
                    pedidoId: payload.pedidoId // Asegurar que pedidoId esté presente
                } as Remision;

                // Si se llamó desde un pedido, retornar formato con mensaje
                if (isFromPedido) {
                    const mensaje = `Remisión ${nuevaRemision.numeroRemision || 'creada'} creada exitosamente.`;
                    return { nuevaRemision, mensaje };
                }

                return nuevaRemision;
            }

            // Mejorar el mensaje de error con información del backend
            const errorMessage = resp.message || resp.error || 'No se pudo crear la remisión';
            logger.error({ prefix: 'crearRemision' }, 'Error en respuesta:', {
                message: errorMessage,
                error: resp.error,
                details: (resp as any).details || (resp as any).debug
            });
            throw new Error(errorMessage);
        } catch (e) {
            logger.error({ prefix: 'crearRemision' }, 'Error al crear remisión:', e);
            throw e;
        }
    }, [refreshPedidosYRemisiones, selectedSede, clientes, productos, vendedores]);

    const crearFactura = useCallback(async (data: Factura): Promise<Factura> => {
        try {
            const { apiCreateFactura } = await import('../services/apiClient');

            // Obtener código de bodega desde la bodega seleccionada en el header
            const bodegaCodigo = selectedSede?.codigo
                ? String(selectedSede.codigo).padStart(3, '0')
                : '001'; // Fallback si no hay bodega seleccionada

            if (!selectedSede) {
                logger.warn({ prefix: 'crearFactura' }, 'No hay bodega seleccionada, usando fallback:', bodegaCodigo);
            } else {
                logger.log({ prefix: 'crearFactura', level: 'debug' }, 'Usando bodega seleccionada:', selectedSede.nombre, 'Código:', bodegaCodigo);
            }

            const payload = {
                ...data,
                observaciones: data.observaciones || '',
                // Usar código de bodega desde la bodega seleccionada en el header
                empresaId: bodegaCodigo
            };
            const resp = await apiCreateFactura(payload);
            if (resp.success && resp.data) {
                await refreshData();
                const responseData = resp.data as { id: string };
                return { ...data, id: responseData.id } as Factura;
            }
            throw new Error('No se pudo crear la factura');
        } catch (e) {
            logger.error({ prefix: 'crearFactura' }, 'Error al crear factura:', e);
            throw e;
        }
    }, [refreshData, selectedSede]);

    const crearFacturaDesdeRemisiones = useCallback(async (remisionIds: string[]): Promise<{ nuevaFactura: Factura } | null> => {
        try {
            if (!remisionIds || remisionIds.length === 0) {
                logger.error({ prefix: 'crearFacturaDesdeRemisiones' }, 'No se proporcionaron IDs de remisiones');
                return null;
            }

            // Obtener todas las remisiones seleccionadas
            let remisionesSeleccionadas = remisiones.filter(r => remisionIds.includes(r.id));

            if (remisionesSeleccionadas.length === 0) {
                logger.error({ prefix: 'crearFacturaDesdeRemisiones' }, 'No se encontraron remisiones con los IDs proporcionados');
                return null;
            }

            // CRÍTICO: Cargar detalles de remisiones si no tienen items o items sin precios
            logger.log({ prefix: 'crearFacturaDesdeRemisiones' }, `Verificando items de ${remisionesSeleccionadas.length} remisiones...`);

            // Importar apiClient dinámicamente para evitar dependencias circulares
            const { apiClient } = await import('../services/apiClient');

            const remisionesConItemsCargados = await Promise.all(remisionesSeleccionadas.map(async (remision) => {
                // Verificar si la remisión ya tiene items con precios válidos
                const tieneItemsConPrecios = remision.items && remision.items.length > 0 &&
                    remision.items.some(item => item.precioUnitario && Number(item.precioUnitario) > 0);

                if (tieneItemsConPrecios) {
                    logger.log({ prefix: 'crearFacturaDesdeRemisiones', level: 'debug' },
                        `Remisión ${remision.numeroRemision} ya tiene ${remision.items.length} items con precios, no se recarga`);
                    return remision;
                }

                // Cargar detalles desde el backend
                try {
                    logger.log({ prefix: 'crearFacturaDesdeRemisiones', level: 'debug' },
                        `Cargando detalles de remisión ${remision.numeroRemision} (ID: ${remision.id})...`);
                    // Importar apiClient dinámicamente para evitar dependencias circulares
                    const { apiClient } = await import('../services/apiClient');
                    const detallesRes = await apiClient.getRemisionDetalleById(remision.id);
                    if (detallesRes.success && Array.isArray(detallesRes.data) && detallesRes.data.length > 0) {
                        logger.log({ prefix: 'crearFacturaDesdeRemisiones', level: 'debug' },
                            `✅ Detalles cargados para remisión ${remision.numeroRemision}: ${detallesRes.data.length} items`);
                        // Mapear los detalles a items con precios
                        const itemsMapeados = detallesRes.data.map((d: any) => ({
                            productoId: d.productoId,
                            cantidad: Number(d.cantidad || d.cantidadEnviada || 0),
                            precioUnitario: Number(d.precioUnitario || 0),
                            descuentoPorcentaje: Number(d.descuentoPorcentaje || 0),
                            ivaPorcentaje: Number(d.ivaPorcentaje || 0),
                            descripcion: d.descripcion || '',
                            subtotal: Number(d.subtotal || 0),
                            valorIva: Number(d.valorIva || 0),
                            total: Number(d.total || 0),
                            codProducto: d.codProducto || d.codins || ''
                        }));
                        return {
                            ...remision,
                            items: itemsMapeados
                        };
                    } else {
                        logger.warn({ prefix: 'crearFacturaDesdeRemisiones' },
                            `⚠️ No se pudieron cargar detalles para remisión ${remision.numeroRemision}`, detallesRes);
                        return remision;
                    }
                } catch (error) {
                    logger.error({ prefix: 'crearFacturaDesdeRemisiones' },
                        `Error cargando detalles de remisión ${remision.numeroRemision}:`, error);
                    return remision;
                }
            }));

            // Actualizar remisionesSeleccionadas con los items cargados
            remisionesSeleccionadas = remisionesConItemsCargados;

            // Validar que todas las remisiones sean del mismo cliente
            const primerClienteId = remisionesSeleccionadas[0].clienteId;
            const todosMismoCliente = remisionesSeleccionadas.every(r => r.clienteId === primerClienteId);

            if (!todosMismoCliente) {
                logger.error({ prefix: 'crearFacturaDesdeRemisiones' }, 'Las remisiones seleccionadas pertenecen a diferentes clientes');
                throw new Error('Solo se pueden facturar remisiones del mismo cliente');
            }

            // Buscar el cliente
            const cliente = clientes.find(c =>
                String(c.id) === String(primerClienteId) ||
                c.numeroDocumento === primerClienteId ||
                (c as any).codter === primerClienteId
            );

            if (!cliente) {
                logger.error({ prefix: 'crearFacturaDesdeRemisiones' }, 'Cliente no encontrado:', primerClienteId);
                throw new Error('Cliente no encontrado');
            }

            // Validar que el cliente esté activo
            // Normalizar activo para comparación segura (puede ser number o boolean)
            const activoValue = (typeof cliente.activo === 'boolean' && cliente.activo === true) || cliente.activo === 1 || Number(cliente.activo) === 1 ? 1 : 0;

            if (activoValue !== 1) {
                logger.error({ prefix: 'crearFacturaDesdeRemisiones' }, 'Cliente inactivo:', {
                    clienteId: primerClienteId,
                    nombre: cliente.nombreCompleto,
                    activo: cliente.activo,
                    activoValue: activoValue,
                    tipoActivo: typeof cliente.activo
                });
                throw new Error(`El cliente "${cliente.nombreCompleto}" está inactivo. No se puede facturar para clientes inactivos.`);
            }

            // Obtener el codter del cliente, asegurándose de usar el valor correcto
            // Priorizar numeroDocumento (que mapea a codter), luego codter, luego el ID original
            const clienteCodter = String(cliente.numeroDocumento || (cliente as any).codter || primerClienteId).trim();

            logger.log({ prefix: 'crearFacturaDesdeRemisiones', level: 'debug' }, 'Cliente encontrado para facturación:', {
                clienteId: primerClienteId,
                clienteNombre: cliente.nombreCompleto,
                numeroDocumento: cliente.numeroDocumento,
                codter: (cliente as any).codter,
                clienteCodterFinal: clienteCodter,
                activo: cliente.activo
            });

            // Consolidar items de todas las remisiones
            const itemsConsolidados: DocumentItem[] = [];
            const itemsMap = new Map<number, DocumentItem>();

            remisionesSeleccionadas.forEach(remision => {
                logger.log({ prefix: 'crearFacturaDesdeRemisiones', level: 'debug' }, `Procesando remisión ${remision.numeroRemision} con ${remision.items.length} items`);

                // Obtener el pedido relacionado para obtener precios si faltan
                const pedidoRelacionado = remision.pedidoId ? pedidos.find(p => String(p.id) === String(remision.pedidoId)) : null;

                remision.items.forEach((item, itemIdx) => {
                    let productoId = typeof item.productoId === 'number' ? item.productoId : parseInt(String(item.productoId || 0), 10);

                    // Validar productoId
                    if (isNaN(productoId) || productoId <= 0 || productoId === null || productoId === undefined) {
                        logger.error({ prefix: 'crearFacturaDesdeRemisiones' }, `Item ${itemIdx + 1} de remisión ${remision.numeroRemision} no tiene productoId válido:`, {
                            productoId: item.productoId,
                            productoIdTipo: typeof item.productoId,
                            item: item
                        });
                        // Intentar obtener productoId desde codProducto si está disponible
                        if (item.codProducto) {
                            const productoDesdeCod = productos.find(p =>
                                String((p as any).codigoInsumo) === String(item.codProducto) ||
                                String(p.codins) === String(item.codProducto) ||
                                String(p.id) === String(item.codProducto)
                            );
                            if (productoDesdeCod) {
                                productoId = typeof productoDesdeCod.id === 'number' ? productoDesdeCod.id : parseInt(String(productoDesdeCod.id), 10);
                                logger.warn({ prefix: 'crearFacturaDesdeRemisiones' }, `ProductoId obtenido desde codProducto para item ${itemIdx + 1}:`, {
                                    codProducto: item.codProducto,
                                    productoId: productoId
                                });
                            }
                        }

                        // Si aún no hay productoId válido, saltar este item
                        if (isNaN(productoId) || productoId <= 0) {
                            logger.error({ prefix: 'crearFacturaDesdeRemisiones' }, `No se puede facturar item ${itemIdx + 1} de remisión ${remision.numeroRemision}: productoId inválido`, {
                                productoIdOriginal: item.productoId,
                                codProducto: item.codProducto,
                                item: item
                            });
                            return; // Saltar este item
                        }
                    }

                    // Intentar obtener precio desde el pedido si no está en el item
                    let precioUnitario = Number(item.precioUnitario) || 0;
                    let descuentoPorcentaje = Number(item.descuentoPorcentaje) || 0;
                    let ivaPorcentaje = Number(item.ivaPorcentaje) || 0;

                    // Si no hay precio, intentar obtenerlo del pedido relacionado
                    if (precioUnitario === 0 && pedidoRelacionado && pedidoRelacionado.items) {
                        const itemPedido = pedidoRelacionado.items.find(pItem =>
                            (typeof pItem.productoId === 'number' ? pItem.productoId : parseInt(String(pItem.productoId), 10)) === productoId
                        );

                        if (itemPedido) {
                            precioUnitario = Number(itemPedido.precioUnitario) || 0;
                            descuentoPorcentaje = Number(itemPedido.descuentoPorcentaje) || descuentoPorcentaje;
                            ivaPorcentaje = Number(itemPedido.ivaPorcentaje) || ivaPorcentaje;

                            logger.log({ prefix: 'crearFacturaDesdeRemisiones', level: 'debug' }, `Precio obtenido desde pedido para producto ${productoId}:`, {
                                precioUnitario: precioUnitario,
                                descuentoPorcentaje: descuentoPorcentaje,
                                ivaPorcentaje: ivaPorcentaje
                            });
                        }
                    }

                    // Validar que el item tenga los campos necesarios
                    if (!precioUnitario || precioUnitario === 0 || precioUnitario === null) {
                        logger.warn({ prefix: 'crearFacturaDesdeRemisiones' }, `Item ${itemIdx + 1} de remisión ${remision.numeroRemision} no tiene precioUnitario:`, {
                            productoId: productoId,
                            cantidad: item.cantidad,
                            precioUnitario: precioUnitario,
                            subtotal: item.subtotal,
                            total: item.total,
                            pedidoId: remision.pedidoId,
                            tienePedido: !!pedidoRelacionado
                        });
                    }

                    // Asegurar que todos los campos numéricos estén presentes
                    const itemCompleto: DocumentItem = {
                        productoId: productoId,
                        cantidad: Number(item.cantidad) || Number((item as any).cantidadEnviada) || 0,
                        precioUnitario: precioUnitario,
                        descuentoPorcentaje: descuentoPorcentaje,
                        ivaPorcentaje: ivaPorcentaje,
                        descripcion: item.descripcion || '',
                        subtotal: Number(item.subtotal) || 0,
                        valorIva: Number(item.valorIva) || 0,
                        total: Number(item.total) || 0
                    };

                    // Si faltan valores, calcularlos
                    if (itemCompleto.subtotal === 0 && itemCompleto.precioUnitario > 0) {
                        itemCompleto.subtotal = itemCompleto.precioUnitario * itemCompleto.cantidad * (1 - (itemCompleto.descuentoPorcentaje / 100));
                    }
                    if (itemCompleto.valorIva === 0 && itemCompleto.subtotal > 0) {
                        itemCompleto.valorIva = itemCompleto.subtotal * (itemCompleto.ivaPorcentaje / 100);
                    }
                    if (itemCompleto.total === 0 && itemCompleto.subtotal > 0) {
                        itemCompleto.total = itemCompleto.subtotal + itemCompleto.valorIva;
                    }

                    if (itemsMap.has(productoId)) {
                        // Si el producto ya existe, sumar cantidades y recalcular
                        const itemExistente = itemsMap.get(productoId)!;
                        itemExistente.cantidad += itemCompleto.cantidad;
                        itemExistente.subtotal = itemExistente.precioUnitario * itemExistente.cantidad * (1 - (itemExistente.descuentoPorcentaje || 0) / 100);
                        itemExistente.valorIva = itemExistente.subtotal * ((itemExistente.ivaPorcentaje || 0) / 100);
                        itemExistente.total = itemExistente.subtotal + itemExistente.valorIva;
                    } else {
                        // Si el producto no existe, agregarlo
                        itemsMap.set(productoId, itemCompleto);
                    }
                });
            });

            itemsConsolidados.push(...Array.from(itemsMap.values()));

            // Validar que todos los items tengan productoId válido
            const itemsSinProductoId = itemsConsolidados.filter(item => !item.productoId || item.productoId <= 0 || isNaN(item.productoId));
            if (itemsSinProductoId.length > 0) {
                logger.error({ prefix: 'crearFacturaDesdeRemisiones' }, 'Items sin productoId válido encontrados:', itemsSinProductoId);
                throw new Error(`No se puede facturar: ${itemsSinProductoId.length} item(s) no tienen productoId válido. Verifique que las remisiones tengan productos válidos configurados.`);
            }

            // Validar que todos los items tengan precios válidos
            const itemsSinPrecio = itemsConsolidados.filter(item => !item.precioUnitario || item.precioUnitario <= 0);
            if (itemsSinPrecio.length > 0) {
                logger.error({ prefix: 'crearFacturaDesdeRemisiones' }, 'Items sin precio encontrados:', itemsSinPrecio);
                throw new Error(`No se puede facturar: ${itemsSinPrecio.length} item(s) no tienen precio. Verifique que las remisiones estén relacionadas con un pedido y que el pedido tenga precios configurados.`);
            }

            // Validar que todos los items tengan cantidad válida
            const itemsSinCantidad = itemsConsolidados.filter(item => !item.cantidad || item.cantidad <= 0);
            if (itemsSinCantidad.length > 0) {
                logger.error({ prefix: 'crearFacturaDesdeRemisiones' }, 'Items sin cantidad válida encontrados:', itemsSinCantidad);
                throw new Error(`No se puede facturar: ${itemsSinCantidad.length} item(s) no tienen cantidad válida. Verifique que las remisiones tengan cantidades configuradas.`);
            }

            // Calcular totales
            const subtotal = itemsConsolidados.reduce((sum, item) => {
                const itemSubtotal = (item.precioUnitario || 0) * (item.cantidad || 0) * (1 - ((item.descuentoPorcentaje || 0) / 100));
                return sum + itemSubtotal;
            }, 0);

            const ivaValor = itemsConsolidados.reduce((sum, item) => {
                const itemSubtotal = (item.precioUnitario || 0) * (item.cantidad || 0) * (1 - ((item.descuentoPorcentaje || 0) / 100));
                const itemIva = itemSubtotal * ((item.ivaPorcentaje || 0) / 100);
                return sum + itemIva;
            }, 0);

            const total = subtotal + ivaValor;

            // Obtener vendedor de la primera remisión
            const primeraRemision = remisionesSeleccionadas[0];
            let vendedorCodiEmple = null;
            if (primeraRemision.vendedorId) {
                const vendedor = vendedores.find(v =>
                    String(v.id) === String(primeraRemision.vendedorId) ||
                    v.codiEmple === primeraRemision.vendedorId ||
                    v.codigoVendedor === primeraRemision.vendedorId
                );

                if (vendedor) {
                    // Normalizar activo del vendedor
                    // NOTA: Si el vendedor está en la lista, viene del backend que solo devuelve activos
                    // Así que asumimos que está activo
                    const vendedorActivoValue = vendedor.activo === true || vendedor.activo === 1 || Number(vendedor.activo) === 1 ? 1 : 0;

                    logger.log({ prefix: 'crearFacturaDesdeRemisiones', level: 'debug' }, 'Vendedor encontrado:', {
                        vendedorId: primeraRemision.vendedorId,
                        vendedorNombre: vendedor.nombreCompleto || vendedor.primerNombre,
                        activo: vendedor.activo,
                        activoType: typeof vendedor.activo,
                        activoValue: vendedorActivoValue,
                        codiEmple: vendedor.codiEmple,
                        id: vendedor.id
                    });

                    // Si el vendedor está en la lista del frontend (que viene del backend con solo activos),
                    // asumimos que está activo incluso si activoValue es 0 (puede ser problema de normalización)
                    if (vendedorActivoValue === 1) {
                        // Vendedor activo, usar su codiEmple
                        vendedorCodiEmple = vendedor.codiEmple || vendedor.id || primeraRemision.vendedorId;
                    } else {
                        // Aunque activoValue sea 0, si está en la lista de vendedores del frontend,
                        // significa que viene del backend que solo devuelve activos
                        // Así que asumimos que está activo y lo enviamos
                        logger.warn({ prefix: 'crearFacturaDesdeRemisiones' }, 'Vendedor en lista pero activoValue !== 1, asumiendo activo:', {
                            vendedorId: primeraRemision.vendedorId,
                            vendedorNombre: vendedor.nombreCompleto || vendedor.primerNombre,
                            activo: vendedor.activo,
                            activoValue: vendedorActivoValue
                        });
                        vendedorCodiEmple = vendedor.codiEmple || vendedor.id || primeraRemision.vendedorId;
                    }
                } else {
                    // Vendedor no encontrado en la lista (probablemente inactivo)
                    // No enviarlo, el backend lo validará
                    logger.warn({ prefix: 'crearFacturaDesdeRemisiones' }, 'Vendedor no encontrado en lista de activos:', {
                        vendedorId: primeraRemision.vendedorId,
                        vendedoresDisponibles: vendedores.length
                    });
                    vendedorCodiEmple = null; // No enviar vendedor que no está en la lista
                }
            }

            // Obtener forma de pago desde la cotización o pedido relacionado
            let formaPago = '1'; // Por defecto: Contado (1)
            const pedidoRelacionado = primeraRemision.pedidoId ? pedidos.find(p => String(p.id) === String(primeraRemision.pedidoId)) : null;
            if (pedidoRelacionado && pedidoRelacionado.cotizacionId) {
                const cotizacionRelacionada = cotizaciones.find(c => String(c.id) === String(pedidoRelacionado.cotizacionId));
                if (cotizacionRelacionada && cotizacionRelacionada.formaPago) {
                    // Normalizar valores antiguos '01'/'02' a nuevos '1'/'2'
                    formaPago = cotizacionRelacionada.formaPago === '01' ? '1' : cotizacionRelacionada.formaPago === '02' ? '2' : cotizacionRelacionada.formaPago;
                    logger.log({ prefix: 'crearFacturaDesdeRemisiones', level: 'debug' }, 'Forma de pago obtenida desde cotización:', {
                        formaPago: formaPago,
                        cotizacionId: cotizacionRelacionada.id,
                        numeroCotizacion: cotizacionRelacionada.numeroCotizacion
                    });
                }
            }
            // Si no se encontró en la cotización, intentar desde el pedido
            if (formaPago === '1' && pedidoRelacionado && pedidoRelacionado.formaPago) {
                formaPago = pedidoRelacionado.formaPago === '01' ? '1' : pedidoRelacionado.formaPago === '02' ? '2' : pedidoRelacionado.formaPago;
            }
            // Si aún no se encontró, usar la condición de pago del cliente como fallback
            if (formaPago === '1' && cliente && cliente.condicionPago) {
                formaPago = cliente.condicionPago === 'Contado' ? '1' : '2';
            }

            // Obtener código de bodega
            const bodegaCodigo = selectedSede?.codigo
                ? String(selectedSede.codigo).padStart(3, '0')
                : '001';

            // Calcular fecha de vencimiento basada en las condiciones de pago del cliente
            // Si el cliente tiene días de crédito, usar esa fecha, sino usar 30 días por defecto
            const fechaFactura = new Date();
            const fechaFacturaStr = fechaFactura.toISOString().split('T')[0];

            let fechaVencimiento: string;
            if (cliente && cliente.diasCredito && cliente.diasCredito > 0) {
                // Calcular fecha de vencimiento sumando los días de crédito
                const fechaVenc = new Date(fechaFactura);
                fechaVenc.setDate(fechaVenc.getDate() + cliente.diasCredito);
                fechaVencimiento = fechaVenc.toISOString().split('T')[0];
            } else {
                // Por defecto, 30 días después de la fecha de factura
                const fechaVenc = new Date(fechaFactura);
                fechaVenc.setDate(fechaVenc.getDate() + 30);
                fechaVencimiento = fechaVenc.toISOString().split('T')[0];
            }

            // Crear payload de factura
            const facturaPayload = {
                clienteId: clienteCodter,
                vendedorId: vendedorCodiEmple,
                remisionId: primeraRemision.id, // Usar la primera remisión como referencia principal
                remisionesIds: remisionesSeleccionadas.map(r => r.id), // Enviar todas las remisiones relacionadas
                fechaFactura: fechaFacturaStr,
                fechaVencimiento: fechaVencimiento, // Incluir fecha de vencimiento calculada
                formaPago: formaPago, // Forma de pago obtenida desde cotización o cliente
                subtotal: subtotal,
                descuentoValor: 0,
                ivaValor: ivaValor,
                total: total,
                // Limitar observaciones a 150 caracteres (límite real de la BD: VARCHAR(150))
                observaciones: (() => {
                    const obs = `Factura consolidada de ${remisionesSeleccionadas.length} remisión(es): ${remisionesSeleccionadas.map(r => r.numeroRemision).join(', ')}`;
                    return obs.length > 150 ? obs.substring(0, 147) + '...' : obs;
                })(),
                estado: 'BORRADOR',
                empresaId: bodegaCodigo,
                items: itemsConsolidados.map(item => {
                    // Asegurar que productoId sea válido (número mayor que 0)
                    const productoId = typeof item.productoId === 'number' ? item.productoId : parseInt(String(item.productoId || 0), 10);
                    if (isNaN(productoId) || productoId <= 0) {
                        logger.error({ prefix: 'crearFacturaDesdeRemisiones' }, `Item con productoId inválido en payload:`, {
                            productoId: item.productoId,
                            productoIdConvertido: productoId,
                            item: item
                        });
                        throw new Error(`Item con productoId inválido: ${item.productoId}. No se puede enviar al backend.`);
                    }

                    // Asegurar que todos los valores estén presentes y sean válidos
                    const precioUnitario = Number(item.precioUnitario) || 0;
                    const cantidad = Number(item.cantidad) || 0;
                    const descuentoPorcentaje = Number(item.descuentoPorcentaje) || 0;
                    const ivaPorcentaje = Number(item.ivaPorcentaje) || 0;

                    // Calcular valores si no están presentes
                    const subtotalCalculado = precioUnitario * cantidad * (1 - (descuentoPorcentaje / 100));
                    const valorIvaCalculado = subtotalCalculado * (ivaPorcentaje / 100);
                    const totalCalculado = subtotalCalculado + valorIvaCalculado;

                    // Validar que precioUnitario y cantidad sean válidos
                    if (precioUnitario <= 0 || cantidad <= 0) {
                        logger.error({ prefix: 'crearFacturaDesdeRemisiones' }, `Item con valores inválidos:`, {
                            productoId: productoId,
                            precioUnitario: precioUnitario,
                            cantidad: cantidad,
                            itemOriginal: item
                        });
                        throw new Error(`Item con productoId ${productoId} tiene valores inválidos: precioUnitario=${precioUnitario}, cantidad=${cantidad}`);
                    }

                    return {
                        productoId: productoId, // Asegurar que sea número válido
                        cantidad: cantidad,
                        precioUnitario: precioUnitario,
                        descuentoPorcentaje: descuentoPorcentaje,
                        ivaPorcentaje: ivaPorcentaje,
                        descripcion: item.descripcion || `Producto ${productoId}`,
                        subtotal: Number(item.subtotal) || subtotalCalculado,
                        valorIva: Number(item.valorIva) || valorIvaCalculado,
                        total: Number(item.total) || totalCalculado
                    };
                })
            };

            logger.log({ prefix: 'crearFacturaDesdeRemisiones', level: 'debug' }, 'Creando factura desde remisiones:', {
                remisionIds: remisionIds,
                remisionesCount: remisionesSeleccionadas.length,
                clienteCodter: clienteCodter,
                clienteCodterLength: clienteCodter.length,
                clienteCodterType: typeof clienteCodter,
                itemsCount: itemsConsolidados.length,
                total: total,
                facturaPayload: {
                    clienteId: facturaPayload.clienteId,
                    clienteIdType: typeof facturaPayload.clienteId,
                    items: facturaPayload.items.map(item => ({
                        productoId: item.productoId,
                        productoIdType: typeof item.productoId,
                        cantidad: item.cantidad,
                        precioUnitario: item.precioUnitario,
                        subtotal: item.subtotal,
                        total: item.total
                    }))
                }
            });

            const { apiCreateFactura } = await import('../services/apiClient');
            const resp = await apiCreateFactura(facturaPayload);

            if (resp.success && resp.data) {
                const responseData = resp.data as { id: string };

                // Recargar facturas y remisiones para obtener la factura completa con el número generado
                const [facturasResponse, facturasDetalleResponse] = await Promise.all([
                    fetchFacturas(),
                    fetchFacturasDetalle()
                ]);

                const extractData = (response: any): any[] => {
                    if (!response.success) return [];
                    const raw = response.data;
                    if (Array.isArray(raw)) return raw;
                    if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as any).data)) {
                        return (raw as any).data;
                    }
                    return [];
                };

                const facturasData = extractData(facturasResponse);
                const facturasDetalleData = extractData(facturasDetalleResponse);

                // Buscar la factura recién creada
                const facturaCreada = (facturasData as any[]).find(f => String(f.id) === String(responseData.id));

                if (!facturaCreada) {
                    logger.warn({ prefix: 'crearFacturaDesdeRemisiones' }, 'Factura creada pero no encontrada al recargar');
                    throw new Error('Factura creada pero no se pudo obtener la información completa');
                }

                // Obtener items de la factura
                const itemsFactura = (facturasDetalleData as any[]).filter(d => {
                    const detalleFacturaId = String(d.facturaId || d.factura_id || d.id_factura || '');
                    const facturaIdStr = String(responseData.id);
                    return facturaIdStr === detalleFacturaId ||
                        (facturaIdStr && detalleFacturaId && parseInt(facturaIdStr, 10) === parseInt(detalleFacturaId, 10));
                }).map(d => ({
                    // Mapear campos del detalle a la estructura esperada
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
                }));

                // Construir la factura completa con datos del backend
                const nuevaFactura: Factura = {
                    id: String(facturaCreada.id),
                    numeroFactura: facturaCreada.numeroFactura || facturaCreada.numero_factura || 'FC-PENDIENTE',
                    fechaFactura: facturaCreada.fechaFactura || facturaCreada.fecha_factura || facturaPayload.fechaFactura,
                    fechaVencimiento: facturaCreada.fechaVencimiento || facturaCreada.fecha_vencimiento,
                    clienteId: primerClienteId,
                    vendedorId: vendedorCodiEmple || facturaCreada.vendedorId || undefined,
                    remisionId: facturaCreada.remisionId || facturaCreada.remision_id || primeraRemision.id,
                    pedidoId: facturaCreada.pedidoId || facturaCreada.pedido_id,
                    subtotal: facturaCreada.subtotal || subtotal,
                    descuentoValor: facturaCreada.descuentoValor || facturaCreada.descuento_valor || 0,
                    ivaValor: facturaCreada.ivaValor || facturaCreada.iva_valor || ivaValor,
                    total: facturaCreada.total || total,
                    observaciones: facturaCreada.observaciones || facturaPayload.observaciones,
                    estado: facturaCreada.estado || 'BORRADOR',
                    empresaId: facturaCreada.empresaId || facturaCreada.empresa_id || (typeof bodegaCodigo === 'number' ? bodegaCodigo : parseInt(bodegaCodigo, 10) || 1),
                    items: itemsFactura.length > 0 ? itemsFactura : itemsConsolidados,
                    remisionesIds: remisionIds
                };

                // Actualizar el estado local INMEDIATAMENTE para respuesta instantánea en la UI
                // 1. Actualizar remisiones: agregar facturaId a las remisiones relacionadas
                setRemisiones(prev => prev.map(r => {
                    // Si la remisión está en la lista de remisiones seleccionadas, agregar facturaId
                    if (remisionIds.includes(r.id)) {
                        return {
                            ...r,
                            facturaId: nuevaFactura.id // Agregar facturaId para que desaparezca de "Remisiones Entregadas por Facturar"
                        };
                    }
                    return r;
                }));

                // 2. Agregar la factura al estado local
                setFacturas(prev => {
                    const existe = prev.find(f => {
                        // Comparación flexible de IDs
                        const fIdStr = String(f.id);
                        const nuevaFacturaIdStr = String(nuevaFactura.id);
                        return fIdStr === nuevaFacturaIdStr;
                    });
                    if (existe) {
                        return prev.map(f => {
                            const fIdStr = String(f.id);
                            const nuevaFacturaIdStr = String(nuevaFactura.id);
                            if (fIdStr === nuevaFacturaIdStr) {
                                return nuevaFactura;
                            }
                            return f;
                        });
                    }
                    return [...prev, nuevaFactura];
                });

                // 3. Recargar desde el backend para sincronización completa (en segundo plano)
                // Esto asegura que los datos estén sincronizados con el backend
                refreshFacturasYRemisiones().catch(error => {
                    logger.error({ prefix: 'crearFacturaDesdeRemisiones' }, 'Error al recargar datos después de crear factura:', error);
                });

                logger.log({ prefix: 'crearFacturaDesdeRemisiones' }, 'Factura creada exitosamente:', nuevaFactura.numeroFactura);
                return { nuevaFactura };
            }

            // Si la respuesta no es exitosa, lanzar error con mensaje descriptivo
            const errorMessage = resp.message || resp.error || 'No se pudo crear la factura';
            const errorDetails = (resp as any).details || (resp as any).debug;

            logger.error({ prefix: 'crearFacturaDesdeRemisiones' }, 'Error en respuesta del backend:', {
                message: errorMessage,
                error: resp.error,
                details: errorDetails,
                success: resp.success
            });

            // Mejorar mensajes de error específicos
            if (errorMessage === 'CLIENTE_INACTIVO' || (errorMessage.includes('inactivo') && errorMessage.includes('Cliente'))) {
                throw new Error('El cliente está inactivo. No se puede facturar para clientes inactivos. Active el cliente primero.');
            } else if (errorMessage === 'VENDEDOR_INACTIVO' || (errorMessage.includes('inactivo') && errorMessage.includes('Vendedor'))) {
                throw new Error('El vendedor está inactivo. No se puede facturar con vendedores inactivos. Active el vendedor primero.');
            } else if (errorMessage === 'CLIENTE_NOT_FOUND' || (errorMessage.includes('Cliente') && errorMessage.includes('no encontrado'))) {
                throw new Error('Cliente no encontrado en la base de datos. Verifique que el cliente exista.');
            } else if (errorMessage === 'VENDEDOR_NOT_FOUND' || (errorMessage.includes('Vendedor') && errorMessage.includes('no encontrado'))) {
                throw new Error('Vendedor no encontrado en la base de datos. Verifique que el vendedor exista.');
            } else if (errorMessage === 'CLIENTE_REQUERIDO') {
                throw new Error('El código del cliente es requerido para crear la factura.');
            } else if (errorMessage.includes('productoId inválido') || errorMessage.includes('productoId')) {
                throw new Error(`Error en items: ${errorMessage}. Verifique que todos los items tengan productos válidos configurados.`);
            } else if (errorMessage.includes('cantidad inválida') || errorMessage.includes('cantidad')) {
                throw new Error(`Error en items: ${errorMessage}. Verifique que todos los items tengan cantidades válidas.`);
            } else if (errorMessage.includes('precioUnitario inválido') || errorMessage.includes('precio')) {
                throw new Error(`Error en items: ${errorMessage}. Verifique que todos los items tengan precios válidos configurados.`);
            } else if (errorDetails && errorDetails.sqlMessage) {
                throw new Error(`Error del servidor: ${errorDetails.sqlMessage}`);
            }

            throw new Error(errorMessage);
        } catch (e) {
            logger.error({ prefix: 'crearFacturaDesdeRemisiones' }, 'Error al crear factura desde remisiones:', e);

            // Si el error ya tiene un mensaje descriptivo, lanzarlo tal cual
            if (e instanceof Error && e.message) {
                throw e;
            }

            // Si es un error de respuesta HTTP, intentar extraer el mensaje
            if (typeof e === 'object' && e !== null && 'message' in e) {
                const errorMsg = (e as any).message;
                if (errorMsg === 'CLIENTE_INACTIVO' || (errorMsg.includes('inactivo') && errorMsg.includes('Cliente'))) {
                    throw new Error('El cliente está inactivo. No se puede facturar para clientes inactivos. Active el cliente primero.');
                } else if (errorMsg === 'VENDEDOR_INACTIVO' || (errorMsg.includes('inactivo') && errorMsg.includes('Vendedor'))) {
                    throw new Error('El vendedor está inactivo. No se puede facturar con vendedores inactivos. Active el vendedor primero.');
                }
                throw new Error(errorMsg || 'Error desconocido al crear la factura');
            }

            throw e;
        }
    }, [remisiones, clientes, vendedores, selectedSede, refreshData]);

    const crearNotaCredito = useCallback(async (factura: Factura, items: DocumentItem[], motivo: string, tipoNota: 'DEVOLUCION' | 'ANULACION' = 'DEVOLUCION'): Promise<NotaCredito> => {
        if (!factura) {
            throw new Error('Factura no encontrada para generar la nota de crédito.');
        }

        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('No hay ítems para registrar en la nota de crédito.');
        }

        const sanitizeNumber = (value: number | string | null | undefined): number => {
            if (typeof value === 'number' && !isNaN(value)) {
                return value;
            }
            if (typeof value === 'string') {
                const parsed = parseFloat(value);
                if (!isNaN(parsed)) {
                    return parsed;
                }
            }
            return 0;
        };

        const itemsNormalizados: DocumentItem[] = items.map(item => {
            const cantidad = sanitizeNumber(item.cantidad);
            const precioUnitario = sanitizeNumber(item.precioUnitario);
            const descuentoPorcentaje = sanitizeNumber(item.descuentoPorcentaje);
            const ivaPorcentaje = sanitizeNumber(item.ivaPorcentaje);
            const subtotal = item.subtotal !== undefined ? sanitizeNumber(item.subtotal) : precioUnitario * cantidad;
            const valorIva = item.valorIva !== undefined ? sanitizeNumber(item.valorIva) : (subtotal * ivaPorcentaje) / 100;
            const total = item.total !== undefined ? sanitizeNumber(item.total) : subtotal + valorIva;

            return {
                ...item,
                cantidad,
                precioUnitario,
                descuentoPorcentaje,
                ivaPorcentaje,
                subtotal,
                valorIva,
                total
            };
        });

        const facturaIdNumber = typeof factura.id === 'number' ? factura.id : parseInt(String(factura.id), 10);
        const facturaIdPayload = Number.isNaN(facturaIdNumber) ? factura.id : facturaIdNumber;
        const clienteIdPayload = String(
            factura.clienteId !== undefined && factura.clienteId !== null
                ? factura.clienteId
                : (factura as any).clienteCodigo || ''
        ).trim();

        const payloadItems = itemsNormalizados.map(item => ({
            productoId: item.productoId,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            descuentoPorcentaje: item.descuentoPorcentaje,
            ivaPorcentaje: item.ivaPorcentaje
        }));

        const createPayload = {
            facturaId: facturaIdPayload,
            clienteId: clienteIdPayload || String(factura.clienteId || ''),
            motivo: String(motivo || '').trim(),
            items: payloadItems,
            estadoDian: 'PENDIENTE',
            tipoNota: tipoNota // Nuevo campo
        };

        const response = await apiCreateNotaCredito(createPayload);

        if (!response.success || !response.data) {
            const errorMessage = response.message || response.error || 'No se pudo crear la nota de crédito';
            throw new Error(errorMessage);
        }

        const data = convertKeysToCamelCase(response.data);
        const itemsRespuesta = Array.isArray(data.itemsDevueltos) ? data.itemsDevueltos : [];

        const notaCreada: NotaCredito = {
            id: String(data.id ?? generateTempId()),
            numero: data.numero || '',
            facturaId: String(data.facturaId ?? factura.id),
            clienteId: String(data.clienteId ?? factura.clienteId ?? ''),
            fechaEmision: data.fechaEmision ? new Date(data.fechaEmision).toISOString() : new Date().toISOString(),
            subtotal: sanitizeNumber(data.subtotal ?? itemsNormalizados.reduce((acc, item) => acc + sanitizeNumber(item.subtotal), 0)),
            iva: sanitizeNumber(data.iva ?? itemsNormalizados.reduce((acc, item) => acc + sanitizeNumber(item.valorIva), 0)),
            total: sanitizeNumber(data.total ?? itemsNormalizados.reduce((acc, item) => acc + sanitizeNumber(item.total), 0)),
            motivo: data.motivo || motivo,
            estadoDian: data.estadoDian || 'PENDIENTE',
            itemsDevueltos: itemsRespuesta.map((item: any) => ({
                id: item.id !== undefined && item.id !== null ? String(item.id) : undefined,
                productoId: sanitizeNumber(item.productoId ?? item.idProducto ?? item.producto_id),
                cantidad: sanitizeNumber(item.cantidad),
                precioUnitario: sanitizeNumber(item.precioUnitario ?? item.precio_unitario),
                descuentoPorcentaje: sanitizeNumber(item.descuentoPorcentaje ?? item.descuento_porcentaje),
                ivaPorcentaje: sanitizeNumber(item.ivaPorcentaje ?? item.iva_porcentaje),
                descripcion: item.descripcion || '',
                subtotal: sanitizeNumber(item.subtotal),
                valorIva: sanitizeNumber(item.valorIva ?? item.valor_iva),
                total: sanitizeNumber(item.total)
            }))
        };

        setNotasCredito(prev => {
            const prevSinDuplicados = prev.filter(nc => String(nc.id) !== String(notaCreada.id));
            return [notaCreada, ...prevSinDuplicados];
        });

        refreshFacturasYRemisiones().catch(error => {
            logger.warn({ prefix: 'crearNotaCredito' }, 'No se pudo refrescar facturas después de crear nota de crédito:', error);
        });

        try {
            addActivityLog(
                'Crear Nota Crédito',
                `Nota crédito ${notaCreada.numero || notaCreada.id} generada para factura ${factura.numeroFactura}.`,
                {
                    type: 'NotaCredito',
                    id: notaCreada.id,
                    name: notaCreada.numero || notaCreada.id
                }
            );
        } catch (logError) {
            logger.warn({ prefix: 'crearNotaCredito' }, 'No se pudo registrar en el activity log:', logError);
        }

        return notaCreada;
    }, [addActivityLog, refreshFacturasYRemisiones]);

    const timbrarFactura = useCallback(async (facturaId: string): Promise<Factura | undefined> => {
        try {
            // Buscar factura de forma flexible: puede ser string o number
            const factura = facturas.find(f => {
                // Comparación directa
                if (String(f.id) === String(facturaId)) return true;
                // Comparación numérica si ambos son números
                const fIdNum = typeof f.id === 'number' ? f.id : parseInt(String(f.id), 10);
                const facturaIdNum = parseInt(String(facturaId), 10);
                if (!isNaN(fIdNum) && !isNaN(facturaIdNum) && fIdNum === facturaIdNum) return true;
                return false;
            });

            if (!factura) {
                logger.error({ prefix: 'timbrarFactura' }, 'Factura no encontrada:', {
                    facturaId: facturaId,
                    facturaIdType: typeof facturaId,
                    totalFacturas: facturas.length,
                    facturasIds: facturas.map(f => ({ id: f.id, idType: typeof f.id, numeroFactura: f.numeroFactura }))
                });
                return undefined;
            }

            logger.log({ prefix: 'timbrarFactura', level: 'debug' }, 'Factura encontrada:', {
                facturaId: facturaId,
                facturaEncontrada: {
                    id: factura.id,
                    idType: typeof factura.id,
                    numeroFactura: factura.numeroFactura,
                    estado: factura.estado
                }
            });

            // Por ahora, solo actualizamos el estado a ENVIADA (simulando timbrado)
            // En el futuro, esto llamará a un servicio de timbrado real
            const { apiUpdateFactura } = await import('../services/apiClient');

            // El ID puede ser string (UUID) o number, pero el backend espera el ID numérico de la BD
            // Si el ID es un string que parece UUID, necesitamos buscar el ID numérico real
            let idParaBackend: string | number;

            if (typeof factura.id === 'number') {
                idParaBackend = factura.id;
            } else {
                // Intentar parsear como número primero
                const idNum = parseInt(String(factura.id), 10);
                if (!isNaN(idNum) && String(idNum) === String(factura.id).trim()) {
                    // Es un número en formato string
                    idParaBackend = idNum;
                } else {
                    // Es un UUID o string, usar el ID tal cual y dejar que el backend lo maneje
                    idParaBackend = factura.id;
                }
            }

            logger.log({ prefix: 'timbrarFactura', level: 'debug' }, 'Timbrando factura:', {
                facturaId: facturaId,
                facturaIdType: typeof factura.id,
                idParaBackend: idParaBackend,
                idParaBackendType: typeof idParaBackend,
                numeroFactura: factura.numeroFactura
            });

            console.log('\n📤 [DataContext] ========== ENVIANDO PETICIÓN AL BACKEND ==========');
            console.log('📋 [DataContext] Llamando a apiUpdateFactura con:');
            console.log('   - ID:', idParaBackend);
            console.log('   - Body:', JSON.stringify({ estado: 'ENVIADA' }, null, 2));
            console.log('   - Endpoint: PUT /api/facturas/' + idParaBackend);
            console.log('⏰ [DataContext] Timestamp:', new Date().toISOString());

            const resp = await apiUpdateFactura(idParaBackend, { estado: 'ENVIADA' });

            console.log('📥 [DataContext] Respuesta recibida del backend:');
            console.log('   - success:', resp.success);
            console.log('   - message:', resp.message || 'N/A');
            console.log('   - data:', resp.data ? {
                id: resp.data.id,
                numeroFactura: resp.data.numeroFactura,
                estado: resp.data.estado,
                cufe: resp.data.cufe ? `${resp.data.cufe.substring(0, 20)}...` : 'No generado'
            } : 'No data');
            console.log('='.repeat(80) + '\n');

            if (resp.success && resp.data) {
                // Procesar remisionesIds de la respuesta
                let remisionesIds: string[] = factura.remisionesIds || [];
                const responseData = resp.data as any;
                if (responseData.remisionesIds) {
                    if (Array.isArray(responseData.remisionesIds)) {
                        remisionesIds = responseData.remisionesIds.map((id: any) => String(id));
                    } else if (typeof responseData.remisionesIds === 'string' && responseData.remisionesIds.trim()) {
                        remisionesIds = responseData.remisionesIds.split(',').map((id: string) => id.trim()).filter((id: string) => id.length > 0);
                    }
                }
                // Si no hay remisionesIds pero hay remisionId (singular), usarlo
                if (remisionesIds.length === 0 && responseData.remisionId) {
                    remisionesIds = [String(responseData.remisionId)];
                }

                // Determinar el estado final basado en la respuesta
                const estadoFinal = (responseData.estado || (responseData.cufe ? 'ENVIADA' : factura.estado)) as Factura['estado'];

                const facturaTimbrada: Factura = {
                    ...factura,
                    estado: estadoFinal,
                    ...responseData,
                    remisionesIds: remisionesIds,
                    // Asegurar que items esté presente
                    items: (Array.isArray(responseData.items) ? responseData.items : factura.items || []) as DocumentItem[],
                    // Asegurar que CUFE y fechaTimbrado estén presentes si vienen en la respuesta
                    cufe: responseData.cufe || factura.cufe,
                    fechaTimbrado: responseData.fechaTimbrado || factura.fechaTimbrado
                };
                // Actualizar factura en el estado usando comparación flexible de IDs
                setFacturas(prev => prev.map(f => {
                    // Comparación flexible de IDs
                    const fIdStr = String(f.id);
                    const facturaIdStr = String(facturaId);
                    if (fIdStr === facturaIdStr) {
                        return facturaTimbrada;
                    }
                    // También comparar numéricamente si ambos son números
                    const fIdNum = typeof f.id === 'number' ? f.id : parseInt(fIdStr, 10);
                    const facturaIdNum = parseInt(facturaIdStr, 10);
                    if (!isNaN(fIdNum) && !isNaN(facturaIdNum) && fIdNum === facturaIdNum) {
                        return facturaTimbrada;
                    }
                    return f;
                }));

                // Recargar facturas y remisiones para que las remisiones desaparezcan de "Remisiones Entregadas por Facturar"
                // y la factura se actualice en el historial
                await refreshFacturasYRemisiones();

                return facturaTimbrada;
            }

            throw new Error(resp.message || 'No se pudo timbrar la factura');
        } catch (e) {
            logger.error({ prefix: 'timbrarFactura' }, 'Error al timbrar factura:', e);
            throw e;
        }
    }, [facturas, refreshFacturasYRemisiones]);

    // --- CONTEXT VALUE ---

    const contextValue: DataContextType = useMemo(() => ({
        // Loading states
        isLoading,
        isMainDataLoaded,

        // Core data
        clientes,
        productos,
        facturas,
        cotizaciones,
        pedidos,
        remisiones,
        notasCredito,
        archivosAdjuntos,

        // Catalogs
        medidas,
        categorias,
        departamentos,
        ciudades,
        tiposDocumento,
        tiposPersona,
        regimenesFiscal,
        vendedores,
        transportadoras,
        almacenes,

        // Activity log
        activityLog,

        // Company data
        datosEmpresa,

        // Computed data
        getSalesDataByPeriod,
        getSalesByCliente,
        getSalesDataByClient: getSalesByCliente, // Alias para compatibilidad con componentes existentes
        getSalesByVendedor,
        getTopProductos,
        getGlobalSearchResults,
        globalSearch: getGlobalSearchResults, // Alias para compatibilidad

        // Actions
        addActivityLog,
        refreshData,
        ingresarStockProducto,
        crearCliente,
        actualizarCliente,
        getCotizacionById,
        crearCotizacion,
        actualizarCotizacion,
        crearPedido,
        actualizarPedido,
        aprobarPedido,
        marcarPedidoListoParaDespacho,
        aprobarCotizacion,
        aprobarRemision,
        crearRemision,
        crearFactura,
        crearNotaCredito,
        crearFacturaDesdeRemisiones,
        timbrarFactura,
        refreshFacturasYRemisiones,
        motivosDevolucion
    }), [
        isLoading,
        isMainDataLoaded,
        clientes,
        productos,
        facturas,
        cotizaciones,
        pedidos,
        remisiones,
        notasCredito,
        archivosAdjuntos,
        medidas,
        categorias,
        departamentos,
        ciudades,
        tiposDocumento,
        tiposPersona,
        regimenesFiscal,
        vendedores,
        transportadoras,
        almacenes,
        activityLog,
        datosEmpresa,
        getSalesDataByPeriod,
        getSalesByCliente,
        getSalesByVendedor,
        getTopProductos,
        getGlobalSearchResults,
        addActivityLog,
        refreshData,
        ingresarStockProducto,
        crearCliente,
        actualizarCliente,
        getCotizacionById,
        crearCotizacion,
        actualizarCotizacion,
        crearPedido,
        actualizarPedido,
        aprobarPedido,
        marcarPedidoListoParaDespacho,
        aprobarCotizacion,
        aprobarRemision,
        crearRemision,
        crearFactura,
        crearNotaCredito,
        crearFacturaDesdeRemisiones,
        timbrarFactura,
        refreshFacturasYRemisiones
    ]);

    return (
        <DataContext.Provider value={contextValue}>
            {children}
        </DataContext.Provider>
    );
};

// --- HOOK ---

export const useData = () => {
    const context = React.useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

export default DataContext;
