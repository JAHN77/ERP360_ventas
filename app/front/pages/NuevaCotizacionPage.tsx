import React, { useState, useEffect } from 'react';
import CotizacionForm from '../components/comercial/CotizacionForm';
import Card, { CardContent } from '../components/ui/Card';
import { useNavigation } from '../hooks/useNavigation';
import { DocumentItem, Cotizacion, Pedido, Cliente, Vendedor } from '../types';
import Modal from '../components/ui/Modal';
import DocumentPreviewModal from '../components/comercial/DocumentPreviewModal';
import CotizacionPDFDocument from '../components/comercial/CotizacionPDFDocument';
import { useNotifications } from '../hooks/useNotifications';
import ApprovalSuccessModal from '../components/ui/ApprovalSuccessModal';
import { useData } from '../hooks/useData';
import { findClienteByIdentifier } from '../utils/clientes';
import { formatDateOnly } from '../utils/formatters';
import apiClient from '../services/apiClient';

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
    const { clientes, vendedores, datosEmpresa, productos, crearCotizacion, aprobarCotizacion, getCotizacionById, actualizarCotizacion } = useData();

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
    const [nextQuoteNumber, setNextQuoteNumber] = useState<string>('');
    const [currentDateString, setCurrentDateString] = useState<string>('');

    useEffect(() => {
        const today = new Date();
        setCurrentDateString(today.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }));

        const fetchNextNumber = async () => {
            try {
                const response = await apiClient.getNextQuoteNumber();
                if (response.success && response.data) {
                    setNextQuoteNumber(response.data.nextNumber);
                } else {
                    setNextQuoteNumber('000001');
                }
            } catch (error) {
                console.error("Error fetching next quote number", error);
                setNextQuoteNumber('??????');
            }
        };

        if (!isEditing) {
            fetchNextNumber();
        }
    }, [isEditing]);

    useEffect(() => {
        if (isEditing && params.id) {
            const fetchedQuote = getCotizacionById(params.id);
            if (fetchedQuote) {
                if (fetchedQuote.estado === 'ENVIADA') {
                    setInitialData(fetchedQuote);
                } else {
                    addNotification({
                        message: `La cotización ${fetchedQuote.numeroCotizacion || ''} no se puede editar.`,
                        type: 'warning'
                    });
                    setPage('cotizaciones');
                }
            } else {
                // Si no se encuentra, esperar a que la carga inicial termine o reintentar
                console.log('⏳ Cotización no encontrada en local, esperando carga completa...');
            }
        }
    }, [isEditing, params.id, getCotizacionById, addNotification, setPage, clientes, productos]); // Añadimos dependencias para reintentar cuando carguen los datos

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
                numeroCotizacion: nextQuoteNumber ? `C-${nextQuoteNumber}` : 'COT-PREVIEW',
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

            // 2. Usar directamente la cotización creada, asegurando que tenga items
            let cotizacionCompleta: Cotizacion = { ...cotizacionCreada };

            // Si por alguna razón la respuesta no trae items, usar los del preview como fallback seguro
            if (!cotizacionCompleta.items || cotizacionCompleta.items.length === 0) {
                console.warn('⚠️ Cotización creada sin items en respuesta, usando fallback del preview');
                cotizacionCompleta.items = quoteToPreview.items || [];
            }

            console.log('✅ Cotización lista para aprobación inmediata:', {
                id: cotizacionCompleta.id,
                itemsCount: cotizacionCompleta.items.length
            });

            // 3. Aprobar la cotización en backend usando la cotización completa
            const itemsIds = (cotizacionCompleta.items || [])
                .map(item => item?.productoId)
                .filter(id => id !== undefined && id !== null) as number[];

            if (itemsIds.length === 0) {
                throw new Error('La cotización no tiene ítems válidos para generar el pedido.');
            }

            const resultadoAprobacion = await aprobarCotizacion(cotizacionCompleta, itemsIds);

            if (!resultadoAprobacion) {
                throw new Error('No se pudo aprobar la cotización: resultadoAprobacion es null o undefined');
            }

            if (!(resultadoAprobacion as any).pedido) {
                console.error('❌ El resultado no contiene pedido:', resultadoAprobacion);
                throw new Error('No se pudo generar el pedido. La cotización fue aprobada pero no se creó el pedido.');
            }

            const { cotizacion, pedido } = resultadoAprobacion as { cotizacion: Cotizacion; pedido: Pedido };

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
        <div className="animate-fade-in space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                        {isEditing
                            ? `Editar Cotización: ${(initialData?.numeroCotizacion || '').replace('C-', '')}`
                            : `Nueva Cotización ${nextQuoteNumber ? `#${nextQuoteNumber.replace('C-', '')}` : ''}`}
                    </h1>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1">
                        <p className="text-slate-500 dark:text-slate-400">
                            {isEditing ? 'Modifica los detalles de la cotización existente.' : 'Diligencia el formulario para generar una nueva cotización.'}
                        </p>
                        {!isEditing && currentDateString && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                <i className="far fa-calendar-alt mr-1"></i>
                                {currentDateString}
                            </span>
                        )}
                    </div>
                </div>
            </div>
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
                        title={`Previsualizar Cotización: ${isEditing ? quoteToPreview.numeroCotizacion.replace('C-', '') : 'NUEVA'}`}
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
                        <CotizacionPDFDocument
                            cotizacion={quoteToPreview}
                            cliente={cliente}
                            vendedor={vendedor}
                            empresa={datosEmpresa}
                            productos={productos}
                            preferences={{} as any}
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
                                La cotización <strong>{cotizacion.numeroCotizacion.replace('C-', '')}</strong> ha sido aprobada.
                                Se ha generado el Pedido <strong>{pedido.numeroPedido.replace('P-', '')}</strong>.
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
                                La cotización <strong>{cotizacion.numeroCotizacion.replace('C-', '')}</strong> ha sido guardada y enviada a aprobación.
                            </>
                        }
                        summaryTitle="Resumen de la Cotización"
                        summaryDetails={[
                            { label: 'Número', value: cotizacion.numeroCotizacion.replace('C-', '') },
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
