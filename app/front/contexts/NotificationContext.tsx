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

    const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => {
        const newNotification: Notification = {
            ...notification,
            id: `notif-${Date.now()}`,
            timestamp: Date.now(),
            isRead: false,
        };
        setNotifications(prev => [newNotification, ...prev]);
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

    return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};