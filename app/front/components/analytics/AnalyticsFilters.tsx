import React from 'react';
import { useData } from '../../hooks/useData';

interface AnalyticsFiltersProps {
    filters: {
        startDate: string;
        endDate: string;
        vendedorId: string;
        clienteId: string;
        productoId: string;
        period: string;
    };
    onChange: (key: string, value: string) => void;
}

const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({ filters, onChange }) => {
    const { vendedores, clientes, productos } = useData();

    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">

                {/* Date Range */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Desde</label>
                    <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => onChange('startDate', e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Hasta</label>
                    <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => onChange('endDate', e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                {/* Period Selector */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Agrupar Por</label>
                    <select
                        value={filters.period}
                        onChange={(e) => onChange('period', e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="month">Mes</option>
                        <option value="week">Semana</option>
                        <option value="year">Año</option>
                    </select>
                </div>

                {/* Vendedor */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Vendedor</label>
                    <select
                        value={filters.vendedorId}
                        onChange={(e) => onChange('vendedorId', e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="">Todos</option>
                        {vendedores.map((v) => (
                            <option key={v.id} value={v.codigoVendedor || v.id}>
                                {v.nombreCompleto}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Cliente */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Cliente</label>
                    <select
                        value={filters.clienteId}
                        onChange={(e) => onChange('clienteId', e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="">Todos</option>
                        {clientes.slice(0, 100).map((c) => ( // Limit to 100 for perf, ideally use async select
                            <option key={c.id} value={c.numeroDocumento}>
                                {c.razonSocial || c.nombreCompleto}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Producto */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Producto</label>
                    <select
                        value={filters.productoId}
                        onChange={(e) => onChange('productoId', e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="">Todos</option>
                        {productos.slice(0, 100).map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.nombre}
                            </option>
                        ))}
                    </select>
                </div>

            </div>
        </div>
    );
};

export default AnalyticsFilters;
