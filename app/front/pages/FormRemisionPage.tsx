import React, { useState, useEffect } from 'react';
import { useNavigation } from '../hooks/useNavigation';
import { useData } from '../hooks/useData';
import { Remision } from '../types';
import Card, { CardContent } from '../components/ui/Card';
import RemisionForm from '../components/comercial/RemisionForm';
import Modal from '../components/ui/Modal';
import { useNotifications } from '../hooks/useNotifications';

const FormRemisionPage: React.FC = () => {
  const { params, setPage } = useNavigation();
  const { getRemisionById, actualizarRemision } = useData();
  const { addNotification } = useNotifications();
  const [remision, setRemision] = useState<Remision | null>(null);
  const [isCancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isFormDirty, setFormDirty] = useState(false);

  useEffect(() => {
    if (params.id) {
      const fetchedRemision = getRemisionById(params.id);
      if (fetchedRemision) {
        setRemision(fetchedRemision);
      } else {
        addNotification({ message: 'Remisión no encontrada', type: 'warning' });
        setPage('remisiones');
      }
    }
  }, [params.id, setPage, getRemisionById, addNotification]);

  const handleSubmit = async (data: { observaciones?: string }) => {
    if (remision) {
      const updated = await actualizarRemision(remision.id, data);
      if (updated) {
        addNotification({ message: `Remisión ${updated.numeroRemision} actualizada con éxito.`, type: 'success' });
      } else {
        addNotification({ message: 'Error al actualizar la remisión.', type: 'warning' });
      }
      setPage('remisiones');
    }
  };

  const handleCancel = () => {
    if (isFormDirty) {
        setCancelConfirmOpen(true);
    } else {
        setPage('remisiones');
    }
  };

  const executeCancel = () => {
    setCancelConfirmOpen(false);
    setPage('remisiones');
  };
  
  if (!remision) {
      return <div>Cargando...</div> // O un spinner
  }

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">
        Editar Remisión: {remision.numeroRemision}
      </h1>
      <Card>
        <CardContent>
          <RemisionForm
            initialData={remision}
            onSubmit={handleSubmit}
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

export default FormRemisionPage;