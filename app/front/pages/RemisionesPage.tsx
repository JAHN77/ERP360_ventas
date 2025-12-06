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
      addNotification({ message: 'Error al cargar remisiones', type: 'warning' });
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
            estado: estadoFantasma as any,
            observaciones: pedidoIdStr ? `Remisión asociada a pedido ${pedidoIdStr} (pedido no encontrado en contexto)` : 'Remisión sin pedido asociado',
            items: remision.items || [],
            empresaId: Number(remision.empresaId) || 1
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
    // Sort remisiones within each group by date (descending - newest first)
    groupsArray.forEach(group => {
      group.remisiones.sort((a, b) => {
        const dateA = new Date(a.fechaRemision).getTime();
        const dateB = new Date(b.fechaRemision).getTime();
        return dateB - dateA; // Descending order (Newest first)
      });
    });

    // Sort groups by most recent remision date
    const sortedGroups = groupsArray.sort((a, b) => {
      if (a.remisiones.length === 0) return 1;
      if (b.remisiones.length === 0) return -1;
      // Since remisiones are now sorted descending, the first one is the newest
      const dateA = new Date(a.remisiones[0].fechaRemision).getTime();
      const dateB = new Date(b.remisiones[0].fechaRemision).getTime();
      return dateB - dateA; // Descending order (Newest first)
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
              return itemSum + (i.cantidad || (i as any).cantidadEnviada || 0);
            }
            return itemSum;
          }, 0) || 0);
        }, 0);

        const cantPendiente = itemPedido.cantidad - cantYaEnviada;

        if (cantPendiente > 0) {
          // Usar stock del catálogo si está disponible, sino usar el del item del pedido
          const cantStock = producto ? (producto.stock ?? 0) : ((itemPedido as any).stock ?? 0);
          const cantAEnviar = Math.max(0, Math.min(cantPendiente, cantStock));

          // Obtener datos del producto: primero del item del pedido (fuente principal), luego del catálogo
          const productoNombre = itemPedido.descripcion ||
            (itemPedido as any).nombre ||
            producto?.nombre ||
            `Producto ${itemPedido.productoId}`;

          const referencia = (itemPedido as any).referencia ||
            itemPedido.codProducto ||
            producto?.referencia ||
            'N/A';

          const unidadMedida = (itemPedido as any).unidadMedida ||
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
        type: 'warning'
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
    {
      header: 'ID Pedido',
      accessor: 'pedido',
      cell: ({ pedido }) => (
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
          {pedido.id}
        </span>
      )
    },
    {
      header: 'Pedido Origen',
      accessor: 'pedido',
      cell: ({ pedido }) => (
        <span className="font-bold text-slate-700 dark:text-slate-200">{pedido.numeroPedido}</span>
      )
    },
    {
      header: 'Cliente',
      accessor: 'cliente',
      cell: ({ cliente }) => (
        <div className="flex flex-col max-w-[200px]">
          <span className="font-medium text-slate-700 dark:text-slate-200 truncate" title={cliente?.nombreCompleto}>
            {cliente?.nombreCompleto || 'N/A'}
          </span>
          <span className="text-xs text-slate-500 truncate">{cliente?.numeroDocumento}</span>
        </div>
      )
    },
    {
      header: 'Nº Entregas', accessor: 'remisiones', cell: ({ remisiones }) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <i className="fas fa-box mr-1.5"></i>
          {remisiones.length}
        </span>
      )
    },
    { header: 'Estado del Pedido', accessor: 'pedido', cell: ({ pedido }) => <StatusBadge status={pedido.estado as any} /> },
    {
      header: 'Acciones', accessor: 'pedido', cell: (group) => {
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
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
              title="Ver Detalle de Entregas"
            >
              <i className="fas fa-eye"></i>
            </button>
            {puedeMarcarEntregada && (
              <ProtectedComponent permission="remisiones:deliver">
                <div className="flex gap-1">
                  {group.remisiones.map(remision => {
                    if (remision.estado === 'BORRADOR' || remision.estado === 'EN_TRANSITO') {
                      return (
                        <button
                          key={remision.id}
                          onClick={() => handleAprobarEntrega(remision.id)}
                          disabled={isDelivering === remision.id}
                          className="p-2 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-all duration-200 disabled:opacity-50"
                          title={`Marcar entrega ${remision.numeroRemision}`}
                        >
                          {isDelivering === remision.id ? (
                            <i className="fas fa-spinner fa-spin"></i>
                          ) : (
                            <i className="fas fa-check-circle"></i>
                          )}
                        </button>
                      );
                    }
                    return null;
                  })}
                </div>
              </ProtectedComponent>
            )}
            {todasEntregadas && (
              <span className="text-xs text-teal-600 dark:text-teal-400 font-medium flex items-center gap-1 bg-teal-50 dark:bg-teal-900/20 px-2 py-1 rounded-full border border-teal-100 dark:border-teal-800">
                <i className="fas fa-check-circle text-[10px]"></i> Completado
              </span>
            )}
          </div>
        );
      }
    },
  ], [handleOpenDetailModal, handleAprobarEntrega, isDelivering]);

  // OPTIMIZACIÓN: Memoizar columnas para evitar recrearlas en cada render
  const pedidosColumns: Column<Pedido>[] = useMemo(() => [
    {
      header: 'Número Pedido',
      accessor: 'numeroPedido',
      cell: (item) => (
        <span className="font-bold font-mono text-slate-700 dark:text-slate-200">{item.numeroPedido}</span>
      )
    },
    {
      header: 'Cliente',
      accessor: 'clienteId',
      cell: (item) => {
        const nombre = getClienteNombre(item.clienteId);
        return (
          <span className="font-medium text-slate-700 dark:text-slate-200">{nombre}</span>
        );
      }
    },
    {
      header: 'Fecha',
      accessor: 'fechaPedido',
      cell: (item) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">{formatDateOnly(item.fechaPedido)}</span>
      )
    },
    { header: 'Estado', accessor: 'estado', cell: (item) => <StatusBadge status={item.estado as any} /> },
    {
      header: 'Acciones', accessor: 'id', cell: (item) => (
        <ProtectedComponent permission="remisiones:create">
          <button
            onClick={() => handleOpenCreateModal(item)}
            className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-all duration-200 shadow-sm hover:shadow hover:-translate-y-0.5 flex items-center gap-2"
          >
            <i className="fas fa-truck"></i>
            Remisionar
          </button>
        </ProtectedComponent>
      )
    },
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
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            Gestión de Remisiones
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Centro de control de entregas y despachos.
          </p>
        </div>
      </div>

      <section>
        <Card className="border-l-4 border-l-green-500 shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden">
          <CardHeader className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/50 pb-4">
            <div className="flex items-center gap-2">
              <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-2 rounded-lg">
                <i className="fas fa-dolly"></i>
              </span>
              <div>
                <CardTitle className="text-lg text-slate-800 dark:text-slate-100">Pedidos Listos para Despacho</CardTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Pedidos confirmados pendientes de generar remisión.
                </p>
              </div>
            </div>
          </CardHeader>

          <div className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
            <TableToolbar searchTerm={pedidosTable.searchTerm} onSearchChange={pedidosTable.handleSearch} placeholder="Buscar pedido..." />
          </div>

          <CardContent className="p-0">
            <Table columns={pedidosColumns} data={pedidosTable.paginatedData} onSort={pedidosTable.requestSort} sortConfig={pedidosTable.sortConfig} />
          </CardContent>

          <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
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
          </div>
        </Card>
      </section>

      <section>
        <Card className="shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden">
          <CardHeader className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 pb-4">
            <div className="flex items-center gap-2">
              <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 p-2 rounded-lg">
                <i className="fas fa-history"></i>
              </span>
              <CardTitle className="text-lg text-slate-800 dark:text-slate-100">Historial de Entregas por Pedido</CardTitle>
            </div>
          </CardHeader>

          <div className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
            <TableToolbar
              searchTerm={searchTerm}
              onSearchChange={handleSearch}
              additionalFilters={additionalFilters}
              placeholder="Buscar por pedido, cliente..."
            />
          </div>

          <CardContent className="p-0">
            {isLoadingRemisiones ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center gap-3">
                <i className="fas fa-circle-notch fa-spin text-3xl text-blue-500"></i>
                <p>Cargando remisiones...</p>
              </div>
            ) : (
              <Table
                columns={remisionesGroupColumns}
                data={remisionGroupsArray}
                onSort={() => { }}
                sortConfig={null}
                highlightRowId={focusedGroupId ?? params?.highlightId ?? params?.focusId}
              />
            )}
          </CardContent>

          <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
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
          </div>
        </Card>
      </section>

      {selectedGroup && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={handleCloseModals}
          title={`Detalle de Entregas: ${selectedGroup.pedido.numeroPedido}`}
          size="4xl"
        >
          <div className="space-y-8 p-1">
            {/* Header: Order & Client Info */}
            {/* Header: Order & Client Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pedido Info Card */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                  <i className="fas fa-file-invoice-dollar text-8xl text-blue-600"></i>
                </div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                    <i className="fas fa-box text-xl"></i>
                  </div>
                  <h4 className="text-base font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                    Información del Pedido
                  </h4>
                </div>

                <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-end border-b border-dashed border-slate-200 dark:border-slate-700 pb-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Número de Pedido</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-xl font-mono tracking-tight">{selectedGroup.pedido.numeroPedido}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">ID Interno</span>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600">{selectedGroup.pedido.id}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Estado Global</span>
                    <StatusBadge status={selectedGroup.pedido.estado as any} />
                  </div>
                </div>
              </div>

              {/* Cliente Info Card */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                  <i className="fas fa-user-circle text-8xl text-purple-600"></i>
                </div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                    <i className="fas fa-user text-xl"></i>
                  </div>
                  <h4 className="text-base font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                    Datos del Cliente
                  </h4>
                </div>

                <div className="space-y-4 relative z-10">
                  <div className="flex flex-col border-b border-dashed border-slate-200 dark:border-slate-700 pb-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Razón Social</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-lg leading-tight truncate" title={selectedGroup.cliente?.nombreCompleto}>
                      {selectedGroup.cliente?.nombreCompleto || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Identificación</span>
                    <div className="flex items-center gap-2">
                      <i className="far fa-id-card text-slate-400"></i>
                      <span className="font-medium text-slate-700 dark:text-slate-200 font-mono">{selectedGroup.cliente?.numeroDocumento || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Deliveries Timeline Section */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/20">
                    <i className="fas fa-shipping-fast text-sm"></i>
                  </div>
                  <span>Historial de Entregas</span>
                </h4>
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                  {selectedGroup.remisiones.length} {selectedGroup.remisiones.length === 1 ? 'Registro' : 'Registros'}
                </span>
              </div>

              {loadingRemisionDetails.size > 0 && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl flex items-center justify-center gap-3 animate-pulse">
                  <i className="fas fa-spinner fa-spin text-blue-500 text-xl"></i>
                  <span className="text-blue-700 dark:text-blue-300 font-medium">Sincronizando detalles...</span>
                </div>
              )}

              {/* Improved Timeline */}
              <div className="space-y-0 relative pl-4">
                {/* The Timeline Line - Elegant and Subtle */}
                <div className="absolute left-[27px] top-6 bottom-6 w-px bg-gradient-to-b from-slate-300 via-slate-300 to-transparent dark:from-slate-600 dark:via-slate-600"></div>

                {selectedGroup.remisiones.map((remision, index) => {
                  const tieneAdjunto = archivosAdjuntos.some(a => a.entidadId === remision.id && a.entidadTipo === 'REMISION');
                  const isLoadingDetails = loadingRemisionDetails.has(remision.id);
                  const isEntregado = remision.estado === 'ENTREGADO';
                  const isLast = index === selectedGroup.remisiones.length - 1;

                  return (
                    <div key={remision.id} className={`relative pl-12 pb-10 ${isLast ? 'pb-0' : ''} group`}>
                      {/* Timeline Dot - Premium Look */}
                      <div className={`absolute left-0 top-0 w-[56px] flex justify-center z-10 py-1 bg-white dark:bg-slate-800 ring-4 ring-white dark:ring-slate-800`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-sm transition-all duration-300
                          ${isEntregado
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-500/50 dark:text-emerald-400'
                            : 'bg-white border-slate-300 text-slate-400 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-500'}`}>
                          <i className={`fas ${isEntregado ? 'fa-check' : 'fa-truck-moving'} text-[10px]`}></i>
                        </div>
                      </div>

                      {/* Content Card */}
                      <div className={`bg-white dark:bg-slate-800 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-lg
                        ${isEntregado ? 'border-emerald-200/60 dark:border-emerald-900/30' : 'border-slate-200 dark:border-slate-700'}`}>

                        {/* Card Header - Clean Split */}
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-5 gap-4 border-b border-slate-100 dark:border-slate-700/50">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h5 className="font-bold text-lg text-slate-800 dark:text-slate-100 font-mono tracking-tight">
                                {remision.numeroRemision}
                              </h5>
                              <StatusBadge status={remision.estado as any} />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                              <span className="flex items-center gap-1.5"><i className="far fa-calendar-alt"></i> Generado: {formatDateOnly(remision.fechaRemision)}</span>
                              {remision.fechaDespacho && <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400"><i className="fas fa-shipping-fast"></i> Despacho: {formatDateOnly(remision.fechaDespacho)}</span>}
                            </div>
                          </div>

                          <div className="flex gap-2 w-full lg:w-auto">
                            {tieneAdjunto ? (
                              <button onClick={() => handleDescargarAdjunto(remision.id)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-white dark:hover:bg-slate-600 transition-all hover:border-blue-300 hover:text-blue-600 shadow-sm">
                                <i className="fas fa-paperclip"></i> Ver Adjunto
                              </button>
                            ) : (
                              <button onClick={() => handlePrintRemision(remision)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-white dark:hover:bg-slate-600 transition-all hover:border-slate-300 hover:text-slate-800 shadow-sm">
                                <i className="fas fa-print"></i> Imprimir
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Card Body: Items */}
                        <div className="p-0 bg-slate-50/30 dark:bg-slate-900/20">
                          {isLoadingDetails ? (
                            <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                              <i className="fas fa-circle-notch fa-spin mr-2"></i> Cargando contenido...
                            </div>
                          ) : remision.items && remision.items.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm text-left">
                                <thead className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50">
                                  <tr>
                                    <th className="px-6 py-3 w-40 pl-8">Referencia</th>
                                    <th className="px-6 py-3">Descripción</th>
                                    <th className="px-6 py-3 w-32 text-right">Cant.</th>
                                    <th className="px-6 py-3 w-32 text-right pr-8">Unidad</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 bg-white dark:bg-slate-800">
                                  {remision.items.map((item, idx) => {
                                    const product = productosMap.get(item.productoId) || productosMap.get(String(item.productoId));
                                    const productoNombre = product?.nombre || item.descripcion || (item as any).nombre || `Producto ${idx + 1}`;
                                    const unidadMedida = product?.unidadMedida || (item as any).unidadMedida || 'Unidad';

                                    return (
                                      <tr key={item.productoId || `item-${idx}`} className="group/row hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                        <td className="px-6 py-3.5 pl-8 font-mono text-xs text-slate-500 group-hover/row:text-slate-700 dark:group-hover/row:text-slate-300">{product?.referencia || 'N/A'}</td>
                                        <td className="px-6 py-3.5 font-medium text-slate-700 dark:text-slate-300">
                                          {productoNombre}
                                          {!product && <i className="fas fa-exclamation-triangle text-amber-500 ml-2 text-xs" title="Producto no encontrado en catálogo"></i>}
                                        </td>
                                        <td className="px-6 py-3.5 text-right font-bold text-slate-800 dark:text-slate-100">{item.cantidad}</td>
                                        <td className="px-6 py-3.5 text-right pr-8 text-xs font-semibold text-slate-400">{unidadMedida}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center py-10 text-slate-400 italic bg-white dark:bg-slate-800">
                              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-2">
                                <i className="fas fa-box-open text-slate-300"></i>
                              </div>
                              <p>Sin items registrados</p>
                            </div>
                          )}
                        </div>

                        {/* Card Footer: Actions */}
                        {(remision.estado === 'EN_TRANSITO' || remision.estado === 'BORRADOR') && (
                          <div className="p-4 bg-orange-50/50 dark:bg-orange-900/10 border-t border-orange-100 dark:border-orange-900/20 rounded-b-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-2.5 text-xs font-medium text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 px-3 py-1.5 rounded-full">
                              <i className="fas fa-clock"></i>
                              <span>Entrega pendiente de confirmación</span>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                              {remision.estado === 'EN_TRANSITO' && (
                                <ProtectedComponent permission="remisiones:update">
                                  <button onClick={() => setPage('editar_remision', { id: remision.id })} className="flex-1 sm:flex-none px-4 py-2 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-600 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all text-sm shadow-sm">
                                    <i className="fas fa-pencil-alt mr-2"></i> Editar
                                  </button>
                                </ProtectedComponent>
                              )}
                              <ProtectedComponent permission="remisiones:deliver">
                                <button
                                  onClick={() => handleAprobarEntrega(remision.id)}
                                  disabled={!!isDelivering}
                                  className="flex-1 sm:flex-none px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 dark:shadow-none font-bold rounded-xl transform hover:-translate-y-0.5 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                  {isDelivering === remision.id ? (
                                    <><i className="fas fa-spinner fa-spin mr-2"></i> ... </>
                                  ) : (
                                    <><i className="fas fa-check-double mr-2"></i> Confirmar Entrega</>
                                  )}
                                </button>
                              </ProtectedComponent>
                            </div>
                          </div>
                        )}

                        {remision.estado === 'ENTREGADO' && (
                          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 border-t border-emerald-100 dark:border-emerald-900/20 rounded-b-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1.5 rounded-full">
                              <i className="fas fa-check-circle"></i>
                              <span>Entregado y Verificado</span>
                            </div>
                            <button
                              onClick={() => setPage('facturacion_electronica')}
                              className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-blue-500/30 font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
                            >
                              <i className="fas fa-receipt"></i> Facturar Ahora
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
                    <div><p className="font-semibold text-slate-500 dark:text-slate-400">Teléfono</p><p>{currentCliente?.telter || currentCliente?.celter || currentCliente?.celular}</p></div>
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
                          (item as any).nombre ||
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