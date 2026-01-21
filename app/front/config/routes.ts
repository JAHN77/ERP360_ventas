import { Page } from '../contexts/NavigationContext';

/**
 * Configuración de rutas para el microfrontend
 * Compatible con Single-SPA y funcionamiento standalone
 */

export interface RouteConfig {
  path: string;
  page: Page;
  params?: Record<string, string>;
}

/**
 * Mapeo de páginas a rutas URL
 * Las rutas son relativas al base path del microfrontend
 */
export const routeMap: Record<Page, string> = {
  // Dashboard
  dashboard: '/',

  // Clientes
  clientes: '/clientes',
  nuevo_cliente: '/clientes/nuevo',
  editar_cliente: '/clientes/editar/:id',

  // Productos
  productos: '/productos',
  nuevo_producto: '/productos/nuevo',
  editar_producto: '/productos/editar/:id',
  entrada_inventario: '/productos/inventario',
  inventory_concepts: '/inventarios/conceptos',
  conteo_fisico: '/inventarios/conteo-fisico',

  // Categorías
  categorias: '/categorias',
  categoria_detalle: '/categorias/:id',

  // Cotizaciones
  cotizaciones: '/cotizaciones',
  nueva_cotizacion: '/cotizaciones/nueva',
  editar_cotizacion: '/cotizaciones/editar/:id',

  // Pedidos
  pedidos: '/pedidos',
  nuevo_pedido: '/pedidos/nuevo',

  // Ordenes de Compra
  ordenes_compra: '/ordenes-compra',
  nueva_orden_compra: '/ordenes-compra/nueva',

  // Remisiones
  remisiones: '/remisiones',
  editar_remision: '/remisiones/editar/:id',

  // Facturación
  facturacion_electronica: '/facturas',
  nueva_factura: '/facturas/nueva',
  factura_directa: '/facturas/directa',

  // Devoluciones
  devoluciones: '/devoluciones',
  notas_credito_debito: '/devoluciones/notas-credito',

  // Informes
  reportes: '/reportes',
  demas_informes: '/informes',

  // Administración
  activity_log: '/admin/actividad',
  factura_profesional: '/facturas/profesional',
  usuarios: '/configuracion/usuarios',
  perfil: '/perfil',
};

/**
 * Convierte una página y parámetros a una ruta URL
 */
export const pageToRoute = (page: Page, params: Record<string, any> = {}): string => {
  let route = routeMap[page];

  if (!route) {
    console.warn(`No hay ruta definida para la página: ${page}`);
    return '/';
  }

  // Reemplazar parámetros en la ruta
  Object.keys(params).forEach(key => {
    route = route.replace(`:${key}`, String(params[key]));
  });

  return route;
};

/**
 * Convierte una ruta URL a una página y parámetros
 */
export const routeToPage = (pathname: string): { page: Page; params: Record<string, any> } | null => {
  // Normalizar pathname (remover base path si existe)
  const normalizedPath = pathname.replace(/^\/erp360-ventas/, '') || '/';

  // Buscar la ruta que coincida
  for (const [page, route] of Object.entries(routeMap)) {
    const routePattern = route.replace(/:[^/]+/g, '([^/]+)');
    const regex = new RegExp(`^${routePattern}$`);
    const match = normalizedPath.match(regex);

    if (match) {
      // Extraer parámetros de la ruta
      const paramNames = route.match(/:([^/]+)/g)?.map(p => p.substring(1)) || [];
      const params: Record<string, any> = {};

      paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });

      return { page: page as Page, params };
    }
  }

  return null;
};

/**
 * Obtiene el base path para el microfrontend
 * En Single-SPA, esto viene del root config
 * En modo standalone, es '/'
 */
export const getBasePath = (): string => {
  if (typeof window !== 'undefined') {
    // Si estamos en Single-SPA, el base path puede estar en window
    const singleSpaBase = (window as any).__SINGLE_SPA_BASE_PATH__;
    if (singleSpaBase) {
      return singleSpaBase;
    }

    // Intentar detectar desde la URL
    const pathname = window.location.pathname;
    if (pathname.includes('/erp360-ventas')) {
      return '/erp360-ventas';
    }
  }

  return '';
};

