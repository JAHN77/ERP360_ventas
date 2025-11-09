import React from 'react';

interface FullPageSpinnerProps {
  progress?: number;
  message?: string;
}

const FullPageSpinner: React.FC<FullPageSpinnerProps> = ({ 
  progress = 0, 
  message = "Cargando datos iniciales..." 
}) => {
  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center z-[9999]">
      <div className="flex items-center justify-center h-20 mb-6">
          <i className="fas fa-cubes fa-3x text-blue-500 animate-bounce"></i>
          <h1 className="text-4xl font-bold ml-4 text-slate-800 dark:text-white">ERP360</h1>
      </div>
      
      <div className="w-80 max-w-sm mx-4 mb-6">
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 text-center mb-4">
          {Math.round(progress)}% completado
        </div>
      </div>

      <div className="flex items-center space-x-2 mb-4">
        <div className="w-4 h-4 rounded-full bg-blue-400 animate-pulse [animation-delay:-0.3s]"></div>
        <div className="w-4 h-4 rounded-full bg-blue-400 animate-pulse [animation-delay:-0.15s]"></div>
        <div className="w-4 h-4 rounded-full bg-blue-400 animate-pulse"></div>
      </div>
      
      <p className="text-slate-500 dark:text-slate-400 text-center max-w-sm">
        {message}
      </p>
    </div>
  );
};

export default FullPageSpinner;
