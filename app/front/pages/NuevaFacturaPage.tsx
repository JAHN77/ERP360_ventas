import React, { useState } from 'react';
import FacturaForm from '../components/facturacion/FacturaForm';
import Card, { CardContent } from '../components/ui/Card';
import { useNavigation } from '../hooks/useNavigation';
import { DocumentItem } from '../types';
import Modal from '../components/ui/Modal';
import { useData } from '../hooks/useData';

interface FacturaFormData {
    clienteId: string;
    items: DocumentItem[];
    subtotal: number;
    iva: number;
    total: number;
}

const NuevaFacturaPage: React.FC = () => {
    const { setPage } = useNavigation();
    const { crearFactura } = useData();
    const [isCancelConfirmOpen, setCancelConfirmOpen] = useState(false);
    const [isFormDirty, setFormDirty] = useState(false);

    const handleCreateFactura = (formData: FacturaFormData) => {
        const { clienteId, items, subtotal, iva, total } = formData;
        
        crearFactura({
            clienteId,
            items,
            subtotal,
            ivaValor: iva,
            total,
        });

        alert('Factura creada exitosamente como borrador.');
        setPage('facturacion_electronica');
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
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Crear Nueva Factura</h1>
            </div>
            <Card>
                <CardContent>
                    <FacturaForm 
                        onSubmit={handleCreateFactura} 
                        onCancel={handleCancel}
                        onDirtyChange={setFormDirty} 
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

export default NuevaFacturaPage;