import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Importar CSS aquí para que Vite lo procese
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { DataProvider } from './contexts/DataContext';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Ocultar el fallback de carga
const loadingFallback = document.getElementById('loading-fallback');
if (loadingFallback) {
  loadingFallback.style.display = 'none';
}

const root = ReactDOM.createRoot(rootElement);

// Manejar errores de renderizado
try {
  root.render(
  <React.StrictMode>
    {/* ErrorBoundary debe estar en el nivel más externo para capturar errores */}
    <ErrorBoundary>
      {/* ThemeProvider: No tiene dependencias, puede ir primero */}
      <ThemeProvider>
        {/* AuthProvider: No tiene dependencias, puede ir segundo */}
        <AuthProvider>
          {/* NavigationProvider: No tiene dependencias, puede ir tercero */}
          <NavigationProvider>
            {/* DataProvider: Depende de AuthProvider (usa useAuth), debe estar dentro de AuthProvider */}
            <DataProvider>
              {/* NotificationProvider: Depende de NavigationProvider (usa useNavigation) y DataProvider (usa useData), 
                  debe estar dentro de ambos */}
              <NotificationProvider>
                {/* App: Contiene Layout y Header que usan useData(), debe estar dentro de DataProvider */}
                <App />
              </NotificationProvider>
            </DataProvider>
          </NavigationProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
  );
} catch (error) {
  console.error('Error al renderizar la aplicación:', error);
  rootElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; flex-direction: column; gap: 1rem; padding: 2rem; text-align: center;">
      <h2 style="color: #ef4444; margin-bottom: 1rem;">Error al iniciar la aplicación</h2>
      <p style="color: #64748b; margin-bottom: 1rem;">${error instanceof Error ? error.message : 'Error desconocido'}</p>
      <button onclick="window.location.reload()" style="padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.375rem; cursor: pointer;">
        Recargar página
      </button>
    </div>
  `;
}