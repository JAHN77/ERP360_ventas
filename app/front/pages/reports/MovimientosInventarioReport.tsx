import React, { useEffect, useState, useCallback } from 'react';
import Card, { CardContent } from '../../components/ui/Card';
import Table, { Column } from '../../components/ui/Table';
import { TableToolbar } from '../../components/ui/TableToolbar';
import TablePagination from '../../components/ui/TablePagination';
import StatusBadge from '../../components/ui/StatusBadge';
import { exportToCSV } from '../../utils/exportUtils';
import { fetchInventoryMovements } from '../../services/apiClient';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

interface InventoryMovement {
    id: number;
    fecha: string;
    tipoMovimiento: string;
    tipoMovimientoNombre: string;
    nombreProducto: string;
    codigoProducto: string;
    cantidad: number;
    costo: number;
    precioVenta: number;
    documentoRef: string; // dockar, handled in SQL or frontend
    observaciones: string;
    usuario: string;
    codalm: string;
    dockar: number;
    numrem: number;
    numcom: number;
}

const MovimientosInventarioReport: React.FC = () => {
    const [data, setData] = useState<InventoryMovement[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'fecha', direction: 'desc' });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetchInventoryMovements(currentPage, rowsPerPage, searchTerm, sortConfig.key, sortConfig.direction);
            if (response.success) {
                // Cast to any to access pagination property which might not be in the strict ApiResponse definition
                const res = response as any;
                setData(res.data);
                if (res.pagination) {
                    setTotalPages(res.pagination.totalPages);
                    setTotalItems(res.pagination.total);
                }
            }
        } catch (error) {
            console.error('Error loading inventory movements:', error);
        } finally {
            setLoading(false);
        }
    }, [currentPage, rowsPerPage, searchTerm, sortConfig]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadData();
        }, 500); // Debounce for search
        return () => clearTimeout(timeoutId);
    }, [loadData]);

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
        setCurrentPage(1);
    };

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const getReference = (item: InventoryMovement) => {
        if (item.numrem > 0) return `Remisión: ${item.numrem}`;
        if (item.numcom > 0) return `Comprobante: ${item.numcom}`;
        if (item.dockar > 0) return `Doc: ${item.dockar}`;
        return item.observaciones || 'N/A';
    };

    const columns: Column<InventoryMovement>[] = [
        {
            header: 'Fecha',
            accessor: 'fecha',
            cell: (item) => new Date(item.fecha).toLocaleString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        },
        {
            header: 'Producto',
            accessor: 'nombreProducto',
            cell: (item) => (
                <div className="flex flex-col">
                    <span className="font-medium text-slate-800 dark:text-slate-100">{item.nombreProducto}</span>
                    <span className="text-xs text-slate-500">{item.codigoProducto}</span>
                </div>
            )
        },
        {
            header: 'Tipo',
            accessor: 'tipoMovimientoNombre',
            cell: (item) => {
                // HYBRID LOGIC: Check both Sign AND Type to catch positive values that are actually Exits (like Remissions)
                const tipoLower = (item.tipoMovimientoNombre || '').toLowerCase();
                const rawTipo = (item.tipoMovimiento || '').toUpperCase();

                // It is a Salida if: Quantity is negative OR Type contains 'salida' or code is 'S'/'SA'
                const isSalida = item.cantidad < 0 || tipoLower.includes('salida') || rawTipo === 'S' || rawTipo === 'SA';

                // It is an Entrada if: Not Salida AND (Quantity positive OR Type contains 'entrada'/'inicial' or code is 'E'/'EN'/'I')
                const isEntrada = !isSalida && (item.cantidad > 0 || tipoLower.includes('entrada') || tipoLower.includes('inicial') || rawTipo === 'E' || rawTipo === 'EN' || rawTipo === 'I');

                let badgeClass = 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
                let iconClass = 'fas fa-circle';
                let label = item.tipoMovimientoNombre || item.tipoMovimiento || 'Movimiento';

                if (isEntrada) {
                    badgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
                    iconClass = 'fas fa-arrow-down';
                    label = 'Entrada';
                } else if (isSalida) {
                    badgeClass = 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800';
                    iconClass = 'fas fa-arrow-up';
                    label = 'Salida';
                } else {
                    if (tipoLower.includes('ajuste')) {
                        badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
                        iconClass = 'fas fa-sync-alt';
                        label = 'Ajuste';
                    }
                }

                return (
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full inline-flex items-center gap-1.5 ${badgeClass}`}>
                        <i className={`text-[10px] ${iconClass}`}></i>
                        {label}
                    </span>
                );
            }
        },
        {
            header: 'Cantidad',
            accessor: 'cantidad',
            cell: (item) => {
                const isEntrada = item.cantidad > 0;
                // User requirement: No negative signs. Show absolute value.
                // Keep color coding for scannability: Green = In, Red = Out
                const colorClass = isEntrada ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';

                return (
                    <div className={`text-right font-bold font-mono ${colorClass}`}>
                        {Number(Math.abs(item.cantidad)).toFixed(2)}
                    </div>
                );
            }
        },
        {
            header: 'Costo Unit.',
            accessor: 'costo',
            cell: (item) => <div className="text-right text-slate-600 dark:text-slate-300">{formatCurrency(item.costo)}</div>
        },
        {
            header: 'Valor Total',
            accessor: 'precioVenta', // Usamos este slot para visualizar el total valorizado del movimiento
            cell: (item) => {
                // Valor total del movimiento = Cantidad * Costo (Absoluto)
                const total = Math.abs(item.cantidad * item.costo);
                return <div className="text-right font-bold text-slate-800 dark:text-slate-200">{formatCurrency(total)}</div>;
            }
        },
        {
            header: 'Referencia',
            accessor: 'observaciones',
            cell: (item) => <span className="text-sm truncate max-w-[200px]" title={item.observaciones}>{getReference(item)}</span>
        },
        { header: 'Usuario', accessor: 'usuario', cell: (item) => <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{item.usuario}</span> },
    ];

    const handleExport = () => {
        const exportData = data.map(m => ({
            Fecha: new Date(m.fecha).toLocaleString('es-CO'),
            Producto: `${m.codigoProducto} - ${m.nombreProducto}`,
            Tipo: m.tipoMovimientoNombre,
            Cantidad: m.cantidad,
            Costo: m.costo,
            Total: m.cantidad * m.costo,
            Referencia: getReference(m),
            Usuario: m.usuario
        }));

        const exportColumns = Object.keys(exportData[0] || {}).map(key => ({ header: key, accessor: key as any }));
        exportToCSV(exportData, exportColumns, 'reporte_kardex_global');
    };

    return (
        <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Registro de Movimientos de Inventario (Kardex)</h2>
            <Card>
                <TableToolbar
                    searchTerm={searchTerm}
                    onSearchChange={handleSearch}
                    onExportAction={handleExport}
                    exportActionLabel="Exportar CSV"
                />
                <CardContent className="p-0">
                    <Table
                        columns={columns}
                        data={data}
                        onSort={handleSort}
                        sortConfig={sortConfig}
                    />
                </CardContent>
                <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    canPreviousPage={currentPage > 1}
                    canNextPage={currentPage < totalPages}
                    onPreviousPage={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    onNextPage={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    totalItems={totalItems}
                    rowsPerPage={rowsPerPage}
                    setRowsPerPage={setRowsPerPage}
                />
            </Card>
        </div>
    );
};

export default MovimientosInventarioReport;
