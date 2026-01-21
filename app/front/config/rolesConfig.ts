import { Page } from '../contexts/NavigationContext';

export const availableRoles = [
  'vendedor',
  'almacenista',
  'logistica',
  'facturacion',
  'admin',
  'supervisor_comercial',
  'coordinador_pedidos',
  'compras',
  'contabilidad',
  'postventa',
  'auditor'
] as const;
export type Role = typeof availableRoles[number];

export type Permission =
  | 'dashboard:view'
  | 'clientes:view' | 'clientes:create' | 'clientes:edit'
  | 'productos:view' | 'productos:create' | 'productos:edit'
  | 'inventario:create' | 'inventario:create-purchase-order' | 'inventario:approve-restocking'
  | 'cotizaciones:view' | 'cotizaciones:create' | 'cotizaciones:edit' | 'cotizaciones:approve' | 'cotizaciones:delete'
  | 'cotizaciones:supervise' // Supervisor approves for client sending
  | 'pedidos:view' | 'pedidos:create' | 'pedidos:edit' | 'pedidos:approve' | 'pedidos:mark-ready-for-dispatch' | 'pedidos:delete'
  | 'remisiones:view' | 'remisiones:create' | 'remisiones:update' | 'remisiones:deliver' | 'remisiones:delete'
  | 'facturacion:view' | 'facturacion:create' | 'facturacion:send' | 'facturacion:stamp' | 'facturacion:validate' | 'facturacion:delete'
  | 'devoluciones:view' | 'devoluciones:create' | 'devoluciones:manage' | 'devoluciones:delete'
  | 'notas_credito:view' | 'notas_credito:create'
  | 'reportes:view'
  | 'admin:view-activity-log' | 'admin:review-critical-actions' | 'admin:manage-users'
  | '*'; // Wildcard for admin

type RoleConfig = {
  can: Permission[];
  pages: Page[];
};

export const rolesConfig: Record<Role, RoleConfig> = {
  vendedor: {
    can: ['dashboard:view', 'cotizaciones:view', 'cotizaciones:create', 'cotizaciones:edit', 'clientes:view', 'clientes:create', 'clientes:edit', 'productos:view', 'cotizaciones:approve', 'pedidos:create', 'reportes:view'],
    pages: ['dashboard', 'cotizaciones', 'nueva_cotizacion', 'editar_cotizacion', 'clientes', 'productos', 'pedidos', 'nuevo_pedido', 'reportes', 'demas_informes'],
  },
  supervisor_comercial: {
    can: ['dashboard:view', 'cotizaciones:view', 'cotizaciones:supervise', 'clientes:view', 'clientes:create', 'clientes:edit', 'productos:view', 'reportes:view', 'pedidos:edit', 'pedidos:approve'],
    pages: ['dashboard', 'cotizaciones', 'clientes', 'productos', 'reportes', 'pedidos', 'demas_informes'],
  },
  coordinador_pedidos: {
    can: ['dashboard:view', 'pedidos:view', 'pedidos:edit', 'pedidos:approve', 'pedidos:mark-ready-for-dispatch', 'remisiones:view', 'reportes:view'],
    pages: ['dashboard', 'pedidos', 'remisiones', 'reportes', 'demas_informes'],
  },
  almacenista: {
    can: ['dashboard:view', 'pedidos:view', 'remisiones:view', 'remisiones:create', 'productos:view', 'inventario:create', 'reportes:view'],
    pages: ['dashboard', 'pedidos', 'remisiones', 'editar_remision', 'productos', 'entrada_inventario', 'reportes', 'demas_informes'],
  },
  compras: {
    can: ['dashboard:view', 'productos:view', 'inventario:create', 'inventario:create-purchase-order', 'inventario:approve-restocking', 'reportes:view'],
    pages: ['dashboard', 'productos', 'entrada_inventario', 'reportes', 'demas_informes'],
  },
  logistica: {
    can: ['dashboard:view', 'remisiones:view', 'remisiones:update', 'remisiones:deliver', 'reportes:view'],
    pages: ['dashboard', 'remisiones', 'editar_remision', 'reportes', 'demas_informes'],
  },
  facturacion: {
    can: ['dashboard:view', 'facturacion:view', 'facturacion:create', 'facturacion:send', 'facturacion:stamp', 'clientes:view', 'clientes:create', 'clientes:edit', 'reportes:view'],
    pages: ['dashboard', 'facturacion_electronica', 'nueva_factura', 'factura_directa', 'clientes', 'reportes', 'demas_informes'],
  },
  contabilidad: {
    can: ['dashboard:view', 'facturacion:view', 'facturacion:validate', 'notas_credito:view', 'devoluciones:view', 'reportes:view', 'facturacion:delete', 'devoluciones:delete'],
    pages: ['dashboard', 'facturacion_electronica', 'notas_credito_debito', 'devoluciones', 'demas_informes', 'reportes'],
  },
  postventa: {
    can: ['dashboard:view', 'devoluciones:view', 'devoluciones:create', 'devoluciones:manage', 'notas_credito:view', 'notas_credito:create'],
    pages: ['dashboard', 'devoluciones', 'notas_credito_debito', 'demas_informes'],
  },
  auditor: {
    can: ['dashboard:view', 'admin:view-activity-log', 'admin:review-critical-actions', 'reportes:view'],
    pages: ['dashboard', 'activity_log', 'reportes', 'demas_informes'],
  },
  admin: {
    can: ['*'],
    pages: [
      'dashboard', 'clientes', 'nuevo_cliente', 'editar_cliente',
      'productos', 'nuevo_producto', 'editar_producto', 'categorias', 'entrada_inventario', 'categoria_detalle',
      'cotizaciones', 'nueva_cotizacion', 'editar_cotizacion',
      'pedidos', 'nuevo_pedido',
      'remisiones', 'editar_remision',
      'facturacion_electronica', 'nueva_factura', 'factura_directa',
      'devoluciones', 'notas_credito_debito',
      'reportes',
      'demas_informes', 'factura_profesional', 'activity_log',
      'usuarios'
    ],
  },
};

export function hasPagePermission(role: Role, page: Page): boolean {
  if (page === 'perfil') return true;

  if (!role || typeof role !== 'string') {
    // console.warn('hasPagePermission: Invalid role', role);
    return false;
  }
  const roleConf = rolesConfig[role];
  if (!roleConf) {
    // console.warn('hasPagePermission: Role config not found for', role);
    return false;
  }
  if (roleConf.can.includes('*')) {
    return true;
  }
  return roleConf.pages.includes(page);
}
