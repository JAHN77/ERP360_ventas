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
import CotizacionPDFDocument from '../components/comercial/CotizacionPDFDocument';
import CotizacionForm from '../components/comercial/CotizacionForm';
import PageHeader from '../components/ui/PageHeader';
import ProtectedComponent from '../components/auth/ProtectedComponent';
import { useData } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { findClienteByIdentifier } from '../utils/clientes';
import { formatDateOnly } from '../utils/formatters';
import apiClient, { fetchCotizacionesDetalle, apiArchiveDocumentToDrive } from '../services/apiClient';
import SendEmailModal from '../components/comercial/SendEmailModal';
import { pdf } from '@react-pdf/renderer';
import PageContainer from '../components/ui/PageContainer';
import SectionHeader from '../components/ui/SectionHeader';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

// --- Status Calculation Logic ---

const getCotizacionProgressStatus = (cotizacion: Cotizacion): 'complete' | 'current' | 'incomplete' => {
  if (cotizacion.estado === 'APROBADA') return 'complete';
  if (cotizacion.estado === 'RECHAZADA') return 'incomplete';
  return 'current';
};

const getPedidoProgressStatus = (cotizacion: Cotizacion, pedido?: Pedido): 'complete' | 'current' | 'incomplete' => {
  if (!pedido) {
    if (cotizacion.estado === 'APROBADA') return 'current';
    return 'incomplete';
  }

  // Si está confirmado o en proceso de despacho, la etapa de "Pedido" como documento está completa
  if (pedido.estado === 'CONFIRMADO' || pedido.estado === 'EN_PROCESO' || pedido.estado === 'PARCIALMENTE_REMITIDO' || pedido.estado === 'REMITIDO') return 'complete';

  // Si está en borrador, es la etapa actual
  if (pedido.estado === 'BORRADOR') return 'current';

  return 'incomplete';
};

const getRemisionProgressStatus = (pedido?: Pedido): 'complete' | 'current' | 'incomplete' => {
  if (!pedido) return 'incomplete';

  // Solo si el pedido está confirmado (o más adelante) empieza la etapa de remisión
  if (pedido.estado === 'BORRADOR' || pedido.estado === 'CANCELADO') return 'incomplete';

  if (pedido.estado === 'REMITIDO') return 'complete';
  if (pedido.estado === 'PARCIALMENTE_REMITIDO' || pedido.estado === 'EN_PROCESO' || pedido.estado === 'CONFIRMADO') return 'current';

  return 'incomplete';
};

