import React, { useState, useEffect } from 'react';
import { useNavigation } from '../../hooks/useNavigation';
import { useAuth } from '../../hooks/useAuth';
import { Page } from '../../contexts/NavigationContext';

interface SidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
}

// --- Sub Components ---

const NavItem = ({ icon, label, active, onClick, indent }: { icon?: string, label: string, active: boolean, onClick: () => void, indent?: boolean }) => (
    <button
        onClick={onClick}
        className={`
            flex items-center w-full px-3 py-2.5 rounded-lg transition-all duration-200 group/item relative
            ${active
                ? 'bg-blue-600/10 text-blue-400 font-medium'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}
            ${indent ? 'pl-11' : ''}
        `}
        title={label}
    >
        {active && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full"></div>
        )}

        {icon && (
            <div className={`w-6 h-6 flex items-center justify-center shrink-0 text-lg transition-colors ${active ? 'text-blue-400' : 'text-slate-400 group-hover/item:text-slate-300'}`}>
                <i className={`${icon}`}></i>
            </div>
        )}

        <span className={`
            ml-3 whitespace-nowrap text-sm
            opacity-0 group-hover:opacity-100 transition-opacity duration-200 
            md:opacity-0 md:group-hover:opacity-100
            ${!icon && indent ? 'text-[0.9rem]' : ''} 
        `}>
            {label}
        </span>
    </button>
);

