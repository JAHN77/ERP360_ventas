import React, { useState, useEffect } from 'react';
import { useNavigation } from '../hooks/useNavigation';
import { Cliente } from '../types';
import Card, { CardContent } from '../components/ui/Card';
import ClienteForm from '../components/clientes/ClienteForm';
import Modal from '../components/ui/Modal';
import { useData } from '../hooks/useData';

const FormClientePage: React.FC = () => {
  const { page, params, setPage } = useNavigation();
  const { clientes, crearCliente, actualizarCliente, isMainDataLoaded } = useData();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [isCancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isFormDirty, setFormDirty] = useState(false);

  const isEditing = page === 'editar_cliente';

  if (isEditing && !isMainDataLoaded) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  useEffect(() => {
    if (isEditing && params.id) {
      const fetchedCliente = clientes.find(c => c.id === params.id);
      if (fetchedCliente) {
        setCliente(fetchedCliente);
      } else {
        alert('Cliente no encontrado');
        setPage('clientes');
      }
    }
  }, [isEditing, params.id, setPage, clientes]);

  const handleSubmit = (data: Omit<Cliente, 'id' | 'condicionPago' | 'activo' | 'createdAt' | 'nombreCompleto'>) => {
    if (isEditing && cliente) {
      actualizarCliente(cliente.id, data);
      alert('Cliente actualizado con éxito');
    } else {
      crearCliente(data);
      alert('Cliente creado con éxito');
    }
    setPage('clientes');
  };

  const handleCancel = () => {
    if (isFormDirty) {
      setCancelConfirmOpen(true);
    } else {
      setPage('clientes');
    }
  };

  const executeCancel = () => {
    setCancelConfirmOpen(false);
    setPage('clientes');
  };

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">
        {isEditing ? 'Editar Cliente' : 'Crear Nuevo Cliente'}
      </h1>
      <Card>
        <CardContent>
          <ClienteForm
            initialData={cliente}
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

export default FormClientePage;