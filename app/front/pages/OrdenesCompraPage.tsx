import React, { useState, useMemo, useCallback } from 'react';
import { useTable } from '../hooks/useTable';
import { useNavigation } from '../hooks/useNavigation';
import { useData } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import Table, { Column } from '../components/ui/Table';
import { TableToolbar } from '../components/ui/TableToolbar';
import TablePagination from '../components/ui/TablePagination';
import Card, { CardContent } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import { formatDateOnly } from '../utils/formatters';
import { apiFetchOrdenesCompra, apiCreateOrdenCompra, apiFetchOrdenCompraById } from '../services/apiClient';
import OrdenCompraForm from '../components/compras/OrdenCompraForm';
import OrdenCompraPreviewModal from '../components/compras/OrdenCompraPreviewModal';
import { useNotifications } from '../hooks/useNotifications';

const OrdenesCompraPage: React.FC = () => {
    const { page, setPage } = useNavigation();
    const { addNotification } = useNotifications();
    const { selectedSede, user } = useAuth();

    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Preview Modal State
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 10,
        total: 0
    });

    // 1. Declare useTable FIRST because it provides searchTerm used in fetchOrders
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
    } = useTable<any>({
        data: orders,
        manual: true, // Enable server-side pagination
        totalItems: pagination.total, // Pass total items from API
        initialRowsPerPage: pagination.pageSize,
        onPageChange: (newPage) => {
            // This will trigger the effect that calls fetchOrders because 'page' state in useTable updates.
            // However, our fetchOrders depends on 'pagination' state which we need to update.
            // Easier way: Update the local pagination state which triggers fetch.
            setPagination(prev => ({ ...prev, page: newPage }));
        },
        onRowsPerPageChange: (newRows) => {
            setPagination(prev => ({ ...prev, pageSize: newRows, page: 1 }));
        }
    });

    // 2. Now declare fetchOrders which uses searchTerm
    const fetchOrders = useCallback(() => {
        setIsLoading(true);
        // Pass pagination params and warehouse code
        apiFetchOrdenesCompra(pagination.page, pagination.pageSize, searchTerm || '', selectedSede?.codigo)
            .then(res => {
                if (res.success && res.data) {
                    setOrders(res.data);
                    if (res.pagination) {
                        setPagination(prev => ({
                            ...prev,
                            total: res.pagination?.total || 0
                        }));
                    }
                }
            })
            .finally(() => setIsLoading(false));
    }, [pagination.page, pagination.pageSize, searchTerm, selectedSede?.codigo]);

    React.useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleCreateOrder = async (data: any) => {
        try {
            // Include codalm and user info
            const payload = {
                ...data,
                codalm: selectedSede?.codigo || '001',
                usuario: user?.usuario || 'SYSTEM'
            };

            const response = await apiCreateOrdenCompra(payload);
            if (response.success) {
                addNotification({ type: 'success', message: `Orden de compra #${response.data.numcom} creada exitosamente` });
                setPage('ordenes_compra');
                fetchOrders();
            } else {
                addNotification({ type: 'error', message: response.message || 'Error creando orden' });
            }
        } catch (error) {
            console.error(error);
            addNotification({ type: 'error', message: 'Error inesperado al crear orden' });
        }
    };

    const handleViewOrder = async (orderId: number) => {
        try {
            const res = await apiFetchOrdenCompraById(String(orderId));
            if (res.success && res.data) {
                setSelectedOrder(res.data);
                setIsPreviewOpen(true);
            } else {
                addNotification({ type: 'error', message: 'No se pudo cargar el detalle de la orden' });
            }
        } catch (error) {
            console.error(error);
            addNotification({ type: 'error', message: 'Error cargando detalle' });
        }
    };

    const columns: Column<any>[] = useMemo(() => [
        {
            header: 'Orden #',
            accessor: 'numeroOrden',
            cell: (item) => <span className="font-bold font-mono text-slate-700 dark:text-slate-200">{item.numeroOrden}</span>
        },
        {
            header: 'Fecha',
            accessor: 'fecha',
            cell: (item) => <span className="text-sm text-slate-600 dark:text-slate-400">{formatDateOnly(item.fecha)}</span>
        },
        {
            header: 'Proveedor',
            accessor: 'proveedorNombre',
            cell: (item) => (
                <div className="flex flex-col">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{item.proveedorNombre || 'N/A'}</span>
                    <span className="text-xs text-slate-500">{item.proveedorDocumento}</span>
                </div>
            )
        },
        {
            header: 'Total',
            accessor: 'total',
            cell: (item) => (
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(item.total || 0)}
                </span>
            )
        },
        {
            header: 'Estado',
            accessor: 'estado',
            cell: (item) => {
                const mapStatus: Record<string, string> = {
                    'P': 'PENDIENTE',
                    'A': 'APROBADA',
                    'F': 'FACTURADA',
                    'R': 'RECHAZADA',
                    'C': 'CANCELADO'
                };
                const status = mapStatus[item.estado] || item.estado || 'PENDIENTE';
                return <StatusBadge status={status as any} />;
            }
        },
        {
            header: 'Acciones',
            accessor: 'id',
            cell: (item) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleViewOrder(item.id)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
                        title="Ver / Imprimir"
                    >
                        <i className="fas fa-eye"></i>
                    </button>
                    {/* Add download PDF button here later */}
                </div>
            )
        }
    ], []);

    if (page === 'nueva_orden_compra') {
        return (
            <div className="animate-fade-in space-y-6">
                <PageHeader
                    title="Nueva Orden de Compra"
                    description="Crea una nueva orden de compra para proveedores."
                    showBackButton
                    onBack={() => setPage('ordenes_compra')}
                />
                <OrdenCompraForm
                    onSubmit={handleCreateOrder}
                    onCancel={() => setPage('ordenes_compra')}
                />
            </div>
        );
    }

    return (
        <div className="space-y-2 animate-fade-in">
            <PageHeader
                title="Tablero de Gestión de Compra"
                description="Administra las órdenes de compra a proveedores."
            />

            <Card className="shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                    <TableToolbar
                        searchTerm={searchTerm}
                        onSearchChange={(e) => {
                            handleSearch(e);
                            // Debounce could be added here, but for now direct update triggers effect in useTable or we need to trigger fetch
                            // The useTable's handleSearch updates its internal 'searchTerm'.
                            // We need to use that 'searchTerm' from useTable in our fetch dependency.
                            // But useTable 'searchTerm' is returned. Does it trigger re-render? Yes.
                            // Does fetchOrders run? Yes, because we added 'searchTerm' to dependency array.
                        }}
                        createActionLabel="Agregar Compra"
                        onCreateAction={() => setPage('nueva_orden_compra')}
                        placeholder="Buscar orden, proveedor..."
                    />
                </div>

                <CardContent className="p-0">
                    <Table
                        columns={columns}
                        data={paginatedData}
                        onSort={requestSort}
                        sortConfig={sortConfig}
                        isLoading={isLoading}
                        emptyMessage="No se encontraron órdenes de compra."
                    />
                </CardContent>

                <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
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
                </div>
            </Card>

            <OrdenCompraPreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                orden={selectedOrder}
            />
        </div>
    );
};

export default OrdenesCompraPage;
