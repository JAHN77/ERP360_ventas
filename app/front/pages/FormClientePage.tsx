import React, { useState, useEffect } from 'react';
import { useNavigation } from '../hooks/useNavigation';
import { useNotifications } from '../hooks/useNotifications';
import { Cliente } from '../types';
import Card, { CardContent } from '../components/ui/Card';
import ClienteForm from '../components/clientes/ClienteForm';
import Modal from '../components/ui/Modal';
import { useData } from '../hooks/useData';

import { apiClient } from '../services/apiClient';

const FormClientePage: React.FC = () => {
  const { page, params, setPage } = useNavigation();
  const { addNotification } = useNotifications();
  const { clientes, crearCliente, actualizarCliente, isMainDataLoaded } = useData();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [isCancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isFormDirty, setFormDirty] = useState(false);
  const [isLoadingFetch, setIsLoadingFetch] = useState(false);

  const isEditing = page === 'editar_cliente';

  useEffect(() => {
    const fetchClientData = async () => {
      if (isEditing && params.id) {
        // 1. Try to find in global context first (fastest)
        const contextClient = clientes.find(c => String(c.id) === String(params.id));
        if (contextClient) {
          setCliente(contextClient);
          return;
        }

        // 2. If not found (e.g. new client, or context stale), fetch from API
        setIsLoadingFetch(true);
        try {
          const res = await apiClient.getClienteById(params.id);
          if (res.success && res.data) {
            setCliente(res.data as Cliente);
          } else {
            addNotification({ type: 'error', message: 'Cliente no encontrado en base de datos' });
            setPage('clientes');
          }
        } catch (error) {
          console.error('Error fetching client:', error);
          addNotification({ type: 'error', message: 'Error al cargar datos del cliente' });
          setPage('clientes');
        } finally {
          setIsLoadingFetch(false);
        }
      }
    };

    fetchClientData();
  }, [isEditing, params.id, clientes, setPage]);

  const handleSubmit = async (data: Omit<Cliente, 'id' | 'condicionPago' | 'activo' | 'createdAt' | 'nombreCompleto'>) => {
    try {
      if (isEditing && cliente) {
        await actualizarCliente(cliente.id, data);
        addNotification({ type: 'success', message: 'Cliente actualizado con éxito' });
      } else {
        await crearCliente(data);
        addNotification({ type: 'success', message: 'Cliente creado con éxito' });
      }
      setPage('clientes');
    } catch (error) {
      console.error(error);
      addNotification({ type: 'error', message: 'Error al guardar el cliente' });
    }
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

  if (isEditing && (!isMainDataLoaded && !cliente || isLoadingFetch)) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

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