import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Componente Spinner simple para estados de carga
 * Usado principalmente en Suspense fallbacks
 */
const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'md',
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <div className={`${sizeClasses[size]} border-4 border-slate-200 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin`}></div>
    </div>
  );
};

export default Spinner;

