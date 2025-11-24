import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Table, { Column } from '../components/ui/Table';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Remision, DocumentItem, Pedido, Producto, Cliente } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import { useNavigation } from '../hooks/useNavigation';
import Modal from '../components/ui/Modal';
import { useTable } from '../hooks/useTable';
import { TableToolbar } from '../components/ui/TableToolbar';
import TablePagination from '../components/ui/TablePagination';
import { useNotifications } from '../hooks/useNotifications';
import ApprovalSuccessModal from '../components/ui/ApprovalSuccessModal';
import { ProgressFlow, ProgressStep } from '../components/ui/ProgressFlow';
import RemisionPreviewModal from '../components/remisiones/RemisionPreviewModal';
import ProtectedComponent from '../components/auth/ProtectedComponent';
import { useData } from '../hooks/useData';
import { apiClient, fetchPedidosDetalle } from '../services/apiClient';
import { formatDateOnly } from '../utils/formatters';
// Supabase eliminado: descarga de adjuntos se implementará vía backend

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
}

interface RemisionItemForm {
    productoId: number;
    referencia: string;
    descripcion: string;
    unidadMedida: string;
    cantPedida: number;
    cantYaEnviada: number;
    cantPendiente: number;
    cantStock: number;
    cantAEnviar: number;
}

type RemisionGroup = {
    id: string;
    pedido: Pedido;
    remisiones: Remision[];
    cliente: Cliente | undefined;
};

const groupFilterOptions = [
    { label: 'Todos', value: 'Todos' },
    { label: 'En Proceso', value: 'EN_PROCESO' },
    { label: 'Remisionado Parcial', value: 'PARCIALMENTE_REMITIDO' },
    { label: 'Remisionado Total', value: 'REMITIDO' },
];

