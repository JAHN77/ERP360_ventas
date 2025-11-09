import React, { useState, useMemo, useCallback } from 'react';
import { useData } from '../hooks/useData';
import { useTable } from '../hooks/useTable';
import Card from '../components/ui/Card';
import Table, { Column } from '../components/ui/Table';
import { TableToolbar } from '../components/ui/TableToolbar';
import TablePagination from '../components/ui/TablePagination';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import ProtectedComponent from '../components/auth/ProtectedComponent';
import { useNotifications } from '../hooks/useNotifications';
import { Cotizacion, Pedido, Remision, Factura, NotaCredito } from '../types';
import { findClienteByIdentifier, getClienteNombreSeguro } from '../utils/clientes';

import CotizacionPreviewModal from '../components/comercial/CotizacionPreviewModal';
import PedidoPreviewModal from '../components/comercial/PedidoPreviewModal';
import RemisionPreviewModal from '../components/remisiones/RemisionPreviewModal';
import FacturaPreviewModal from '../components/facturacion/FacturaPreviewModal';
import NotaCreditoPreviewModal from '../components/devoluciones/NotaCreditoPreviewModal';
import type { Permission } from '../config/rolesConfig';

type Documento = Cotizacion | Pedido | Remision | Factura | NotaCredito;
type Tab = 'cotizaciones' | 'pedidos' | 'remisiones' | 'facturas' | 'notasCredito';

const formatCurrency = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);

const DemasInformesPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('cotizaciones');
    const { addNotification } = useNotifications();
    const { 
        cotizaciones, pedidos, remisiones, facturas, notasCredito, clientes,
        borrarCotizacion, borrarPedido, borrarRemision, borrarFactura, borrarNotaCredito
    } = useData();

    const [docToPreview, setDocToPreview] = useState<Documento | null>(null);
    const [docToDelete, setDocToDelete] = useState<Documento | null>(null);

    const handleDelete = async () => {
        if (!docToDelete) return;
        let deletedDocName = '';
        try {
            if ('numeroCotizacion' in docToDelete) { deletedDocName = docToDelete.numeroCotizacion; await borrarCotizacion(docToDelete.id); }
            else if ('numeroPedido' in docToDelete) { deletedDocName = docToDelete.numeroPedido; await borrarPedido(docToDelete.id); }
            else if ('numeroRemision' in docToDelete) { deletedDocName = docToDelete.numeroRemision; await borrarRemision(docToDelete.id); }
            else if ('numeroFactura' in docToDelete) { deletedDocName = docToDelete.numeroFactura; await borrarFactura(docToDelete.id); }
            else if ('numero' in docToDelete) { deletedDocName = docToDelete.numero; await borrarNotaCredito(docToDelete.id); }
            
            addNotification({ message: `Documento ${deletedDocName} eliminado con éxito.`, type: 'success' });
        } catch (error) {
            addNotification({ message: (error as Error).message, type: 'warning' });
        } finally {
            setDocToDelete(null);
        }
    };

    const TabButton: React.FC<{ tabId: Tab; label: string; icon: string }> = ({ tabId, label, icon }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`flex items-center gap-2 whitespace-nowrap py-3 px-4 border-b-2 font-semibold text-sm rounded-t-lg ${
                activeTab === tabId
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
        >
            <i className={`fas ${icon}`}></i>
            {label}
        </button>
    );

    const resolveDocumento = useCallback((doc: Documento): Documento | null => {
        const docIdStr = String(doc.id ?? '').trim();
        switch (activeTab) {
            case 'cotizaciones':
                return cotizaciones.find(c => String(c.id ?? '').trim() === docIdStr) ?? doc;
            case 'pedidos':
                return pedidos.find(p => String(p.id ?? '').trim() === docIdStr) ?? doc;
            case 'remisiones':
                return remisiones.find(r => String(r.id ?? '').trim() === docIdStr) ?? doc;
            case 'facturas':
                return facturas.find(f => String(f.id ?? '').trim() === docIdStr) ?? doc;
            case 'notasCredito':
                return notasCredito.find(nc => String(nc.id ?? '').trim() === docIdStr) ?? doc;
            default:
                return doc;
        }
    }, [activeTab, cotizaciones, pedidos, remisiones, facturas, notasCredito]);

    const renderTable = () => {
        switch (activeTab) {
            case 'cotizaciones': return <DocumentTable<Cotizacion> data={cotizaciones} columns={cotizacionColumns} searchKeys={['numeroCotizacion']} onAction={handleAction} deletePermission="cotizaciones:delete" />;
            case 'pedidos': return <DocumentTable<Pedido> data={pedidos} columns={pedidoColumns} searchKeys={['numeroPedido']} onAction={handleAction} deletePermission="pedidos:delete" />;
            case 'remisiones': return <DocumentTable<Remision> data={remisiones} columns={remisionColumns} searchKeys={['numeroRemision']} onAction={handleAction} deletePermission="remisiones:delete" />;
            case 'facturas': return <DocumentTable<Factura> data={facturas} columns={facturaColumns} searchKeys={['numeroFactura']} onAction={handleAction} deletePermission="facturacion:delete" />;
            case 'notasCredito': return <DocumentTable<NotaCredito> data={notasCredito} columns={notaCreditoColumns} searchKeys={['numero']} onAction={handleAction} deletePermission="devoluciones:delete" />;
            default: return null;
        }
    };

    const handleAction = (action: 'view' | 'delete', doc: Documento) => {
        const resolved = resolveDocumento(doc) ?? doc;
        if (action === 'view') {
            setDocToPreview(resolved);
        } else if (action === 'delete') {
            setDocToDelete(resolved);
        }
    };

    const getDocName = (doc: Documento | null): string => {
        if (!doc) return '';
        if ('numeroCotizacion' in doc) return doc.numeroCotizacion;
        if ('numeroPedido' in doc) return doc.numeroPedido;
        if ('numeroRemision' in doc) return doc.numeroRemision;
        if ('numeroFactura' in doc) return doc.numeroFactura;
        if ('numero' in doc) return doc.numero;
        return 'documento';
    }

    const clienteName = (id: string) => {
        const cliente = findClienteByIdentifier(clientes, id);
        return getClienteNombreSeguro(cliente);
    };

    const cotizacionColumns: Column<Cotizacion>[] = [
        { header: 'Número', accessor: 'numeroCotizacion' }, { header: 'Cliente', accessor: 'clienteId', cell: item => clienteName(item.clienteId) },
        { header: 'Fecha', accessor: 'fechaCotizacion' }, { header: 'Total', accessor: 'total', cell: item => formatCurrency(item.total) },
        { header: 'Estado', accessor: 'estado', cell: item => <StatusBadge status={item.estado} /> },
    ];
    const pedidoColumns: Column<Pedido>[] = [
        { header: 'Número', accessor: 'numeroPedido' }, { header: 'Cliente', accessor: 'clienteId', cell: item => clienteName(item.clienteId) },
        { header: 'Fecha', accessor: 'fechaPedido' }, { header: 'Total', accessor: 'total', cell: item => formatCurrency(item.total) },
        { header: 'Estado', accessor: 'estado', cell: item => <StatusBadge status={item.estado} /> },
    ];
    const remisionColumns: Column<Remision>[] = [
        { header: 'Número', accessor: 'numeroRemision' }, { header: 'Cliente', accessor: 'clienteId', cell: item => clienteName(item.clienteId) },
        { header: 'Fecha', accessor: 'fechaRemision' }, { header: 'Total', accessor: 'total', cell: item => formatCurrency(item.total) },
        { header: 'Estado', accessor: 'estado', cell: item => <StatusBadge status={item.estado} /> },
    ];
    const facturaColumns: Column<Factura>[] = [
        { header: 'Número', accessor: 'numeroFactura' }, { header: 'Cliente', accessor: 'clienteId', cell: item => clienteName(item.clienteId) },
        { header: 'Fecha', accessor: 'fechaFactura' }, { header: 'Total', accessor: 'total', cell: item => formatCurrency(item.total) },
        { header: 'Estado', accessor: 'estado', cell: item => <StatusBadge status={item.estado} /> },
    ];
    const notaCreditoColumns: Column<NotaCredito>[] = [
        { header: 'Número', accessor: 'numero' }, { header: 'Cliente', accessor: 'clienteId', cell: item => clienteName(item.clienteId) },
        { header: 'Fecha', accessor: 'fechaEmision' }, { header: 'Total', accessor: 'total', cell: item => formatCurrency(item.total) },
        { header: 'Estado DIAN', accessor: 'estadoDian', cell: item => <StatusBadge status={item.estadoDian || 'PENDIENTE'} /> },
    ];

    return (
        <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-4">Centro de Documentos</h1>
            <Card>
                <div className="border-b border-slate-200 dark:border-slate-700">
                    <nav className="-mb-px flex space-x-2 overflow-x-auto" aria-label="Tabs">
                        <TabButton tabId="cotizaciones" label="Cotizaciones" icon="fa-file-alt" />
                        <TabButton tabId="pedidos" label="Pedidos" icon="fa-shopping-cart" />
                        <TabButton tabId="remisiones" label="Remisiones" icon="fa-truck" />
                        <TabButton tabId="facturas" label="Facturas" icon="fa-file-invoice-dollar" />
                        <TabButton tabId="notasCredito" label="Notas de Crédito" icon="fa-undo" />
                    </nav>
                </div>
                <div className="pt-6">
                    {renderTable()}
                </div>
            </Card>

            {/* Preview Modals */}
            {docToPreview && 'numeroCotizacion' in docToPreview && <CotizacionPreviewModal cotizacion={docToPreview} onClose={() => setDocToPreview(null)} />}
            {docToPreview && 'numeroPedido' in docToPreview && <PedidoPreviewModal pedido={docToPreview} onClose={() => setDocToPreview(null)} />}
            {docToPreview && 'numeroRemision' in docToPreview && <RemisionPreviewModal remision={docToPreview} onClose={() => setDocToPreview(null)} />}
            {docToPreview && 'numeroFactura' in docToPreview && <FacturaPreviewModal factura={docToPreview} onClose={() => setDocToPreview(null)} />}
            {docToPreview && 'numero' in docToPreview && <NotaCreditoPreviewModal notaCredito={docToPreview} onClose={() => setDocToPreview(null)} />}

            {/* Delete Confirmation Modal */}
            <Modal isOpen={!!docToDelete} onClose={() => setDocToDelete(null)} title="Confirmar Eliminación" size="md">
                <p>¿Estás seguro de que quieres eliminar el documento <strong>{getDocName(docToDelete)}</strong>? Esta acción no se puede deshacer.</p>
                <div className="flex justify-end gap-4 mt-6">
                    <button onClick={() => setDocToDelete(null)} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg font-semibold">Cancelar</button>
                    <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold">Eliminar</button>
                </div>
            </Modal>
        </div>
    );
};

interface DocumentTableProps<T extends { id: string | number }> {
    data: T[];
    columns: Column<T>[];
    searchKeys: (keyof T | ((item: T) => string))[];
    onAction: (action: 'view' | 'delete', doc: T) => void;
    deletePermission: Permission;
}

const DocumentTable = <T extends { id: string | number }>({ data, columns, searchKeys, onAction, deletePermission }: DocumentTableProps<T>) => {
    const actionColumn: Column<T> = {
        header: 'Acciones',
        accessor: 'id',
        cell: (item) => (
            <div className="flex items-center space-x-3 text-slate-500 dark:text-slate-400 text-lg">
                <button onClick={() => onAction('view', item)} className="hover:text-blue-500" title="Ver/Imprimir/Descargar"><i className="fas fa-eye"></i></button>
                <ProtectedComponent permission={deletePermission}>
                    <button onClick={() => onAction('delete', item)} className="hover:text-red-500" title="Eliminar"><i className="fas fa-trash-alt"></i></button>
                </ProtectedComponent>
            </div>
        )
    };

    const tableInstance = useTable({ data: useMemo(() => data, [data]), searchKeys });

    return (
        <div>
            <TableToolbar searchTerm={tableInstance.searchTerm} onSearchChange={tableInstance.handleSearch} />
            <Table columns={[...columns, actionColumn]} data={tableInstance.paginatedData} onSort={tableInstance.requestSort} sortConfig={tableInstance.sortConfig} />
            <TablePagination {...tableInstance} />
        </div>
    );
};


export default DemasInformesPage;