interface NavGroupProps {
    icon: string;
    label: string;
    isOpen: boolean;
    isActive: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

const NavGroup = ({ icon, label, isOpen, isActive, onToggle, children }: NavGroupProps) => {
    return (
        <div className="mb-1">
            <button
                onClick={onToggle}
                className={`
                    flex items-center w-full px-3 py-2.5 rounded-lg transition-all duration-200 group/group justify-between
                    ${isActive && !isOpen ? 'text-blue-400 bg-slate-800/30' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}
                    ${isOpen ? 'bg-slate-800/20' : ''}
                `}
            >
                <div className="flex items-center">
                    <div className={`w-6 h-6 flex items-center justify-center shrink-0 text-lg transition-colors ${isActive ? 'text-blue-400' : 'text-slate-400 group-hover/group:text-slate-300'}`}>
                        <i className={`${icon}`}></i>
                    </div>
                    <span className="ml-3 whitespace-nowrap text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100">
                        {label}
                    </span>
                </div>
                <i className={`
                    fas fa-chevron-down text-xs transition-transform duration-300 opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 mr-1
                    ${isOpen ? 'rotate-180 text-blue-400' : 'text-slate-600'}
                `}></i>
            </button>
            <div className={`
                overflow-hidden transition-all duration-300 ease-in-out
                ${isOpen
                    ? 'max-h-[500px] opacity-100 md:max-h-0 md:group-hover:max-h-[500px]'
                    : 'max-h-0 opacity-0'}
            `}>
                <div className="pt-1 pb-1 space-y-0.5 relative">
                    {/* Guía visual para subitems */}
                    <div className="absolute left-[1.65rem] top-0 bottom-0 w-px bg-slate-800/50 hidden group-hover:block md:hidden md:group-hover:block"></div>
                    {children}
                </div>
            </div>
        </div>
    );
};

const SubHeader = ({ label }: { label: string }) => (
    <div className="px-4 py-2 mt-1 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500/80">
            {label}
        </span>
    </div>
);

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, setIsSidebarOpen }) => {
    const { setPage, page, params } = useNavigation();
    const { logout, user } = useAuth();

    // Accordion State: only one string allowed.
    const [activeGroup, setActiveGroup] = useState<string | null>(null);

    // Auto-expand group if current page is inside it
    useEffect(() => {
        // Defines which pages belong to which group
        const groups: Record<string, Page[]> = {
            'comercial': ['cotizaciones', 'pedidos', 'facturacion_electronica', 'notas_credito_debito', 'clientes', 'nuevo_cliente'],
            'inventario': ['productos', 'entrada_inventario', 'remisiones', 'inventory_concepts', 'categorias', 'conteo_fisico'],
            'informes': ['reportes'],
            'compras': ['ordenes_compra', 'nueva_orden_compra'],
            'config': ['activity_log', 'factura_profesional']
        };

        const currentGroup = Object.keys(groups).find(key => groups[key].includes(page));
        if (currentGroup) {
            setActiveGroup(currentGroup);
        } else {
            // If on dashboard, maybe collapse all?
            if (page === 'dashboard') setActiveGroup(null);
        }
    }, [page]);

    const handleGroupToggle = (group: string) => {
        setActiveGroup(prev => (prev === group ? null : group));
    };


    // Styling helpers
    const sidebarBase = "fixed inset-y-0 left-0 z-50 flex flex-col bg-[#0f172a] text-slate-300 transition-all duration-300 ease-in-out shadow-2xl overflow-hidden group border-r border-slate-800/50";
    const dimOverlay = "fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 md:hidden";

    // Width logic: Mobile uses transform, Desktop uses width change on hover
    const desktopWidthClass = "md:w-[4.5rem] md:hover:w-64";
    const mobileTransformClass = isSidebarOpen ? "translate-x-0 w-64" : "-translate-x-full w-64 md:translate-x-0";

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`${dimOverlay} ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsSidebarOpen(false)}
            />

            {/* Sidebar Container */}
            <aside className={`${sidebarBase} ${desktopWidthClass} ${mobileTransformClass}`}>

                {/* Header / Logo */}
                <div className="flex items-center h-16 shrink-0 px-3 bg-[#0f172a] border-b border-slate-800">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xl shrink-0 shadow-lg shadow-blue-900/20">
                        E
                    </div>
                    <div className="ml-3 font-bold text-lg text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap md:group-hover:block md:hidden block tracking-tight">
                        ERP 360
                    </div>
                    {/* Mobile Close Button */}
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="ml-auto text-slate-400 hover:text-white md:hidden p-2"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-2 custom-scrollbar px-2">

                    <NavItem
                        icon="fas fa-home"
                        label="Tablero"
                        active={page === 'dashboard'}
                        onClick={() => setPage('dashboard')}
                    />

                    <div className="my-4 mx-2 border-t border-slate-800/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    {/* Ventas Group */}
                    <NavGroup
                        icon="fas fa-shopping-bag"
                        label="Comercial"
                        isOpen={activeGroup === 'comercial'}
                        isActive={activeGroup === 'comercial'}
                        onToggle={() => handleGroupToggle('comercial')}
                    >
                        <SubHeader label="Operaciones" />
                        <NavItem label="Cotizaciones" active={page === 'cotizaciones'} onClick={() => setPage('cotizaciones')} indent />
                        <NavItem label="Pedidos" active={page === 'pedidos'} onClick={() => setPage('pedidos')} indent />
                        <NavItem label="Facturación" active={page === 'facturacion_electronica'} onClick={() => setPage('facturacion_electronica')} indent />
                        <NavItem label="Notas Crédito" active={page === 'notas_credito_debito'} onClick={() => setPage('notas_credito_debito')} indent />

                        <SubHeader label="Maestros" />
                        <NavItem label="Clientes" active={page === 'clientes' && (!params?.tab || params?.tab === 'clientes')} onClick={() => setPage('clientes', { tab: 'clientes' })} indent />
                    </NavGroup>

                    {/* Inventario Group */}
                    <NavGroup
                        icon="fas fa-boxes"
                        label="Inventario"
                        isOpen={activeGroup === 'inventario'}
                        isActive={activeGroup === 'inventario'}
                        onToggle={() => handleGroupToggle('inventario')}
                    >
                        <SubHeader label="Operaciones" />
                        <NavItem label="Entradas" active={page === 'entrada_inventario'} onClick={() => setPage('entrada_inventario')} indent />
                        <NavItem label="Remisiones" active={page === 'remisiones'} onClick={() => setPage('remisiones')} indent />
                        <NavItem label="Conteo Físico" active={page === 'conteo_fisico'} onClick={() => setPage('conteo_fisico')} indent />

                        <SubHeader label="Maestros" />
                        <NavItem label="Productos" active={page === 'productos'} onClick={() => setPage('productos')} indent />
                        <NavItem label="Líneas y Sublíneas" active={page === 'categorias'} onClick={() => setPage('categorias')} indent />
                        <NavItem label="Conceptos" active={page === 'inventory_concepts'} onClick={() => setPage('inventory_concepts')} indent />
                    </NavGroup>

                    {/* Informes Group */}
                    <NavGroup
                        icon="fas fa-chart-bar"
                        label="Informes"
                        isOpen={activeGroup === 'informes'}
                        isActive={activeGroup === 'informes'}
                        onToggle={() => handleGroupToggle('informes')}
                    >
                        <SubHeader label="Reportes" />
                        <NavItem label="Centro de Informes" active={page === 'reportes'} onClick={() => setPage('reportes')} indent />
                    </NavGroup>

                    {/* Compras Group */}
                    <NavGroup
                        icon="fas fa-truck"
                        label="Compras"
                        isOpen={activeGroup === 'compras'}
                        isActive={activeGroup === 'compras'}
                        onToggle={() => handleGroupToggle('compras')}
                    >
                        <NavItem label="Ordenes Compra" active={page === 'ordenes_compra' || page === 'nueva_orden_compra'} onClick={() => setPage('ordenes_compra')} indent />
                        <NavItem label="Proveedores" active={page === 'clientes' && params?.tab === 'proveedores'} onClick={() => setPage('clientes', { tab: 'proveedores' })} indent />
                    </NavGroup>

                    {/* Config Group */}
                    <NavGroup
                        icon="fas fa-cog"
                        label="Configuración"
                        isOpen={activeGroup === 'config'}
                        isActive={activeGroup === 'config'}
                        onToggle={() => handleGroupToggle('config')}
                    >
                        <NavItem label="Actividad" active={page === 'activity_log'} onClick={() => setPage('activity_log')} indent />
                    </NavGroup>

                </div>

                {/* Footer / User */}
                <div className="p-3 border-t border-slate-800 bg-[#0f172a]">
                    <div className={`flex items-center gap-3 overflow-hidden rounded-lg p-2 transition-colors hover:bg-slate-800/50 cursor-pointer`}>
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                            {user?.nombre?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap overflow-hidden">
                            <span className="text-sm font-medium text-slate-200 truncate">{user?.nombre}</span>
                            <button
                                onClick={logout}
                                className="text-xs text-slate-400 hover:text-red-400 text-left transition-colors"
                            >
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </div>

            </aside>
        </>
    );
};

export default Sidebar;
