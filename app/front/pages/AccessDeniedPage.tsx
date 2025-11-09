import React from 'react';
import { useNavigation } from '../hooks/useNavigation';

const AccessDeniedPage: React.FC = () => {
    const { setPage } = useNavigation();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <i className="fas fa-user-lock fa-5x text-red-500 mb-4"></i>
      <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100">Acceso Denegado</h1>
      <p className="text-lg text-slate-600 dark:text-slate-400 mt-2 max-w-md">
        No tienes los permisos necesarios para acceder a esta página. Por favor, contacta al administrador del sistema si crees que esto es un error.
      </p>
      <button 
        onClick={() => setPage('dashboard')}
        className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Volver al Dashboard
      </button>
    </div>
  );
};

export default AccessDeniedPage;