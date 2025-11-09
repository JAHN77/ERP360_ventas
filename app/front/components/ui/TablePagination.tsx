import React from 'react';

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
    if (totalItems <= rowsPerPageOptions[0] && totalPages <= 1) return null;
    
    const startItem = totalItems > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0;
    const endItem = Math.min(currentPage * rowsPerPage, totalItems);

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
      <nav className="inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
        <button
          onClick={onPreviousPage}
          disabled={!canPreviousPage}
          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-medium text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span className="sr-only">Anterior</span>
          <i className="fas fa-chevron-left h-5 w-5"></i>
        </button>
        <span className="relative inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200">
            Página {currentPage} de {totalPages > 0 ? totalPages : 1}
        </span>
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