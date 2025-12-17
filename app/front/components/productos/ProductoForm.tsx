import React, { useState, useEffect, useCallback } from 'react';
import { InvProducto } from '../../types';
import { isNotEmpty, isPositiveNumber, isNonNegativeInteger } from '../../utils/validation';

interface ProductoFormProps {
  initialData?: InvProducto | null;
  onSubmit: (data: Omit<InvProducto, 'id'>) => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const getInitialFormState = (data?: InvProducto | null): Omit<InvProducto, 'id'> => ({
  nombre: data?.nombre || '',
  descripcion: data?.descripcion || '',
  idCategoria: data?.idCategoria || 1, // Default a categoría 1
  idSublineas: data?.idSublineas || 1,
  idTipoProducto: data?.idTipoProducto || 1,
  precio: data?.precio || 0,
  ultimoCosto: data?.ultimoCosto || 0,
  controlaExistencia: data?.controlaExistencia || 0,
  unidadMedida: data?.unidadMedida || 'Unidad',
  aplicaIva: data?.aplicaIva ?? true,
  // FIX: Add missing properties to satisfy Omit<InvProducto, 'id'> type
  codins: data?.codins || '',
  nomins: data?.nomins || data?.nombre || '',
  codigoLinea: data?.codigoLinea || '01',
  codigoSublinea: data?.codigoSublinea || '01',
  codigoMedida: data?.codigoMedida || 'UND',
  tasaIva: data?.tasaIva ?? (data?.aplicaIva ? 19 : 0),
  costoPromedio: data?.costoPromedio || 0,
  referencia: data?.referencia,
  karins: data?.karins ?? false,
  activo: data?.activo ?? true,
  idMedida: data?.idMedida,
  idMarca: data?.idMarca,
});

interface Errors {
  [key: string]: string;
}

const ProductoForm: React.FC<ProductoFormProps> = ({ initialData, onSubmit, onCancel, onDirtyChange }) => {
  const [formData, setFormData] = useState<Omit<InvProducto, 'id'>>(getInitialFormState(initialData));
  const [errors, setErrors] = useState<Errors>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const validate = useCallback(() => {
    const newErrors: Errors = {};

    if (!isNotEmpty(formData.nombre)) newErrors.nombre = 'El nombre del producto es obligatorio.';
    if (!isPositiveNumber(formData.precio)) newErrors.precio = 'El precio debe ser un número mayor a cero.';
    if (!isNonNegativeInteger(formData.controlaExistencia)) newErrors.controlaExistencia = 'El stock debe ser un número entero no negativo.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  useEffect(() => {
    if (hasSubmitted) {
      validate();
    }
  }, [formData, hasSubmitted, validate]);

  useEffect(() => {
    setFormData(getInitialFormState(initialData));
    setHasSubmitted(false);
    setErrors({});
  }, [initialData]);

  useEffect(() => {
    if (onDirtyChange) {
      const isDirty = JSON.stringify(formData) !== JSON.stringify(getInitialFormState(initialData));
      onDirtyChange(isDirty);
    }
  }, [formData, initialData, onDirtyChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target;
    const { name, type } = target;
    const value = type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;

    if (name === 'precio' || name === 'ultimoCosto' || name === 'controlaExistencia') {
      const numericValue = value.replace(/[^0-9]/g, '');
      const num = numericValue === '' ? 0 : parseInt(numericValue, 10);
      if (name === 'precio') {
        setFormData(prev => ({ ...prev, precio: num, ultimoCosto: num }));
      } else {
        setFormData(prev => ({ ...prev, [name]: num }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    if (validate()) {
      // FIX: Synchronize derived fields before submitting
      onSubmit({
        ...formData,
        nomins: formData.nombre,
        tasaIva: formData.aplicaIva ? 19 : 0,
        karins: !!formData.controlaExistencia && formData.controlaExistencia > 0,
        precio: Number(formData.precio),
        controlaExistencia: Number(formData.controlaExistencia),
        ultimoCosto: Number(formData.ultimoCosto),
        idCategoria: Number(formData.idCategoria),
        idSublineas: Number(formData.idSublineas),
        idTipoProducto: Number(formData.idTipoProducto),
      });
    }
  };

  const getIconClass = (iconName: string) => `fas ${iconName} text-slate-400 dark:text-slate-500`;

  const InputWrapper: React.FC<{ label: string; icon: string; children: React.ReactNode }> = ({ label, icon, children }) => (
    <div className="group">
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 transition-colors group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400">
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <i className={getIconClass(icon)}></i>
        </div>
        {children}
      </div>
    </div>
  );

  const inputBaseClasses = "block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 dark:text-white placeholder-slate-400";

  const getInputClassesLocal = (fieldName: keyof Omit<InvProducto, 'id'>) => `
    ${inputBaseClasses}
    ${errors[fieldName] ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500 bg-red-50 dark:bg-red-900/10' : ''}
  `;

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in-up">
      {/* Sección: Información Principal */}
      <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-700 pb-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <i className="fas fa-info text-blue-600 dark:text-blue-400 text-sm"></i>
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Información General</h3>
        </div>

        <div className="mb-6">
          <InputWrapper label="Nombre del Producto" icon="fa-box">
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              className={getInputClassesLocal('nombre')}
              placeholder="Ej. Laptop HP Pavilion 15"
            />
          </InputWrapper>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Descripción</label>
          <div className="relative">
            <div className="absolute top-3 left-3 pointer-events-none">
              <i className="fas fa-align-left text-slate-400 dark:text-slate-500"></i>
            </div>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows={3}
              className={`${getInputClassesLocal('descripcion')} pl-10`}
              placeholder="Detalles técnicos, características importantes..."
            />
          </div>
        </div>
      </div>

      {/* Sección: Inventario y Precios */}
      <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-700 pb-3">
          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <i className="fas fa-dollar-sign text-green-600 dark:text-green-400 text-sm"></i>
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Inventario y Precios</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InputWrapper label="Precio de Venta" icon="fa-tag">
            <input
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              name="precio"
              value={formData.precio}
              onChange={handleChange}
              className={getInputClassesLocal('precio')}
              placeholder="0"
            />
          </InputWrapper>

          <InputWrapper label="Stock Inicial" icon="fa-boxes">
            <input
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              name="controlaExistencia"
              value={formData.controlaExistencia}
              onChange={handleChange}
              className={getInputClassesLocal('controlaExistencia')}
              placeholder="0"
            />
          </InputWrapper>

          <InputWrapper label="Unidad de Medida" icon="fa-ruler">
            <select
              name="unidadMedida"
              value={formData.unidadMedida}
              onChange={handleChange}
              className={`${getInputClassesLocal('unidadMedida')} appearance-none`}
            >
              <option>Unidad</option>
              <option>Kg</option>
              <option>Litro</option>
              <option>Metro</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              <i className="fas fa-chevron-down text-xs"></i>
            </div>
          </InputWrapper>
        </div>

        <div className="mt-6 flex items-center">
          <label className="relative inline-flex items-center cursor-pointer group">
            <input
              type="checkbox"
              name="aplicaIva"
              checked={formData.aplicaIva}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">
              Aplica IVA (19%)
            </span>
          </label>
        </div>
      </div>

      {Object.keys(errors).length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <i className="fas fa-exclamation-circle text-red-500"></i>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">Por favor, corrige los siguientes errores:</p>
              <ul className="mt-1 list-disc list-inside text-sm text-red-600 dark:text-red-400">
                {Object.values(errors).map((err, idx) => <li key={idx}>{err}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="pt-6 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white transition-all duration-200 shadow-sm"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-xl hover:from-blue-700 hover:to-blue-600 focus:ring-4 focus:ring-blue-500/30 transition-all duration-200 shadow-lg shadow-blue-500/30 flex items-center transform active:scale-95"
        >
          <i className="fas fa-save mr-2"></i>
          Guardar Producto
        </button>
      </div>
    </form>
  );
};

export default ProductoForm;