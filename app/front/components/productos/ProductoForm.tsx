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
  
  const getInputClasses = (fieldName: keyof Omit<InvProducto, 'id'>) => `mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-2 dark:text-slate-200 ${
    errors[fieldName] ? 'border-red-500 dark:border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
  }`;

  const ErrorMessage: React.FC<{ fieldName: keyof Omit<InvProducto, 'id'> }> = ({ fieldName }) => (
    errors[fieldName] ? <p className="mt-1 text-xs text-red-500">{errors[fieldName]}</p> : null
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Nombre del Producto</label>
          <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} className={getInputClasses('nombre')} />
          <ErrorMessage fieldName="nombre" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Categoría</label>
          <select name="idCategoria" value={formData.idCategoria} onChange={handleChange} className={getInputClasses('idCategoria')}>
            <option value={1}>Tecnología</option>
            <option value={2}>Mobiliario</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Descripción</label>
        <textarea name="descripcion" value={formData.descripcion} onChange={handleChange} rows={3} className={getInputClasses('descripcion')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Precio de Venta</label>
          <input type="text" pattern="[0-9]*" inputMode="numeric" name="precio" value={formData.precio} onChange={handleChange} className={getInputClasses('precio')} />
          <ErrorMessage fieldName="precio" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Stock Actual</label>
          <input type="text" pattern="[0-9]*" inputMode="numeric" name="controlaExistencia" value={formData.controlaExistencia} onChange={handleChange} className={getInputClasses('controlaExistencia')} />
          <ErrorMessage fieldName="controlaExistencia" />
        </div>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Unidad de Medida</label>
          <select name="unidadMedida" value={formData.unidadMedida} onChange={handleChange} className={getInputClasses('unidadMedida')}>
            <option>Unidad</option>
            <option>Kg</option>
            <option>Litro</option>
          </select>
        </div>
         <div>
            <div className="flex items-center mt-6">
                <input
                    id="aplicaIva"
                    name="aplicaIva"
                    type="checkbox"
                    checked={formData.aplicaIva}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 border-slate-300 dark:border-slate-500 rounded focus:ring-blue-500 bg-slate-100 dark:bg-slate-700"
                />
                <label htmlFor="aplicaIva" className="ml-3 block text-sm font-medium text-slate-600 dark:text-slate-300">
                    Este producto aplica IVA (19%)
                </label>
            </div>
        </div>
      </div>

      <div className="pt-5 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">Cancelar</button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            <i className="fas fa-save mr-2"></i>
            Guardar Producto
        </button>
      </div>
    </form>
  );
};

export default ProductoForm;