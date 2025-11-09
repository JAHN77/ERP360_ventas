import React from 'react';
import { Notification } from '../../types';
import { timeSince } from '../../utils/dateUtils';

interface NotificationDropdownProps {
    notifications: Notification[];
    handleNotificationClick: (notification: Notification) => void;
    onMarkAllAsRead: () => void;
    onClose: () => void;
}

const NotificationIcon: React.FC<{ type: Notification['type'] }> = ({ type }) => {
  const baseClass = "w-5 h-5 text-center";
  switch (type) {
    case 'success':
      return <i className={`fas fa-check-circle text-green-500 ${baseClass}`}></i>;
    case 'warning':
      return <i className={`fas fa-exclamation-triangle text-yellow-500 ${baseClass}`}></i>;
    case 'info':
      return <i className={`fas fa-info-circle text-blue-500 ${baseClass}`}></i>;
    default:
      return <i className={`fas fa-bell text-slate-500 ${baseClass}`}></i>;
  }
};

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ notifications, handleNotificationClick, onMarkAllAsRead, onClose }) => {
    
    const handleClick = (n: Notification) => {
        handleNotificationClick(n);
        onClose();
    };

    const hasUnread = notifications.some(n => !n.isRead);

    return (
        <div 
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 z-[100]"
            aria-labelledby="notifications-heading"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex justify-between items-center p-3 border-b border-slate-200 dark:border-slate-700">
                <h4 id="notifications-heading" className="font-semibold text-slate-800 dark:text-slate-100">Notificaciones</h4>
                {hasUnread && (
                    <button onClick={onMarkAllAsRead} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                        Marcar todas como leídas
                    </button>
                )}
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                {notifications.length > 0 ? (
                    notifications.map(n => (
                        <div
                            key={n.id}
                            onClick={() => handleClick(n)}
                            className={`p-3 flex items-start gap-3 cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/50 ${!n.isRead ? 'bg-blue-50 dark:bg-slate-900/50' : ''}`}
                            role="button"
                            tabIndex={0}
                        >
                            <div className="flex-shrink-0 pt-1">
                                <NotificationIcon type={n.type} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-slate-700 dark:text-slate-300">{n.message}</p>
                                <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">{timeSince(n.timestamp)}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center p-8 text-sm text-slate-500 dark:text-slate-400">
                        <i className="fas fa-check-circle fa-2x mb-2 text-slate-300 dark:text-slate-600"></i>
                        <p>Estás al día</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationDropdown;