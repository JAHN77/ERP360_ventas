import React from 'react';

type SortDirection = 'asc' | 'desc';

export interface Column<T> {
  header: string;
  accessor: keyof T;
  cell?: (item: T) => React.ReactNode;
}

export interface SortConfig<T> {
  key: keyof T | null;
  direction: SortDirection;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onSort: (key: keyof T) => void;
  sortConfig: SortConfig<T> | null;
  highlightRowId?: string | number;
  highlightClassName?: string;
}

const Table = <T extends { id: string | number }>({ columns, data, onSort, sortConfig, highlightRowId, highlightClassName }: TableProps<T>) => {
  const getSortIcon = (key: keyof T) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <i className="fas fa-sort text-slate-400 dark:text-slate-500 ml-2 opacity-50"></i>;
    }
    if (sortConfig.direction === 'asc') {
      return <i className="fas fa-sort-up text-blue-500 ml-2"></i>;
    }
    return <i className="fas fa-sort-down text-blue-500 ml-2"></i>;
  };

  const resolvedHighlightId = highlightRowId !== undefined && highlightRowId !== null ? String(highlightRowId) : null;
  const resolvedHighlightClass = highlightClassName || 'bg-blue-500/10 dark:bg-blue-500/20';

  return (
    <div className="w-full max-w-full">
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {data.length > 0 ? (
          data.map((item) => {
            const isHighlighted = resolvedHighlightId !== null && String(item.id) === resolvedHighlightId;
            return (
              <div
                key={item.id}
                className={`rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white/95 dark:bg-slate-800/80 shadow-sm px-4 py-3 space-y-3 transition-colors ${
                  isHighlighted ? 'ring-1 ring-blue-300/70 dark:ring-blue-500/40' : ''
                }`}
              >
                {columns.map((col, colIndex) => (
                  <div key={`card-${item.id}-${colIndex}`} className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{col.header}</span>
                    <div className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                      {col.cell ? col.cell(item) : (item[col.accessor] as React.ReactNode)}
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            <div className="flex flex-col items-center gap-2">
              <i className="fas fa-inbox text-3xl text-slate-400 dark:text-slate-600"></i>
              <p className="font-semibold">No se encontraron resultados</p>
              <span className="text-xs">Intenta modificar los filtros o la búsqueda.</span>
            </div>
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
      <div className="relative">
        <div className="overflow-x-auto lg:overflow-x-visible">
          <div className="inline-block min-w-full align-middle">
            <div className="shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700/70 border border-slate-200/70 dark:border-slate-700/60 sm:rounded-lg w-full">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 table-auto">
                <thead className="bg-slate-100 dark:bg-slate-700">
                  <tr>
                    {columns.map((col, colIndex) => (
                      <th
                        key={`header-${colIndex}-${String(col.accessor)}`}
                        scope="col"
                        className={`px-3 xs:px-4 sm:px-6 py-2.5 sm:py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider select-none hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors whitespace-normal ${
                          col.header === '✓' ? '' : 'cursor-pointer'
                        }`}
                        onClick={col.header === '✓' ? undefined : () => onSort(col.accessor)}
                      >
                        <div className="flex items-center">
                          <span>{col.header}</span>
                          {col.header !== '✓' && getSortIcon(col.accessor)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-transparent divide-y divide-slate-200 dark:divide-slate-700">
                  {data.length > 0 ? data.map((item) => {
                    const isHighlighted = resolvedHighlightId !== null && String(item.id) === resolvedHighlightId;
                    return (
                      <tr key={item.id} className={`hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors ${isHighlighted ? resolvedHighlightClass : ''}`}>
                        {columns.map((col, colIndex) => (
                          <td key={`cell-${item.id}-${colIndex}-${String(col.accessor)}`} className="px-3 xs:px-4 sm:px-6 py-3 sm:py-4 whitespace-normal break-words text-sm text-slate-700 dark:text-slate-300">
                            {col.cell ? col.cell(item) : (item[col.accessor] as React.ReactNode)}
                          </td>
                        ))}
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={columns.length} className="text-center py-10 sm:py-12 text-slate-500 dark:text-slate-400 text-sm">
                        <div className="flex flex-col items-center">
                          <i className="fas fa-inbox text-3xl sm:text-4xl text-slate-400 dark:text-slate-500 mb-3"></i>
                          <p className="font-semibold">No se encontraron resultados</p>
                          <p className="text-xs">Intente ajustar su búsqueda o filtros.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Table;