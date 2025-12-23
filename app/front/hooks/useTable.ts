import React, { useState, useMemo, useEffect, useCallback } from 'react';

type SortDirection = 'asc' | 'desc';

interface SortConfig<T> {
  key: keyof T | null;
  direction: SortDirection;
}

export interface UseTableProps<T> {
  data: T[];
  searchKeys?: (keyof T | ((item: T) => string))[];
  initialRowsPerPage?: number;
  manual?: boolean;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (rows: number) => void;
}

export const useTable = <T extends Record<string, any>>({
  data,
  searchKeys = [],
  initialRowsPerPage = 10,
  manual = false,
  totalItems: manualTotalItems = 0,
  onPageChange,
  onRowsPerPageChange
}: UseTableProps<T>) => {
  // ✅ Protección: Asegurar que data sea siempre un array
  const safeData = Array.isArray(data) ? data : [];

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, _setRowsPerPage] = useState(initialRowsPerPage);

  // Client-Side Filtering
  const filteredData = useMemo(() => {
    if (manual) return safeData; // Server handles filtering

    let filteredItems = [...safeData];
    if (searchTerm && searchKeys.length > 0) {
      const lowercasedFilter = searchTerm.toLowerCase();
      filteredItems = filteredItems.filter(item =>
        searchKeys.some(key => {
          const value = typeof key === 'function' ? key(item) : item[key];
          return String(value ?? '').toLowerCase().includes(lowercasedFilter);
        })
      );
    }
    return filteredItems;
  }, [safeData, searchTerm, searchKeys, manual]);

  // Client-Side Sorting
  const sortedData = useMemo(() => {
    if (manual) return filteredData; // Server handles sorting

    let sortableItems = [...filteredData];
    if (sortConfig.key !== null) {
      const collator = new Intl.Collator('es-CO', { sensitivity: 'base', ignorePunctuation: true, numeric: true });
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key!];
        const valB = b[sortConfig.key!];

        // Manejo de strings con letras primero que números/símbolos
        if (typeof valA === 'string' && typeof valB === 'string') {
          const aStr = valA.trim();
          const bStr = valB.trim();
          const startsWithLetter = (s: string) => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(s);
          const aIsLetter = startsWithLetter(aStr);
          const bIsLetter = startsWithLetter(bStr);
          if (aIsLetter !== bIsLetter) {
            const result = aIsLetter ? -1 : 1; // letras antes que no-letras
            return sortConfig.direction === 'asc' ? result : -result;
          }
          const cmp = collator.compare(aStr, bStr);
          return sortConfig.direction === 'asc' ? cmp : -cmp;
        }

        // Fallback genérico para otros tipos
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig, manual]);

  const totalPages = Math.ceil((manual ? manualTotalItems : sortedData.length) / rowsPerPage);

  // Client-Side Pagination
  const paginatedData = useMemo(() => {
    if (manual) return sortedData; // Server provides only current page data

    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage, manual]);

  // Effect to adjust page if filters reduce total pages below current page
  useEffect(() => {
    if (!manual && currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (!manual && totalPages === 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages, manual]);

  const requestSort = useCallback((key: keyof T) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    if (!manual) setCurrentPage(1); // Reset to first page on sort in client mode
  }, [sortConfig, manual]);

  const handleSearch = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1); // Reset to first page on search
  }, []);

  const setRowsPerPage = useCallback((numRows: number) => {
    _setRowsPerPage(numRows);
    setCurrentPage(1); // Reset to first page when rows per page changes
    if (onRowsPerPageChange) onRowsPerPageChange(numRows);
  }, [onRowsPerPageChange]);

  const nextPage = useCallback(() => {
    const nextPageNum = Math.min(currentPage + 1, totalPages);
    setCurrentPage(nextPageNum);
    if (onPageChange) onPageChange(nextPageNum);
  }, [totalPages, currentPage, onPageChange]);

  const prevPage = useCallback(() => {
    const prevPageNum = Math.max(currentPage - 1, 1);
    setCurrentPage(prevPageNum);
    if (onPageChange) onPageChange(prevPageNum);
  }, [currentPage, onPageChange]);

  const goToPage = useCallback((pageNumber: number) => {
    const targetPage = Math.max(1, Math.min(pageNumber, totalPages));
    setCurrentPage(targetPage);
    if (onPageChange) onPageChange(targetPage);
  }, [totalPages, onPageChange]);

  return {
    paginatedData,
    requestSort,
    sortConfig,
    searchTerm,
    handleSearch,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    goToPage,
    totalItems: manual ? manualTotalItems : sortedData.length,
    rowsPerPage,
    setRowsPerPage,
  };
};