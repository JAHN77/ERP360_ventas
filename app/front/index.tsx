import React from 'react';
import ReactDOM from 'react-dom/client';
import singleSpaReact from 'single-spa-react';
import './index.css';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { DataProvider } from './contexts/DataContext';
import ErrorBoundary from './components/ErrorBoundary';

// Componente raíz de la aplicación
const RootComponent = () => {
  return (
    <React.StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <NavigationProvider>
              <DataProvider>
                <NotificationProvider>
                  <App />
                </NotificationProvider>
              </DataProvider>
            </NavigationProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

// Configuración de Single-SPA React
const lifecycles = singleSpaReact({
  React,
  ReactDOM,
  rootComponent: RootComponent,
  errorBoundary(err, info, props) {
    // Manejo de errores personalizado
    console.error('Error en microfrontend erp360-ventas:', err, info, props);
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh', 
        flexDirection: 'column', 
        gap: '1rem', 
        padding: '2rem', 
        textAlign: 'center' 
      }}>
        <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Error en el módulo de Ventas</h2>
        <p style={{ color: '#64748b', marginBottom: '1rem' }}>
          {err instanceof Error ? err.message : 'Error desconocido'}
        </p>
        <button 
          onClick={() => window.location.reload()} 
          style={{ 
            padding: '0.5rem 1rem', 
            background: '#3b82f6', 
            color: 'white', 
            border: 'none', 
            borderRadius: '0.375rem', 
            cursor: 'pointer' 
          }}
        >
          Recargar página
        </button>
      </div>
    );
  },
});

// Exportar las funciones lifecycle requeridas por Single-SPA
export const { bootstrap, mount, unmount } = lifecycles;

// Para desarrollo standalone (cuando no se usa Single-SPA)
// Esto permite que la app funcione independientemente durante desarrollo
// Solo se ejecuta si no está corriendo dentro de Single-SPA
if (typeof window !== 'undefined' && !(window as any).singleSpaNavigate) {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<RootComponent />);
  }
}

