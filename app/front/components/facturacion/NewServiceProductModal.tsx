import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { useNotifications } from '../../hooks/useNotifications';
import { apiClient } from '../../services/apiClient';

interface NewServiceProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    editData?: {
        id: string | number;
        codigo: string;
        nombre: string;
        precio: number;
        aplicaIva: boolean;
        referencia?: string;
        idTipoProducto: number;
    } | null;
}


const NewServiceProductModal: React.FC<NewServiceProductModalProps> = ({ isOpen, onClose, onSuccess, editData = null }) => {
    const { addNotification } = useNotifications();
    const [isSaving, setIsSaving] = useState(false);
    const isEditMode = !!editData;

    const [formData, setFormData] = useState({
        idTipoProducto: 2, // 2 = Servicio por defecto
        nombre: '',
        precio: '',
        aplicaIva: true,
        referencia: '',
        unidadMedida: 'Unidad'
    });

    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    // Reset form when modal opens/closes or editData changes
    useEffect(() => {
        if (isOpen) {
            if (editData) {
                // Edit mode: populate with existing data
                setFormData({
                    idTipoProducto: editData.idTipoProducto,
                    nombre: editData.nombre,
                    precio: String(editData.precio),
                    aplicaIva: editData.aplicaIva,
                    referencia: editData.referencia || '',
                    unidadMedida: (editData as any).unidadMedida || 'Unidad'
                });
            } else {
                // Create mode: reset to defaults
                setFormData({
                    idTipoProducto: 2,
                    nombre: '',
                    precio: '',
                    aplicaIva: true,
                    referencia: '',
                    unidadMedida: 'Unidad'
                });
            }
            setErrors({});
        }
    }, [isOpen, editData]);

    const validate = () => {
        const newErrors: { [key: string]: string } = {};

        if (!formData.nombre.trim()) {
            newErrors.nombre = `El nombre es obligatorio`;
        }

        const precioNum = parseFloat(formData.precio);
        if (!formData.precio || isNaN(precioNum) || precioNum <= 0) {
            newErrors.precio = 'El precio debe ser mayor a cero';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) {
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                nombre: formData.nombre,
                idTipoProducto: formData.idTipoProducto,
                precio: parseFloat(formData.precio),
                aplicaIva: formData.aplicaIva,
                unidadMedida: formData.unidadMedida,
                referencia: formData.referencia || '',
                descripcion: '',
                controlaExistencia: 0,
                idSublineas: 1,
                idCategoria: 1
            };

            let response;
            if (isEditMode && editData) {
                // Update existing product/service
                response = await apiClient.updateProducto(editData.id, payload);
            } else {
                // Create new product/service
                response = await apiClient.createProductOrService(payload);
            }

            if (response.success) {
                addNotification({
                    message: `${formData.idTipoProducto === 2 ? 'Servicio' : 'Producto'} "${formData.nombre}" ${isEditMode ? 'actualizado' : 'creado'} exitosamente`,
                    type: 'success'
                });
                onSuccess?.();
                onClose();
            } else {
                throw new Error(response.message || 'Error al guardar');
            }
        } catch (error: any) {
            console.error('Error creating/updating service/product:', error);
            addNotification({
                message: error.message || 'Error al guardar el registro',
                type: 'error'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const isService = formData.idTipoProducto === 2;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${isEditMode ? 'Editar' : 'Crear Nuevo'} ${isService ? 'Servicio' : 'Producto'}`} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Toggle Tipo - Más compacto */}
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, idTipoProducto: 2 }))}
                        className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${isService
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                    >
                        <i className="fas fa-concierge-bell mr-1.5"></i>
                        Servicio
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, idTipoProducto: 1 }))}
                        className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${!isService
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                    >
                        <i className="fas fa-box mr-1.5"></i>
                        Producto
                    </button>
                </div>

                {/* Nombre */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                        Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="nombre"
                        value={formData.nombre}
                        onChange={handleChange}
                        autoFocus
                        className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm ${errors.nombre
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                            : 'border-slate-300 dark:border-slate-600'
                            }`}
                        placeholder={isService ? 'Ej. Consultoría IT' : 'Ej. Cable HDMI'}
                    />
                    {errors.nombre && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.nombre}</p>}
                </div>

                {/* Referencia y Unidad de Medida */}
                <div className="flex gap-3">
                    <div className="flex-[2]">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                            Referencia <span className="text-slate-400 text-xs font-normal">(Opcional)</span>
                        </label>
                        <input
                            type="text"
                            name="referencia"
                            value={formData.referencia}
                            onChange={handleChange}
                            placeholder="Ej. REF-001"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                            Unidad
                        </label>
                        <select
                            name="unidadMedida"
                            value={formData.unidadMedida}
                            onChange={(e) => setFormData(prev => ({ ...prev, unidadMedida: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm appearance-none"
                            style={{ backgroundImage: 'none' }} // Remove browser default arrow if needed, but standard select is safer
                        >
                            <option value="Unidad">Unidad</option>
                            <option value="Servicio">Servicio</option>
                            <option value="Kilo">Kilo</option>
                            <option value="Metro">Metro</option>
                            <option value="Litro">Litro</option>
                            <option value="Hora">Hora</option>
                            <option value="Día">Día</option>
                        </select>
                    </div>
                </div>

                {/* Precio e IVA en una línea */}
                <div className="flex gap-3 items-start">
                    <div className="flex-1">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                            Precio <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            name="precio"
                            value={formData.precio}
                            onChange={handleChange}
                            step="0.01"
                            min="0"
                            className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm ${errors.precio
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                                : 'border-slate-300 dark:border-slate-600'
                                }`}
                            placeholder="0.00"
                        />
                        {errors.precio && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.precio}</p>}
                    </div>

                    {/* Checkbox IVA más compacto */}
                    <div className="pt-8">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                name="aplicaIva"
                                checked={formData.aplicaIva}
                                onChange={handleChange}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <span className="ml-2 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                IVA 19%
                            </span>
                        </label>
                    </div>
                </div>

                {/* Botones más compactos */}
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/30 transition-all shadow-md flex items-center text-sm transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <>
                                <i className="fas fa-spinner fa-spin mr-1.5"></i>
                                {isEditMode ? 'Actualizando...' : 'Guardando...'}
                            </>
                        ) : (
                            <>
                                <i className={`fas ${isEditMode ? 'fa-save' : 'fa-plus'} mr-1.5`}></i>
                                {isEditMode ? 'Actualizar' : 'Crear'}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default NewServiceProductModal;
