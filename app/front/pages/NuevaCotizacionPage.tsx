import React, { useState, useEffect } from 'react';
import CotizacionForm from '../components/comercial/CotizacionForm';
import Card, { CardContent } from '../components/ui/Card';
import { useNavigation } from '../hooks/useNavigation';
import { DocumentItem, Cotizacion, Pedido, Cliente, Vendedor } from '../types';
import Modal from '../components/ui/Modal';
import DocumentPreviewModal from '../components/comercial/DocumentPreviewModal';
import CotizacionPDF from '../components/comercial/CotizacionPDF';
import { useNotifications } from '../hooks/useNotifications';
import ApprovalSuccessModal from '../components/ui/ApprovalSuccessModal';
import { useData } from '../hooks/useData';
import { findClienteByIdentifier } from '../utils/clientes';
import { formatDateOnly } from '../utils/formatters';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
}

interface CotizacionFormData {
    clienteId: string;
    vendedorId: string;
    items: DocumentItem[];
    subtotal: number;
    ivaValor: number;
    total: number;
    observacionesInternas?: string;
    domicilios?: number;
    cliente?: Cliente | null;
    vendedor?: Vendedor | null;
    formaPago?: string;
    valorAnticipo?: number;
    numOrdenCompra?: string;
    notaPago?: string;
}

