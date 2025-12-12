import React, { createContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { Notification } from '../types';
import { useNavigation } from '../hooks/useNavigation';
import type { Page } from './NavigationContext';
import { useData } from '../hooks/useData';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void;
    markAllAsRead: () => void;
    handleNotificationClick: (notification: Notification) => void;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
    children?: ReactNode;
}

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const { setPage } = useNavigation();
    const { cotizaciones } = useData();

    useEffect(() => {
        const checkExpiringQuotes = () => {
            if (!cotizaciones) return;

            const today = new Date();
            today.setHours(0, 0, 0, 0); // Comparar desde el inicio del día
            const upcomingNotifications: Notification[] = [];

            cotizaciones.forEach(quote => {
                if (quote.estado !== 'ENVIADA') return;

                const expiryDate = new Date(quote.fechaVencimiento + 'T00:00:00'); // Asumir fecha local
                const timeDiff = expiryDate.getTime() - today.getTime();
                const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

                if (daysUntilExpiry >= 0 && daysUntilExpiry <= 7) {
                    const message = daysUntilExpiry === 0
                        ? `La cotización ${quote.numeroCotizacion} vence hoy.`
                        : `La cotización ${quote.numeroCotizacion} vence en ${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'día' : 'días'}.`;

                    upcomingNotifications.push({
                        id: `notif-exp-${quote.id}`,
                        message,
                        type: 'warning',
                        timestamp: Date.now(),
                        isRead: false,
                        relatedId: quote.id,
                        link: { page: 'cotizaciones', params: { focusId: quote.id } }
                    });
                }
            });

            if (upcomingNotifications.length > 0) {
                setNotifications(prev => {
                    const existingIds = new Set(prev.map(n => n.id));
                    const newUniqueNotifications = upcomingNotifications.filter(n => !existingIds.has(n.id));
                    return [...newUniqueNotifications, ...prev];
                });
            }
        };

        checkExpiringQuotes();
    }, [cotizaciones]);

    // --- TOAST LOGIC ---
    // Mantenemos una lista separada para los toasts visuales que desaparecen automáticamente
    const [toasts, setToasts] = useState<Notification[]>([]);

    useEffect(() => {
        if (notifications.length > 0) {
            // Cuando llega una notificación, verificar si es reciente (menos de 100ms) para mostrar toast
            // O más simple: addNotification agrega a ambos estados
        }
    }, [notifications]);

    // Override addNotification para manejar toasts
    const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => {
        const newNotification: Notification = {
            ...notification,
            id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            isRead: false,
        };
        // Agregar a la lista de historial
        setNotifications(prev => [newNotification, ...prev]);

        // Agregar a la lista de toasts visuales
        setToasts(prev => [...prev, newNotification]);

        // Auto-eliminar de toasts dsp de 4 segundos
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== newNotification.id));
        }, 4000);
    }, []);

    const markAsRead = useCallback((id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    }, []);

    const handleNotificationClick = useCallback((notification: Notification) => {
        if (!notification.isRead) {
            markAsRead(notification.id);
        }
        if (notification.link) {
            setPage(notification.link.page as Page, notification.link.params);
        }
    }, [markAsRead, setPage]);

    const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

    const value = useMemo(() => ({
        notifications,
        unreadCount,
        addNotification,
        markAllAsRead,
        handleNotificationClick,
    }), [notifications, unreadCount, addNotification, markAllAsRead, handleNotificationClick]);

    return (
        <NotificationContext.Provider value={value}>
            {children}
            {/* TOAST CONTAINER */}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
                pointer-events-auto min-w-[300px] max-w-sm w-full bg-white dark:bg-slate-800 
                border-l-4 rounded shadow-2xl p-4 flex items-start gap-3 
                transform transition-all duration-300 animate-[slideIn_0.3s_ease-out]
                ${toast.type === 'success' ? 'border-emerald-500' :
                                toast.type === 'error' ? 'border-red-500' :
                                    toast.type === 'warning' ? 'border-amber-500' : 'border-blue-500'}
              `}
                        role="alert"
                    >
                        <div className={`mt-0.5 text-lg
                ${toast.type === 'success' ? 'text-emerald-500' :
                                toast.type === 'error' ? 'text-red-500' :
                                    toast.type === 'warning' ? 'text-amber-500' : 'text-blue-500'}
              `}>
                            <i className={`fas fa-${toast.type === 'success' ? 'check-circle' :
                                toast.type === 'error' ? 'times-circle' :
                                    toast.type === 'warning' ? 'exclamation-triangle' : 'info-circle'
                                }`}></i>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                {toast.type === 'success' ? 'Éxito' :
                                    toast.type === 'error' ? 'Error' :
                                        toast.type === 'warning' ? 'Advertencia' : 'Información'}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 break-words">
                                {toast.message}
                            </p>
                        </div>
                        <button
                            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            title="Cerrar"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
};