import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Sede } from '../../types';

interface BodegaSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BodegaSelectorModal: React.FC<BodegaSelectorModalProps> = ({ isOpen, onClose }) => {
  const { selectedCompany, switchSede, isLoadingBodegas } = useAuth();
  const [selectedBodegaId, setSelectedBodegaId] = useState<string>('');

  const bodegas = selectedCompany?.sedes || [];

  useEffect(() => {
    if (bodegas.length > 0 && !selectedBodegaId) {
      // Pre-seleccionar la primera bodega por defecto
      setSelectedBodegaId(String(bodegas[0].id));
    }
  }, [bodegas, selectedBodegaId]);

  const handleConfirm = () => {
    if (selectedBodegaId) {
      const bodegaSeleccionada = bodegas.find(b => String(b.id) === selectedBodegaId);
      if (bodegaSeleccionada) {
        switchSede(bodegaSeleccionada.id, {
          codigo: bodegaSeleccionada.codigo,
          nombre: bodegaSeleccionada.nombre
        });
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            Seleccionar Bodega
          </h2>
        </div>
        
        <div className="mb-6">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Por favor, selecciona una bodega para continuar:
          </p>
          
          {isLoadingBodegas ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Cargando bodegas...</p>
            </div>
          ) : bodegas.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-red-600 dark:text-red-400">
                No hay bodegas disponibles
              </p>
            </div>
          ) : (
            <select
              value={selectedBodegaId}
              onChange={(e) => setSelectedBodegaId(e.target.value)}
              className="w-full px-4 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {bodegas.map((bodega: Sede) => (
                <option key={bodega.id} value={String(bodega.id)}>
                  {bodega.nombre || `Bodega ${bodega.codigo}`} {bodega.codigo ? `(${bodega.codigo})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleConfirm}
            disabled={!selectedBodegaId || isLoadingBodegas || bodegas.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default BodegaSelectorModal;

