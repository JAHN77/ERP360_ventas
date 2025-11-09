import React, { useState, useEffect } from 'react';
import { Remision } from '../../types';

interface RemisionFormProps {
  initialData: Remision;
  onSubmit: (data: { observaciones?: string }) => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const RemisionForm: React.FC<RemisionFormProps> = ({ initialData, onSubmit, onCancel, onDirtyChange }) => {
  const [observaciones, setObservaciones] = useState(initialData.observaciones || '');

  useEffect(() => {
    if (onDirtyChange) {
        onDirtyChange(observaciones !== (initialData.observaciones || ''));
    }
  }, [observaciones, initialData.observaciones, onDirtyChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ observaciones });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div><p className="font-semibold text-slate-600 dark:text-slate-400">Número Remisión:</p><p>{initialData.numeroRemision}</p></div>
            <div><p className="font-semibold text-slate-600 dark:text-slate-400">Fecha Emisión:</p><p>{initialData.fechaRemision}</p></div>
        </div>

        <div>
          <label htmlFor="observaciones" className="block text-sm font-medium text-slate-600 dark:text-slate-300">
            Observaciones
          </label>
          <textarea
            id="observaciones"
            name="observaciones"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={4}
            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
          />
        </div>

      <div className="pt-5 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">Cancelar</button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            <i className="fas fa-save mr-2"></i>
            Guardar Cambios
        </button>
      </div>
    </form>
  );
};

export default RemisionForm;
