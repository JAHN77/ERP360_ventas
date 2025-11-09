import React, { useMemo } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import SimpleChart from '../../components/charts/SimpleChart';
import Table, { Column } from '../../components/ui/Table';
import { useTable } from '../../hooks/useTable';
import TablePagination from '../../components/ui/TablePagination';
import { TableToolbar } from '../../components/ui/TableToolbar';
import { useData } from '../../hooks/useData';
import { exportToCSV } from '../../utils/exportUtils';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
};

interface ClientSalesData {
    id: string;
    clientName: string;
    totalSales: number;
    orderCount: number;
    lastOrder: string;
}

const VentasPorClienteReport: React.FC = () => {
    const { getSalesDataByClient } = useData();
    
    // ✅ Validación defensiva: Verificar que la función existe
    const salesData = useMemo(() => {
        if (typeof getSalesDataByClient !== 'function') {
            console.error('getSalesDataByClient no está disponible en el contexto');
            return [];
        }
        try {
            const data = getSalesDataByClient();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('Error al obtener datos de ventas por cliente:', error);
            return [];
        }
    }, [getSalesDataByClient]);

    const topClientsData = useMemo(() => {
        return salesData.slice(0, 10).map(client => ({
            name: client.clientName.split(' ')[0], // Shorten name for chart label
            Ventas: client.totalSales
        }));
    }, [salesData]);

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
    } = useTable<ClientSalesData>({
        data: salesData,
        searchKeys: ['clientName'],
    });

    const columns: Column<ClientSalesData>[] = [
        { header: 'Cliente', accessor: 'clientName' },
        { header: 'Total Ventas', accessor: 'totalSales', cell: (item) => formatCurrency(item.totalSales) },
        { header: 'Nº Facturas', accessor: 'orderCount' },
        { header: 'Última Compra', accessor: 'lastOrder' },
    ];

    const handleExport = () => {
        const exportColumns = columns.map(({ header, accessor }) => ({ header, accessor }));
        exportToCSV(salesData, exportColumns, 'reporte_ventas_por_cliente');
    };

    return (
        <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Análisis de Ventas por Cliente</h2>
            
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Top 10 Clientes por Ventas</CardTitle>
                </CardHeader>
                <CardContent>
                    <SimpleChart data={topClientsData} type="bar" dataKey="Ventas" labelKey="name" />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Ranking General de Clientes</CardTitle>
                </CardHeader>
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

export default VentasPorClienteReport;
