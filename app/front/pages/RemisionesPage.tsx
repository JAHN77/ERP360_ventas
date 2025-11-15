import React, { useState, useMemo, useEffect } from 'react';
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
import { apiClient } from '../services/apiClient';
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
    transportadoras,
    archivosAdjuntos,
  } = useData();

  // Estados para paginación del servidor
  const [remisiones, setRemisiones] = useState<Remision[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingRemisiones, setIsLoadingRemisiones] = useState(false);

  // La sincronización automática de estados se hace en el backend cuando se obtienen los pedidos
  // No es necesario forzar un refresh aquí, ya que causaría un ciclo infinito

  const [statusFilter, setStatusFilter] = useState('Todos');
  const [clientFilter, setClientFilter] = useState('Todos');
  
  // Cargar remisiones con paginación (con debounce para búsqueda)
  useEffect(() => {
    const loadRemisiones = async () => {
      setIsLoadingRemisiones(true);
      try {
        const estrec = statusFilter !== 'Todos' ? statusFilter : undefined;
        const codter = clientFilter !== 'Todos' ? clientFilter : undefined;
        const remisionesRes = await apiClient.getRemisiones(
          currentPage, 
          pageSize, 
          searchTerm || undefined,
          codter,
          undefined, // codalm
          estrec
        );
        if (remisionesRes.success) {
          // Obtener detalles de remisiones para los items
          const remisionesDetalleRes = await apiClient.getRemisionesDetalle();
          const detallesData = remisionesDetalleRes.success && Array.isArray(remisionesDetalleRes.data) 
            ? remisionesDetalleRes.data 
            : [];
          
          // Mapear remisiones con sus items
          const remisionesData = (remisionesRes.data as any[]) || [];
          const remisionesConDetalles = remisionesData.map(r => {
            const remisionIdStr = String(r.id || r.numrec || '');
            const remisionNumrec = r.numrec;
            const items = detallesData.filter((d: any) => {
              const detalleRemisionId = String(d.remisionId || d.numrec || '');
              const detalleNumrec = d.numrec;
              return detalleRemisionId === remisionIdStr || 
                     (remisionNumrec && detalleNumrec && String(remisionNumrec) === String(detalleNumrec));
            });
            
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
              items: items.length > 0 ? items : [],
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
    };
    
    // Debounce para búsqueda: esperar 500ms después de que el usuario deje de escribir
    const timeoutId = setTimeout(() => {
      loadRemisiones();
    }, searchTerm ? 500 : 0);
    
    return () => clearTimeout(timeoutId);
  }, [currentPage, pageSize, searchTerm, statusFilter, clientFilter, addNotification]);
  
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
  const [shippingMethod, setShippingMethod] = useState<'transportadoraExterna' | 'transportePropio' | 'recogeCliente'>('transportadoraExterna');
  const [transportadoraId, setTransportadoraId] = useState('');
  const [otraTransportadora, setOtraTransportadora] = useState('');
  const [numeroGuia, setNumeroGuia] = useState('');
  const [fechaDespacho, setFechaDespacho] = useState(new Date().toISOString().split('T')[0]);
  const [observacionesInternas, setObservacionesInternas] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [remisionToPreview, setRemisionToPreview] = useState<Remision | null>(null);

  const [remisionSuccessData, setRemisionSuccessData] = useState<Remision | null>(null);
  const [deliveryResult, setDeliveryResult] = useState<Remision | null>(null);
  
  const [isCreating, setIsCreating] = useState(false);
  const [isDelivering, setIsDelivering] = useState<string | null>(null);

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

  const remisionGroups = useMemo(() => {
    const groups: { [pedidoId: string]: RemisionGroup } = {};
    
    console.log('📦 [RemisionesPage] Total remisiones disponibles:', remisiones.length);
    console.log('📦 [RemisionesPage] Total pedidos disponibles:', pedidos.length);
    console.log('📦 [RemisionesPage] Ejemplo de remisión:', remisiones[0] ? {
        id: remisiones[0].id,
        numeroRemision: remisiones[0].numeroRemision,
        pedidoId: remisiones[0].pedidoId,
        tipoPedidoId: typeof remisiones[0].pedidoId,
        clienteId: remisiones[0].clienteId,
        itemsCount: remisiones[0].items?.length || 0
    } : 'No hay remisiones');

    // Ensure all remisiones are considered by iterating through them
    remisiones.forEach(remision => {
        // Si la remisión tiene pedidoId, buscar el pedido
        if (remision.pedidoId !== null && remision.pedidoId !== undefined) {
            // Buscar pedido por ID (puede ser numérico o string)
            const pedido = pedidos.find(p => 
                String(p.id) === String(remision.pedidoId) ||
                p.id === remision.pedidoId
            );
            
            if (pedido) {
                const pedidoIdKey = String(remision.pedidoId);
                if (!groups[pedidoIdKey]) {
                    groups[pedidoIdKey] = {
                        id: pedido.id,
                        pedido: pedido,
                        remisiones: [],
                        cliente: (() => {
                            // Buscar cliente por ID numérico o por codter/numeroDocumento
                            return clientes.find(c => 
                                String(c.id) === String(pedido.clienteId) ||
                                c.numeroDocumento === pedido.clienteId ||
                                c.codter === pedido.clienteId
                            );
                        })(),
                    };
                }
                groups[pedidoIdKey].remisiones.push(remision);
            } else {
                console.warn('⚠️ [RemisionesPage] Remisión con pedidoId pero pedido no encontrado:', {
                    remisionId: remision.id,
                    remisionNumero: remision.numeroRemision,
                    pedidoIdBuscado: remision.pedidoId,
                    tipoPedidoId: typeof remision.pedidoId
                });
                // Crear un grupo especial para remisiones sin pedido encontrado
                const sinPedidoKey = `sin-pedido-${remision.id}`;
                if (!groups[sinPedidoKey]) {
                    // Buscar cliente directamente desde la remisión
                    const clienteRemision = clientes.find(c => 
                        String(c.id) === String(remision.clienteId) ||
                        c.numeroDocumento === remision.clienteId ||
                        c.codter === remision.clienteId
                    );
                    
                    // Crear un pedido "fantasma" para mantener la estructura
                    const pedidoFantasma: Pedido = {
                        id: `sin-pedido-${remision.id}`,
                        numeroPedido: `Sin Pedido (${remision.numeroRemision})`,
                        fechaPedido: remision.fechaRemision || new Date().toISOString().split('T')[0],
                        clienteId: remision.clienteId || '',
                        vendedorId: remision.vendedorId || '',
                        subtotal: remision.subtotal || 0,
                        descuentoValor: remision.descuentoValor || 0,
                        ivaValor: remision.ivaValor || 0,
                        total: remision.total || 0,
                        estado: 'REMITIDO',
                        observaciones: 'Remisión sin pedido asociado',
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
        } else {
            // Remisión sin pedidoId - crear grupo especial
            console.log('ℹ️ [RemisionesPage] Remisión sin pedidoId:', {
                remisionId: remision.id,
                remisionNumero: remision.numeroRemision,
                clienteId: remision.clienteId
            });
            
            const sinPedidoKey = `sin-pedido-${remision.id}`;
            if (!groups[sinPedidoKey]) {
                // Buscar cliente directamente desde la remisión
                const clienteRemision = clientes.find(c => 
                    String(c.id) === String(remision.clienteId) ||
                    c.numeroDocumento === remision.clienteId ||
                    c.codter === remision.clienteId
                );
                
                // Crear un pedido "fantasma" para mantener la estructura
                const pedidoFantasma: Pedido = {
                    id: `sin-pedido-${remision.id}`,
                    numeroPedido: `Sin Pedido (${remision.numeroRemision})`,
                    fechaPedido: remision.fechaRemision || new Date().toISOString().split('T')[0],
                    clienteId: remision.clienteId || '',
                    vendedorId: remision.vendedorId || '',
                    subtotal: remision.subtotal || 0,
                    descuentoValor: remision.descuentoValor || 0,
                    ivaValor: remision.ivaValor || 0,
                    total: remision.total || 0,
                    estado: 'REMITIDO',
                    observaciones: 'Remisión sin pedido asociado',
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

    // Sort remisiones within each group by date
    Object.values(groups).forEach(group => {
        group.remisiones.sort((a, b) => new Date(a.fechaRemision).getTime() - new Date(b.fechaRemision).getTime());
    });

    const sortedGroups = Object.values(groups).sort((a, b) => 
        new Date(b.remisiones[0].fechaRemision).getTime() - new Date(a.remisiones[0].fechaRemision).getTime()
    );
    
    console.log('✅ [RemisionesPage] Grupos de remisiones creados:', sortedGroups.length);
    console.log('📋 [RemisionesPage] Ejemplo de grupo:', sortedGroups[0] ? {
        pedidoId: sortedGroups[0].pedido?.id,
        pedidoNumero: sortedGroups[0].pedido?.numeroPedido,
        clienteNombre: sortedGroups[0].cliente?.nombreCompleto,
        remisionesCount: sortedGroups[0].remisiones.length
    } : 'No hay grupos');
    
    return sortedGroups;
  }, [remisiones, pedidos, clientes]);
  
  // El filtrado ahora se hace en el servidor, solo convertimos a array

  useEffect(() => {
    const focusId = params?.focusId;
    if (!focusId) {
      return;
    }

    const targetGroup = remisionGroups.find((group) =>
      group.remisiones.some((remision) => String(remision.id) === String(focusId))
    );

    if (targetGroup) {
      setFocusedGroupId(String(targetGroup.id));
      setSelectedGroup(targetGroup);
      setDetailModalOpen(true);
    }
  }, [params?.focusId, remisionGroups]);


  useEffect(() => {
    if (pedidoToRemisionar) {
        // Buscar remisiones previas comparando IDs de forma flexible
        const remisionesPrevias = remisiones.filter(r => 
            String(r.pedidoId) === String(pedidoToRemisionar.id) ||
            r.pedidoId === pedidoToRemisionar.id
        );
        
        const itemsPendientes = pedidoToRemisionar.items.reduce<RemisionItemForm[]>((acc, itemPedido) => {
            // Buscar producto por ID (puede ser numérico o string)
            const producto = allProducts.find(p => 
                String(p.id) === String(itemPedido.productoId) ||
                p.id === itemPedido.productoId
            );

            if (!producto) {
                console.warn(`Producto con ID ${itemPedido.productoId} no encontrado. Omitiendo del formulario de remisión.`);
                return acc;
            }

            const cantYaEnviada = remisionesPrevias.flatMap(r => r.items)
                .filter(i => String(i.productoId) === String(itemPedido.productoId))
                .reduce((sum, i) => sum + i.cantidad, 0);
            
            const cantPendiente = itemPedido.cantidad - cantYaEnviada;

            if (cantPendiente > 0) {
                const cantStock = producto.controlaExistencia ?? producto.stock ?? 0;
                const cantAEnviar = Math.max(0, Math.min(cantPendiente, cantStock));

                // Obtener nombre del producto: primero del producto encontrado, luego del item
                const productoNombre = producto.nombre || 
                                      itemPedido.descripcion || 
                                      itemPedido.nombre || 
                                      `Producto ${itemPedido.productoId}`;

                acc.push({
                    productoId: itemPedido.productoId,
                    referencia: producto.referencia || 'N/A',
                    descripcion: productoNombre, // Usar nombre del catálogo si está disponible
                    unidadMedida: producto.unidadMedida || itemPedido.unidadMedida || 'Unidad',
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
  }, [pedidoToRemisionar, remisiones, allProducts]);


  // Convertir remisionGroups a array para la tabla (ya viene paginado del servidor)
  const remisionGroupsArray = useMemo(() => {
    return Object.values(remisionGroups);
  }, [remisionGroups]);

  const pedidosTable = useTable<Pedido>({
    data: pedidosPorRemisionar,
    searchKeys: [
        'numeroPedido', 
        (item) => {
            const cliente = clientes.find(c => 
                String(c.id) === String(item.clienteId) ||
                c.numeroDocumento === item.clienteId ||
                c.codter === item.clienteId
            );
            return cliente?.nombreCompleto || cliente?.razonSocial || '';
        }
    ]
  });

  const handleOpenDetailModal = (group: RemisionGroup) => {
    setSelectedGroup(group);
    setDetailModalOpen(true);
  };
  
  const handleOpenCreateModal = (pedido: Pedido) => {
    setPedidoToRemisionar(pedido);
    setCreateModalOpen(true);
    // Reset logistic form fields
    setShippingMethod('transportadoraExterna');
    setTransportadoraId('');
    setOtraTransportadora('');
    setNumeroGuia('');
    setFechaDespacho(new Date().toISOString().split('T')[0]);
    setObservacionesInternas('');
    setFormErrors({});
  };
  
  const handlePrintRemision = (remision: Remision) => {
    setRemisionToPreview(remision);
  };

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

  const handleAprobarEntrega = async (remisionId: string) => {
    if (isDelivering) return;
    setIsDelivering(remisionId);
    
    try {
        const updatedRemision = await aprobarRemision(remisionId);
        if (updatedRemision) {
            setDeliveryResult(updatedRemision);
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
  }

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
    
    if (shippingMethod === 'transportadoraExterna') {
        if (!transportadoraId) {
            addNotification({ message: 'Debe seleccionar una transportadora.', type: 'warning' });
            setFormErrors(prev => ({ ...prev, transportadoraId: 'Campo obligatorio' }));
            setIsCreating(false);
            return;
        }
        if (transportadoraId === 'otra' && !otraTransportadora.trim()) {
            addNotification({ message: 'Debe especificar el nombre de la nueva transportadora.', type: 'warning' });
            setFormErrors(prev => ({ ...prev, otraTransportadora: 'Campo obligatorio' }));
            setIsCreating(false);
            return;
        }
    }
    
    try {
        const logisticData = {
            metodoEnvio: shippingMethod,
            transportadoraId: transportadoraId,
            otraTransportadora: otraTransportadora.trim(),
            numeroGuia: numeroGuia,
            fechaDespacho: fechaDespacho,
            observaciones: observacionesInternas,
        };

        const { nuevaRemision, mensaje } = await crearRemision(pedidoToRemisionar, itemsAEnviar, logisticData);

        // El backend actualiza automáticamente el estado del pedido cuando se crea una remisión
        // y crearRemision ya recarga pedidos y remisiones desde el backend con los estados actualizados
        // No es necesario actualizar manualmente el estado ni hacer refresh adicional
        
        // Notificar éxito
        addNotification({ message: mensaje, type: 'success' });
        
        handleCloseModals();
        setRemisionSuccessData(nuevaRemision);

        const LOW_STOCK_THRESHOLD = 10;
        nuevaRemision.items.forEach(item => {
            // Buscar producto por ID (puede ser numérico o string)
            const producto = allProducts.find(p => 
                String(p.id) === String(item.productoId) ||
                p.id === item.productoId
            );
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


  const remisionesGroupColumns: Column<RemisionGroup>[] = [
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
  ];

  const pedidosColumns: Column<Pedido>[] = [
    { header: 'Número Pedido', accessor: 'numeroPedido' },
    { 
        header: 'Cliente', 
        accessor: 'clienteId', 
        cell: (item) => {
            // Buscar cliente por ID numérico o por codter/numeroDocumento
            const cliente = clientes.find(c => 
                String(c.id) === String(item.clienteId) ||
                c.numeroDocumento === item.clienteId ||
                c.codter === item.clienteId
            );
            return cliente?.nombreCompleto || cliente?.razonSocial || item.clienteId || 'N/A';
        }
    },
    { header: 'Fecha', accessor: 'fechaPedido' },
    { header: 'Estado', accessor: 'estado', cell: (item) => <StatusBadge status={item.estado as any} /> },
    { header: 'Acciones', accessor: 'id', cell: (item) => (
        <ProtectedComponent permission="remisiones:create">
            <button onClick={() => handleOpenCreateModal(item)} className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-md hover:bg-green-700 transition-colors">
                <i className="fas fa-truck mr-2"></i>
                Remisionar
            </button>
        </ProtectedComponent>
    )},
  ];
  
  const currentCliente = useMemo(() => {
    if (!pedidoToRemisionar) return null;
    // Buscar cliente por ID numérico o por codter/numeroDocumento
    return clientes.find(c => 
        String(c.id) === String(pedidoToRemisionar.clienteId) ||
        c.numeroDocumento === pedidoToRemisionar.clienteId ||
        c.codter === pedidoToRemisionar.clienteId
    );
  }, [pedidoToRemisionar, clientes]);

  const additionalFilters = (
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
        <div>
            <label htmlFor="clientFilter" className="sr-only">Cliente</label>
            <select
                id="clientFilter"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="Todos">Todos los Clientes</option>
                {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombreCompleto}</option>
                ))}
            </select>
        </div>
    </div>
  );


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
                    <div><p className="font-semibold text-slate-600 dark:text-slate-400">Cliente:</p><p>{selectedGroup.cliente?.nombreCompleto}</p></div>
                    <div><p className="font-semibold text-slate-600 dark:text-slate-400">Estado del Pedido:</p><p><StatusBadge status={selectedGroup.pedido.estado as any} /></p></div>
                </div>
                
                <h4 className="text-base font-semibold pt-4 border-t border-slate-200 dark:border-slate-700">Historial de Entregas ({selectedGroup.remisiones.length})</h4>
                
                <div className="space-y-4">
                    {selectedGroup.remisiones.map((remision, index) => {
                        const tieneAdjunto = archivosAdjuntos.some(a => a.entidadId === remision.id && a.entidadTipo === 'REMISION');
                        return (
                        <div key={remision.id} className="border border-slate-200 dark:border-slate-700 rounded-lg">
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-t-lg">
                               <div>
                                 <h5 className="font-bold text-base text-slate-800 dark:text-slate-200">
                                    <i className="fas fa-truck text-slate-500 mr-3"></i>
                                    Entrega #{index + 1}: {remision.numeroRemision}
                                </h5>
                                 <p className="text-xs text-slate-500 dark:text-slate-400 ml-8">Fecha: {remision.fechaRemision}</p>
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
                            {remision.metodoEnvio && (
                                <div className="px-3 pt-2 pb-1 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    <div>
                                        <span className="font-semibold block">Método de Envío</span>
                                        <span>
                                            {
                                                remision.metodoEnvio === 'transportadoraExterna' ? 'Transportadora' :
                                                remision.metodoEnvio === 'transportePropio' ? 'Transporte Propio' : 'Recoge Cliente'
                                            }
                                        </span>
                                    </div>
                                    {remision.transportadora && (
                                        <div>
                                            <span className="font-semibold block">Transportadora</span>
                                            <span>{remision.transportadora}</span>
                                        </div>
                                    )}
                                    {remision.numeroGuia && (
                                        <div>
                                            <span className="font-semibold block">Nº Guía</span>
                                            <span className="font-mono">{remision.numeroGuia}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                             <div className="p-3">
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
                                        // Buscar producto por ID (puede ser numérico o string)
                                        const product = allProducts.find(p => 
                                            String(p.id) === String(item.productoId) ||
                                            p.id === item.productoId
                                        );
                                        
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
                                    const producto = allProducts.find(p => 
                                        String(p.id) === String(item.productoId) ||
                                        p.id === item.productoId
                                    );
                                    
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
                                <label htmlFor="shippingMethod" className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Método de Envío</label>
                                <select id="shippingMethod" value={shippingMethod} onChange={(e) => setShippingMethod(e.target.value as any)} className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500">
                                    <option value="transportadoraExterna">Transportadora Externa</option>
                                    <option value="transportePropio">Transporte Propio</option>
                                    <option value="recogeCliente">Recoge Cliente en Bodega</option>
                                </select>
                            </div>

                            {shippingMethod === 'transportadoraExterna' && (
                                <>
                                    <div>
                                        <label htmlFor="transportadora" className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Transportadora</label>
                                        <select id="transportadora" value={transportadoraId} onChange={(e) => {
                                                setTransportadoraId(e.target.value);
                                                if (formErrors.transportadoraId) {
                                                    setFormErrors(prev => ({ ...prev, transportadoraId: '' }));
                                                }
                                            }} className={`w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-1 ${formErrors.transportadoraId ? 'border-red-500 ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'}`} required={shippingMethod === 'transportadoraExterna'}>
                                            <option value="">Seleccione...</option>
                                            {transportadoras.map(t => (
                                                <option key={t.id} value={t.id}>{t.nombre}</option>
                                            ))}
                                            <option value="otra">Otra (especificar)</option>
                                        </select>
                                        {formErrors.transportadoraId && <p className="mt-1 text-xs text-red-500">{formErrors.transportadoraId}</p>}
                                    </div>
                                    {transportadoraId === 'otra' && (
                                        <div>
                                            <label htmlFor="otraTransportadora" className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre Nueva Transportadora</label>
                                            <input type="text" id="otraTransportadora" value={otraTransportadora} onChange={(e) => {
                                                    setOtraTransportadora(e.target.value);
                                                    if (formErrors.otraTransportadora) {
                                                        setFormErrors(prev => ({ ...prev, otraTransportadora: '' }));
                                                    }
                                                }} className={`w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-1 ${formErrors.otraTransportadora ? 'border-red-500 ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'}`} required />
                                            {formErrors.otraTransportadora && <p className="mt-1 text-xs text-red-500">{formErrors.otraTransportadora}</p>}
                                        </div>
                                    )}
                                    <div>
                                        <label htmlFor="numeroGuia" className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Número de Guía</label>
                                        <input type="text" id="numeroGuia" value={numeroGuia} onChange={(e) => setNumeroGuia(e.target.value)} className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                    </div>
                                </>
                            )}
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
                        const cliente = clientes.find(c => 
                            String(c.id) === String(remisionSuccessData.clienteId) ||
                            c.numeroDocumento === remisionSuccessData.clienteId ||
                            c.codter === remisionSuccessData.clienteId
                        );
                        return cliente?.nombreCompleto || cliente?.razonSocial || remisionSuccessData.clienteId || 'N/A';
                    })()
                },
                { label: 'Pedido Origen', value: pedidos.find(p => p.id === remisionSuccessData.pedidoId)?.numeroPedido || 'N/A' },
                { label: 'Transportadora', value: remisionSuccessData.transportadora || 'N/A' },
                { label: 'Nº Guía', value: remisionSuccessData.numeroGuia || 'N/A' },
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
                        const cliente = clientes.find(c => 
                            String(c.id) === String(deliveryResult.clienteId) ||
                            c.numeroDocumento === deliveryResult.clienteId ||
                            c.codter === deliveryResult.clienteId
                        );
                        return cliente?.nombreCompleto || cliente?.razonSocial || deliveryResult.clienteId || 'N/A';
                    })()
                },
                { label: 'Pedido Origen', value: pedidos.find(p => p.id === deliveryResult.pedidoId)?.numeroPedido || 'N/A' },
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