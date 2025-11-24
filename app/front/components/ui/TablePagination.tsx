import React, { useState, useEffect } from 'react';

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  totalItems: number;
  rowsPerPage: number;
  setRowsPerPage: (rows: number) => void;
  rowsPerPageOptions?: number[];
}

const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  canPreviousPage,
  canNextPage,
  onPreviousPage,
  onNextPage,
  totalItems,
  rowsPerPage,
  setRowsPerPage,
  rowsPerPageOptions = [10, 20, 50],
}) => {
    const [pageInput, setPageInput] = useState<string>(String(currentPage));
    
    // Actualizar el input cuando cambie la página actual
    useEffect(() => {
        setPageInput(String(currentPage));
    }, [currentPage]);
    
    if (totalItems <= rowsPerPageOptions[0] && totalPages <= 1) return null;
    
    const startItem = totalItems > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0;
    const endItem = Math.min(currentPage * rowsPerPage, totalItems);
    
    const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Permitir solo números y campo vacío temporalmente
        if (value === '' || /^\d+$/.test(value)) {
            setPageInput(value);
        }
    };
    
    const handleGoToPage = () => {
        const pageNumber = parseInt(pageInput, 10);
        if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages) {
            onPageChange(pageNumber);
        } else {
            // Si el valor no es válido, restaurar el valor actual
            setPageInput(String(currentPage));
        }
    };
    
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleGoToPage();
        }
    };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-b-lg border-t border-slate-200 dark:border-slate-700 text-sm gap-4">
        <div className="flex items-center gap-x-4">
            <div className="flex items-center gap-2">
                <label htmlFor="rowsPerPage" className="text-slate-600 dark:text-slate-400">Filas por página:</label>
                <select
                    id="rowsPerPage"
                    value={rowsPerPage}
                    onChange={(e) => setRowsPerPage(Number(e.target.value))}
                    className="py-1 pl-2 pr-7 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                    {rowsPerPageOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
            </div>
            <div className="text-slate-600 dark:text-slate-400">
                Mostrando {startItem} - {endItem} de {totalItems}
            </div>
        </div>
      <nav className="inline-flex items-center gap-2" aria-label="Pagination">
        <button
          onClick={onPreviousPage}
          disabled={!canPreviousPage}
          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-medium text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span className="sr-only">Anterior</span>
          <i className="fas fa-chevron-left h-5 w-5"></i>
        </button>
        <div className="flex items-center gap-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md px-2 py-1">
          <span className="text-slate-600 dark:text-slate-400 text-sm whitespace-nowrap">Página</span>
          <input
            type="text"
            value={pageInput}
            onChange={handlePageInputChange}
            onKeyPress={handleKeyPress}
            onBlur={handleGoToPage}
            className="w-12 text-center text-sm font-medium text-slate-700 dark:text-slate-200 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
            aria-label="Número de página"
          />
          <span className="text-slate-600 dark:text-slate-400 text-sm whitespace-nowrap">de {totalPages > 0 ? totalPages : 1}</span>
        </div>
        <button
          onClick={onNextPage}
          disabled={!canNextPage}
          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-medium text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span className="sr-only">Siguiente</span>
          <i className="fas fa-chevron-right h-5 w-5"></i>
        </button>
      </nav>
    </div>
  );
};

export default TablePagination;