const NuevaCotizacionPage: React.FC = () => {
    const { page, params, setPage } = useNavigation();
    const { addNotification } = useNotifications();
    const { clientes, vendedores, datosEmpresa, crearCotizacion, aprobarCotizacion, getCotizacionById, actualizarCotizacion } = useData();
    
    const isEditing = page === 'editar_cotizacion';

    const [initialData, setInitialData] = useState<Cotizacion | null>(null);
    const [isCancelConfirmOpen, setCancelConfirmOpen] = useState(false);
    const [isFormDirty, setFormDirty] = useState(false);
    const [quoteToPreview, setQuoteToPreview] = useState<Cotizacion | null>(null);
    const [previewCliente, setPreviewCliente] = useState<Cliente | null>(null);
    const [previewVendedor, setPreviewVendedor] = useState<Vendedor | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [approvalResult, setApprovalResult] = useState<{ cotizacion: Cotizacion, pedido: Pedido } | null>(null);
    const [savedCotizacion, setSavedCotizacion] = useState<Cotizacion | null>(null);

    useEffect(() => {
        if (isEditing && params.id) {
            const fetchedQuote = getCotizacionById(params.id);
            if (fetchedQuote && fetchedQuote.estado === 'ENVIADA') {
                setInitialData(fetchedQuote);
            } else {
                addNotification({
                    message: `La cotización ${fetchedQuote?.numeroCotizacion || ''} no se puede editar.`,
                    type: 'warning'
                });
                setPage('cotizaciones');
            }
        }
    }, [isEditing, params.id, setPage, addNotification, getCotizacionById]);

    const handleFormSubmit = async (formData: CotizacionFormData) => {
        if (isEditing && initialData) {
            const updatedQuote = await actualizarCotizacion(initialData.id, {
                clienteId: formData.clienteId,
                vendedorId: formData.vendedorId,
                items: formData.items,
                subtotal: formData.subtotal,
                ivaValor: formData.ivaValor,
                total: formData.total,
                observacionesInternas: formData.observacionesInternas,
                formaPago: formData.formaPago,
                valorAnticipo: formData.valorAnticipo,
                numOrdenCompra: formData.numOrdenCompra ? parseInt(formData.numOrdenCompra, 10) : undefined,
                notaPago: formData.notaPago,
            } as Partial<Cotizacion>);
            if (updatedQuote) {
                addNotification({ 
                    message: `Cotización ${updatedQuote.numeroCotizacion} enviada a supervisión.`, 
                    type: 'success',
                    link: { page: 'cotizaciones', params: { focusId: updatedQuote.id, highlightId: updatedQuote.id } }
                });
            }
            setPage('cotizaciones', { focusId: initialData.id });
        } else {
            // Create flow: show preview modal
            const today = new Date();
            const expiryDate = new Date();
            expiryDate.setDate(today.getDate() + 30);

            // FIX: Operator '+' cannot be applied to types 'DocumentoDetalle' and 'number'. Added initial value 0 to reduce and completed the line.
            const descuentoTotal = formData.items.reduce((acc, item) => {
                const itemTotalBruto = item.precioUnitario * item.cantidad;
                return acc + (itemTotalBruto * (item.descuentoPorcentaje / 100));
            }, 0);

            const resolvedCliente = formData.cliente || clientes.find(c => c.id === formData.clienteId);
            const resolvedVendedor = formData.vendedor || vendedores.find(v => v.id === formData.vendedorId);

            if (!resolvedCliente) {
                addNotification({
                    message: 'No se pudo identificar el cliente seleccionado. Por favor, vuelve a seleccionarlo.',
                    type: 'warning',
                });
                return;
            }

            if (!resolvedVendedor) {
                addNotification({
                    message: 'No se pudo identificar el vendedor seleccionado. Por favor, vuelve a seleccionarlo.',
                    type: 'warning',
                });
                return;
            }

            const previewData: Cotizacion = {
                id: 'temp-preview',
                numeroCotizacion: 'COT-PREVIEW',
                fechaCotizacion: today.toISOString().split('T')[0],
                fechaVencimiento: expiryDate.toISOString().split('T')[0],
                clienteId: formData.clienteId,
                vendedorId: formData.vendedorId,
                items: formData.items,
                subtotal: formData.subtotal,
                ivaValor: formData.ivaValor,
                total: formData.total,
                descuentoValor: descuentoTotal,
                observacionesInternas: formData.observacionesInternas,
                estado: 'ENVIADA',
                empresaId: datosEmpresa.id,
                formaPago: formData.formaPago,
                valorAnticipo: formData.valorAnticipo,
                numOrdenCompra: formData.numOrdenCompra ? parseInt(formData.numOrdenCompra, 10) : undefined,
                notaPago: formData.notaPago,
            } as Cotizacion;
            setPreviewCliente(resolvedCliente);
            setPreviewVendedor(resolvedVendedor);
            setQuoteToPreview(previewData);
        }
    };
    
    const handleCreateAndSend = async () => {
        if (!quoteToPreview) return;
        setIsSending(true);
        try {
            const payload = {
                ...quoteToPreview,
                estado: 'ENVIADA'
            };
            const nuevaCotizacion = await crearCotizacion(payload as Cotizacion);
            setSavedCotizacion(nuevaCotizacion);
            addNotification({ 
                message: 'Cotización guardada exitosamente', 
                type: 'success',
                link: { page: 'cotizaciones', params: { focusId: nuevaCotizacion.id, highlightId: nuevaCotizacion.id } }
            });
        } catch (error) {
            addNotification({ message: (error as Error).message, type: 'warning' });
        } finally {
            setIsSending(false);
            setQuoteToPreview(null);
            setPreviewCliente(null);
            setPreviewVendedor(null);
        }
    };

    const handleCreateAndApprove = async () => {
        if (!quoteToPreview) return;
        setIsApproving(true);
        try {
            // 1. Crear la cotización con estado ENVIADA (para dejar registro del envío)
            const cotizacionCreada = await crearCotizacion({
                ...quoteToPreview,
                estado: 'ENVIADA'
            });

            // 2. Obtener la cotización completa desde el estado local después de que refreshData termine
            // Intentar obtener la cotización completa varias veces con pequeños delays
            let cotizacionCompleta: Cotizacion | null = null;
            console.log('🔍 Buscando cotización completa después de crearla...', {
                cotizacionCreadaId: cotizacionCreada.id,
                itemsEnCreada: cotizacionCreada.items?.length || 0,
                itemsEnPreview: quoteToPreview.items?.length || 0
            });
            
            for (let intento = 0; intento < 10; intento++) {
                await new Promise(resolve => setTimeout(resolve, 200));
                cotizacionCompleta = getCotizacionById(cotizacionCreada.id) || null;
                console.log(`🔍 Intento ${intento + 1}/10:`, {
                    encontrada: !!cotizacionCompleta,
                    itemsCount: cotizacionCompleta?.items?.length || 0
                });
                if (cotizacionCompleta && cotizacionCompleta.items && cotizacionCompleta.items.length > 0) {
                    console.log('✅ Cotización completa encontrada con items');
                    break;
                }
            }
            
            // Si no se encuentra en el estado local o no tiene items, usar la cotización creada con los items originales
            if (!cotizacionCompleta || !cotizacionCompleta.items || cotizacionCompleta.items.length === 0) {
                console.warn('⚠️ Cotización no encontrada en estado local o sin items, usando items del preview');
                // Usar la cotización creada con los items del preview original
                cotizacionCompleta = {
                    ...cotizacionCreada,
                    items: quoteToPreview.items || cotizacionCreada.items || []
                };
                console.log('📋 Cotización preparada con items del preview:', {
                    itemsCount: cotizacionCompleta.items.length,
                    productoIds: cotizacionCompleta.items.map(i => i.productoId)
                });
            } else {
                console.log('✅ Cotización completa obtenida:', {
                    id: cotizacionCompleta.id,
                    itemsCount: cotizacionCompleta.items.length,
                    productoIds: cotizacionCompleta.items.map(i => i.productoId)
                });
            }

            // 3. Aprobar la cotización en backend usando la cotización completa
            const itemsIds = (cotizacionCompleta.items || [])
                .map(item => item?.productoId)
                .filter(id => id !== undefined && id !== null) as number[];

            if (itemsIds.length === 0) {
                throw new Error('La cotización no tiene ítems válidos para generar el pedido.');
            }

            console.log('🔍 Llamando a aprobarCotizacion con:', {
                cotizacionId: cotizacionCompleta.id,
                numeroCotizacion: cotizacionCompleta.numeroCotizacion,
                itemsCount: cotizacionCompleta.items?.length || 0,
                itemsIds: itemsIds
            });
            
            const resultadoAprobacion = await aprobarCotizacion(cotizacionCompleta, itemsIds);
            
            console.log('🔍 Resultado de aprobarCotizacion:', {
                resultado: resultadoAprobacion,
                tienePedido: !!(resultadoAprobacion as any)?.pedido,
                tipo: typeof resultadoAprobacion
            });
            
            if (!resultadoAprobacion) {
                throw new Error('No se pudo aprobar la cotización: resultadoAprobacion es null o undefined');
            }
            
            if (!(resultadoAprobacion as any).pedido) {
                console.error('❌ El resultado no contiene pedido:', resultadoAprobacion);
                throw new Error('No se pudo generar el pedido. La cotización fue aprobada pero no se creó el pedido.');
            }
            
            const { cotizacion, pedido } = resultadoAprobacion as { cotizacion: Cotizacion; pedido: Pedido };
            
            console.log('✅ Aprobación exitosa:', {
                cotizacionId: cotizacion.id,
                pedidoId: pedido.id,
                numeroPedido: pedido.numeroPedido
            });
            setApprovalResult({ cotizacion, pedido });
            // Mostrar mensaje de aprobación
            addNotification({ 
                message: 'Aprobado', 
                type: 'success',
                link: { page: 'cotizaciones', params: { focusId: cotizacion.id, highlightId: cotizacion.id } }
            });
        } catch (error) {
            addNotification({ message: (error as Error).message, type: 'warning' });
        } finally {
            setIsApproving(false);
            setQuoteToPreview(null);
            setPreviewCliente(null);
            setPreviewVendedor(null);
        }
    };
    
    const handleCancel = () => {
        if (isFormDirty) {
            setCancelConfirmOpen(true);
        } else {
            setPage(isEditing ? 'cotizaciones' : 'dashboard');
        }
    };

    const executeCancel = () => {
        setCancelConfirmOpen(false);
        setPage(isEditing ? 'cotizaciones' : 'dashboard');
    };

    return (
        <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">
                {isEditing ? `Editar Cotización: ${initialData?.numeroCotizacion || ''}` : 'Crear Nueva Cotización'}
            </h1>
            <Card>
                <CardContent>
                    <CotizacionForm 
                        onSubmit={handleFormSubmit} 
                        onCancel={handleCancel} 
                        onDirtyChange={setFormDirty}
                        initialData={initialData}
                        isEditing={isEditing}
                    />
                </CardContent>
            </Card>
            <Modal
                isOpen={isCancelConfirmOpen}
                onClose={() => setCancelConfirmOpen(false)}
                title="Confirmar Cancelación"
                size="md"
            >
                <div>
                    <p className="text-slate-600 dark:text-slate-300 mb-6">Tienes cambios sin guardar. ¿Seguro que quieres cancelar?</p>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setCancelConfirmOpen(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg">Volver</button>
                        <button onClick={executeCancel} className="px-4 py-2 bg-red-600 text-white rounded-lg">Sí, cancelar</button>
                    </div>
                </div>
            </Modal>

            {quoteToPreview && (() => {
                const cliente = previewCliente || clientes.find(c => c.id === quoteToPreview.clienteId);
                const vendedor = previewVendedor || vendedores.find(v => v.id === quoteToPreview.vendedorId);
                if (!cliente || !vendedor) return null;

                return (
                    <DocumentPreviewModal
                        isOpen={!!quoteToPreview}
                        onClose={() => {
                            setQuoteToPreview(null);
                            setPreviewCliente(null);
                            setPreviewVendedor(null);
                        }}
                        title={`Previsualizar Cotización: ${isEditing ? quoteToPreview.numeroCotizacion : 'NUEVA'}`}
                        onConfirm={handleCreateAndApprove}
                        onEdit={() => {
                            setQuoteToPreview(null);
                            setPreviewCliente(null);
                            setPreviewVendedor(null);
                        }}
                        confirmLabel="Aprobar y Crear Pedido"
                        isConfirming={isApproving}
                        onSaveAndSend={handleCreateAndSend}
                        isSaving={isSending}
                        saveAndSendLabel="Guardar y Enviar a Aprobación"
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
                        onClose={() => { 
                            setApprovalResult(null); 
                            setPage('cotizaciones', { focusId: cotizacion.id }); 
                        }}
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
                            label: 'Ir a Cotizaciones',
                            onClick: () => { 
                                setApprovalResult(null); 
                                setPage('cotizaciones', { focusId: cotizacion.id }); 
                            },
                        }}
                    />
                );
            })()}

            {savedCotizacion && (() => {
                const cotizacion = savedCotizacion;
                const cliente = findClienteByIdentifier(clientes, cotizacion.clienteId) || previewCliente;
                const vendedor = previewVendedor || vendedores.find(v => v.id === cotizacion.vendedorId);
                
                if (!cliente) return null;

                const subtotalBruto = cotizacion.items.reduce((acc, item) => acc + (item.precioUnitario * item.cantidad), 0);
                const descuentoTotal = cotizacion.descuentoValor || cotizacion.items.reduce((acc, item) => {
                    const itemTotalBruto = item.precioUnitario * item.cantidad;
                    return acc + (itemTotalBruto * (item.descuentoPorcentaje / 100));
                }, 0);

                return (
                    <ApprovalSuccessModal
                        isOpen={!!savedCotizacion}
                        onClose={() => { 
                            setSavedCotizacion(null); 
                            setPage('cotizaciones', { focusId: cotizacion.id }); 
                        }}
                        title="¡Cotización Guardada!"
                        message={
                            <>
                                La cotización <strong>{cotizacion.numeroCotizacion}</strong> ha sido guardada y enviada a aprobación.
                            </>
                        }
                        summaryTitle="Resumen de la Cotización"
                        summaryDetails={[
                            { label: 'Número', value: cotizacion.numeroCotizacion },
                            { label: 'Fecha', value: formatDateOnly(cotizacion.fechaCotizacion) },
                            { label: 'Válida hasta', value: formatDateOnly(cotizacion.fechaVencimiento) },
                            { label: 'Cliente', value: cliente.nombreCompleto || cliente.razonSocial || 'N/A' },
                            { label: 'Vendedor', value: vendedor ? `${vendedor.primerNombre} ${vendedor.primerApellido}`.trim() : 'N/A' },
                            { label: 'Estado', value: cotizacion.estado === 'ENVIADA' ? 'Enviada a Aprobación' : cotizacion.estado },
                            { label: 'Items', value: cotizacion.items.length },
                            { label: 'sep1', value: '', isSeparator: true },
                            { label: 'Subtotal Bruto', value: formatCurrency(subtotalBruto) },
                            { label: 'Descuento Total', value: `-${formatCurrency(descuentoTotal)}`, isDiscount: true },
                            { label: 'Subtotal Neto', value: formatCurrency(cotizacion.subtotal) },
                            { label: 'IVA (19%)', value: formatCurrency(cotizacion.ivaValor) },
                            { label: 'Total Cotización', value: formatCurrency(cotizacion.total), isTotal: true },
                        ]}
                        primaryAction={{
                            label: 'Ir a Cotizaciones',
                            onClick: () => { 
                                setSavedCotizacion(null); 
                                setPage('cotizaciones', { focusId: cotizacion.id }); 
                            },
                            icon: 'fa-list'
                        }}
                        secondaryActions={[
                            {
                                label: 'Ver Detalles',
                                onClick: () => {
                                    setSavedCotizacion(null);
                                    setPage('cotizaciones', { focusId: cotizacion.id });
                                },
                                icon: 'fa-eye'
                            }
                        ]}
                    />
                );
            })()}
        </div>
    );
};

export default NuevaCotizacionPage;
