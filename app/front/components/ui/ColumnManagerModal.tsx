import React, { useState, useRef, DragEvent, useEffect } from 'react';
import Modal from './Modal';
import { ManagedColumn } from '../../hooks/useColumnManager';
import { useTheme } from '../../hooks/useTheme';

interface ColumnManagerModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  columns: ManagedColumn<T>[];
  onSave: (columns: ManagedColumn<T>[]) => void;
  onReset: () => void;
}

const ColumnManagerModal = <T extends object>({ isOpen, onClose, columns, onSave, onReset }: ColumnManagerModalProps<T>) => {
  const [localColumns, setLocalColumns] = useState(columns);
  const draggedItem = useRef<number | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (isOpen) {
      setLocalColumns(columns);
    }
  }, [isOpen, columns]);

  const handleDragStart = (e: DragEvent<HTMLLIElement>, index: number) => {
    draggedItem.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent<HTMLLIElement>, index: number) => {
    e.preventDefault();
    if (draggedItem.current === null || draggedItem.current === index) {
      return;
    }

    const list = [...localColumns];
    const dragged = list.splice(draggedItem.current, 1)[0];
    list.splice(index, 0, dragged);
    draggedItem.current = index;
    setLocalColumns(list);
  };
  
  const handleDragEnd = () => {
    draggedItem.current = null;
  };

  const toggleVisibility = (accessor: keyof T) => {
    setLocalColumns(prev => prev.map(col => 
      col.accessor === accessor ? { ...col, isVisible: !col.isVisible } : col
    ));
  };
  
  const handleSave = () => {
    onSave(localColumns);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Personalizar Columnas" size="md">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Arrastre para reordenar las columnas. Desmarque para ocultarlas.
        </p>
        <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {localColumns.map((col, index) => (
            <li
              key={col.accessor as string}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-grab transition-all ${
                theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-100'
              }`}
            >
              <i className="fas fa-grip-vertical text-slate-400 dark:text-slate-500"></i>
              <input
                type="checkbox"
                checked={col.isVisible}
                onChange={() => toggleVisibility(col.accessor)}
                className="h-5 w-5 rounded border-slate-300 dark:border-slate-500 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-600"
              />
              <span className="flex-grow font-medium text-slate-800 dark:text-slate-200">{col.header}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between">
            <button
                onClick={onReset}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-transparent hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg"
            >
                Restablecer
            </button>
            <div className="flex gap-3">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 rounded-lg"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSave}
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                    Aplicar Cambios
                </button>
            </div>
        </div>
      </div>
    </Modal>
  );
};

export default ColumnManagerModal;