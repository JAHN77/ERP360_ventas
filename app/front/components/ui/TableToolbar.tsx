import React from 'react';
import ProtectedComponent from '../auth/ProtectedComponent';

interface FilterOption {
  label: string;
  value: string;
}

interface TableToolbarProps {
  searchTerm: string;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  createActionLabel?: string;
  onCreateAction?: () => void;
  exportActionLabel?: string;
  onExportAction?: () => void;
  exportActionDisabled?: boolean;
  onCustomizeColumns?: () => void; // New prop
  filterOptions?: FilterOption[];
  activeFilter?: string;
  onFilterChange?: (value: string) => void;
  additionalFilters?: React.ReactNode;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({ 
  searchTerm, 
  onSearchChange, 
  createActionLabel, 
  onCreateAction,
  exportActionLabel,
  onExportAction,
  exportActionDisabled = false,
  onCustomizeColumns,
  filterOptions,
  activeFilter,
  onFilterChange,
  additionalFilters
}) => {
  const createPermission = createActionLabel?.toLowerCase().includes('cliente') ? 'clientes:create' 
    : createActionLabel?.toLowerCase().includes('producto') ? 'productos:create'
    : createActionLabel?.toLowerCase().includes('cotización') ? 'cotizaciones:create'
    : createActionLabel?.toLowerCase().includes('pedido') ? 'pedidos:create'
    : 'admin:review-critical-actions'; // Fallback to a restrictive permission

  return (
    <div className="flex flex-col gap-3 sm:gap-4 p-3 sm:p-4 md:p-6 bg-white dark:bg-slate-800 rounded-t-lg">
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center w-full gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row w-full sm:w-auto items-center gap-4">
            <div className="relative w-full sm:w-auto sm:max-w-xs">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"></i>
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={onSearchChange}
                  className="w-full pl-11 pr-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
            </div>
             {onCustomizeColumns && (
                <button 
                    onClick={onCustomizeColumns}
                    title="Personalizar columnas de la tabla"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors flex-shrink-0"
                >
                    <i className="fas fa-columns"></i>
                    <span className="hidden sm:inline">Personalizar</span>
                </button>
            )}
            {additionalFilters}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-shrink-0 flex-wrap">
            {onExportAction && exportActionLabel && (
                <button 
                    onClick={onExportAction}
                    disabled={exportActionDisabled}
                    className="px-3 sm:px-4 py-2 sm:py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-sm hover:shadow-md w-full sm:w-auto flex items-center justify-center text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {exportActionDisabled ? (
                        <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            <span className="hidden xs:inline">{exportActionLabel}</span>
                            <span className="xs:hidden">Generando...</span>
                        </>
                    ) : (
                        <>
                            <i className="fas fa-file-excel mr-2"></i>
                            <span className="hidden xs:inline">{exportActionLabel}</span>
                            <span className="xs:hidden">Exportar</span>
                        </>
                    )}
                </button>
            )}
            {onCreateAction && createActionLabel && (
               <ProtectedComponent permission={createPermission as any}>
                 <button onClick={onCreateAction} className="px-3 sm:px-5 py-2 sm:py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md w-full sm:w-auto flex items-center justify-center text-xs sm:text-sm">
                    <i className="fas fa-plus mr-2"></i>
                    <span className="hidden xs:inline">{createActionLabel}</span>
                    <span className="xs:hidden">Nuevo</span>
                 </button>
               </ProtectedComponent>
            )}
        </div>
      </div>
    </div>
  );
};