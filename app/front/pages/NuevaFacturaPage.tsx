import React, { useState, useEffect } from 'react';
import FacturaForm from '../components/facturacion/FacturaForm';
import Card, { CardContent } from '../components/ui/Card';
import { useNavigation } from '../hooks/useNavigation';
import { DocumentItem } from '../types';
import Modal from '../components/ui/Modal';
import { useData } from '../hooks/useData';
import { useNotifications } from '../hooks/useNotifications';

import apiClient from '../services/apiClient';
import { createInvoicePayload } from '../utils/dianPayloadGenerator';

interface FacturaFormData {
    clienteId: string;
    vendedorId: string;
    items: DocumentItem[];
    subtotal: number;
    iva: number;
    total: number;
}

const NuevaFacturaPage: React.FC = () => {
    const { setPage } = useNavigation();

    const { crearFactura, clientes, vendedores } = useData();
    const { addNotification } = useNotifications();
    const [isCancelConfirmOpen, setCancelConfirmOpen] = useState(false);
    const [isFormDirty, setFormDirty] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [nextInvoiceNumber, setNextInvoiceNumber] = useState<string>('');
    const [currentDateString, setCurrentDateString] = useState<string>('');

    // Estados para Modo Prueba
    const [isTestMode, setIsTestMode] = useState(false);
    const [jsonModalOpen, setJsonModalOpen] = useState(false);
    const [jsonContent, setJsonContent] = useState<string>('');
    const [pendingFormData, setPendingFormData] = useState<FacturaFormData | null>(null);

    useEffect(() => {
        const today = new Date();
        setCurrentDateString(today.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }));

        const fetchNextNumber = async () => {
            try {
                const response = await apiClient.getNextInvoiceNumber();
                if (response.success && response.data) {
                    setNextInvoiceNumber(response.data.nextNumber);
                } else {
                    setNextInvoiceNumber('000001');
                }
            } catch (error) {
                console.error("Error fetching next invoice number", error);
                setNextInvoiceNumber('??????');
            }
        };

        fetchNextNumber();
    }, []);

    const handleCreateFactura = async (formData: FacturaFormData) => {
        if (isCreating) return;

        // Si está en modo prueba, interceptar y mostrar JSON
        if (isTestMode) {
            try {
                // Adaptar datos de FacturaForm a estructura DIAN para el preview
                const client = clientes.find(c => c.id === formData.clienteId);
                const seller = vendedores.find(v => v.id === formData.vendedorId);

                if (!client) {
                    addNotification({ message: 'Error: No se encontró información del cliente', type: 'error' });
                    return;
                }

                // Generar fechas por defecto
                const now = new Date();
                const dueDate = new Date(now);
                dueDate.setDate(dueDate.getDate() + 30); // 30 días crédito por defecto para preview
                const dateStr = now.toISOString().split('T')[0];
                const timeStr = now.toTimeString().split(' ')[0];
                const dueDateStr = dueDate.toISOString().split('T')[0];

                const payloadData = {
                    number: nextInvoiceNumber,
                    date: dateStr,
                    time: timeStr,
                    dueDate: dueDateStr,
                    paymentFormId: '2', // Default Crédito para el preview si no se especifica
                    paymentMethodId: '1', // Default Instrumento no definido
                    seller: seller?.codigoVendedor || '001',
                    observacionesInternas: 'Factura generada desde Nueva Factura (Modo Prueba)',
                    items: formData.items.map(item => ({
                        ...item,
                        codProducto: String(item.productoId).padStart(3, '0'), // Mock code if missing
                        referencia: String(item.productoId),
                        unit_measure_id: '70', // Unidad default
                        unidadMedidaCodigo: '94'
                    })),
                    customer: {
                        identification_number: client.numeroDocumento || '000000000',
                        name: client.nombreCompleto || client.razonSocial || client.nomter || 'Cliente Desconocido',
                        phone: client.telefono || client.celular || '0000000',
                        address: client.direccion || 'Sin dirección',
                        email: client.email || 'noemail@example.com',
                        type_document_id: client.tipoDocumentoId || '31', // NIT
                        type_liability_id: '100', // Default hardcoded as not in Cliente interface
                        type_regime_id: parseInt(client.regimenFiscalId || '1') || 1,
                        id_location: client.ciudadId || '11001',
                        dv: client.digitoVerificacion || ''
                    }
                };

                const payload = createInvoicePayload(payloadData);
                setJsonContent(JSON.stringify(payload, null, 2));
                setPendingFormData(formData);
                setJsonModalOpen(true);
                return;
            } catch (error: any) {
                console.error("Error generando preview JSON:", error);
                addNotification({ message: "Error generando vista previa JSON: " + error.message, type: 'error' });
                return;
            }
        }

        await executeCreateFactura(formData);
    };

    const executeCreateFactura = async (formData: FacturaFormData) => {
        setIsCreating(true);
        try {
            const { clienteId, vendedorId, items, subtotal, iva, total } = formData;
            addNotification({ message: isTestMode ? 'Guardando (Modo Prueba)...' : 'Creando factura...', type: 'info' });

            // En un flujo real de "Test Mode", aquí podríamos enviar a un endpoint específico de test
            // Por ahora, usamos el endpoint estándar de creación que guarda en borrador
            // pero podríamos añadir flags extras si el backend lo soportara.

            await crearFactura({
                clienteId,
                vendedorId,
                items,
                subtotal,
                ivaValor: iva,
                total,
            } as any);

            addNotification({ message: 'Factura creada exitosamente.', type: 'success' });
            setPage('facturacion_electronica');
        } catch (error) {
            console.error('Error al crear factura:', error);
            addNotification({ message: 'No se pudo crear la factura. Intenta nuevamente.', type: 'warning' });
        } finally {
            setIsCreating(false);
            setJsonModalOpen(false); // Cerrar modal si estaba abierto
        }
    };

    const handleConfirmTest = () => {
        if (pendingFormData) {
            executeCreateFactura(pendingFormData);
        }
    };

    const handleCancel = () => {
        if (isFormDirty) {
            setCancelConfirmOpen(true);
        } else {
            setPage('facturacion_electronica');
        }
    };

    const executeCancel = () => {
        setCancelConfirmOpen(false);
        setPage('facturacion_electronica');
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                        Nueva Factura {nextInvoiceNumber ? `#${nextInvoiceNumber}` : ''}
                    </h1>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1">
                        <p className="text-slate-500 dark:text-slate-400">
                            Diligencia el formulario para generar una nueva factura.
                        </p>
                        {currentDateString && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                <i className="far fa-calendar-alt mr-1"></i>
                                {currentDateString}
                            </span>
                        )}
                    </div>
                </div>
            </div>


            <div className="flex justify-end items-center mb-4">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                    <span className={`text-xs font-medium ${isTestMode ? 'text-amber-600' : 'text-slate-500'}`}>
                        {isTestMode ? 'MODO PRUEBA ACTIVADO' : 'Modo Estándar'}
                    </span>
                    <button
                        onClick={() => setIsTestMode(!isTestMode)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${isTestMode ? 'bg-amber-500' : 'bg-slate-200'}`}
                        type="button"
                    >
                        <span className={`${isTestMode ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} />
                    </button>
                </div>
            </div>

            <Card>
                <CardContent>
                    <FacturaForm
                        onSubmit={handleCreateFactura}
                        onCancel={handleCancel}
                        onDirtyChange={setFormDirty}
                        isSubmitting={isCreating}
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
                        <button onClick={() => setCancelConfirmOpen(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">
                            Volver
                        </button>
                        <button
                            onClick={executeCancel}
                            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                        >
                            Sí, cancelar
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
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <i className="fas fa-flask text-amber-500"></i>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-amber-700">
                                    Estás en <strong>Modo Prueba</strong>. Esta es la estructura JSON aproximada que se generaría para la DIAN.
                                    <br />
                                    Nota: Algunos campos (como medio de pago) se han predeterminado para esta vista previa ya que no están en el formulario básico.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                        <div className="flex justify-between items-center px-4 py-2 bg-slate-50 border-b border-slate-200">
                            <span className="text-xs font-mono text-slate-500 font-medium">preview_payload.json</span>
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
                        <pre className="p-4 text-xs font-mono text-slate-700 overflow-auto max-h-[50vh] bg-white">
                            {jsonContent}
                        </pre>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={() => setJsonModalOpen(false)}
                            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
                        >
                            Volver a Editar
                        </button>
                        <button
                            onClick={handleConfirmTest}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-lg shadow-green-500/30 flex items-center gap-2"
                        >
                            <span>Confirmar creación</span>
                            <i className="fas fa-check"></i>
                        </button>
                    </div>
                </div>
            </Modal>
        </div >
    );
};

export default NuevaFacturaPage;