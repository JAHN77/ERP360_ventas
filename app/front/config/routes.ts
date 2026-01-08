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
  dashboard: '/:companySlug',

  // Clientes
  clientes: '/:companySlug/clientes',
  nuevo_cliente: '/:companySlug/clientes/nuevo',
  editar_cliente: '/:companySlug/clientes/editar/:id',

  // Productos
  productos: '/:companySlug/productos',
  nuevo_producto: '/:companySlug/productos/nuevo',
  editar_producto: '/:companySlug/productos/editar/:id',
  entrada_inventario: '/:companySlug/productos/inventario',
  inventory_concepts: '/:companySlug/inventarios/conceptos',
  conteo_fisico: '/:companySlug/inventarios/conteo-fisico',

  // Categorías
  categorias: '/:companySlug/categorias',
  categoria_detalle: '/:companySlug/categorias/:id',

  // Cotizaciones
  cotizaciones: '/:companySlug/cotizaciones',
  nueva_cotizacion: '/:companySlug/cotizaciones/nueva',
  editar_cotizacion: '/:companySlug/cotizaciones/editar/:id',

  // Pedidos
  pedidos: '/:companySlug/pedidos',
  nuevo_pedido: '/:companySlug/pedidos/nuevo',

  // Ordenes de Compra
  ordenes_compra: '/:companySlug/ordenes-compra',
  nueva_orden_compra: '/:companySlug/ordenes-compra/nueva',

  // Remisiones
  remisiones: '/:companySlug/remisiones',
  editar_remision: '/:companySlug/remisiones/editar/:id',

  // Facturación
  facturacion_electronica: '/:companySlug/facturas',
  nueva_factura: '/:companySlug/facturas/nueva',
  factura_directa: '/:companySlug/facturas/directa',

  // Devoluciones
  devoluciones: '/:companySlug/devoluciones',
  notas_credito_debito: '/:companySlug/devoluciones/notas-credito',

  // Informes
  reportes: '/:companySlug/reportes',
  demas_informes: '/:companySlug/informes',

  // Administración
  activity_log: '/:companySlug/admin/actividad',
  factura_profesional: '/:companySlug/facturas/profesional',
  usuarios: '/:companySlug/configuracion/usuarios',
  perfil: '/:companySlug/perfil',
  analytics: '/:companySlug/analytics',
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

