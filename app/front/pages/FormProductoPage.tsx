import React, { useState, useEffect } from 'react';
import { useNavigation } from '../hooks/useNavigation';
import { useNotifications } from '../hooks/useNotifications';
import { InvProducto } from '../types';
import Card, { CardContent } from '../components/ui/Card';
import ProductoForm from '../components/productos/ProductoForm';
import Modal from '../components/ui/Modal';
import { useData } from '../hooks/useData';

const FormProductoPage: React.FC = () => {
  const { page, params, setPage } = useNavigation();
  const { addNotification } = useNotifications();
  const { getProductoById, crearProducto, actualizarProducto } = useData();
  const [producto, setProducto] = useState<InvProducto | null>(null);
  const [isCancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isFormDirty, setFormDirty] = useState(false);

  const isEditing = page === 'editar_producto';

  useEffect(() => {
    if (isEditing && params.id) {
      const fetchedProducto = getProductoById(params.id);
      if (fetchedProducto) {
        setProducto(fetchedProducto);
      } else {
        addNotification({ type: 'error', message: 'Producto no encontrado' });
        setPage('productos');
      }
    }
  }, [isEditing, params.id, setPage, getProductoById]);

  const handleSubmit = (data: Omit<InvProducto, 'id'>) => {
    if (isEditing && producto) {
      actualizarProducto(producto.id, data);
      addNotification({ type: 'success', message: 'Producto actualizado con éxito' });
    } else {
      crearProducto(data);
      addNotification({ type: 'success', message: 'Producto creado con éxito' });
    }
    setPage('productos');
  };

  const handleCancel = () => {
    if (isFormDirty) {
      setCancelConfirmOpen(true);
    } else {
      setPage('productos');
    }
  };

  const executeCancel = () => {
    setCancelConfirmOpen(false);
    setPage('productos');
  };

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">
        {isEditing ? 'Editar Producto' : 'Crear Nuevo Producto'}
      </h1>
      <Card>
        <CardContent>
          <ProductoForm
            initialData={producto}
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

export default FormProductoPage;
