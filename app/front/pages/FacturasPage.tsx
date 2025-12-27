import React, { useState, useMemo, useEffect } from 'react';
import Table, { Column } from '../components/ui/Table';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Factura, Remision, DocumentItem } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import { useTable } from '../hooks/useTable';
import { TableToolbar } from '../components/ui/TableToolbar';
import TablePagination from '../components/ui/TablePagination';
import { useNotifications } from '../hooks/useNotifications';
import FacturaPreviewModal from '../components/facturacion/FacturaPreviewModal';
import SendEmailModal from '../components/comercial/SendEmailModal';
import ProtectedComponent from '../components/auth/ProtectedComponent';
import { useData } from '../hooks/useData';
import { useNavigation } from '../hooks/useNavigation';
import { formatDateOnly } from '../utils/formatters';
import PageContainer from '../components/ui/PageContainer';
import SectionHeader from '../components/ui/SectionHeader';
import { fetchFacturasDetalle, apiClient } from '../services/apiClient';
import PageHeader from '../components/ui/PageHeader';
import RemisionPreviewModal from '../components/remisiones/RemisionPreviewModal'; // New Import



const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
}

const filterOptions = [
  { label: 'Todas', value: 'Todos' },
  { label: 'Borrador', value: 'BORRADOR' },
  { label: 'Enviada', value: 'ENVIADA' },
  { label: 'Aceptada', value: 'ACEPTADA' },
  { label: 'Rechazada', value: 'RECHAZADA' },
  { label: 'Anulada', value: 'ANULADA' },
];

