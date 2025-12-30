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
import PedidoPDFDocument from '../components/comercial/PedidoPDFDocument';
import PedidoEditForm from '../components/comercial/PedidoEditForm';
import PageHeader from '../components/ui/PageHeader';
import { SectionLoader } from '../components/ui/SectionLoader';
import { useAuth } from '../hooks/useAuth';
import ProtectedComponent from '../components/auth/ProtectedComponent';
import { useData } from '../hooks/useData';
import { logger } from '../utils/logger';
import { apiClient, fetchPedidosDetalle, apiSendGenericEmail, apiSendPedidoEmail, apiArchiveDocumentToDrive } from '../services/apiClient';
import SendEmailModal from '../components/comercial/SendEmailModal';
import { pdf } from '@react-pdf/renderer';
import { formatDateOnly } from '../utils/formatters';
import PageContainer from '../components/ui/PageContainer';
import SectionHeader from '../components/ui/SectionHeader';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

const getPedidoProgressStatus = (pedido: Pedido): 'complete' | 'current' | 'incomplete' => {
  if (!pedido || pedido.estado === 'CANCELADO') return 'incomplete';
  if (pedido.estado === 'CONFIRMADO') return 'current';
  return 'complete';
}

const getRemisionProgressStatus = (pedido: Pedido): 'complete' | 'current' | 'incomplete' => {
  if (!pedido || pedido.estado === 'CANCELADO') return 'incomplete';
  if (pedido.estado === 'REMITIDO') return 'complete';
  if (pedido.estado === 'EN_PROCESO' || pedido.estado === 'PARCIALMENTE_REMITIDO') return 'current';
  return 'incomplete';
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
  const { clientes, cotizaciones, datosEmpresa, productos, vendedores, aprobarPedido, actualizarPedido, marcarPedidoListoParaDespacho } = useData();

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
  const [pedidoToEmail, setPedidoToEmail] = useState<Pedido | null>(null);
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

    let calculatedSubtotalBruto = 0;
    let calculatedDescuentoTotal = 0;
    let calculatedIvaTotal = 0;

    selectedPedido.items.forEach(item => {
      // Find product to get true tax rate
      const product = productos.find(p =>
        String(p.id) === String(item.productoId) || p.id === item.productoId
      );

      // Use product tax rate if available, else item tax rate (fallback)
      const taxRate = (item.ivaPorcentaje !== undefined && item.ivaPorcentaje !== null)
        ? Number(item.ivaPorcentaje)
        : (product && product.tasaIva !== undefined && product.tasaIva !== null ? Number(product.tasaIva) : 0);

      const qty = Number(item.cantidad || 0);
      const price = Number(item.precioUnitario || 0);
      const discountPct = Number(item.descuentoPorcentaje || 0);

      const itemSubtotalBruto = price * qty;
      const itemDiscount = itemSubtotalBruto * (discountPct / 100);
      const itemSubtotalNeto = itemSubtotalBruto - itemDiscount;
      const itemIva = itemSubtotalNeto * (taxRate / 100);

      calculatedSubtotalBruto += itemSubtotalBruto;
      calculatedDescuentoTotal += itemDiscount;
      calculatedIvaTotal += itemIva;
    });

    const calculatedSubtotalNeto = calculatedSubtotalBruto - calculatedDescuentoTotal;
    const calculatedTotal = calculatedSubtotalNeto + calculatedIvaTotal;

    return {
      subtotalBruto: calculatedSubtotalBruto,
      descuentoTotal: calculatedDescuentoTotal,
      subtotalNeto: calculatedSubtotalNeto,
      iva: calculatedIvaTotal,
      total: calculatedTotal
    };
  }, [selectedPedido, productos]);


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
          message: `Pedido ${pedidoAprobado.numeroPedido.replace('PED-', '')} aprobado exitosamente.`,
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
      addNotification({ message: `Pedido ${updatedPedido.numeroPedido.replace('PED-', '')} listo para despacho.`, type: 'success' });
    }
  };


  const handleCreateRemision = (pedidoId: string) => {
    handleCloseModals();
    setApprovalResult(null);
    setPage('remisiones', { openCreateForPedidoId: pedidoId });
  };

  const handleSendEmail = (pedido: Pedido) => {
    setPedidoToEmail(pedido);
  };

  const handleConfirmSendEmail = async (emailData: { to: string; subject: string; body: string }) => {
    if (!pedidoToEmail) return;

    addNotification({ message: 'Preparando envío de correo...', type: 'info' });

    try {

      const clientePedido = clientes.find(c =>
        String(c.id) === String(pedidoToEmail.clienteId) ||
        c.numeroDocumento === pedidoToEmail.clienteId ||
        c.codter === pedidoToEmail.clienteId
      );

      if (!clientePedido) {
        addNotification({ message: 'Error: No se encontró la información del cliente.', type: 'warning' });
        return;
      }

      let vendedor = null;
      if (pedidoToEmail.vendedorId) {
        vendedor = vendedores.find(v => String(v.id) === String(pedidoToEmail.vendedorId) || v.codigoVendedor === pedidoToEmail.vendedorId);
      }

      const cotizacionOrigen = cotizaciones.find(c => String(c.id) === String(pedidoToEmail.cotizacionId));

      // Priorizar firma del usuario
      const firmaFinal = user?.firma || vendedor?.firma;

      // Generar Blob del PDF
      const blob = await pdf(
        <PedidoPDFDocument
          pedido={pedidoToEmail}
          cliente={clientePedido}
          empresa={datosEmpresa}
          preferences={{ showPrices: true, signatureType: 'physical', detailLevel: 'full' }}
          productos={productos}
          cotizacionOrigen={cotizacionOrigen}
          firmaVendedor={firmaFinal}
        />
      ).toBlob();

      // Convertir a Base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;

        // Enviar al backend
        // Enviar al backend usando el endpoint específico de Pedidos
        const response = await apiSendPedidoEmail(pedidoToEmail.id!, {
          destinatario: emailData.to,
          asunto: emailData.subject,
          mensaje: emailData.body,
          pdfBase64: base64data
        });

        if (response.success) {
          addNotification({ message: '✅ Correo enviado exitosamente.', type: 'success' });
          setPedidoToEmail(null);

          // --- Archivar en Google Drive ---
          try {
            addNotification({ message: 'Archivando en Google Drive...', type: 'info' });
            // Extraer base64 raw
            const base64Content = base64data.split(',')[1] || base64data;

            const archiveResponse = await apiArchiveDocumentToDrive({
              type: 'pedido',
              number: pedidoToEmail.numeroPedido,
              date: pedidoToEmail.fechaPedido || new Date().toISOString(),
              recipientName: clientePedido?.razonSocial || 'Cliente',
              fileBase64: base64Content
            });

            if (archiveResponse.success) {
              addNotification({ message: 'Documento archivado en Drive.', type: 'success' });
            } else if (archiveResponse.code === 'FILE_EXISTS') {
              // Prompt for replacement
              const shouldReplace = window.confirm(`El archivo ya existe en Drive. ¿Desea reemplazarlo?`);
              if (shouldReplace) {
                addNotification({ message: 'Reemplazando archivo en Drive...', type: 'info' });
                const retryResponse = await apiArchiveDocumentToDrive({
                  type: 'pedido',
                  number: pedidoToEmail.numeroPedido,
                  date: pedidoToEmail.fechaPedido || new Date().toISOString(),
                  recipientName: clientePedido?.razonSocial || 'Cliente',
                  fileBase64: base64Content,
                  replace: true
                });

                if (retryResponse.success) {
                  addNotification({ message: 'Archivo actualizado correctamente.', type: 'success' });
                } else {
                  addNotification({ message: 'Error actualizando archivo.', type: 'error' });
                }
              } else {
                addNotification({ message: 'Se canceló el archivado.', type: 'info' });
              }
            } else {
              console.warn('Error archivando en Drive:', archiveResponse);
            }
          } catch (driveError) {
            console.error('Error llamando a apiArchiveDocumentToDrive:', driveError);
          }
        } else {
          addNotification({ message: `❌ Error enviando correo: ${response.message || 'Error desconocido'}`, type: 'error' });
        }
      };
      reader.onerror = () => {
        addNotification({ message: 'Error procesando el archivo PDF para envío.', type: 'error' });
      };

    } catch (error) {
      console.error('Error en proceso de envío de email:', error);
      addNotification({ message: 'Error al generar o enviar el correo.', type: 'error' });
    }
  };

  const columns: Column<Pedido>[] = [
    {
      header: 'Número',
      accessor: 'numeroPedido',
      cell: (item) => (
        <span className="font-bold font-mono text-slate-700 dark:text-slate-200">{(item.numeroPedido || '').replace('PED-', '')}</span>
      )
    },
    {
      header: 'Cotización',
      accessor: 'cotizacionId',
      cell: (item) => {
        // Usar numeroCotizacionOrigen si está disponible (viene del JOIN en el backend)
        if (item.numeroCotizacionOrigen) {
          return <span className="text-sm text-slate-600 dark:text-slate-400">{item.numeroCotizacionOrigen.replace('C-', '')}</span>;
        }
        // Fallback: buscar en el array de cotizaciones
        if (item.cotizacionId) {
          const cotizacion = cotizaciones.find(c => String(c.id) === String(item.cotizacionId));
          return <span className="text-sm text-slate-600 dark:text-slate-400">{(cotizacion?.numeroCotizacion || 'N/A').replace('C-', '')}</span>;
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
          <button
            onClick={() => handleSendEmail(item)}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
            title="Enviar Email"
          >
            <i className="fas fa-paper-plane"></i>
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
          className="w-full sm:w-auto px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {filterOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <PageContainer>
      <SectionHeader
        title="Gestión de Pedidos"
        subtitle="Administra y da seguimiento a los pedidos de venta."
      />

      <Card className="shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-2 sm:p-3 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
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
            <SectionLoader text="Cargando pedidos..." height="h-64" />
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
          title=""
          size="5xl"
          className="bg-slate-50 dark:bg-slate-900"
        >
          {/* Header Personalizado del Modal */}
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 -mx-6 -mt-6 px-6 py-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                  <i className="fas fa-file-invoice-dollar text-xl"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    Pedido {selectedPedido.numeroPedido.replace('PED-', '')}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Detalles y seguimiento
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={selectedPedido.estado as any} className="text-sm px-3 py-1" />
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Pedido</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{formatCurrency(selectedPedidoTotals.total)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6 text-sm">
            {/* ... Contenido del modal ... */}

            {/* Botones de acción (Cerrar y Vista Previa PDF) en la parte superior derecha o inferior */}
            {/* En este diseño, vamos a poner los botones al final, como en Cotizaciones */}

            {/* Cards de Información Principal */}
            {/* Progress Section (Top) */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h4 className="text-sm font-semibold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Progreso del Ciclo de Venta</h4>
              <ProgressFlow>
                <ProgressStep title="Cotización" status={selectedPedido.cotizacionId ? 'complete' : 'incomplete'}>
                  {selectedPedido.numeroCotizacionOrigen && (
                    <span className="text-[10px] font-mono text-slate-500 block mt-1">{selectedPedido.numeroCotizacionOrigen.replace('C-', '')}</span>
                  )}
                </ProgressStep>
                <ProgressStep title="Pedido" status={getPedidoProgressStatus(selectedPedido)}>
                  <StatusBadge status={selectedPedido.estado as any} />
                </ProgressStep>
                <ProgressStep title="Remisión" status={getRemisionProgressStatus(selectedPedido)}>
                  <div className="flex flex-col items-center">
                    {selectedPedido.estado === 'REMITIDO' || selectedPedido.estado === 'PARCIALMENTE_REMITIDO' ? (
                      <span className="text-xs font-bold text-green-600 dark:text-green-400">Generada</span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Pendiente</span>
                    )}
                  </div>
                </ProgressStep>
              </ProgressFlow>
            </div>

            {/* Information Grid (Middle) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Card 1: Información del Cliente */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 p-5">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
                  <i className="fas fa-user-circle text-blue-500"></i>
                  Información del Cliente
                </h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Cliente</p>
                    <p className="text-base font-medium text-slate-800 dark:text-slate-200 mt-1">
                      {(() => {
                        const cliente = clientes.find(c =>
                          String(c.id) === String(selectedPedido.clienteId) ||
                          c.numeroDocumento === selectedPedido.clienteId ||
                          c.codter === selectedPedido.clienteId
                        );
                        return cliente?.nombreCompleto || cliente?.razonSocial || selectedPedido.clienteId || 'N/A';
                      })()}
                    </p>
                  </div>
                  {(selectedPedido.instruccionesEntrega) && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">
                        <i className="fas fa-comment-alt mr-1"></i> Instrucciones
                      </p>
                      <p className="text-slate-700 dark:text-slate-300 italic">
                        {selectedPedido.instruccionesEntrega}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Detalles del Pedido */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 p-5">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
                  <i className="fas fa-info-circle text-purple-500"></i>
                  Detalles Generales
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Cotización</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">
                      {(selectedPedido.numeroCotizacionOrigen ||
                        (selectedPedido.cotizacionId ? cotizaciones.find(c => String(c.id) === String(selectedPedido.cotizacionId))?.numeroCotizacion : 'N/A') ||
                        'N/A').replace('C-', '')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Forma Pago</p>
                    <div className="mt-1">
                      {(selectedPedido.formaPago || (() => {
                        let formaPagoPedido = selectedPedido.formaPago;
                        if (!formaPagoPedido && selectedPedido.cotizacionId) {
                          const cotizacion = cotizaciones.find(c => String(c.id) === String(selectedPedido.cotizacionId));
                          if (cotizacion && cotizacion.formaPago) {
                            formaPagoPedido = cotizacion.formaPago;
                          }
                        }
                        return formaPagoPedido;
                      })()) ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {(() => {
                            const val = selectedPedido.formaPago || 'N/A';
                            return val === '01' || val === '1' ? 'Contado' : val === '02' || val === '2' ? 'Crédito' : val;
                          })()}
                        </span>
                      ) : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Emisión</p>
                    <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">{formatDateOnly(selectedPedido.fechaPedido)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Entrega Est.</p>
                    <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">{formatDateOnly(selectedPedido.fechaEntregaEstimada)}</p>
                  </div>
                </div>
              </div>



            </div>

            {/* Tabla de Items */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <i className="fas fa-box-open text-slate-400"></i> Items del Pedido
                </h4>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                  {selectedPedido.items?.length || 0} items
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-slate-100 dark:divide-slate-700/50">
                  <thead className="bg-slate-50 dark:bg-slate-700/30">
                    <tr>
                      <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Producto</th>
                      <th scope="col" className="px-5 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-24">Unidad</th>
                      <th scope="col" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-24">Cant.</th>
                      <th scope="col" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">P. Unit.</th>
                      <th scope="col" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-24">Desc.</th>
                      <th scope="col" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-24">IVA</th>
                      <th scope="col" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">Subtotal</th>
                      <th scope="col" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-28">Total IVA</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700/50">
                    {selectedPedido.items && Array.isArray(selectedPedido.items) && selectedPedido.items.length > 0 ? (
                      selectedPedido.items.map((item: DocumentItem, index: number) => {
                        const product = productos.find(p =>
                          String(p.id) === String(item.productoId) ||
                          p.id === item.productoId
                        );

                        const qty = Number(item.cantidad || 0);
                        const price = Number(item.precioUnitario || 0);
                        const discountPct = Number(item.descuentoPorcentaje || 0);

                        const ivaPct = (item.ivaPorcentaje !== undefined && item.ivaPorcentaje !== null)
                          ? Number(item.ivaPorcentaje)
                          : (product && product.tasaIva !== undefined && product.tasaIva !== null ? Number(product.tasaIva) : 0);

                        const itemSubtotal = price * qty * (1 - discountPct / 100);
                        const itemIva = itemSubtotal * (ivaPct / 100);

                        const productoNombre = product?.nombre ||
                          item.descripcion ||
                          (item as any).nombre ||
                          `Producto ${index + 1}`;

                        const unidadMedida = (item as any).unidadMedida ||
                          product?.unidadMedida ||
                          'Unidad';

                        return (
                          <tr key={item.productoId || `item-${index}`} className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                            <td className="px-5 py-4">
                              <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-0.5">{productoNombre}</div>
                              {!product && (
                                <span className="inline-flex items-center text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                                  <i className="fas fa-exclamation-triangle mr-1"></i> No catálogo
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-sm text-center text-slate-500 dark:text-slate-400">{unidadMedida}</td>
                            <td className="px-5 py-4 text-sm text-right font-medium text-slate-700 dark:text-slate-300 bg-slate-50/30 dark:bg-slate-800/30">{item.cantidad}</td>
                            <td className="px-5 py-4 text-sm text-right text-slate-600 dark:text-slate-400">{formatCurrency(item.precioUnitario)}</td>
                            <td className="px-5 py-4 text-sm text-right">
                              {item.descuentoPorcentaje && item.descuentoPorcentaje > 0 ? (
                                <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded font-medium text-xs">
                                  -{item.descuentoPorcentaje.toFixed(0)}%
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-sm text-right text-slate-500 dark:text-slate-400">
                              {ivaPct > 0 ? `${ivaPct.toFixed(0)}%` : '-'}
                            </td>
                            <td className="px-5 py-4 text-sm text-right font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(itemSubtotal)}</td>
                            <td className="px-5 py-4 text-sm text-right text-slate-500 dark:text-slate-400">{formatCurrency(itemIva)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-5 py-12 text-center">
                          <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                            {selectedPedido.items === undefined ? (
                              <>
                                <i className="fas fa-spinner fa-spin text-3xl mb-3 text-blue-500"></i>
                                <span>Cargando productos...</span>
                              </>
                            ) : (
                              <>
                                <i className="fas fa-box-open text-4xl mb-3 opacity-50"></i>
                                <span>No hay productos en este pedido</span>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resumen Totales */}
            <div className="flex flex-col sm:flex-row justify-end gap-6">
              <div className="w-full sm:w-80 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                  Resumen Económico
                </h5>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal Bruto</span>
                    <span className="font-medium">{formatCurrency(selectedPedidoTotals.subtotalBruto)}</span>
                  </div>
                  {selectedPedidoTotals.descuentoTotal > 0 && (
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                      <span>Descuento</span>
                      <span className="font-medium">-{formatCurrency(selectedPedidoTotals.descuentoTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-800 dark:text-slate-200 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <span className="font-medium">Subtotal Neto</span>
                    <span className="font-bold">{formatCurrency(selectedPedidoTotals.subtotalNeto)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>IVA</span>
                    <span>{formatCurrency(selectedPedidoTotals.iva)}</span>
                  </div>
                  <div className="flex justify-between items-end pt-3 mt-1 border-t-2 border-slate-100 dark:border-slate-700">
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-lg">Total</span>
                    <span className="font-bold text-2xl text-blue-600 dark:text-blue-400">{formatCurrency(selectedPedidoTotals.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {selectedPedido.historial && selectedPedido.historial.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={(e) => {
                    const el = e.currentTarget.nextElementSibling;
                    el?.classList.toggle('hidden');
                  }}
                  className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  <i className="fas fa-history"></i> Ver historial de cambios
                </button>
                <div className="hidden mt-2 max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                  {selectedPedido.historial.slice().reverse().map((log, index) => (
                    <div key={index} className="text-xs flex gap-2">
                      <span className="font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleString('es-CO')}: </span>
                      <span className="text-slate-600 dark:text-slate-300">{log.accion} <span className="text-slate-400 mx-1">•</span> {log.usuario}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer de Acciones (Botones Inferiores) */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
              <div>
                <ProtectedComponent permission="pedidos:edit">
                  {(selectedPedido.estado === 'ENVIADA' || selectedPedido.estado === 'BORRADOR') && (
                    <button
                      onClick={() => { handleCloseModals(); setPedidoToEdit(selectedPedido); }}
                      className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all text-sm font-medium flex items-center gap-2"
                    >
                      <i className="fas fa-pencil-alt"></i> Editar Pedido
                    </button>
                  )}
                </ProtectedComponent>
              </div>

              <div className="flex flex-wrap justify-end gap-3 w-full sm:w-auto">
                <button
                  onClick={handleCloseModals}
                  className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                  Cerrar
                </button>

                <button
                  onClick={() => {
                    setDetailModalOpen(false);
                    setOrderToPreview(selectedPedido);
                  }}
                  className="px-5 py-2.5 bg-white dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-900 text-blue-700 dark:text-blue-300 font-semibold rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors shadow-sm flex items-center gap-2"
                >
                  <i className="fas fa-file-pdf"></i> Vista Previa PDF
                </button>

                <ProtectedComponent permission="pedidos:approve">
                  {(selectedPedido.estado === 'ENVIADA' || selectedPedido.estado === 'BORRADOR') && (
                    <button
                      onClick={handleApproveFromModal}
                      disabled={isApproving}
                      className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-2"
                    >
                      {isApproving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check-circle"></i>}
                      {isApproving ? 'Procesando...' : 'Aprobar Pedido'}
                    </button>
                  )}
                </ProtectedComponent>

                {(selectedPedido.estado === 'EN_PROCESO' || selectedPedido.estado === 'PARCIALMENTE_REMITIDO') && (
                  <button
                    onClick={() => handleCreateRemision(selectedPedido.id)}
                    className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 hover:shadow-lg transition-all flex items-center gap-2"
                  >
                    <i className="fas fa-truck-loading"></i> Crear Remisión
                  </button>
                )}

                <button
                  onClick={() => handleSendEmail(selectedPedido)}
                  className="px-5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm flex items-center gap-2"
                >
                  <i className="fas fa-paper-plane"></i> Enviar Email
                </button>
              </div>
            </div>

          </div>
        </Modal>
      )}




      {pedidoToEdit && (
        <Modal
          isOpen={!!pedidoToEdit}
          onClose={() => setPedidoToEdit(null)}
          title={`Editar Pedido: ${pedidoToEdit.numeroPedido.replace('PED-', '')}`}
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
            title={`Previsualizar Pedido: ${orderToPreview.numeroPedido.replace('PED-', '')}`}
            onConfirm={
              (orderToPreview.estado === 'BORRADOR' || orderToPreview.estado === 'ENVIADA')
                ? executeApproval
                : undefined
            }
            onEdit={() => {
              setOrderToPreview(null);
              setPedidoToEdit(orderToPreview);
            }}
            isConfirming={isConfirming}
            documentType="pedido"
            clientEmail={cliente.email}
            clientName={cliente.nombreCompleto}
            documentId={orderToPreview.id}
          >
            <PedidoPDFDocument
              pedido={orderToPreview}
              cliente={cliente}
              empresa={datosEmpresa}
              preferences={{} as any}
              productos={productos}
              cotizacionOrigen={cotizaciones.find(c => c.id === orderToPreview.cotizacionId)}
            />
          </DocumentPreviewModal>
        );
      })()}

      {pedidoToEmail && (() => {
        const clientePedido = clientes.find(c =>
          String(c.id) === String(pedidoToEmail.clienteId) ||
          c.numeroDocumento === pedidoToEmail.clienteId ||
          c.codter === pedidoToEmail.clienteId
        );
        return (
          <SendEmailModal
            isOpen={!!pedidoToEmail}
            onClose={() => setPedidoToEmail(null)}
            onSend={handleConfirmSendEmail}
            to={clientePedido?.email || ''}
            subject={`Pedido ${pedidoToEmail.numeroPedido} - ${datosEmpresa.nombre}`}
            body={`Estimado/a ${clientePedido?.nombreCompleto || 'Cliente'},\n\nEsperamos que este mensaje le encuentre bien.\n\nAdjuntamos la orden de pedido N° ${pedidoToEmail.numeroPedido.replace('PED-', '')} con el detalle de los productos solicitados.\n\nPor favor proceda con la revisión del documento. Quedamos atentos a cualquier inquietud.\n\nCordialmente,\nEl equipo de ${datosEmpresa.nombre}`}
          />
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
                La cotización <strong>{(cotizaciones.find(c => c.id === pedido.cotizacionId)?.numeroCotizacion || '').replace('C-', '')}</strong> ha concluido satisfactoriamente.
                Se ha generado el Pedido <strong>{pedido.numeroPedido.replace('PED-', '')}</strong> de forma exitosa.
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
              { label: 'Número de Pedido', value: pedido.numeroPedido.replace('PED-', '') },
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

    </PageContainer>
  );
};

export default PedidosPage;