import React from 'react';

interface LoadingProgressProps {
  progress: number;
  message: string;
  isVisible: boolean;
}

const LoadingProgress: React.FC<LoadingProgressProps> = ({ progress, message, isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-80 max-w-sm mx-4">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-16 h-16 mx-auto mb-4">
              <img src="/assets/ciclolider.png" alt="Ciclo Lider" className="h-16 w-auto object-contain mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
              Cargando...
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {message}
            </p>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
            <div
              className="bg-red-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            {Math.round(progress)}% completado
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingProgress;
