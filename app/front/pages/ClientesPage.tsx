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
import { apiClient } from '../services/apiClient';
import { useNotifications } from '../hooks/useNotifications';

import ClienteCreateModal from '../components/clientes/ClienteCreateModal';
import PageHeader from '../components/ui/PageHeader';
import ClientDetails from '../components/clientes/ClientDetails';
import PageContainer from '../components/ui/PageContainer';
import SectionHeader from '../components/ui/SectionHeader';

const ClientesPage: React.FC = () => {
  const { params, setPage } = useNavigation();
  const { tiposDocumento, ciudades, tiposPersona } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);

  // Server-Side State
  const [serverClients, setServerClients] = useState<Cliente[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [serverPage, setServerPage] = useState(1);
  const [serverPageSize, setServerPageSize] = useState(20);
  const [serverSearch, setServerSearch] = useState('');
  const [serverSort, setServerSort] = useState({ key: 'razonSocial', direction: 'asc' });

  const [typeFilter, setTypeFilter] = useState('Todos');
  const [paymentFilter, setPaymentFilter] = useState('Todos');
  const [activeTab, setActiveTab] = useState<'clientes' | 'proveedores'>('clientes');

  // Sync tab with navigation params
  useEffect(() => {
    if (params?.tab === 'proveedores') {
      setActiveTab('proveedores');
    } else if (params?.tab === 'clientes') {
      setActiveTab('clientes');
    }
  }, [params?.tab]);

  const { addNotification } = useNotifications(); // Assuming this hook exists or imports need checking

  const getClientDisplayName = (cliente: Cliente): string => {
    return cliente.razonSocial || `${cliente.primerNombre || ''} ${cliente.primerApellido || ''}`.trim();
  }

  const loadClients = async () => {
    setIsLoadingClients(true);
    try {
      const isProveedor = activeTab === 'proveedores';
      const response = await apiClient.getClientes(
        serverPage,
        serverPageSize,
        undefined, // hasEmail (removed strict requirement/handled in backend if needed or passed as option)
        serverSearch,
        serverSort.key,
        serverSort.direction as 'asc' | 'desc',
        isProveedor,
        typeFilter === 'Todos' ? undefined : typeFilter,
        paymentFilter === 'Todos' ? undefined : paymentFilter
      );

      if (response.success && response.data) {
        setServerClients(response.data as Cliente[]);
        const pagination = (response as any).pagination || {};
        const total = pagination.total || (response.data as any[]).length;
        setTotalClients(total);
      } else {
        setServerClients([]);
        setTotalClients(0);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setIsLoadingClients(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, [serverPage, serverPageSize, serverSearch, serverSort, typeFilter, paymentFilter, activeTab]);

  // Tab change resets page
  useEffect(() => {
    setServerPage(1);
  }, [activeTab, typeFilter, paymentFilter]);


  const handleOpenModal = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setIsModalOpen(true);
  };

  useEffect(() => {
    const focusId = params?.focusId;
    if (!focusId) return;

    // Check if in current list
    const targetClient = serverClients.find((cliente) => {
      const candidateIds = [cliente.id, cliente.numeroDocumento, (cliente as any).codter]
        .filter((value) => value !== undefined && value !== null)
        .map((value) => String(value));
      return candidateIds.includes(String(focusId));
    });

    if (targetClient) {
      handleOpenModal(targetClient);
    } else if (focusId) {
      // Fetch explicit client if not in list
      apiClient.getClienteById(focusId).then(res => {
        if (res.success && res.data) {
          handleOpenModal(res.data as Cliente);
        }
      });
    }
  }, [params?.focusId, serverClients]);

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
        const postal = (item as any).codigoPostal || (item as any).coddane || '';
        const isCode = /^\d{4,6}$/.test(String(val));
        let cityName = val;
        if (isCode) {
          const found = ciudades.find(c => String(c.codigo).trim() === String(val).trim());
          if (found) cityName = found.nombre;
        }
        if ((!cityName || /^\d+$/.test(String(cityName))) && postal) {
          const foundByPostal = ciudades.find(c => String(c.codigo).trim() === String(postal).trim());
          if (foundByPostal) cityName = foundByPostal.nombre;
        }
        return <span className="text-sm text-slate-600 dark:text-slate-400">{cityName || val}</span>;
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

  // useTable in Manual Mode
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
    data: serverClients,
    manual: true,
    totalItems: totalClients,
    initialRowsPerPage: 20,
    onPageChange: (page) => setServerPage(page),
    onRowsPerPageChange: (rows) => { setServerPageSize(rows); setServerPage(1); },
  });

  // Sync Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setServerSearch(searchTerm);
      setServerPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Sync Sort
  useEffect(() => {
    if (sortConfig.key) {
      setServerSort({ key: String(sortConfig.key), direction: sortConfig.direction });
    }
  }, [sortConfig]);

  // No filteredClients useMemo needed anymore since we just use current page data from server


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
    <PageContainer>
      <SectionHeader
        title={activeTab === 'clientes' ? 'Gestión de Clientes' : 'Gestión de Proveedores'}
        subtitle={activeTab === 'clientes'
          ? 'Administra la base de datos de tus clientes.'
          : 'Administra la base de datos de tus proveedores.'}
      />

      {/* Tabs Clientes vs Proveedores (Ocultos por requerimiento) */}
      {/* 
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        ...
      </div> 
      */}

      <Card className="shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
          <TableToolbar
            searchTerm={searchTerm}
            onSearchChange={handleSearch}
            createActionLabel={activeTab === 'clientes' ? "Nuevo Cliente" : "Nuevo Proveedor"}
            onCreateAction={() => setIsCreateModalOpen(true)}
            additionalFilters={additionalFilters}
            onCustomizeColumns={() => setIsColumnModalOpen(true)}
            placeholder="Buscar cliente, documento, email..."
          />
        </div>

        <CardContent className="p-0">
          <Table
            columns={visibleColumns}
            data={paginatedData}
            onSort={requestSort}
            sortConfig={sortConfig}
            highlightRowId={params?.highlightId ?? params?.focusId}
            isLoading={isLoadingClients}
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
          title={`Detalle del ${activeTab === 'proveedores' ? 'Proveedor' : 'Cliente'}: ${selectedCliente.nombreCompleto}`}
          size="4xl"
        >
          <ClientDetails cliente={selectedCliente} />
        </Modal>
      )}
    </PageContainer>
  );
};

export default ClientesPage;