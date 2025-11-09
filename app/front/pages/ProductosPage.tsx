import React, { useState, useMemo, useEffect } from 'react';
import Table, { Column } from '../components/ui/Table';
import Card, { CardContent } from '../components/ui/Card';
import { InvProducto } from '../types';
import { useNavigation } from '../hooks/useNavigation';
import Modal from '../components/ui/Modal';
import { useTable } from '../hooks/useTable';
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
  useEffect(() => {
    (async () => {
      const [prodRes, catRes] = await Promise.all([
        apiClient.getProductos(),
        apiClient.getCategorias()
      ]);
      if (prodRes.success) setProductos((prodRes.data as any[]) as InvProducto[]);
      if (catRes.success) setCategorias((catRes.data as any[]) as any);
    })();
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<InvProducto | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  
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
    { header: 'Nombre', accessor: 'nombre' },
    { header: 'Referencia', accessor: 'referencia' },
    { header: 'Último Costo', accessor: 'ultimoCosto', cell: (item) => formatCurrency((item as any).ultimoCosto || 0) },
    { header: 'Stock', accessor: 'stock', cell: (item) => `${(item as any).stock ?? 0}` },
    { header: 'Acciones', accessor: 'id', cell: (item) => (
      <div className="space-x-3">
        <button onClick={() => handleOpenModal(item)} className="text-sky-500 hover:underline text-sm font-medium">Ver</button>
        <ProtectedComponent permission="productos:edit">
            <button onClick={() => setPage('editar_producto', { id: item.id })} className="text-blue-500 hover:underline text-sm font-medium">Editar</button>
        </ProtectedComponent>
      </div>
    )},
  ], [setPage]);
  
  const {
    visibleColumns,
    allManagedColumns,
    setManagedColumns,
    resetManagedColumns
  } = useColumnManager('productos', defaultColumns);

  const filteredProducts = useMemo(() => {
    return productos.filter(producto => {
      return categoryFilter === 'Todos' || producto.idCategoria === parseInt(categoryFilter);
    });
  }, [productos, categoryFilter]);

  const {
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
    totalItems,
    rowsPerPage,
    setRowsPerPage,
  } = useTable<InvProducto>({
    data: filteredProducts,
    searchKeys: ['nombre', 'referencia'],
  });

  const additionalFilters = (
    <div className="flex flex-col sm:flex-row gap-4">
        <div>
            <label htmlFor="categoryFilter" className="sr-only">Categoría</label>
            <select
              id="categoryFilter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="Todos">Todas las Categorías</option>
                {categorias.filter(c => c.estado === 1).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
        </div>
    </div>
  );

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Gestión de Productos</h1>
        </div>
        <Card>
            <TableToolbar 
              searchTerm={searchTerm}
              onSearchChange={handleSearch}
              createActionLabel="Nuevo Producto"
              onCreateAction={() => setPage('nuevo_producto')}
              additionalFilters={additionalFilters}
              onCustomizeColumns={() => setIsColumnModalOpen(true)}
            />
            <CardContent className="p-0">
                <Table 
                  columns={visibleColumns} 
                  data={paginatedData} 
                  onSort={requestSort} 
                  sortConfig={sortConfig}
                  highlightRowId={params?.highlightId ?? params?.focusId}
                />
            </CardContent>
             <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
              canPreviousPage={currentPage > 1}
              canNextPage={currentPage < totalPages}
              onPreviousPage={prevPage}
              onNextPage={nextPage}
              totalItems={totalItems}
              rowsPerPage={rowsPerPage}
              setRowsPerPage={setRowsPerPage}
            />
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
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="sm:col-span-2"><p className="font-semibold text-slate-600 dark:text-slate-400">Nombre:</p><p>{selectedProducto.nombre}</p></div>
                <div className="sm:col-span-2"><p className="font-semibold text-slate-600 dark:text-slate-400">Descripción:</p><p>{(selectedProducto as any).descripcion || selectedProducto.nombre}</p></div>
                <div><p className="font-semibold text-slate-600 dark:text-slate-400">Unidad de Medida:</p><p>{(selectedProducto as any).unidadMedidaNombre || (selectedProducto as any).unidadMedida || 'Unidad'}</p></div>
                <div><p className="font-semibold text-slate-600 dark:text-slate-400">Stock Actual:</p><p>{(selectedProducto as any).stock ?? 0}</p></div>
                <div><p className="font-semibold text-slate-600 dark:text-slate-400">Impuestos:</p><p>{((selectedProducto as any).tasaIva ?? 0) > 0 ? `Aplica IVA (${(selectedProducto as any).tasaIva}%)` : 'No aplica IVA'}</p></div>
                <div><p className="font-semibold text-slate-600 dark:text-slate-400">Último Costo:</p><p className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency((selectedProducto as any).ultimoCosto || 0)}</p></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ProductosPage;