const FacturasPage: React.FC = () => {
  const { params, setPage } = useNavigation();
  const { remisiones, clientes, pedidos, cotizaciones, crearFacturaDesdeRemisiones, timbrarFactura, datosEmpresa, archivosAdjuntos, productos, vendedores, refreshFacturasYRemisiones } = useData();
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [selectedRemisiones, setSelectedRemisiones] = useState<Set<string>>(new Set());
  const { addNotification } = useNotifications();

  // Server-Side State
  const [invoicesData, setInvoicesData] = useState<Factura[]>([]);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [serverPage, setServerPage] = useState(1);
  const [serverPageSize, setServerPageSize] = useState(20);
  const [serverSearch, setServerSearch] = useState('');
  const [serverSort, setServerSort] = useState({ key: 'fechaFactura', direction: 'desc' });

  // Filters state (Start with empty to show all)
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filterClienteId, setFilterClienteId] = useState('');

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null);
  const [isStamping, setIsStamping] = useState(false);
  const [isFacturando, setIsFacturando] = useState(false);
  const [facturaToPreview, setFacturaToPreview] = useState<Factura | null>(null);
  const [facturaToEmail, setFacturaToEmail] = useState<Factura | null>(null);

  const [remisionToPreview, setRemisionToPreview] = useState<Remision | null>(null);
  const [isLoadingRemision, setIsLoadingRemision] = useState(false);

  // Fetch Invoices (Server Side)
  const loadInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const dbStatus = statusFilter === 'Todos' ? undefined : statusFilter;
      const response = await apiClient.getFacturas(
        serverPage,
        serverPageSize,
        serverSearch,
        dbStatus,
        dateRange.start,
        dateRange.end,
        filterClienteId,
        serverSort.key,
        serverSort.direction as 'asc' | 'desc'
      );

      if (response.success && response.data) {
        setInvoicesData(response.data as Factura[]);
        // Assuming pagination structure matches
        const pagination = (response as any).pagination || {};
        const total = pagination.total || (response.data as any[]).length;
        setTotalInvoices(total);
      } else {
        setInvoicesData([]);
        setTotalInvoices(0);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
      addNotification({ message: 'Error cargando facturas', type: 'error' });
    } finally {
      setLoadingInvoices(false);
    }
  };

  // Reload when params change
  useEffect(() => {
    loadInvoices();
  }, [serverPage, serverPageSize, serverSearch, statusFilter, dateRange, filterClienteId, serverSort, refreshFacturasYRemisiones]);


  const handlePreviewRemision = async (remision: Remision) => {
    if (remision.items && remision.items.length > 0) {
      setRemisionToPreview(remision);
      return;
    }
    setIsLoadingRemision(true);
    try {
      addNotification({ message: 'Cargando detalles de la remisión...', type: 'info' });
      const detallesRes = await apiClient.getRemisionDetalleById(remision.id);
      if (detallesRes.success && Array.isArray(detallesRes.data)) {
        setRemisionToPreview({ ...remision, items: detallesRes.data });
      } else {
        addNotification({ message: 'No se pudieron cargar los detalles.', type: 'warning' });
      }
    } catch (error) {
      console.error('Error cargando detalles:', error);
      addNotification({ message: 'Error al cargar detalles de la remisión.', type: 'warning' });
    } finally {
      setIsLoadingRemision(false);
    }
  };

  useEffect(() => {
    refreshFacturasYRemisiones().catch(error => { console.error('Error al refrescar remisiones:', error); });
  }, [refreshFacturasYRemisiones]);

  useEffect(() => {
    const focusId = params?.focusId;
    if (!focusId) return;
    // Try to find in loaded data
    const targetInvoice = invoicesData.find((factura) => String(factura.id) === String(focusId));

    // TODO: If not in current page, might need to fetch it specifically or handle it.
    // For now, only open if visible. Or fetch detail directly if not found?
    // Implementing direct fetch for focusId if not in list:
    const handleFocus = async () => {
      if (targetInvoice) {
        if (selectedFactura?.id !== targetInvoice.id || !isDetailModalOpen) {
          setSelectedFactura(targetInvoice);
          setIsDetailModalOpen(true);
        }
      } else {
        // Fetch detail individually
        try {
          const detail = await fetchFacturasDetalle(focusId);
          // logic to construct Invoice object from detail is complex because detail endpoint returns rows.
          // We need the Header info. 'getInvoiceDetails' in backend does NOT return header info standalone easily 
          // unless we change it or use getFacturas with ID filter.
          // Using getFacturas with ID search is easier? No, fetchFacturasDetalle logic in backend returns combined data?
          // Actually backend getInvoiceDetails returns ARRAY of details.
          // We need getFacturas({ search: focusId })?
        } catch (e) { }
      }
    };
    handleFocus();
  }, [params?.focusId, invoicesData, selectedFactura, isDetailModalOpen]);

  // Simplificación: Confiar en remision.facturaId
  const remisionesPorFacturar = useMemo(() => {
    return remisiones.filter(r => {
      const estadoStr = String(r.estado || '').trim().toUpperCase();
      const esEntregado = estadoStr === 'ENTREGADO' || estadoStr === 'D';
      if (!esEntregado) return false;
      const tieneFacturaIdDirecto = !!(r.facturaId && String(r.facturaId).trim() !== '' && String(r.facturaId) !== 'null');
      if (tieneFacturaIdDirecto) return false;
      return true;
    });
  }, [remisiones]);

  const selectedClientId = useMemo(() => {
    if (selectedRemisiones.size === 0) return null;
    const firstRemisionId = selectedRemisiones.values().next().value;
    const firstRemision = remisionesPorFacturar.find(r => r.id === firstRemisionId);
    if (!firstRemision) return null;
    const cliente = clientes.find(c =>
      String(c.id) === String(firstRemision.clienteId) ||
      c.numeroDocumento === firstRemision.clienteId ||
      c.codter === firstRemision.clienteId
    );
    return cliente?.id || null;
  }, [selectedRemisiones, remisionesPorFacturar, clientes]);

  const {
    paginatedData: paginatedInvoices,
    requestSort: requestSortInvoices,
    sortConfig: sortConfigInvoices,
    searchTerm: searchTermInvoices,
    handleSearch: handleSearchInvoices,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    goToPage,
    totalItems,
    rowsPerPage,
    setRowsPerPage,
  } = useTable<Factura>({
    data: invoicesData,
    manual: true,
    totalItems: totalInvoices,
    initialRowsPerPage: 20,
    onPageChange: (page) => setServerPage(page),
    onRowsPerPageChange: (rows) => { setServerPageSize(rows); setServerPage(1); },
    // On Server Sort (Mapping 'requestSort' internal logic is tricky, better to intercept it?)
    // useTable manages sortConfig internally. We need to sync it.
    // Actually, useTable sorts locally if manual is false. If manual is true, it just holds state.
    // BUT we need to know WHEN it changes to call setServerSort.
    // We can add an effect on sortConfig change?
  });

  // Sync Sort
  useEffect(() => {
    if (sortConfigInvoices.key) {
      setServerSort({
        key: String(sortConfigInvoices.key),
        direction: sortConfigInvoices.direction
      });
    }
  }, [sortConfigInvoices]);

  // Sync Search
  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      setServerSearch(searchTermInvoices);
      setServerPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTermInvoices]);

  const { cliente, remisionesRelacionadas, pedido, formaPago } = useMemo(() => {
    if (!selectedFactura) {
      return { cliente: null, remisionesRelacionadas: [], pedido: null, formaPago: undefined };
    }
    // Buscar cliente de forma flexible
    const cliente = clientes.find(c =>
      String(c.id) === String(selectedFactura.clienteId) ||
      c.numeroDocumento === selectedFactura.clienteId ||
      c.codter === selectedFactura.clienteId
    );
    // Buscar remisiones relacionadas de múltiples formas:
    // 1. Por remisionesIds (array de IDs)
    // 2. Por remisionId (singular) como fallback
    // 3. Por facturaId en las remisiones (búsqueda inversa)
    let remisionesRelacionadas = [];

    // Primero intentar con remisionesIds
    const remisionesIds = selectedFactura.remisionesIds || [];
    if (remisionesIds.length > 0) {
      remisionesRelacionadas = remisiones.filter(r =>
        remisionesIds.some(id => String(r.id) === String(id))
      );
    }

    // Si no se encontraron, intentar con remisionId (singular)
    if (remisionesRelacionadas.length === 0 && selectedFactura.remisionId) {
      const remisionEncontrada = remisiones.find(r =>
        String(r.id) === String(selectedFactura.remisionId)
      );
      if (remisionEncontrada) {
        remisionesRelacionadas = [remisionEncontrada];
      }
    }

    // Si aún no se encontraron, buscar por facturaId en las remisiones (búsqueda inversa)
    if (remisionesRelacionadas.length === 0 && selectedFactura.id) {
      remisionesRelacionadas = remisiones.filter(r => {
        // Comparar facturaId de la remisión con el id de la factura
        // Pueden ser números o strings, así que normalizamos
        const remisionFacturaId = r.facturaId ? String(r.facturaId) : null;
        const facturaId = String(selectedFactura.id);
        return remisionFacturaId === facturaId;
      });
    }

    // Log para diagnóstico (solo en desarrollo)
    if (process.env.NODE_ENV === 'development' && remisionesRelacionadas.length === 0 && selectedFactura) {
      console.log('🔍 [FacturasPage] No se encontraron remisiones relacionadas:', {
        facturaId: selectedFactura.id,
        remisionId: selectedFactura.remisionId,
        remisionesIds: selectedFactura.remisionesIds,
        totalRemisiones: remisiones.length,
        remisionesConFacturaId: remisiones.filter(r => r.facturaId).map(r => ({ id: r.id, facturaId: r.facturaId, numeroRemision: r.numeroRemision }))
      });
    }

    const pedido = remisionesRelacionadas.length > 0 ? pedidos.find(p => p.id === remisionesRelacionadas[0].pedidoId) : null;

    // Obtener forma de pago: primero desde la factura, luego desde la cotización relacionada
    let formaPago = selectedFactura.formaPago;
    if (!formaPago && pedido && pedido.cotizacionId) {
      const cotizacion = cotizaciones.find(c => String(c.id) === String(pedido.cotizacionId));
      if (cotizacion && cotizacion.formaPago) {
        formaPago = cotizacion.formaPago;
      }
    }
    // Si aún no se encontró, usar la condición de pago del cliente como fallback
    if (!formaPago && cliente && cliente.condicionPago) {
      formaPago = cliente.condicionPago === 'Contado' ? '1' : '2';
    }
    // Normalizar valores antiguos '01'/'02' a nuevos '1'/'2' si es necesario
    if (formaPago) {
      formaPago = formaPago === '01' ? '1' : formaPago === '02' ? '2' : formaPago;
    }

    return { cliente, remisionesRelacionadas, pedido, formaPago };
  }, [selectedFactura, clientes, remisiones, pedidos, cotizaciones]);

  const selectedFacturaTotals = useMemo(() => {
    const defaultTotals = { subtotalBruto: 0, descuentoTotal: 0, subtotalNeto: 0, iva: 0, total: 0 };
    if (!selectedFactura) {
      return defaultTotals;
    }

    // Usar valor por defecto para evitar errores si items es undefined
    const itemsToCalculate: DocumentItem[] = selectedFactura.items || [];

    if (itemsToCalculate.length === 0) {
      return defaultTotals;
    }

    // IMPORTANTE: Usar valores del backend directamente, NO recalcular
    // El backend ya calculó correctamente todos los valores desde la BD
    const subtotalBruto = itemsToCalculate.reduce((acc, item) => acc + (item.precioUnitario * item.cantidad), 0);
    const descuentoTotal = itemsToCalculate.reduce((acc, item) => {
      const itemTotalBruto = item.precioUnitario * item.cantidad;
      return acc + (itemTotalBruto * ((item.descuentoPorcentaje || 0) / 100));
    }, 0);
    const subtotalNeto = subtotalBruto - descuentoTotal;
    // Usar valorIva directamente del backend (ya calculado desde BD), NO recalcular
    const iva = itemsToCalculate.reduce((acc, item) => {
      // Prioridad 1: usar valorIva del backend (ya calculado desde BD)
      if (item.valorIva !== undefined && item.valorIva !== null) {
        return acc + item.valorIva;
      }
      // Fallback: si no viene valorIva, usar subtotal del backend
      if (item.subtotal !== undefined && item.subtotal !== null) {
        // Calcular IVA desde subtotal y ivaPorcentaje del backend
        return acc + (item.subtotal * ((item.ivaPorcentaje || 0) / 100));
      }
      // Último fallback: calcular desde precio y cantidad (no debería llegar aquí)
      const itemSubtotal = (item.precioUnitario || 0) * (item.cantidad || 0) * (1 - (item.descuentoPorcentaje || 0) / 100);
      return acc + (itemSubtotal * ((item.ivaPorcentaje || 0) / 100));
    }, 0);
    const total = subtotalNeto + iva;

    return { subtotalBruto, descuentoTotal, subtotalNeto, iva, total };
  }, [selectedFactura]);

  const clienteForEmail = useMemo(() => {
    if (!facturaToEmail) return null;
    // Buscar cliente de forma flexible
    return clientes.find(c =>
      String(c.id) === String(facturaToEmail.clienteId) ||
      c.numeroDocumento === facturaToEmail.clienteId ||
      c.codter === facturaToEmail.clienteId
    ) || null;
  }, [facturaToEmail, clientes]);

  const handleToggleRemision = (remisionId: string) => {
    setSelectedRemisiones(prev => {
      const newSet = new Set(prev);
      const remision = remisionesPorFacturar.find(r => r.id === remisionId);
      if (!remision) return newSet;

      // Buscar cliente de la remisión actual de forma flexible
      const clienteRemision = clientes.find(c =>
        String(c.id) === String(remision.clienteId) ||
        c.numeroDocumento === remision.clienteId ||
        c.codter === remision.clienteId
      );

      // Buscar cliente de la primera remisión seleccionada de forma flexible
      const firstSelectedRemisionId = newSet.size > 0 ? newSet.values().next().value : null;
      const firstSelectedRemision = firstSelectedRemisionId ? remisionesPorFacturar.find(r => r.id === firstSelectedRemisionId) : null;
      const clienteSelected = firstSelectedRemision ? clientes.find(c =>
        String(c.id) === String(firstSelectedRemision.clienteId) ||
        c.numeroDocumento === firstSelectedRemision.clienteId ||
        c.codter === firstSelectedRemision.clienteId
      ) : null;

      if (newSet.has(remisionId)) {
        newSet.delete(remisionId);
      } else {
        // Comparar por ID interno del cliente, no por clienteId de la remisión
        if (!clienteSelected || (clienteRemision && clienteRemision.id === clienteSelected.id)) {
          newSet.add(remisionId);
        } else {
          addNotification({ message: "Solo puede seleccionar remisiones del mismo cliente.", type: 'warning' });
        }
      }
      return newSet;
    });
  };

  const handleFacturar = async () => {
    if (selectedRemisiones.size === 0) {
      addNotification({ message: "Seleccione al menos una remisión para facturar.", type: 'warning' });
      return;
    }

    if (isFacturando) {
      return; // Evitar múltiples llamadas simultáneas
    }

    setIsFacturando(true);

    try {
      const remisionIds = [...selectedRemisiones];

      // CRÍTICO: Cargar detalles de remisiones seleccionadas antes de facturar
      // Esto asegura que los items tengan precios desde el backend
      console.log('🔄 Cargando detalles de remisiones seleccionadas antes de facturar...');
      const remisionesConItems = await Promise.all(remisionIds.map(async (remisionId) => {
        const remisionExistente = remisiones.find(r => r.id === remisionId);
        if (!remisionExistente) {
          console.error(`❌ Remisión ${remisionId} no encontrada en estado local`);
          return null;
        }

        // Si la remisión ya tiene items cargados con precios, usarla tal cual
        if (remisionExistente.items && remisionExistente.items.length > 0) {
          const tienePrecios = remisionExistente.items.some(item =>
            item.precioUnitario && Number(item.precioUnitario) > 0
          );
          if (tienePrecios) {
            console.log(`✅ Remisión ${remisionId} ya tiene items con precios, no se recarga`);
            return remisionExistente;
          }
        }

        // Cargar detalles desde el backend
        try {
          const detallesRes = await apiClient.getRemisionDetalleById(remisionId);
          if (detallesRes.success && Array.isArray(detallesRes.data) && detallesRes.data.length > 0) {
            console.log(`✅ Detalles cargados para remisión ${remisionId}: ${detallesRes.data.length} items`);
            return {
              ...remisionExistente,
              items: detallesRes.data
            };
          } else {
            console.warn(`⚠️ No se pudieron cargar detalles para remisión ${remisionId}`);
            return remisionExistente;
          }
        } catch (error) {
          console.error(`❌ Error cargando detalles de remisión ${remisionId}:`, error);
          return remisionExistente;
        }
      }));

      // Filtrar remisiones nulas
      const remisionesValidas = remisionesConItems.filter(r => r !== null) as typeof remisiones;
      if (remisionesValidas.length === 0) {
        throw new Error('No se pudieron cargar las remisiones seleccionadas');
      }

      const firstRemision = remisionesValidas[0];
      // Buscar cliente de forma flexible
      const cliente = firstRemision ? clientes.find(c =>
        String(c.id) === String(firstRemision.clienteId) ||
        c.numeroDocumento === firstRemision.clienteId ||
        c.codter === firstRemision.clienteId
      ) : null;

      if (!cliente) {
        addNotification({
          message: `No se pudo encontrar el cliente de la remisión seleccionada.`,
          type: 'warning'
        });
        setIsFacturando(false);
        return;
      }

      if (!cliente.numeroDocumento) {
        addNotification({
          message: `El cliente ${cliente.nombreCompleto} no tiene un NIT/Cédula configurado.`,
          type: 'warning',
          link: { page: 'editar_cliente', params: { id: cliente.id } }
        });
        setIsFacturando(false);
        return;
      }

      // Validar que el cliente esté activo
      const activoValue = (String(cliente.activo) === 'true' || String(cliente.activo) === '1') ? 1 : 0;
      if (activoValue !== 1) {
        addNotification({
          message: `El cliente "${cliente.nombreCompleto}" está inactivo. No se puede facturar para clientes inactivos.`,
          type: 'warning',
          link: { page: 'editar_cliente', params: { id: cliente.id } }
        });
        setIsFacturando(false);
        return;
      }

      // Validar vendedor (opcional/warning)
      if (firstRemision.vendedorId) {
        // ... validation logic if needed, skipped for brevity ...
      }

      // Mostrar notificación de inicio
      addNotification({
        message: `🔄 Creando factura desde ${remisionIds.length} remisión(es)...`,
        type: 'info'
      });

      const result = await crearFacturaDesdeRemisiones(remisionIds);

      if (result) {
        const { nuevaFactura } = result;
        setSelectedRemisiones(new Set());
        await refreshFacturasYRemisiones();

        addNotification({
          message: `✅ Factura BORRADOR ${nuevaFactura.numeroFactura.replace('FAC-', '')} generada exitosamente. Las remisiones fueron eliminadas de "Remisiones Entregadas por Facturar" y la factura aparece en el historial. Revise y timbre para finalizar.`,
          type: 'success'
        });
        handleOpenDetailModal(nuevaFactura);
      } else {
        addNotification({
          message: "❌ Error al crear la factura. Por favor, intente nuevamente.",
          type: 'warning'
        });
      }
    } catch (error) {
      console.error('Error al facturar:', error);
      addNotification({
        message: `❌ Error al crear la factura: ${(error as Error).message || 'Error desconocido'}.`,
        type: 'warning'
      });
    } finally {
      setIsFacturando(false);
    }
  };

  const executeTimbrado = async (facturaId: string) => {
    console.log('🚀 [FRONTEND] ========== INICIO DE TIMBRADO ==========');
    try {
      addNotification({
        message: `🔄 Procesando timbrado de factura...`,
        type: 'info'
      });

      const facturaTimbrada = await timbrarFactura(facturaId);

      if (facturaTimbrada) {
        setSelectedFactura(facturaTimbrada);

        if (facturaTimbrada.estado === 'ENVIADA' && facturaTimbrada.cufe) {
          await refreshFacturasYRemisiones();
          addNotification({
            message: `✅ Factura ${facturaTimbrada.numeroFactura.replace('FAC-', '')} timbrada exitosamente.`,
            type: 'success'
          });
          setFacturaToPreview(null);
          handleCloseModals();
        } else if (facturaTimbrada.estado === 'RECHAZADA') {
          addNotification({
            message: `❌ Factura ${facturaTimbrada.numeroFactura.replace('FAC-', '')} fue rechazada.`,
            type: 'warning'
          });
        } else {
          addNotification({
            message: `✅ Factura ${facturaTimbrada.numeroFactura.replace('FAC-', '')} timbrada con éxito.`,
            type: 'success'
          });
          setFacturaToPreview(null);
          handleCloseModals();
        }
      } else {
        addNotification({ message: "Error al timbrar la factura.", type: 'warning' });
        throw new Error("No se recibió respuesta del timbrado.");
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Error al timbrar:', error);
      addNotification({
        message: `Error al timbrar la factura: ${(error as Error).message || 'Error desconocido'}.`,
        type: 'warning'
      });
      throw error;
    }
  };

  const handleOpenDetailModal = async (factura: Factura) => {
    // Si la factura no tiene items o tiene items vacíos, cargar los detalles
    let facturaConItems = factura;
    if (!factura.items || factura.items.length === 0) {
      try {
        const facturasDetalleRes = await fetchFacturasDetalle(String(factura.id));
        if (facturasDetalleRes.success && Array.isArray(facturasDetalleRes.data)) {
          const items = facturasDetalleRes.data.filter((d: any) => {
            const detalleFacturaId = String(d.facturaId || '');
            const facturaIdStr = String(factura.id || '');
            return detalleFacturaId === facturaIdStr ||
              String(factura.id) === String(d.facturaId) ||
              Number(factura.id) === Number(d.facturaId);
          });

          facturaConItems = {
            ...factura,
            items: items.length > 0 ? items : []
          };
        }
      } catch (error) {
        console.error('Error cargando detalles de factura:', error);
      }
    }

    setSelectedFactura(facturaConItems);
    setIsDetailModalOpen(true);
  };

  const handleCloseModals = () => {
    setSelectedFactura(null);
    setIsDetailModalOpen(false);
    if (params?.focusId || params?.highlightId) {
      const { focusId: _focus, highlightId: _highlight, ...rest } = params;
      setPage('facturacion_electronica', rest);
    }
  }

  // Función para re-facturar una factura rechazada
  const handleRefacturar = async () => {
    if (!selectedFactura || selectedFactura.estado !== 'RECHAZADA') {
      addNotification({
        message: 'Solo se puede re-facturar facturas rechazadas.',
        type: 'warning'
      });
      return;
    }

    console.log('[Refacturar] Iniciando proceso de re-facturación para factura:', selectedFactura.id);

    // Buscar remisiones relacionadas usando la misma lógica que remisionesRelacionadas
    let remisionesParaRefacturar: Remision[] = [];

    // 1. Intentar con remisionesIds (array de IDs)
    const remisionesIds = selectedFactura.remisionesIds || [];
    if (remisionesIds.length > 0) {
      remisionesParaRefacturar = remisiones.filter(r =>
        remisionesIds.some(id => String(r.id) === String(id))
      );
      console.log('[Refacturar] Remisiones encontradas por remisionesIds:', remisionesParaRefacturar.length);
    }

    // 2. Si no se encontraron, intentar con remisionId (singular)
    if (remisionesParaRefacturar.length === 0 && selectedFactura.remisionId) {
      const remisionEncontrada = remisiones.find(r =>
        String(r.id) === String(selectedFactura.remisionId)
      );
      if (remisionEncontrada) {
        remisionesParaRefacturar = [remisionEncontrada];
        console.log('[Refacturar] Remisión encontrada por remisionId:', remisionEncontrada.id);
      }
    }

    // 3. Si aún no se encontraron, buscar por facturaId en las remisiones (búsqueda inversa)
    if (remisionesParaRefacturar.length === 0 && selectedFactura.id) {
      remisionesParaRefacturar = remisiones.filter(r => {
        const remisionFacturaId = r.facturaId ? String(r.facturaId) : null;
        const facturaId = String(selectedFactura.id);
        return remisionFacturaId === facturaId;
      });
      console.log('[Refacturar] Remisiones encontradas por facturaId:', remisionesParaRefacturar.length);
    }

    // 4. Si aún no se encontraron, intentar parsear las observaciones
    if (remisionesParaRefacturar.length === 0 && selectedFactura.observaciones) {
      try {
        const obs = selectedFactura.observaciones;
        // Formato esperado: "Factura consolidada de X remisión(es): REM-001, REM-002"
        if (obs.includes('remisión(es):')) {
          const parts = obs.split('remisión(es):');
          if (parts.length > 1) {
            const remisionesStr = parts[1].trim();
            // Eliminar "..." si fue truncado
            const cleanRemisionesStr = remisionesStr.replace('...', '');
            const numerosRemision = cleanRemisionesStr.split(',').map(s => s.trim());

            if (numerosRemision.length > 0) {
              remisionesParaRefacturar = remisiones.filter(r =>
                numerosRemision.includes(r.numeroRemision)
              );
              console.log('[Refacturar] Remisiones encontradas por observaciones:', remisionesParaRefacturar.length, numerosRemision);
            }
          }
        }
      } catch (parseError) {
        console.error('[Refacturar] Error parseando observaciones:', parseError);
      }
    }

    // Verificar que se encontraron remisiones
    if (remisionesParaRefacturar.length === 0) {
      console.error('[Refacturar] No se encontraron remisiones relacionadas:', {
        facturaId: selectedFactura.id,
        remisionId: selectedFactura.remisionId,
        remisionesIds: selectedFactura.remisionesIds,
        totalRemisiones: remisiones.length
      });
      addNotification({
        message: 'No se encontraron remisiones relacionadas con esta factura rechazada. Por favor, verifique que las remisiones existan.',
        type: 'warning'
      });
      return;
    }

    // Verificar que las remisiones estén en estado ENTREGADO y disponibles
    const remisionesDisponibles = remisionesParaRefacturar.filter(r => {
      const estadoStr = String(r.estado || '').trim().toUpperCase();
      const estadoCorrecto = estadoStr === 'ENTREGADO' || estadoStr === 'D';
      // Permitir remisiones que tengan facturaId igual a la factura rechazada (para poder re-facturarlas)
      const facturaIdCorrecto = !r.facturaId || String(r.facturaId) === String(selectedFactura.id);
      return estadoCorrecto && facturaIdCorrecto;
    });

    if (remisionesDisponibles.length === 0) {
      console.error('[Refacturar] No hay remisiones disponibles para re-facturar:', {
        remisionesEncontradas: remisionesParaRefacturar.length,
        estados: remisionesParaRefacturar.map(r => r.estado),
        facturaIds: remisionesParaRefacturar.map(r => r.facturaId)
      });
      addNotification({
        message: 'Las remisiones de esta factura no están disponibles para re-facturar. Verifique que estén en estado ENTREGADO.',
        type: 'warning'
      });
      return;
    }

    console.log('[Refacturar] Remisiones disponibles para re-facturar:', remisionesDisponibles.length);

    setIsFacturando(true);

    try {
      addNotification({
        message: `🔄 Creando nueva factura desde ${remisionesDisponibles.length} remisión(es) de la factura rechazada...`,
        type: 'info'
      });

      // Cargar detalles de remisiones antes de facturar
      const remisionesConItems = await Promise.all(remisionesDisponibles.map(async (remision) => {
        if (remision.items && remision.items.length > 0) {
          const tienePrecios = remision.items.some(item =>
            item.precioUnitario && Number(item.precioUnitario) > 0
          );
          if (tienePrecios) {
            console.log(`[Refacturar] Remisión ${remision.id} ya tiene items con precios`);
            return remision;
          }
        }

        try {
          console.log(`[Refacturar] Cargando detalles de remisión ${remision.id}...`);
          const detallesRes = await apiClient.getRemisionDetalleById(remision.id);
          if (detallesRes.success && Array.isArray(detallesRes.data) && detallesRes.data.length > 0) {
            console.log(`[Refacturar] Detalles cargados para remisión ${remision.id}: ${detallesRes.data.length} items`);
            return {
              ...remision,
              items: detallesRes.data
            };
          } else {
            console.warn(`[Refacturar] No se pudieron cargar detalles para remisión ${remision.id}`);
          }
        } catch (error) {
          console.error(`[Refacturar] Error cargando detalles de remisión ${remision.id}:`, error);
        }
        return remision;
      }));

      console.log('[Refacturar] Creando factura desde remisiones:', remisionesDisponibles.map(r => r.id));
      const result = await crearFacturaDesdeRemisiones(remisionesDisponibles.map(r => r.id));

      if (result) {
        const { nuevaFactura } = result;
        console.log('[Refacturar] Nueva factura creada:', nuevaFactura.numeroFactura);

        // Refrescar facturas y remisiones
        await refreshFacturasYRemisiones();

        // Cerrar el modal de la factura rechazada
        handleCloseModals();

        addNotification({
          message: `✅ Nueva factura BORRADOR ${nuevaFactura.numeroFactura.replace('FAC-', '')} creada desde la factura rechazada. Revise y timbre para finalizar.`,
          type: 'success'
        });

        // Abrir el modal de la nueva factura después de un breve delay
        setTimeout(() => {
          handleOpenDetailModal(nuevaFactura);
        }, 500);
      } else {
        console.error('[Refacturar] Error: No se recibió respuesta al crear la factura');
        addNotification({
          message: "❌ Error al crear la nueva factura. Por favor, intente nuevamente.",
          type: 'warning'
        });
      }
    } catch (error) {
      console.error('[Refacturar] Error al re-facturar:', error);
      addNotification({
        message: `❌ Error al crear la nueva factura: ${(error as Error).message || 'Error desconocido'}.`,
        type: 'warning'
      });
    } finally {
      setIsFacturando(false);
    }
  };

  const handleDownloadXML = (factura: Factura) => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
    <ID>${factura.numeroFactura}</ID>
    <UUID>${factura.cufe}</UUID>
    <IssueDate>${factura.fechaFactura}</IssueDate>
    <Note>Factura generada por ERP360 Comercial</Note>
</Invoice>`;
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${factura.numeroFactura}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    addNotification({ message: `XML de ${factura.numeroFactura.replace('FAC-', '')} descargado.`, type: 'info' });
  };

  const handleDescargarAdjunto = async (facturaId: string) => {
    const adjunto = archivosAdjuntos.find(a => a.entidadId === facturaId && a.entidadTipo === 'FACTURA');
    if (!adjunto) {
      addNotification({ message: 'No se encontró el archivo adjunto para esta factura.', type: 'warning' });
      return;
    }

    addNotification({ message: `Descargando ${adjunto.nombreArchivo}...`, type: 'info' });

    addNotification({ message: 'Descarga de adjuntos no disponible aún. Se implementará vía backend.', type: 'info' });
  };

  const handleSendEmail = (factura: Factura) => {
    setFacturaToEmail(factura);
  };

  const handleConfirmSendEmail = async (emailData: { to: string; subject: string; body: string }) => {
    if (!facturaToEmail) return;

    const subjectEncoded = encodeURIComponent(emailData.subject);
    const bodyEncoded = encodeURIComponent(emailData.body);
    const mailtoLink = `mailto:${emailData.to}?subject=${subjectEncoded}&body=${bodyEncoded}`;

    window.location.href = mailtoLink;

    addNotification({
      message: `Se ha abierto tu cliente de correo para enviar la factura ${facturaToEmail.numeroFactura.replace('FAC-', '')} a ${emailData.to}.`,
      type: 'success',
    });
    setFacturaToEmail(null);
  };

  const totalAFacturar = useMemo(() => {
    if (selectedRemisiones.size === 0) return 0;
    const remisionesSeleccionadas = remisiones.filter(r => selectedRemisiones.has(r.id));
    return remisionesSeleccionadas.reduce((total, rem) => {
      return total + rem.items.reduce((sum, item) => {
        // Si el item tiene total, usarlo directamente (ya incluye IVA)
        // Si no, calcular: subtotal + IVA
        if (item.total && item.total > 0) {
          return sum + item.total;
        }
        // Calcular manualmente si falta total
        const subtotal = (item.precioUnitario || 0) * (item.cantidad || (item as any).cantidadEnviada || 0) * (1 - ((item.descuentoPorcentaje || 0) / 100));
        const valorIva = subtotal * ((item.ivaPorcentaje || 0) / 100);
        return sum + subtotal + valorIva;
      }, 0);
    }, 0);
  }, [selectedRemisiones, remisiones]);


  const remisionesColumns: Column<Remision>[] = [
    {
      header: '✓', accessor: 'id', cell: (item) => {
        const isSelected = selectedRemisiones.has(item.id);
        // Buscar cliente de forma flexible para comparar
        const clienteItem = clientes.find(c =>
          String(c.id) === String(item.clienteId) ||
          c.numeroDocumento === item.clienteId ||
          c.codter === item.clienteId
        );
        const clienteSelected = selectedClientId ? clientes.find(c =>
          String(c.id) === String(selectedClientId) ||
          c.numeroDocumento === selectedClientId ||
          c.codter === selectedClientId
        ) : null;
        const isSelectable = !selectedClientId ||
          (clienteItem && clienteSelected && clienteItem.id === clienteSelected.id);

        return (
          <div
            className={`flex items-center justify-center transition-all duration-200 ${!isSelectable && !isSelected ? 'opacity-30 grayscale' : ''}`}
            title={!isSelectable && !isSelected ? 'Solo se pueden facturar remisiones del mismo cliente.' : 'Seleccionar para facturar'}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleToggleRemision(item.id)}
              disabled={!isSelectable && !isSelected}
              className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed cursor-pointer transition-colors"
            />
          </div>
        );
      }
    },
    {
      header: 'Remisión',
      accessor: 'numeroRemision',
      cell: (item) => (
        <div className="flex flex-col">
          <button
            onClick={() => handlePreviewRemision(item)}
            className="font-bold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 text-left transition-colors"
          >
            {item.numeroRemision.replace('REM-', '')}
          </button>
          <span className="text-xs text-slate-500">{formatDateOnly(item.fechaRemision)}</span>
        </div>
      )
    },
    {
      header: 'Pedido',
      accessor: 'pedidoId',
      cell: (item) => {
        const pedido = pedidos.find(p => p.id === item.pedidoId);
        return pedido ? (
          <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            {pedido.numeroPedido.replace('PED-', '')}
          </span>
        ) : <span className="text-slate-400 italic text-xs">N/A</span>;
      }
    },
    {
      header: 'Cliente',
      accessor: 'clienteId',
      cell: (item) => {
        const cliente = clientes.find(c =>
          String(c.id) === String(item.clienteId) ||
          c.numeroDocumento === item.clienteId ||
          c.codter === item.clienteId
        );
        return (
          <div className="flex flex-col max-w-[200px]">
            <span className="font-medium text-slate-700 dark:text-slate-200 truncate" title={cliente?.nombreCompleto}>
              {cliente?.nombreCompleto || 'N/A'}
            </span>
            <span className="text-xs text-slate-500 truncate">{cliente?.numeroDocumento}</span>
          </div>
        );
      }
    },
    {
      header: 'Cond. Pago',
      accessor: 'clienteId',
      cell: (item) => {
        const cliente = clientes.find(c =>
          String(c.id) === String(item.clienteId) ||
          c.numeroDocumento === item.clienteId ||
          c.codter === item.clienteId
        );
        const isContado = cliente?.condicionPago === 'Contado';
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isContado
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            }`}>
            {isContado ? 'Contado' : 'Crédito'}
          </span>
        );
      }
    },
    {
      header: 'Total Pedido',
      accessor: 'total',
      cell: (item) => {
        let valor = 0;
        if (item.total && item.total > 0) {
          valor = item.total;
        } else if (item.items && item.items.length > 0) {
          valor = item.items.reduce((sum: number, itemRem: any) => {
            if (itemRem.total && itemRem.total > 0) return sum + itemRem.total;
            const subtotal = (itemRem.precioUnitario || 0) * (itemRem.cantidad || (itemRem as any).cantidadEnviada || 0) * (1 - ((itemRem.descuentoPorcentaje || 0) / 100));
            const valorIva = subtotal * ((itemRem.ivaPorcentaje || 0) / 100);
            return sum + subtotal + valorIva;
          }, 0);
        }

        return (
          <div className="font-mono font-semibold text-slate-700 dark:text-slate-200">
            {formatCurrency(valor)}
          </div>
        );
      }
    },
    {
      header: 'Acciones',
      accessor: 'id',
      cell: (item) => (
        <button
          onClick={() => handlePreviewRemision(item)}
          disabled={isLoadingRemision}
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
          title="Ver PDF"
        >
          <i className="fas fa-file-pdf"></i>
        </button>
      )
    }
  ];

  const facturasColumns: Column<Factura>[] = [
    {
      header: 'Número',
      accessor: 'numeroFactura',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold font-mono text-slate-700 dark:text-slate-200">{item.numeroFactura.replace('FAC-', '')}</span>
          {item.documentoContable && (
            <span className="text-[10px] text-slate-400 font-mono">{item.documentoContable}</span>
          )}
        </div>
      )
    },
    {
      header: 'Cliente',
      accessor: 'clienteId',
      cell: (item) => {
        const cliente = clientes.find(c =>
          String(c.id) === String(item.clienteId) ||
          c.numeroDocumento === item.clienteId ||
          c.codter === item.clienteId
        );
        return (
          <div className="flex flex-col max-w-[200px]">
            <span className="font-medium text-slate-700 dark:text-slate-200 truncate" title={cliente?.nombreCompleto}>
              {cliente?.nombreCompleto || 'N/A'}
            </span>
            <span className="text-xs text-slate-500 truncate">{cliente?.numeroDocumento}</span>
          </div>
        );
      }
    },
    {
      header: 'Fecha',
      accessor: 'fechaFactura',
      cell: (item) => (
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {formatDateOnly(item.fechaFactura)}
        </div>
      )
    },
    {
      header: 'Total',
      accessor: 'total',
      cell: (item) => (
        <div className="font-mono font-bold text-slate-700 dark:text-slate-200">
          {formatCurrency(item.total)}
        </div>
      )
    },
    {
      header: 'Pago',
      accessor: 'formaPago',
      cell: (item) => {
        let formaPagoFactura = item.formaPago;
        if (!formaPagoFactura) {
          // 1. Intentar buscar en cadena: Remisión -> Pedido -> Cotización
          const remisionRelacionada = remisiones.find(r =>
            (item.remisionesIds && item.remisionesIds.includes(r.id)) ||
            r.facturaId === item.id
          );
          if (remisionRelacionada && remisionRelacionada.pedidoId) {
            const pedidoRelacionado = pedidos.find(p => p.id === remisionRelacionada.pedidoId);
            if (pedidoRelacionado && pedidoRelacionado.cotizacionId) {
              const cotizacion = cotizaciones.find(c => c.id === pedidoRelacionado.cotizacionId);
              if (cotizacion && cotizacion.formaPago) {
                formaPagoFactura = cotizacion.formaPago;
              }
            }
          }

          // 2. Si aún no se encuentra, intentar inferir del Cliente
          if (!formaPagoFactura && item.clienteId) {
            const cliente = clientes.find(c =>
              String(c.id) === String(item.clienteId) ||
              c.numeroDocumento === item.clienteId ||
              c.codter === item.clienteId
            );
            if (cliente) {
              // Si tiene días de crédito > 0 o dice Crédito, asume Crédito (2). Si no, Contado (1).
              if ((cliente.diasCredito && cliente.diasCredito > 0) ||
                (cliente.condicionPago && cliente.condicionPago.toLowerCase().includes('crédito'))) {
                formaPagoFactura = '2';
              } else {
                formaPagoFactura = '1';
              }
            }
          }
        }
        if (!formaPagoFactura) return <span className="text-slate-400">-</span>;

        const formaPagoValue = formaPagoFactura === '01' ? '1' : formaPagoFactura === '02' ? '2' : formaPagoFactura;
        const isContado = formaPagoValue === '1';

        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${isContado
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
            : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800'
            }`}>
            {isContado ? 'Contado' : 'Crédito'}
          </span>
        );
      }
    },
    {
      header: 'Estado',
      accessor: 'estado',
      cell: (item) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={item.cufe ? 'ACEPTADA' : item.estado as any} />
          {item.estado === 'RECHAZADA' && item.motivoRechazo && (
            <div className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 max-w-[150px] truncate" title={item.motivoRechazo}>
              <i className="fas fa-exclamation-circle"></i>
              <span>{item.motivoRechazo}</span>
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Acciones',
      accessor: 'id',
      cell: (item) => (
        <button
          onClick={() => handleOpenDetailModal(item)}
          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
          title="Ver detalles"
        >
          <i className="fas fa-eye"></i>
        </button>
      )
    },
  ];

  const additionalInvoiceFilters = (
    <div className="flex items-center gap-2">
      <div className="relative">
        <select
          id="statusFilter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="appearance-none pl-3 pr-8 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          {filterOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-500">
          <i className="fas fa-chevron-down text-xs"></i>
        </div>
      </div>
    </div>
  );

  return (
    <PageContainer>
      <SectionHeader
        title="Gestión de Facturas"
        subtitle="Administra y da seguimiento a las facturas electrónicas."
      />

      {/* Sección: Remisiones Pendientes */}
      <section>
        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
          <CardHeader className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/50 pb-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg text-slate-800 dark:text-slate-100">
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-2 rounded-lg">
                    <i className="fas fa-file-invoice"></i>
                  </span>
                  Remisiones Entregadas por Facturar
                </CardTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 ml-11">
                  Seleccione remisiones del mismo cliente para consolidar.
                </p>
              </div>

              <ProtectedComponent permission="facturacion:create">
                <button
                  onClick={handleFacturar}
                  disabled={selectedRemisiones.size === 0 || isFacturando}
                  className={`
                    relative overflow-hidden group px-6 py-2 rounded-xl font-medium text-sm transition-all duration-300
                    ${selectedRemisiones.size > 0 && !isFacturando
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:shadow-blue-600/40 hover:-translate-y-0.5'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'}
                  `}
                >
                  <div className="flex items-center gap-2 relative z-10">
                    {isFacturando ? (
                      <>
                        <i className="fas fa-circle-notch fa-spin"></i>
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-magic"></i>
                        <span>Generar Factura ({selectedRemisiones.size})</span>
                        {totalAFacturar > 0 && (
                          <span className="bg-blue-500/20 px-2 py-0.5 rounded text-xs border border-blue-400/20">
                            {formatCurrency(totalAFacturar)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </button>
              </ProtectedComponent>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              <Table
                columns={remisionesColumns}
                data={remisionesPorFacturar}
                onSort={() => { }}
                sortConfig={{ key: null, direction: 'asc' }}
                highlightRowId={undefined}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Sección: Historial de Facturas */}
      <section>
        <Card className="shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <CardHeader className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg text-slate-800 dark:text-slate-100">
                <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 p-2 rounded-lg">
                  <i className="fas fa-history"></i>
                </span>
                Historial de Facturas
              </CardTitle>
            </div>
          </CardHeader>

          <div className="p-2 sm:p-3 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
            <TableToolbar
              searchTerm={searchTermInvoices}
              onSearchChange={handleSearchInvoices}
              additionalFilters={additionalInvoiceFilters}
              placeholder="Buscar por número, cliente..."
            />
          </div>

          <CardContent className="p-0">
            <Table
              columns={facturasColumns}
              data={paginatedInvoices}
              onSort={requestSortInvoices}
              sortConfig={sortConfigInvoices}
              highlightRowId={params?.highlightId ?? params?.focusId}
              isLoading={loadingInvoices}
            />
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
      </section>

      {selectedFactura && cliente && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={handleCloseModals}
          title={`Detalle Factura: ${selectedFactura.numeroFactura.replace('FAC-', '')}`}
          size="3xl"
        >
          <div className="space-y-6 text-sm">
            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h4 className="font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Facturado a</h4>
                <p className="font-bold text-slate-800 dark:text-slate-100">{cliente.nombreCompleto}</p>
                <p className="text-slate-600 dark:text-slate-300">{cliente.tipoDocumentoId}: {cliente.numeroDocumento}</p>
                <p className="text-slate-600 dark:text-slate-300 mt-1">{cliente.telefono}</p>
                <p className="text-slate-600 dark:text-slate-300">{cliente.email}</p>
              </div>
              <div className="text-right">
                <StatusBadge status={selectedFactura.cufe ? 'ACEPTADA' : selectedFactura.estado as any} />
                <p className="text-slate-600 dark:text-slate-300 mt-2">
                  <span className="font-semibold">Fecha Emisión:</span> {formatDateOnly(selectedFactura.fechaFactura)}
                </p>
                {(selectedFactura.formaPago || formaPago) && (
                  <p className="text-slate-600 dark:text-slate-300 mt-1">
                    <span className="font-semibold">Forma de Pago:</span> {
                      (() => {
                        const formaPagoValue = selectedFactura.formaPago || formaPago;
                        const normalizedValue = formaPagoValue === '01' ? '1' : formaPagoValue === '02' ? '2' : formaPagoValue;
                        return normalizedValue === '1' ? 'Contado' : normalizedValue === '2' ? 'Crédito' : normalizedValue;
                      })()
                    }
                  </p>
                )}
              </div>
            </div>

            {/* Fiscal and Related Docs Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedFactura.cufe || selectedFactura.estado === 'ENVIADA' ? (
                <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="fas fa-check-circle text-green-600 dark:text-green-400 fa-lg"></i>
                    <h5 className="font-semibold text-green-800 dark:text-green-300">Factura Timbrada</h5>
                  </div>
                  <div className="space-y-1">
                    {selectedFactura.cufe ? (
                      <>
                        <p><span className="font-semibold text-slate-600 dark:text-slate-400">CUFE:</span></p>
                        <p className="font-mono text-xs break-all bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-600">{selectedFactura.cufe}</p>
                        <p className="mt-2"><span className="font-semibold text-slate-600 dark:text-slate-400">Fecha Timbrado:</span> <span>{formatDateOnly(selectedFactura.fechaTimbrado || new Date().toISOString())}</span></p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-600 dark:text-slate-400">Factura enviada y timbrada correctamente.</p>
                    )}
                  </div>
                </div>
              ) : selectedFactura.estado === 'RECHAZADA' ? (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700">
                  <div className="flex items-start gap-3">
                    <i className="fas fa-times-circle text-red-500 fa-lg mt-1"></i>
                    <div className="flex-1">
                      <h5 className="font-semibold text-red-800 dark:text-red-300 mb-2">Factura Rechazada</h5>
                      <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                        La factura fue rechazada en el proceso de timbrado.
                      </p>
                      {selectedFactura.motivoRechazo && (
                        <div className="mt-2 p-2 bg-white dark:bg-slate-800 rounded border border-red-300 dark:border-red-600">
                          <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-1">Motivo del rechazo:</p>
                          <p className="text-xs text-red-700 dark:text-red-400">{selectedFactura.motivoRechazo}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-700 flex items-center gap-3">
                  <i className="fas fa-exclamation-triangle text-yellow-500 fa-lg"></i>
                  <div>
                    <h5 className="font-semibold text-yellow-800 dark:text-yellow-300">Factura no Timbrada</h5>
                    <p className="text-xs">Este documento es un borrador y no tiene validez fiscal.</p>
                  </div>
                </div>
              )}
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <h5 className="font-semibold text-slate-800 dark:text-slate-300 mb-2">Documentos Relacionados</h5>
                <div className="space-y-1">
                  <p><span className="font-semibold text-slate-600 dark:text-slate-400">Pedido:</span> <span>{(pedido?.numeroPedido || 'Venta Directa').replace('PED-', '')}</span></p>
                  <p><span className="font-semibold text-slate-600 dark:text-slate-400">Remisiones:</span> <span>{remisionesRelacionadas.map(r => r.numeroRemision.replace('REM-', '')).join(', ') || 'N/A'}</span></p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">Detalle de Factura</h4>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Referencia</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase w-2/5 whitespace-nowrap">Producto</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Unidad</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Cant.</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Precio Unit.</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Desc. %</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">IVA %</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Subtotal</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase whitespace-nowrap">Valor IVA</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                    {(selectedFactura.items || []).map((item: DocumentItem) => {
                      const producto = productos.find(p => p.id === item.productoId);
                      // IMPORTANTE: Usar valores del backend directamente, NO recalcular
                      // Prioridad 1: usar subtotal del backend (ya calculado desde BD)
                      // Prioridad 2: calcular desde precio y cantidad si no viene subtotal
                      const itemSubtotal = item.subtotal !== undefined && item.subtotal !== null
                        ? item.subtotal
                        : (item.precioUnitario || 0) * (item.cantidad || 0) * (1 - (item.descuentoPorcentaje || 0) / 100);
                      // Prioridad 1: usar valorIva del backend (ya calculado desde BD)
                      // Prioridad 2: calcular desde subtotal y ivaPorcentaje del backend
                      // NO recalcular desde cero, usar valores del backend
                      const itemIva = item.valorIva !== undefined && item.valorIva !== null
                        ? item.valorIva
                        : itemSubtotal * ((item.ivaPorcentaje || 0) / 100);
                      return (
                        <tr key={item.productoId} className="text-sm">
                          <td className="px-4 py-2 whitespace-nowrap font-mono text-slate-500">{producto?.referencia || 'N/A'}</td>
                          <td className="px-4 py-2 whitespace-nowrap font-semibold">{item.descripcion}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{producto?.unidadMedida}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-right">{item.cantidad}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-right">{formatCurrency(item.precioUnitario)}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-right text-red-600">{item.descuentoPorcentaje.toFixed(2)}%</td>
                          <td className="px-4 py-2 whitespace-nowrap text-right">{item.ivaPorcentaje?.toFixed(2) || '0.00'}%</td>
                          <td className="px-4 py-2 whitespace-nowrap font-semibold text-right">{formatCurrency(itemSubtotal)}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-right">{formatCurrency(itemIva)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="w-full max-w-sm space-y-2 text-slate-700 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>Subtotal Bruto</span>
                  <span>{formatCurrency(selectedFacturaTotals.subtotalBruto)}</span>
                </div>
                <div className="flex justify-between text-red-600 dark:text-red-500">
                  <span>Descuento</span>
                  <span>-{formatCurrency(selectedFacturaTotals.descuentoTotal)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-slate-300 dark:border-slate-600 pt-2 mt-2">
                  <span>Subtotal Neto</span>
                  <span>{formatCurrency(selectedFacturaTotals.subtotalNeto)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA ({(() => {
                    // Calcular porcentaje de IVA promedio desde los items del backend
                    if (selectedFactura.items && selectedFactura.items.length > 0 && selectedFacturaTotals.subtotalNeto > 0) {
                      const ivaPorcentajePromedio = (selectedFacturaTotals.iva / selectedFacturaTotals.subtotalNeto) * 100;
                      // Redondear a porcentajes estándar (19%, 8%, 5%, 0%)
                      if (Math.abs(ivaPorcentajePromedio - 19) < 1) return '19';
                      if (Math.abs(ivaPorcentajePromedio - 8) < 1) return '8';
                      if (Math.abs(ivaPorcentajePromedio - 5) < 1) return '5';
                      if (ivaPorcentajePromedio < 0.5) return '0';
                      // Si no es estándar, mostrar con 2 decimales
                      return ivaPorcentajePromedio.toFixed(2);
                    }
                    // Fallback: usar ivaPorcentaje del primer item del backend
                    return selectedFactura.items?.[0]?.ivaPorcentaje?.toFixed(2) || '19';
                  })()}%)</span>
                  <span>{formatCurrency(selectedFacturaTotals.iva)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t-2 border-slate-400 dark:border-slate-500 pt-2 mt-2 text-blue-600 dark:text-blue-400">
                  <span>TOTAL</span>
                  <span>{formatCurrency(selectedFacturaTotals.total)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap justify-end gap-3">
              {selectedFactura.estado === 'BORRADOR' ? (
                <ProtectedComponent permission="facturacion:stamp">
                  <button onClick={() => setFacturaToPreview(selectedFactura)} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors">
                    <i className="fas fa-stamp mr-2"></i>Autorizar y Timbrar Factura
                  </button>
                </ProtectedComponent>
              ) : selectedFactura.estado === 'RECHAZADA' ? (
                <>
                  <ProtectedComponent permission="facturacion:create">
                    <button
                      onClick={handleRefacturar}
                      disabled={isFacturando}
                      className="px-4 py-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors disabled:bg-slate-400"
                    >
                      {isFacturando ? (
                        <><i className="fas fa-spinner fa-spin mr-2"></i>Creando nueva factura...</>
                      ) : (
                        <><i className="fas fa-redo mr-2"></i>Volver a Facturar</>
                      )}
                    </button>
                  </ProtectedComponent>
                  {archivosAdjuntos.some(a => a.entidadId === selectedFactura.id && a.entidadTipo === 'FACTURA') ? (
                    <button onClick={() => handleDescargarAdjunto(selectedFactura.id)} className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700">
                      <i className="fas fa-paperclip mr-2"></i>Descargar PDF
                    </button>
                  ) : (
                    <button onClick={() => setFacturaToPreview(selectedFactura)} className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700">
                      <i className="fas fa-file-pdf mr-2"></i>Generar PDF
                    </button>
                  )}
                  <button onClick={() => handleDownloadXML(selectedFactura)} className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700"><i className="fas fa-file-code mr-2"></i>Descargar XML</button>
                </>
              ) : (
                <>
                  {archivosAdjuntos.some(a => a.entidadId === selectedFactura.id && a.entidadTipo === 'FACTURA') ? (
                    <button onClick={() => handleDescargarAdjunto(selectedFactura.id)} className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700">
                      <i className="fas fa-paperclip mr-2"></i>Descargar PDF
                    </button>
                  ) : (
                    <button onClick={() => setFacturaToPreview(selectedFactura)} className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700">
                      <i className="fas fa-file-pdf mr-2"></i>Generar PDF
                    </button>
                  )}
                  <button onClick={() => handleDownloadXML(selectedFactura)} className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700"><i className="fas fa-file-code mr-2"></i>Descargar XML</button>
                  <button onClick={() => handleSendEmail(selectedFactura)} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"><i className="fas fa-paper-plane mr-2"></i>Enviar Correo</button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
      {facturaToPreview && (
        <FacturaPreviewModal
          factura={facturaToPreview}
          onClose={() => setFacturaToPreview(null)}
          onTimbrar={executeTimbrado}
        />
      )}
      {facturaToEmail && clienteForEmail && (
        <SendEmailModal
          isOpen={!!facturaToEmail}
          onClose={() => setFacturaToEmail(null)}
          onSend={handleConfirmSendEmail}
          to={clienteForEmail.email}
          subject={`Factura ${facturaToEmail.numeroFactura} de ${datosEmpresa.nombre}`}
          body={
            `Estimado/a ${clienteForEmail.nombreCompleto},

Nos complace adjuntar su factura electrónica N° ${facturaToEmail.numeroFactura} correspondiente a su reciente compra.
El documento se encuentra adjunto para su revisión y registro. Si tiene alguna pregunta, no dude en contactarnos.

Atentamente,
El equipo de ${datosEmpresa.nombre}`
          }
        />
      )}
      {remisionToPreview && (
        <RemisionPreviewModal
          remision={remisionToPreview}
          onClose={() => setRemisionToPreview(null)}
        />
      )}
    </PageContainer>
  );
};

export default FacturasPage;