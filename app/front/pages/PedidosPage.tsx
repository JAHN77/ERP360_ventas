import React, { useState, useMemo, useEffect } from 'react';
import Table, { Column } from '../components/ui/Table';
import Card, { CardContent } from '../components/ui/Card';
import { Pedido, DocumentItem } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import { useNavigation } from '../hooks/useNavigation';
import Modal from '../components/ui/Modal';
import { useTable } from '../hooks/useTable';
import { TableToolbar } from '../components/ui/TableToolbar';
import TablePagination from '../components/ui/TablePagination';
import { useNotifications } from '../hooks/useNotifications';
import ApprovalSuccessModal from '../components/ui/ApprovalSuccessModal';
import { ProgressFlow, ProgressStep } from '../components/ui/ProgressFlow';
import DocumentPreviewModal from '../components/comercial/DocumentPreviewModal';
// FIX: Changed to a named import as PedidoPDF is now a named export.
import { PedidoPDF } from '../components/comercial/PedidoPDF';
import PedidoEditForm from '../components/comercial/PedidoEditForm';
import { useAuth } from '../hooks/useAuth';
import ProtectedComponent from '../components/auth/ProtectedComponent';
import { useData } from '../hooks/useData';
import { logger } from '../utils/logger';
import { apiClient, fetchPedidosDetalle } from '../services/apiClient';
import { formatDateOnly } from '../utils/formatters';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
}

const getPedidoProgressStatus = (pedido: Pedido): 'complete' | 'current' | 'incomplete' => {
  if (!pedido || pedido.estado === 'CANCELADO') return 'incomplete';
  if (pedido.estado === 'CONFIRMADO') return 'current';
  return 'complete';
}

const getRemisionProgressStatus = (pedido: Pedido): 'complete' | 'current' | 'incomplete' => {
  if (!pedido || pedido.estado === 'CANCELADO' || pedido.estado === 'REMITIDO') return 'incomplete';
  if (pedido.estado === 'EN_PROCESO' || pedido.estado === 'PARCIALMENTE_REMITIDO') return 'current';
  return 'complete';
}

const filterOptions = [
  { label: 'Todos', value: 'Todos' },
  { label: 'Confirmado', value: 'CONFIRMADO' },
  { label: 'En Proceso', value: 'EN_PROCESO' },
  { label: 'Remisionado Parcial', value: 'PARCIALMENTE_REMITIDO' },
  { label: 'Remisionado Total', value: 'REMITIDO' },
];

