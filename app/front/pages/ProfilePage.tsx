import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../services/apiClient';

const ProfilePage: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [signature, setSignature] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (user?.firma) {
            setSignature(user.firma);
            setPreview(user.firma);
        }
    }, [user]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setPreview(base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveSignature = async () => {
        if (!preview) return;

        try {
            setLoading(true);
            setMessage(null);

            const response = await apiClient.updateSignature(preview);

            if (response.success) {
                setMessage({ type: 'success', text: 'Firma actualizada correctamente' });
                setSignature(preview);
                // Refresh global user context to sync signature across the app
                await refreshUser();
            } else {
                setMessage({ type: 'error', text: response.message || 'Error al guardar firma' });
            }
        } catch (error) {
            console.error('Error saving signature:', error);
            setMessage({ type: 'error', text: 'Error al conectar con el servidor' });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSignature = async () => {
        if (!confirm('¿Estás seguro de que quieres eliminar tu firma digital?')) return;

        try {
            setLoading(true);
            setMessage(null);

            const response = await apiClient.updateSignature(null);

            if (response.success) {
                setMessage({ type: 'success', text: 'Firma eliminada correctamente' });
                setSignature(null);
                setPreview(null);
                // Refresh global user context to remove signature from app state
                await refreshUser();
            } else {
                setMessage({ type: 'error', text: response.message || 'Error al eliminar firma' });
            }
        } catch (error) {
            console.error('Error deleting signature:', error);
            setMessage({ type: 'error', text: 'Error al conectar con el servidor' });
        } finally {
            setLoading(false);
        }
    };

    if (!user) return <div>Cargando perfil...</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Mi Perfil</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* User Info Card */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4 border-b pb-2">
                        Información Personal
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Usuario</label>
                            <div className="mt-1 text-slate-900 dark:text-white font-medium">{user.username}</div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Nombre</label>
                            <div className="mt-1 text-slate-900 dark:text-white font-medium">{user.nombre || `${user.primerNombre} ${user.primerApellido}`}</div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Rol</label>
                            <div className="mt-1">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {user.rol === 'admin' ? 'Administrador' : 'Vendedor/Estándar'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Signature Card */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4 border-b pb-2">
                        Firma Digital
                    </h2>

                    <div className="space-y-6">
                        <div className="bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 flex flex-col items-center justify-center min-h-[200px]">
                            {preview ? (
                                <img src={preview} alt="Firma" className="max-h-40 object-contain" />
                            ) : (
                                <div className="text-center text-slate-400">
                                    <i className="fas fa-signature text-4xl mb-2"></i>
                                    <p>Sin firma configurada</p>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Actualizar Firma (Imagen PNG/JPG)
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-slate-500
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-full file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-blue-50 file:text-blue-700
                                    hover:file:bg-blue-100
                                "
                            />
                        </div>

                        {message && (
                            <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                }`}>
                                {message.text}
                            </div>
                        )}

                        <button
                            onClick={handleSaveSignature}
                            disabled={loading || !preview}
                            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                                ${loading || !preview
                                    ? 'bg-slate-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                                } transition-colors`}
                        >
                            {loading ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>}
                            Guardar Firma
                        </button>

                        {signature && (
                            <button
                                onClick={handleDeleteSignature}
                                disabled={loading}
                                className="w-full justify-center py-2 px-4 border border-red-300 dark:border-red-700 rounded-md shadow-sm text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-transparent hover:bg-red-50 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors flex items-center"
                            >
                                <i className="fas fa-trash-alt mr-2"></i>
                                Eliminar Firma
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