const RemisionesPage: React.FC = () => {
  const { params, setPage } = useNavigation();
  const { addNotification } = useNotifications();
  
  const { 
    pedidos,
    clientes, 
    productos: allProducts,
    aprobarRemision,
    crearRemision,
    archivosAdjuntos,
  } = useData();

  // Estados para paginación del servidor
  const [remisiones, setRemisiones] = useState<Remision[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100); // Aumentar pageSize para cargar más remisiones
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingRemisiones, setIsLoadingRemisiones] = useState(false);

  // La sincronización automática de estados se hace en el backend cuando se obtienen los pedidos
  // No es necesario forzar un refresh aquí, ya que causaría un ciclo infinito

  const [statusFilter, setStatusFilter] = useState('Todos');
  
  // Función para cargar remisiones (extraída para poder reutilizarla)
  const loadRemisiones = useCallback(async () => {
    setIsLoadingRemisiones(true);
    try {
      // NO filtrar por estado de remisión en el backend, ya que el filtro es por estado de pedido
      // El filtrado por estado del pedido se hace en el frontend después de agrupar
      // Solo enviar searchTerm si tiene al menos 2 caracteres
      const trimmedSearch = searchTerm.trim();
      const searchToSend = trimmedSearch.length >= 2 ? trimmedSearch : undefined;
      
      const remisionesRes = await apiClient.getRemisiones(
        currentPage, 
        pageSize, 
        searchToSend,
        undefined, // codter - ahora se maneja con searchTerm
        undefined, // codalm
        undefined // No filtrar por estado de remisión aquí, se filtra por estado de pedido en el frontend
      );
      if (remisionesRes.success) {
        // OPTIMIZACIÓN: No cargar todos los detalles al inicio (lazy loading)
        // Los detalles se cargarán solo cuando se abra el modal de una remisión específica
        // Esto hace que la carga inicial sea mucho más rápida
        const remisionesData = (remisionesRes.data as any[]) || [];
        const remisionesConDetalles = remisionesData.map(r => {
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
            estado: r.estado || 'BORRADOR',
            empresaId: r.empresaId || r.codalm || '001',
            codalm: r.codalm || r.empresaId || '001',
            items: [], // Los items se cargarán bajo demanda cuando se abra el modal
            estadoEnvio: r.estadoEnvio || undefined,
            metodoEnvio: r.metodoEnvio || undefined,
            transportadoraId: r.transportadoraId || undefined,
            transportadora: r.transportadora || undefined,
            numeroGuia: r.numeroGuia || undefined,
            fechaDespacho: r.fechaDespacho || undefined,
            fechaCreacion: r.fechaCreacion || r.fecsys || undefined,
            codUsuario: r.codUsuario || r.codusu || undefined
          } as Remision;
        });
        
        setRemisiones(remisionesConDetalles);
        
        // OPTIMIZACIÓN: Log en desarrollo para debugging
        if (process.env.NODE_ENV === 'development') {
          console.log('📦 [RemisionesPage] Remisiones cargadas:', remisionesConDetalles.length);
          console.log('📋 [RemisionesPage] Ejemplos de remisiones:', remisionesConDetalles.slice(0, 5).map(r => ({
            id: r.id,
            numeroRemision: r.numeroRemision,
            pedidoId: r.pedidoId,
            estado: r.estado,
            clienteId: r.clienteId
          })));
          console.log('📊 [RemisionesPage] Resumen de remisiones:', {
            total: remisionesConDetalles.length,
            conPedido: remisionesConDetalles.filter(r => r.pedidoId).length,
            sinPedido: remisionesConDetalles.filter(r => !r.pedidoId).length,
            porEstado: remisionesConDetalles.reduce((acc, r) => {
              const estado = r.estado || 'SIN_ESTADO';
              acc[estado] = (acc[estado] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          });
        }
        
        // Usar información de paginación del servidor
        if ((remisionesRes as any).pagination) {
          setTotalItems((remisionesRes as any).pagination.total);
          setTotalPages((remisionesRes as any).pagination.totalPages);
        }
      }
    } catch (error) {
      console.error('Error cargando remisiones:', error);
      addNotification({ message: 'Error al cargar remisiones', type: 'error' });
    } finally {
      setIsLoadingRemisiones(false);
    }
  }, [currentPage, pageSize, searchTerm, addNotification]);

  // Cargar remisiones inicialmente y cuando cambian page/pageSize (sin debounce)
  useEffect(() => {
    loadRemisiones();
  }, [currentPage, pageSize, loadRemisiones]);

  // Recargar remisiones cuando los pedidos cambien (para re-agrupar con pedidos que se cargaron después)
  useEffect(() => {
    // Solo recargar si ya tenemos remisiones cargadas (para evitar recargas innecesarias al inicio)
    if (remisiones.length > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 [RemisionesPage] Pedidos actualizados, re-agrupando remisiones...');
      }
      // No llamar loadRemisiones aquí porque solo necesitamos re-agrupar, no recargar desde el backend
      // El useMemo de remisionGroups se actualizará automáticamente cuando pedidos cambie
    }
  }, [pedidos.length]); // Solo cuando cambia la cantidad de pedidos

  // Cargar remisiones con debounce cuando cambia searchTerm
  useEffect(() => {
    // Validar que el searchTerm tenga al menos 2 caracteres, o esté vacío para mostrar todo
    const trimmedSearch = searchTerm.trim();
    const shouldSearch = trimmedSearch.length === 0 || trimmedSearch.length >= 2;
    
    if (!shouldSearch && trimmedSearch.length === 1) {
      // Si tiene 1 carácter, no buscar (esperar más caracteres)
      return;
    }
    
    // Si el searchTerm cambió y es válido, resetear a página 1
    if (trimmedSearch.length >= 2) {
      setCurrentPage(1);
    }
    
    // Debounce para búsqueda: esperar 500ms después de que el usuario deje de escribir
    // Si no hay búsqueda, cargar inmediatamente (pero solo si searchTerm cambió, no en carga inicial)
    const timeoutId = setTimeout(() => {
      loadRemisiones();
    }, trimmedSearch.length > 0 ? 500 : 0);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm, loadRemisiones]);
  
  // Handlers para paginación
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
    setCurrentPage(1); // Reset a primera página al buscar
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset a primera página al cambiar tamaño
  };

  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  
  const [selectedGroup, setSelectedGroup] = useState<RemisionGroup | null>(null);
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);

  const [pedidoToRemisionar, setPedidoToRemisionar] = useState<Pedido | null>(null);
  const [remisionItems, setRemisionItems] = useState<RemisionItemForm[]>([]);
  
  // State for new logistic details
  const [fechaDespacho, setFechaDespacho] = useState(new Date().toISOString().split('T')[0]);
  const [observacionesInternas, setObservacionesInternas] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [remisionToPreview, setRemisionToPreview] = useState<Remision | null>(null);

  const [remisionSuccessData, setRemisionSuccessData] = useState<Remision | null>(null);
  const [deliveryResult, setDeliveryResult] = useState<Remision | null>(null);
  
  const [isCreating, setIsCreating] = useState(false);
  const [isDelivering, setIsDelivering] = useState<string | null>(null);
  const [loadingRemisionDetails, setLoadingRemisionDetails] = useState<Set<string>>(new Set());

  // Solo mostrar pedidos CONFIRMADO en "Listos para Despacho"
  // Excluir explícitamente pedidos que ya fueron completamente remitidos (REMITIDO)
  // Los pedidos con estado REMITIDO ya fueron totalmente remitidos y no deben aparecer aquí
  const pedidosPorRemisionar = useMemo(() => {
    const filtrados = pedidos.filter(p => {
      // Solo mostrar pedidos en estado CONFIRMADO
      // Excluir explícitamente REMITIDO (completamente remitido)
      // También excluir otros estados que no deberían aparecer
      if (p.estado === 'REMITIDO') {
        // Pedido completamente remitido - NO debe aparecer en "Listos para Despacho"
        return false;
      }
      
      // Solo mostrar pedidos CONFIRMADO (listos para ser remitidos por primera vez)
      return p.estado === 'CONFIRMADO';
    });
    
    return filtrados;
  }, [pedidos]);

  // OPTIMIZACIÓN: Crear mapas de búsqueda rápida para pedidos y clientes (O(1) en lugar de O(n))
  const pedidosMap = useMemo(() => {
    const map = new Map<string, Pedido>();
    pedidos.forEach(p => {
      const key = String(p.id);
      map.set(key, p);
      // También indexar por número de pedido por si acaso
      if (p.numeroPedido) {
        map.set(p.numeroPedido, p);
      }
    });
    
    // OPTIMIZACIÓN: Log en desarrollo para debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('🗺️ [RemisionesPage] Mapa de pedidos creado:', {
        totalPedidos: pedidos.length,
        pedidosEnMapa: map.size,
        estados: Array.from(map.values()).reduce((acc, p) => {
          const estado = p.estado || 'SIN_ESTADO';
          acc[estado] = (acc[estado] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
    }
    
    return map;
  }, [pedidos]);

  const clientesMap = useMemo(() => {
    const map = new Map<string, Cliente>();
    clientes.forEach(c => {
      // Indexar por múltiples claves para búsqueda rápida
      const idKey = String(c.id);
      map.set(idKey, c);
      if (c.numeroDocumento) {
        map.set(c.numeroDocumento, c);
      }
      if (c.codter) {
        map.set(c.codter, c);
      }
    });
    return map;
  }, [clientes]);

  // Función helper optimizada para buscar cliente
  const findCliente = useCallback((clienteId: string | undefined): Cliente | undefined => {
    if (!clienteId) return undefined;
    const key = String(clienteId);
    return clientesMap.get(key);
  }, [clientesMap]);

  // Función helper optimizada para buscar pedido
  const findPedido = useCallback((pedidoId: string | number | undefined): Pedido | undefined => {
    if (!pedidoId) return undefined;
    const key = String(pedidoId);
    return pedidosMap.get(key);
  }, [pedidosMap]);

  const remisionGroups = useMemo(() => {
    const groups: { [pedidoId: string]: RemisionGroup } = {};
    
    // OPTIMIZACIÓN: Solo logs en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('📦 [RemisionesPage] Procesando', remisiones.length, 'remisiones');
      console.log('📦 [RemisionesPage] Ejemplos de remisiones:', remisiones.slice(0, 3).map(r => ({
        id: r.id,
        numeroRemision: r.numeroRemision,
        pedidoId: r.pedidoId,
        estado: r.estado,
        clienteId: r.clienteId
      })));
    }

    // OPTIMIZACIÓN: Iterar una sola vez y usar mapas para búsquedas rápidas
    remisiones.forEach(remision => {
        const pedidoIdStr = remision.pedidoId ? String(remision.pedidoId) : null;
        const pedido = pedidoIdStr ? findPedido(pedidoIdStr) : null;
        
        if (pedido) {
            // Remisión con pedido encontrado - agrupar por pedido (INCLUYE PEDIDOS REMITIDOS)
            const pedidoIdKey = pedidoIdStr!;
            if (!groups[pedidoIdKey]) {
                const cliente = findCliente(pedido.clienteId);
                groups[pedidoIdKey] = {
                    id: pedido.id,
                    pedido: pedido,
                    remisiones: [],
                    cliente: cliente,
                };
            }
            groups[pedidoIdKey].remisiones.push(remision);
        } else {
            // Remisión sin pedido o pedido no encontrado - crear grupo individual
            // IMPORTANTE: Esto incluye remisiones con pedido_id NULL y remisiones cuyo pedido no está cargado todavía
            const sinPedidoKey = `sin-pedido-${remision.id}`;
            if (!groups[sinPedidoKey]) {
                const clienteRemision = findCliente(remision.clienteId);
                
                // Determinar el estado del pedido fantasma basado en si hay un pedidoId pero no se encontró
                // Si tiene pedidoId pero no se encontró, puede ser un pedido REMITIDO que aún no se cargó
                let estadoFantasma = 'REMITIDO'; // Por defecto REMITIDO para remisiones sin pedido
                if (pedidoIdStr && !pedido) {
                    // Hay un pedidoId pero no se encontró el pedido - podría estar en estado REMITIDO
                    estadoFantasma = 'REMITIDO';
                }
                
                // Crear un pedido "fantasma" para mantener la estructura
                const pedidoFantasma: Pedido = {
                    id: `sin-pedido-${remision.id}`,
                    numeroPedido: pedidoIdStr ? `Pedido ${pedidoIdStr} (No encontrado)` : `Sin Pedido (${remision.numeroRemision})`,
                    fechaPedido: remision.fechaRemision || new Date().toISOString().split('T')[0],
                    clienteId: remision.clienteId || '',
                    vendedorId: remision.vendedorId || '',
                    subtotal: remision.subtotal || 0,
                    descuentoValor: remision.descuentoValor || 0,
                    ivaValor: remision.ivaValor || 0,
                    total: remision.total || 0,
                    estado: estadoFantasma,
                    observaciones: pedidoIdStr ? `Remisión asociada a pedido ${pedidoIdStr} (pedido no encontrado en contexto)` : 'Remisión sin pedido asociado',
                    items: remision.items || [],
                    empresaId: remision.empresaId || '001'
                };
                
                groups[sinPedidoKey] = {
                    id: pedidoFantasma.id,
                    pedido: pedidoFantasma,
                    remisiones: [],
                    cliente: clienteRemision,
                };
            }
            groups[sinPedidoKey].remisiones.push(remision);
        }
    });

    // OPTIMIZACIÓN: Ordenar solo una vez después de agrupar
    const groupsArray = Object.values(groups);
    
    // Sort remisiones within each group by date (más eficiente hacerlo aquí)
    groupsArray.forEach(group => {
        group.remisiones.sort((a, b) => {
            const dateA = new Date(a.fechaRemision).getTime();
            const dateB = new Date(b.fechaRemision).getTime();
            return dateA - dateB;
        });
    });

    // Sort groups by most recent remision date
    const sortedGroups = groupsArray.sort((a, b) => {
        if (a.remisiones.length === 0) return 1;
        if (b.remisiones.length === 0) return -1;
        const dateA = new Date(a.remisiones[a.remisiones.length - 1].fechaRemision).getTime();
        const dateB = new Date(b.remisiones[b.remisiones.length - 1].fechaRemision).getTime();
        return dateB - dateA;
    });
    
    // OPTIMIZACIÓN: Log en desarrollo para debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ [RemisionesPage] Grupos creados:', sortedGroups.length);
      console.log('📋 [RemisionesPage] Ejemplos de grupos:', sortedGroups.slice(0, 5).map(g => ({
        pedidoId: g.pedido?.id,
        pedidoNumero: g.pedido?.numeroPedido,
        pedidoEstado: g.pedido?.estado,
        remisionesCount: g.remisiones.length,
        remisionesIds: g.remisiones.map(r => r.id),
        cliente: g.cliente?.nombreCompleto
      })));
      console.log('📊 [RemisionesPage] Resumen de estados:', {
        total: sortedGroups.length,
        porEstado: sortedGroups.reduce((acc, g) => {
          const estado = g.pedido?.estado || 'SIN_ESTADO';
          acc[estado] = (acc[estado] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
    }
    
    return sortedGroups;
  }, [remisiones, findPedido, findCliente]);
  
  // El filtrado ahora se hace en el servidor, solo convertimos a array

  // OPTIMIZACIÓN: Usar Map para búsqueda rápida de remisiones por ID y grupos por pedidoId
  const remisionesByIdMap = useMemo(() => {
    const map = new Map<string, Remision>();
    remisiones.forEach(r => {
      map.set(String(r.id), r);
    });
    return map;
  }, [remisiones]);

  const remisionGroupsByPedidoIdMap = useMemo(() => {
    const map = new Map<string, RemisionGroup>();
    remisionGroups.forEach(group => {
      if (group.pedido?.id) {
        map.set(String(group.pedido.id), group);
      }
    });
    return map;
  }, [remisionGroups]);

  useEffect(() => {
    const focusId = params?.focusId;
    if (!focusId) {
      return;
    }

    // OPTIMIZACIÓN: Buscar primero la remisión por ID, luego el grupo usando mapa
    const focusRemision = remisionesByIdMap.get(String(focusId));
    if (focusRemision && focusRemision.pedidoId) {
      const targetGroup = remisionGroupsByPedidoIdMap.get(String(focusRemision.pedidoId));
      if (targetGroup) {
        setFocusedGroupId(String(targetGroup.id));
        setSelectedGroup(targetGroup);
        setDetailModalOpen(true);
        return;
      }
    }
    
    // Fallback: buscar en todos los grupos (más lento pero necesario)
    const targetGroup = remisionGroups.find((group) =>
      group.remisiones.some((remision) => String(remision.id) === String(focusId))
    );

    if (targetGroup) {
      setFocusedGroupId(String(targetGroup.id));
      setSelectedGroup(targetGroup);
      setDetailModalOpen(true);
    }
  }, [params?.focusId, remisionGroups, remisionesByIdMap, remisionGroupsByPedidoIdMap]);


  // OPTIMIZACIÓN: Crear mapa de productos para búsqueda rápida
  const productosMap = useMemo(() => {
    const map = new Map<number | string, Producto>();
    allProducts.forEach(p => {
      map.set(p.id, p);
      map.set(String(p.id), p);
    });
    return map;
  }, [allProducts]);

  useEffect(() => {
    if (pedidoToRemisionar) {
        console.log('🔄 Procesando items para remisión. Pedido ID:', pedidoToRemisionar.id);
        console.log('📦 Items del pedido:', pedidoToRemisionar.items?.length || 0);
        console.log('📦 Items del pedido (array):', pedidoToRemisionar.items);
        
        // Verificar si el pedido tiene items
        if (!pedidoToRemisionar.items || pedidoToRemisionar.items.length === 0) {
          console.warn('⚠️ El pedido no tiene items cargados. Intentando cargar...');
          // Intentar cargar items del pedido
          fetchPedidosDetalle(String(pedidoToRemisionar.id)).then(pedidosDetalleRes => {
            if (pedidosDetalleRes.success && Array.isArray(pedidosDetalleRes.data)) {
              const items = pedidosDetalleRes.data.filter((d: any) => {
                const detallePedidoId = String(d.pedidoId || d.pedido_id || '');
                const pedidoIdStr = String(pedidoToRemisionar.id || '');
                return detallePedidoId === pedidoIdStr ||
                       String(d.pedidoId) === String(pedidoToRemisionar.id) ||
                       Number(d.pedidoId) === Number(pedidoToRemisionar.id);
              });
              
              console.log('✅ Items cargados dinámicamente:', items.length);
              if (items.length > 0) {
                const pedidoConItems = {
                  ...pedidoToRemisionar,
                  items: items
                };
                setPedidoToRemisionar(pedidoConItems);
              }
            }
          }).catch(error => {
            console.error('❌ Error cargando items del pedido:', error);
          });
          return; // Salir temprano si no hay items
        }
        
        const pedidoIdStr = String(pedidoToRemisionar.id);
        // OPTIMIZACIÓN: Filtrar una sola vez usando comparación directa
        const remisionesPrevias = remisiones.filter(r => {
          if (!r.pedidoId) return false;
          return String(r.pedidoId) === pedidoIdStr;
        });
        
        const itemsPendientes = pedidoToRemisionar.items.reduce<RemisionItemForm[]>((acc, itemPedido) => {
            // OPTIMIZACIÓN: Usar mapa para búsqueda O(1) - pero NO es obligatorio encontrar el producto
            // Usar datos del pedido directamente, el catálogo solo como fuente adicional de información
            const producto = productosMap.get(itemPedido.productoId) || productosMap.get(String(itemPedido.productoId));

            // OPTIMIZACIÓN: Calcular cantidad enviada más eficientemente
            const productoIdStr = String(itemPedido.productoId);
            const cantYaEnviada = remisionesPrevias.reduce((sum, r) => {
              return sum + (r.items?.reduce((itemSum, i) => {
                if (String(i.productoId) === productoIdStr) {
                  return itemSum + (i.cantidad || i.cantidadEnviada || 0);
                }
                return itemSum;
              }, 0) || 0);
            }, 0);
            
            const cantPendiente = itemPedido.cantidad - cantYaEnviada;

            if (cantPendiente > 0) {
                // Usar stock del catálogo si está disponible, sino usar 0 o un valor por defecto
                const cantStock = producto ? (producto.controlaExistencia ?? producto.stock ?? 0) : (itemPedido.stock ?? 0);
                const cantAEnviar = Math.max(0, Math.min(cantPendiente, cantStock));

                // Obtener datos del producto: primero del item del pedido (fuente principal), luego del catálogo
                const productoNombre = itemPedido.descripcion || 
                                      itemPedido.nombre || 
                                      producto?.nombre || 
                                      `Producto ${itemPedido.productoId}`;
                
                const referencia = itemPedido.referencia || 
                                  itemPedido.codProducto || 
                                  producto?.referencia || 
                                  'N/A';
                
                const unidadMedida = itemPedido.unidadMedida || 
                                   producto?.unidadMedida || 
                                   'Unidad';

                acc.push({
                    productoId: itemPedido.productoId,
                    referencia: referencia,
                    descripcion: productoNombre,
                    unidadMedida: unidadMedida,
                    cantPedida: itemPedido.cantidad,
                    cantYaEnviada: cantYaEnviada,
                    cantPendiente: cantPendiente,
                    cantStock: cantStock,
                    cantAEnviar: cantAEnviar,
                });
            }
            
            return acc;
        }, []);
        
        setRemisionItems(itemsPendientes);
    }
  }, [pedidoToRemisionar, remisiones, productosMap]);


  // Convertir remisionGroups a array y aplicar filtro por estado del pedido
  const remisionGroupsArray = useMemo(() => {
    const allGroups = Object.values(remisionGroups);
    
    // OPTIMIZACIÓN: Log en desarrollo para debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [RemisionesPage] Filtrando grupos:', {
        totalGroups: allGroups.length,
        statusFilter: statusFilter,
        gruposConEstado: allGroups.map(g => ({
          pedidoNumero: g.pedido?.numeroPedido,
          pedidoEstado: g.pedido?.estado,
          remisionesCount: g.remisiones.length
        }))
      });
    }
    
    // Si el filtro es "Todos", mostrar todos los grupos (incluyendo remitidos)
    if (statusFilter === 'Todos') {
      return allGroups;
    }
    
    // Filtrar por estado del pedido
    const filtered = allGroups.filter(group => {
      const pedidoEstado = group.pedido?.estado;
      const matches = pedidoEstado === statusFilter;
      
      // Log en desarrollo para debugging
      if (process.env.NODE_ENV === 'development' && !matches && allGroups.length < 5) {
        console.log('🚫 [RemisionesPage] Grupo filtrado:', {
          pedidoNumero: group.pedido?.numeroPedido,
          pedidoEstado: pedidoEstado,
          statusFilter: statusFilter
        });
      }
      
      return matches;
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ [RemisionesPage] Grupos después del filtro:', filtered.length);
    }
    
    return filtered;
  }, [remisionGroups, statusFilter]);

  // OPTIMIZACIÓN: Memoizar búsqueda de cliente para evitar recalcular en cada render
  const getClienteNombre = useCallback((clienteId: string | undefined): string => {
    if (!clienteId) return 'N/A';
    const cliente = findCliente(clienteId);
    return cliente?.nombreCompleto || cliente?.razonSocial || 'N/A';
  }, [findCliente]);

  const pedidosTable = useTable<Pedido>({
    data: pedidosPorRemisionar,
    searchKeys: [
        'numeroPedido', 
        (item) => getClienteNombre(item.clienteId)
    ]
  });

  const handleOpenDetailModal = useCallback(async (group: RemisionGroup) => {
    setSelectedGroup(group);
    setDetailModalOpen(true);
    
    // OPTIMIZACIÓN: Cargar detalles de remisiones solo cuando se abra el modal (lazy loading)
    // Esto mejora significativamente el rendimiento de carga inicial
    const remisionesToLoad = group.remisiones.filter(r => !r.items || r.items.length === 0);
    if (remisionesToLoad.length === 0) {
      // Todos los detalles ya están cargados
      return;
    }
    
    // Cargar detalles de cada remisión que no los tenga
    setLoadingRemisionDetails(new Set(remisionesToLoad.map(r => r.id)));
    
    try {
      const detallesPromises = remisionesToLoad.map(async (remision) => {
        try {
          const detallesRes = await apiClient.getRemisionDetalleById(remision.id);
          if (detallesRes.success && Array.isArray(detallesRes.data)) {
            return { remisionId: remision.id, items: detallesRes.data };
          }
          return { remisionId: remision.id, items: [] };
        } catch (error) {
          console.error(`Error cargando detalles de remisión ${remision.id}:`, error);
          return { remisionId: remision.id, items: [] };
        }
      });
      
      const detallesResults = await Promise.all(detallesPromises);
      
      // Actualizar las remisiones en el grupo con sus detalles
      const updatedRemisiones = group.remisiones.map(remision => {
        const detallesResult = detallesResults.find(d => d.remisionId === remision.id);
        if (detallesResult && detallesResult.items.length > 0) {
          return { ...remision, items: detallesResult.items };
        }
        return remision;
      });
      
      // Actualizar el grupo seleccionado y también las remisiones en el estado principal
      const updatedGroup = { ...group, remisiones: updatedRemisiones };
      setSelectedGroup(updatedGroup);
      
      // Actualizar también en el estado principal de remisiones para que se mantenga actualizado
      setRemisiones(prevRemisiones => {
        return prevRemisiones.map(r => {
          const detallesResult = detallesResults.find(d => d.remisionId === r.id);
          if (detallesResult && detallesResult.items.length > 0) {
            return { ...r, items: detallesResult.items };
          }
          return r;
        });
      });
    } catch (error) {
      console.error('Error cargando detalles de remisiones:', error);
      addNotification({ message: 'Error al cargar detalles de remisiones', type: 'warning' });
    } finally {
      setLoadingRemisionDetails(new Set());
    }
  }, [addNotification]);
  
  const handleOpenCreateModal = useCallback(async (pedido: Pedido) => {
    // Cargar items del pedido si no están presentes
    let pedidoConItems = pedido;
    if (!pedido.items || pedido.items.length === 0) {
      console.log('🔄 Cargando items del pedido para remisión:', pedido.id);
      try {
        const pedidosDetalleRes = await fetchPedidosDetalle(String(pedido.id));
        if (pedidosDetalleRes.success && Array.isArray(pedidosDetalleRes.data)) {
          // Filtrar items que pertenecen a este pedido
          const items = pedidosDetalleRes.data.filter((d: any) => {
            const detallePedidoId = String(d.pedidoId || d.pedido_id || '');
            const pedidoIdStr = String(pedido.id || '');
            return detallePedidoId === pedidoIdStr ||
                   String(d.pedidoId) === String(pedido.id) ||
                   Number(d.pedidoId) === Number(pedido.id);
          });
          
          console.log('✅ Items cargados para el pedido:', items.length);
          pedidoConItems = {
            ...pedido,
            items: items.length > 0 ? items : []
          };
        }
      } catch (error) {
        console.error('❌ Error cargando detalles del pedido:', error);
        // Continuar con el pedido sin items si hay error
      }
    }
    
    setPedidoToRemisionar(pedidoConItems);
    setCreateModalOpen(true);
    // Reset logistic form fields
    setFechaDespacho(new Date().toISOString().split('T')[0]);
    setObservacionesInternas('');
    setFormErrors({});
  }, []);
  
  const handlePrintRemision = useCallback(async (remision: Remision) => {
    // Si la remisión no tiene items cargados, cargarlos antes de abrir el preview
    if (!remision.items || remision.items.length === 0) {
      try {
        const detallesRes = await apiClient.getRemisionDetalleById(remision.id);
        if (detallesRes.success && Array.isArray(detallesRes.data)) {
          const remisionConItems = { ...remision, items: detallesRes.data };
          setRemisionToPreview(remisionConItems);
          
          // Actualizar también en el estado principal
          setRemisiones(prevRemisiones => {
            return prevRemisiones.map(r => 
              r.id === remision.id ? remisionConItems : r
            );
          });
          
          // Actualizar también en el grupo seleccionado si está abierto
          if (selectedGroup) {
            const updatedRemisiones = selectedGroup.remisiones.map(r => 
              r.id === remision.id ? remisionConItems : r
            );
            setSelectedGroup({ ...selectedGroup, remisiones: updatedRemisiones });
          }
          return;
        }
      } catch (error) {
        console.error('Error cargando detalles para preview:', error);
        addNotification({ message: 'Error al cargar detalles de la remisión', type: 'warning' });
      }
    }
    setRemisionToPreview(remision);
  }, [addNotification, selectedGroup, productosMap]);

  const handleDescargarAdjunto = async (remisionId: string) => {
    const adjunto = archivosAdjuntos.find(a => a.entidadId === remisionId && a.entidadTipo === 'REMISION');
    if (!adjunto) {
        addNotification({ message: 'No se encontró el archivo adjunto para esta remisión.', type: 'warning' });
        return;
    }

    addNotification({ message: `Descargando ${adjunto.nombreArchivo}...`, type: 'info' });

    addNotification({ message: 'Descarga de adjuntos no disponible aún. Se implementará vía backend.', type: 'info' });
  };

  const handleCloseModals = () => {
    setDetailModalOpen(false);
    setCreateModalOpen(false);
    setSelectedGroup(null);
    setPedidoToRemisionar(null);
    setRemisionItems([]);
    setFocusedGroupId(null);
    if (params?.focusId || params?.highlightId) {
      const { focusId: _focus, highlightId: _highlight, ...rest } = params;
      setPage('remisiones', rest);
    }
  };

  useEffect(() => {
    if (params.openCreateForPedidoId) {
        const pedido = pedidos.find(p => p.id === params.openCreateForPedidoId);
        if (pedido) {
            handleOpenCreateModal(pedido);
        }
        // Clear param to avoid re-triggering on re-render
        setPage('remisiones', {});
    }
  }, [params, pedidos, setPage]);

  const handleAprobarEntrega = useCallback(async (remisionId: string) => {
    if (isDelivering) return;
    setIsDelivering(remisionId);
    
    try {
        const updatedRemision = await aprobarRemision(remisionId);
        if (updatedRemision) {
            setDeliveryResult(updatedRemision);
            
            // Actualizar la remisión en el estado local
            setRemisiones(prevRemisiones => 
                prevRemisiones.map(r => r.id === remisionId ? updatedRemision : r)
            );
            
            // Actualizar el grupo seleccionado con la remisión actualizada
            if (selectedGroup) {
                const updatedRemisiones = selectedGroup.remisiones.map(r => 
                    r.id === remisionId ? updatedRemision : r
                );
                setSelectedGroup({
                    ...selectedGroup,
                    remisiones: updatedRemisiones
                });
            }
            
            // Recargar remisiones para asegurar que todo esté sincronizado
            await loadRemisiones();
            
            addNotification({ 
                message: `✅ Remisión ${updatedRemision.numeroRemision} marcada como Entregada. Ahora puede ser facturada.`, 
                type: 'success', 
                link: { page: 'facturacion_electronica' } 
            });
        } else {
            addNotification({ 
                message: 'No se pudo marcar la remisión como entregada. Verifique que el estado sea válido.', 
                type: 'warning' 
            });
        }
    } catch (error) {
        console.error(error);
        addNotification({ 
            message: (error as Error).message || 'Error al marcar la remisión como entregada', 
            type: 'error' 
        });
    } finally {
        setIsDelivering(null);
    }
  }, [aprobarRemision, addNotification, selectedGroup]);

  const handleItemQuantityChange = (productoId: number, cantidad: number) => {
    setRemisionItems(prevItems => prevItems.map(item => {
        if (item.productoId === productoId) {
            const newCantidad = Math.max(0, Math.min(item.cantPendiente, item.cantStock, cantidad));
            return { ...item, cantAEnviar: newCantidad };
        }
        return item;
    }));
  };

  // UPDATE: Memoize stock validation to disable create button
  const hasStockError = useMemo(() => {
    return remisionItems.some(item => item.cantAEnviar > item.cantStock);
  }, [remisionItems]);
  
  const handleCreateRemision = async () => {
    if (isCreating || !pedidoToRemisionar) return;
    setIsCreating(true);
    setFormErrors({});

    const itemsAEnviar = remisionItems
        .filter(item => item.cantAEnviar > 0)
        .map(({ productoId, cantAEnviar }) => ({ productoId, cantidad: cantAEnviar }));

    if (itemsAEnviar.length === 0) {
        addNotification({ message: 'Debe especificar una cantidad a enviar para al menos un producto.', type: 'warning' });
        setIsCreating(false);
        return;
    }
    
    try {
        const logisticData = {
            fechaDespacho: fechaDespacho,
            observaciones: observacionesInternas,
        };

        const { nuevaRemision, mensaje } = await crearRemision(pedidoToRemisionar, itemsAEnviar, logisticData);

        // Notificar éxito
        addNotification({ message: mensaje, type: 'success' });
        
        handleCloseModals();
        setRemisionSuccessData(nuevaRemision);
        
        // OPTIMIZACIÓN: Recargar la lista de remisiones inmediatamente después de crear una nueva
        // Resetear a página 1 para asegurar que la nueva remisión aparezca
        setCurrentPage(1);
        await loadRemisiones();

        const LOW_STOCK_THRESHOLD = 10;
        nuevaRemision.items.forEach(item => {
            // OPTIMIZACIÓN: Usar mapa para búsqueda rápida
            const producto = productosMap.get(item.productoId) || productosMap.get(String(item.productoId));
            if (producto) {
                const newStock = (producto.controlaExistencia ?? 0) - item.cantidad; // Simulate new stock
                if (newStock === 0) {
                    addNotification({
                        message: `❌ Stock agotado para ${producto.nombre}.`,
                        type: 'warning',
                        link: { page: 'productos' }
                    });
                } else if (newStock <= LOW_STOCK_THRESHOLD) {
                        addNotification({
                        message: `⚠️ Stock bajo para ${producto.nombre}. Quedan ${newStock} unidades.`,
                        type: 'warning',
                        link: { page: 'productos' }
                    });
                }
            }
        });
    } catch (error) {
        addNotification({ message: (error as Error).message, type: 'warning' });
    } finally {
        setIsCreating(false);
    }
  };


  // OPTIMIZACIÓN: Memoizar columnas para evitar recrearlas en cada render
  const remisionesGroupColumns: Column<RemisionGroup>[] = useMemo(() => [
    { header: 'ID Pedido', accessor: 'pedido', cell: ({ pedido }) => <span className="font-mono text-sm">{pedido.id}</span> },
    { header: 'Pedido Origen', accessor: 'pedido', cell: ({ pedido }) => <span className="font-semibold">{pedido.numeroPedido}</span> },
    { header: 'Cliente', accessor: 'cliente', cell: ({ cliente }) => cliente?.nombreCompleto || 'N/A' },
    { header: 'Nº Entregas', accessor: 'remisiones', cell: ({ remisiones }) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <i className="fas fa-box mr-1.5"></i>
            {remisiones.length}
        </span>
    )},
    { header: 'Estado del Pedido', accessor: 'pedido', cell: ({ pedido }) => <StatusBadge status={pedido.estado as any} /> },
    { header: 'Acciones', accessor: 'pedido', cell: (group) => {
        // Verificar si alguna remisión del grupo puede marcarse como entregada
        const puedeMarcarEntregada = group.remisiones.some(r => 
            r.estado === 'BORRADOR' || r.estado === 'EN_TRANSITO'
        );
        const todasEntregadas = group.remisiones.length > 0 && 
            group.remisiones.every(r => r.estado === 'ENTREGADO');
        
        return (
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => handleOpenDetailModal(group)} 
                    className="text-sky-500 hover:underline text-sm font-medium"
                >
                    Ver Detalle de Entregas
                </button>
                {puedeMarcarEntregada && (
                    <ProtectedComponent permission="remisiones:approve">
                        {group.remisiones.map(remision => {
                            if (remision.estado === 'BORRADOR' || remision.estado === 'EN_TRANSITO') {
                                return (
                                    <button
                                        key={remision.id}
                                        onClick={() => handleAprobarEntrega(remision.id)}
                                        disabled={isDelivering === remision.id}
                                        className="px-3 py-1 bg-teal-600 text-white text-xs font-bold rounded-md hover:bg-teal-700 disabled:bg-slate-400 transition-colors"
                                    >
                                        {isDelivering === remision.id ? (
                                            <><i className="fas fa-spinner fa-spin mr-1"></i>Marcando...</>
                                        ) : (
                                            <><i className="fas fa-check-circle mr-1"></i>Entregado</>
                                        )}
                                    </button>
                                );
                            }
                            return null;
                        })}
                    </ProtectedComponent>
                )}
                {todasEntregadas && (
                    <span className="text-xs text-teal-600 dark:text-teal-400 font-medium">
                        <i className="fas fa-check-circle mr-1"></i>Todas entregadas
                    </span>
                )}
            </div>
        );
    }},
  ], [handleOpenDetailModal, handleAprobarEntrega, isDelivering]);

  // OPTIMIZACIÓN: Memoizar columnas para evitar recrearlas en cada render
  const pedidosColumns: Column<Pedido>[] = useMemo(() => [
    { header: 'Número Pedido', accessor: 'numeroPedido' },
    { 
        header: 'Cliente', 
        accessor: 'clienteId', 
        cell: (item) => getClienteNombre(item.clienteId)
    },
    { 
        header: 'Fecha', 
        accessor: 'fechaPedido',
        cell: (item) => formatDateOnly(item.fechaPedido)
    },
    { header: 'Estado', accessor: 'estado', cell: (item) => <StatusBadge status={item.estado as any} /> },
    { header: 'Acciones', accessor: 'id', cell: (item) => (
        <ProtectedComponent permission="remisiones:create">
            <button onClick={() => handleOpenCreateModal(item)} className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-md hover:bg-green-700 transition-colors">
                <i className="fas fa-truck mr-2"></i>
                Remisionar
            </button>
        </ProtectedComponent>
    )},
  ], [getClienteNombre, handleOpenCreateModal]);
  
  // OPTIMIZACIÓN: Usar mapa para búsqueda rápida
  const currentCliente = useMemo(() => {
    if (!pedidoToRemisionar) return null;
    return findCliente(pedidoToRemisionar.clienteId);
  }, [pedidoToRemisionar, findCliente]);

  const additionalFilters = useMemo(() => (
    <div className="flex flex-col sm:flex-row gap-4">
        <div>
            <label htmlFor="statusFilter" className="sr-only">Estado del Pedido</label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {groupFilterOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
        </div>
    </div>
  ), [statusFilter]);


  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Gestión de Remisiones</h1>
         <p className="text-slate-500 dark:text-slate-400 text-left sm:text-right">Centro de control de entregas</p>
      </div>

      <Card className="mb-8">
        <CardHeader>
            <CardTitle>Pedidos Listos para Despacho</CardTitle>
        </CardHeader>
        <TableToolbar searchTerm={pedidosTable.searchTerm} onSearchChange={pedidosTable.handleSearch} />
        <CardContent className="p-0" style={{ overflowX: 'visible', maxWidth: '100%' }}>
            <Table columns={pedidosColumns} data={pedidosTable.paginatedData} onSort={pedidosTable.requestSort} sortConfig={pedidosTable.sortConfig} />
        </CardContent>
        <TablePagination 
            currentPage={pedidosTable.currentPage}
            totalPages={pedidosTable.totalPages}
            onPageChange={pedidosTable.goToPage}
            canPreviousPage={pedidosTable.currentPage > 1}
            canNextPage={pedidosTable.currentPage < pedidosTable.totalPages}
            onPreviousPage={pedidosTable.prevPage}
            onNextPage={pedidosTable.nextPage}
            totalItems={pedidosTable.totalItems}
            rowsPerPage={pedidosTable.rowsPerPage}
            setRowsPerPage={pedidosTable.setRowsPerPage}
        />
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Historial de Entregas por Pedido</CardTitle>
        </CardHeader>
        <TableToolbar 
            searchTerm={searchTerm} 
            onSearchChange={handleSearch}
            additionalFilters={additionalFilters}
        />
        <CardContent className="p-0" style={{ overflowX: 'visible', maxWidth: '100%' }}>
            {isLoadingRemisiones ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Cargando remisiones...
                </div>
            ) : (
                <Table 
                    columns={remisionesGroupColumns} 
                    data={remisionGroupsArray} 
                    onSort={() => {}} 
                    sortConfig={null} 
                    highlightRowId={focusedGroupId ?? params?.highlightId ?? params?.focusId} 
                />
            )}
        </CardContent>
        <TablePagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            canPreviousPage={currentPage > 1}
            canNextPage={currentPage < totalPages}
            onPreviousPage={() => handlePageChange(currentPage - 1)}
            onNextPage={() => handlePageChange(currentPage + 1)}
            totalItems={totalItems}
            rowsPerPage={pageSize}
            setRowsPerPage={handlePageSizeChange}
        />
      </Card>

      {selectedGroup && (
        <Modal 
            isOpen={isDetailModalOpen} 
            onClose={handleCloseModals} 
            title={`Detalle de Entregas: Pedido ${selectedGroup.pedido.numeroPedido}`}
            size="2xl"
        >
             <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <div><p className="font-semibold text-slate-600 dark:text-slate-400">ID Pedido:</p><p className="font-mono">{selectedGroup.pedido.id}</p></div>
                    <div><p className="font-semibold text-slate-600 dark:text-slate-400">Número Pedido:</p><p>{selectedGroup.pedido.numeroPedido}</p></div>
                    <div><p className="font-semibold text-slate-600 dark:text-slate-400">Cliente:</p><p>{selectedGroup.cliente?.nombreCompleto}</p></div>
                    <div><p className="font-semibold text-slate-600 dark:text-slate-400">Estado del Pedido:</p><p><StatusBadge status={selectedGroup.pedido.estado as any} /></p></div>
                </div>
                
                <h4 className="text-base font-semibold pt-4 border-t border-slate-200 dark:border-slate-700">Historial de Entregas ({selectedGroup.remisiones.length})</h4>
                
                {loadingRemisionDetails.size > 0 && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
                            <i className="fas fa-spinner fa-spin"></i>
                            <span>Cargando detalles de remisiones...</span>
                        </div>
                    </div>
                )}
                
                <div className="space-y-4">
                    {selectedGroup.remisiones.map((remision, index) => {
                        const tieneAdjunto = archivosAdjuntos.some(a => a.entidadId === remision.id && a.entidadTipo === 'REMISION');
                        const isLoadingDetails = loadingRemisionDetails.has(remision.id);
                        return (
                        <div key={remision.id} className="border border-slate-200 dark:border-slate-700 rounded-lg">
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-t-lg">
                               <div>
                                 <h5 className="font-bold text-base text-slate-800 dark:text-slate-200">
                                    <i className="fas fa-truck text-slate-500 mr-3"></i>
                                    Entrega #{index + 1}: {remision.numeroRemision}
                                </h5>
                                 <p className="text-xs text-slate-500 dark:text-slate-400 ml-8">Fecha: {formatDateOnly(remision.fechaRemision)}</p>
                               </div>
                                <div className="flex items-center gap-2">
                                    <StatusBadge status={remision.estado as any} />
                                    {tieneAdjunto ? (
                                        <button onClick={() => handleDescargarAdjunto(remision.id)} className="px-3 py-1 bg-sky-600 text-white text-xs font-semibold rounded-md hover:bg-sky-700 transition-colors" title="Descargar PDF Adjunto">
                                            <i className="fas fa-paperclip"></i>
                                        </button>
                                    ) : (
                                        <button onClick={() => handlePrintRemision(remision)} className="px-3 py-1 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-md hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors" title="Imprimir Remisión">
                                            <i className="fas fa-print"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                             <div className="p-3">
                               {isLoadingDetails ? (
                                 <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                                   <i className="fas fa-spinner fa-spin mr-2"></i>
                                   Cargando items...
                                 </div>
                               ) : remision.items && remision.items.length > 0 ? (
                               <table className="w-full table-fixed text-xs">
                                  <thead>
                                     <tr className="border-b dark:border-slate-600">
                                        <th className="w-28 py-1 text-left font-medium whitespace-nowrap">Referencia</th>
                                        <th className="w-auto py-1 text-left font-medium whitespace-nowrap">Producto</th>
                                        <th className="w-24 py-1 text-right font-medium whitespace-nowrap">Cant. Enviada</th>
                                        <th className="w-20 py-1 text-right font-medium whitespace-nowrap">Unidad</th>
                                     </tr>
                                  </thead>
                                  <tbody>
                                    {remision.items.map((item, index) => {
                                        // OPTIMIZACIÓN: Usar mapa para búsqueda rápida
                                        const product = productosMap.get(item.productoId) || productosMap.get(String(item.productoId));
                                        
                                        // Obtener nombre del producto: primero del producto encontrado, luego del item
                                        const productoNombre = product?.nombre || 
                                                              item.descripcion || 
                                                              item.nombre || 
                                                              `Producto ${index + 1}`;
                                        
                                        // Obtener unidad de medida: primero del producto, luego del item
                                        const unidadMedida = product?.unidadMedida || 
                                                           item.unidadMedida || 
                                                           'Unidad';
                                        
                                        return (
                                            <tr key={item.productoId || `item-${index}`}>
                                                <td className="py-1 font-mono">{product?.referencia || 'N/A'}</td>
                                                <td className="py-1 break-words">
                                                    {productoNombre}
                                                    {!product && (
                                                        <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400" title="Producto no encontrado en el catálogo">
                                                            <i className="fas fa-exclamation-triangle"></i>
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-1 text-right font-semibold">{item.cantidad}</td>
                                                <td className="py-1 text-right">{unidadMedida}</td>
                                            </tr>
                                        )
                                    })}
                                  </tbody>
                               </table>
                               ) : (
                                 <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-sm">
                                   No hay items registrados para esta remisión.
                                 </div>
                               )}
                             </div>
                             {/* Botones de acción: mostrar para remisiones en BORRADOR o EN_TRANSITO */}
                             {(remision.estado === 'EN_TRANSITO' || remision.estado === 'BORRADOR') && (
                                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-b-lg border-t dark:border-slate-700 flex justify-between items-center gap-3">
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        <i className="fas fa-info-circle mr-1"></i>
                                        Marca como entregada cuando el despachador confirme la entrega
                                    </div>
                                    <div className="flex gap-3">
                                        {remision.estado === 'EN_TRANSITO' && (
                                            <ProtectedComponent permission="remisiones:update">
                                                <button onClick={() => setPage('editar_remision', {id: remision.id})} className="px-3 py-1 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-md hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">
                                                    <i className="fas fa-edit mr-1"></i>Editar
                                                </button>
                                            </ProtectedComponent>
                                        )}
                                        <ProtectedComponent permission="remisiones:deliver">
                                            <button 
                                                onClick={() => handleAprobarEntrega(remision.id)} 
                                                disabled={!!isDelivering}
                                                className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-md hover:bg-green-700 transition-colors disabled:bg-slate-400 disabled:cursor-wait shadow-md hover:shadow-lg"
                                                title="Marcar esta remisión como entregada para que pueda ser facturada"
                                            >
                                               {isDelivering === remision.id ? (
                                                   <><i className="fas fa-spinner fa-spin mr-2"></i>Procesando...</>
                                               ) : (
                                                   <><i className="fas fa-check-circle mr-2"></i>Confirmar Entrega</>
                                               )}
                                            </button>
                                        </ProtectedComponent>
                                    </div>
                                </div>
                            )}
                            {/* Mensaje para remisiones ya entregadas */}
                            {remision.estado === 'ENTREGADO' && (
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-b-lg border-t dark:border-slate-700 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                                        <i className="fas fa-check-circle"></i>
                                        <span className="text-sm font-semibold">Remisión entregada - Lista para facturar</span>
                                    </div>
                                    <button 
                                        onClick={() => setPage('facturacion_electronica')} 
                                        className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition-colors"
                                    >
                                        <i className="fas fa-file-invoice mr-1"></i>Ir a Facturación
                                    </button>
                                </div>
                            )}
                        </div>
                    )})}
                </div>

            </div>
        </Modal>
      )}

      {pedidoToRemisionar && (
        <Modal
            isOpen={isCreateModalOpen}
            onClose={handleCloseModals}
            title={`Crear Remisión para Pedido: ${pedidoToRemisionar.numeroPedido}`}
            size="3xl"
        >
            <div className="space-y-6">
                {/* Progress Flow */}
                <ProgressFlow>
                    <ProgressStep title="Pedido" status="complete" />
                    <ProgressStep title="Remisión" status="current" />
                    <ProgressStep title="Enviado" status="incomplete" />
                    <ProgressStep title="Entregado" status="incomplete" />
                </ProgressFlow>

                {/* Order and Client Info Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Información del Pedido y Cliente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="flex items-start gap-2">
                                <i className="fas fa-hashtag text-slate-400 mt-1"></i>
                                <div><p className="font-semibold text-slate-500 dark:text-slate-400">ID Pedido</p><p className="font-mono">{pedidoToRemisionar.id}</p></div>
                            </div>
                            <div className="flex items-start gap-2">
                                <i className="fas fa-hashtag text-slate-400 mt-1"></i>
                                <div><p className="font-semibold text-slate-500 dark:text-slate-400">Nº Pedido</p><p>{pedidoToRemisionar.numeroPedido}</p></div>
                            </div>
                            <div className="flex items-start gap-2">
                                <i className="fas fa-user text-slate-400 mt-1"></i>
                                <div><p className="font-semibold text-slate-500 dark:text-slate-400">Cliente</p><p>{currentCliente?.nombreCompleto}</p></div>
                            </div>
                            <div className="flex items-start gap-2">
                                <i className="fas fa-phone text-slate-400 mt-1"></i>
                                <div><p className="font-semibold text-slate-500 dark:text-slate-400">Teléfono</p><p>{currentCliente?.telefono}</p></div>
                            </div>
                            <div className="flex items-start gap-2">
                                <i className="fas fa-envelope text-slate-400 mt-1"></i>
                                <div><p className="font-semibold text-slate-500 dark:text-slate-400">Email</p><p>{currentCliente?.email}</p></div>
                            </div>
                            <div className="flex items-start gap-2 md:col-span-2">
                                <i className="fas fa-map-marker-alt text-slate-400 mt-1"></i>
                                <div><p className="font-semibold text-slate-500 dark:text-slate-400">Dirección de Envío</p><p>{currentCliente?.direccion}, {currentCliente?.ciudadId}</p></div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Items to Remit Table */}
                <Card>
                    <CardHeader><CardTitle className="text-base">Ítems a Remitir</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <div>
                            <table className="w-full table-fixed divide-y divide-slate-200 dark:divide-slate-700">
                                <thead className="bg-slate-50 dark:bg-slate-700/50">
                                    <tr>
                                        <th scope="col" className="px-4 py-2 w-24 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Referencia</th>
                                        <th scope="col" className="px-4 py-2 w-auto text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Producto</th>
                                        <th scope="col" className="px-4 py-2 w-16 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Pedido</th>
                                        <th scope="col" className="px-4 py-2 w-20 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Pendiente</th>
                                        <th scope="col" className="px-4 py-2 w-16 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Stock</th>
                                        <th scope="col" className="px-4 py-2 w-28 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Cant. a Enviar</th>
                                        <th scope="col" className="px-4 py-2 w-20 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Unidad</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {remisionItems.map((item, index) => {
                                    // Buscar producto en el catálogo para verificar si existe
                                    // OPTIMIZACIÓN: Usar mapa para búsqueda rápida
                                    const producto = productosMap.get(item.productoId) || productosMap.get(String(item.productoId));
                                    
                                    // Obtener nombre del producto: primero del producto encontrado, luego del item
                                    const productoNombre = producto?.nombre || 
                                                          item.descripcion || 
                                                          item.nombre || 
                                                          `Producto ${index + 1}`;
                                    
                                    return (
                                    <tr key={item.productoId || `item-${index}`}>
                                        <td className="px-4 py-2 text-sm font-mono text-slate-500 break-words">{item.referencia || producto?.referencia || 'N/A'}</td>
                                        <td className="px-4 py-2 text-sm break-words">
                                            {productoNombre}
                                            {!producto && (
                                                <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400" title="Producto no encontrado en el catálogo">
                                                    <i className="fas fa-exclamation-triangle"></i>
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right">{item.cantPedida}</td>
                                        <td className="px-4 py-2 text-sm text-right font-medium">{item.cantPendiente}</td>
                                        <td className={`px-4 py-2 text-sm text-right font-bold ${item.cantStock < item.cantPendiente ? 'text-orange-500' : 'text-green-500'}`}>{item.cantStock}</td>
                                        <td className="px-4 py-2 text-sm">
                                            <input 
                                                type="number"
                                                value={item.cantAEnviar}
                                                onChange={(e) => handleItemQuantityChange(item.productoId, parseInt(e.target.value) || 0)}
                                                max={Math.min(item.cantPendiente, item.cantStock)}
                                                min="0"
                                                className="w-24 px-2 py-1 text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right">{item.unidadMedida}</td>
                                    </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Logistic Details Form */}
                <Card>
                    <CardHeader><CardTitle className="text-base">Detalles de Envío</CardTitle></CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <label htmlFor="fechaDespacho" className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Fecha Estimada de Despacho</label>
                                <input type="date" id="fechaDespacho" value={fechaDespacho} onChange={(e) => setFechaDespacho(e.target.value)} className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <div className="sm:col-span-2">
                                <label htmlFor="observacionesInternas" className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Observaciones Internas</label>
                                <textarea id="observacionesInternas" rows={3} value={observacionesInternas} onChange={(e) => setObservacionesInternas(e.target.value)} placeholder="Ej: Producto frágil, entregar en horario laboral..." className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="mt-2 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                    <button onClick={handleCloseModals} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleCreateRemision} 
                        disabled={isCreating || hasStockError}
                        className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-500 disabled:cursor-not-allowed"
                        title={hasStockError ? "No se puede crear la remisión. La cantidad a enviar supera el stock disponible." : ""}
                    >
                        {isCreating ? (
                            <><i className="fas fa-spinner fa-spin mr-2"></i>Creando...</>
                        ) : (
                            <><i className="fas fa-truck mr-2"></i> Crear Remisión</>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
      )}

      {remisionSuccessData && (
        <ApprovalSuccessModal
            isOpen={!!remisionSuccessData}
            onClose={() => setRemisionSuccessData(null)}
            title={`¡Remisión ${remisionSuccessData.numeroRemision} Creada!`}
            message="La remisión ha sido generada y el PDF guardado. El inventario ha sido actualizado."
            summaryTitle="Resumen de la Entrega"
            summaryDetails={[
                { 
                    label: 'Cliente', 
                    value: (() => {
                        const cliente = findCliente(remisionSuccessData.clienteId);
                        return cliente?.nombreCompleto || cliente?.razonSocial || remisionSuccessData.clienteId || 'N/A';
                    })()
                },
                { label: 'Pedido Origen', value: findPedido(remisionSuccessData.pedidoId)?.numeroPedido || 'N/A' },
            ]}
            primaryAction={{
                label: 'Ver/Imprimir Documento',
                onClick: () => {
                    setRemisionToPreview(remisionSuccessData);
                    setRemisionSuccessData(null);
                },
                icon: 'fa-print'
            }}
            secondaryActions={[
                {
                    label: 'Finalizar',
                    onClick: () => setRemisionSuccessData(null)
                }
            ]}
        />
      )}

      {deliveryResult && (
        <ApprovalSuccessModal
            isOpen={!!deliveryResult}
            onClose={() => setDeliveryResult(null)}
            title="¡Entrega Confirmada!"
            message={<>La remisión <strong>{deliveryResult.numeroRemision}</strong> fue marcada como "Entregada" y está lista para ser facturada.</>}
            summaryTitle="Detalles de la Entrega"
            summaryDetails={[
                { 
                    label: 'Cliente', 
                    value: (() => {
                        const cliente = findCliente(deliveryResult.clienteId);
                        return cliente?.nombreCompleto || cliente?.razonSocial || deliveryResult.clienteId || 'N/A';
                    })()
                },
                { label: 'Pedido Origen', value: findPedido(deliveryResult.pedidoId)?.numeroPedido || 'N/A' },
            ]}
            primaryAction={{
                label: 'Ir a Facturación',
                onClick: () => { setDeliveryResult(null); setPage('facturacion_electronica'); },
            }}
        />
      )}

      {remisionToPreview && (
        <RemisionPreviewModal 
            remision={remisionToPreview}
            onClose={() => setRemisionToPreview(null)}
        />
      )}
    </div>
  );
};

export default RemisionesPage;