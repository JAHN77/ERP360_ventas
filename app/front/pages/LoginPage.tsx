import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Role, availableRoles } from '../config/rolesConfig';
import { isEmail, isNotEmpty } from '../utils/validation';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('admin@erp360.com');
  const [role, setRole] = useState<Role>('admin');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const { login, isLoadingBodegas } = useAuth();

  useEffect(() => {
    if (!isNotEmpty(email)) {
      setEmailError('El correo es obligatorio.');
    } else if (!isEmail(email)) {
      setEmailError('Por favor, ingrese un correo válido.');
    } else {
      setEmailError('');
    }
  }, [email]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (emailError || !isNotEmpty(email)) {
      if (!isNotEmpty(email)) setEmailError('El correo es obligatorio.');
      return;
    }

    const success = login(email, role);
    if (!success) {
      setError('Credenciales inválidas. Intente con "admin@erp360.com"');
    }
  };

  const inputClasses = `w-full px-4 py-2 mt-2 text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-2 ${emailError ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
    }`;

  if (isLoadingBodegas) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <i className="fas fa-cubes fa-3x text-blue-500 animate-pulse"></i>
          <h1 className="text-2xl font-bold mt-4 text-slate-800 dark:text-slate-100">Cargando bodegas...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
        <div className="text-center">
          <i className="fas fa-cubes fa-3x text-blue-500"></i>
          <h1 className="text-3xl font-bold mt-2 text-slate-800 dark:text-slate-100">ERP360 Comercial</h1>
          <p className="text-slate-500 dark:text-slate-400">Inicia sesión para continuar</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@dominio.com"
              className={inputClasses}
            />
            {emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
          </div>
          <div>
            <label htmlFor="role" className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Simular Rol
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full px-4 py-2 mt-2 text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableRoles.map(r => <option key={r} value={r}>{r.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={!!emailError}
            className="w-full px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
