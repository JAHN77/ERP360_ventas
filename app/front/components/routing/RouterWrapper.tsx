import React from 'react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { NavigationProvider } from '../../contexts/NavigationContext';

/**
 * Wrapper interno que usa los hooks de React Router
 */
const NavigationProviderWithRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Pasar navigate y location al provider a través de un contexto interno
  return (
    <NavigationProvider navigate={navigate} location={location}>
      {children}
    </NavigationProvider>
  );
};

/**
 * Wrapper que proporciona BrowserRouter solo si no estamos en Single-SPA
 */
export const RouterWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Verificar si estamos en Single-SPA
  const isSingleSpa = typeof window !== 'undefined' && !!(window as any).singleSpaNavigate;
  
  if (isSingleSpa) {
    // En Single-SPA, el router se maneja desde el root config
    // Solo proporcionar el NavigationProvider sin BrowserRouter
    return (
      <NavigationProvider>
        {children}
      </NavigationProvider>
    );
  }
  
  // En modo standalone, usar BrowserRouter
  return (
    <BrowserRouter>
      <NavigationProviderWithRouter>
        {children}
      </NavigationProviderWithRouter>
    </BrowserRouter>
  );
};

