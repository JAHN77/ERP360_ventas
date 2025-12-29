import React, { useState, useMemo } from 'react';
import StatCard from '../../components/dashboard/StatCard';
import Card, { CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import SimpleChart from '../../components/charts/SimpleChart';
import DateRangePicker, { DateRangeOption } from '../../components/ui/DateRangePicker';
import { useData } from '../../hooks/useData';
import { exportToCSV } from '../../utils/exportUtils';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

const dateRangeOptions: DateRangeOption[] = [
    { label: 'Últimos 7 días', value: '7' },
    { label: 'Últimos 30 días', value: '30' },
    { label: 'Este Mes', value: 'this_month' },
    { label: 'Últimos 90 días', value: '90' },
];

const VentasPorPeriodoReport: React.FC = () => {
    const { facturas, notasCredito, getSalesDataByPeriod } = useData();
    const [activeRange, setActiveRange] = useState('7');

    const { startDate, endDate } = useMemo(() => {
        const end = new Date();
        const start = new Date();
        switch (activeRange) {
            case '7':
                start.setDate(end.getDate() - 6);
                break;
            case 'this_month':
                start.setDate(1);
                break;
            case '90':
                start.setDate(end.getDate() - 89);
                break;
            case '30':
            default:
                start.setDate(end.getDate() - 29);
                break;
        }
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { startDate: start, endDate: end };
    }, [activeRange]);

    const salesData = useMemo(() => {
        return getSalesDataByPeriod(startDate, endDate);
    }, [getSalesDataByPeriod, startDate, endDate]);

    const chartData = useMemo(() => {
        return salesData.map(d => {
            const date = new Date(d.date + 'T00:00:00'); // Ensure UTC parsing
            const day = date.getUTCDate();
            const month = date.toLocaleDateString('es-CO', { month: 'short', timeZone: 'UTC' }).replace(/\./g, '');
            return {
                name: `${day} de ${month}`,
                Ventas: d.sales,
            }
        });
    }, [salesData]);

    const stats = useMemo(() => {
        const relevantInvoices = facturas.filter(f => {
            const invoiceDate = new Date(f.fechaFactura);
            return invoiceDate >= startDate && invoiceDate <= endDate && f.estado !== 'ANULADA' && f.estado !== 'BORRADOR';
        });

        const totalSales = relevantInvoices.reduce((sum, f) => {
            const totalDevuelto = notasCredito
                .filter(nc => nc.facturaId === f.id)
                .reduce((devSum, nc) => devSum + nc.total, 0);
            return sum + (f.total - totalDevuelto);
        }, 0);

        const invoiceCount = relevantInvoices.length;
        const averageSale = invoiceCount > 0 ? totalSales / invoiceCount : 0;

        return { totalSales, invoiceCount, averageSale };
    }, [facturas, notasCredito, startDate, endDate]);

    const handleExport = () => {
        const exportColumns: { header: string, accessor: 'date' | 'sales' }[] = [
            { header: 'Fecha', accessor: 'date' },
            { header: 'Ventas', accessor: 'sales' },
        ];
        const rangeLabel = dateRangeOptions.find(opt => opt.value === activeRange)?.label.replace(' ', '_').toLowerCase() || 'periodo';
        exportToCSV(salesData, exportColumns, `reporte_ventas_por_${rangeLabel}`);
    };

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Análisis de Ventas por Período</h2>
                <div className="flex items-center gap-3 flex-wrap">
                    <DateRangePicker
                        options={dateRangeOptions}
                        activeOption={activeRange}
                        onOptionChange={setActiveRange}
                    />
                    <button
                        onClick={handleExport}
                        className="px-4 py-1.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-sm hover:shadow-md text-sm flex items-center justify-center"
                    >
                        <i className="fas fa-file-csv mr-2"></i>
                        <span>Exportar</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <StatCard title="Ventas Totales" value={formatCurrency(stats.totalSales)} icon="fa-dollar-sign" colorName="blue" />
                <StatCard title="Nº de Facturas" value={stats.invoiceCount.toString()} icon="fa-file-invoice" colorName="green" />
                <StatCard title="Venta Promedio" value={formatCurrency(stats.averageSale)} icon="fa-balance-scale" colorName="violet" />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Tendencia de Ventas Diarias</CardTitle>
                </CardHeader>
                <CardContent>
                    <SimpleChart data={chartData} type="line" dataKey="Ventas" labelKey="name" height="h-96" />
                </CardContent>
            </Card>
        </div>
    );
};

export default VentasPorPeriodoReport;
