import React, { createContext, useState, useEffect, ReactNode, useMemo } from 'react';

type Theme = 'light' | 'dark';

// El contexto ahora solo provee el tema actual, ya que es controlado por el sistema.
interface ThemeContextType {
  theme: Theme;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children?: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Establece el tema inicial basado en la preferencia del sistema
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    // Valor por defecto para entornos que no soportan matchMedia
    return 'light';
  });

  // Este efecto aplica la clase 'dark' al elemento raíz para Tailwind CSS
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  
  // Este efecto escucha los cambios en la preferencia de tema del S.O./navegador
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };

    // Añadir el listener para cambios en tiempo real
    mediaQuery.addEventListener('change', handleChange);
    
    // Limpiar el listener al desmontar el componente
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // El valor del contexto se memoiza y solo contiene el tema actual.
  const value = useMemo(() => ({ theme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};