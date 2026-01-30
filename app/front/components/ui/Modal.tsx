import React, { ReactNode, useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
  maxWidth?: string; // Allow direct maxWidth override
  noPadding?: boolean;
  className?: string; // Permitir clases personalizadas
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'lg', maxWidth, noPadding = false, className = '' }) => {
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
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
    '3xl': 'sm:max-w-3xl',
    '4xl': 'sm:max-w-4xl',
    '5xl': 'sm:max-w-5xl',
    '6xl': 'sm:max-w-6xl',
    '7xl': 'sm:max-w-7xl',
    full: 'sm:max-w-full sm:m-4',
  };

  // Fallback or custom size handling
  const maxWidthClass = maxWidth || sizeClasses[size as keyof typeof sizeClasses] || sizeClasses['4xl'];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center items-center p-2 sm:p-4 transition-opacity duration-300 bg-slate-900/60 backdrop-blur-[2px]"
      style={{ opacity: isOpen ? 1 : 0 }}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full ${maxWidthClass} transform transition-all duration-300 flex flex-col max-h-[95vh] sm:max-h-[90vh] ${className}`}
        style={{ transform: isOpen ? 'scale(1)' : 'scale(0.95)', opacity: isOpen ? 1 : 0 }}
        onClick={e => e.stopPropagation()} // Prevent modal from closing when clicking inside
      >
        {title && (
          <div className="flex justify-between items-center p-3 sm:p-4 md:p-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <h3 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
            <button
              onClick={onClose}
              className="text-slate-400 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white rounded-lg text-sm w-8 h-8 sm:w-auto sm:h-auto p-2 sm:p-1.5 ml-2 sm:ml-auto inline-flex items-center justify-center min-w-[32px] min-h-[32px]"
              aria-label="Cerrar modal"
            >
              <i className="fas fa-times text-base sm:text-lg"></i>
            </button>
          </div>
        )}
        <div className={`${noPadding ? '' : 'p-4 sm:p-5 md:p-6'} max-h-[calc(95vh-56px)] sm:max-h-[85vh] overflow-y-auto`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;