const PedidosPage: React.FC = () => {
  const { params, setPage } = useNavigation();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { clientes, cotizaciones, datosEmpresa, productos, aprobarPedido, actualizarPedido, marcarPedidoListoParaDespacho } = useData();

  // Estados para paginación del servidor
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingPedidos, setIsLoadingPedidos] = useState(false);
  const [statusFilter, setStatusFilter] = useState('Todos');

  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [pedidoToEdit, setPedidoToEdit] = useState<Pedido | null>(null);
  const [orderToPreview, setOrderToPreview] = useState<Pedido | null>(null);
  const [approvalResult, setApprovalResult] = useState<Pedido | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Cargar pedidos con paginación (con debounce para búsqueda)
  useEffect(() => {
    const loadPedidos = async () => {
      setIsLoadingPedidos(true);
      try {
        const estado = statusFilter !== 'Todos' ? statusFilter : undefined;
        const pedidosRes = await apiClient.getPedidos(
          currentPage,
          pageSize,
          searchTerm || undefined,
          estado
        );
        if (pedidosRes.success) {
          // Obtener detalles de pedidos para los items
          // Cargar detalles para los pedidos de la página actual
          const pedidosData = (pedidosRes.data as any[]) || [];
          const pedidosIds = pedidosData.map(p => String(p.id || '')).filter(id => id);

          // Cargar detalles para cada pedido de forma eficiente
          const detallesPromises = pedidosIds.map(async (pedidoId) => {
            try {
              console.log(`🔄 Cargando detalles para pedido ${pedidoId}...`);
              const pedidosDetalleRes = await apiClient.getPedidosDetalle(pedidoId);
              if (pedidosDetalleRes.success && Array.isArray(pedidosDetalleRes.data)) {
                console.log(`✅ Detalles cargados para pedido ${pedidoId}:`, pedidosDetalleRes.data.length, 'items');
                // Verificar que los items tengan el pedidoId correcto
                const itemsFiltrados = pedidosDetalleRes.data.filter((d: any) => {
                  const detallePedidoId = String(d.pedidoId || d.pedido_id || '');
                  const match = detallePedidoId === pedidoId ||
                    String(d.pedidoId) === String(pedidoId) ||
                    Number(d.pedidoId) === Number(pedidoId);
                  return match;
                });
                console.log(`✅ Items filtrados para pedido ${pedidoId}:`, itemsFiltrados.length);
                return { pedidoId, items: itemsFiltrados };
              }
              console.warn(`⚠️ No se encontraron detalles para pedido ${pedidoId}`);
              return { pedidoId, items: [] };
            } catch (error) {
              console.error(`❌ Error cargando detalles del pedido ${pedidoId}:`, error);
              return { pedidoId, items: [] };
            }
          });

          const detallesResults = await Promise.all(detallesPromises);

          // Crear un mapa de pedidoId -> items para acceso rápido
          const detallesMap = new Map<string, any[]>();
          detallesResults.forEach(({ pedidoId, items }) => {
            detallesMap.set(pedidoId, items);
            console.log(`📦 Mapa: pedido ${pedidoId} tiene ${items.length} items`);
          });

          // Mapear pedidos con sus items
          const pedidosConDetalles = pedidosData.map(p => {
            const pedidoIdStr = String(p.id || '');
            const items = detallesMap.get(pedidoIdStr) || [];

            if (items.length > 0) {
              console.log(`✅ Pedido ${pedidoIdStr} tiene ${items.length} items asignados`);
            }

            return {
              ...p,
              items: items.length > 0 ? items : (p.items || [])
            } as Pedido;
          });

          setPedidos(pedidosConDetalles);

          // Usar información de paginación del servidor
          if ((pedidosRes as any).pagination) {
            setTotalItems((pedidosRes as any).pagination.total);
            setTotalPages((pedidosRes as any).pagination.totalPages);
          }
        }
      } catch (error) {
        console.error('Error cargando pedidos:', error);
        addNotification({ message: 'Error al cargar pedidos', type: 'warning' });
      } finally {
        setIsLoadingPedidos(false);
      }
    };

    // Debounce para búsqueda: esperar 500ms después de que el usuario deje de escribir
    const timeoutId = setTimeout(() => {
      loadPedidos();
    }, searchTerm ? 500 : 0);

    return () => clearTimeout(timeoutId);
  }, [currentPage, pageSize, searchTerm, statusFilter, addNotification]);

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

  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setCurrentPage(1); // Reset a primera página al cambiar filtro
  };

  const selectedPedidoTotals = useMemo(() => {
    if (!selectedPedido) {
      return { subtotalBruto: 0, descuentoTotal: 0, subtotalNeto: 0, iva: 0, total: 0 };
    }
    const subtotalBruto = selectedPedido.items.reduce((acc, item) => acc + (item.precioUnitario * item.cantidad), 0);
    const descuentoTotal = selectedPedido.items.reduce((acc, item) => {
      const itemTotalBruto = item.precioUnitario * item.cantidad;
      return acc + (itemTotalBruto * ((item.descuentoPorcentaje || 0) / 100));
    }, 0);
    const subtotalNeto = subtotalBruto - descuentoTotal;
    // Usar valorIva directamente del backend (ya calculado), NO recalcular
    const iva = selectedPedido.items.reduce((acc, item) => {
      // Prioridad 1: usar valorIva del backend (ya calculado desde BD)
      if (item.valorIva !== undefined && item.valorIva !== null) {
        return acc + item.valorIva;
      }
      // Fallback: si no viene valorIva, calcular desde subtotal
      const itemSubtotal = item.subtotal ?? ((item.precioUnitario || 0) * (item.cantidad || 0) * (1 - (item.descuentoPorcentaje || 0) / 100));
      const itemIva = itemSubtotal * ((item.ivaPorcentaje || 0) / 100);
      return acc + itemIva;
    }, 0);
    const total = subtotalNeto + iva;

    return { subtotalBruto, descuentoTotal, subtotalNeto, iva, total };
  }, [selectedPedido]);


  const handleOpenDetailModal = async (pedido: Pedido) => {
    // Primero establecer el pedido para mostrar el modal inmediatamente
    setSelectedPedido(pedido);
    setDetailModalOpen(true);

    // SIEMPRE intentar cargar los detalles, incluso si ya tiene items
    // Esto asegura que siempre tengamos los datos más actualizados
    try {
      console.log('🔄 Cargando detalles del pedido:', pedido.id, 'Tipo:', typeof pedido.id);

      // Usar fetchPedidosDetalle desde apiClient
      const pedidosDetalleRes = await fetchPedidosDetalle(String(pedido.id));
      console.log('📦 Respuesta completa de detalles:', pedidosDetalleRes);
      console.log('📦 success:', pedidosDetalleRes.success);
      console.log('📦 data:', pedidosDetalleRes.data);
      console.log('📦 data es Array?:', Array.isArray(pedidosDetalleRes.data));

      if (pedidosDetalleRes.success && Array.isArray(pedidosDetalleRes.data)) {
        console.log('📦 Total de items recibidos:', pedidosDetalleRes.data.length);
        console.log('📦 Primer item (si existe):', pedidosDetalleRes.data[0]);
        console.log('📦 IDs de pedido en los items:', pedidosDetalleRes.data.map((d: any) => ({
          pedidoId: d.pedidoId,
          tipoPedidoId: typeof d.pedidoId,
          pedidoIdOriginal: pedido.id,
          tipoPedidoIdOriginal: typeof pedido.id
        })));

        // Filtrar items que pertenecen a este pedido
        // Comparar de múltiples formas para asegurar que coincida
        const items = pedidosDetalleRes.data.filter((d: any) => {
          const detallePedidoId = d.pedidoId !== null && d.pedidoId !== undefined ? String(d.pedidoId).trim() : '';
          const pedidoIdStr = pedido.id !== null && pedido.id !== undefined ? String(pedido.id).trim() : '';

          // Múltiples formas de comparar
          const match = detallePedidoId === pedidoIdStr ||
            String(pedido.id) === String(d.pedidoId) ||
            Number(pedido.id) === Number(d.pedidoId) ||
            parseInt(String(pedido.id), 10) === parseInt(String(d.pedidoId), 10);

          if (match) {
            console.log('✅ Item coincidente encontrado:', {
              detallePedidoId,
              pedidoIdStr,
              item: d
            });
          }

          return match;
        });

        console.log('✅ Items encontrados para el pedido después del filtro:', items.length);
        console.log('✅ Items encontrados:', items);

        // Actualizar el pedido con los items cargados
        const pedidoConItems = {
          ...pedido,
          items: items.length > 0 ? items : []
        };
        setSelectedPedido(pedidoConItems);
      } else {
        console.warn('⚠️ No se encontraron items o respuesta inválida');
        console.warn('⚠️ Respuesta:', pedidosDetalleRes);
        // Asegurar que items sea un array vacío si no hay datos
        setSelectedPedido({
          ...pedido,
          items: []
        });
      }
    } catch (error) {
      console.error('❌ Error cargando detalles del pedido:', error);
      console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      // Asegurar que items sea un array vacío en caso de error
      setSelectedPedido({
        ...pedido,
        items: []
      });
    }
  };

  useEffect(() => {
    const focusId = params?.focusId;
    if (!focusId) {
      return;
    }

    const targetPedido = pedidos.find((pedido) => String(pedido.id) === String(focusId) || String(pedido.numeroPedido) === String(focusId));
    if (targetPedido) {
      handleOpenDetailModal(targetPedido);
    }
  }, [params?.focusId, pedidos]);

  const handleCloseModals = () => {
    setDetailModalOpen(false);
    setSelectedPedido(null);
    if (params?.focusId || params?.highlightId) {
      const { focusId: _focus, highlightId: _highlight, ...rest } = params;
      setPage('pedidos', rest);
    }
  };

  const handleUpdatePedido = async (data: Pick<Pedido, 'items' | 'subtotal' | 'ivaValor' | 'total'>) => {
    if (!pedidoToEdit || !user) return;

    const pedidoActualizado = await actualizarPedido(pedidoToEdit.id, data, user.nombre);

    if (pedidoActualizado) {
      addNotification({ message: `Pedido ${pedidoActualizado.numeroPedido} actualizado correctamente.`, type: 'success' });
    }
    setPedidoToEdit(null);
  };


  const executeApproval = async () => {
    if (!orderToPreview) return;
    setIsConfirming(true);

    try {
      const pedidoAprobado = await aprobarPedido(orderToPreview.id);

      if (pedidoAprobado) {
        // Actualizar el pedido en el preview para reflejar el cambio
        setOrderToPreview(pedidoAprobado);

        // Cerrar el modal de preview y mostrar el resultado
        setTimeout(() => {
          setOrderToPreview(null);
          setApprovalResult(pedidoAprobado);
        }, 500); // Pequeño delay para mostrar el cambio

        addNotification({
          message: `Pedido ${pedidoAprobado.numeroPedido} aprobado. Listo para remisionar.`,
          type: 'success',
        });
      } else {
        addNotification({
          message: 'No se pudo aprobar el pedido. Por favor, intenta nuevamente.',
          type: 'warning',
        });
      }
    } catch (error) {
      logger.error({ prefix: 'PedidosPage' }, 'Error aprobando pedido:', error);
      addNotification({
        message: 'Error al aprobar el pedido. Por favor, intenta nuevamente.',
        type: 'warning',
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleApproveFromModal = async () => {
    if (!selectedPedido) return;
    setIsApproving(true);

    try {
      const pedidoAprobado = await aprobarPedido(selectedPedido.id);

      if (pedidoAprobado) {
        // Actualizar el pedido en el modal de detalles
        setSelectedPedido(pedidoAprobado);

        addNotification({
          message: `Pedido ${pedidoAprobado.numeroPedido} aprobado.`,
          type: 'success',
        });
      } else {
        addNotification({
          message: 'No se pudo aprobar el pedido. Por favor, intenta nuevamente.',
          type: 'warning',
        });
      }
    } catch (error) {
      logger.error({ prefix: 'PedidosPage' }, 'Error aprobando pedido:', error);
      addNotification({
        message: 'Error al aprobar el pedido. Por favor, intenta nuevamente.',
        type: 'warning',
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleMarkReadyForDispatch = async (pedidoId: string) => {
    const updatedPedido = await marcarPedidoListoParaDespacho(pedidoId);
    if (updatedPedido) {
      setSelectedPedido(updatedPedido);
      addNotification({ message: `Pedido ${updatedPedido.numeroPedido} listo para despacho.`, type: 'success' });
    }
  };


  const handleCreateRemision = (pedidoId: string) => {
    handleCloseModals();
    setApprovalResult(null);
    setPage('remisiones', { openCreateForPedidoId: pedidoId });
  };

  const columns: Column<Pedido>[] = [
    {
      header: 'Número',
      accessor: 'numeroPedido',
      cell: (item) => (
        <span className="font-bold font-mono text-slate-700 dark:text-slate-200">{item.numeroPedido}</span>
      )
    },
    {
      header: 'Cotización',
      accessor: 'cotizacionId',
      cell: (item) => {
        // Usar numeroCotizacionOrigen si está disponible (viene del JOIN en el backend)
        if (item.numeroCotizacionOrigen) {
          return <span className="text-sm text-slate-600 dark:text-slate-400">{item.numeroCotizacionOrigen}</span>;
        }
        // Fallback: buscar en el array de cotizaciones
        if (item.cotizacionId) {
          const cotizacion = cotizaciones.find(c => String(c.id) === String(item.cotizacionId));
          return <span className="text-sm text-slate-600 dark:text-slate-400">{cotizacion?.numeroCotizacion || 'N/A'}</span>;
        }
        return <span className="text-xs text-slate-400">N/A</span>;
      }
    },
    {
      header: 'Cliente',
      accessor: 'clienteId',
      cell: (item) => {
        // Usar el nombre del cliente que viene directamente del backend (nomter de la BD)
        const nombre = item.clienteNombre && item.clienteNombre.trim() !== '' ? item.clienteNombre : 'N/A';
        return (
          <div className="flex flex-col max-w-[200px]">
            <span className="font-medium text-slate-700 dark:text-slate-200 truncate" title={nombre}>
              {nombre}
            </span>
          </div>
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
    {
      header: 'Total',
      accessor: 'total',
      cell: (item) => (
        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{formatCurrency(item.total)}</span>
      )
    },
    {
      header: 'Forma de Pago',
      accessor: 'formaPago',
      cell: (item) => {
        // Validación defensiva: si item es undefined o null, retornar N/A
        if (!item) return <span className="text-slate-400 text-xs">N/A</span>;

        // Intentar obtener forma de pago desde el pedido, luego desde la cotización relacionada
        let formaPagoPedido = item.formaPago;
        if (!formaPagoPedido && item.cotizacionId) {
          const cotizacion = cotizaciones.find(c => String(c.id) === String(item.cotizacionId));
          if (cotizacion && cotizacion.formaPago) {
            formaPagoPedido = cotizacion.formaPago;
          }
        }
        if (!formaPagoPedido) return <span className="text-slate-400 text-xs">N/A</span>;

        const formaPagoValue = formaPagoPedido === '01' ? '1' : formaPagoPedido === '02' ? '2' : formaPagoPedido;
        const isContado = formaPagoValue === '1' || formaPagoValue === '01';

        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isContado
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            }`}>
            <i className={`fas fa-${isContado ? 'money-bill-wave' : 'clock'} mr-1.5`}></i>
            {isContado ? 'Contado' : 'Crédito'}
          </span>
        );
      }
    },
    { header: 'Estado', accessor: 'estado', cell: (item) => <StatusBadge status={item.estado as any} /> },
    {
      header: 'Acciones', accessor: 'id', cell: (item) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenDetailModal(item)}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
            title="Ver Detalles"
          >
            <i className="fas fa-eye"></i>
          </button>
          <ProtectedComponent permission="pedidos:approve">
            {(item.estado === 'ENVIADA' || item.estado === 'BORRADOR') && (
              <button
                onClick={() => setOrderToPreview(item)}
                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all duration-200"
                title="Aprobar Pedido"
              >
                <i className="fas fa-check-circle"></i>
              </button>
            )}
          </ProtectedComponent>
        </div>
      )
    },
  ];

  const additionalFilters = (
    <div className="flex flex-col sm:flex-row gap-4">
      <div>
        <label htmlFor="statusFilter" className="sr-only">Estado</label>
        <select
          id="statusFilter"
          value={statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value)}
          className="w-full sm:w-auto px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {filterOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            Gestión de Pedidos
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Administra y da seguimiento a los pedidos de venta.
          </p>
        </div>
      </div>

      <Card className="shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
          <TableToolbar
            searchTerm={searchTerm}
            onSearchChange={handleSearch}
            createActionLabel="Nuevo Pedido"
            onCreateAction={() => setPage('nuevo_pedido')}
            additionalFilters={additionalFilters}
            placeholder="Buscar pedido, cliente..."
          />
        </div>

        <CardContent className="p-0">
          {isLoadingPedidos ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-3">
              <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
              <span className="font-medium">Cargando pedidos...</span>
            </div>
          ) : (
            <Table
              columns={columns}
              data={pedidos}
              onSort={() => { }}
              sortConfig={null}
              highlightRowId={params?.highlightId ?? params?.focusId}
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

      {selectedPedido && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={handleCloseModals}
          title={`Detalle Pedido: ${selectedPedido.numeroPedido}`}
          size="3xl"
        >
          <div className="space-y-6 text-sm">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg">
              <h4 className="text-base font-semibold mb-4 text-center text-slate-700 dark:text-slate-300">Progreso del Ciclo de Venta</h4>
              <ProgressFlow>
                <ProgressStep title="Cotización" status={selectedPedido.cotizacionId ? 'complete' : 'incomplete'} />
                <ProgressStep title="Pedido" status={getPedidoProgressStatus(selectedPedido)}><StatusBadge status={selectedPedido.estado as any} /></ProgressStep>
                <ProgressStep title="Remisión" status={getRemisionProgressStatus(selectedPedido)}>
                  <StatusBadge status={selectedPedido.estado as any} />
                </ProgressStep>
              </ProgressFlow>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Cliente</p>
                <p className="text-slate-800 dark:text-slate-200">
                  {(() => {
                    // Buscar cliente por ID numérico o por codter/numeroDocumento
                    const cliente = clientes.find(c =>
                      String(c.id) === String(selectedPedido.clienteId) ||
                      c.numeroDocumento === selectedPedido.clienteId ||
                      c.codter === selectedPedido.clienteId
                    );
                    return cliente?.nombreCompleto || cliente?.razonSocial || selectedPedido.clienteId || 'N/A';
                  })()}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Cotización Origen</p>
                <p className="text-slate-800 dark:text-slate-200">
                  {selectedPedido.numeroCotizacionOrigen ||
                    (selectedPedido.cotizacionId ? cotizaciones.find(c => String(c.id) === String(selectedPedido.cotizacionId))?.numeroCotizacion : 'N/A') ||
                    'N/A'}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Fecha Emisión</p>
                <p className="text-slate-800 dark:text-slate-200">{formatDateOnly(selectedPedido.fechaPedido)}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Fecha Entrega Estimada</p>
                <p className="text-slate-800 dark:text-slate-200">{formatDateOnly(selectedPedido.fechaEntregaEstimada)}</p>
              </div>
              {(selectedPedido.formaPago || (() => {
                let formaPagoPedido = selectedPedido.formaPago;
                if (!formaPagoPedido && selectedPedido.cotizacionId) {
                  const cotizacion = cotizaciones.find(c => String(c.id) === String(selectedPedido.cotizacionId));
                  if (cotizacion && cotizacion.formaPago) {
                    formaPagoPedido = cotizacion.formaPago;
                  }
                }
                return formaPagoPedido;
              })()) && (
                  <div>
                    <p className="font-semibold text-slate-600 dark:text-slate-400">Forma de Pago</p>
                    <p className="text-slate-800 dark:text-slate-200">
                      {(() => {
                        const formaPagoValue = selectedPedido.formaPago || (() => {
                          if (selectedPedido.cotizacionId) {
                            const cotizacion = cotizaciones.find(c => String(c.id) === String(selectedPedido.cotizacionId));
                            if (cotizacion && cotizacion.formaPago) {
                              return cotizacion.formaPago;
                            }
                          }
                          return undefined;
                        })();
                        if (!formaPagoValue) return 'N/A';
                        const normalizedValue = formaPagoValue === '01' ? '1' : formaPagoValue === '02' ? '2' : formaPagoValue;
                        return normalizedValue === '1' ? 'Contado' : normalizedValue === '2' ? 'Crédito' : formaPagoValue;
                      })()}
                    </p>
                  </div>
                )}
              <div className="sm:col-span-2">
                <p className="font-semibold text-slate-600 dark:text-slate-400">Instrucciones de Entrega</p>
                <p className="text-slate-800 dark:text-slate-200">{selectedPedido.instruccionesEntrega || 'Sin instrucciones.'}</p>
              </div>
              <div className="flex flex-col items-start">
                <p className="font-semibold text-slate-600 dark:text-slate-400">Estado</p>
                <StatusBadge status={selectedPedido.estado as any} />
              </div>
            </div>

            <div>
              <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">Items del Pedido</h4>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full divide-y divide-slate-200 dark:divide-slate-700 table-auto">
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Producto</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Unidad</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Cant.</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">P. Unit.</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Desc. %</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">IVA %</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Subtotal</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Valor IVA</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                    {selectedPedido.items && Array.isArray(selectedPedido.items) && selectedPedido.items.length > 0 ? (
                      selectedPedido.items.map((item: DocumentItem, index: number) => {
                        // Buscar producto por ID (puede ser numérico o string)
                        const product = productos.find(p =>
                          String(p.id) === String(item.productoId) ||
                          p.id === item.productoId
                        );

                        // Obtener nombre del producto: primero del producto encontrado, luego del item
                        const productoNombre = product?.nombre ||
                          item.descripcion ||
                          item.descripcion ||
                          (item as any).nombre ||
                          `Producto ${index + 1}`;

                        // Obtener unidad de medida: primero del producto, luego del item
                        const unidadMedida = product?.unidadMedida ||
                          (item as any).unidadMedida ||
                          'Unidad';

                        // Usar valores del backend directamente (igual que en cotizaciones)
                        const itemSubtotal = item.subtotal ?? ((item.precioUnitario || 0) * (item.cantidad || 0) * (1 - (item.descuentoPorcentaje || 0) / 100));
                        const itemIva = item.valorIva ?? (itemSubtotal * ((item.ivaPorcentaje || 0) / 100));

                        return (
                          <tr key={item.productoId || `item-${index}`}>
                            <td className="px-4 py-3 break-words text-sm text-slate-700 dark:text-slate-300">
                              {productoNombre}
                              {!product && (
                                <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400" title="Producto no encontrado en el catálogo">
                                  <i className="fas fa-exclamation-triangle"></i>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{unidadMedida}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 text-right">{item.cantidad}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 text-right">{formatCurrency(item.precioUnitario)}</td>
                            <td className="px-4 py-3 text-sm text-red-600 dark:text-red-500 text-right">{(item.descuentoPorcentaje || 0).toFixed(2)}%</td>
                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 text-right">
                              {(() => {
                                // Redondear a porcentajes estándar de IVA (19%, 5%, 8%, 0%)
                                const ivaPct = Number(item.ivaPorcentaje || 0);
                                if (ivaPct >= 18.5 && ivaPct <= 19.5) {
                                  return '19.00%';
                                } else if (ivaPct >= 7.5 && ivaPct <= 8.5) {
                                  return '8.00%';
                                } else if (ivaPct >= 4.5 && ivaPct <= 5.5) {
                                  return '5.00%';
                                } else if (ivaPct < 0.5) {
                                  return '0.00%';
                                } else {
                                  // Si no coincide con valores estándar, mostrar con 2 decimales
                                  return Number(ivaPct.toFixed(2)) + '%';
                                }
                              })()}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200 text-right">{formatCurrency(itemSubtotal)}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 text-right">{formatCurrency(itemIva)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                          {selectedPedido.items === undefined ? (
                            <div className="flex flex-col items-center justify-center">
                              <i className="fas fa-spinner fa-spin text-2xl mb-2"></i>
                              <span>Cargando productos...</span>
                            </div>
                          ) : (
                            <span>No hay productos en este pedido</span>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <div className="w-full max-w-sm space-y-2 text-slate-700 dark:text-slate-300 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal Bruto</span>
                  <span>{formatCurrency(selectedPedidoTotals.subtotalBruto)}</span>
                </div>
                <div className="flex justify-between text-red-600 dark:text-red-500">
                  <span>Descuento</span>
                  <span>-{formatCurrency(selectedPedidoTotals.descuentoTotal)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-slate-300 dark:border-slate-600 pt-2 mt-2">
                  <span>Subtotal Neto</span>
                  <span>{formatCurrency(selectedPedidoTotals.subtotalNeto)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA</span>
                  <span>{formatCurrency(selectedPedidoTotals.iva)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t-2 border-slate-400 dark:border-slate-500 pt-2 mt-2 text-blue-600 dark:text-blue-400">
                  <span>TOTAL</span>
                  <span>{formatCurrency(selectedPedidoTotals.total)}</span>
                </div>
              </div>
            </div>

            {selectedPedido.historial && selectedPedido.historial.length > 0 && (
              <div>
                <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">Historial de Cambios</h4>
                <div className="max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                  {selectedPedido.historial.slice().reverse().map((log, index) => (
                    <div key={index} className="text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{new Date(log.timestamp).toLocaleString('es-CO')} - {log.usuario}: </span>
                      <span className="text-slate-600 dark:text-slate-300">{log.accion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <div>
                <ProtectedComponent permission="pedidos:edit">
                  {(selectedPedido.estado === 'ENVIADA' || selectedPedido.estado === 'BORRADOR') && (
                    <button onClick={() => { handleCloseModals(); setPedidoToEdit(selectedPedido); }} className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition-colors">
                      <i className="fas fa-pencil-alt mr-2"></i>Editar Pedido
                    </button>
                  )}
                </ProtectedComponent>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleCloseModals} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">
                  Cerrar
                </button>
                <ProtectedComponent permission="pedidos:approve">
                  {(selectedPedido.estado === 'ENVIADA' || selectedPedido.estado === 'BORRADOR') && (
                    <button onClick={handleApproveFromModal} disabled={isApproving} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-slate-400">
                      {isApproving ? <><i className="fas fa-spinner fa-spin mr-2"></i>Aprobando...</> : <><i className="fas fa-check mr-2"></i>Aprobar Pedido</>}
                    </button>
                  )}
                </ProtectedComponent>
                {(selectedPedido.estado === 'EN_PROCESO' || selectedPedido.estado === 'PARCIALMENTE_REMITIDO') && (
                  <button onClick={() => handleCreateRemision(selectedPedido.id)} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                    <i className="fas fa-truck mr-2"></i>Crear Remisión
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {pedidoToEdit && (
        <Modal
          isOpen={!!pedidoToEdit}
          onClose={() => setPedidoToEdit(null)}
          title={`Editar Pedido: ${pedidoToEdit.numeroPedido}`}
          size="3xl"
        >
          <PedidoEditForm
            initialData={pedidoToEdit}
            onSubmit={handleUpdatePedido}
            onCancel={() => setPedidoToEdit(null)}
          />
        </Modal>
      )}

      {orderToPreview && (() => {
        // Buscar cliente por ID numérico o por codter/numeroDocumento
        const cliente = clientes.find(c =>
          String(c.id) === String(orderToPreview.clienteId) ||
          c.numeroDocumento === orderToPreview.clienteId ||
          c.codter === orderToPreview.clienteId
        );
        if (!cliente) return null;
        return (
          <DocumentPreviewModal
            isOpen={!!orderToPreview}
            onClose={() => setOrderToPreview(null)}
            title={`Previsualizar Pedido: ${orderToPreview.numeroPedido}`}
            onConfirm={executeApproval}
            onEdit={() => {
              setOrderToPreview(null);
              setPedidoToEdit(orderToPreview);
            }}
            isConfirming={isConfirming}
            documentType="pedido"
            clientEmail={cliente.email}
            clientName={cliente.nombreCompleto}
          >
            <PedidoPDF
              pedido={orderToPreview}
              cliente={cliente}
              empresa={datosEmpresa}
            />
          </DocumentPreviewModal>
        );
      })()}

      {approvalResult && (() => {
        const pedido = approvalResult;
        const subtotalBruto = pedido.items.reduce((acc, item) => acc + (item.precioUnitario * item.cantidad), 0);
        const descuentoTotal = pedido.items.reduce((acc, item) => {
          const itemTotalBruto = item.precioUnitario * item.cantidad;
          return acc + (itemTotalBruto * (item.descuentoPorcentaje / 100));
        }, 0);

        return (
          <ApprovalSuccessModal
            isOpen={!!approvalResult}
            onClose={() => setApprovalResult(null)}
            title="¡Pedido Aprobado!"
            message={
              <>
                El pedido <strong>{pedido.numeroPedido}</strong> ha sido aprobado y está listo para ser remisionado.
              </>
            }
            summaryTitle="Resumen del Pedido"
            summaryDetails={[
              {
                label: 'Cliente',
                value: (() => {
                  const cliente = clientes.find(c =>
                    String(c.id) === String(pedido.clienteId) ||
                    c.numeroDocumento === pedido.clienteId ||
                    c.codter === pedido.clienteId
                  );
                  return cliente?.nombreCompleto || cliente?.razonSocial || pedido.clienteId || 'N/A';
                })()
              },
              { label: 'Nº Items', value: pedido.items.length },
              { label: 'sep1', value: '', isSeparator: true },
              { label: 'Subtotal Bruto', value: formatCurrency(subtotalBruto) },
              { label: 'Descuento Total', value: `-${formatCurrency(descuentoTotal)}`, isDiscount: true },
              { label: 'Subtotal Neto', value: formatCurrency(pedido.subtotal) },
              { label: 'IVA (19%)', value: formatCurrency(pedido.ivaValor) },
              { label: 'Total Pedido', value: formatCurrency(pedido.total), isTotal: true },
            ]}
            primaryAction={{
              label: 'Crear Remisión',
              onClick: () => handleCreateRemision(pedido.id),
            }}
          />
        );
      })()}

    </div>
  );
};

export default PedidosPage;