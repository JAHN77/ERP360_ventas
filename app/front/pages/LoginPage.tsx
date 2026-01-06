import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { isNotEmpty } from '../utils/validation';

interface Company {
  id: number;
  name: string;
  logo?: string;
  theme?: string;
}

const AVAILABLE_COMPANIES: Company[] = [
  { id: 5, name: 'Multiacabados', theme: 'blue' },
  { id: 6, name: 'Orquidea', theme: 'purple' }
];

const LoginPage: React.FC = () => {
  // Step 0: Company Selection, Step 1: Login
  const [step, setStep] = useState<number>(0);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const [username, setUsername] = useState('WEBADMIN'); // Pre-fill for testing/convenience
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { login, isLoadingBodegas } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (step === 1) {
      if (!isNotEmpty(username)) {
        setUsernameError('El usuario es obligatorio.');
      } else {
        setUsernameError('');
      }
    }
  }, [username, step]);

  const handleCompanySelect = (company: Company) => {
    setSelectedCompany(company);
    setStep(1);
    setError('');
  };

  const handleBackToCompanies = () => {
    setStep(0);
    setSelectedCompany(null);
    setError('');
    setPassword('');
  };

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
      const success = await login(username, password, selectedCompany?.id);
      if (!success) {
        setError('Credenciales inválidas. Verifique usuario y contraseña.');
      }
    } catch (err) {
      setError('Error al iniciar sesión. Intente nuevamente.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Render Company Selection Step
  if (step === 0) {
    return (
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 items-center justify-center p-4">
        <div className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">

          {/* Left Side - Info */}
          <div className="w-full md:w-1/2 bg-gradient-to-br from-slate-800 to-slate-900 p-8 text-white flex flex-col justify-center items-center text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="z-10">
              <div className="mb-6 inline-block p-4 bg-white/10 rounded-full backdrop-blur-sm">
                <i className="fas fa-network-wired fa-3x text-blue-400"></i>
              </div>
              <h2 className="text-3xl font-bold mb-4">Plataforma ERP360</h2>
              <p className="text-slate-300 text-lg">
                Seleccione su empresa para acceder al sistema de gestión.
              </p>
            </div>
            {/* Abstract shapes */}
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          </div>

          {/* Right Side - Company List */}
          <div className="w-full md:w-1/2 p-8 md:p-12 bg-white dark:bg-slate-800">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 text-center">
              Seleccione una Empresa
            </h3>

            <div className="space-y-4">
              {AVAILABLE_COMPANIES.map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleCompanySelect(company)}
                  className={`w-full group relative flex items-center p-4 border-2 rounded-xl transition-all duration-200 hover:shadow-md
                    ${company.id === 5
                      ? 'border-blue-100 hover:border-blue-500 hover:bg-blue-50 dark:border-slate-700 dark:hover:border-blue-400 dark:hover:bg-slate-700'
                      : 'border-purple-100 hover:border-purple-500 hover:bg-purple-50 dark:border-slate-700 dark:hover:border-purple-400 dark:hover:bg-slate-700'
                    }
                  `}
                >
                  <div className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center text-white text-xl font-bold mr-4
                    ${company.id === 5 ? 'bg-blue-500' : 'bg-purple-500'}
                  `}>
                    {company.name.charAt(0)}
                  </div>
                  <div className="flex-grow text-left">
                    <h4 className="text-lg font-semibold text-slate-800 dark:text-white group-hover:text-slate-900 dark:group-hover:text-white">
                      {company.name}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Acceso Corporativo
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
                    <i className="fas fa-chevron-right"></i>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-8 text-center">
              <p className="text-xs text-slate-400">
                &copy; {new Date().getFullYear()} MobilSoft SAS. Plataforma Multi-Empresa.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Login Step
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Decorative Side */}
      <div className={`hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden
        ${selectedCompany?.id === 5
          ? 'bg-gradient-to-br from-blue-600 to-indigo-800'
          : 'bg-gradient-to-br from-purple-600 to-indigo-900'}
      `}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="z-10 text-center text-white p-12">
          <div className="mb-6 inline-block p-4 bg-white/10 rounded-full backdrop-blur-sm">
            <i className="fas fa-building fa-4x text-white"></i>
          </div>
          <h2 className="text-4xl font-bold mb-2">{selectedCompany?.name}</h2>
          <p className="text-blue-100 text-lg max-w-md mx-auto mb-8">
            ERP360 Comercial
          </p>
          <button
            onClick={handleBackToCompanies}
            className="px-6 py-2 bg-white/20 hover:bg-white/30 rounded-full text-sm font-medium transition-colors backdrop-blur-sm flex items-center mx-auto gap-2"
          >
            <i className="fas fa-arrow-left"></i> Cambiar Empresa
          </button>
        </div>
        {/* Abstract shapes */}
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>

      {/* Login Form Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        {/* Mobile Back Button */}
        <button
          onClick={handleBackToCompanies}
          className="lg:hidden absolute top-4 left-4 p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
        >
          <i className="fas fa-arrow-left mr-1"></i> Atrás
        </button>

        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <div className={`lg:hidden inline-block p-3 rounded-full mb-4 text-white
              ${selectedCompany?.id === 5 ? 'bg-blue-600' : 'bg-purple-600'}
            `}>
              <i className="fas fa-building fa-2x"></i>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Iniciar Sesión
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Accediendo a <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedCompany?.name}</span>
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
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${usernameError
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : `border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white ${selectedCompany?.id === 5 ? 'focus:ring-blue-500 focus:border-blue-500' : 'focus:ring-purple-500 focus:border-purple-500'}`
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
                    className={`block w-full pl-10 pr-10 py-3 border rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${passwordError
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : `border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white ${selectedCompany?.id === 5 ? 'focus:ring-blue-500 focus:border-blue-500' : 'focus:ring-purple-500 focus:border-purple-500'}`
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
                className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5
                  ${selectedCompany?.id === 5
                    ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                    : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'}
                `}
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
