import React from 'react';

type StatusType =
    // Cotizaciones
    'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA' | 'VENCIDA' |
    // Pedidos
    'CONFIRMADO' | 'EN_PROCESO' | 'PARCIALMENTE_REMITIDO' | 'REMITIDO' | 'CANCELADO' |
    // Remisiones
    'EN_TRANSITO' | 'ENTREGADO' |
    // Facturas
    'ACEPTADA' | 'ANULADA' |
    // Facturación y Pagos
    'FACTURADA' | 'FACTURADO_PARCIAL' | 'FACTURADO_TOTAL' | 'PAGADA' |
    // Devoluciones
    'DEVOLUCION_PARCIAL' | 'DEVOLUCION_TOTAL' |
    // Otros
    'PENDIENTE' | 'Total' | 'Parcial' | 'Entrada' | 'Transmitido' | 'Error';


interface StatusBadgeProps {
    status: StatusType | null | undefined;
    className?: string;
}

const statusColors: Record<StatusType, string> = {
    // Generales
    'BORRADOR': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    'PENDIENTE': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    'CANCELADO': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    'ANULADA': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    'RECHAZADA': 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
    'VENCIDA': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',

    // Flujo de Ventas
    'ENVIADA': 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-300',
    'APROBADA': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    'CONFIRMADO': 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300',
    'EN_PROCESO': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
    'PARCIALMENTE_REMITIDO': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    'REMITIDO': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',

    // Entrega
    'EN_TRANSITO': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
    'ENTREGADO': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',

    // Facturación y Pagos
    'ACEPTADA': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    'FACTURADA': 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-300',
    'FACTURADO_PARCIAL': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
    'FACTURADO_TOTAL': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
    'PAGADA': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',

    // Devoluciones
    'DEVOLUCION_PARCIAL': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
    'DEVOLUCION_TOTAL': 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',

    // Otros
    'Total': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    'Parcial': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    'Entrada': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    'Transmitido': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    'Error': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
    if (typeof status !== 'string' || !status) {
        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full inline-block bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300 ${className}`}>
                Indefinido
            </span>
        );
    }
    const baseClasses = 'px-2 py-1 text-xs font-semibold rounded-full inline-block';
    const colorClasses = statusColors[status as StatusType] || 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';

    // Convert snake_case to Title Case for display
    const formattedStatus = status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());

    return <span className={`${baseClasses} ${colorClasses} ${className}`}>{formattedStatus}</span>;
}

export default StatusBadge;