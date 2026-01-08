import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import StatCard from '../dashboard/StatCard';

interface GeneralStatsProps {
    data: {
        timeline: any[];
        totals: {
            cotizaciones: { count: number; value: number };
            pedidos: { count: number; value: number };
            remisiones: { count: number; value: number };
            facturas: { count: number; value: number };
        };
    };
    loading: boolean;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

const GeneralStats: React.FC<GeneralStatsProps> = ({ data, loading }) => {
    if (loading) {
        return <div className="flex justify-center items-center h-64 text-slate-400">Cargando estadísticas...</div>;
    }

    const { totals, timeline } = data;

    // Transform timeline data for charts
    // Group by period
    const chartDataMap = new Map();

    timeline.forEach(item => {
        if (!chartDataMap.has(item.period)) {
            chartDataMap.set(item.period, { name: item.period, Cotizaciones: 0, Pedidos: 0, Remisiones: 0, Facturas: 0 });
        }
        const entry = chartDataMap.get(item.period);
        // Use totalValue for chart
        entry[item.type] = (entry[item.type] || 0) + (item.totalValue || 0);
    });

    const chartData = Array.from(chartDataMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Cotizaciones"
                    value={formatCurrency(totals.cotizaciones.value)}
                    subtitle={`${totals.cotizaciones.count} registros`}
                    icon="fa-file-alt"
                    colorName="blue"
                />
                <StatCard
                    title="Pedidos"
                    value={formatCurrency(totals.pedidos.value)}
                    subtitle={`${totals.pedidos.count} registros`}
                    icon="fa-shopping-cart"
                    colorName="orange"
                />
                <StatCard
                    title="Remisiones"
                    value={formatCurrency(totals.remisiones.value)}
                    subtitle={`${totals.remisiones.count} registros`}
                    icon="fa-truck"
                    colorName="violet"
                />
                <StatCard
                    title="Facturas"
                    value={formatCurrency(totals.facturas.value)}
                    subtitle={`${totals.facturas.count} registros`}
                    icon="fa-file-invoice-dollar"
                    colorName="green"
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart: Comparative Volume */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Comparativa de Volumen (Valor)</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val / 1000000}M`} />
                                <Tooltip
                                    formatter={(value: number) => formatCurrency(value)}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                />
                                <Legend />
                                <Bar dataKey="Cotizaciones" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Pedidos" fill="#f97316" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Remisiones" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Facturas" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Line Chart: Trends */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Tendencias</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val / 1000000}M`} />
                                <Tooltip
                                    formatter={(value: number) => formatCurrency(value)}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="Cotizaciones" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="Pedidos" stroke="#f97316" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="Remisiones" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="Facturas" stroke="#10b981" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeneralStats;
