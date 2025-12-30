import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { Usuario } from '../types';
import UserFormModal from '../components/users/UserFormModal';
import { useTable } from '../hooks/useTable';
import TablePagination from '../components/ui/TablePagination';

const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<Usuario | null>(null);
    const [showInactive, setShowInactive] = useState(false);

    const filteredUsers = users.filter(user => showInactive || !!user.activo);

    // Use useTable hook for pagination, sorting and filtering
    const {
        paginatedData,
        searchTerm,
        handleSearch,
        sortConfig,
        requestSort,
        currentPage,
        rowsPerPage,
        totalPages,
        setRowsPerPage,
        totalItems,
        nextPage,
        prevPage,
        goToPage
    } = useTable<Usuario>({
        data: filteredUsers,
        searchKeys: ['codusu', 'nomusu'],
        initialRowsPerPage: 10
    });

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await apiClient.getUsers();
            if (response.success && response.data) {
                setUsers(response.data);
            }
        } catch (err: any) {
            setError(err.message || 'Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = () => {
        setUserToEdit(null);
        setIsModalOpen(true);
    };

    const handleEditUser = (user: Usuario) => {
        setUserToEdit(user);
        setIsModalOpen(true);
    };

    const handleDeleteUser = async (user: Usuario) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar al usuario ${user.nomusu}?`)) return;

        try {
            await apiClient.deleteUser(user.id);
            fetchUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Error al eliminar usuario');
        }
    };

    const handleSuccess = () => {
        fetchUsers();
        setIsModalOpen(false);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Usuarios del Sistema</h1>
                <button
                    onClick={handleCreateUser}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <i className="fas fa-plus"></i>
                    Nuevo Usuario
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-200">
                    {error}
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
                {/* Search Bar and Filter */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full sm:w-96">
                        <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"></i>
                        <input
                            type="text"
                            placeholder="Buscar por usuario o nombre..."
                            value={searchTerm}
                            onChange={handleSearch}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="showInactive"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                            className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                        />
                        <label htmlFor="showInactive" className="text-sm font-medium text-slate-700 dark:text-slate-300 select-none cursor-pointer">
                            Mostrar Inactivos
                        </label>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900/50">
                            <tr>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider cursor-pointer"
                                    onClick={() => requestSort('codusu')}
                                >
                                    Usuario
                                    {sortConfig.key === 'codusu' && (
                                        <i className={`ml-1 fas fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider cursor-pointer"
                                    onClick={() => requestSort('nomusu')}
                                >
                                    Nombre
                                    {sortConfig.key === 'nomusu' && (
                                        <i className={`ml-1 fas fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Rol</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Último Acceso</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Acceso Web</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-4 text-center">Cargando...</td></tr>
                            ) : paginatedData.map(user => {
                                const isVendedor = user.vendedor === 1;
                                const isAdmin = user.tipousu === 1 || user.tipousu === 0;
                                const roleLabel = isVendedor ? 'Vendedor' : (isAdmin ? 'Administrador' : 'Estándar');
                                const roleColor = isVendedor ? 'bg-green-100 text-green-800' : (isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800');

                                return (
                                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{user.codusu}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">{user.nomusu}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColor}`}>
                                                {roleLabel}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">
                                            {user.ultimoAcceso ? new Date(user.ultimoAcceso).toLocaleString('es-CO') : '--'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">
                                            {user.hasWebAccess ? (
                                                <span className="text-green-600 flex items-center gap-1">
                                                    <i className="fas fa-check-circle"></i> Habilitado
                                                </span>
                                            ) : (
                                                <span className="text-amber-600 flex items-center gap-1">
                                                    <i className="fas fa-exclamation-triangle"></i> Sin contraseña
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {user.activo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEditUser(user)}
                                                    className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-2 rounded-full hover:bg-indigo-100 transition-colors"
                                                    title="Editar"
                                                >
                                                    <i className="fas fa-edit"></i>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user)}
                                                    className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-full hover:bg-red-100 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <i className="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && (
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
                )}
            </div>

            <UserFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                userToEdit={userToEdit}
                onSuccess={handleSuccess}
            />
        </div>
    );
};

export default UsersPage;
