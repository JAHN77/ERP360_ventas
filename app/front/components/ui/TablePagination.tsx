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
    <div className="flex flex-col sm:flex-row items-center justify-between w-full px-2 py-3 text-sm text-slate-500 dark:text-slate-400 select-none">

      {/* Left Side: Info & Rows per page */}
      <div className="flex items-center gap-4 md:gap-6 mb-4 sm:mb-0">
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline font-medium">Filas:</span>
          <div className="relative">
            <select
              id="rowsPerPage"
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="appearance-none pl-3 pr-8 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-200 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {rowsPerPageOptions.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
              <i className="fas fa-chevron-down text-xs"></i>
            </div>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block"></div>

        <span className="font-medium">
          {startItem}-{endItem} <span className="text-slate-400 dark:text-slate-500 font-normal">de</span> <span className="text-slate-800 dark:text-white font-bold">{totalItems}</span>
        </span>
      </div>

      {/* Right Side: Navigation */}
      <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
        <button
          onClick={onPreviousPage}
          disabled={!canPreviousPage}
          className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 focus:z-20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span className="sr-only">Anterior</span>
          <i className="fas fa-chevron-left text-xs"></i>
        </button>

        <div className="relative inline-flex items-center px-4 border-y border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200">
          <span className="mr-2 hidden sm:inline text-slate-400 font-normal">Página</span>
          <input
            type="text"
            value={pageInput}
            onChange={handlePageInputChange}
            onKeyPress={handleKeyPress}
            onBlur={handleGoToPage}
            className="w-12 text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded py-1 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none sm:text-sm"
            aria-label="Número de página"
          />
          <span className="ml-2 text-slate-400 font-normal">
            de <span className="text-slate-800 dark:text-white font-bold">{totalPages > 0 ? totalPages : 1}</span>
          </span>
        </div>

        <button
          onClick={onNextPage}
          disabled={!canNextPage}
          className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 focus:z-20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span className="sr-only">Siguiente</span>
          <i className="fas fa-chevron-right text-xs"></i>
        </button>
      </nav>
    </div>
  );
};

export default TablePagination;