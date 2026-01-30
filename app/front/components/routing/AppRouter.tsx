import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { hasPagePermission } from '../../config/rolesConfig';
import { routeMap, pageToRoute } from '../../config/routes';
import Spinner from '../Spinner';
import AccessDeniedPage from '../../pages/AccessDeniedPage';
import NotFoundPage from '../../pages/NotFoundPage';
import BodegaSelectorModal from '../shared/BodegaSelectorModal';
import Layout from '../shared/Layout';

// Lazy loading de páginas para mejor rendimiento
const DashboardPage = lazy(() => import('../../pages/DashboardPage'));
const ClientesPage = lazy(() => import('../../pages/ClientesPage'));
const ProductosPage = lazy(() => import('../../pages/ProductosPage'));
const FacturasPage = lazy(() => import('../../pages/FacturasPage'));
const CotizacionesPage = lazy(() => import('../../pages/CotizacionesPage'));
const PedidosPage = lazy(() => import('../../pages/PedidosPage'));
const RemisionesPage = lazy(() => import('../../pages/RemisionesPage'));
const DevolucionesPage = lazy(() => import('../../pages/DevolucionesPage'));
const NuevaFacturaPage = lazy(() => import('../../pages/NuevaFacturaPage'));
const FacturaDirectaPage = lazy(() => import('../../pages/FacturaDirectaPage'));
const FormClientePage = lazy(() => import('../../pages/FormClientePage'));
const FormProductoPage = lazy(() => import('../../pages/FormProductoPage'));
const FormServicePage = lazy(() => import('../../pages/FormServicePage'));
const NuevaCotizacionPage = lazy(() => import('../../pages/NuevaCotizacionPage'));
const NuevoPedidoPage = lazy(() => import('../../pages/NuevoPedidoPage'));
const OrdenesCompraPage = lazy(() => import('../../pages/OrdenesCompraPage'));
const FormRemisionPage = lazy(() => import('../../pages/FormRemisionPage'));
const ActivityLogPage = lazy(() => import('../../pages/ActivityLogPage'));
const EntradaInventarioPage = lazy(() => import('../../pages/EntradaInventarioPage'));
const CategoriasPage = lazy(() => import('../../pages/CategoriasPage'));
const CategoriaDetallePage = lazy(() => import('../../pages/CategoriaDetallePage'));
const InformesPage = lazy(() => import('../../pages/reports/InformesPage'));
const DemasInformesPage = lazy(() => import('../../pages/DemasInformesPage'));
const InventoryConceptsPage = lazy(() => import('../../pages/InventoryConceptsPage'));
const ConteoFisicoPage = lazy(() => import('../../pages/ConteoFisicoPage'));
const HistorialConteosFisicosPage = lazy(() => import('../../pages/HistorialConteosFisicosPage'));
const NuevoConteoFisicoPage = lazy(() => import('../../pages/NuevoConteoFisicoPage'));
const DetalleConteoFisicoPage = lazy(() => import('../../pages/DetalleConteoFisicoPage'));
const UsersPage = lazy(() => import('../../pages/UsersPage'));
const ProfilePage = lazy(() => import('../../pages/ProfilePage'));
const AnalyticsPage = lazy(() => import('../../pages/AnalyticsPage'));

/**
 * Componente de ruta protegida que verifica permisos
 */
const ProtectedRoute: React.FC<{
  page: string;
  children: React.ReactNode;
}> = ({ page, children }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  try {
    if (!hasPagePermission(user.rol, page as any)) {
      return <AccessDeniedPage />;
    }
  } catch (error) {
    console.error('Error in ProtectedRoute permission check:', error);
    return <AccessDeniedPage />;
  }

  return <>{children}</>;
};

/**
 * Router principal de la aplicación con soporte Multi-tenant
 */
