import React, { useMemo } from 'react';
import { useNavigation } from '../hooks/useNavigation';
import { useData } from '../hooks/useData';
import Card, { CardContent } from '../components/ui/Card';
import Table, { Column } from '../components/ui/Table';
import { useTable } from '../hooks/useTable';
import { TableToolbar } from '../components/ui/TableToolbar';
import TablePagination from '../components/ui/TablePagination';
import { InvProducto } from '../types';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

const CategoriaDetallePage: React.FC = () => {
    const { params, setPage } = useNavigation();
    const { categorias, productos } = useData();

    const categoryId = Number(params.id);
    const categoria = useMemo(() => categorias.find(c => c.id === categoryId), [categorias, categoryId]);

    const productosEnCategoria = useMemo(() => {
        if (!categoryId) return [];
        return productos.filter(p => p.idCategoria === categoryId);
    }, [productos, categoryId]);

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
        data: productosEnCategoria,
        searchKeys: ['nombre', 'referencia'],
    });

    if (!categoria) {
        return (
            <div>
                <h1 className="text-2xl font-bold text-red-500">Categoría no encontrada</h1>
                <button onClick={() => setPage('categorias')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Volver</button>
            </div>
        );
    }

    const columns: Column<InvProducto>[] = [
        { header: 'Nombre', accessor: 'nombre' },
        { header: 'Referencia', accessor: 'referencia' },
        { header: 'Stock', accessor: 'controlaExistencia', cell: (item) => `${item.controlaExistencia ?? 0} ${item.unidadMedida || ''}` },
        { header: 'Precio de Venta', accessor: 'precio', cell: (item) => formatCurrency(item.precio) },
        { header: 'Último Costo', accessor: 'ultimoCosto', cell: (item) => formatCurrency(item.ultimoCosto) },
    ];

    return (
        <div>
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => setPage('categorias')} className="px-3 py-2 text-sm bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">
                    <i className="fas fa-arrow-left"></i>
                </button>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">
                    Productos en: <span className="text-blue-600 dark:text-blue-400">{categoria.nombre}</span>
                </h1>
            </div>

            <Card>
                <div className="p-2 sm:p-3">
                    <TableToolbar searchTerm={searchTerm} onSearchChange={handleSearch} />
                </div>
                <CardContent className="p-0">
                    <Table columns={columns} data={paginatedData} onSort={requestSort} sortConfig={sortConfig} />
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
        </div>
    );
};

export default CategoriaDetallePage;