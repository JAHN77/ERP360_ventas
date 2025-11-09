import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Table, { Column } from '../components/ui/Table';
import Card, { CardContent } from '../components/ui/Card';
import { Cotizacion, DocumentItem, Pedido, Remision } from '../types';
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
import CotizacionPDF from '../components/comercial/CotizacionPDF';
import ProtectedComponent from '../components/auth/ProtectedComponent';
import { useData } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
}

// --- Status Calculation Logic ---

const getCotizacionProgressStatus = (cotizacion: Cotizacion): 'complete' | 'current' | 'incomplete' => {
    if (cotizacion.estado === 'APROBADA') return 'complete';
    if (cotizacion.estado === 'ENVIADA') return 'current';
    return 'incomplete';
};

const getPedidoProgressStatus = (cotizacion: Cotizacion, pedido?: Pedido): 'complete' | 'current' | 'incomplete' => {
    if (!pedido) {
        if (cotizacion.estado === 'APROBADA') return 'current';
        if (cotizacion.estado === 'ENVIADA') return 'current';
        return 'incomplete';
    }
    if (pedido.estado !== 'CONFIRMADO' && pedido.estado !== 'CANCELADO') return 'complete';
    if (pedido.estado === 'CONFIRMADO') return 'current';
    return 'incomplete';
};

const getRemisionProgressStatus = (pedido?: Pedido): 'complete' | 'current' | 'incomplete' => {
    if (!pedido || pedido.estado === 'CONFIRMADO' || pedido.estado === 'CANCELADO') return 'incomplete';
    if (pedido.estado === 'EN_PROCESO' || pedido.estado === 'PARCIALMENTE_REMITIDO') return 'current';
    return 'complete';
};

const getFacturacionProgressStatus = (remisionesPedido: Remision[], facturasPedido: any[]): 'complete' | 'current' | 'incomplete' => {
    if (remisionesPedido.length === 0) return 'incomplete';
    const totalRemisiones = remisionesPedido.length;
    const totalFacturas = facturasPedido.length;

    if (totalFacturas > 0 && totalRemisiones === totalFacturas) return 'complete';
    if (totalFacturas >= 0 && remisionesPedido.some(r => r.estado === 'ENTREGADO')) return 'current';
    
    return 'incomplete';
};

const filterOptions = [
  { label: 'Todas', value: 'Todos' },
  { label: 'Enviada', value: 'ENVIADA' },
  { label: 'Aprobada', value: 'APROBADA' },
  { label: 'Rechazada', value: 'RECHAZADA' },
];