const AppRouter: React.FC = () => {
  const { isAuthenticated, user, selectedSede, isLoadingBodegas, selectedCompany, switchCompany } = useAuth();
  const [showBodegaModal, setShowBodegaModal] = React.useState(false);
  const [isSwitching, setIsSwitching] = React.useState(false);
  const { companySlug } = useParams<{ companySlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Sincronizar contexto de empresa con el slug de la URL
  React.useEffect(() => {
    if (isAuthenticated && user && companySlug && selectedCompany) {
      if (companySlug !== selectedCompany.db_name) {
        const targetCompany = user.empresas.find(e => e.db_name === companySlug);
        if (targetCompany) {
          console.log(`[TenantGuard] URL slug (${companySlug}) mismatch with context (${selectedCompany.db_name}). Switching...`);
          setIsSwitching(true);
          // switchCompany is async
          (async () => {
            try {
              await switchCompany(targetCompany.id);
            } finally {
              setIsSwitching(false);
            }
          })();
        } else {
          console.warn(`[TenantGuard] Company slug "${companySlug}" not found for user. Redirecting to current company.`);
          navigate(`/${selectedCompany.db_name}${location.pathname.substring(companySlug.length + 1)}`, { replace: true });
        }
      }
    }
  }, [companySlug, selectedCompany, isAuthenticated, user, switchCompany, navigate, location.pathname]);

  // Mostrar modal de selección de bodega si es necesario
  React.useEffect(() => {
    if (
      isAuthenticated &&
      user &&
      !isLoadingBodegas &&
      selectedCompany &&
      !selectedSede &&
      selectedCompany.sedes &&
      selectedCompany.sedes.length > 0 &&
      !isSwitching
    ) {
      setShowBodegaModal(true);
    } else {
      setShowBodegaModal(false);
    }
  }, [isAuthenticated, user, isLoadingBodegas, selectedCompany, selectedSede, isSwitching]);

  // Si no está autenticado, redirigir al login
  if (!isAuthenticated || !user) {
    return null;
  }

  // Estado de carga durante el cambio de empresa o carga de bodegas
  if (isSwitching || (isLoadingBodegas && !selectedSede)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <Spinner size="lg" />
        <p className="mt-4 text-slate-600 dark:text-slate-400 font-medium animate-pulse">
          {isSwitching ? 'Cambiando de empresa...' : 'Cargando configuración...'}
        </p>
      </div>
    );
  }

  // No mostrar el contenido principal hasta que se seleccione una bodega
  if (!selectedSede && selectedCompany?.sedes && selectedCompany.sedes.length > 0) {
    return (
      <>
        <BodegaSelectorModal
          isOpen={showBodegaModal}
          onClose={() => setShowBodegaModal(false)}
        />
      </>
    );
  }

  return (
    <Layout>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner size="lg" />
        </div>
      }>
        <Routes>
          {/* Redirección inicial a la empresa seleccionada */}
          <Route
            path="/"
            element={
              selectedCompany ? (
                <Navigate to={`/${selectedCompany.db_name || 'default'}`} replace />
              ) : (
                <div className="flex items-center justify-center min-h-[400px]">
                  <Spinner size="lg" />
                </div>
              )
            }
          />

          {/* Dashboard */}
          <Route
            path={routeMap.dashboard}
            element={
              <ProtectedRoute page="dashboard">
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Clientes */}
          <Route
            path={routeMap.clientes}
            element={
              <ProtectedRoute page="clientes">
                <ClientesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.nuevo_cliente}
            element={
              <ProtectedRoute page="nuevo_cliente">
                <FormClientePage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.editar_cliente}
            element={
              <ProtectedRoute page="editar_cliente">
                <FormClientePage />
              </ProtectedRoute>
            }
          />

          {/* Productos */}
          <Route
            path={routeMap.productos}
            element={
              <ProtectedRoute page="productos">
                <ProductosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.nuevo_producto}
            element={
              <ProtectedRoute page="nuevo_producto">
                <FormProductoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.nuevo_servicio}
            element={
              <ProtectedRoute page="nuevo_producto">
                {/* Reusing permission for products as likely they share same permission or we'd need to add 'nuevo_servicio' to permissions */}
                <FormServicePage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.editar_producto}
            element={
              <ProtectedRoute page="editar_producto">
                <FormProductoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.entrada_inventario}
            element={
              <ProtectedRoute page="entrada_inventario">
                <EntradaInventarioPage />
              </ProtectedRoute>
            }
          />

          {/* Categorías */}
          <Route
            path={routeMap.categorias}
            element={
              <ProtectedRoute page="categorias">
                <CategoriasPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.categoria_detalle}
            element={
              <ProtectedRoute page="categoria_detalle">
                <CategoriaDetallePage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.inventory_concepts}
            element={
              <ProtectedRoute page="entrada_inventario">
                {/* Reusing existing permission for now */}
                <InventoryConceptsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.conteo_fisico}
            element={
              <ProtectedRoute page="entrada_inventario">
                {/* Reusing existing permission for now */}
                <HistorialConteosFisicosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventarios/conteo-fisico/nuevo"
            element={
              <ProtectedRoute page="entrada_inventario">
                <NuevoConteoFisicoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventarios/conteo-fisico/:id"
            element={
              <ProtectedRoute page="entrada_inventario">
                <DetalleConteoFisicoPage />
              </ProtectedRoute>
            }
          />

          {/* Cotizaciones */}
          <Route
            path={routeMap.cotizaciones}
            element={
              <ProtectedRoute page="cotizaciones">
                <CotizacionesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.nueva_cotizacion}
            element={
              <ProtectedRoute page="nueva_cotizacion">
                <NuevaCotizacionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.editar_cotizacion}
            element={
              <ProtectedRoute page="editar_cotizacion">
                <NuevaCotizacionPage />
              </ProtectedRoute>
            }
          />

          {/* Ordenes de Compra */}
          <Route
            path={routeMap.ordenes_compra}
            element={
              <ProtectedRoute page="ordenes_compra">
                <OrdenesCompraPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.nueva_orden_compra}
            element={
              <ProtectedRoute page="nueva_orden_compra">
                <OrdenesCompraPage />
              </ProtectedRoute>
            }
          />

          {/* Pedidos */}
          <Route
            path={routeMap.pedidos}
            element={
              <ProtectedRoute page="pedidos">
                <PedidosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.nuevo_pedido}
            element={
              <ProtectedRoute page="nuevo_pedido">
                <NuevoPedidoPage />
              </ProtectedRoute>
            }
          />

          {/* Remisiones */}
          <Route
            path={routeMap.remisiones}
            element={
              <ProtectedRoute page="remisiones">
                <RemisionesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.editar_remision}
            element={
              <ProtectedRoute page="editar_remision">
                <FormRemisionPage />
              </ProtectedRoute>
            }
          />

          {/* Facturación */}
          <Route
            path={routeMap.facturacion_electronica}
            element={
              <ProtectedRoute page="facturacion_electronica">
                <FacturasPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.nueva_factura}
            element={
              <ProtectedRoute page="nueva_factura">
                <NuevaFacturaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.factura_directa}
            element={
              <ProtectedRoute page="factura_directa">
                <FacturaDirectaPage />
              </ProtectedRoute>
            }
          />

          {/* Devoluciones */}
          <Route
            path={routeMap.devoluciones}
            element={
              <ProtectedRoute page="devoluciones">
                <DevolucionesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.notas_credito_debito}
            element={
              <ProtectedRoute page="notas_credito_debito">
                <DevolucionesPage />
              </ProtectedRoute>
            }
          />

          {/* Informes */}
          <Route
            path={routeMap.reportes}
            element={
              <ProtectedRoute page="reportes">
                <InformesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.demas_informes}
            element={
              <ProtectedRoute page="demas_informes">
                <DemasInformesPage />
              </ProtectedRoute>
            }
          />

          {/* Administración */}
          <Route
            path={routeMap.activity_log}
            element={
              <ProtectedRoute page="activity_log">
                <ActivityLogPage />
              </ProtectedRoute>
            }
          />

          {/* Analytics */}
          <Route
            path={routeMap.analytics}
            element={
              <ProtectedRoute page="analytics">
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />

          {/* Perfil */}
          <Route
            path={routeMap.perfil}
            element={
              <ProtectedRoute page="perfil">
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path={routeMap.perfil}
            element={
              <ProtectedRoute page="perfil">
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/configuracion/usuarios"
            element={
              <ProtectedRoute page="usuarios">
                <UsersPage />
              </ProtectedRoute>
            }
          />

          {/* Ruta por defecto - redirigir al dashboard */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </Layout>
  );
};

export default AppRouter;

