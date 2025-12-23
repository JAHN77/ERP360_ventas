import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import Card from '../components/ui/Card';
import InventoryConceptForm from '../components/inventory/InventoryConceptForm';

interface Concepto {
    codcon: string;
    nomcon: string;
    tipcon: string;
    codcue: string;
    nuecon: boolean;
    consys: boolean;
    contable: boolean;
    inicializa_inventario: boolean;
}

import { useTable } from '../hooks/useTable';
import TablePagination from '../components/ui/TablePagination';
import { useNotifications } from '../hooks/useNotifications';
import { ConfirmModal } from '../components/ui/ConfirmModal';

const InventoryConceptsPage: React.FC = () => {
    console.log('Rendering InventoryConceptsPage'); // DEBUG

    const [conceptos, setConceptos] = useState<Concepto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConcept, setEditingConcept] = useState<Concepto | null>(null);
    const { addNotification } = useNotifications();
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, codcon: '' });

    // Use standard table hook
    const {
        paginatedData,
        currentPage,
        totalPages,
        nextPage,
        prevPage,
        goToPage,
        totalItems,
        rowsPerPage,
        setRowsPerPage,
        searchTerm,
        handleSearch
    } = useTable({
        data: conceptos,
        searchKeys: ['codcon', 'nomcon'],
        initialRowsPerPage: 10
    });

    const canNextPage = currentPage < totalPages;
    const canPreviousPage = currentPage > 1;

    const fetchConceptos = async () => {
        console.log('Fetching conceptos...'); // DEBUG
        setLoading(true);
        try {
            console.log('Calling apiClient.getInventoryConcepts'); // DEBUG
            const response = await apiClient.getInventoryConcepts();
            console.log('Response:', response); // DEBUG
            if (response.success) {
                setConceptos((response.data as any) || []); // Ensure array
            } else {
                setError('Error cargando conceptos: ' + (response.message || 'Desconocido'));
            }
        } catch (err) {
            console.error('Fetch error:', err); // DEBUG
            setError('Error de conexión o servidor');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConceptos();
    }, []);

    const handleCreate = () => {
        setEditingConcept(null);
        setIsModalOpen(true);
    };

    const handleEdit = (con: Concepto) => {
        setEditingConcept(con);
        setIsModalOpen(true);
    };

    const handleDeleteClick = (codcon: string) => {
        setConfirmModal({ isOpen: true, codcon });
    };

    const confirmDelete = async () => {
        try {
            const response = await apiClient.deleteInventoryConcept(confirmModal.codcon);
            if (response.success) {
                addNotification({ type: 'success', message: 'Concepto eliminado correctamente' });
                fetchConceptos();
            } else {
                addNotification({ type: 'error', message: 'Error al eliminar: ' + response.message });
            }
        } catch (err) {
            console.error(err);
            addNotification({ type: 'error', message: 'Error al eliminar el concepto' });
        }
    };

    const handleSave = async (data: any) => {
        try {
            let response;
            if (editingConcept) {
                response = await apiClient.updateInventoryConcept(editingConcept.codcon, data);
            } else {
                response = await apiClient.createInventoryConcept(data);
            }

            if (response.success) {
                addNotification({ type: 'success', message: editingConcept ? 'Concepto actualizado correctamente' : 'Concepto creado correctamente' });
                setIsModalOpen(false);
                fetchConceptos();
            } else {
                addNotification({ type: 'error', message: response.message || 'Error al guardar el concepto' });
            }
        } catch (err) {
            console.error(err);
            addNotification({ type: 'error', message: 'Error de conexión al guardar' });
        }
    };

    console.log('Current state:', { loading, error, conceptosCount: conceptos.length }); // DEBUG

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                        Gestión de Conceptos
                    </h1>
                    <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm">
                        Configura y administra los tipos de movimientos para el inventario.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search Field */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <i className="fas fa-search text-slate-400 group-focus-within:text-blue-500 transition-colors"></i>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar concepto..."
                            value={searchTerm}
                            onChange={handleSearch}
                            className="block w-full sm:w-64 pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm shadow-sm placeholder-slate-400
                                     focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                        />
                    </div>

                    {/* New Concept Button */}
                    <button
                        onClick={handleCreate}
                        className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-500/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] gap-2"
                    >
                        <i className="fas fa-plus"></i>
                        <span>Nuevo Concepto</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 animate-pulse">
                    <i className="fas fa-circle-notch fa-spin text-3xl mb-4 text-blue-500"></i>
                    <p>Cargando conceptos...</p>
                </div>
            ) : error ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <i className="fas fa-exclamation-circle text-xl"></i>
                        <span>{error}</span>
                    </div>
                    <button
                        onClick={fetchConceptos}
                        className="px-3 py-1 bg-white dark:bg-red-900/40 rounded text-sm font-medium hover:bg-red-50 transition-colors border border-red-100 dark:border-red-800"
                    >
                        Reintentar
                    </button>
                </div>
            ) : (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Código</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre del Concepto</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tipo</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cuenta Contable</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Contable</th>
                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {paginatedData.map((con) => (
                                    <tr
                                        key={con.codcon}
                                        className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors duration-150"
                                    >
                                        <td className="px-6 py-3">
                                            <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                                                {con.codcon}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                {con.nomcon}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${con.tipcon === 'E'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                                : 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
                                                }`}>
                                                <i className={`fas fa-circle text-[6px] ${con.tipcon === 'E' ? 'text-emerald-500' : 'text-rose-500'}`}></i>
                                                {con.tipcon === 'E' ? 'Entrada' : 'Salida'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            {con.codcue ? (
                                                <span className="text-sm font-mono text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                                    <i className="fas fa-hashtag text-slate-300 text-xs"></i>
                                                    {con.codcue}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">No asignada</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            {con.contable ? (
                                                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                                                    <i className="fas fa-check text-xs"></i>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600">
                                                    <i className="fas fa-minus text-xs"></i>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(con)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/20 dark:hover:text-blue-400 rounded transition-all"
                                                    title="Editar registro"
                                                >
                                                    <i className="fas fa-pen text-sm"></i>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(con.codcon)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 dark:hover:text-red-400 rounded transition-all"
                                                    title="Eliminar registro"
                                                >
                                                    <i className="fas fa-trash-alt text-sm"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {paginatedData.length === 0 && (
                                    <tr>
                                        <td colSpan={6}>
                                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                                    <i className="fas fa-search text-xl text-slate-300"></i>
                                                </div>
                                                <p className="text-base font-medium text-slate-600 dark:text-slate-300">No se encontraron conceptos</p>
                                                <p className="text-xs">Intenta con otros términos de búsqueda o añade uno nuevo.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-2">
                        <TablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={goToPage}
                            canPreviousPage={canPreviousPage}
                            canNextPage={canNextPage}
                            onPreviousPage={prevPage}
                            onNextPage={nextPage}
                            totalItems={totalItems}
                            rowsPerPage={rowsPerPage}
                            setRowsPerPage={setRowsPerPage}
                        />
                    </div>
                </Card>
            )}

            {isModalOpen && (
                <InventoryConceptForm
                    initialData={editingConcept}
                    existingConcepts={conceptos}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                />
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmDelete}
                title="Eliminar Concepto"
                message="¿Está seguro de eliminar este concepto? Esta acción no se puede deshacer."
                confirmText="Eliminar"
                isDestructive={true}
            />
        </div>
    );
};

export default InventoryConceptsPage;
