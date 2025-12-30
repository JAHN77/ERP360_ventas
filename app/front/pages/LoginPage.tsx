import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { isNotEmpty } from '../utils/validation';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('WEBADMIN'); // Pre-fill for testing/convenience
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { login, isLoadingBodegas } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isNotEmpty(username)) {
      setUsernameError('El usuario es obligatorio.');
    } else {
      setUsernameError('');
    }
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let hasError = false;
    if (!isNotEmpty(username)) {
      setUsernameError('El usuario es obligatorio.');
      hasError = true;
    }
    if (!isNotEmpty(password)) {
      setPasswordError('La contraseña es obligatoria.');
      hasError = true;
    }

    if (hasError) return;

    setIsLoggingIn(true);
    try {
      const success = await login(username, password);
      if (!success) {
        setError('Credenciales inválidas. Verifique usuario y contraseña.');
      }
    } catch (err) {
      setError('Error al iniciar sesión. Intente nuevamente.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const inputClasses = (hasError: boolean) => `w-full px-4 py-2 mt-2 text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-2 ${hasError ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'}`;

  // If loading bodegas is critical for the app to function after login, we might want to show spinner. 
  // But usually login page is shown BEFORE bodegas are loaded (which happens inside AuthContext/App).
  // However, AuthContext might be checking auth status on mount.
  if (isLoadingBodegas) {
    // This loading state usually comes from the initial auth check or bodega fetching.
    // We can show a spinner if we are waiting for something global.
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Decorative Side (Optional - hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-800 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="z-10 text-center text-white p-12">
          <div className="mb-6 inline-block p-4 bg-white/10 rounded-full backdrop-blur-sm">
            <i className="fas fa-cubes fa-4x text-white"></i>
          </div>
          <h2 className="text-4xl font-bold mb-4">ERP360 Comercial</h2>
          <p className="text-blue-100 text-lg max-w-md mx-auto">
            Gestión integral de ventas, inventario y facturación para tu negocio.
          </p>
        </div>
        {/* Abstract shapes */}
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      </div>

      {/* Login Form Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <div className="lg:hidden inline-block p-3 bg-blue-600 rounded-full mb-4">
              <i className="fas fa-cubes fa-2x text-white"></i>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Bienvenido de nuevo
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="space-y-5">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Usuario
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <i className="fas fa-user"></i>
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toUpperCase())}
                    placeholder="Ej: WEBADMIN"
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${usernameError
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : 'border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white focus:border-blue-500'
                      }`}
                  />
                </div>
                {usernameError && <p className="mt-1 text-sm text-red-500 flex items-center gap-1"><i className="fas fa-circle-exclamation text-xs"></i> {usernameError}</p>}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <i className="fas fa-lock"></i>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                    placeholder="••••••••"
                    className={`block w-full pl-10 pr-10 py-3 border rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${passwordError
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white focus:border-blue-500'
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                {passwordError && <p className="mt-1 text-sm text-red-500 flex items-center gap-1"><i className="fas fa-circle-exclamation text-xs"></i> {passwordError}</p>}
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <i className="fas fa-circle-xmark text-red-400"></i>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error de autenticación</h3>
                    <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={!!usernameError || isLoggingIn}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
              >
                {isLoggingIn ? (
                  <span className="flex items-center">
                    <i className="fas fa-circle-notch fa-spin mr-2"></i>
                    Iniciando sesión...
                  </span>
                ) : (
                  <span className="flex items-center">
                    Ingresar al Sistema
                    <i className="fas fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                  </span>
                )}
              </button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                &copy; {new Date().getFullYear()} MobilSoft SAS. Todos los derechos reservados.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
