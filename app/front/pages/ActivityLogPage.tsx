import React from 'react';
import Table, { Column } from '../components/ui/Table';
import Card, { CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { ActivityLog } from '../types';
import { useTable } from '../hooks/useTable';
import { TableToolbar } from '../components/ui/TableToolbar';
import TablePagination from '../components/ui/TablePagination';
import { timeSince } from '../utils/dateUtils';
import { useData } from '../hooks/useData';

const ActivityLogPage: React.FC = () => {
  const { activityLog } = useData();
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
  } = useTable<ActivityLog>({
    data: activityLog,
    searchKeys: ['action', 'details', (item) => item.user.nombre, (item) => item.entity.name],
  });

  const columns: Column<ActivityLog>[] = [
    {
      header: 'Fecha', accessor: 'timestamp', cell: (item) => (
        <div className="flex flex-col">
          <span>{new Date(item.timestamp).toLocaleString('es-CO')}</span>
          <span className="text-xs text-slate-500">{timeSince(item.timestamp)}</span>
        </div>
      )
    },
    { header: 'Usuario', accessor: 'user', cell: (item) => `${item.user.nombre} (${item.user.rol})` },
    { header: 'Acción', accessor: 'action' },
    { header: 'Entidad', accessor: 'entity', cell: (item) => `${item.entity.type}: ${item.entity.name}` },
    { header: 'Detalles', accessor: 'details' },
  ];

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">Bitácora de Actividad del Sistema</h1>
      <Card>
        <CardHeader>
          <CardTitle>Registro de Auditoría</CardTitle>
        </CardHeader>
        <div className="p-2 sm:p-3">
          <TableToolbar
            searchTerm={searchTerm}
            onSearchChange={handleSearch}
          />
        </div>
        <CardContent className="p-0">
          <Table columns={columns} data={paginatedData} onSort={requestSort} sortConfig={sortConfig} />
        </CardContent>
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
      </Card>
    </div>
  );
};

export default ActivityLogPage;