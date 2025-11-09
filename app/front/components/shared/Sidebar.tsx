import React from 'react';
import { useNavigation } from '../../hooks/useNavigation';
import type { Page } from '../../contexts/NavigationContext';
import ProtectedComponent from '../auth/ProtectedComponent';

interface NavLinkProps {
  pageName: Page;
  icon: string;
  label: string;
  onNavigate: (pageName: Page) => void;
}

const NavLink: React.FC<NavLinkProps> = ({ pageName, icon, label, onNavigate }) => {
  const { page } = useNavigation();
  const isActive = page === pageName;

  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onNavigate(pageName);
      }}
      className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 group ${
        isActive
          ? 'bg-blue-600 text-white shadow-lg'
          : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white'
      }`}
    >
      <i className={`fas ${icon} fa-fw w-6 text-center mr-3 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white'}`}></i>
      <span className="truncate">{label}</span>
    </a>
  );
};

interface SidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, setIsSidebarOpen }) => {
    const { setPage } = useNavigation();

    const handleNavigate = (pageName: Page) => {
        setPage(pageName);
        setIsSidebarOpen(false);
    };

  return (
    <>
      {/* Overlay for mobile - Muestra contenido difuminado en lugar de fondo negro */}
      <div
        className={`fixed inset-0 bg-white/30 dark:bg-black/30 backdrop-blur-md z-20 transition-all duration-300 md:hidden ${
          isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      ></div>
      
      <div className={`fixed inset-y-0 left-0 flex flex-col w-64 bg-white dark:bg-slate-800 shadow-xl z-30 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex-shrink-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className="flex items-center justify-center h-20 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <i className="fas fa-cubes fa-2x text-blue-500"></i>
          <h1 className="text-2xl font-bold ml-3 text-slate-800 dark:text-white">ERP360</h1>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
            <NavLink pageName="dashboard" icon="fa-gauge-high" label="Dashboard" onNavigate={handleNavigate} />

            <p className="px-4 pt-4 pb-2 text-xs text-slate-400 dark:text-slate-500 uppercase font-semibold">Catálogo Básico</p>
            <NavLink pageName="clientes" icon="fa-users" label="Clientes" onNavigate={handleNavigate} />
            <NavLink pageName="productos" icon="fa-box-open" label="Productos" onNavigate={handleNavigate} />
            <NavLink pageName="categorias" icon="fa-tags" label="Categorias" onNavigate={handleNavigate} />

            <p className="px-4 pt-4 pb-2 text-xs text-slate-400 dark:text-slate-500 uppercase font-semibold">Inventario</p>
            <NavLink pageName="entrada_inventario" icon="fa-boxes-stacked" label="Entrada de Inventario" onNavigate={handleNavigate} />

            <p className="px-4 pt-4 pb-2 text-xs text-slate-400 dark:text-slate-500 uppercase font-semibold">Gestión Comercial</p>
            <NavLink pageName="cotizaciones" icon="fa-file-alt" label="Cotizaciones" onNavigate={handleNavigate} />
            <NavLink pageName="pedidos" icon="fa-shopping-cart" label="Pedidos" onNavigate={handleNavigate} />
            <NavLink pageName="remisiones" icon="fa-truck" label="Remisiones" onNavigate={handleNavigate} />
            <NavLink pageName="facturacion_electronica" icon="fa-file-invoice-dollar" label="Facturación Electrónica" onNavigate={handleNavigate} />
            <NavLink pageName="devoluciones" icon="fa-undo" label="Devoluciones" onNavigate={handleNavigate} />
            
            <p className="px-4 pt-4 pb-2 text-xs text-slate-400 dark:text-slate-500 uppercase font-semibold">Informes y Documentos</p>
            <NavLink pageName="reportes" icon="fa-chart-bar" label="Informes" onNavigate={handleNavigate} />
            <NavLink pageName="demas_informes" icon="fa-folder-open" label="Documentos" onNavigate={handleNavigate} />
            
            <ProtectedComponent permission="admin:view-activity-log">
                <p className="px-4 pt-4 pb-2 text-xs text-slate-400 dark:text-slate-500 uppercase font-semibold">Administración</p>
                <NavLink pageName="activity_log" icon="fa-history" label="Bitácora de Actividad" onNavigate={handleNavigate} />
            </ProtectedComponent>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
