import React, { useState, useEffect, useCallback } from 'react';
import PageContainer from '../components/ui/PageContainer';
import SectionHeader from '../components/ui/SectionHeader';
import AnalyticsFilters from '../components/analytics/AnalyticsFilters';
import GeneralStats from '../components/analytics/GeneralStats';
import OrderTimeline from '../components/analytics/OrderTimeline';
import { useAuth } from '../hooks/useAuth';

const AnalyticsPage: React.FC = () => {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState<'general' | 'timeline'>('general');

    // Filters State
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], // First day of current month
        endDate: new Date().toISOString().split('T')[0], // Today
        vendedorId: '',
        clienteId: '',
        productoId: '',
        period: 'month'
    });

    // Data State
    const [statsData, setStatsData] = useState({
        timeline: [],
        totals: {
            cotizaciones: { count: 0, value: 0 },
            pedidos: { count: 0, value: 0 },
            remisiones: { count: 0, value: 0 },
            facturas: { count: 0, value: 0 }
        }
    });
    const [loading, setLoading] = useState(false);

    const fetchStats = useCallback(async () => {
        if (activeTab !== 'general') return;

        setLoading(true);
        try {
            const queryParams = new URLSearchParams(filters as any).toString();
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/analytics/general?${queryParams}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const result = await response.json();
            if (result.success) {
                setStatsData(result.data);
            }
        } catch (error) {
            console.error('Error fetching analytics stats:', error);
        } finally {
            setLoading(false);
        }
    }, [filters, activeTab, token]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    return (
        <PageContainer>
            <SectionHeader
                title="Analítica y Reportes"
                subtitle="Visualice el rendimiento de ventas y rastree el ciclo de vida de los pedidos."
            />

            {/* Tabs */}
            <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6 w-fit">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'general'
                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    <i className="fas fa-chart-pie mr-2"></i>
                    Visión General
                </button>
                <button
                    onClick={() => setActiveTab('timeline')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'timeline'
                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    <i className="fas fa-stream mr-2"></i>
                    Línea de Tiempo de Pedidos
                </button>
            </div>

            {activeTab === 'general' ? (
                <>
                    <AnalyticsFilters filters={filters} onChange={handleFilterChange} />
                    <GeneralStats data={statsData} loading={loading} />
                </>
            ) : (
                <OrderTimeline />
            )}
        </PageContainer>
    );
};

export default AnalyticsPage;