const CotizacionesPage: React.FC = () => {
  const { params, setPage } = useNavigation();
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const { cotizaciones, clientes, vendedores, aprobarCotizacion, pedidos, remisiones, facturas, datosEmpresa, productos, getCotizacionById, actualizarCotizacion } = useData();
  
  const [statusFilter, setStatusFilter] = useState('Todos');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCotizacion, setSelectedCotizacion] = useState<Cotizacion | null>(null);
  const [approvedItems, setApprovedItems] = useState<Set<number>>(new Set());
  
  const [quoteToPreview, setQuoteToPreview] = useState<Cotizacion | null>(null);
  const [approvalResult, setApprovalResult] = useState<{ cotizacion: Cotizacion, pedido: Pedido } | null>(null);
  
  const ENABLE_BATCH_APPROVAL = false;

  // Selección múltiple (temporalmente deshabilitada si ENABLE_BATCH_APPROVAL es false)
  const [selectedCotizaciones, setSelectedCotizaciones] = useState<Set<string>>(new Set());
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  const filteredData = useMemo(() => {
    const sortedQuotes = [...cotizaciones].sort((a, b) => new Date(b.fechaCotizacion).getTime() - new Date(a.fechaCotizacion).getTime());
    if (statusFilter === 'Todos') {
        return sortedQuotes;
    }
    return sortedQuotes.filter(c => c.estado === statusFilter);
  }, [cotizaciones, statusFilter]);


  const {
    paginatedData,
    requestSort,
    sortConfig,
    searchTerm,
    handleSearch,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    goToPage,
    totalItems,
    rowsPerPage,
    setRowsPerPage,
  } = useTable<Cotizacion>({
    data: filteredData,
    searchKeys: [
      'numeroCotizacion',
      'estado',
      (item) => clientes.find(c => c.id === item.clienteId)?.nombreCompleto || '',
      (item) => {
          const vendedor = vendedores.find(v => v.id === item.vendedorId);
          return vendedor ? `${vendedor.primerNombre} ${vendedor.primerApellido}` : '';
      },
    ],
  });

  const handleOpenModal = useCallback((cotizacion: Cotizacion) => {
    setSelectedCotizacion(cotizacion);
    if (cotizacion.estado === 'ENVIADA') {
        setApprovedItems(new Set(cotizacion.items.map(item => item.productoId)));
    } else if (cotizacion.estado === 'APROBADA') {
        setApprovedItems(new Set(cotizacion.approvedItems || []));
    } else {
        setApprovedItems(new Set());
    }
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedCotizacion(null);
    setApprovedItems(new Set());
    if (params.focusId) {
        setPage('cotizaciones', {}); // Clear param on close
    }
  }, [params.focusId, setPage]);
  
  useEffect(() => {
    if (params.focusId && !isModalOpen) {
        const quoteToFocus = getCotizacionById(params.focusId);
        if(quoteToFocus) {
            handleOpenModal(quoteToFocus);
        }
    }
  }, [params.focusId, handleOpenModal, getCotizacionById, isModalOpen]);

  const executeApproval = async (cotizacion: Cotizacion, itemIds: number[]) => {
      try {
          const result = await aprobarCotizacion(cotizacion, itemIds);
          
          if (!result) {
              addNotification({
                  message: 'Error al aprobar la cotización',
                  type: 'error'
              });
              return;
          }
          
          // Verificar si el resultado incluye un pedido
          if ('pedido' in result && result.pedido) {
              const pedidoCreado = result.pedido;
              const finalApprovedQuote = result.cotizacion || getCotizacionById(cotizacion.id);
              const clientName = clientes.find(c => {
                  if (!pedidoCreado.clienteId) return false;
                  if (c.id === pedidoCreado.clienteId || String(c.id) === String(pedidoCreado.clienteId)) return true;
                  if (String(c.numeroDocumento || c.codter || '') === String(pedidoCreado.clienteId)) return true;
                  return false;
              })?.nombreCompleto || clientes.find(c => c.id === pedidoCreado.clienteId)?.razonSocial || 'N/A';
              
              addNotification({
                  message: `Pedido ${pedidoCreado.numeroPedido} creado para ${clientName}. Total: ${formatCurrency(pedidoCreado.total)}`,
                  type: 'success',
                  link: { page: 'pedidos' }
              });

              if (finalApprovedQuote) {
                  setApprovalResult({ cotizacion: finalApprovedQuote, pedido: pedidoCreado });
              }
          } else {
              // Solo se aprobó la cotización sin crear pedido
              addNotification({
                  message: `Cotización ${cotizacion.numeroCotizacion} aprobada`,
                  type: 'success'
              });
          }
          
          setIsModalOpen(false); // Close detail modal if open
          setQuoteToPreview(null); // Close preview modal
          setSelectedCotizacion(null); // Clear selected cotizacion
      } catch (error) {
          console.error('Error en executeApproval:', error);
          addNotification({
              message: `Error al aprobar la cotización: ${(error as Error).message}`,
              type: 'error'
          });
      }
  };

  const handleAprobar = (cotizacion: Cotizacion) => {
      setQuoteToPreview(cotizacion);
  }

  const handleToggleItemApproval = (productoId: number) => {
    setApprovedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(productoId)) {
            newSet.delete(productoId);
        } else {
            newSet.add(productoId);
        }
        return newSet;
    });
  };

  const handleConfirmarAprobacion = async () => {
    const cotizacionToApprove = selectedCotizacion;
    if (!cotizacionToApprove) return;
    
    if (approvedItems.size === 0) {
        addNotification({ message:'Debe seleccionar al menos un item para aprobar.', type: 'warning'});
        return;
    }

    // Confirmar con el usuario antes de aprobar
    const confirmar = window.confirm(
      `¿Estás seguro de aprobar la cotización ${cotizacionToApprove.numeroCotizacion}?\n\n` +
      `Esto creará un pedido con ${approvedItems.size} item(s) seleccionado(s).`
    );

    if (!confirmar) return;

    // Convertir Set a Array de IDs
    const itemIdsArray = Array.from(approvedItems);
    
    // Llamar directamente a executeApproval
    await executeApproval(cotizacionToApprove, itemIdsArray);
  };

  const handleCambiarEstado = async (nuevoEstado: 'ENVIADA') => {
    if (!selectedCotizacion) return;
    
    try {
      const cotizacionActualizada = await actualizarCotizacion(selectedCotizacion.id, { estado: nuevoEstado });
      if (cotizacionActualizada) {
        setSelectedCotizacion(cotizacionActualizada);
        addNotification({
          message: `Cotización ${selectedCotizacion.numeroCotizacion} actualizada a estado: ${nuevoEstado}`,
          type: 'success'
        });
      }
    } catch (error) {
      addNotification({
        message: `Error al cambiar el estado: ${(error as Error).message}`,
        type: 'error'
      });
    }
  };

  // Selección múltiple
  const handleToggleSelect = (cotizacionId: string) => {
    if (!ENABLE_BATCH_APPROVAL) return;
    setSelectedCotizaciones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cotizacionId)) {
        newSet.delete(cotizacionId);
      } else {
        newSet.add(cotizacionId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (!ENABLE_BATCH_APPROVAL) return;
    if (selectedCotizaciones.size === paginatedData.length) {
      setSelectedCotizaciones(new Set());
    } else {
      setSelectedCotizaciones(new Set(paginatedData.map(c => c.id)));
    }
  };

  // Acciones en lote

  const handleAprobarMultiples = async () => {
    if (!ENABLE_BATCH_APPROVAL) return;
    if (selectedCotizaciones.size === 0) return;
    
    const aprobables = paginatedData.filter(c => 
      selectedCotizaciones.has(c.id) && c.estado === 'ENVIADA'
    );
    
    if (aprobables.length === 0) {
      addNotification({
        message: 'No hay cotizaciones en estado ENVIADA seleccionadas',
        type: 'warning'
      });
      return;
    }

    // Confirmar aprobación múltiple
    const confirmar = window.confirm(
      `¿Estás seguro de aprobar ${aprobables.length} cotización(es)?\n\n` +
      `Esto creará ${aprobables.length} pedido(s) automáticamente.`
    );

    if (!confirmar) return;

    setIsProcessingBatch(true);
    try {
      let successCount = 0;
      let errorCount = 0;
      const pedidosCreados: Pedido[] = [];

      for (const cotizacion of aprobables) {
        try {
          // Aprobar con todos los items
          const itemIds = cotizacion.items.map(item => item.productoId);
          const result = await aprobarCotizacion(cotizacion, itemIds);
          
          if (result && 'pedido' in result) {
            successCount++;
            pedidosCreados.push(result.pedido);
          }
        } catch (error) {
          errorCount++;
          console.error(`Error aprobando ${cotizacion.numeroCotizacion}:`, error);
        }
      }

      setSelectedCotizaciones(new Set());
      addNotification({
        message: `${successCount} cotización(es) aprobada(s) y ${pedidosCreados.length} pedido(s) creado(s)${errorCount > 0 ? `. ${errorCount} error(es)` : ''}`,
        type: successCount > 0 ? 'success' : 'error'
      });
    } catch (error) {
      addNotification({
        message: `Error al aprobar cotizaciones: ${(error as Error).message}`,
        type: 'error'
      });
    } finally {
      setIsProcessingBatch(false);
    }
  };

    const selectedTotals = useMemo(() => {
    const defaultTotals = { subtotalBruto: 0, descuentoTotal: 0, subtotalNeto: 0, iva: 0, domicilios: 0, total: 0 };
    if (!selectedCotizacion) return defaultTotals;

    let itemsToCalculate: DocumentItem[];
    const isApprovalMode = selectedCotizacion.estado === 'ENVIADA';

    if (isApprovalMode) {
      // In approval mode, calculate based on user's current selection in the UI
      itemsToCalculate = selectedCotizacion.items.filter(item => approvedItems.has(item.productoId));
    } else if (selectedCotizacion.estado === 'APROBADA') {
      // For an already approved quote, calculate based on the items that were approved
      itemsToCalculate = selectedCotizacion.items.filter(item => (selectedCotizacion.approvedItems || []).includes(item.productoId));
    } else {
      // For all other states (Draft, Rejected, etc.), calculate based on all items
      itemsToCalculate = selectedCotizacion.items;
    }

    if (itemsToCalculate.length === 0 && !isApprovalMode) {
        itemsToCalculate = selectedCotizacion.items;
    }
    
    const domicilios = selectedCotizacion.domicilios ?? 0;

    const subtotalBruto = itemsToCalculate.reduce((acc, item) => acc + (item.precioUnitario * item.cantidad), 0);
    const descuentoTotal = itemsToCalculate.reduce((acc, item) => {
        const itemTotalBruto = item.precioUnitario * item.cantidad;
        return acc + (itemTotalBruto * ((item.descuentoPorcentaje || 0) / 100));
    }, 0);
    const subtotalNeto = subtotalBruto - descuentoTotal;
    const iva = itemsToCalculate.reduce((acc, item) => {
        // Recalculate item subtotal to be absolutely sure
        const itemSubtotal = (item.precioUnitario || 0) * (item.cantidad || 0) * (1 - (item.descuentoPorcentaje || 0) / 100);
        const itemIva = itemSubtotal * ((item.ivaPorcentaje || 0) / 100);
        return acc + itemIva;
    }, 0);
    const total = subtotalNeto + iva + domicilios;
    
    return { subtotalBruto, descuentoTotal, subtotalNeto, iva, domicilios, total };
  }, [selectedCotizacion, approvedItems]);


  // Limpiar selección cuando cambia el filtro o página
  useEffect(() => {
    if (!ENABLE_BATCH_APPROVAL) return;
    setSelectedCotizaciones(new Set());
  }, [statusFilter, currentPage]);

  const columns: Column<Cotizacion>[] = useMemo(() => {
    const baseColumns: Column<Cotizacion>[] = [
    { header: 'Número', accessor: 'numeroCotizacion' },
    { 
      header: 'Cliente', 
      accessor: 'clienteId', 
      cell: (item) => {
        // Buscar por ID numérico
        const cliente = clientes.find(c => {
          if (!item.clienteId) return false;
          // Comparar por ID numérico
          if (c.id === item.clienteId || String(c.id) === String(item.clienteId)) return true;
          // Si no se encuentra, intentar buscar por numeroDocumento (codter)
          if (String(c.numeroDocumento || c.codter || '') === String(item.clienteId)) return true;
          return false;
        });
        return cliente?.nombreCompleto || cliente?.razonSocial || 'N/A';
      }
    },
    { 
      header: 'Fecha', 
      accessor: 'fechaCotizacion',
      cell: (item) => {
        if (!item.fechaCotizacion) return 'N/A';
        try {
          // Si es una fecha ISO con hora, extraer solo la fecha
          const fechaStr = String(item.fechaCotizacion);
          if (fechaStr.includes('T')) {
            return fechaStr.split('T')[0];
          }
          // Si ya es solo fecha, devolverla tal cual
          return fechaStr.substring(0, 10);
        } catch (error) {
          return item.fechaCotizacion;
        }
      }
    },
    { header: 'Vendedor', accessor: 'vendedorId', cell: (item) => {
        const vendedor = vendedores.find(v => v.id === item.vendedorId);
        return vendedor ? `${vendedor.primerNombre} ${vendedor.primerApellido}` : 'N/A';
    } },
    { header: 'Total', accessor: 'total', cell: (item) => formatCurrency(item.total) },
    { header: 'Estado', accessor: 'estado', cell: (item) => <StatusBadge status={item.estado as any} /> },
    { header: 'Acciones', accessor: 'id', cell: (item) => (
      <div className="space-x-3">
        <button onClick={() => handleOpenModal(item)} className="text-sky-500 hover:underline text-sm font-medium">Ver</button>
        <ProtectedComponent permission="cotizaciones:approve">
          {item.estado === 'ENVIADA' && (
              <button onClick={() => handleAprobar(item)} className="text-green-500 hover:underline text-sm font-medium">Aprobar</button>
          )}
        </ProtectedComponent>
      </div>
    )},
  ];
    if (ENABLE_BATCH_APPROVAL) {
      baseColumns.unshift({
        header: '✓',
        accessor: 'id' as keyof Cotizacion,
        cell: (item) => (
          <input
            type="checkbox"
            checked={selectedCotizaciones.has(item.id)}
            onChange={() => handleToggleSelect(item.id)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            onClick={(e) => e.stopPropagation()}
          />
        )
      });
    }
    return baseColumns;
  }, [clientes, vendedores, selectedCotizaciones]);

  const { pedido, remisiones: remisionesPedido, facturas: facturasPedido } = useMemo(() => {
    if (!selectedCotizacion) return { pedido: undefined, remisiones: [], facturas: [] };
    const foundPedido = pedidos.find(p => p.cotizacionId === selectedCotizacion.id);
    const foundRemisiones = foundPedido ? remisiones.filter(r => r.pedidoId === foundPedido.id) : [];
    const foundFacturas = foundRemisiones.length > 0 ? facturas.filter(f => foundRemisiones.some(r => f.remisionesIds.includes(r.id))) : [];
    return { pedido: foundPedido, remisiones: foundRemisiones, facturas: foundFacturas };
 }, [selectedCotizacion, pedidos, remisiones, facturas]);

  const additionalFilters = (
    <div className="flex flex-col sm:flex-row gap-4">
        <div>
            <label htmlFor="statusFilter" className="sr-only">Estado</label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Gestión de Cotizaciones</h1>
      </div>

      <Card>
        <TableToolbar 
            searchTerm={searchTerm}
            onSearchChange={handleSearch}
            createActionLabel="Nueva Cotización"
            onCreateAction={() => setPage('nueva_cotizacion')}
            additionalFilters={additionalFilters}
        />
        {ENABLE_BATCH_APPROVAL && selectedCotizaciones.size > 0 && (
          <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {selectedCotizaciones.size} cotización(es) seleccionada(s)
                </span>
                <button
                  onClick={() => setSelectedCotizaciones(new Set())}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Deseleccionar todo
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <ProtectedComponent permission="cotizaciones:approve">
                  <button
                    onClick={handleAprobarMultiples}
                    disabled={isProcessingBatch}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <i className="fas fa-check-double"></i>
                    Aprobar ({paginatedData.filter(c => selectedCotizaciones.has(c.id) && c.estado === 'ENVIADA').length})
                  </button>
                </ProtectedComponent>
              </div>
            </div>
          </div>
        )}
        <CardContent className="p-0">
            <Table columns={columns} data={paginatedData} onSort={requestSort} sortConfig={sortConfig} highlightRowId={params.highlightId ?? params.focusId} />
        </CardContent>
         <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          canPreviousPage={currentPage > 1}
          canNextPage={currentPage < totalPages}
          onPreviousPage={prevPage}
          onNextPage={nextPage}
          totalItems={totalItems}
          rowsPerPage={rowsPerPage}
          setRowsPerPage={setRowsPerPage}
        />
      </Card>

      {selectedCotizacion && (
        <Modal 
            isOpen={isModalOpen} 
            onClose={handleCloseModal} 
            title={`Detalle Cotización: ${selectedCotizacion.numeroCotizacion}`}
            size="5xl"
        >
          <div className="space-y-4 text-sm">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg mb-4">
                <h4 className="text-base font-semibold mb-4 text-center">Progreso del Ciclo de Venta</h4>
                <ProgressFlow>
                    <ProgressStep title="Cotización" status={getCotizacionProgressStatus(selectedCotizacion)}>
                        <StatusBadge status={selectedCotizacion.estado as any} />
                    </ProgressStep>
                    <ProgressStep title="Pedido" status={getPedidoProgressStatus(selectedCotizacion, pedido)}>
                        {pedido ? <StatusBadge status={pedido.estado as any} /> : <span className="text-xs text-slate-400">Pendiente</span>}
                    </ProgressStep>
                    <ProgressStep title="Remisión" status={getRemisionProgressStatus(pedido)}>
                        {remisionesPedido.length > 0
                            ? <span className="text-xs text-slate-500 dark:text-slate-400">{remisionesPedido.length} entrega(s)</span>
                            : <span className="text-xs text-slate-400">Pendiente</span>
                        }
                    </ProgressStep>
                    <ProgressStep title="Facturación" status={getFacturacionProgressStatus(remisionesPedido, facturasPedido)}>
                         <span className="text-xs text-slate-500 dark:text-slate-400">
                            {
                                {
                                    complete: 'Facturado',
                                    current: 'Fact. Parcial',
                                    incomplete: 'Pendiente'
                                }[getFacturacionProgressStatus(remisionesPedido, facturasPedido)]
                            }
                        </span>
                    </ProgressStep>
                </ProgressFlow>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Cliente:</p>
                <p>{clientes.find(c => c.id === selectedCotizacion.clienteId)?.nombreCompleto}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Vendedor:</p>
                <p>{(() => { const v = vendedores.find(v => v.id === selectedCotizacion.vendedorId); return v ? `${v.primerNombre} ${v.primerApellido}` : null; })()}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Teléfono:</p>
                <p>{clientes.find(c => c.id === selectedCotizacion.clienteId)?.telefono}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Email:</p>
                <p>{clientes.find(c => c.id === selectedCotizacion.clienteId)?.email}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Fecha Emisión:</p>
                <p>{selectedCotizacion.fechaCotizacion ? String(selectedCotizacion.fechaCotizacion).split('T')[0] : 'N/A'}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Estado:</p>
                <p><StatusBadge status={selectedCotizacion.estado as any} /></p>
              </div>
              {selectedCotizacion.observacionesInternas && (
                <div className="sm:col-span-2">
                    <p className="font-semibold text-slate-600 dark:text-slate-400">Observaciones Internas (Supervisor):</p>
                    <p className="p-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-md italic">{selectedCotizacion.observacionesInternas}</p>
                </div>
              )}
            </div>
            
            <h4 className="text-base font-semibold pt-4 border-t border-slate-200 dark:border-slate-700">Items Cotizados</h4>
            
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full divide-y divide-slate-200 dark:divide-slate-700 table-fixed">
                    <thead className="bg-slate-50 dark:bg-slate-700">
                        <tr>
                            {selectedCotizacion.estado === 'ENVIADA' && <th scope="col" className="w-20 px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Aprobar</th>}
                            {selectedCotizacion.estado === 'APROBADA' && <th scope="col" className="w-20 px-4 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Estado</th>}
                            <th scope="col" className="w-auto px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Producto</th>
                            <th scope="col" className="w-24 px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Unidad</th>
                            <th scope="col" className="w-24 px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Cantidad</th>
                            <th scope="col" className="w-32 px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Precio Unit.</th>
                            <th scope="col" className="w-24 px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Desc. %</th>
                            <th scope="col" className="w-24 px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">IVA %</th>
                            <th scope="col" className="w-32 px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Subtotal</th>
                            <th scope="col" className="w-32 px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Valor IVA</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {selectedCotizacion.items.map((item: DocumentItem, index: number) => {
                            // Buscar producto por ID (puede ser numérico o string)
                            const product = productos.find(p => 
                                String(p.id) === String(item.productoId) ||
                                p.id === item.productoId
                            );
                            
                            // Obtener nombre del producto: primero del producto encontrado, luego del item
                            const productoNombre = product?.nombre || 
                                                  item.descripcion || 
                                                  item.nombre || 
                                                  `Producto ${index + 1}`;
                            
                            const itemSubtotal = (item.precioUnitario || 0) * (item.cantidad || 0) * (1 - (item.descuentoPorcentaje || 0) / 100);
                            const itemIva = itemSubtotal * ((item.ivaPorcentaje || 0) / 100);
                            return (
                                <tr key={item.productoId || `item-${index}`}>
                                    {selectedCotizacion.estado === 'ENVIADA' && (
                                        <td className="px-4 py-2">
                                            <input 
                                                type="checkbox" 
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                checked={approvedItems.has(item.productoId)}
                                                onChange={() => handleToggleItemApproval(item.productoId)}
                                            />
                                        </td>
                                    )}
                                     {selectedCotizacion.estado === 'APROBADA' && (
                                        <td className="px-4 py-2 text-center">
                                            {selectedCotizacion.approvedItems?.includes(item.productoId) 
                                                ? <i className="fas fa-check-circle text-green-500" title="Aprobado"></i> 
                                                : <i className="fas fa-times-circle text-slate-400" title="No Aprobado"></i>}
                                        </td>
                                    )}
                                    <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 break-words">
                                        {productoNombre}
                                        {!product && (
                                            <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400" title="Producto no encontrado en el catálogo">
                                                <i className="fas fa-exclamation-triangle"></i>
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{product?.unidadMedida || 'N/A'}</td>
                                    <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 text-right">{item.cantidad}</td>
                                    <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 text-right">{formatCurrency(item.precioUnitario)}</td>
                                    <td className="px-4 py-2 text-sm text-red-600 dark:text-red-500 text-right">{item.descuentoPorcentaje}%</td>
                                    <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 text-right">{item.ivaPorcentaje}%</td>
                                    <td className="px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 text-right">{formatCurrency(itemSubtotal)}</td>
                                    <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 text-right">{formatCurrency(itemIva)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end pt-4">
                 <div className="w-full max-w-sm space-y-2 text-slate-700 dark:text-slate-300 text-sm">
                    <div className="flex justify-between">
                        <span>Subtotal Bruto</span>
                        <span>{formatCurrency(selectedTotals.subtotalBruto)}</span>
                    </div>
                    <div className="flex justify-between text-red-600 dark:text-red-500">
                        <span>Descuento</span>
                        <span>-{formatCurrency(selectedTotals.descuentoTotal)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t border-slate-300 dark:border-slate-600 pt-2 mt-2">
                        <span>Subtotal Neto</span>
                        <span>{formatCurrency(selectedTotals.subtotalNeto)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>IVA</span>
                        <span>{formatCurrency(selectedTotals.iva)}</span>
                    </div>
                    {selectedTotals.domicilios > 0 && (
                        <div className="flex justify-between">
                            <span>Domicilios</span>
                            <span>{formatCurrency(selectedTotals.domicilios)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-base border-t-2 border-slate-400 dark:border-slate-500 pt-2 mt-2 text-blue-600 dark:text-blue-400">
                        <span>TOTAL</span>
                        <span>{formatCurrency(selectedTotals.total)}</span>
                    </div>
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center flex-wrap gap-3">
                <div className="flex gap-3 flex-wrap">
                  <ProtectedComponent permission="cotizaciones:edit">
                    {selectedCotizacion.estado === 'ENVIADA' && (
                        <button
                            onClick={() => {
                                handleCloseModal();
                                setPage('editar_cotizacion', { id: selectedCotizacion.id });
                            }}
                            className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition-colors"
                        >
                            <i className="fas fa-pencil-alt mr-2"></i>Editar
                        </button>
                    )}
                  </ProtectedComponent>
                  
                </div>
                
                <div className="flex gap-3 flex-wrap">
                    <button onClick={handleCloseModal} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">Cerrar</button>
                    
                    <ProtectedComponent permission="cotizaciones:supervise">
                      {selectedCotizacion.estado === 'ENVIADA' && (
                          <button onClick={handleConfirmarAprobacion} className="px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors disabled:bg-slate-400" disabled={approvedItems.size === 0}>
                              <i className="fas fa-check-double mr-2"></i>Aprobar y Crear Pedido ({approvedItems.size})
                          </button>
                      )}
                    </ProtectedComponent>

                    <ProtectedComponent permission="cotizaciones:approve">
                      {selectedCotizacion.estado === 'ENVIADA' && (
                          <button onClick={handleConfirmarAprobacion} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-400" disabled={approvedItems.size === 0}>
                              <i className="fas fa-check mr-2"></i>Aprobar y Crear Pedido ({approvedItems.size})
                          </button>
                      )}
                    </ProtectedComponent>
                </div>
            </div>

          </div>
        </Modal>
      )}

      {quoteToPreview && (() => {
        const cliente = clientes.find(c => c.id === quoteToPreview.clienteId);
        const vendedor = vendedores.find(v => v.id === quoteToPreview.vendedorId);
        if (!cliente || !vendedor) return null;

        return (
            <DocumentPreviewModal
                isOpen={!!quoteToPreview}
                onClose={() => setQuoteToPreview(null)}
                title={`Previsualizar Cotización: ${quoteToPreview.numeroCotizacion}`}
                onConfirm={() => executeApproval(quoteToPreview, quoteToPreview.items.map(i => i.productoId))}
                onEdit={() => {
                    if (quoteToPreview) {
                        setQuoteToPreview(null);
                        setPage('editar_cotizacion', { id: quoteToPreview.id });
                    }
                }}
                documentType="cotizacion"
                clientEmail={cliente.email}
                clientName={cliente.nombreCompleto}
            >
                <CotizacionPDF
                    cotizacion={quoteToPreview}
                    cliente={cliente}
                    vendedor={vendedor}
                    empresa={datosEmpresa}
                />
            </DocumentPreviewModal>
        );
      })()}
      
      {approvalResult && (() => {
        const { cotizacion, pedido } = approvalResult;

        const subtotalBruto = pedido.items.reduce((acc, item) => acc + (item.precioUnitario * item.cantidad), 0);
        const descuentoTotal = pedido.items.reduce((acc, item) => {
            const itemTotalBruto = item.precioUnitario * item.cantidad;
            return acc + (itemTotalBruto * (item.descuentoPorcentaje / 100));
        }, 0);

        return (
            <ApprovalSuccessModal
                isOpen={!!approvalResult}
                onClose={() => setApprovalResult(null)}
                title="¡Aprobación Exitosa!"
                message={
                    <>
                        La cotización <strong>{cotizacion.numeroCotizacion}</strong> ha sido aprobada.
                        Se ha generado el Pedido <strong>{pedido.numeroPedido}</strong>.
                    </>
                }
                summaryTitle="Resumen del Pedido Creado"
                summaryDetails={[
                    { label: 'Cliente', value: clientes.find(c => c.id === pedido.clienteId)?.nombreCompleto || 'N/A' },
                    { label: 'Vendedor', value: (() => { const v = vendedores.find(v => v.id === cotizacion.vendedorId); return v ? `${v.primerNombre} ${v.primerApellido}` : 'N/A'; })() },
                    { label: 'Items Aprobados', value: pedido.items.length },
                    { label: 'sep1', value: '', isSeparator: true },
                    { label: 'Subtotal Bruto', value: formatCurrency(subtotalBruto) },
                    { label: 'Descuento Total', value: `-${formatCurrency(descuentoTotal)}`, isDiscount: true },
                    { label: 'Subtotal Neto', value: formatCurrency(pedido.subtotal) },
                    { label: 'IVA (19%)', value: formatCurrency(pedido.ivaValor) },
                    { label: 'Total Pedido', value: formatCurrency(pedido.total), isTotal: true },
                ]}
                primaryAction={{
                    label: 'Ir a Pedidos',
                    onClick: () => { setApprovalResult(null); setPage('pedidos'); },
                }}
            />
        );
      })()}

      
    </div>
  );
};

export default CotizacionesPage;