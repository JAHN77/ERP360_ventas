import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import Modal from '../ui/Modal';

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    userToEdit?: any;
}

const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, onSuccess, userToEdit }) => {
    const [formData, setFormData] = useState({
        codusu: '',
        nomusu: '',
        password: '',
        confirmPassword: '',
        tipousu: 0, // 0: Vendedor, 1: Admin
        activo: 1
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (userToEdit) {
            setFormData({
                codusu: userToEdit.codusu || '',
                nomusu: userToEdit.nomusu || '',
                password: '',
                confirmPassword: '',
                tipousu: userToEdit.tipousu || 0,
                activo: userToEdit.activo !== undefined ? userToEdit.activo : 1
            });
        } else {
            setFormData({
                codusu: '',
                nomusu: '',
                password: '',
                confirmPassword: '',
                tipousu: 0,
                activo: 1
            });
        }
        setError('');
    }, [userToEdit, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.codusu || !formData.nomusu) {
            setError('Usuario y Nombre son obligatorios');
            return;
        }

        if (!userToEdit && !formData.password) {
            setError('La contraseña es obligatoria para nuevos usuarios');
            return;
        }

        if (userToEdit && !userToEdit.hasWebAccess && !formData.password) {
            setError('Debe asignar una contraseña para habilitar el acceso web');
            return;
        }

        if (formData.password && formData.password !== formData.confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setLoading(true);

        try {
            const payload: any = {
                codusu: formData.codusu,
                nomusu: formData.nomusu,
                tipousu: parseInt(formData.tipousu as any),
                activo: formData.activo ? 1 : 0
            };

            if (formData.password) {
                payload.password = formData.password;
            }

            if (userToEdit) {
                await apiClient.updateUser(userToEdit.id, payload);
            } else {
                await apiClient.createUser(payload);
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al guardar usuario');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={userToEdit ? 'Editar Usuario' : 'Nuevo Usuario'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Usuario (Login) *</label>
                    <input
                        type="text"
                        value={formData.codusu}
                        onChange={e => setFormData({ ...formData, codusu: e.target.value.toUpperCase() })}
                        className="mt-1 block w-full rounded-md border border-slate-400 bg-slate-50 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-600 focus:bg-white focus:ring-1 focus:ring-blue-600 dark:bg-slate-700 dark:border-slate-500 dark:text-white sm:text-sm"
                        disabled={!!userToEdit} // Usually PK or unique identifier
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre Completo *</label>
                    <input
                        type="text"
                        value={formData.nomusu}
                        onChange={e => setFormData({ ...formData, nomusu: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-slate-400 bg-slate-50 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-600 focus:bg-white focus:ring-1 focus:ring-blue-600 dark:bg-slate-700 dark:border-slate-500 dark:text-white sm:text-sm"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {!userToEdit ? 'Contraseña *' : (userToEdit.hasWebAccess ? 'Cambiar Contraseña (Opcional)' : 'Crear Contraseña Web *')}
                        </label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            className="mt-1 block w-full rounded-md border border-slate-400 bg-slate-50 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-600 focus:bg-white focus:ring-1 focus:ring-blue-600 dark:bg-slate-700 dark:border-slate-500 dark:text-white sm:text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Confirmar Contraseña</label>
                        <input
                            type="password"
                            value={formData.confirmPassword}
                            onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                            className="mt-1 block w-full rounded-md border border-slate-400 bg-slate-50 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-600 focus:bg-white focus:ring-1 focus:ring-blue-600 dark:bg-slate-700 dark:border-slate-500 dark:text-white sm:text-sm"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Rol</label>
                    <select
                        value={formData.tipousu}
                        onChange={e => setFormData({ ...formData, tipousu: parseInt(e.target.value) })}
                        className="mt-1 block w-full rounded-md border border-slate-400 bg-slate-50 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-600 focus:bg-white focus:ring-1 focus:ring-blue-600 dark:bg-slate-700 dark:border-slate-500 dark:text-white sm:text-sm"
                    >
                        <option value={2}>Vendedor / Estándar (2)</option>
                        <option value={1}>Administrador (1)</option>
                        <option value={0}>Super Admin / Gerente (0)</option>
                    </select>
                </div>

                <div className="flex items-center">
                    <input
                        type="checkbox"
                        checked={formData.activo === 1}
                        onChange={e => setFormData({ ...formData, activo: e.target.checked ? 1 : 0 })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-slate-900 dark:text-slate-300">
                        Usuario Activo
                    </label>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {loading ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default UserFormModal;
