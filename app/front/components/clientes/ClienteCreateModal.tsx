import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { apiCreateCliente } from '../../services/apiClient';
import { useNotifications } from '../../hooks/useNotifications';
import { useData } from '../../hooks/useData';

interface ClienteCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const ClienteCreateModal: React.FC<ClienteCreateModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { addNotification } = useNotifications();
    const { ciudades, refreshData } = useData();
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        numeroDocumento: '',
        razonSocial: '',
        email: '',
        telefono: '',
        direccion: '',
        ciudad: '',
        coddane: '',
        tipoDocumento: '13',
        celular: '',
        diasCredito: 0,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validaciones básicas
        if (!formData.numeroDocumento || !formData.razonSocial || !formData.email || !formData.telefono || !formData.direccion || !formData.ciudad || !formData.coddane) {
            addNotification({
                type: 'error',
                message: 'Por favor complete todos los campos obligatorios (*)',
            });
            return;
        }

        setIsLoading(true);

        try {
            const response = await apiCreateCliente(formData);

            if (response.success) {
                addNotification({
                    type: 'success',
                    message: 'Cliente creado exitosamente',
                });
                await refreshData(); // Recargar datos para ver el nuevo cliente
                onSuccess();
                onClose();
                // Reset form
                setFormData({
                    numeroDocumento: '',
                    razonSocial: '',
                    email: '',
                    telefono: '',
                    direccion: '',
                    ciudad: '',
                    coddane: '',
                    tipoDocumento: '13',
                    celular: '',
                    diasCredito: 0,
                });
            } else {
                addNotification({
                    type: 'error',
                    message: response.message || 'Error al crear el cliente',
                });
            }
        } catch (error: any) {
            addNotification({
                type: 'error',
                message: error.message || 'Ocurrió un error inesperado',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Crear Nuevo Cliente"
            size="lg"
        >
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tipo Documento */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Tipo Documento *
                        </label>
                        <select
                            name="tipoDocumento"
                            value={formData.tipoDocumento}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                            required
                        >
                            <option value="13">Cédula de Ciudadanía (13)</option>
                            <option value="31">NIT (31)</option>
                        </select>
                    </div>

                    {/* Identificación */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Número de Identificación / NIT *
                        </label>
                        <input
                            type="text"
                            name="numeroDocumento"
                            value={formData.numeroDocumento}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                            placeholder="Ej: 900123456"
                            required
                        />
                    </div>

                    {/* Nombre / Razón Social */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Nombre / Razón Social *
                        </label>
                        <input
                            type="text"
                            name="razonSocial"
                            value={formData.razonSocial}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                            placeholder="Ej: Empresa S.A.S"
                            required
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Correo Electrónico *
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                            placeholder="correo@ejemplo.com"
                            required
                        />
                    </div>

                    {/* Teléfono */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Teléfono *
                        </label>
                        <input
                            type="text"
                            name="telefono"
                            value={formData.telefono}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                            placeholder="Ej: 6011234567"
                            required
                        />
                    </div>

                    {/* Celular */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Celular
                        </label>
                        <input
                            type="text"
                            name="celular"
                            value={formData.celular}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                            placeholder="Ej: 3001234567"
                        />
                    </div>

                    {/* Dirección */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Dirección *
                        </label>
                        <input
                            type="text"
                            name="direccion"
                            value={formData.direccion}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                            placeholder="Ej: Cra 1 # 2-3"
                            required
                        />
                    </div>

                    {/* Ciudad */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Ciudad *
                        </label>
                        <input
                            type="text"
                            name="ciudad"
                            value={formData.ciudad}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                            placeholder="Ej: Bogotá"
                            required
                        />
                    </div>

                    {/* Código DANE */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Código DANE *
                        </label>
                        <input
                            type="text"
                            name="coddane"
                            value={formData.coddane}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                            placeholder="Ej: 11001"
                            required
                        />
                    </div>

                    {/* Días Crédito */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Días de Crédito
                        </label>
                        <input
                            type="number"
                            name="diasCredito"
                            value={formData.diasCredito}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                            min="0"
                        />
                    </div>

                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                        disabled={isLoading}
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i>
                                Guardando...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-save"></i>
                                Guardar Cliente
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ClienteCreateModal;
