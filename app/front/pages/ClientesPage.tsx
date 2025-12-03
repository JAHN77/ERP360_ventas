import React, { useState, useMemo, useEffect } from 'react';
import Table, { Column } from '../components/ui/Table';
import Card, { CardContent } from '../components/ui/Card';
import { Cliente } from '../types';
import { useNavigation } from '../hooks/useNavigation';
import Modal from '../components/ui/Modal';
import { useTable } from '../hooks/useTable';
import { TableToolbar } from '../components/ui/TableToolbar';
import TablePagination from '../components/ui/TablePagination';
import ProtectedComponent from '../components/auth/ProtectedComponent';
import { useData } from '../hooks/useData';
import { useColumnManager } from '../hooks/useColumnManager';
import ColumnManagerModal from '../components/ui/ColumnManagerModal';

import ClienteCreateModal from '../components/clientes/ClienteCreateModal';

const ClientesPage: React.FC = () => {
  const { params, setPage } = useNavigation();
  const { clientes, tiposDocumento, ciudades, tiposPersona } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);

  const [typeFilter, setTypeFilter] = useState('Todos');
  const [paymentFilter, setPaymentFilter] = useState('Todos');

  const getClientDisplayName = (cliente: Cliente): string => {
    return cliente.razonSocial || `${cliente.primerNombre || ''} ${cliente.primerApellido || ''}`.trim();
  }

  const handleOpenModal = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setIsModalOpen(true);
  };

  useEffect(() => {
    const focusId = params?.focusId;
    if (!focusId) {
      return;
    }

    const targetClient = clientes.find((cliente) => {
      const candidateIds = [cliente.id, cliente.numeroDocumento, (cliente as any).codter]
        .filter((value) => value !== undefined && value !== null)
        .map((value) => String(value));
      return candidateIds.includes(String(focusId));
    });

    if (targetClient) {
      handleOpenModal(targetClient);
    }
  }, [params?.focusId, clientes]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCliente(null);
    if (params?.focusId || params?.highlightId) {
      const { focusId: _focus, highlightId: _highlight, ...rest } = params;
      setPage('clientes', rest);
    }
  };

  const defaultColumns = useMemo<Column<Cliente>[]>(() => [
    {
      header: 'Nombre / Razón Social',
      accessor: 'nombreCompleto',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-800 dark:text-slate-200">{item.nombreCompleto}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{item.numeroDocumento}</span>
        </div>
      )
    },
    {
      header: 'Dirección',
      accessor: 'direccion',
      cell: (item) => <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[200px] block" title={item.direccion}>{item.direccion || ''}</span>
    },
    {
      header: 'Ciudad', accessor: 'ciudadId', cell: (item) => {
        const val = item.ciudadId || '';
        const isCode = /^\d{4,6}$/.test(String(val));
        let cityName = val;
        if (isCode) {
          cityName = ciudades.find(c => String(c.codigo) === String(val))?.nombre || val;
        }
        return <span className="text-sm text-slate-600 dark:text-slate-400">{cityName}</span>;
      }
    },
    {
      header: 'Teléfonos', accessor: 'telter', cell: (item) => {
        const fijo = item.telter || '';
        const cel = item.celter || item.celular || '';
        const phones = [cel, fijo].filter(Boolean).join(' / ');
        return <span className="text-sm text-slate-600 dark:text-slate-400">{phones || 'N/A'}</span>;
      }
    },
    { header: 'Email', accessor: 'email', cell: (item) => <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[150px] block" title={item.email}>{item.email || ''}</span> },
    {
      header: 'Acciones', accessor: 'id', cell: (item) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenModal(item)}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
            title="Ver Detalles"
          >
            <i className="fas fa-eye"></i>
          </button>
          <ProtectedComponent permission="clientes:edit">
            <button
              onClick={() => setPage('editar_cliente', { id: item.id })}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
              title="Editar Cliente"
            >
              <i className="fas fa-pencil-alt"></i>
            </button>
          </ProtectedComponent>
        </div>
      )
    },
  ], [ciudades, setPage]);

  const {
    visibleColumns,
    allManagedColumns,
    setManagedColumns,
    resetManagedColumns
  } = useColumnManager('clientes', defaultColumns);

  const filteredClients = useMemo(() => {
    return clientes.filter(cliente => {
      const typeMatch = typeFilter === 'Todos' || cliente.tipoPersonaId === typeFilter;
      const paymentMatch = paymentFilter === 'Todos' || String(cliente.diasCredito) === paymentFilter;
      const hasEmail = cliente.email && cliente.email.trim().length > 0;
      return typeMatch && paymentMatch && hasEmail;
    });
  }, [clientes, typeFilter, paymentFilter]);

  const {
    paginatedData,
    requestSort,
    sortConfig,
    searchTerm,
    handleSearch,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    goToPage,
    totalItems,
    rowsPerPage,
    setRowsPerPage,
  } = useTable<Cliente>({
    data: filteredClients,
    searchKeys: [
      (item) => item.nombreCompleto,
      'numeroDocumento',
      'email',
      (item) => item.ciudadId || '',
      'direccion',
      (item) => String(item.telter || ''),
      'celular'
    ],
  });

  // Orden por defecto: Nombre / Razón Social asc
  useEffect(() => {
    if (!sortConfig.key) {
      requestSort('nombreCompleto' as keyof Cliente);
    }
    // solo una vez al montar si no hay sort
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const additionalFilters = (
    <div className="flex flex-col sm:flex-row gap-4">
      <div>
        <label htmlFor="typeFilter" className="sr-only">Tipo de Cliente</label>
        <select
          id="typeFilter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="Todos">Todos los Tipos</option>
          {tiposPersona.map(tp => <option key={tp.id} value={tp.id}>{tp.nombre}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="paymentFilter" className="sr-only">Condición de Pago</label>
        <select
          id="paymentFilter"
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="Todos">Todas las Condic.</option>
          <option value="0">Contado</option>
          <option value="15">Crédito 15 días</option>
          <option value="30">Crédito 30 días</option>
          <option value="60">Crédito 60 días</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            Gestión de Clientes
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Administra la base de datos de clientes y sus condiciones comerciales.
          </p>
        </div>
      </div>

      <Card className="shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
          <TableToolbar
            searchTerm={searchTerm}
            onSearchChange={handleSearch}
            createActionLabel="Nuevo Cliente"
            onCreateAction={() => setIsCreateModalOpen(true)}
            additionalFilters={additionalFilters}
            onCustomizeColumns={() => setIsColumnModalOpen(true)}
            placeholder="Buscar cliente, documento, email..."
          />
        </div>

        <CardContent className="p-0" style={{ overflowX: 'visible', maxWidth: '100%' }}>
          <Table
            columns={visibleColumns}
            data={paginatedData}
            onSort={requestSort}
            sortConfig={sortConfig}
            highlightRowId={params?.highlightId ?? params?.focusId}
          />
        </CardContent>

        <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            canPreviousPage={currentPage > 1}
            canNextPage={currentPage < totalPages}
            onPreviousPage={prevPage}
            onNextPage={nextPage}
            totalItems={totalItems}
            rowsPerPage={rowsPerPage}
            setRowsPerPage={setRowsPerPage}
          />
        </div>
      </Card>

      <ColumnManagerModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        columns={allManagedColumns}
        onSave={(newColumns) => {
          setManagedColumns(newColumns);
          setIsColumnModalOpen(false);
        }}
        onReset={() => {
          resetManagedColumns();
          setIsColumnModalOpen(false);
        }}
      />

      <ClienteCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          // Data refresh is handled inside the modal
        }}
      />

      {selectedCliente && (
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={`Detalle del Cliente: ${selectedCliente.nombreCompleto}`}
          size="xl"
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="sm:col-span-2 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-600 dark:text-slate-400">Nombre / Razón Social:</p>
                  <p>{selectedCliente.nombreCompleto}</p>
                </div>
                <div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${selectedCliente.activo ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                    {selectedCliente.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Documento:</p>
                <p>{(() => { const tipoDoc = tiposDocumento.find(td => td.id === selectedCliente.tipoDocumentoId); return `${tipoDoc ? tipoDoc.codigo : ''} ${selectedCliente.numeroDocumento}`; })()}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Tipo Persona:</p>
                <p>{tiposPersona.find(tp => tp.id === selectedCliente.tipoPersonaId)?.nombre || selectedCliente.tipoPersonaId}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Régimen Fiscal:</p>
                <p>{selectedCliente.regimenFiscalId || 'N/A'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="font-semibold text-slate-600 dark:text-slate-400">Dirección:</p>
                <p>{selectedCliente.direccion}{selectedCliente.ciudadId ? `, ${(() => { const val = selectedCliente.ciudadId || ''; const isCode = /^\d{4,6}$/.test(String(val)); return isCode ? (ciudades.find(c => String(c.codigo) === String(val))?.nombre || val) : val; })()}` : ''}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Email:</p>
                <p>{selectedCliente.email || '—'}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Celular:</p>
                <p>{selectedCliente.celular || '—'}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Teléfono Fijo:</p>
                <p>{selectedCliente.telter || '—'}</p>
              </div>
            </div>

            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
              <p className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Condiciones Comerciales</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-slate-600 dark:text-slate-400">Límite de Crédito:</p>
                  <p>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(selectedCliente.limiteCredito || 0))}</p>
                </div>
                <div>
                  <p className="text-slate-600 dark:text-slate-400">Días de Crédito:</p>
                  <p>{selectedCliente.diasCredito ?? '—'} días</p>
                </div>
                <div>
                  <p className="text-slate-600 dark:text-slate-400">Condición de Pago:</p>
                  <p>{selectedCliente.condicionPago || '—'}</p>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              Cliente desde: {selectedCliente.createdAt ? new Date(selectedCliente.createdAt).toLocaleDateString('es-CO') : '—'}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ClientesPage;