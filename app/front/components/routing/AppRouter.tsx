import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { hasPagePermission } from '../../config/rolesConfig';
import { routeMap } from '../../config/routes';
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
const FormClientePage = lazy(() => import('../../pages/FormClientePage'));
const FormProductoPage = lazy(() => import('../../pages/FormProductoPage'));
const NuevaCotizacionPage = lazy(() => import('../../pages/NuevaCotizacionPage'));
const NuevoPedidoPage = lazy(() => import('../../pages/NuevoPedidoPage'));
const FormRemisionPage = lazy(() => import('../../pages/FormRemisionPage'));
const ActivityLogPage = lazy(() => import('../../pages/ActivityLogPage'));
const EntradaInventarioPage = lazy(() => import('../../pages/EntradaInventarioPage'));
const CategoriasPage = lazy(() => import('../../pages/CategoriasPage'));
const CategoriaDetallePage = lazy(() => import('../../pages/CategoriaDetallePage'));
const InformesPage = lazy(() => import('../../pages/reports/InformesPage'));
const DemasInformesPage = lazy(() => import('../../pages/DemasInformesPage'));

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
  
  if (!hasPagePermission(user.rol, page as any)) {
    return <AccessDeniedPage />;
  }
  
  return <>{children}</>;
};

/**
 * Router principal de la aplicación
 * Compatible con Single-SPA y funcionamiento standalone
 */
const AppRouter: React.FC = () => {
  const { isAuthenticated, user, selectedSede, isLoadingBodegas, selectedCompany } = useAuth();
  const [showBodegaModal, setShowBodegaModal] = React.useState(false);

  // Mostrar modal de selección de bodega si es necesario
  React.useEffect(() => {
    if (
      isAuthenticated &&
      user &&
      !isLoadingBodegas &&
      selectedCompany &&
      !selectedSede &&
      selectedCompany.sedes &&
      selectedCompany.sedes.length > 0
    ) {
      setShowBodegaModal(true);
    } else {
      setShowBodegaModal(false);
    }
  }, [isAuthenticated, user, isLoadingBodegas, selectedCompany, selectedSede]);

  // Si no está autenticado, redirigir al login (esto se maneja en App.tsx)
  if (!isAuthenticated || !user) {
    return null; // El login se maneja en App.tsx
  }

  // No mostrar el contenido principal hasta que se seleccione una bodega
  if (!selectedSede && !isLoadingBodegas && selectedCompany?.sedes && selectedCompany.sedes.length > 0) {
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

          {/* Devoluciones */}
          <Route 
            path={routeMap.devoluciones} 
            element={
              <ProtectedRoute page="devoluciones">
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

          {/* Ruta por defecto - redirigir al dashboard */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </Layout>
  );
};

export default AppRouter;

