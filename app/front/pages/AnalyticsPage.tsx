import React, { useState, useEffect, useMemo } from 'react';
import {
    TrendingUp,
    Target,
    Users,
    Clock,
    AlertTriangle,
    Filter,
    Calendar,
    ChevronDown,
    ArrowRight,
    BarChart3,
    PieChart,
    Activity,
    DollarSign,
    ShoppingCart,
    FileText,
    Truck,
    CheckCircle2
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { PageHeader } from '../components/ui/PageHeader';
import { SectionLoader } from '../components/ui/SectionLoader';
import { formatCurrency, formatDateOnly } from '../utils/formatters';
import { apiClient } from '../services/apiClient';

const AnalyticsPage: React.FC = () => {
    const { vendedores } = useData();
    const [loading, setLoading] = useState(true);
    const [performanceData, setPerformanceData] = useState<any>(null);
    const [leakageData, setLeakageData] = useState<any[]>([]);
    const [logisticsData, setLogisticsData] = useState<any>(null);
    const [financialData, setFinancialData] = useState<any>(null);

    // Filtros
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedVendedor, setSelectedVendedor] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                startDate,
                endDate,
                ...(selectedVendedor ? { vendedorId: selectedVendedor } : {})
            }).toString();

            const [perf, leak, log, fin] = await Promise.all([
                apiClient.get(`/analytics/performance?${queryParams}`),
                apiClient.get(`/analytics/leakage?${queryParams}`),
                apiClient.get(`/analytics/logistics?${queryParams}`),
                apiClient.get(`/analytics/financial?${queryParams}`)
            ]);

            setPerformanceData(perf.data);
            setLeakageData(leak.data || []);
            setLogisticsData(log.data);
            setFinancialData(fin.data);
        } catch (error) {
            console.error('Error fetching analytics data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [startDate, endDate, selectedVendedor]);

    const kpis = performanceData?.kpis || { montoCotizado: 0, montoPedidos: 0, hitRate: 0, countCotizaciones: 0, countPedidos: 0 };

    return (
        <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
            <PageHeader
                title="Análisis de Desempeño Comercial"
                description="Auditoría del ciclo de vida de ventas y eficiencia operativa"
            />

            {/* Filtros */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Fecha Inicio</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Fecha Fin</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Vendedor</label>
                    <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            value={selectedVendedor}
                            onChange={(e) => setSelectedVendedor(e.target.value)}
                            className="pl-10 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none min-w-[200px]"
                        >
                            <option value="">Todos los vendedores</option>
                            {vendedores.map(v => (
                                <option key={v.id} value={v.codigoVendedor}>{v.nombreCompleto}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>
                <button
                    onClick={fetchData}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                    <Filter className="w-4 h-4" /> Aplicar Filtros
                </button>
            </div>

            {loading ? (
                <SectionLoader text="Generando reporte de inteligencia..." />
            ) : (
                <>
                    {/* KPIs Principales */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard
                            title="Total Cotizado"
                            value={formatCurrency(kpis.montoCotizado)}
                            subtitle={`${kpis.countCotizaciones} cotizaciones`}
                            icon={<FileText className="w-5 h-5 text-blue-600" />}
                            color="blue"
                        />
                        <KPICard
                            title="Total Pedidos"
                            value={formatCurrency(kpis.montoPedidos)}
                            subtitle={`${kpis.countPedidos} pedidos cerrados`}
                            icon={<ShoppingCart className="w-5 h-5 text-green-600" />}
                            color="green"
                        />
                        <KPICard
                            title="Hit Rate (Conversión)"
                            value={`${kpis.hitRate.toFixed(1)}%`}
                            subtitle="Cotización a Pedido"
                            icon={<Target className="w-5 h-5 text-purple-600" />}
                            color="purple"
                            trend={kpis.hitRate > 30 ? 'up' : 'down'}
                        />
                        <KPICard
                            title="Lead Time Promedio"
                            value={`${(logisticsData?.avgLeadTimeHoras || 0).toFixed(1)}h`}
                            subtitle="Pedido a Remisión"
                            icon={<Clock className="w-5 h-5 text-amber-600" />}
                            color="amber"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Embudo de Ventas */}
                        <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-blue-500" /> Embudo de Conversión
                            </h3>
                            <div className="space-y-4">
                                <FunnelStep
                                    label="Cotizaciones"
                                    value={formatCurrency(kpis.montoCotizado)}
                                    percentage={100}
                                    color="bg-blue-500"
                                    icon={<FileText className="w-4 h-4" />}
                                />
                                <FunnelStep
                                    label="Pedidos"
                                    value={formatCurrency(kpis.montoPedidos)}
                                    percentage={(kpis.montoPedidos / kpis.montoCotizado) * 100}
                                    color="bg-green-500"
                                    icon={<ShoppingCart className="w-4 h-4" />}
                                />
                                <FunnelStep
                                    label="Facturado"
                                    value={formatCurrency(financialData?.montoFacturado || 0)}
                                    percentage={(financialData?.montoFacturado / kpis.montoCotizado) * 100}
                                    color="bg-purple-500"
                                    icon={<DollarSign className="w-4 h-4" />}
                                />
                            </div>

                            {/* Alerta de Desviación */}
                            {kpis.hitRate < 30 && (
                                <div className="mt-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg">
                                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-sm mb-1">
                                        <AlertTriangle className="w-4 h-4" /> Baja Eficiencia de Cierre
                                    </div>
                                    <p className="text-xs text-red-600 dark:text-red-300">
                                        La tasa de conversión está por debajo del 30%. Se recomienda revisar la competitividad de precios o el seguimiento comercial.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Ranking de Vendedores */}
                        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-green-500" /> Ranking de Ventas por Vendedor
                            </h3>
                            <div className="space-y-6">
                                {performanceData?.rankingVendedores?.map((v: any, idx: number) => (
                                    <div key={idx} className="space-y-2">
                                        <div className="flex justify-between text-sm font-medium">
                                            <span className="text-slate-700 dark:text-slate-300">{v.nombre || 'Sin Nombre'}</span>
                                            <span className="text-slate-900 dark:text-white font-bold">{formatCurrency(v.total)}</span>
                                        </div>
                                        <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-1000"
                                                style={{ width: `${(v.total / performanceData.rankingVendedores[0].total) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                                {(!performanceData?.rankingVendedores || performanceData.rankingVendedores.length === 0) && (
                                    <div className="text-center py-12 text-slate-400 italic">No hay datos de ventas para este periodo</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Análisis de Fuga de Venta */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <PieChart className="w-5 h-5 text-amber-500" /> Análisis de Fuga de Venta (Cotizado vs Pedido)
                            </h3>
                            <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                                {leakageData.length} desviaciones detectadas
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs font-bold text-slate-500 uppercase">
                                    <tr>
                                        <th className="px-6 py-3">Pedido / Cotización</th>
                                        <th className="px-6 py-3">Producto</th>
                                        <th className="px-6 py-3 text-right">Cant. Cotizada</th>
                                        <th className="px-6 py-3 text-right">Cant. Pedida</th>
                                        <th className="px-6 py-3 text-right">Diferencia</th>
                                        <th className="px-6 py-3 text-right">Impacto Económico</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {leakageData.map((item, idx) => (
                                        <tr key={idx} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800 dark:text-slate-200">{item.pedido}</div>
                                                <div className="text-xs text-slate-500">Origen: {item.cotizacion}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-700 dark:text-slate-300">{item.nombreProducto}</div>
                                                <div className="text-xs text-slate-400">{item.producto}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium">{item.cantCotizada}</td>
                                            <td className="px-6 py-4 text-right font-medium text-blue-600">{item.cantPedida}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.diferencia > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                    {item.diferencia > 0 ? `-${item.diferencia}` : `+${Math.abs(item.diferencia)}`}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                                                {formatCurrency(item.diferencia * item.precioCotizado)}
                                            </td>
                                        </tr>
                                    ))}
                                    {leakageData.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No se detectaron fugas de venta en este periodo</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// Componentes Auxiliares
const KPICard = ({ title, value, subtitle, icon, color, trend }: any) => {
    const colors: any = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800/30',
        green: 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:border-green-800/30',
        purple: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800/30',
        amber: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/30',
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-start gap-4">
            <div className={`p-3 rounded-lg border ${colors[color]}`}>
                {icon}
            </div>
            <div className="flex-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
                <div className="flex items-baseline gap-2">
                    <h4 className="text-2xl font-black text-slate-900 dark:text-white">{value}</h4>
                    {trend && (
                        <span className={`text-xs font-bold ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                            {trend === 'up' ? '↑' : '↓'}
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
            </div>
        </div>
    );
};

const FunnelStep = ({ label, value, percentage, color, icon }: any) => {
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                    <span className={`p-1.5 rounded-md ${color} text-white`}>{icon}</span>
                    {label}
                </div>
                <span className="font-bold text-slate-900 dark:text-white">{value}</span>
            </div>
            <div className="relative h-8 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden flex items-center justify-center">
                <div
                    className={`absolute left-0 top-0 h-full ${color} opacity-20 transition-all duration-1000`}
                    style={{ width: `${Math.min(100, percentage || 0)}%` }}
                ></div>
                <span className="relative text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase">
                    {percentage ? `${percentage.toFixed(1)}% del potencial` : '0%'}
                </span>
            </div>
        </div>
    );
};

export default AnalyticsPage;
