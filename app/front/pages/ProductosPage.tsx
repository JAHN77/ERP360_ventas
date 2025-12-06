import React, { useState, useMemo, useEffect } from 'react';
import Table, { Column } from '../components/ui/Table';
import Card, { CardContent } from '../components/ui/Card';
import { InvProducto } from '../types';
import { useNavigation } from '../hooks/useNavigation';
import Modal from '../components/ui/Modal';
import { TableToolbar } from '../components/ui/TableToolbar';
import TablePagination from '../components/ui/TablePagination';
import ProtectedComponent from '../components/auth/ProtectedComponent';
import { apiClient } from '../services/apiClient';
import { useColumnManager } from '../hooks/useColumnManager';
import ColumnManagerModal from '../components/ui/ColumnManagerModal';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
}

const ProductosPage: React.FC = () => {
  const { params, setPage } = useNavigation();
  const [productos, setProductos] = useState<InvProducto[]>([]);
  const [categorias, setCategorias] = useState<Array<{ id: number; nombre: string; estado: number }>>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<InvProducto | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);

  // Estados para paginación del servidor
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof InvProducto | null; direction: 'asc' | 'desc' } | null>(null);

  // Cargar categorías una sola vez
  useEffect(() => {
    (async () => {
      const catRes = await apiClient.getCategorias();
      if (catRes.success) setCategorias((catRes.data as any[]) as any);
    })();
  }, []);

  // Cargar productos con paginación (con debounce para búsqueda)
  useEffect(() => {
    const loadProductos = async () => {
      setIsLoading(true);
      try {
        const prodRes = await apiClient.getProductos(undefined, currentPage, pageSize, searchTerm || undefined);
        if (prodRes.success) {
          let productosData = (prodRes.data as any[]) as InvProducto[];

          // Aplicar filtro de categoría en el cliente
          if (categoryFilter !== 'Todos') {
            productosData = productosData.filter(p => p.idCategoria === parseInt(categoryFilter));
          }

          setProductos(productosData);

          // Usar información de paginación del servidor
          if ((prodRes as any).pagination) {
            // Nota: El total puede no ser exacto si se aplica filtro de categoría en el cliente
            // Para mejor precisión, considera mover el filtro de categoría al servidor
            setTotalItems((prodRes as any).pagination.total);
            setTotalPages((prodRes as any).pagination.totalPages);
          }
        }
      } catch (error) {
        console.error('Error cargando productos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce para búsqueda: esperar 500ms después de que el usuario deje de escribir
    const timeoutId = setTimeout(() => {
      loadProductos();
    }, searchTerm ? 500 : 0); // Si hay búsqueda, esperar; si no, cargar inmediatamente

    return () => clearTimeout(timeoutId);
  }, [currentPage, pageSize, searchTerm, categoryFilter]);

  const handleOpenModal = (producto: InvProducto) => {
    setSelectedProducto(producto);
    setIsModalOpen(true);
  };

  useEffect(() => {
    const focusId = params?.focusId;
    if (!focusId) {
      return;
    }

    const targetProduct = productos.find((producto) => {
      const candidateIds = [producto.id, (producto as any).referencia]
        .filter((value) => value !== undefined && value !== null)
        .map((value) => String(value));
      return candidateIds.includes(String(focusId));
    });

    if (targetProduct) {
      handleOpenModal(targetProduct);
    }
  }, [params?.focusId, productos]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProducto(null);
    if (params?.focusId || params?.highlightId) {
      const { focusId: _focus, highlightId: _highlight, ...rest } = params;
      setPage('productos', rest);
    }
  };

  const defaultColumns = useMemo<Column<InvProducto>[]>(() => [
    {
      header: 'Nombre',
      accessor: 'nombre',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[250px]" title={item.nombre}>{item.nombre}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{(item as any).descripcion || ''}</span>
        </div>
      )
    },
    {
      header: 'Referencia',
      accessor: 'referencia',
      cell: (item) => <span className="font-mono text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">{item.referencia || 'N/A'}</span>
    },
    {
      header: 'Precio (Inc. IVA)',
      accessor: 'ultimoCosto',
      cell: (item) => {
        const costo = (item as any).ultimoCosto || 0;
        const iva = (item as any).tasaIva || 0;
        const precioConIva = costo * (1 + (iva / 100));
        return <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{formatCurrency(precioConIva)}</span>
      }
    },
    {
      header: 'Stock',
      accessor: 'stock',
      cell: (item) => {
        const stock = (item as any).stock ?? 0;
        const isLow = stock < 10;
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isLow
            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
            }`}>
            {stock}
          </span>
        );
      }
    },
    {
      header: 'Acciones', accessor: 'id', cell: (item) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenModal(item)}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
            title="Ver Detalles"
          >
            <i className="fas fa-eye"></i>
          </button>
          <ProtectedComponent permission="productos:edit">
            <button
              onClick={() => setPage('editar_producto', { id: item.id })}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
              title="Editar Producto"
            >
              <i className="fas fa-pencil-alt"></i>
            </button>
          </ProtectedComponent>
        </div>
      )
    },
  ], [setPage]);

  const {
    visibleColumns,
    allManagedColumns,
    setManagedColumns,
    resetManagedColumns
  } = useColumnManager('productos', defaultColumns);

  // Handlers para paginación
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
    setCurrentPage(1); // Reset a primera página al buscar
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset a primera página al cambiar tamaño
  };

  const handleCategoryFilterChange = (value: string) => {
    setCategoryFilter(value);
    setCurrentPage(1); // Reset a primera página al cambiar categoría
  };

  const requestSort = (key: keyof InvProducto) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    // TODO: Implementar ordenamiento en el servidor si es necesario
  };

  const additionalFilters = (
    <div className="flex flex-col sm:flex-row gap-4">
      <div>
        <label htmlFor="categoryFilter" className="sr-only">Categoría</label>
        <select
          id="categoryFilter"
          value={categoryFilter}
          onChange={(e) => handleCategoryFilterChange(e.target.value)}
          className="w-full sm:w-auto px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="Todos">Todas las Categorías</option>
          {categorias.filter(c => c.estado === 1).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            Gestión de Productos
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Administra el catálogo de productos y su inventario.
          </p>
        </div>
      </div>

      <Card className="shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
          <TableToolbar
            searchTerm={searchTerm}
            onSearchChange={handleSearch}
            createActionLabel="Nuevo Producto"
            onCreateAction={() => setPage('nuevo_producto')}
            additionalFilters={additionalFilters}
            onCustomizeColumns={() => setIsColumnModalOpen(true)}
            placeholder="Buscar producto, referencia..."
          />
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-3">
              <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
              <span className="font-medium">Cargando productos...</span>
            </div>
          ) : (
            <Table
              columns={visibleColumns}
              data={productos}
              onSort={requestSort}
              sortConfig={sortConfig}
              highlightRowId={params?.highlightId ?? params?.focusId}
            />
          )}
        </CardContent>

        <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            canPreviousPage={currentPage > 1}
            canNextPage={currentPage < totalPages}
            onPreviousPage={() => handlePageChange(currentPage - 1)}
            onNextPage={() => handlePageChange(currentPage + 1)}
            totalItems={totalItems}
            rowsPerPage={pageSize}
            setRowsPerPage={handlePageSizeChange}
          />
        </div>
      </Card>

      <ColumnManagerModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        columns={allManagedColumns}
        onSave={(newColumns) => {
          setManagedColumns(newColumns);
          setIsColumnModalOpen(false);
        }}
        onReset={() => {
          resetManagedColumns();
          setIsColumnModalOpen(false);
        }}
      />

      {selectedProducto && (
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={`Detalle del Producto: ${selectedProducto.nombre}`}
          size="xl"
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="sm:col-span-2"><p className="font-semibold text-slate-600 dark:text-slate-400">Nombre:</p><p>{selectedProducto.nombre}</p></div>
              <div className="sm:col-span-2"><p className="font-semibold text-slate-600 dark:text-slate-400">Descripción:</p><p>{(selectedProducto as any).descripcion || selectedProducto.nombre}</p></div>
              <div><p className="font-semibold text-slate-600 dark:text-slate-400">Unidad de Medida:</p><p>{(selectedProducto as any).unidadMedidaNombre || (selectedProducto as any).unidadMedida || 'Unidad'}</p></div>
              <div><p className="font-semibold text-slate-600 dark:text-slate-400">Stock Actual:</p><p>{(selectedProducto as any).stock ?? 0}</p></div>
              <div><p className="font-semibold text-slate-600 dark:text-slate-400">Impuestos:</p><p>{((selectedProducto as any).tasaIva ?? 0) > 0 ? `Aplica IVA (${(selectedProducto as any).tasaIva}%)` : 'No aplica IVA'}</p></div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Precio (Inc. IVA):</p>
                <p className="font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(((selectedProducto as any).ultimoCosto || 0) * (1 + (((selectedProducto as any).tasaIva || 0) / 100)))}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ProductosPage;