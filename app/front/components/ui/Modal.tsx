import React, { ReactNode, useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  noPadding?: boolean;
  className?: string; // Permitir clases personalizadas
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'lg', noPadding = false, className = '' }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center items-center p-2 sm:p-4 transition-opacity duration-300 bg-slate-900/30 backdrop-blur-sm"
      style={{ opacity: isOpen ? 1 : 0 }}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-white/95 dark:bg-slate-800/90 backdrop-blur rounded-none sm:rounded-lg shadow-2xl w-full max-w-[95vw] sm:max-w-full ${sizeClasses[size]} transform transition-all duration-300 flex flex-col h-[95vh] sm:h-auto sm:max-h-[85vh] ${className}`}
        style={{ transform: isOpen ? 'scale(1)' : 'scale(0.95)', opacity: isOpen ? 1 : 0 }}
        onClick={e => e.stopPropagation()} // Prevent modal from closing when clicking inside
      >
        {title && (
          <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
            <button
              onClick={onClose}
              className="text-slate-400 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white rounded-lg text-sm p-1.5 ml-auto inline-flex items-center"
              aria-label="Cerrar modal"
            >
              <i className="fas fa-times fa-lg"></i>
            </button>
          </div>
        )}
        <div className={`${noPadding ? '' : 'p-3 sm:p-4 md:p-6'} sm:max-h-[85vh] max-h-[calc(95vh-64px)] overflow-y-auto`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;