import React, { useState, useEffect } from 'react';
import FacturaDirectaForm from '../components/facturacion/FacturaDirectaForm';
import Card, { CardContent } from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { useNavigation } from '../hooks/useNavigation';
import { useNotifications } from '../hooks/useNotifications';
import { useData } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';
import DIANSuccessModal from '../components/common/DIANSuccessModal';
import { createInvoicePayload } from '../utils/dianPayloadGenerator';

const FacturaDirectaPage: React.FC = () => {
    const { setPage } = useNavigation();
    const { addNotification } = useNotifications();
    const { datosEmpresa, refreshFacturasYRemisiones } = useData();
    const { selectedCompany } = useAuth();
    const [nextNumber, setNextNumber] = useState<string>('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // Estados para Modo Prueba
    const [isTestMode, setIsTestMode] = useState(false);
    const [jsonModalOpen, setJsonModalOpen] = useState(false);
    const [jsonContent, setJsonContent] = useState<string>('');

    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>('');
    const [pdfFilename, setPdfFilename] = useState<string>('');

    // Estado para Modal de Éxito DIAN
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successCufe, setSuccessCufe] = useState('');
    const [successDocumentNumber, setSuccessDocumentNumber] = useState('');

    useEffect(() => {
        const fetchNextNumber = async () => {
            try {
                const response = await apiClient.getNextInvoiceNumber();
                if (response.success && response.data) {
                    setNextNumber(response.data.nextNumber);
                } else {
                    setNextNumber('88996');
                }
            } catch (error) {
                console.error("Error fetching next invoice number", error);
                setNextNumber('88996');
            }
        };
        fetchNextNumber();
    }, []);



    const handlePreview = async (formData: any) => {
        setIsGeneratingPdf(true);
        try {
            const payload = createInvoicePayload(formData);
            const response = await apiClient.generatePreviewPdf(payload);

            if (response.success) {
                const { pdf_url: url, filename } = response.data;
                if (url) {
                    setPdfPreviewUrl(url);
                    setPdfFilename(filename || `Factura_${formData.number}.pdf`);
                    setIsPreviewModalOpen(true);
                    addNotification({ message: 'Vista previa lista.', type: 'success' });
                } else {
                    throw new Error('No se recibió URL ni datos del PDF');
                }
            } else {
                throw new Error(response.message || 'Error generando PDF');
            }
        } catch (error: any) {
            console.error('Error generando vista previa:', error);
            addNotification({ message: `Error generando vista previa: ${error.message}`, type: 'error' });
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [pendingPayload, setPendingPayload] = useState<any>(null);
    const [pendingFormData, setPendingFormData] = useState<any>(null);

    const handleSubmit = async (formData: any) => {
        try {
            const payload = createInvoicePayload(formData);

            setPendingPayload(payload);
            setPendingFormData(formData);

            // MODO PRUEBA: Mostrar modal con JSON antes de guardar
            if (isTestMode) {
                setJsonContent(JSON.stringify(payload, null, 2));
                setJsonModalOpen(true);
                return; // Detener flujo aquí, esperar confirmación en el modal
            }

            // MODO PRODUCCIÓN: Confirmación estándar
            setConfirmModalOpen(true);

        } catch (error: any) {
            console.error('Error en proceso de facturación:', error);
            addNotification({ message: `Error: ${error.message}`, type: 'error' });
        }
    };

    const handleConfirmSend = async () => {
        setConfirmModalOpen(false);
        setJsonModalOpen(false); // También cerrar modal JSON si estaba abierto

        if (pendingPayload && pendingFormData) {
            addNotification({ message: isTestMode ? 'Guardando en base de datos (Modo Prueba)...' : 'Enviando a la DIAN...', type: 'info' });
            await proceedWithInvoice(pendingPayload, pendingFormData);
        }
    };

    const proceedWithInvoice = async (payload: any, formData: any) => {
        try {
            let cufe = '';

            if (isTestMode) {
                // MODO PRUEBA: Simular CUFE y no enviar a DIAN
                cufe = 'PRUEBA-' + new Date().getTime() + '-' + Math.random().toString(36).substring(7).toUpperCase();
                addNotification({ message: 'Modo Prueba: DIAN omitido. Guardando en BD...', type: 'warning' });
            } else {
                // MODO PRODUCCIÓN: Enviar a DIAN
                const dianResponse = await apiClient.sendManualDianTest(payload);
                if (!dianResponse.success) {
                    throw new Error(dianResponse.message || 'Error enviando a DIAN');
                }

                cufe = (dianResponse as any).dianResult?.cufe || (dianResponse as any).dianResult?.uuid || 'CUFE_PENDIENTE';

                // Set success data for modal
                setSuccessCufe(cufe);
                setSuccessDocumentNumber(formData.number);
                setIsSuccessModalOpen(true);

                // Descargar PDF automáticamente si la DIAN lo devuelve
                const pdfUrl = (dianResponse as any).dianResult?.pdf_url;
                if (pdfUrl) {
                    try {
                        addNotification({ message: 'Descargando documento ofical...', type: 'info' });
                        const link = document.createElement('a');
                        link.href = pdfUrl;
                        link.setAttribute('download', `Factura_${formData.number}.pdf`);
                        link.setAttribute('target', '_blank');
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    } catch (e) {
                        console.error("Error auto-descargando PDF", e);
                    }
                }
            }

            // 3. Guardar en DB usando el endpoint estándar (Funciona para todas las empresas)

            // IMPORTANTE: La BD almacena codter SIN el DV, solo el número de identificación
            // El DV solo se usa en el payload DIAN, no en la BD
            const clienteIdForDB = formData.customer.identification_number;

            // Recalcular totales para el cuerpo de la factura
            const totals = formData.items.reduce((acc: any, item: any) => {
                const subtotal = item.precioUnitario * item.cantidad;
                const discount = subtotal * (item.descuentoPorcentaje / 100);
                const taxBase = subtotal - discount;
                const taxAmount = taxBase * (item.ivaPorcentaje / 100);
                return {
                    lineExtensionAmount: acc.lineExtensionAmount + subtotal,
                    taxAmount: acc.taxAmount + taxAmount,
                    payableAmount: acc.payableAmount + (taxBase + taxAmount)
                };
            }, { lineExtensionAmount: 0, taxAmount: 0, payableAmount: 0 });

            // Mapear datos del formulario al formato esperado por createInvoice del backend
            console.log('📋 Items originales del formulario:', formData.items);

            const backendItems = formData.items.map((item: any, index: number) => {
                const subtotalItem = item.precioUnitario * item.cantidad;
                const ivaItem = subtotalItem * (item.ivaPorcentaje / 100);

                const mappedItem = {
                    codProducto: item.codProducto || item.referencia || '001',
                    productoId: item.productoId,
                    cantidad: item.cantidad,
                    precioUnitario: item.precioUnitario,
                    ivaPorcentaje: item.ivaPorcentaje,
                    valorIva: ivaItem,
                    subtotal: subtotalItem,
                    total: subtotalItem + ivaItem,
                    descripcion: item.descripcion || '',
                    referencia: item.referencia || ''
                };

                console.log(`📦 Item ${index + 1} mapeado:`, {
                    original: { productoId: item.productoId, codProducto: item.codProducto, descripcion: item.descripcion },
                    mapeado: { productoId: mappedItem.productoId, codProducto: mappedItem.codProducto }
                });

                return mappedItem;
            });

            console.log('📦 Todos los items a enviar al backend:', backendItems);

            // Determinar valores de pago según el método seleccionado
            let valEfectivo = 0;
            let valCredito = 0;
            let valTransferencia = 0;
            let formaPagoBackend = '01'; // Default Contado

            // Mapeo basado en nueva solicitud: 9=Efectivo, 44=Crédito, 30=Transferencia
            if (formData.paymentMethodId === '9') {
                valEfectivo = totals.payableAmount;
                formaPagoBackend = '01';
            } else if (formData.paymentMethodId === '44') {
                valCredito = totals.payableAmount;
                formaPagoBackend = '02';
            } else if (formData.paymentMethodId === '30') {
                valTransferencia = totals.payableAmount;
                formaPagoBackend = '01';
            } else {
                // Default fallback
                valEfectivo = totals.payableAmount;
            }

            const invoiceBody = {
                numeroFactura: formData.number,
                fechaFactura: formData.date,
                fechaVencimiento: formData.dueDate,
                clienteId: clienteIdForDB, // Solo el número de identificación, SIN DV (e.g. 900123456)
                vendedorId: formData.seller || '001', // Código del vendedor seleccionado
                subtotal: totals.lineExtensionAmount,
                ivaValor: totals.taxAmount,
                total: totals.payableAmount,
                observaciones: 'Factura Directa',
                estado: 'APROBADA', // Ya fue enviada a DIAN
                // empresaId: selectedCompany?.id, // SE COMENTA PARA QUE EL BACKEND TOME EL ALMACÉN 001 POR DEFECTO
                codalm: '001', // Almacén principal
                items: backendItems,
                formaPago: formaPagoBackend,
                efectivo: valEfectivo,
                credito: valCredito,
                transferencia: valTransferencia,
                cufe: cufe,
                resolucionDian: '98', // Corregido a '98' según solicitud
                estadoEnvio: true, // Marcar como enviada
                isDirectInvoice: true // ACTIVAR USO DE STORED PROCEDURE (Sp_Grabar_Factura_Venta)
            };

            console.log('Enviando a guardar BD:', invoiceBody);
            const saveResponse = await apiClient.createFactura(invoiceBody);

            if (!saveResponse.success) {
                console.error("Error guardando factura:", saveResponse);
                throw new Error(saveResponse.message || 'Error guardando en base de datos');
            }

            addNotification({ message: 'Factura guardada exitosamente', type: 'success' });
            await refreshFacturasYRemisiones();

            // Only redirect immediately if NOT showing the modal (e.g. Test Mode or fallback)
            // If showing modal, the close handler will do the redirect
            if (isTestMode) {
                setPage('facturacion_electronica');
            }

        } catch (error: any) {
            console.error(error);
            addNotification({ message: error.message || 'Error en el proceso', type: 'error' });
        }
    };

    return (
        <div className="animate-fade-in space-y-4">

            <div className="flex justify-end items-center mb-4">

                <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${isTestMode ? 'text-amber-600' : 'text-slate-400'}`}>
                        {isTestMode ? 'MODO PRUEBA' : 'Producción'}
                    </span>
                    <button
                        onClick={() => setIsTestMode(!isTestMode)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${isTestMode ? 'bg-amber-500' : 'bg-slate-200'
                            }`}
                    >
                        <span
                            className={`${isTestMode ? 'translate-x-5' : 'translate-x-1'
                                } inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                        />
                    </button>
                </div>
            </div>

            <Card className="mb-6">
                <CardContent>
                    <FacturaDirectaForm
                        onSubmit={handleSubmit}
                        onPreview={handlePreview}
                        nextInvoiceNumber={nextNumber}
                        onCancel={() => setPage('facturacion_electronica')}
                    />
                </CardContent>
            </Card>

            {/* Modal de Confirmación DIAN */}
            <Modal
                isOpen={confirmModalOpen}
                onClose={() => setConfirmModalOpen(false)}
                title="Confirmar Envío DIAN"
                size="md"
            >
                <div className="p-6">
                    <div className="flex items-center justify-center mb-4 text-amber-500">
                        <i className="fas fa-exclamation-triangle text-5xl"></i>
                    </div>
                    <h3 className="text-center text-lg font-bold text-slate-800 dark:text-white mb-2">
                        ¿Estás seguro de enviar esta factura a la DIAN?
                    </h3>
                    <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-6">
                        {isTestMode
                            ? "Estás en MODO PRUEBA. La factura se guardará en la base de datos pero NO se enviará a la DIAN."
                            : "Esta acción generará un documento oficial con validez fiscal. Asegúrate de que todos los datos sean correctos."}
                    </p>

                    <div className="flex justify-center gap-4">
                        <button
                            onClick={() => setConfirmModalOpen(false)}
                            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmSend}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-lg shadow-blue-500/30"
                        >
                            Sí, {isTestMode ? "Guardar en BD" : "Enviar Factura"}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal para ver JSON en Modo Prueba */}
            <Modal
                isOpen={jsonModalOpen}
                onClose={() => setJsonModalOpen(false)}
                title="Vista Previa JSON (Modo Prueba)"
                size="4xl"
            >
                <div className="p-4">
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <i className="fas fa-info-circle text-blue-500"></i>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-blue-700">
                                    Esta es la estructura JSON exacta que se enviaría a la DIAN.
                                    Revisa los campos críticos (impuestos, totales, fechas).
                                    <br />
                                    <strong>Si todo está correcto, haz clic en "Confirmar y Guardar" al final.</strong>
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                        <div className="flex justify-between items-center px-4 py-2 bg-slate-50 border-b border-slate-200">
                            <span className="text-xs font-mono text-slate-500 font-medium">payload_dian.json</span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(jsonContent);
                                    addNotification({ message: 'JSON copiado al portapapeles', type: 'success' });
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                            >
                                <i className="fas fa-copy"></i> Copiar
                            </button>
                        </div>
                        <pre className="p-4 text-xs font-mono text-slate-700 overflow-auto max-h-[60vh] bg-white">
                            {jsonContent}
                        </pre>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={() => setJsonModalOpen(false)}
                            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmSend}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-lg shadow-green-500/30 flex items-center gap-2"
                        >
                            <span>Confirmar y Guardar</span>
                            <i className="fas fa-check"></i>
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal para Vista Previa PDF */}
            <Modal
                isOpen={isPreviewModalOpen}
                onClose={() => setIsPreviewModalOpen(false)}
                title="Vista Previa Factura"
                size="4xl"
                noPadding={true}
            >
                {/* Contenedor principal: h-[80vh] define el área total disponible */}
                <div className="flex flex-col h-[80vh] w-full min-h-0 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden">

                    {/* Contenedor del PDF: flex-1 para que crezca y ocupe todo el espacio central */}
                    <div className="flex-1 relative min-h-0 w-full overflow-hidden bg-slate-200">
                        {pdfPreviewUrl ? (
                            <iframe
                                src={`${pdfPreviewUrl}#toolbar=0&navpanes=0&pagemode=none&view=FitH`}
                                title="Vista Previa PDF"
                                className="absolute inset-0 w-full border-none"
                                /* Forzamos el alto al 100% para ignorar el 'height: auto' global */
                                style={{ height: '100%', display: 'block' }}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <i className="fas fa-file-pdf text-4xl mb-2 opacity-50"></i>
                                <span className="font-medium">No hay vista previa disponible</span>
                            </div>
                        )}
                    </div>

                    {/* Footer: p-4 y shrink-0 para que no se comprima */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0">
                        <div className="flex items-center text-sm text-slate-500 gap-2">
                            <i className="fas fa-info-circle text-blue-500"></i>
                            <span className="hidden sm:inline">Revisa el documento antes de confirmar.</span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = pdfPreviewUrl;
                                    link.setAttribute('download', pdfFilename || 'documento.pdf');
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold transition-colors flex items-center gap-2 text-sm"
                            >
                                <i className="fas fa-download"></i> Descargar
                            </button>
                            <button
                                onClick={() => setIsPreviewModalOpen(false)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-sm transition-colors text-sm"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>

            {isGeneratingPdf && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center border border-slate-200 dark:border-slate-700">
                        <div className="mb-6 relative">
                            <div className="w-20 h-20 border-4 border-slate-100 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <i className="fas fa-file-pdf text-blue-600 text-2xl animate-pulse"></i>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Generando Factura</h3>
                        <p className="text-slate-500 dark:text-slate-400">
                            Estamos procesando tu solicitud y generando el PDF...
                        </p>
                    </div>
                </div>
            )}
            {/* Modal de éxito DIAN */}
            <DIANSuccessModal
                isOpen={isSuccessModalOpen}
                onClose={() => {
                    setIsSuccessModalOpen(false);
                    // Reset page or reload data if needed
                    refreshFacturasYRemisiones();
                    setPage('facturacion_electronica');
                }}
                cufe={successCufe}
                documentType="factura"
                documentNumber={successDocumentNumber}
            />
        </div>
    );
};

export default FacturaDirectaPage;
