import React, { createContext, useState, ReactNode, useMemo, useCallback } from 'react';

export type Page = 
    'dashboard' | 
    'clientes' | 'nuevo_cliente' | 'editar_cliente' |
    'productos' | 'nuevo_producto' | 'editar_producto' | 'entrada_inventario' |
    'categorias' | 'categoria_detalle' |
    'cotizaciones' | 'nueva_cotizacion' | 'editar_cotizacion' |
    'pedidos' | 'nuevo_pedido' |
    'remisiones' | 'editar_remision' |
    'facturacion_electronica' | 'nueva_factura' |
    'devoluciones' | 
    'notas_credito_debito' | 
    'demas_informes' |
    'reportes' |
    'factura_profesional' |
    'activity_log';

interface NavigationState {
    page: Page;
    params: Record<string, any>;
}

interface NavigationContextType {
  page: Page;
  params: Record<string, any>;
  setPage: (page: Page, params?: Record<string, any>) => void;
}

export const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

// Fix: Defining a dedicated props interface improves readability and can resolve obscure typing errors.
interface NavigationProviderProps {
  // FIX: Made 'children' prop optional to fix an error where TypeScript did not recognize it as implicitly passed in index.tsx.
  children?: ReactNode;
}

export const NavigationProvider = ({ children }: NavigationProviderProps) => {
  const [state, setState] = useState<NavigationState>({ page: 'dashboard', params: {} });

  const setPage = useCallback((page: Page, params: Record<string, any> = {}) => {
    setState({ page, params });
  }, []);

  const value = useMemo(() => ({ ...state, setPage }), [state, setPage]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};
