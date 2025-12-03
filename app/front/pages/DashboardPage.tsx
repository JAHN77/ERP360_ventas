import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';
import { useNavigation } from '../hooks/useNavigation';
import StatCard from '../components/dashboard/StatCard';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Pedido, Cotizacion, Producto, ActivityLog } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import SimpleChart from '../components/charts/SimpleChart';
import Modal from '../components/ui/Modal';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { timeSince } from '../utils/dateUtils';
import { useNotifications } from '../hooks/useNotifications';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
};

const LOW_STOCK_THRESHOLD = 10;
const MIN_WIDGETS = 3;
const MAX_WIDGETS = 6;

const WIDGET_CONFIG = {
  tasks: 'Tareas Pendientes',
  inventoryAlerts: 'Alertas de Inventario',
  actions: 'Acciones Rápidas',
  salesTrend: 'Tendencia de Ventas',
  topProducts: 'Top 5 Productos Vendidos (Mes)',
  recentActivity: 'Actividad Reciente',
  salesBySeller: 'Ventas por Vendedor (Mes)',
};

type WidgetKey = keyof typeof WIDGET_CONFIG;

const DEFAULT_WIDGETS: Record<WidgetKey, boolean> = {
  tasks: true,
  inventoryAlerts: true,
  salesTrend: true,
  topProducts: true,
  actions: true,
  recentActivity: true,
  salesBySeller: true,
};

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { setPage } = useNavigation();
  const {
    clientes,
    pedidos,
    cotizaciones,
    facturas,
    notasCredito,
    getSalesDataByPeriod,
    productos,
    getSalesByVendedor,
    getTopProductos,
    activityLog,
  } = useData();
  const { addNotification } = useNotifications();

  const [isCustomizeModalOpen, setCustomizeModalOpen] = useState(false);
  const [widgets, setWidgets] = useState<Record<WidgetKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem('dashboardWidgets');
      return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });

  useEffect(() => {
    localStorage.setItem('dashboardWidgets', JSON.stringify(widgets));
  }, [widgets]);

  const activeWidgetCount = useMemo(() => Object.values(widgets).filter(Boolean).length, [widgets]);

  const handleWidgetToggle = (key: WidgetKey, checked: boolean) => {
    if (!checked && activeWidgetCount <= MIN_WIDGETS) {
      addNotification({
        message: `Debe mantener al menos ${MIN_WIDGETS} widgets activos.`,
        type: 'warning',
      });
      return;
    }
    if (checked && activeWidgetCount >= MAX_WIDGETS) {
      addNotification({
        message: `Puede seleccionar un máximo de ${MAX_WIDGETS} widgets para mantener la claridad.`,
        type: 'warning',
      });
      return;
    }
    setWidgets(prev => ({ ...prev, [key]: checked }));
  };

  const firstDayOfMonth = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1), []);

  // WIDGET DATA HOOKS
  const stats = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Calcular clientes nuevos (últimos 30 días)
    // Buscar en múltiples campos de fecha: createdAt, fechaIngreso, FECING
    const clientesNuevos = clientes.filter(c => {
      const fechaCreacion = c.createdAt || (c as any).fechaIngreso || (c as any).FECING;
      if (!fechaCreacion) return false;
      try {
        const fecha = new Date(fechaCreacion);
        fecha.setHours(0, 0, 0, 0);
        return fecha >= thirtyDaysAgo;
      } catch {
        return false;
      }
    }).length;

    console.log('👥 Clientes nuevos calculados:', {
      totalClientes: clientes.length,
      clientesNuevos,
      clientesConFecha: clientes.filter(c => c.createdAt || (c as any).fechaIngreso || (c as any).FECING).length
    });

    // Calcular ventas del mes (facturas válidas menos devoluciones)
    const ventasDelMes = facturas
      .filter(f => {
        if (!f.fechaFactura) return false;
        const fechaFactura = new Date(f.fechaFactura);
        fechaFactura.setHours(0, 0, 0, 0);
        return fechaFactura >= firstDayOfMonth &&
          f.estado !== 'ANULADA' &&
          f.estado !== 'BORRADOR';
      })
      .reduce((total, factura) => {
        const devolucionesTotal = notasCredito
          .filter(nc => String(nc.facturaId) === String(factura.id))
          .reduce((sum, nc) => sum + (nc.total || 0), 0);
        return total + ((factura.total || 0) - devolucionesTotal);
      }, 0);

    // Calcular devoluciones del mes
    const devolucionesDelMes = notasCredito.filter(nc => {
      if (!nc.fechaEmision) return false;
      const fechaEmision = new Date(nc.fechaEmision);
      fechaEmision.setHours(0, 0, 0, 0);
      return fechaEmision >= firstDayOfMonth;
    }).length;

    return {
      ventasDelMes,
      pedidosPendientes: pedidos.filter(p => p.estado === 'CONFIRMADO' || p.estado === 'BORRADOR').length,
      clientesNuevos,
      productosBajoStock: productos.filter(p => (p.controlaExistencia ?? 0) < LOW_STOCK_THRESHOLD).length,
      productosVendidosMes: (() => {
        // Contar productos únicos vendidos en el mes (productos que aparecen en facturas)
        const productosVendidos = new Set<number>();
        facturas
          .filter(f => {
            if (!f.fechaFactura) return false;
            const fechaFactura = new Date(f.fechaFactura);
            fechaFactura.setHours(0, 0, 0, 0);
            return fechaFactura >= firstDayOfMonth &&
              f.estado !== 'ANULADA' &&
              f.estado !== 'BORRADOR' &&
              f.items &&
              Array.isArray(f.items) &&
              f.items.length > 0;
          })
          .forEach(f => {
            f.items.forEach(item => {
              if (item.productoId != null) {
                productosVendidos.add(Number(item.productoId));
              }
            });
          });
        return productosVendidos.size;
      })(),
      devolucionesDelMes,
    };
  }, [facturas, notasCredito, pedidos, productos, firstDayOfMonth, clientes]);

  const salesChartData = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(end.getDate() - 14);
    start.setHours(0, 0, 0, 0);

    const data = getSalesDataByPeriod(start, end);

    // Formatear datos para la gráfica con mejor formato de fecha
    return data.map(d => {
      const fecha = new Date(d.date + 'T00:00:00');
      return {
        name: `${fecha.getUTCDate()}`,
        Ventas: Math.round(d.sales || 0)
      };
    });
  }, [getSalesDataByPeriod]);

  const topProductos = useMemo(() => {
    // Usar la función del contexto que ya tiene la lógica correcta
    const productosTop = getTopProductos(5);
    console.log('📊 Top Productos calculados:', {
      cantidad: productosTop.length,
      productos: productosTop.map(p => ({ nombre: p.producto?.nombre, cantidad: p.cantidad })),
      facturasDelMes: facturas.filter(f => {
        const fechaFactura = new Date(f.fechaFactura);
        fechaFactura.setHours(0, 0, 0, 0);
        return fechaFactura >= firstDayOfMonth && f.estado !== 'ANULADA' && f.estado !== 'BORRADOR';
      }).length
    });
    return productosTop;
  }, [getTopProductos, facturas, productos, firstDayOfMonth]);

  const salesBySellerData = useMemo(() => getSalesByVendedor(), [getSalesByVendedor]);

  // WIDGET COMPONENTS
  const TasksWidget = () => {
    const [activeTab, setActiveTab] = useState<'cotizaciones' | 'pedidos'>('cotizaciones');
    const pendingCotizaciones = useMemo(() =>
      cotizaciones.filter(c => c.estado === 'ENVIADA').sort((a, b) => (b.total || 0) - (a.total || 0)),
      [cotizaciones]
    );
    const pendingPedidos = useMemo(() =>
      pedidos.filter(p => p.estado === 'CONFIRMADO' || p.estado === 'BORRADOR').sort((a, b) => (b.total || 0) - (a.total || 0)),
      [pedidos]
    );

    return (
      <Card className="h-full flex flex-col col-span-1 md:col-span-2 lg:col-span-4 row-span-2">
        <CardHeader>
          <nav className="-mb-px flex space-x-4" aria-label="Tabs">
            <button onClick={() => setActiveTab('cotizaciones')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm ${activeTab === 'cotizaciones' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              Cotizaciones por Aprobar <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === 'cotizaciones' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-700'}`}>{pendingCotizaciones.length}</span>
            </button>
            <button onClick={() => setActiveTab('pedidos')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm ${activeTab === 'pedidos' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              Pedidos por Aprobar <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === 'pedidos' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-700'}`}>{pendingPedidos.length}</span>
            </button>
          </nav>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 dark:divide-slate-700/50 overflow-y-auto flex-grow">
          {activeTab === 'cotizaciones' && (pendingCotizaciones.length > 0 ? pendingCotizaciones.map(c => <div key={c.id} onClick={() => setPage('cotizaciones', { focusId: c.id })} className="py-3 px-2 -mx-2 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-lg cursor-pointer transition-colors"><div className="flex justify-between items-center"><div><p className="font-bold text-blue-500">{c.numeroCotizacion}</p><p className="text-xs text-slate-500">{clientes.find(cli => cli.id === c.clienteId)?.nombreCompleto}</p></div><p className="font-semibold text-right">{formatCurrency(c.total)}</p></div></div>) : <div className="flex h-full items-center justify-center text-center text-slate-500"><p>No hay cotizaciones pendientes.</p></div>)}
          {activeTab === 'pedidos' && (pendingPedidos.length > 0 ? pendingPedidos.map(p => <div key={p.id} onClick={() => setPage('pedidos')} className="py-3 px-2 -mx-2 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-lg cursor-pointer transition-colors"><div className="flex justify-between items-center"><div><p className="font-bold">{p.numeroPedido}</p><p className="text-xs text-slate-500">{clientes.find(cli => cli.id === p.clienteId)?.nombreCompleto}</p></div><div className="text-right"><p className="font-semibold">{formatCurrency(p.total)}</p><StatusBadge status={p.estado} /></div></div></div>) : <div className="flex h-full items-center justify-center text-center text-slate-500"><p>No hay pedidos pendientes.</p></div>)}
        </CardContent>
      </Card>
    );
  };

  const InventoryAlertsWidget = () => {
    const lowStockProducts = useMemo(() => productos.filter(p => (p.controlaExistencia ?? 0) < LOW_STOCK_THRESHOLD).sort((a, b) => (a.controlaExistencia ?? 0) - (b.controlaExistencia ?? 0)), [productos]);
    return (
      <Card className="h-full row-span-1 col-span-1">
        <CardHeader><CardTitle>Alertas de Inventario</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {lowStockProducts.slice(0, 5).map(item => <li key={item.id} onClick={() => setPage('editar_producto', { id: item.id })} className="flex justify-between items-center text-sm gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 -mx-2 px-2 py-1 rounded-lg cursor-pointer"><span className="truncate font-semibold">{item.nombre}</span><span className="flex-shrink-0 font-bold bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">{item.controlaExistencia ?? 0}</span></li>)}
            {lowStockProducts.length === 0 && <p className="text-sm text-slate-500 text-center py-4">¡Todo en orden!</p>}
          </ul>
        </CardContent>
      </Card>
    );
  };

  const ActionsWidget = () => (
    <Card className="h-full row-span-1 col-span-1">
      <CardHeader><CardTitle>Acciones Rápidas</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <button onClick={() => setPage('nueva_cotizacion')} className="w-full text-left px-4 py-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><i className="fas fa-file-alt mr-3 text-blue-500"></i>Nueva Cotización</button>
        <button onClick={() => setPage('nuevo_pedido')} className="w-full text-left px-4 py-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><i className="fas fa-shopping-cart mr-3 text-green-500"></i>Nuevo Pedido</button>
        <button onClick={() => setPage('devoluciones')} className="w-full text-left px-4 py-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><i className="fas fa-undo mr-3 text-orange-500"></i>Registrar Devolución</button>
      </CardContent>
    </Card>
  );

  const SalesTrendWidget = () => (
    <Card className="col-span-1 md:col-span-2 row-span-2"><CardHeader><CardTitle>Tendencia de Ventas (Últimos 15 días)</CardTitle></CardHeader><CardContent><SimpleChart data={salesChartData} type="line" height="h-72" dataKey="Ventas" labelKey="name" /></CardContent></Card>
  );

  const TopProductsWidget = () => {
    console.log('📊 TopProductsWidget - topProductos:', topProductos);

    return (
      <Card className="col-span-1 md:col-span-2">
        <CardHeader><CardTitle>Top 5 Productos Vendidos (Mes)</CardTitle></CardHeader>
        <CardContent>
          {topProductos.length > 0 ? (
            <ol className="space-y-3">
              {topProductos.map((item, index) => (
                <li key={item.producto.id} className="flex justify-between items-center text-sm gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-bold text-slate-400 w-5">{index + 1}.</span>
                    <span className="truncate font-semibold">{item.producto.nombre}</span>
                  </div>
                  <span className="flex-shrink-0 font-bold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-blue-500">
                    {item.cantidad}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No hay productos vendidos este mes</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const RecentActivityWidget = () => {
    const recentActivity = useMemo(() => {
      const sorted = [...activityLog].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return sorted.slice(0, 5);
    }, [activityLog]);

    console.log('📋 Activity Log:', activityLog.length, 'items');
    console.log('📋 Recent Activity:', recentActivity);

    return (
      <Card className="col-span-1 md:col-span-2">
        <CardHeader><CardTitle>Actividad Reciente</CardTitle></CardHeader>
        <CardContent>
          {recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((log: ActivityLog) => (
                <div key={log.id} className="text-sm">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">{log.action}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {log.entity?.name || 'N/A'} - {timeSince(log.timestamp)} por {log.user?.nombre || 'Usuario'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No hay actividad reciente</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const SalesBySellerWidget = () => (
    <Card className="col-span-1 md:col-span-2 row-span-2">
      <CardHeader><CardTitle>Ventas por Vendedor (Mes)</CardTitle></CardHeader>
      <CardContent>
        {salesBySellerData.length > 0 ? (
          <SimpleChart
            data={salesBySellerData.map(d => ({ ...d, Ventas: Math.round(d.totalSales || 0) }))}
            type="bar"
            dataKey="Ventas"
            labelKey="name"
            height="h-72"
          />
        ) : (
          <div className="flex items-center justify-center h-72 text-slate-500">
            <p>No hay ventas registradas este mes</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">¡Hola, {user?.primerNombre}!</h1>
          <p className="text-slate-500 dark:text-slate-400">Este es tu centro de mando.</p>
        </div>
        <button onClick={() => setCustomizeModalOpen(true)} className="flex-shrink-0 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"><i className="fas fa-cog mr-2"></i>Personalizar</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard title="Ventas del Mes" value={formatCurrency(stats.ventasDelMes)} icon="fa-chart-line" colorName="blue" />
        <StatCard title="Pedidos Pendientes" value={stats.pedidosPendientes.toString()} icon="fa-shopping-cart" colorName="orange" />
        <StatCard title="Clientes Nuevos (30d)" value={stats.clientesNuevos.toString()} icon="fa-user-plus" colorName="green" />
        <StatCard title="Productos Vendidos (Mes)" value={stats.productosVendidosMes.toString()} icon="fa-box-open" colorName="violet" />
        <StatCard title="Devoluciones (Mes)" value={stats.devolucionesDelMes.toString()} icon="fa-undo" colorName="orange" />
      </div>

      {/* Main Masonry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 grid-flow-row-dense">
        {widgets.tasks && <TasksWidget />}
        {widgets.inventoryAlerts && <InventoryAlertsWidget />}
        {widgets.actions && <ActionsWidget />}
        {widgets.salesTrend && <SalesTrendWidget />}
        {widgets.topProducts && <TopProductsWidget />}
        {widgets.recentActivity && <RecentActivityWidget />}
        {widgets.salesBySeller && <SalesBySellerWidget />}
      </div>

      <Modal
        isOpen={isCustomizeModalOpen}
        onClose={() => setCustomizeModalOpen(false)}
        title="Personalizar Dashboard"
        size="md"
      >
        <div className="space-y-4 max-w-2xl mx-auto">
          <p className="text-sm text-slate-500 dark:text-slate-400">Selecciona los widgets que quieres ver en tu dashboard.</p>
          <div className="p-2 text-center bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/50 rounded-lg text-xs text-blue-700 dark:text-blue-300">
            Mantenga entre {MIN_WIDGETS} y {MAX_WIDGETS} widgets para una mejor experiencia visual.
          </div>
          {Object.entries(WIDGET_CONFIG).map(([key, label]) => (
            <div
              key={key}
              className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-100 dark:bg-slate-800/70 rounded-xl border border-slate-200/70 dark:border-slate-700/70 shadow-sm"
            >
              <div className="flex flex-col gap-1 min-w-[180px]">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {widgets[key as WidgetKey] ? 'Visible en dashboard' : 'Oculto temporalmente'}
                </span>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <span className={`text-xs font-semibold uppercase tracking-wide ${widgets[key as WidgetKey] ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`}>
                  {widgets[key as WidgetKey] ? 'Activo' : 'Inactivo'}
                </span>
                <ToggleSwitch
                  id={`toggle-${key}`}
                  checked={widgets[key as WidgetKey]}
                  onChange={(checked) => handleWidgetToggle(key as WidgetKey, checked)}
                  labelLeft="Off"
                  labelRight="On"
                  size="compact"
                  width="equal"
                  className="w-40"
                />
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default DashboardPage;