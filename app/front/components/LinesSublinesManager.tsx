import React, { useEffect, useState } from 'react';
import {
    fetchLinesWithSublines,
    apiCreateLine,
    apiUpdateLine,
    apiDeleteLine,
    apiCreateSubline,
    apiUpdateSubline,
    apiDeleteSubline
} from '../services/apiClient';
import Modal from './ui/Modal';
import { ConfirmModal } from './ui/ConfirmModal';
import { useNotifications } from '../hooks/useNotifications';

interface Subline {
    codsub: string;
    codline: string;
    nomsub: string;
}

interface Line {
    codline: string;
    nomline: string;
    controla_servicios: number;
    tasamayor: number;
    estado: number;
    sublineas: Subline[];
}

const LinesSublinesManager: React.FC = () => {
    const [lines, setLines] = useState<Line[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedLine, setExpandedLine] = useState<string | null>(null);

    // Modals state
    const [isLineModalOpen, setIsLineModalOpen] = useState(false);
    const [isSublineModalOpen, setIsSublineModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Editing state
    const [editingLine, setEditingLine] = useState<Line | null>(null);
    const [editingSubline, setEditingSubline] = useState<Subline | null>(null);
    const [targetDelete, setTargetDelete] = useState<{ type: 'line' | 'subline', id: string, subId?: string } | null>(null);

    // Form data
    const [lineFormData, setLineFormData] = useState({ codline: '', nomline: '', controla_servicios: false });
    const [sublineFormData, setSublineFormData] = useState({ codsub: '', nomsub: '', parentLineId: '' });

    const { addNotification } = useNotifications();

    const showNotification = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => {
        addNotification({
            message,
            type
        });
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const response = await fetchLinesWithSublines();
            if (response.success && response.data) {
                setLines(response.data as Line[]);
                setError(null);
            } else {
                setError(response.message || 'Error al cargar líneas');
            }
        } catch (err: any) {
            setError(err.message || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenLineModal = (line?: Line) => {
        if (line) {
            setEditingLine(line);
            setLineFormData({
                codline: line.codline,
                nomline: line.nomline,
                controla_servicios: line.controla_servicios === 1
            });
        } else {
            setEditingLine(null);
            setLineFormData({ codline: '', nomline: '', controla_servicios: false });
        }
        setIsLineModalOpen(true);
    };

    const handleOpenSublineModal = (parentLineId: string, subline?: Subline) => {
        if (subline) {
            setEditingSubline(subline);
            setSublineFormData({
                codsub: subline.codsub,
                nomsub: subline.nomsub,
                parentLineId
            });
        } else {
            setEditingSubline(null);
            setSublineFormData({
                codsub: '',
                nomsub: '',
                parentLineId
            });
        }
        setIsSublineModalOpen(true);
    };

    const handleSaveLine = async () => {
        if (!lineFormData.codline || !lineFormData.nomline) {
            showNotification('Error', 'Código y nombre son obligatorios', 'error');
            return;
        }

        const payload = {
            codline: lineFormData.codline,
            nomline: lineFormData.nomline,
            controla_servicios: lineFormData.controla_servicios ? 1 : 0,
            tasamayor: 0,
            estado: 1
        };

        try {
            let res;
            if (editingLine) {
                res = await apiUpdateLine(editingLine.codline, payload);
            } else {
                res = await apiCreateLine(payload);
            }

            if (res.success) {
                showNotification('Éxito', res.message || 'Operación exitosa', 'success');
                setIsLineModalOpen(false);
                loadData();
            } else {
                showNotification('Error', res.message || 'Error al guardar', 'error');
            }
        } catch (error: any) {
            showNotification('Error', error.message, 'error');
        }
    };

    const handleSaveSubline = async () => {
        if (!sublineFormData.codsub || !sublineFormData.nomsub) {
            showNotification('Error', 'Código y nombre son obligatorios', 'error');
            return;
        }

        const payload = {
            codsub: sublineFormData.codsub,
            codline: sublineFormData.parentLineId,
            nomsub: sublineFormData.nomsub
        };

        try {
            let res;
            if (editingSubline) {
                res = await apiUpdateSubline(sublineFormData.parentLineId, editingSubline.codsub, payload);
            } else {
                res = await apiCreateSubline(payload);
            }

            if (res.success) {
                showNotification('Éxito', res.message || 'Operación exitosa', 'success');
                setIsSublineModalOpen(false);
                loadData();
            } else {
                showNotification('Error', res.message || 'Error al guardar', 'error');
            }
        } catch (error: any) {
            showNotification('Error', error.message, 'error');
        }
    };

    const handleDeleteClick = (type: 'line' | 'subline', id: string, subId?: string) => {
        setTargetDelete({ type, id, subId });
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!targetDelete) return;

        try {
            let res;
            if (targetDelete.type === 'line') {
                res = await apiDeleteLine(targetDelete.id);
            } else {
                if (!targetDelete.subId) return;
                res = await apiDeleteSubline(targetDelete.id, targetDelete.subId); // id is lineId here
            }

            if (res.success) {
                showNotification('Éxito', res.message || 'Eliminado correctamente', 'success');
                loadData();
            } else {
                showNotification('Error', res.message || 'Error al eliminar', 'error');
            }
        } catch (error: any) {
            showNotification('Error', error.message, 'error');
        } finally {
            setIsDeleteModalOpen(false);
            setTargetDelete(null);
        }
    };

    if (loading) return <div className="p-8 text-center"><i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i><p className="mt-2 text-slate-500">Cargando líneas...</p></div>;
    if (error) return <div className="p-8 text-center text-red-500"><i className="fas fa-exclamation-triangle mr-2"></i>{error}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Gestión de Líneas y Sublíneas</h2>
                <button
                    onClick={() => handleOpenLineModal()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors text-sm font-medium flex items-center gap-2"
                >
                    <i className="fas fa-plus"></i> Nueva Línea
                </button>
            </div>

            <div className="space-y-4">
                {lines.map(line => (
                    <div key={line.codline} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow">
                        <div
                            className="p-4 flex items-center justify-between cursor-pointer bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                            onClick={() => setExpandedLine(expandedLine === line.codline ? null : line.codline)}
                        >
                            <div className="flex items-center gap-4">
                                <i className={`fas fa-chevron-right transition-transform text-slate-400 ${expandedLine === line.codline ? 'rotate-90' : ''}`}></i>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">{line.codline}</span>
                                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">{line.nomline}</h3>
                                    </div>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                                        {line.sublineas.length} sublíneas • {line.controla_servicios ? 'Controla servicios' : 'Estándar'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <button
                                    onClick={() => handleOpenLineModal(line)}
                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                    title="Editar línea"
                                >
                                    <i className="fas fa-edit"></i>
                                </button>
                                <button
                                    onClick={() => handleDeleteClick('line', line.codline)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                    title="Eliminar línea"
                                >
                                    <i className="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>

                        {expandedLine === line.codline && (
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-fade-in">
                                <div className="flex justify-between items-center mb-4 pl-8">
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sublíneas asociadas</h4>
                                    <button
                                        onClick={() => handleOpenSublineModal(line.codline)}
                                        className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md transition-colors flex items-center gap-1"
                                    >
                                        <i className="fas fa-plus text-[10px]"></i> Agregar Sublínea
                                    </button>
                                </div>

                                {line.sublineas.length === 0 ? (
                                    <div className="pl-8 text-sm text-slate-400 italic py-2">No hay sublíneas registradas.</div>
                                ) : (
                                    <div className="pl-8 overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900/50">
                                                <tr>
                                                    <th className="px-4 py-2 w-24">Código</th>
                                                    <th className="px-4 py-2">Nombre</th>
                                                    <th className="px-4 py-2 w-24 text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                {line.sublineas.map(sub => (
                                                    <tr key={`${sub.codline}-${sub.codsub}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                        <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">{sub.codsub}</td>
                                                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300">{sub.nomsub}</td>
                                                        <td className="px-4 py-2 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleOpenSublineModal(line.codline, sub)}
                                                                    className="text-slate-400 hover:text-blue-500 transition-colors"
                                                                >
                                                                    <i className="fas fa-pencil-alt"></i>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteClick('subline', line.codline, sub.codsub)}
                                                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                                                >
                                                                    <i className="fas fa-trash-alt"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {lines.length === 0 && !loading && (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                        <i className="fas fa-layer-group text-4xl text-slate-300 mb-3"></i>
                        <p className="text-slate-500">No hay líneas registradas.</p>
                        <button onClick={() => handleOpenLineModal()} className="mt-4 text-blue-600 hover:underline">Crear la primera línea</button>
                    </div>
                )}
            </div>

            {/* Modal de Línea */}
            <Modal
                isOpen={isLineModalOpen}
                onClose={() => setIsLineModalOpen(false)}
                title={editingLine ? 'Editar Línea' : 'Nueva Línea'}
                size="md"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Código</label>
                        <input
                            type="text"
                            value={lineFormData.codline}
                            onChange={(e) => setLineFormData({ ...lineFormData, codline: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="Ej. 01"
                            disabled={!!editingLine} // No permitir editar código
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre</label>
                        <input
                            type="text"
                            value={lineFormData.nomline}
                            onChange={(e) => setLineFormData({ ...lineFormData, nomline: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="Ej. Electrodomésticos"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="controlaServicios"
                            checked={lineFormData.controla_servicios}
                            onChange={(e) => setLineFormData({ ...lineFormData, controla_servicios: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="controlaServicios" className="text-sm text-slate-700 dark:text-slate-300 select-none">
                            Controla Servicios
                        </label>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={() => setIsLineModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveLine}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
                        >
                            Guardar
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal de Sublínea */}
            <Modal
                isOpen={isSublineModalOpen}
                onClose={() => setIsSublineModalOpen(false)}
                title={editingSubline ? 'Editar Sublínea' : 'Nueva Sublínea'}
                size="md"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Código</label>
                        <input
                            type="text"
                            value={sublineFormData.codsub}
                            onChange={(e) => setSublineFormData({ ...sublineFormData, codsub: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="Ej. 001"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre</label>
                        <input
                            type="text"
                            value={sublineFormData.nomsub}
                            onChange={(e) => setSublineFormData({ ...sublineFormData, nomsub: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="Ej. Televisores"
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={() => setIsSublineModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveSubline}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
                        >
                            Guardar
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal de Confirmación */}
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title={targetDelete?.type === 'line' ? 'Eliminar Línea' : 'Eliminar Sublínea'}
                message={`¿Estás seguro de que deseas eliminar esta ${targetDelete?.type === 'line' ? 'línea' : 'sublínea'}? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
            />
        </div>
    );
};

export default LinesSublinesManager;
