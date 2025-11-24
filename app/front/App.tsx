import React from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import AppRouter from './components/routing/AppRouter';

/**
 * Componente principal de la aplicación
 * Ahora usa React Router para enrutado real con URLs
 * Compatible con Single-SPA y funcionamiento standalone
 * El RouterWrapper en index.tsx maneja el BrowserRouter
 */
const App: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  // Si no está autenticado, mostrar página de login
  if (!isAuthenticated || !user) {
    return <LoginPage />;
  }

  // Si está autenticado, mostrar el router con las rutas protegidas
  return <AppRouter />;
};

export default App;
