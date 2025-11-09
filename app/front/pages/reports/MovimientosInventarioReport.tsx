import React, { useMemo } from 'react';
import { useData } from '../../hooks/useData';
import Card, { CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import Table, { Column } from '../../components/ui/Table';
import { useTable } from '../../hooks/useTable';
import { TableToolbar } from '../../components/ui/TableToolbar';
import TablePagination from '../../components/ui/TablePagination';
import StatusBadge from '../../components/ui/StatusBadge';
import { exportToCSV } from '../../utils/exportUtils';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
};

const parseDetails = (details: string): Record<string, string> => {
    if (details.includes(' | ')) {
        const parts = details.split(' | ');
        const data: Record<string, string> = {};
        parts.forEach(part => {
            const [key, ...value] = part.split(': ');
            if (key && value.length > 0) {
                data[key.trim()] = value.join(': ').trim();
            }
        });
        return data;
    }
    return { Cantidad: 'N/A', Motivo: details, CostoU: '0', Ref: 'N/A' };
};

interface InventoryMovement {
    id: string;
    timestamp: number;
    productName: string;
    type: 'Entrada' | 'Salida';
    quantity: number;
    user: string;
    reference: string;
    cost: number;
    totalValue: number;
}

const MovimientosInventarioReport: React.FC = () => {
    const { activityLog, remisiones, productos, notasCredito, facturas } = useData();

    const movements = useMemo(() => {
        const allMovements: InventoryMovement[] = [];
        const productMap = new Map<number, typeof productos[number]>();
        productos.forEach(producto => productMap.set(producto.id, producto));

        // Entradas from Activity Log
        activityLog
            .filter(log => log.action === 'Entrada de Inventario')
            .forEach(log => {
                const details = parseDetails(log.details);
                const quantity = parseInt(details['Cantidad'] || '0', 10);
                const cost = parseFloat(details['CostoU'] || '0');
                allMovements.push({
                    id: `in-${log.id}`,
                    timestamp: log.timestamp,
                    productName: log.entity.name,
                    type: 'Entrada',
                    quantity: quantity,
                    user: log.user.nombre,
                    reference: details['Ref'] || 'N/A',
                    cost: cost,
                    totalValue: quantity * cost,
                });
            });

        // Salidas desde Facturación (ventas)
        facturas
            .filter(f => f.estado !== 'ANULADA' && f.estado !== 'BORRADOR')
            .forEach(factura => {
                (factura.items || []).forEach((item, index) => {
                    const product = productMap.get(item.productoId);
                    const costoUnitario = item.precioUnitario || product?.ultimoCosto || 0;
                    const total = item.total ?? item.cantidad * costoUnitario;
                    allMovements.push({
                        id: `fact-${factura.id}-${item.productoId}-${index}`,
                        timestamp: new Date(factura.fechaFactura).getTime(),
                        productName: product?.nombre || item.descripcion || `Producto ${item.productoId}`,
                        type: 'Salida',
                        quantity: item.cantidad,
                        user: 'Sistema (Factura)',
                        reference: factura.numeroFactura || `FAC-${factura.id}`,
                        cost: costoUnitario,
                        totalValue: total,
                    });
                });
            });

        // Entradas por Notas de Crédito (devoluciones)
        notasCredito
            .forEach(nota => {
                (nota.itemsDevueltos || []).forEach((item, index) => {
                    const product = productMap.get(item.productoId);
                    const costoUnitario = item.precioUnitario || product?.ultimoCosto || 0;
                    const total = item.total ?? item.cantidad * costoUnitario;
                    allMovements.push({
                        id: `nc-${nota.id}-${item.productoId}-${index}`,
                        timestamp: nota.fechaEmision ? new Date(nota.fechaEmision).getTime() : Date.now(),
                        productName: product?.nombre || item.descripcion || `Producto ${item.productoId}`,
                        type: 'Entrada',
                        quantity: item.cantidad,
                        user: 'Sistema (Devolución)',
                        reference: nota.numero || `NC-${nota.id}`,
                        cost: costoUnitario,
                        totalValue: total,
                    });
                });
            });

        return allMovements.sort((a, b) => b.timestamp - a.timestamp);
    }, [activityLog, facturas, notasCredito, productos]);

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
    } = useTable<InventoryMovement>({
        data: movements,
        searchKeys: ['productName', 'reference', 'user', 'type'],
    });

    const columns: Column<InventoryMovement>[] = [
        { header: 'Fecha', accessor: 'timestamp', cell: (item) => new Date(item.timestamp).toLocaleString('es-CO') },
        { header: 'Producto', accessor: 'productName' },
        { header: 'Tipo', accessor: 'type', cell: (item) => <StatusBadge status={item.type as any} /> },
        { header: 'Cantidad', accessor: 'quantity', cell: (item) => <div className={`text-right font-semibold ${item.type === 'Entrada' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{item.type === 'Entrada' ? '+' : '-'}{item.quantity}</div> },
        { header: 'Costo Unitario', accessor: 'cost', cell: (item) => <div className="text-right">{formatCurrency(item.cost)}</div> },
        { header: 'Valor Total', accessor: 'totalValue', cell: (item) => <div className="text-right font-bold">{formatCurrency(item.totalValue)}</div> },
        { header: 'Referencia', accessor: 'reference' },
        { header: 'Usuario', accessor: 'user' },
    ];

    const handleExport = () => {
        const exportData = movements.map(m => ({
            ...m,
            timestamp: new Date(m.timestamp).toLocaleString('es-CO'),
            quantity: m.type === 'Entrada' ? m.quantity : -m.quantity,
        }));
        
        const exportColumns = columns.map(({ header, accessor }) => ({ header, accessor }));
        exportToCSV(exportData, exportColumns, 'reporte_movimientos_inventario');
    };

    return (
        <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Registro de Movimientos de Inventario</h2>
            <Card>
                <TableToolbar 
                    searchTerm={searchTerm} 
                    onSearchChange={handleSearch}
                    onExportAction={handleExport}
                    exportActionLabel="Exportar CSV"
                />
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

export default MovimientosInventarioReport;
