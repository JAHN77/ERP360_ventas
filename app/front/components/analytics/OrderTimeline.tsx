import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import StatusBadge from '../ui/StatusBadge';

interface TimelineEvent {
    type: 'COTIZACION' | 'PEDIDO' | 'REMISION' | 'FACTURA';
    id: number;
    number: string;
    date: string;
    status: string;
    amount: number;
    details: string;
}

interface OrderTimelineProps {
    orderId?: number | string;
}

const OrderTimeline: React.FC<OrderTimelineProps> = ({ orderId }) => {
    const { token } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Effect to auto-load if orderId is provided
    React.useEffect(() => {
        if (orderId) {
            fetchTimeline(String(orderId));
        }
    }, [orderId, token]);

    const fetchTimeline = async (idOrNumber: string) => {
        setLoading(true);
        setError('');
        setTimeline([]);

        try {
            let url = '';
            // If passed explicitly as prop, we assume it's an ID if numeric, but let's be safe.
            // The logic below handles both ID and Number search.
            if (/^\d+$/.test(idOrNumber)) {
                url = `/api/analytics/timeline/${idOrNumber}`;
            } else {
                url = `/api/analytics/timeline/0?orderNumber=${encodeURIComponent(idOrNumber)}`;
            }

            const response = await fetch(import.meta.env.VITE_API_URL + url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await response.json();

            if (data.success) {
                setTimeline(data.data);
            } else {
                setError(data.message || 'No se encontró el pedido');
            }
        } catch (err) {
            setError('Error al buscar la línea de tiempo');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;
        fetchTimeline(searchTerm);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'COTIZACION': return 'fa-file-alt text-blue-500';
            case 'PEDIDO': return 'fa-shopping-cart text-orange-500';
            case 'REMISION': return 'fa-truck text-violet-500';
            case 'FACTURA': return 'fa-file-invoice-dollar text-green-500';
            default: return 'fa-circle text-slate-400';
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    };

    return (
        <div className={`bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 ${!orderId ? 'min-h-[500px]' : ''}`}>
            {!orderId && (
                <div className="max-w-xl mx-auto mb-8">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 text-center">Rastreo de Pedido</h3>
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Ingrese ID o Número de Pedido (ej. PED-00025)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading ? <i className="fas fa-spinner fa-spin"></i> : 'Buscar'}
                        </button>
                    </form>
                    {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
                </div>
            )}

            {loading && orderId && (
                <div className="flex justify-center items-center py-12">
                    <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
                </div>
            )}

            {timeline.length > 0 && (
                <div className="max-w-3xl mx-auto relative">
                    {/* Vertical Line */}
                    <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700"></div>

                    <div className="space-y-8">
                        {timeline.map((event, index) => (
                            <div key={`${event.type}-${event.id}`} className="relative flex items-start gap-6 group">
                                {/* Icon Bubble */}
                                <div className="relative z-10 flex items-center justify-center w-16 h-16 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-full shadow-sm group-hover:border-blue-500 transition-colors">
                                    <i className={`fas ${getIcon(event.type)} text-2xl`}></i>
                                </div>

                                {/* Content Card */}
                                <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{event.type}</span>
                                            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">{event.number}</h4>
                                        </div>
                                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                                            {new Date(event.date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{event.details}</p>
                                            <StatusBadge status={event.status as any} />
                                        </div>
                                        {event.amount > 0 && (
                                            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                                {formatCurrency(event.amount)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!loading && timeline.length === 0 && !error && !orderId && (
                <div className="text-center text-slate-400 mt-20">
                    <i className="fas fa-search text-4xl mb-4 opacity-50"></i>
                    <p>Busque un pedido para ver su historial completo.</p>
                </div>
            )}
            {!loading && timeline.length === 0 && !error && orderId && (
                <div className="text-center text-slate-400 mt-10">
                    <p>No se encontró historial para este pedido.</p>
                </div>
            )}
        </div>
    );
};

export default OrderTimeline;
