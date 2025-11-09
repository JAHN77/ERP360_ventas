import React from 'react';
import { useAuth } from './hooks/useAuth';
import { useNavigation } from './hooks/useNavigation';
import { hasPagePermission } from './config/rolesConfig';

import Layout from './components/shared/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientesPage from './pages/ClientesPage';
import ProductosPage from './pages/ProductosPage';
import FacturasPage from './pages/FacturasPage';
import CotizacionesPage from './pages/CotizacionesPage';
import PedidosPage from './pages/PedidosPage';
import RemisionesPage from './pages/RemisionesPage';
import DevolucionesPage from './pages/DevolucionesPage';
import NotFoundPage from './pages/NotFoundPage';
import NuevaFacturaPage from './pages/NuevaFacturaPage';
import FormClientePage from './pages/FormClientePage';
import FormProductoPage from './pages/FormProductoPage';
import NuevaCotizacionPage from './pages/NuevaCotizacionPage';
import NuevoPedidoPage from './pages/NuevoPedidoPage';
import FormRemisionPage from './pages/FormRemisionPage';
import AccessDeniedPage from './pages/AccessDeniedPage';
import ActivityLogPage from './pages/ActivityLogPage';
import EntradaInventarioPage from './pages/EntradaInventarioPage';
import CategoriasPage from './pages/CategoriasPage';
import CategoriaDetallePage from './pages/CategoriaDetallePage';
import InformesPage from './pages/reports/InformesPage';
import DemasInformesPage from './pages/DemasInformesPage';

const App: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { page } = useNavigation();

  if (!isAuthenticated || !user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    if (!hasPagePermission(user.rol, page)) {
        return <AccessDeniedPage />;
    }

    switch (page) {
      case 'dashboard':
        return <DashboardPage />;
      case 'clientes':
        return <ClientesPage />;
      case 'nuevo_cliente':
      case 'editar_cliente':
        return <FormClientePage />;
      case 'productos':
        return <ProductosPage />;
      case 'nuevo_producto':
      case 'editar_producto':
        return <FormProductoPage />;
      case 'entrada_inventario':
        return <EntradaInventarioPage />;
      case 'facturacion_electronica':
        return <FacturasPage />;
      case 'cotizaciones':
        return <CotizacionesPage />;
      case 'nueva_cotizacion':
      case 'editar_cotizacion':
        return <NuevaCotizacionPage />;
      case 'pedidos':
        return <PedidosPage />;
      case 'nuevo_pedido':
        return <NuevoPedidoPage />;
      case 'remisiones':
        return <RemisionesPage />;
      case 'editar_remision':
        return <FormRemisionPage />;
      case 'devoluciones':
        return <DevolucionesPage />;
      case 'nueva_factura':
        return <NuevaFacturaPage />;
      case 'activity_log':
        return <ActivityLogPage />;
      case 'reportes':
        return <InformesPage />;
      case 'categorias':
        return <CategoriasPage />;
      case 'categoria_detalle':
        return <CategoriaDetallePage />;
      case 'demas_informes':
        return <DemasInformesPage />;
      case 'notas_credito_debito': // Kept for role permissions, but now handled by DemasInformesPage
      case 'factura_profesional': // Keep in list for admin role permissions, but route to NotFound
        return <NotFoundPage />; // Placeholder for new pages
      default:
        return <NotFoundPage />;
    }
  };

  return <Layout>{renderPage()}</Layout>;
};

export default App;
