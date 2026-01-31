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
import ProductDetails from '../components/productos/ProductDetails';
import PageContainer from '../components/ui/PageContainer';
import SectionHeader from '../components/ui/SectionHeader';
import NewServiceProductModal from '../components/facturacion/NewServiceProductModal';
import { useNotifications } from '../hooks/useNotifications';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
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

  // Estados para edición de precio
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);

  // Estado para modal de nuevo producto/servicio
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editProductData, setEditProductData] = useState<any>(null);

  // Hook para notificaciones
  const { addNotification } = useNotifications();

  /* -----------------------------------------------------------------------------------------------
   * ESTADO DE UI
   * -----------------------------------------------------------------------------------------------*/
  // Force default to 'servicios' and virtually disable 'productos'
  const [activeTab, setActiveTab] = useState<'servicios'>('servicios');

  // Update tab if params change (forcing services)
  useEffect(() => {
    if (params?.tab) {
      // Ignore params.tab if it tries to switch to products, or just keep it on services
      setActiveTab('servicios');
    }
  }, [params?.tab]);

  // Cargar categorías una sola vez
  useEffect(() => {
    (async () => {
      const catRes = await apiClient.getCategorias();
      if (catRes.success) setCategorias((catRes.data as any[]) as any);
    })();
  }, []);

  // Cargar productos o servicios con paginación
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        let response;

        // Always load services
        response = await apiClient.getServices(
          currentPage,
          pageSize,
          searchTerm || undefined,
          sortConfig?.key as string,
          sortConfig?.direction
        );

        if (response.success) {
          let dataList = (response.data as any[]) as InvProducto[];

          setProductos(dataList);

          // Paginación
          if ((response as any).pagination) {
            setTotalItems((response as any).pagination.total);
            setTotalPages((response as any).pagination.totalPages);
          }
        } else {
          console.error('Error loading data:', response.message);
          setProductos([]); // Limpiar si hay error para evitar confusión
        }
      } catch (error) {
        console.error('Error cargando datos:', error);
        setProductos([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      loadData();
    }, searchTerm ? 500 : 0);

    return () => clearTimeout(timeoutId);
  }, [currentPage, pageSize, searchTerm, categoryFilter, sortConfig]);

  const handleOpenModal = (producto: InvProducto) => {
    setSelectedProducto(producto);
    setIsModalOpen(true);
  };

  // Resetear paginación al cambiar de tab (Unused now but kept for compatibility if needed)
  const handleTabChange = (_tab: any) => {
    setActiveTab('servicios');
    setCurrentPage(1);
    setSearchTerm('');
    setCategoryFilter('Todos');
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
          <span className="text-[10px] text-blue-500 font-semibold bg-blue-50 dark:bg-blue-900/20 px-1 rounded w-fit mt-0.5">SERVICIO</span>
        </div>
      )
    },
    {
      header: 'Referencia',
      accessor: 'referencia',
      cell: (item) => <span className="font-mono text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">{item.referencia || 'N/A'}</span>
    },
    {
      header: 'Costo Base',
      accessor: 'ultimoCosto',
      cell: (item) => {
        const isEditing = editingPriceId === item.id;
        const costoBase = (item as any).ultimoCosto || 0;
        const iva = (item as any).tasaIva || 0;
        const precioConIva = costoBase * (1 + (iva / 100));

        if (isEditing) {
          return (
            <div className="flex items-center gap-1">
              <span className="text-slate-400">$</span>
              <input
                type="number"
                className="w-24 h-8 border border-blue-300 dark:border-blue-500 rounded px-2 py-1 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                value={tempPrice}
                onChange={(e) => setTempPrice(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePriceUpdate(item);
                  if (e.key === 'Escape') setEditingPriceId(null);
                }}
              />
            </div>
          );
        }

        return (
          <div
            className="group flex flex-col cursor-pointer"
            onClick={() => {
              setEditingPriceId(item.id);
              setTempPrice(costoBase.toFixed(0));
            }}
            title={`Precio con IVA: ${formatCurrency(precioConIva)}`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                {formatCurrency(costoBase)}
              </span>
              <i className="fas fa-pencil-alt text-[10px] text-slate-300 group-hover:text-blue-500 transition-colors"></i>
            </div>
            <span className="text-[10px] text-slate-400">IVA {iva}%</span>
          </div>
        );
      }
    },
    {
      header: 'Acciones', accessor: 'id', cell: (item) => {
        const isEditing = editingPriceId === item.id;

        if (isEditing) {
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePriceUpdate(item)}
                disabled={isUpdatingPrice}
                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all"
                title="Guardar"
              >
                {isUpdatingPrice ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check"></i>}
              </button>
              <button
                onClick={() => setEditingPriceId(null)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                title="Cancelar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenModal(item)}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
              title="Ver Detalles"
            >
              <i className="fas fa-eye"></i>
            </button>
            <button
              onClick={() => {
                const productData = {
                  id: item.id,
                  codigo: (item as any).codigo || '',
                  nombre: item.nombre,
                  precio: (item as any).precioBase || (item as any).ultimoCosto || 0,
                  aplicaIva: ((item as any).tasaIva || 0) > 0,
                  referencia: (item as any).referencia || '',
                  idTipoProducto: 2, // Always service
                  idCategoria: (item as any).idCategoria,
                  idSublineas: (item as any).idSublineas,
                  unidadMedidaCodigo: (item as any).unidadMedidaCodigo
                };
                setEditProductData(productData);
                setIsNewModalOpen(true);
              }}
              className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all duration-200"
              title="Editar"
            >
              <i className="fas fa-pencil-alt"></i>
            </button>
            <button
              onClick={() => handleDeleteProduct(item)}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
              title="Eliminar"
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>
        );
      }
    },
  ], [setPage, editingPriceId, tempPrice, isUpdatingPrice, activeTab]);

  const handlePriceUpdate = async (item: InvProducto) => {
    const newBaseCost = parseFloat(tempPrice);
    if (isNaN(newBaseCost) || newBaseCost < 0) {
      alert('Por favor ingrese un valor válido');
      return;
    }

    setIsUpdatingPrice(true);
    try {
      const response = await apiClient.updateProducto(item.id, {
        precioBase: newBaseCost,
        tasaIva: (item as any).tasaIva || 0
      });

      if (response.success) {
        // Actualizar estado local
        setProductos(prev => prev.map(p => {
          if (p.id === item.id) {
            return { ...p, ultimoCosto: newBaseCost };
          }
          return p;
        }));
        setEditingPriceId(null);
      } else {
        alert('Error al actualizar el costo: ' + response.message);
      }
    } catch (error) {
      console.error('Error updating cost:', error);
      alert('Error de conexión al actualizar el costo');
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  const handleDeleteProduct = async (item: InvProducto) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el servicio "${item.nombre}"?`)) {
      return;
    }

    try {
      // Para servicios, usar el código (codser) en lugar del id
      const serviceCode = (item as any).codigo || item.id;
      const response = await apiClient.deleteProducto(serviceCode);

      if (response.success) {
        // Recargar datos después de eliminar
        const loadData = async () => {
          setIsLoading(true);
          try {
            let refreshResponse;
            refreshResponse = await apiClient.getServices(
              currentPage,
              pageSize,
              searchTerm || undefined,
              sortConfig?.key as string,
              sortConfig?.direction
            );

            if (refreshResponse.success) {
              setProductos((refreshResponse.data as any[]) as InvProducto[]);
            }
          } catch (error) {
            console.error('Error refreshing data:', error);
          } finally {
            setIsLoading(false);
          }
        };

        await loadData();
        addNotification({
          type: 'success',
          message: `Servicio "${item.nombre}" eliminado exitosamente`
        });
      } else {
        addNotification({
          type: 'error',
          message: 'Error al eliminar: ' + response.message
        });
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      addNotification({
        type: 'error',
        message: 'Error de conexión al eliminar'
      });
    }
  };

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
  };

  const additionalFilters = null;

  return (
    <PageContainer>
      <SectionHeader
        title="Gestión de Servicios"
        subtitle="Administra el catálogo de servicios."
      />

      <Card className="shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-2 sm:p-3 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
          <TableToolbar
            searchTerm={searchTerm}
            onSearchChange={handleSearch}
            createActionLabel="Nuevo Servicio"
            onCreateAction={() => setIsNewModalOpen(true)}
            additionalFilters={null}
            onCustomizeColumns={() => setIsColumnModalOpen(true)}
            placeholder="Buscar servicio, referencia..."
          />
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-3">
              <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
              <span className="font-medium">Cargando {activeTab}...</span>
            </div>
          ) : (
            <Table
              columns={visibleColumns}
              data={productos}
              onSort={requestSort}
              sortConfig={sortConfig}
              highlightRowId={params?.highlightId ?? params?.focusId}
              emptyMessage="No se encontraron servicios."
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
          title={`Detalle del Servicio: ${selectedProducto.nombre}`}
          size="4xl"
        >
          <ProductDetails producto={selectedProducto} />
        </Modal>
      )}

      {/* Modal para crear nuevo producto/servicio */}
      <NewServiceProductModal
        isOpen={isNewModalOpen}
        onClose={() => {
          setIsNewModalOpen(false);
          setEditProductData(null); // Reset edit data on close
        }}
        onSuccess={() => {
          setIsNewModalOpen(false);
          setEditProductData(null); // Reset edit data on success
          // Refrescar datos después de crear/editar
          setCurrentPage(1);
          setSearchTerm('');
        }}
        editData={editProductData} // Pass edit data to modal
      />
    </PageContainer>
  );
};

export default ProductosPage;