const getFacturacionProgressStatus = (remisionesPedido: Remision[], facturasPedido: any[]): 'complete' | 'current' | 'incomplete' => {
  if (facturasPedido.length > 0) return 'complete'; // Simplificado: si hay facturas, se considera completado o en progreso avanzado
  if (remisionesPedido.some(r => r.estado === 'ENTREGADO')) return 'current'; // Si hay entregas, listo para facturar
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
  const { cotizaciones, clientes, vendedores, aprobarCotizacion, pedidos, remisiones, facturas, datosEmpresa, productos, getCotizacionById, actualizarCotizacion, isLoading } = useData();

  const [statusFilter, setStatusFilter] = useState('Todos');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCotizacion, setSelectedCotizacion] = useState<Cotizacion | null>(null);
  const [approvedItems, setApprovedItems] = useState<Set<number>>(new Set());

  const [quoteToPreview, setQuoteToPreview] = useState<Cotizacion | null>(null);
  const [quoteToEmail, setQuoteToEmail] = useState<Cotizacion | null>(null);
  const [approvalResult, setApprovalResult] = useState<{ cotizacion: Cotizacion, pedido: Pedido } | null>(null);

  const ENABLE_BATCH_APPROVAL = false;

  // Selección múltiple (temporalmente deshabilitada si ENABLE_BATCH_APPROVAL es false)
  const [selectedCotizaciones, setSelectedCotizaciones] = useState<Set<string>>(new Set());
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approvingCotizacionId, setApprovingCotizacionId] = useState<string | null>(null);
  const [approvedCotizacionResult, setApprovedCotizacionResult] = useState<{ cotizacion: Cotizacion, pedido?: Pedido } | null>(null);
  const [cotizacionToEdit, setCotizacionToEdit] = useState<Cotizacion | null>(null);
  const [traceabilityData, setTraceabilityData] = useState<any>(null);
  const [isLoadingTraceability, setIsLoadingTraceability] = useState(false);

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
        let vendedor = null;
        if (item.vendedorId) {
          vendedor = vendedores.find(v => String(v.id) === String(item.vendedorId));
        }
        if (!vendedor && item.codVendedor) {
          const codVendedor = String(item.codVendedor).trim();
          vendedor = vendedores.find(v => {
            if (v.codigoVendedor && String(v.codigoVendedor).trim() === codVendedor) return true;
            if (v.codigoVendedor && String(v.codigoVendedor).trim() === codVendedor) return true;
            return false;
          });
        }
        if (!vendedor && item.vendedorId) {
          const codBuscado = String(item.vendedorId).trim();
          vendedor = vendedores.find(v => {
            if (v.codigoVendedor && String(v.codigoVendedor).trim() === codBuscado) return true;
            if (v.codigoVendedor && String(v.codigoVendedor).trim() === codBuscado) return true;
            return false;
          });
        }
        return vendedor ? `${vendedor.primerNombre || ''} ${vendedor.primerApellido || ''}`.trim() : '';
      },
    ],
  });

  const handleOpenModal = useCallback(async (cotizacion: Cotizacion) => {
    // Si la cotización no tiene items o tiene items vacíos, cargar los detalles
    let cotizacionConItems = cotizacion;
    if (!cotizacion.items || cotizacion.items.length === 0) {
      try {
        const cotizacionesDetalleRes = await fetchCotizacionesDetalle(String(cotizacion.id));
        if (cotizacionesDetalleRes.success && Array.isArray(cotizacionesDetalleRes.data)) {
          const items = cotizacionesDetalleRes.data.filter((d: any) => {
            const detalleCotizacionId = String(d.cotizacionId || '');
            const cotizacionIdStr = String(cotizacion.id || '');
            return detalleCotizacionId === cotizacionIdStr ||
              String(cotizacion.id) === String(d.cotizacionId) ||
              Number(cotizacion.id) === Number(d.cotizacionId);
          });

          cotizacionConItems = {
            ...cotizacion,
            items: items.length > 0 ? items : []
          };
        }
      } catch (error) {
        console.error('Error cargando detalles de cotización:', error);
      }
    }

    setSelectedCotizacion(cotizacionConItems);

    // Cargar Trazabilidad
    setIsLoadingTraceability(true);
    try {
      const traceRes = await apiClient.getTraceability('cotizacion', cotizacion.id);
      if (traceRes.success) {
        setTraceabilityData(traceRes.data);
      }
    } catch (error) {
      console.error('Error cargando trazabilidad:', error);
    } finally {
      setIsLoadingTraceability(false);
    }

    if (cotizacionConItems.estado === 'ENVIADA' || cotizacionConItems.estado === 'BORRADOR') {
      // Auto-select all items for approval by default
      if (cotizacionConItems.items && cotizacionConItems.items.length > 0) {
        setApprovedItems(new Set(cotizacionConItems.items.map(item => item.productoId)));
      } else {
        setApprovedItems(new Set());
      }
    } else if (cotizacionConItems.estado === 'APROBADA') {
      setApprovedItems(new Set(cotizacionConItems.approvedItems || []));
    } else {
      setApprovedItems(new Set());
    }
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedCotizacion(null);
    setTraceabilityData(null);
    setApprovedItems(new Set());
    if (params.focusId) {
      setPage('cotizaciones', {}); // Clear param on close
    }
  }, [params.focusId, setPage]);

  useEffect(() => {
    if (params.focusId && !isModalOpen) {
      const quoteToFocus = getCotizacionById(params.focusId);
      if (quoteToFocus) {
        handleOpenModal(quoteToFocus);
      }
    }
  }, [params.focusId, handleOpenModal, getCotizacionById, isModalOpen]);

  const executeApproval = async (cotizacion: Cotizacion, itemIds: number[]) => {
    if (isApproving) return;
    setIsApproving(true);
    setApprovingCotizacionId(cotizacion.id);
    addNotification({ message: `Aprobando cotización ${cotizacion.numeroCotizacion}...`, type: 'info' });

    try {
      const result = await aprobarCotizacion(cotizacion, itemIds);

      if (!result) {
        addNotification({
          message: 'Error al aprobar la cotización',
          type: 'warning'
        });
        return;
      }

      // Verificar si el resultado incluye un pedido
      const finalApprovedQuote = (result && 'cotizacion' in result && result.cotizacion) || getCotizacionById(cotizacion.id);

      if ('pedido' in result && result.pedido) {
        // const pedidoCreado = result.pedido;
        /*
        if (finalApprovedQuote) {
          setApprovedCotizacionResult({ cotizacion: finalApprovedQuote, pedido: pedidoCreado });
        }
        */

        addNotification({
          message: `Cotización ${finalApprovedQuote?.numeroCotizacion || cotizacion.numeroCotizacion} aprobada exitosamente. Pedido creado.`,
          type: 'success'
        });

        // La previsualización se mantiene abierta, el usuario puede ahora enviar el correo manualmente
        // o podríamos forzar la apertura del modal de correo aquí si tuviéramos acceso al estado del componente hijo
      } else {
        // Solo se aprobó la cotización sin crear pedido
        /*
        if (finalApprovedQuote) {
          setApprovedCotizacionResult({ cotizacion: finalApprovedQuote });
        }
        */

        addNotification({
          message: `Cotización ${finalApprovedQuote?.numeroCotizacion || cotizacion.numeroCotizacion} aprobada exitosamente`,
          type: 'success'
        });
      }

      setIsModalOpen(false); // Close detail modal if open
      setQuoteToPreview(null); // Close preview modal
      // setSelectedCotizacion(null); // Evitar limpiar inmediatamente para prevenir errores de desmontaje (removeChild error)
    } catch (error) {
      console.error('Error en executeApproval:', error);
      addNotification({
        message: `Error al aprobar la cotización: ${(error as Error).message}`,
        type: 'warning'
      });
    } finally {
      setIsApproving(false);
      setApprovingCotizacionId(null);
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

    let itemsToApprove = approvedItems;

    // Fallback: If no items are selected but the quote has items, assume "Approve All"
    if (itemsToApprove.size === 0 && cotizacionToApprove.items && cotizacionToApprove.items.length > 0) {
      itemsToApprove = new Set(cotizacionToApprove.items.map(i => i.productoId));
      setApprovedItems(itemsToApprove); // Sync UI
    }

    if (itemsToApprove.size === 0) {
      addNotification({ message: 'Debe seleccionar al menos un item para aprobar.', type: 'warning' });
      return;
    }

    // Confirmar con el usuario antes de aprobar
    const confirmar = window.confirm(
      `¿Estás seguro de aprobar la cotización ${cotizacionToApprove.numeroCotizacion}?\n\n` +
      `Esto creará un pedido con ${itemsToApprove.size} item(s).`
    );

    if (!confirmar) return;

    // Convertir Set a Array de IDs
    const itemIdsArray = Array.from(itemsToApprove);

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
        type: 'warning'
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
        type: successCount > 0 ? 'success' : 'warning'
      });
    } catch (error) {
      addNotification({
        message: `Error al aprobar cotizaciones: ${(error as Error).message}`,
        type: 'warning'
      });
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleEditSubmit = async (formData: any) => {
    if (!cotizacionToEdit) return;
    try {
      const updated = await actualizarCotizacion(cotizacionToEdit.id, formData);
      if (updated) {
        addNotification({ message: 'Cotización actualizada correctamente', type: 'success' });
        setCotizacionToEdit(null);
        // Si el modal de detalles estaba abierto y es la misma cotización, actualizarlo
        if (selectedCotizacion && selectedCotizacion.id === cotizacionToEdit.id) {
          setSelectedCotizacion(updated);
          // Refresh items logic if needed
          if (updated.estado === 'ENVIADA') {
            setApprovedItems(new Set(updated.items.map(item => item.productoId)));
          }
        }
      }
    } catch (error) {
      console.error('Error updating quote:', error);
      addNotification({ message: 'Error al actualizar cotización', type: 'error' });
    }
  };

  const selectedTotals = useMemo(() => {
    const defaultTotals = { subtotalBruto: 0, descuentoTotal: 0, subtotalNeto: 0, iva: 0, domicilios: 0, total: 0 };
    if (!selectedCotizacion) return defaultTotals;

    let itemsToCalculate: DocumentItem[];
    const isApprovalMode = selectedCotizacion.estado === 'ENVIADA' || selectedCotizacion.estado === 'BORRADOR';

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



  const handleSendEmail = (cotizacion: Cotizacion) => {
    setQuoteToEmail(cotizacion);
  };

  const handleConfirmSendEmail = async (emailData: { to: string; subject: string; body: string }) => {
    if (!quoteToEmail) return;

    addNotification({ message: 'Preparando envío de correo...', type: 'info' });

    try {
      const clienteCotizacion = clientes.find(c => String(c.id) === String(quoteToEmail.clienteId));
      if (!clienteCotizacion) return;

      let vendedor = null;
      if (quoteToEmail.vendedorId) {
        vendedor = vendedores.find(v => String(v.id) === String(quoteToEmail.vendedorId));
      }

      // DETERMINAR FIRMA: Priorizar la firma del usuario logueado ('user.firma') si existe,
      // de lo contrario usar la del vendedor asignado a la cotización.
      // El usuario solicitó explícitamente: "quiero que se guarde y envie con la firma del usuario que esta ejecutando el programa"
      const firmaFinal = user?.firma || vendedor?.firma;

      // Generar Blob del PDF
      const blob = await pdf(
        <CotizacionPDFDocument
          cotizacion={quoteToEmail}
          cliente={clienteCotizacion}
          vendedor={vendedor || undefined}
          firmaVendedor={firmaFinal}
          empresa={datosEmpresa}
          preferences={{ showPrices: true, signatureType: 'physical', detailLevel: 'full' }}
          productos={productos}
        />
      ).toBlob();

      // Convertir a Base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;

        // Enviar al backend usando el endpoint específico
        const response = await apiClient.sendCotizacionEmail(quoteToEmail.id, {
          destinatario: emailData.to,
          asunto: emailData.subject,
          mensaje: emailData.body,
          pdfBase64: base64data
        });

        if (response.success) {
          addNotification({ message: '✅ Correo enviado exitosamente.', type: 'success' });
          setQuoteToEmail(null);

          // --- Archivar en Google Drive ---
          try {
            addNotification({ message: 'Archivando en Google Drive...', type: 'info' });
            // Extraer base64 raw
            const base64Content = base64data.split(',')[1] || base64data;

            const archiveResponse = await apiArchiveDocumentToDrive({
              type: 'cotizacion',
              number: quoteToEmail.numeroCotizacion,
              date: quoteToEmail.fechaCotizacion || new Date().toISOString(),
              recipientName: clienteCotizacion?.razonSocial || 'Cliente',
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
                  type: 'cotizacion',
                  number: quoteToEmail.numeroCotizacion,
                  date: quoteToEmail.fechaCotizacion || new Date().toISOString(),
                  recipientName: clienteCotizacion?.razonSocial || 'Cliente',
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


  // Limpiar selección cuando cambia el filtro o página
  useEffect(() => {
    if (!ENABLE_BATCH_APPROVAL) return;
    setSelectedCotizaciones(new Set());
  }, [statusFilter, currentPage]);

  const columns: Column<Cotizacion>[] = useMemo(() => {
    const baseColumns: Column<Cotizacion>[] = [
      {
        header: 'Número',
        accessor: 'numeroCotizacion',
        cell: (item) => (
          <span className="font-bold font-mono text-slate-700 dark:text-slate-200">
            {item.numeroCotizacion.replace('C-', '')}
          </span>
        )
      },
      {
        header: 'Cliente',
        accessor: 'clienteId',
        cell: (item) => {
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
        accessor: 'fechaCotizacion',
        cell: (item) => (
          <span className="text-sm text-slate-600 dark:text-slate-400">{formatDateOnly(item.fechaCotizacion)}</span>
        )
      },
      {
        header: 'Vendedor', accessor: 'vendedorId', cell: (item) => {
          // Si el backend ya nos da el nombre, usarlo directamente
          if (item.vendedorNombre && item.vendedorNombre.trim() !== '' && item.vendedorNombre !== 'N/A') {
            return <span className="text-sm text-slate-600 dark:text-slate-400 truncate block max-w-[150px]" title={item.vendedorNombre}>{item.vendedorNombre}</span>;
          }

          // Fallback: Buscar vendedor por ID o código en la lista cargada (solo si el backend no lo resolvió)
          let vendedor = null;
          if (item.vendedorId) {
            // Primero buscar por ID numérico (ideven)
            vendedor = vendedores.find(v => String(v.id) === String(item.vendedorId));
          }
          // Si no se encuentra por ID, buscar por código (codven)
          if (!vendedor && item.codVendedor) {
            vendedor = vendedores.find(v => {
              const codVendedor = String(item.codVendedor || '').trim();
              if (v.codigoVendedor && String(v.codigoVendedor).trim() === codVendedor) return true;
              return false;
            });
          }

          const nombreVendedor = vendedor ? `${vendedor.primerNombre || ''} ${vendedor.primerApellido || ''}`.trim() : 'N/A';
          return <span className="text-sm text-slate-600 dark:text-slate-400 truncate block max-w-[150px]" title={nombreVendedor}>{nombreVendedor}</span>;
        }
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
          if (!item.formaPago) return <span className="text-slate-400 text-xs">N/A</span>;
          // Convertir valores antiguos '01'/'02' a nuevos '1'/'2' si es necesario
          const formaPagoValue = item.formaPago === '01' ? '1' : item.formaPago === '02' ? '2' : item.formaPago;
          const isContado = formaPagoValue === '1';
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
              onClick={() => handleOpenModal(item)}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
              title="Ver Detalle"
            >
              <i className="fas fa-eye"></i>
            </button>
            <button
              onClick={() => setQuoteToPreview(item)}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all duration-200"
              title="Vista Previa PDF"
            >
              <i className="fas fa-file-pdf"></i>
            </button>
            <button
              onClick={() => handleSendEmail(item)}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
              title="Enviar Email"
            >
              <i className="fas fa-paper-plane"></i>
            </button>
            <ProtectedComponent permission="cotizaciones:approve">
              {(item.estado === 'ENVIADA' || item.estado === 'BORRADOR') && (
                <button
                  onClick={() => handleAprobar(item)}
                  disabled={isApproving || isProcessingBatch}
                  className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Aprobar Cotización"
                >
                  {isApproving && approvingCotizacionId === item.id ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : (
                    <i className="fas fa-check-circle"></i>
                  )}
                </button>
              )}
            </ProtectedComponent>
          </div>
        )
      },
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
        title="Gestión de Cotizaciones"
        subtitle="Administra y da seguimiento a las ofertas comerciales."
      />

      <Card className="shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-2 sm:p-3 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
          <TableToolbar
            searchTerm={searchTerm}
            onSearchChange={handleSearch}
            createActionLabel="Nueva Cotización"
            onCreateAction={() => setPage('nueva_cotizacion')}
            additionalFilters={additionalFilters}
            placeholder="Buscar cotización, cliente..."
          />
        </div>

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
          <Table columns={columns} data={paginatedData} onSort={requestSort} sortConfig={sortConfig} highlightRowId={params.highlightId ?? params.focusId} isLoading={isLoading} />
        </CardContent>

        <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
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
        </div>
      </Card>

      {selectedCotizacion && (
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title=""
          size="5xl"
          className="bg-slate-50 dark:bg-slate-900"
        >
          {/* Header Personalizado del Modal */}
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 -mx-6 -mt-6 px-6 py-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                  <i className="fas fa-file-invoice text-xl"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    Cotización {selectedCotizacion.numeroCotizacion}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Detalles y seguimiento del ciclo de venta
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={selectedCotizacion.estado as any} className="text-sm px-3 py-1" />
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Cotización</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{formatCurrency(selectedTotals.total)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6 text-sm">
            {/* Progress Section (Top) */}
            <div className="mb-8 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <i className="fas fa-project-diagram text-blue-500"></i>
                  Flujo del Proceso de Venta
                </h4>
                {isLoadingTraceability && <i className="fas fa-spinner fa-spin text-blue-500"></i>}
              </div>
              <ProgressFlow>
                <ProgressStep
                  title="Cotización"
                  status={getCotizacionProgressStatus(selectedCotizacion)}
                >
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-blue-600 dark:text-blue-400">{selectedCotizacion.numeroCotizacion}</span>
                    <span className="text-[10px] opacity-70">{formatDateOnly(selectedCotizacion.fechaCotizacion)}</span>
                  </div>
                </ProgressStep>

                <ProgressStep
                  title="Pedido"
                  status={traceabilityData?.pedido ? 'complete' : (selectedCotizacion.estado === 'APROBADA' ? 'current' : 'incomplete')}
                >
                  <div className="flex flex-col items-center">
                    {traceabilityData?.pedido ? (
                      <>
                        <span className="font-bold text-green-600 dark:text-green-400">{traceabilityData.pedido.numero}</span>
                        <span className="text-[10px] opacity-70">{formatDateOnly(traceabilityData.pedido.fecha)}</span>
                      </>
                    ) : (
                      <span className="text-slate-400 italic">Pendiente</span>
                    )}
                  </div>
                </ProgressStep>

                <ProgressStep
                  title="Remisión"
                  status={traceabilityData?.remisiones?.length > 0 ? 'complete' : 'incomplete'}
                >
                  <div className="flex flex-col items-center">
                    {traceabilityData?.remisiones?.length > 0 ? (
                      <>
                        <span className="font-bold text-green-600 dark:text-green-400">
                          {traceabilityData.remisiones.length === 1
                            ? traceabilityData.remisiones[0].numero
                            : `${traceabilityData.remisiones.length} Remisiones`}
                        </span>
                        {traceabilityData.remisiones.length === 1 && (
                          <span className="text-[10px] opacity-70">{formatDateOnly(traceabilityData.remisiones[0].fecha)}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400 italic">Pendiente</span>
                    )}
                  </div>
                </ProgressStep>

                <ProgressStep
                  title="Facturación"
                  status={traceabilityData?.facturas?.length > 0 ? 'complete' : 'incomplete'}
                >
                  <div className="flex flex-col items-center">
                    {traceabilityData?.facturas?.length > 0 ? (
                      <>
                        <span className="font-bold text-green-600 dark:text-green-400">
                          {traceabilityData.facturas.length === 1
                            ? traceabilityData.facturas[0].numero
                            : `${traceabilityData.facturas.length} Facturas`}
                        </span>
                        {traceabilityData.facturas.length === 1 && (
                          <span className="text-[10px] opacity-70">{formatDateOnly(traceabilityData.facturas[0].fecha)}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400 italic">Pendiente</span>
                    )}
                  </div>
                </ProgressStep>
              </ProgressFlow>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Información del Cliente */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-100 dark:border-slate-700">
                <h5 className="flex items-center text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                  <i className="fas fa-user-circle mr-2 text-blue-500"></i>
                  Información del Cliente
                </h5>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Razón Social / Nombre</p>
                    <p className="font-medium text-base text-slate-800 dark:text-slate-200">{clientes.find(c => c.id === selectedCotizacion.clienteId)?.nombreCompleto || 'N/A'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Teléfono</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300">
                        {(selectedCotizacion as any).clienteTelefono ||
                          (selectedCotizacion as any).clienteCelular ||
                          clientes.find(c => c.id === selectedCotizacion.clienteId)?.telter ||
                          clientes.find(c => c.id === selectedCotizacion.clienteId)?.celter ||
                          'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Email</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300 truncate" title={(selectedCotizacion as any).clienteEmail || clientes.find(c => c.id === selectedCotizacion.clienteId)?.email || ''}>
                        {(selectedCotizacion as any).clienteEmail || clientes.find(c => c.id === selectedCotizacion.clienteId)?.email || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Información Comercial */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-100 dark:border-slate-700">
                <h5 className="flex items-center text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                  <i className="fas fa-file-invoice-dollar mr-2 text-green-500"></i>
                  Datos Comerciales
                </h5>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Vendedor</p>
                    <p className="font-medium text-slate-700 dark:text-slate-300 truncate">
                      {(() => {
                        let v = null;
                        if (selectedCotizacion.vendedorId) {
                          v = vendedores.find(v => String(v.id) === String(selectedCotizacion.vendedorId));
                        }
                        if (!v && selectedCotizacion.codVendedor) {
                          const codVendedor = String(selectedCotizacion.codVendedor).trim();
                          v = vendedores.find(v => (v.codigoVendedor || '').trim() === codVendedor || (v.codigoVendedor || '').trim() === codVendedor);
                        }
                        return v ? `${v.primerNombre || ''} ${v.primerApellido || ''}`.trim() : 'N/A';
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Forma de Pago</p>
                    <p className="font-medium text-slate-700 dark:text-slate-300">
                      {selectedCotizacion.formaPago === '1' || selectedCotizacion.formaPago === '01' ? 'Contado' : 'Crédito'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Fecha Emisión</p>
                    <p className="font-medium text-slate-700 dark:text-slate-300">{formatDateOnly(selectedCotizacion.fechaCotizacion)}</p>
                  </div>
                  {selectedCotizacion.fechaVencimiento && (
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Vencimiento</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300">{formatDateOnly(selectedCotizacion.fechaVencimiento)}</p>
                    </div>
                  )}
                  {selectedCotizacion.fechaAprobacion && (
                    <div className="col-span-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Aprobado el</p>
                      <p className="font-medium text-green-600 dark:text-green-400">{formatDateOnly(selectedCotizacion.fechaAprobacion)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {selectedCotizacion.observacionesInternas && (
              <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-lg border border-yellow-100 dark:border-yellow-800/30 flex gap-3">
                <i className="fas fa-comment-alt text-yellow-500 mt-0.5"></i>
                <div>
                  <p className="text-xs font-bold text-yellow-700 dark:text-yellow-500 mb-1">Observaciones Internas</p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 italic">{selectedCotizacion.observacionesInternas}</p>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 uppercase tracking-wide">Items Cotizados</h4>
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                <table className="w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      {['ENVIADA', 'BORRADOR'].includes(selectedCotizacion.estado) && <th scope="col" className="w-16 px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aprobar</th>}
                      {selectedCotizacion.estado === 'APROBADA' && <th scope="col" className="w-16 px-4 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">OK</th>}
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Producto</th>
                      <th scope="col" className="px-4 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Und</th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cant.</th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Precio</th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Desc.</th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">IVA</th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                    {selectedCotizacion.items.map((item: DocumentItem, index: number) => {
                      const product = productos.find(p =>
                        String(p.id) === String(item.productoId) ||
                        p.id === item.productoId ||
                        (item.codProducto && p.codigo && String(p.codigo).trim().toUpperCase() === String(item.codProducto).trim().toUpperCase())
                      );
                      const productoNombre = product?.nombre || item.descripcion || `Producto ${index + 1}`;
                      const itemSubtotal = (item.precioUnitario || 0) * (item.cantidad || 0) * (1 - (item.descuentoPorcentaje || 0) / 100);
                      const itemIva = itemSubtotal * ((item.ivaPorcentaje || 0) / 100);
                      const itemTotal = itemSubtotal + itemIva;

                      return (
                        <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          {['ENVIADA', 'BORRADOR'].includes(selectedCotizacion.estado) && (
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                checked={approvedItems.has(item.productoId)}
                                onChange={() => handleToggleItemApproval(item.productoId)}
                              />
                            </td>
                          )}
                          {selectedCotizacion.estado === 'APROBADA' && (
                            <td className="px-4 py-3 text-center">
                              {selectedCotizacion.approvedItems?.includes(item.productoId)
                                ? <i className="fas fa-check-circle text-green-500 text-lg" title="Aprobado"></i>
                                : <i className="fas fa-times-circle text-slate-300 dark:text-slate-600 text-lg" title="No Aprobado"></i>}
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                            <div className="flex flex-col">
                              <span className="font-semibold">{productoNombre}</span>
                              {!product && (
                                <span className="text-xs text-amber-500 font-medium flex items-center gap-1">
                                  <i className="fas fa-exclamation-triangle mr-1"></i> No en catálogo
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-sm text-center text-slate-500">{(item as any).unidadMedida || product?.unidadMedida || item.codigoMedida || '-'}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-slate-700 dark:text-slate-300">
                            {item.cantidad}
                            {(item.cantFacturada || 0) > 0 && (
                              <div className="text-xs text-blue-500 font-normal">({item.cantFacturada} fact.)</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-slate-600 dark:text-slate-400">{formatCurrency(item.precioUnitario)}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            {item.descuentoPorcentaje > 0 ? <span className="text-red-500 font-medium">-{item.descuentoPorcentaje}%</span> : <span className="text-slate-400">-</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-slate-600 dark:text-slate-400">{item.ivaPorcentaje}%</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-slate-800 dark:text-slate-100">{formatCurrency(itemTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resumen Totales */}
            <div className="flex flex-col sm:flex-row justify-end gap-6 pt-4">
              <div className="w-full sm:w-80 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                  Resumen Económico
                </h5>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal Bruto</span>
                    <span className="font-medium">{formatCurrency(selectedTotals.subtotalBruto)}</span>
                  </div>
                  {selectedTotals.descuentoTotal > 0 && (
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                      <span>Descuento</span>
                      <span className="font-medium">-{formatCurrency(selectedTotals.descuentoTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-800 dark:text-slate-200 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <span className="font-medium">Subtotal Neto</span>
                    <span className="font-bold">{formatCurrency(selectedTotals.subtotalNeto)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>IVA</span>
                    <span>{formatCurrency(selectedTotals.iva)}</span>
                  </div>
                  <div className="flex justify-between items-end pt-3 mt-1 border-t-2 border-slate-100 dark:border-slate-700">
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-lg">Total</span>
                    <span className="font-bold text-2xl text-blue-600 dark:text-blue-400">{formatCurrency(selectedTotals.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer de Acciones (Botones Inferiores) */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
              <div>
                <ProtectedComponent permission="cotizaciones:edit">
                  {(selectedCotizacion.estado === 'ENVIADA' || selectedCotizacion.estado === 'BORRADOR') && (
                    <button
                      onClick={() => {
                        handleCloseModal();
                        setCotizacionToEdit(selectedCotizacion);
                      }}
                      className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all text-sm font-medium flex items-center gap-2"
                    >
                      <i className="fas fa-pencil-alt"></i> Editar Cotización
                    </button>
                  )}
                </ProtectedComponent>
              </div>

              <div className="flex flex-wrap justify-end gap-3 w-full sm:w-auto">
                <button
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                  Cerrar
                </button>

                <button
                  onClick={() => setQuoteToPreview(selectedCotizacion)}
                  className="px-5 py-2.5 bg-white dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-900 text-blue-700 dark:text-blue-300 font-semibold rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors shadow-sm flex items-center gap-2"
                >
                  <i className="fas fa-file-pdf"></i> Vista Previa PDF
                </button>

                <ProtectedComponent permission="cotizaciones:approve">
                  {(selectedCotizacion.estado === 'ENVIADA' || selectedCotizacion.estado === 'BORRADOR') && (
                    <button
                      onClick={handleConfirmarAprobacion}
                      disabled={isApproving || isProcessingBatch}
                      className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold rounded-lg hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-2"
                    >
                      {isApproving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check-circle"></i>}
                      Aprobar {approvedItems.size > 0 ? `(${approvedItems.size})` : ''}
                    </button>
                  )}
                </ProtectedComponent>
              </div>
            </div>

          </div>
        </Modal>
      )
      }

      {
        quoteToPreview && (() => {
          // Usar fallback si no se encuentra cliente/vendedor para evitar desmontaje abrupto durante refresh
          const cliente = clientes.find(c => c.id === quoteToPreview.clienteId) || ({
            nombreCompleto: 'Cliente no encontrado',
            email: '',
            direccion: '',
            telefono: ''
          } as any);

          let vendedor = null;
          if (quoteToPreview.vendedorId) {
            vendedor = vendedores.find(v => String(v.id) === String(quoteToPreview.vendedorId));
          }
          if (!vendedor && quoteToPreview.codVendedor) {
            const codVendedor = String(quoteToPreview.codVendedor).trim();
            vendedor = vendedores.find(v => (v.codigoVendedor || '').trim() === codVendedor || (v.codigoVendedor || '').trim() === codVendedor);
          }
          // Fallback para vendedor
          if (!vendedor) {
            vendedor = { primerNombre: 'Vendedor', primerApellido: 'No Encontrado' } as any;
          }

          return (
            <DocumentPreviewModal
              isOpen={!!quoteToPreview}
              onClose={() => setQuoteToPreview(null)}
              title={`Previsualizar Cotización: ${quoteToPreview.numeroCotizacion?.replace('C-', '')}`}
              onConfirm={() => executeApproval(quoteToPreview, quoteToPreview.items.map(i => i.productoId))}
              isConfirming={isApproving}
              onEdit={() => {
                if (quoteToPreview) {
                  setQuoteToPreview(null);
                  setPage('editar_cotizacion', { id: quoteToPreview.id });
                }
              }}
              documentType="cotizacion"
              clientEmail={cliente.email}
              clientName={cliente.nombreCompleto}
              documentId={quoteToPreview.id}
            >

              <CotizacionPDFDocument
                cotizacion={quoteToPreview}
                cliente={cliente}
                vendedor={vendedor}
                empresa={datosEmpresa}
                preferences={{} as any}
                productos={productos}
              />
            </DocumentPreviewModal>
          );
        })()
      }

      {
        approvalResult && (() => {
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
                {
                  label: 'Vendedor', value: (() => {
                    let v = null;
                    if (cotizacion.vendedorId) {
                      v = vendedores.find(v => String(v.id) === String(cotizacion.vendedorId));
                    }
                    if (!v && cotizacion.codVendedor) {
                      const codVendedor = String(cotizacion.codVendedor).trim();
                      v = vendedores.find(v => {
                        if (v.codigoVendedor && String(v.codigoVendedor).trim() === codVendedor) return true;
                        if (v.codigoVendedor && String(v.codigoVendedor).trim() === codVendedor) return true;
                        return false;
                      });
                    }
                    if (!v && cotizacion.vendedorId) {
                      const codBuscado = String(cotizacion.vendedorId).trim();
                      v = vendedores.find(v => {
                        if (v.codigoVendedor && String(v.codigoVendedor).trim() === codBuscado) return true;
                        if (v.codigoVendedor && String(v.codigoVendedor).trim() === codBuscado) return true;
                        return false;
                      });
                    }
                    return v ? `${v.primerNombre || ''} ${v.primerApellido || ''}`.trim() : 'N/A';
                  })()
                },
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
        })()
      }

      {
        approvedCotizacionResult && (() => {
          const { cotizacion, pedido } = approvedCotizacionResult;
          const cliente = findClienteByIdentifier(clientes, cotizacion.clienteId);
          const vendedor = vendedores.find(v => v.id === cotizacion.vendedorId);

          if (!cliente) return null;

          const subtotalBruto = cotizacion.items.reduce((acc, item) => acc + (item.precioUnitario * item.cantidad), 0);
          const descuentoTotal = cotizacion.descuentoValor || cotizacion.items.reduce((acc, item) => {
            const itemTotalBruto = item.precioUnitario * item.cantidad;
            return acc + (itemTotalBruto * (item.descuentoPorcentaje / 100));
          }, 0);

          const summaryDetails = [
            { label: 'Número', value: cotizacion.numeroCotizacion },
            { label: 'Fecha', value: formatDateOnly(cotizacion.fechaCotizacion) },
            { label: 'Válida hasta', value: formatDateOnly(cotizacion.fechaVencimiento) },
            { label: 'Cliente', value: cliente.nombreCompleto || cliente.razonSocial || 'N/A' },
            { label: 'Vendedor', value: vendedor ? `${vendedor.primerNombre} ${vendedor.primerApellido}`.trim() : 'N/A' },
            { label: 'Estado', value: 'Aprobada' },
            { label: 'Items', value: cotizacion.items.length },
            { label: 'sep1', value: '', isSeparator: true },
            { label: 'Subtotal Bruto', value: formatCurrency(subtotalBruto) },
            { label: 'Descuento Total', value: `-${formatCurrency(descuentoTotal)}`, isDiscount: true },
            { label: 'Subtotal Neto', value: formatCurrency(cotizacion.subtotal) },
            { label: 'IVA (19%)', value: formatCurrency(cotizacion.ivaValor) },
            { label: 'Total Cotización', value: formatCurrency(cotizacion.total), isTotal: true },
          ];

          if (pedido) {
            summaryDetails.push(
              { label: 'sep2', value: '', isSeparator: true },
              { label: 'Pedido Creado', value: pedido.numeroPedido, isTotal: false }
            );
          }

          return (
            <ApprovalSuccessModal
              isOpen={!!approvedCotizacionResult}
              onClose={() => {
                setApprovedCotizacionResult(null);
              }}
              title="¡Cotización Aprobada!"
              message={
                <>
                  La cotización <strong>{cotizacion.numeroCotizacion}</strong> ha sido aprobada exitosamente.
                  {pedido && <> Se ha generado el Pedido <strong>{pedido.numeroPedido}</strong>.</>}
                </>
              }
              summaryTitle="Resumen de la Cotización Aprobada"
              summaryDetails={summaryDetails}
              primaryAction={{
                label: 'Ir a Cotizaciones',
                onClick: () => {
                  setApprovedCotizacionResult(null);
                  setPage('cotizaciones', { focusId: cotizacion.id });
                },
                icon: 'fa-list'
              }}
              secondaryActions={[
                ...(pedido ? [{
                  label: 'Ver Pedido',
                  onClick: () => {
                    setApprovedCotizacionResult(null);
                    setPage('pedidos');
                  },
                  icon: 'fa-shopping-cart'
                }] : []),
                {
                  label: 'Ver Detalles',
                  onClick: () => {
                    setApprovedCotizacionResult(null);
                    setPage('cotizaciones', { focusId: cotizacion.id });
                  },
                  icon: 'fa-eye'
                }
              ]}
            />
          );
        })()
      }


      {
        cotizacionToEdit && (
          <Modal
            isOpen={!!cotizacionToEdit}
            onClose={() => setCotizacionToEdit(null)}
            title={`Editar Cotización: ${cotizacionToEdit.numeroCotizacion}`}
            size="5xl"
          >
            <div className="bg-white dark:bg-slate-800 p-1">
              <CotizacionForm
                initialData={cotizacionToEdit}
                isEditing={true}
                onCancel={() => setCotizacionToEdit(null)}
                onSubmit={handleEditSubmit}
              />
            </div>
          </Modal>
        )
      }

      {
        quoteToEmail && (() => {
          const clienteCotizacion = clientes.find(c => String(c.id) === String(quoteToEmail.clienteId));
          return (
            <SendEmailModal
              isOpen={!!quoteToEmail}
              onClose={() => setQuoteToEmail(null)}
              onSend={handleConfirmSendEmail}
              to={clienteCotizacion?.email || ''}
              subject={`Cotización ${quoteToEmail.numeroCotizacion} - ${datosEmpresa.nombre}`}
              body={`Estimado cliente ${clienteCotizacion?.nombreCompleto || 'Cliente'},\n\nAdjuntamos la cotización de los productos de su interés.\n\nCordialmente,\n${datosEmpresa.nombre}`}
            />
          );
        })()
      }

    </PageContainer >
  );
};

export default CotizacionesPage;