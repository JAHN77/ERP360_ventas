import React from 'react';
import type { GlobalSearchResults, Cotizacion, Pedido, Factura, Remision, InvProducto, Cliente } from '../../types';
import { useData } from '../../hooks/useData';

const formatCurrency = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);

interface SearchResultsProps {
    results: GlobalSearchResults;
    onResultClick: (page: any, params: any) => void;
    onClose: () => void;
    position?: { top: number; left: number; width: number }; // Posición para Portal
    usePortal?: boolean; // Si debe usar Portal
}

const ResultItem: React.FC<{ onClick: () => void; children: React.ReactNode; icon: string }> = ({ onClick, children, icon }) => (
    <li 
        onClick={onClick}
        className="px-4 py-3 hover:bg-blue-500 hover:text-white cursor-pointer transition-colors duration-150 flex items-start gap-3"
    >
        <i className={`fas ${icon} text-slate-400 pt-1 w-4 text-center`}></i>
        <div className="flex-1">{children}</div>
    </li>
);

const GlobalSearchResults: React.FC<SearchResultsProps> = ({ results, onResultClick, onClose, position, usePortal = false }) => {
    const { clientes } = useData();

    const resultSections: {
        key: keyof GlobalSearchResults;
        title: string;
        icon: string;
        page: string;
        paramKey: string;
        render: (item: any) => React.ReactNode;
    }[] = [
        {
            key: 'facturas', title: 'Facturas', icon: 'fa-file-invoice-dollar', page: 'facturacion_electronica', paramKey: 'focusId',
            render: (item: Factura) => (
                <div>
                    <p className="font-semibold">{item.numeroFactura}</p>
                    <p className="text-xs text-slate-500">{clientes.find(c => c.id === item.clienteId)?.nombreCompleto} - {formatCurrency(item.total)}</p>
                </div>
            )
        },
        {
            key: 'remisiones', title: 'Remisiones', icon: 'fa-truck', page: 'remisiones', paramKey: 'focusId',
            render: (item: Remision) => (
                <div>
                    <p className="font-semibold">{item.numeroRemision}</p>
                    <p className="text-xs text-slate-500">{clientes.find(c => c.id === item.clienteId)?.nombreCompleto} - {formatCurrency(item.total)}</p>
                </div>
            )
        },
        {
            key: 'pedidos', title: 'Pedidos', icon: 'fa-shopping-cart', page: 'pedidos', paramKey: 'focusId',
            render: (item: Pedido) => (
                 <div>
                    <p className="font-semibold">{item.numeroPedido}</p>
                    <p className="text-xs text-slate-500">{clientes.find(c => c.id === item.clienteId)?.nombreCompleto} - {formatCurrency(item.total)}</p>
                </div>
            )
        },
        {
            key: 'cotizaciones', title: 'Cotizaciones', icon: 'fa-file-alt', page: 'cotizaciones', paramKey: 'focusId',
            render: (item: Cotizacion) => (
                <div>
                    <p className="font-semibold">{item.numeroCotizacion}</p>
                    <p className="text-xs text-slate-500">{clientes.find(c => c.id === item.clienteId)?.nombreCompleto} - {formatCurrency(item.total)}</p>
                </div>
            )
        },
         {
            key: 'productos', title: 'Productos', icon: 'fa-box-open', page: 'productos', paramKey: 'focusId',
            render: (item: InvProducto) => (
                 <div>
                    <p className="font-semibold">{item.nombre}</p>
                    <p className="text-xs text-slate-500">Ref: {item.referencia || 'N/A'} - Stock: {item.controlaExistencia ?? 0}</p>
                </div>
            )
        },
        {
            key: 'clientes', title: 'Clientes', icon: 'fa-users', page: 'clientes', paramKey: 'focusId',
            render: (item: Cliente) => (
                 <div>
                    <p className="font-semibold">{item.nombreCompleto}</p>
                    <p className="text-xs text-slate-500">{item.numeroDocumento} - {item.ciudadId}</p>
                </div>
            )
        },
    ];
    
    const totalResults =
      (results.cotizaciones?.length || 0) +
      (results.pedidos?.length || 0) +
      (results.facturas?.length || 0) +
      (results.remisiones?.length || 0) +
      (results.productos?.length || 0) +
      (results.clientes?.length || 0);

    const containerStyle = usePortal && position
        ? {
            position: 'fixed' as const,
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: `${position.width}px`,
            maxWidth: '384px', // lg:w-96
            zIndex: 10000,
            pointerEvents: 'auto' as const
          }
        : undefined;

    const containerClassName = usePortal
        ? 'bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 z-[10000] max-h-[70vh] flex flex-col'
        : 'absolute top-full mt-2 w-full lg:w-96 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 z-40 max-h-[70vh] flex flex-col';

    return (
        <div 
            className={containerClassName}
            style={containerStyle}
            onClick={(e) => e.stopPropagation()}
        >
            {totalResults > 0 ? (
                <div className="overflow-y-auto">
                    {resultSections.map(section => {
                        const items = results[section.key];
                        if (!items || items.length === 0) return null;
                        return (
                            <div key={section.key}>
                                <h4 className="px-4 py-2 text-xs font-bold uppercase text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 sticky top-0">{section.title}</h4>
                                <ul className="text-sm">
                                    {(items as any[]).slice(0, 5).map((item: any) => (
                                        <ResultItem 
                                            key={item.id} 
                                            icon={section.icon}
                                            onClick={() => {
                                                onResultClick(section.page, { [section.paramKey]: item.id });
                                                onClose();
                                            }}
                                        >
                                            {section.render(item)}
                                        </ResultItem>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    <i className="fas fa-search fa-2x mb-2 text-slate-300 dark:text-slate-600"></i>
                    <p>No se encontraron resultados.</p>
                </div>
            )}
        </div>
    );
};

export default GlobalSearchResults;