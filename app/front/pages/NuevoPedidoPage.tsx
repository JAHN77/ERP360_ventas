import React, { useState } from 'react';
import PedidoForm from '../components/comercial/PedidoForm';
import Card, { CardContent } from '../components/ui/Card';
import { useNavigation } from '../hooks/useNavigation';
import { DocumentItem } from '../types';
import Modal from '../components/ui/Modal';
import { useData } from '../hooks/useData';
import { useNotifications } from '../hooks/useNotifications';

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
}

const NuevoPedidoPage: React.FC = () => {
    const { setPage } = useNavigation();
    const { crearPedido } = useData();
    const { addNotification } = useNotifications();
    const [isCancelConfirmOpen, setCancelConfirmOpen] = useState(false);
    const [isFormDirty, setFormDirty] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

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
            });
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
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Crear Nuevo Pedido</h1>
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