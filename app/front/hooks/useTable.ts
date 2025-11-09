import React, { useState, useMemo, useEffect, useCallback } from 'react';

type SortDirection = 'asc' | 'desc';

interface SortConfig<T> {
  key: keyof T | null;
  direction: SortDirection;
}

interface UseTableProps<T> {
  data: T[];
  searchKeys: (keyof T | ((item: T) => string))[];
  initialRowsPerPage?: number;
}

export const useTable = <T extends Record<string, any>>({
  data,
  searchKeys,
  initialRowsPerPage = 10,
}: UseTableProps<T>) => {
  // ✅ Protección: Asegurar que data sea siempre un array
  const safeData = Array.isArray(data) ? data : [];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, _setRowsPerPage] = useState(initialRowsPerPage);

  const filteredData = useMemo(() => {
    let filteredItems = [...safeData];
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      filteredItems = filteredItems.filter(item =>
        searchKeys.some(key => {
          const value = typeof key === 'function' ? key(item) : item[key];
          return String(value ?? '').toLowerCase().includes(lowercasedFilter);
        })
      );
    }
    return filteredItems;
  }, [safeData, searchTerm, searchKeys]);

  const sortedData = useMemo(() => {
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
  }, [filteredData, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / rowsPerPage);

  // Effect to adjust page if filters reduce total pages below current page
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (totalPages === 0) {
        setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage]);

  const requestSort = useCallback((key: keyof T) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // Reset to first page on sort
  }, [sortConfig]);
  
  const handleSearch = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(event.target.value);
      setCurrentPage(1); // Reset to first page on search
  }, []);

  const setRowsPerPage = useCallback((numRows: number) => {
      _setRowsPerPage(numRows);
      setCurrentPage(1); // Reset to first page when rows per page changes
  }, []);

  const nextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  }, []);
  
  const goToPage = useCallback((pageNumber: number) => {
      setCurrentPage(Math.max(1, Math.min(pageNumber, totalPages)));
  }, [totalPages]);

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
    totalItems: sortedData.length,
    rowsPerPage,
    setRowsPerPage,
  };
};