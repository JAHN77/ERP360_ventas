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
        stock?: number;
        referencia?: string;
        idTipoProducto: number;
    } | null;
}

// Componentes extraídos para evitar problemas de foco
const InputField = ({
    label,
    name,
    value,
    onChange,
    error,
    type = 'text',
    required = false,
    placeholder = '',
    icon,
    disabled = false,
    step,
    min
}: {
    label: string;
    name: string;
    value: string | number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string;
    type?: string;
    required?: boolean;
    placeholder?: string;
    icon?: string;
    disabled?: boolean;
    step?: string;
    min?: string;
}) => (
    <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
            {icon && (
                <i className={`fas ${icon} absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500`}></i>
            )}
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                disabled={disabled}
                step={step}
                min={min}
                className={`w-full ${icon ? 'pl-10' : 'pl-3'} pr-3 py-2.5 border rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed ${error
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                    : 'border-slate-300 dark:border-slate-600'
                    }`}
                placeholder={placeholder}
            />
        </div>
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
);

const NewServiceProductModal: React.FC<NewServiceProductModalProps> = ({ isOpen, onClose, onSuccess, editData = null }) => {
    const { addNotification } = useNotifications();
    const [isSaving, setIsSaving] = useState(false);
    const isEditMode = !!editData;

    const [formData, setFormData] = useState({
        idTipoProducto: 1, // 1 = Producto
        nombre: '',
        referencia: '',
        unidadMedidaCodigo: '003', // Default 'Unidad'
        idCategoria: '',
        idSublineas: '',
        precio: '',
        stock: '',
        aplicaIva: true,
        controlaExistencia: true
    });

    const [categories, setCategories] = useState<any[]>([]);
    const [sublines, setSublines] = useState<any[]>([]);
    const [measures, setMeasures] = useState<any[]>([]);
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    // Cargar opciones
    useEffect(() => {
        const fetchOptions = async () => {
            setLoadingOptions(true);
            try {
                const [catsRes, measuresRes] = await Promise.all([
                    apiClient.request<any>('/categorias/lineas-sublineas'),
                    apiClient.getMedidas()
                ]);

                if (catsRes.success) setCategories(catsRes.data as any[]);
                if (measuresRes.success) setMeasures(measuresRes.data as any[]);
            } catch (error) {
                console.error('Error fetching options:', error);
            } finally {
                setLoadingOptions(false);
            }
        };
        fetchOptions();
    }, []);

    // Cargar sublineas
    useEffect(() => {
        if (formData.idCategoria) {
            const selectedCat = categories.find(c => c.codline === formData.idCategoria);
            setSublines(selectedCat?.sublineas || []);
        } else {
            setSublines([]);
        }
    }, [formData.idCategoria, categories]);

    // Resetear formulario
    useEffect(() => {
        if (isOpen) {
            if (editData) {
                setFormData({
                    idTipoProducto: 1,
                    nombre: editData.nombre,
                    referencia: editData.referencia || '',
                    unidadMedidaCodigo: (editData as any).unidadMedidaCodigo || '003',
                    idCategoria: (editData as any).idCategoria || '',
                    idSublineas: (editData as any).idSublineas || '',
                    precio: String(editData.precio || 0),
                    stock: String((editData as any).stock || 0),
                    aplicaIva: editData.aplicaIva,
                    controlaExistencia: (editData as any).controlaExistencia ?? true
                });
            } else {
                setFormData({
                    idTipoProducto: 1,
                    nombre: '',
                    referencia: '',
                    unidadMedidaCodigo: '003',
                    idCategoria: '',
                    idSublineas: '',
                    precio: '',
                    stock: '',
                    aplicaIva: true,
                    controlaExistencia: true
                });
            }
            setErrors({});
        }
    }, [isOpen, editData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const validate = () => {
        const newErrors: { [key: string]: string } = {};

        if (!formData.nombre.trim()) {
            newErrors.nombre = `El nombre es obligatorio`;
        }

        const precioVal = parseFloat(formData.precio);
        if (!formData.precio || isNaN(precioVal) || precioVal <= 0) {
            newErrors.precio = 'El precio debe ser mayor a cero';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setIsSaving(true);
        try {
            // Preparar payload simplificado pero compatible
            const payload = {
                nombre: formData.nombre,
                idTipoProducto: 1,
                precio: parseFloat(formData.precio),
                aplicaIva: formData.aplicaIva,
                unidadMedida: formData.unidadMedidaCodigo,
                stock: parseFloat(formData.stock) || 0,
                referencia: formData.referencia,
                controlaExistencia: formData.controlaExistencia ? 1 : 0,
                idSublineas: formData.idSublineas || '01',
                idCategoria: formData.idCategoria || '01',
                // Valores por defecto para campos no visibles
                precio_base: parseFloat(formData.precio),
                margen_venta: 0,
                tasa_descuento: 0,
                Precio_Venta: parseFloat(formData.precio),
                precio_lista: parseFloat(formData.precio),
                descripcion: ''
            };

            let response;
            if (isEditMode && editData?.id) {
                response = await apiClient.updateProducto(editData.id, payload);
            } else {
                response = await apiClient.createProducto(payload);
            }

            if (response.success) {
                addNotification({
                    type: 'success',
                    message: `Producto ${isEditMode ? 'actualizado' : 'creado'} exitosamente`
                });
                onSuccess?.();
                onClose();
            } else {
                addNotification({
                    type: 'error',
                    message: response.message || `Error al ${isEditMode ? 'actualizar' : 'crear'} el producto`
                });
            }
        } catch (error: any) {
            console.error('Error saving product:', error);
            addNotification({
                type: 'error',
                message: error.message || 'Error de conexión'
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${isEditMode ? 'Editar' : 'Crear'} Producto Simple`} size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">

                {/* 1. Información Principal */}
                <div className="space-y-4">
                    <InputField
                        label="Nombre del Producto"
                        name="nombre"
                        value={formData.nombre}
                        onChange={handleChange}
                        required
                        placeholder="Ej. Llanta Todo Terreno"
                        icon="fa-box"
                        error={errors.nombre}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <InputField
                            label="Referencia"
                            name="referencia"
                            value={formData.referencia}
                            onChange={handleChange}
                            placeholder="REF-123"
                            icon="fa-barcode"
                        />

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                                Unidad de Medida
                            </label>
                            <select
                                name="unidadMedidaCodigo"
                                value={formData.unidadMedidaCodigo}
                                onChange={handleChange}
                                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                            >
                                {measures.length > 0 ? (
                                    measures.map(m => (
                                        <option key={m.codigo} value={m.codigo}>{m.nombre}</option>
                                    ))
                                ) : (
                                    <option value="003">Unidad</option>
                                )}
                            </select>
                        </div>
                    </div>
                </div>

                {/* 2. Stock y Categoría */}
                <div className="grid grid-cols-2 gap-4">
                    <InputField
                        label="Stock Inicial"
                        name="stock"
                        value={formData.stock}
                        onChange={handleChange}
                        type="number"
                        min="0"
                        placeholder="0"
                        icon="fa-cubes"
                    />

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                            Categoría
                        </label>
                        <select
                            name="idCategoria"
                            value={formData.idCategoria}
                            onChange={handleChange}
                            className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        >
                            <option value="">Seleccione...</option>
                            {categories.map(cat => (
                                <option key={cat.codline} value={cat.codline}>{cat.nomline}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 3. Precio e impuestos */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 space-y-4">
                    <div className="grid grid-cols-2 gap-4 items-start">
                        <InputField
                            label="Precio de Venta"
                            name="precio"
                            value={formData.precio}
                            onChange={handleChange}
                            required
                            type="number"
                            min="0"
                            placeholder="0.00"
                            icon="fa-dollar-sign"
                            error={errors.precio}
                        />

                        <div className="pt-8">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="aplicaIva"
                                    checked={formData.aplicaIva}
                                    onChange={handleChange}
                                    className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                />
                                <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Aplica IVA (19%)
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-5 py-2.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-md flex items-center gap-2 text-sm"
                    >
                        {isSaving ? (
                            <><i className="fas fa-spinner fa-spin"></i> Guardando...</>
                        ) : (
                            <><i className="fas fa-check"></i> Guardar Producto</>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default NewServiceProductModal;
