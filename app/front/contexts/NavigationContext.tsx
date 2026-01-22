import React, { createContext, useState, ReactNode, useMemo, useCallback, useEffect } from 'react';
import { NavigateFunction, Location } from 'react-router-dom';
import { pageToRoute, routeToPage, getBasePath } from '../config/routes';
import { useAuth } from '../hooks/useAuth';

export type Page =
  'dashboard' |
  'clientes' | 'nuevo_cliente' | 'editar_cliente' |
  'productos' | 'nuevo_producto' | 'editar_producto' | 'entrada_inventario' | 'nuevo_servicio' |
  'categorias' | 'categoria_detalle' |
  'cotizaciones' | 'nueva_cotizacion' | 'editar_cotizacion' |
  'pedidos' | 'nuevo_pedido' |
  'ordenes_compra' | 'nueva_orden_compra' |
  'remisiones' | 'editar_remision' |
  'facturacion_electronica' | 'nueva_factura' | 'factura_directa' |
  'devoluciones' |
  'notas_credito_debito' |
  'demas_informes' |
  'reportes' |
  'factura_profesional' |
  'activity_log' |
  'inventory_concepts' |
  'conteo_fisico' |
  'usuarios' |
  'perfil' |
  'analytics';

interface NavigationState {
  page: Page;
  params: Record<string, any>;
}

interface NavigationContextType {
  page: Page;
  params: Record<string, any>;
  setPage: (page: Page, params?: Record<string, any>) => void;
  navigate: (path: string) => void;
}

export const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

interface NavigationProviderProps {
  children?: ReactNode;
  navigate?: NavigateFunction;
  location?: Location;
}

/**
 * NavigationProvider mejorado con soporte para React Router
 * Funciona tanto con Router como sin él (modo standalone)
 */
export const NavigationProvider = ({
  children,
  navigate: routerNavigate,
  location: routerLocation
}: NavigationProviderProps) => {
  const { selectedCompany } = useAuth();
  const [state, setState] = useState<NavigationState>({ page: 'dashboard', params: {} });
  const hasRouter = !!routerNavigate && !!routerLocation;

  // Sincronizar URL con estado cuando cambia la ubicación (solo si hay router)
  useEffect(() => {
    if (hasRouter && routerLocation) {
      const routeData = routeToPage(routerLocation.pathname);
      if (routeData) {
        setState({ page: routeData.page, params: routeData.params });
      }
    } else if (!hasRouter && typeof window !== 'undefined') {
      // En modo sin router, leer de la URL actual
      const routeData = routeToPage(window.location.pathname);
      if (routeData) {
        setState({ page: routeData.page, params: routeData.params });
      }
    }
  }, [hasRouter, routerLocation?.pathname]);

  const setPage = useCallback((page: Page, params: Record<string, any> = {}) => {
    // Inyectar automáticamente companySlug si no está presente
    const finalParams = { ...params };
    if (!finalParams.companySlug && selectedCompany?.db_name) {
      finalParams.companySlug = selectedCompany.db_name;
    }

    const route = pageToRoute(page, finalParams);

    // Si hay router, actualizar URL
    if (hasRouter && routerNavigate) {
      routerNavigate(route, { replace: false });
    } else {
      // Modo sin router: actualizar URL manualmente
      const basePath = getBasePath();
      const fullPath = basePath + route;
      window.history.pushState({}, '', fullPath);
    }

    // Actualizar estado local
    setState({ page, params });
  }, [hasRouter, routerNavigate]);

  const handleNavigate = useCallback((path: string) => {
    if (hasRouter && routerNavigate) {
      routerNavigate(path);
    } else {
      const basePath = getBasePath();
      const fullPath = basePath + path;
      window.history.pushState({}, '', fullPath);
      // Actualizar estado basado en la nueva ruta
      const routeData = routeToPage(path);
      if (routeData) {
        setState({ page: routeData.page, params: routeData.params });
      }
    }
  }, [hasRouter, routerNavigate]);

  const value = useMemo(() => ({
    ...state,
    setPage,
    navigate: handleNavigate,
  }), [state, setPage, handleNavigate]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};
