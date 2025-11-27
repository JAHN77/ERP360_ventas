import React, { useState, useMemo, useEffect } from 'react';
import Table, { Column } from '../components/ui/Table';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Factura, Remision, DocumentItem } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import { useTable } from '../hooks/useTable';
// FIX: Module '"file:///components/ui/TableToolbar"' has no default export.
import { TableToolbar } from '../components/ui/TableToolbar';
import TablePagination from '../components/ui/TablePagination';
import { useNotifications } from '../hooks/useNotifications';
import FacturaPreviewModal from '../components/facturacion/FacturaPreviewModal';
import SendEmailModal from '../components/comercial/SendEmailModal';
import ProtectedComponent from '../components/auth/ProtectedComponent';
import { useData } from '../hooks/useData';
import { useNavigation } from '../hooks/useNavigation';
import { formatDateOnly } from '../utils/formatters';
import { fetchFacturasDetalle, apiClient } from '../services/apiClient';
// Supabase eliminado: descargas de adjuntos se implementarán vía backend

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
  const { facturas, remisiones, clientes, pedidos, cotizaciones, crearFacturaDesdeRemisiones, timbrarFactura, datosEmpresa, archivosAdjuntos, productos, vendedores, refreshFacturasYRemisiones } = useData();
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [selectedRemisiones, setSelectedRemisiones] = useState<Set<string>>(new Set());
  const { addNotification } = useNotifications();
  
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null);
  const [isStamping, setIsStamping] = useState(false);
  const [isFacturando, setIsFacturando] = useState(false);
  const [facturaToPreview, setFacturaToPreview] = useState<Factura | null>(null);
  const [facturaToEmail, setFacturaToEmail] = useState<Factura | null>(null);

  // Refrescar facturas y remisiones al montar el componente para asegurar que se muestren las disponibles
  useEffect(() => {
    // Cargar siempre al montar el componente para asegurar que las remisiones estén disponibles
    // Esto es necesario porque las remisiones no se cargan automáticamente en el DataContext inicial
    refreshFacturasYRemisiones().catch(error => {
      console.error('Error al refrescar facturas y remisiones:', error);
    });
  }, [refreshFacturasYRemisiones]); // Solo dependemos de refreshFacturasYRemisiones, sin verificar facturas.length

  useEffect(() => {
    const focusId = params?.focusId;
    if (!focusId) {
      return;
    }

    const targetInvoice = facturas.find((factura) => String(factura.id) === String(focusId));
    if (!targetInvoice) {
      return;
    }

    const currentId = selectedFactura?.id;
    if (!currentId || String(currentId) !== String(targetInvoice.id) || !isDetailModalOpen) {
      setSelectedFactura(targetInvoice);
      setIsDetailModalOpen(true);
    }
  }, [params?.focusId, facturas, selectedFactura, isDetailModalOpen]);

  // Filtrar remisiones que están listas para facturar:
  // - Estado ENTREGADO (o 'D' en BD que se mapea a ENTREGADO)
  // - Sin facturaId (no han sido facturadas aún, sin importar el estado de la factura)
  // CRÍTICO: Si una remisión tiene facturaId asociado (aunque sea borrador), NO debe aparecer aquí
  const remisionesPorFacturar = useMemo(() => {
    const filtradas = remisiones.filter(r => {
      // Verificar que el estado sea ENTREGADO (puede venir como 'ENTREGADO' o 'D')
      const estadoStr = String(r.estado || '').trim().toUpperCase();
      const estadoCorrecto = estadoStr === 'ENTREGADO' || estadoStr === 'D';
      
      // Verificar que no tenga facturaId (no haya sido facturada, sin importar el estado de la factura)
      // Si facturaId es null, undefined, o string vacío, se considera sin factura
      const facturaIdStr = r.facturaId ? String(r.facturaId).trim() : '';
      const sinFactura = !facturaIdStr || facturaIdStr === '' || facturaIdStr === 'null' || facturaIdStr === 'undefined';
      
      // ADICIONAL: Verificar que no haya una factura relacionada en el historial
      // Buscar en facturas si alguna tiene esta remisión en remisionesIds
      const tieneFacturaRelacionada = facturas.some(f => {
        const remisionesIds = Array.isArray(f.remisionesIds) ? f.remisionesIds : [];
        return remisionesIds.includes(r.id) || f.remisionId === r.id;
      });
      
      // La remisión pasa el filtro si: está entregada Y no tiene facturaId Y no tiene factura relacionada
      const pasaFiltro = estadoCorrecto && sinFactura && !tieneFacturaRelacionada;
      
      // Log para depuración (solo en desarrollo)
      if (process.env.NODE_ENV === 'development' && estadoCorrecto) {
        console.log(`🔍 [FacturasPage] Remisión ${r.numeroRemision}:`, {
          estado: r.estado,
          estadoStr: estadoStr,
          estadoCorrecto: estadoCorrecto,
          facturaId: r.facturaId,
          facturaIdStr: facturaIdStr,
          sinFactura: sinFactura,
          tieneFacturaRelacionada: tieneFacturaRelacionada,
          pasaFiltro: pasaFiltro
        });
      }
      
      return pasaFiltro;
    });
    
    // Log para depuración
    if (process.env.NODE_ENV === 'development') {
      console.log(`📋 [FacturasPage] Remisiones disponibles para facturar:`, {
        totalRemisiones: remisiones.length,
        remisionesFiltradas: filtradas.length,
        estadosEncontrados: [...new Set(remisiones.map(r => r.estado))],
        remisionesPorEstado: remisiones.reduce((acc, r) => {
          const estado = String(r.estado || 'SIN_ESTADO');
          acc[estado] = (acc[estado] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
    }
    
    return filtradas;
  }, [remisiones, facturas]); // Agregar facturas como dependencia para detectar cambios

  const selectedClientId = useMemo(() => {
    if (selectedRemisiones.size === 0) return null;
    const firstRemisionId = selectedRemisiones.values().next().value;
    const firstRemision = remisionesPorFacturar.find(r => r.id === firstRemisionId);
    if (!firstRemision) return null;
    // Buscar cliente de forma flexible y devolver su ID interno
    const cliente = clientes.find(c => 
      String(c.id) === String(firstRemision.clienteId) ||
      c.numeroDocumento === firstRemision.clienteId ||
      c.codter === firstRemision.clienteId
    );
    return cliente?.id || null;
  }, [selectedRemisiones, remisionesPorFacturar, clientes]);

  // CRÍTICO: Mostrar TODAS las facturas en el historial sin importar su estado
  // El filtro de estado es solo para ayudar a encontrar facturas específicas
  const filteredInvoices = useMemo(() => {
    let sortedInvoices = [...facturas].sort((a, b) => new Date(b.fechaFactura).getTime() - new Date(a.fechaFactura).getTime());
    // Si se selecciona un estado específico, filtrar por ese estado
    // Si se selecciona 'Todos', mostrar todas las facturas sin importar el estado
    if (statusFilter !== 'Todos') {
        sortedInvoices = sortedInvoices.filter(f => f.estado === statusFilter);
    }
    // SIEMPRE retornar todas las facturas (filtradas o no) para que aparezcan en el historial
    return sortedInvoices;
  }, [facturas, statusFilter]);

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
    data: filteredInvoices,
    searchKeys: ['numeroFactura', 'estado', (item) => {
      const cliente = clientes.find(c => 
        String(c.id) === String(item.clienteId) ||
        c.numeroDocumento === item.clienteId ||
        c.codter === item.clienteId
      );
      return cliente?.nombreCompleto || '';
    }],
  });

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

    const subtotalBruto = itemsToCalculate.reduce((acc, item) => acc + (item.precioUnitario * item.cantidad), 0);
    const descuentoTotal = itemsToCalculate.reduce((acc, item) => {
        const itemTotalBruto = item.precioUnitario * item.cantidad;
        return acc + (itemTotalBruto * ((item.descuentoPorcentaje || 0) / 100));
    }, 0);
    const subtotalNeto = subtotalBruto - descuentoTotal;
    const iva = itemsToCalculate.reduce((acc, item) => {
        const itemSubtotal = (item.precioUnitario || 0) * (item.cantidad || 0) * (1 - (item.descuentoPorcentaje || 0) / 100);
        const itemIva = itemSubtotal * ((item.ivaPorcentaje || 0) / 100);
        return acc + itemIva;
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
                type: 'error'
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
        // Normalizar activo para comparación segura (puede ser number o boolean)
        const activoValue = cliente.activo === true || cliente.activo === 1 || Number(cliente.activo) === 1 ? 1 : 0;
        
        if (activoValue !== 1) {
            addNotification({
                message: `El cliente "${cliente.nombreCompleto}" está inactivo. No se puede facturar para clientes inactivos. Active el cliente primero.`,
                type: 'error',
                link: { page: 'editar_cliente', params: { id: cliente.id } }
            });
            setIsFacturando(false);
            return;
        }

        // Validar vendedor si existe en la remisión
        // NOTA: El backend solo devuelve vendedores activos, así que si está en la lista, está activo
        // No bloqueamos la facturación aquí, el backend validará el vendedor
        if (firstRemision.vendedorId) {
            const vendedor = vendedores.find(v => 
                String(v.id) === String(firstRemision.vendedorId) ||
                v.codiEmple === firstRemision.vendedorId ||
                v.codigoVendedor === firstRemision.vendedorId
            );
            
            if (!vendedor) {
                // Vendedor no encontrado en la lista (puede estar inactivo o no existir)
                // El backend solo devuelve vendedores activos, así que si no está en la lista, está inactivo
                console.warn('⚠️ Vendedor no encontrado en lista de activos:', {
                    vendedorId: firstRemision.vendedorId,
                    vendedoresEnLista: vendedores.length,
                    primerosVendedores: vendedores.slice(0, 3).map(v => ({ id: v.id, codiEmple: v.codiEmple, nombre: v.nombreCompleto }))
                });
                addNotification({
                    message: `El vendedor asociado a la remisión no se encuentra disponible o está inactivo. La factura se creará sin vendedor.`,
                    type: 'warning'
                });
                // Continuar sin vendedor (el backend lo manejará)
            }
        }

        // Mostrar notificación de inicio
        addNotification({ 
            message: `🔄 Creando factura desde ${remisionIds.length} remisión(es)...`, 
            type: 'info' 
        });

        const result = await crearFacturaDesdeRemisiones(remisionIds);
        
        if (result) {
            const { nuevaFactura } = result;
            // Limpiar selección de remisiones ya que fueron facturadas
            setSelectedRemisiones(new Set());
            
            // Refrescar facturas y remisiones para asegurar que las remisiones facturadas desaparezcan de la lista
            await refreshFacturasYRemisiones();
            
            addNotification({ 
                message: `✅ Factura BORRADOR ${nuevaFactura.numeroFactura} generada exitosamente. Las remisiones fueron eliminadas de "Remisiones Entregadas por Facturar" y la factura aparece en el historial. Revise y timbre para finalizar.`, 
                type: 'success' 
            });
            handleOpenDetailModal(nuevaFactura);
            // Las remisiones ya deberían desaparecer inmediatamente de la lista porque:
            // 1. Se actualizaron en el estado local con facturaId
            // 2. El filtro remisionesPorFacturar excluye remisiones con facturaId
            // 3. Se refrescó la lista con refreshFacturasYRemisiones()
        } else {
            addNotification({ 
                message: "❌ Error al crear la factura. Por favor, intente nuevamente.", 
                type: 'error' 
            });
        }
    } catch (error) {
        console.error('Error al facturar:', error);
        addNotification({ 
            message: `❌ Error al crear la factura: ${(error as Error).message || 'Error desconocido'}.`, 
            type: 'error' 
        });
    } finally {
        setIsFacturando(false);
    }
};

  const handleTimbrar = async (facturaId: string) => {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 [FRONTEND] ========== INICIO DE TIMBRADO ==========');
    console.log('='.repeat(80));
    console.log('📋 [FRONTEND] handleTimbrar llamado con facturaId:', facturaId);
    console.log('⏰ [FRONTEND] Timestamp:', new Date().toISOString());
    
    setIsStamping(true);
    try {
        addNotification({ 
            message: `🔄 Procesando timbrado de factura...`, 
            type: 'info' 
        });
        
        console.log('📤 [FRONTEND] Llamando a timbrarFactura(facturaId)...');
        const facturaTimbrada = await timbrarFactura(facturaId);
        console.log('📥 [FRONTEND] Respuesta recibida de timbrarFactura:', {
            success: !!facturaTimbrada,
            estado: facturaTimbrada?.estado,
            cufe: facturaTimbrada?.cufe ? `${facturaTimbrada.cufe.substring(0, 20)}...` : 'No generado',
            numeroFactura: facturaTimbrada?.numeroFactura
        });
        if (facturaTimbrada) {
            console.log('✅ [FRONTEND] Factura timbrada exitosamente');
            console.log('📋 [FRONTEND] Datos de la factura timbrada:', {
                id: facturaTimbrada.id,
                numeroFactura: facturaTimbrada.numeroFactura,
                estado: facturaTimbrada.estado,
                cufe: facturaTimbrada.cufe || 'No generado',
                fechaTimbrado: facturaTimbrada.fechaTimbrado || 'N/A'
            });
            
            // Actualizar selectedFactura con los datos más recientes de la factura timbrada
            // Esto asegura que el modal muestre los datos actualizados
            setSelectedFactura(facturaTimbrada);
            
            // Si la factura fue timbrada exitosamente (no rechazada), cerrar el modal
            // para que el usuario vea que la factura pasó al historial y las remisiones desaparecieron
            if (facturaTimbrada.estado === 'ENVIADA' && facturaTimbrada.cufe) {
                console.log('✅ [FRONTEND] Factura ENVIADA con CUFE - Cerrando modal en 1.5s');
                
                // Refrescar facturas y remisiones para asegurar que las remisiones facturadas desaparezcan
                await refreshFacturasYRemisiones();
                
                // Cerrar el modal después de un breve delay para que el usuario vea el mensaje
                setTimeout(() => {
                    handleCloseModals();
                }, 1500);
                
                addNotification({ 
                    message: `✅ Factura ${facturaTimbrada.numeroFactura} timbrada exitosamente. CUFE: ${facturaTimbrada.cufe.substring(0, 20)}... Las remisiones relacionadas fueron eliminadas de "Remisiones Entregadas por Facturar" y la factura aparece en el historial.`, 
                    type: 'success' 
                });
            } else if (facturaTimbrada.estado === 'RECHAZADA') {
                console.log('❌ [FRONTEND] Factura RECHAZADA por DIAN');
                addNotification({ 
                    message: `❌ Factura ${facturaTimbrada.numeroFactura} fue rechazada en el proceso de timbrado.`, 
                    type: 'error' 
                });
            } else {
                console.log('⚠️ [FRONTEND] Factura timbrada pero estado inesperado:', facturaTimbrada.estado);
                addNotification({ 
                    message: `✅ Factura ${facturaTimbrada.numeroFactura} timbrada con éxito.`, 
                    type: 'success' 
                });
            }
        } else {
            console.error('❌ [FRONTEND] facturaTimbrada es null o undefined');
            addNotification({ message: "Error al timbrar la factura.", type: 'warning' });
        }
        
        console.log('✅ [FRONTEND] ========== FIN DE TIMBRADO ==========');
        console.log('='.repeat(80) + '\n');
    } catch (error) {
        console.error('\n❌ [FRONTEND] ========== ERROR EN TIMBRADO ==========');
        console.error('❌ [FRONTEND] Error al timbrar:', error);
        console.error('❌ [FRONTEND] Error message:', (error as Error).message);
        console.error('❌ [FRONTEND] Error stack:', (error as Error).stack);
        console.error('='.repeat(80) + '\n');
        
        addNotification({ 
            message: `Error al timbrar la factura: ${(error as Error).message || 'Error desconocido'}.`, 
            type: 'error' 
        });
    } finally {
        setIsStamping(false);
        console.log('🔄 [FRONTEND] setIsStamping(false) - Proceso de timbrado finalizado');
    }
  }
  
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
        type: 'error'
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
        type: 'error'
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
          message: `✅ Nueva factura BORRADOR ${nuevaFactura.numeroFactura} creada desde la factura rechazada. Revise y timbre para finalizar.`, 
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
          type: 'error' 
        });
      }
    } catch (error) {
      console.error('[Refacturar] Error al re-facturar:', error);
      addNotification({ 
        message: `❌ Error al crear la nueva factura: ${(error as Error).message || 'Error desconocido'}.`, 
        type: 'error' 
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
        addNotification({ message: `XML de ${factura.numeroFactura} descargado.`, type: 'info' });
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

    const handleConfirmSendEmail = (emailData: { to: string }) => {
        if (!facturaToEmail) return;
        addNotification({
            message: `Se ha abierto tu cliente de correo para enviar la factura ${facturaToEmail.numeroFactura} a ${emailData.to}.`,
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
        const subtotal = (item.precioUnitario || 0) * (item.cantidad || item.cantidadEnviada || 0) * (1 - ((item.descuentoPorcentaje || 0) / 100));
        const valorIva = subtotal * ((item.ivaPorcentaje || 0) / 100);
        return sum + subtotal + valorIva;
      }, 0);
    }, 0);
  }, [selectedRemisiones, remisiones]);


  const remisionesColumns: Column<Remision>[] = [
    { header: '', accessor: 'id', cell: (item) => {
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
          className={`flex items-center justify-center transition-opacity ${!isSelectable && !isSelected ? 'opacity-50' : ''}`}
          title={!isSelectable && !isSelected ? 'Solo se pueden facturar remisiones del mismo cliente.' : 'Seleccionar para facturar'}
        >
          <input 
            type="checkbox" 
            checked={isSelected} 
            onChange={() => handleToggleRemision(item.id)} 
            disabled={!isSelectable && !isSelected}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:bg-slate-200 disabled:cursor-not-allowed" 
          />
        </div>
      );
    }},
    { header: 'Remisión', accessor: 'numeroRemision' },
    { header: 'Pedido', accessor: 'pedidoId', cell: (item) => pedidos.find(p => p.id === item.pedidoId)?.numeroPedido || 'N/A' },
    { header: 'Cliente', accessor: 'clienteId', cell: (item) => {
      // Buscar cliente de forma flexible (por id, numeroDocumento o codter)
      const cliente = clientes.find(c => 
        String(c.id) === String(item.clienteId) ||
        c.numeroDocumento === item.clienteId ||
        c.codter === item.clienteId
      );
      return cliente?.nombreCompleto || 'N/A';
    }},
    { header: 'Cond. Pago', accessor: 'clienteId', cell: (item) => {
      // Buscar cliente de forma flexible (por id, numeroDocumento o codter)
      const cliente = clientes.find(c => 
        String(c.id) === String(item.clienteId) ||
        c.numeroDocumento === item.clienteId ||
        c.codter === item.clienteId
      );
      return <StatusBadge status={cliente?.condicionPago === 'Contado' ? 'PAGADA' : 'VENCIDA'} />;
    }},
    { header: 'Total Pedido', accessor: 'pedidoId', cell: (item) => formatCurrency(pedidos.find(p => p.id === item.pedidoId)?.total || 0)},
  ];

  const facturasColumns: Column<Factura>[] = [
    { header: 'Número', accessor: 'numeroFactura' },
    { header: 'Cliente', accessor: 'clienteId', cell: (item) => {
      // Buscar cliente de forma flexible (por id, numeroDocumento o codter)
      const cliente = clientes.find(c => 
        String(c.id) === String(item.clienteId) ||
        c.numeroDocumento === item.clienteId ||
        c.codter === item.clienteId
      );
      return cliente?.nombreCompleto || 'N/A';
    }},
    { header: 'Fecha Emisión', accessor: 'fechaFactura', cell: (item) => formatDateOnly(item.fechaFactura) },
    { header: 'Total', accessor: 'total', cell: (item) => formatCurrency(item.total) },
    { 
      header: 'Forma de Pago', 
      accessor: 'formaPago', 
      cell: (item) => {
        // Intentar obtener forma de pago desde la factura, luego desde la cotización relacionada
        let formaPagoFactura = item.formaPago;
        if (!formaPagoFactura) {
          // Buscar pedido relacionado
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
        }
        if (!formaPagoFactura) return 'N/A';
        // Convertir valores antiguos '01'/'02' a nuevos '1'/'2' si es necesario
        const formaPagoValue = formaPagoFactura === '01' ? '1' : formaPagoFactura === '02' ? '2' : formaPagoFactura;
        const formaPagoMap: Record<string, string> = {
          '1': 'Contado',
          '2': 'Crédito'
        };
        return formaPagoMap[formaPagoValue] || formaPagoValue;
      }
    },
    { header: 'Motivo Rechazo', accessor: 'estado', cell: (item) => {
      // Mostrar motivo de rechazo solo si la factura está rechazada
      if (item.estado === 'RECHAZADA' && item.motivoRechazo) {
        return (
          <div className="flex items-center gap-2">
            <i className="fas fa-exclamation-triangle text-red-500"></i>
            <span className="text-red-600 dark:text-red-400 text-sm" title={item.motivoRechazo}>
              {item.motivoRechazo.length > 50 ? `${item.motivoRechazo.substring(0, 50)}...` : item.motivoRechazo}
            </span>
          </div>
        );
      }
      return <span className="text-slate-400 dark:text-slate-500">—</span>;
    }},
    { header: 'Estado', accessor: 'estado', cell: (item) => <StatusBadge status={item.estado as any} /> },
    { header: 'Acciones', accessor: 'id', cell: (item) => (
      <button onClick={() => handleOpenDetailModal(item)} className="text-sky-500 hover:underline text-sm font-medium">Ver</button>
    )},
  ];

  const additionalInvoiceFilters = (
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
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">Tablero de Facturación</h1>
      
      <Card className="mb-8">
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle>Remisiones Entregadas por Facturar</CardTitle>
                <ProtectedComponent permission="facturacion:create">
                    <button 
                        onClick={handleFacturar}
                        disabled={selectedRemisiones.size === 0 || isFacturando}
                        className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed w-full sm:w-auto shadow-md hover:shadow-lg"
                        title={isFacturando ? "Procesando factura..." : `Facturar ${selectedRemisiones.size} remisión(es)`}
                    >
                        {isFacturando ? (
                            <>
                                <i className="fas fa-spinner fa-spin mr-2"></i>
                                Procesando...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-file-invoice-dollar mr-2"></i>
                                Facturar ({selectedRemisiones.size}) - {formatCurrency(totalAFacturar)}
                            </>
                        )}
                    </button>
                </ProtectedComponent>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                <i className="fas fa-info-circle mr-2 text-blue-400"></i>
                Seleccione una o más remisiones del mismo cliente para consolidarlas en una sola factura.
            </p>
        </CardHeader>
        <CardContent className="p-0">
            <Table columns={remisionesColumns} data={remisionesPorFacturar} onSort={() => {}} sortConfig={{key: null, direction: 'asc'}} />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Historial de Facturas</CardTitle>
        </CardHeader>
        <TableToolbar 
            searchTerm={searchTermInvoices} 
            onSearchChange={handleSearchInvoices}
            additionalFilters={additionalInvoiceFilters}
        />
        <CardContent className="p-0">
            <Table 
              columns={facturasColumns} 
              data={paginatedInvoices} 
              onSort={requestSortInvoices} 
              sortConfig={sortConfigInvoices}
              highlightRowId={params?.highlightId ?? params?.focusId}
            />
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

      {selectedFactura && cliente && (
        <Modal 
            isOpen={isDetailModalOpen} 
            onClose={handleCloseModals} 
            title={`Detalle Factura: ${selectedFactura.numeroFactura}`}
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
                    <StatusBadge status={selectedFactura.estado as any} />
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
                        <p><span className="font-semibold text-slate-600 dark:text-slate-400">Pedido:</span> <span>{pedido?.numeroPedido || 'Venta Directa'}</span></p>
                        <p><span className="font-semibold text-slate-600 dark:text-slate-400">Remisiones:</span> <span>{remisionesRelacionadas.map(r => r.numeroRemision).join(', ') || 'N/A'}</span></p>
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
                              const itemSubtotal = (item.precioUnitario || 0) * (item.cantidad || 0) * (1 - (item.descuentoPorcentaje || 0) / 100);
                              const itemIva = itemSubtotal * ((item.ivaPorcentaje || 0) / 100);
                              return (
                                  <tr key={item.productoId} className="text-sm">
                                      <td className="px-4 py-2 whitespace-nowrap font-mono text-slate-500">{producto?.referencia || 'N/A'}</td>
                                      <td className="px-4 py-2 whitespace-nowrap font-semibold">{item.descripcion}</td>
                                      <td className="px-4 py-2 whitespace-nowrap">{producto?.unidadMedida}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-right">{item.cantidad}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-right">{formatCurrency(item.precioUnitario)}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-right text-red-600">{item.descuentoPorcentaje.toFixed(2)}%</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-right">{item.ivaPorcentaje}%</td>
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
                        <span>IVA (19%)</span>
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
                        <button onClick={() => handleTimbrar(selectedFactura.id)} disabled={isStamping} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-400">
                            {isStamping ? <><i className="fas fa-spinner fa-spin mr-2"></i>Timbrando...</> : <><i className="fas fa-stamp mr-2"></i>Autorizar y Timbrar Factura</>}
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
    </div>
  );
};

export default FacturasPage;