import React, { useState, useEffect } from 'react';
import PedidoForm from '../components/comercial/PedidoForm';
import Card, { CardContent } from '../components/ui/Card';
import { useNavigation } from '../hooks/useNavigation';
import { DocumentItem } from '../types';
import Modal from '../components/ui/Modal';
import { useData } from '../hooks/useData';
import { useNotifications } from '../hooks/useNotifications';
import apiClient from '../services/apiClient';

interface PedidoFormData {
    clienteId: string;
    vendedorId?: string;
    cotizacionId?: string;
    items: DocumentItem[];
    subtotal: number;
    iva: number;
    total: number;
    fechaEntregaEstimada?: string;
    instruccionesEntrega?: string;
    notaPago?: string;
    formaPago?: string;
}

const NuevoPedidoPage: React.FC = () => {
    const { setPage } = useNavigation();
    const { crearPedido } = useData();
    const { addNotification } = useNotifications();
    const [isCancelConfirmOpen, setCancelConfirmOpen] = useState(false);
    const [isFormDirty, setFormDirty] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [nextOrderNumber, setNextOrderNumber] = useState<string>('');
    const [currentDateString, setCurrentDateString] = useState<string>('');

    useEffect(() => {
        const today = new Date();
        setCurrentDateString(today.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }));

        const fetchNextNumber = async () => {
            try {
                const response = await apiClient.getNextOrderNumber();
                if (response.success && response.data) {
                    setNextOrderNumber(response.data.nextNumber);
                } else {
                    setNextOrderNumber('000001');
                }
            } catch (error) {
                console.error("Error fetching next order number", error);
                setNextOrderNumber('??????');
            }
        };

        fetchNextNumber();
    }, []);

    const handleCreatePedido = async (formData: PedidoFormData) => {
        if (isCreating) return;
        setIsCreating(true);
        try {
            addNotification({ message: 'Creando pedido...', type: 'info' });
            await crearPedido({
                clienteId: formData.clienteId,
                vendedorId: formData.vendedorId,
                cotizacionId: formData.cotizacionId,
                items: formData.items,
                subtotal: formData.subtotal,
                ivaValor: formData.iva,
                total: formData.total,
                fechaEntregaEstimada: formData.fechaEntregaEstimada,
                instruccionesEntrega: formData.instruccionesEntrega,
                notaPago: formData.notaPago,
                formaPago: formData.formaPago,
            } as any);
            addNotification({ message: 'Pedido creado exitosamente.', type: 'success' });
            setPage('pedidos');
        } catch (error) {
            console.error('Error al crear pedido:', error);
            addNotification({ message: 'No se pudo crear el pedido. Intenta nuevamente.', type: 'warning' });
        } finally {
            setIsCreating(false);
        }
    };

    const handleCancel = () => {
        if (isFormDirty) {
            setCancelConfirmOpen(true);
        } else {
            setPage('pedidos');
        }
    };

    const executeCancel = () => {
        setCancelConfirmOpen(false);
        setPage('pedidos');
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                        Nuevo Pedido {nextOrderNumber ? `#${nextOrderNumber}` : ''}
                    </h1>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1">
                        <p className="text-slate-500 dark:text-slate-400">
                            Diligencia el formulario para generar un nuevo pedido de venta.
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
            <Card>
                <CardContent>
                    <PedidoForm
                        onSubmit={handleCreatePedido}
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
        </div>
    );
};

export default NuevoPedidoPage;