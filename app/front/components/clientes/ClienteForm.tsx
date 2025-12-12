import React, { useState, useEffect, useCallback } from 'react';
import { Cliente } from '../../types';
import { isEmail, isNotEmpty } from '../../utils/validation';
import { useData } from '../../hooks/useData';

interface ClienteFormProps {
  initialData?: Cliente | null;
  onSubmit: (data: Omit<Cliente, 'id' | 'condicionPago' | 'activo' | 'createdAt' | 'nombreCompleto'>) => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

// FIX: Added all missing properties from the Cliente interface with default values to satisfy the return type.
const getInitialFormState = (data?: Cliente | null): Omit<Cliente, 'id' | 'condicionPago' | 'activo' | 'createdAt' | 'nombreCompleto'> => ({
  // Campos originales de la UI
  tipoPersonaId: data?.tipoPersonaId || 'tp1',
  tipoDocumentoId: data?.tipoDocumentoId || 'td1',
  numeroDocumento: data?.numeroDocumento || '',
  razonSocial: data?.razonSocial || '',
  primerNombre: data?.primerNombre || '',
  segundoNombre: data?.segundoNombre || '',
  primerApellido: data?.primerApellido || '',
  segundoApellido: data?.segundoApellido || '',
  email: data?.email || '',
  celular: data?.celular || '',
  direccion: data?.direccion || '',
  ciudadId: data?.ciudadId || 'c1',
  regimenFiscalId: data?.regimenFiscalId || 'rf1',
  limiteCredito: data?.limiteCredito || 0,
  diasCredito: data?.diasCredito || 0,
  empresaId: data?.empresaId || 1, // Default a la empresa 1

  // Campos del nuevo modelo para satisfacer el tipo
  tipoDocumento: data?.tipoDocumento || '',
  tipter: data?.tipter || 1, // Asumiendo 1 para Persona Natural por defecto
  isproveedor: data?.isproveedor || false,
  nomter: data?.nomter || '',
  apl1: data?.apl1,
  apl2: data?.apl2,
  nom1: data?.nom1,
  nom2: data?.nom2,
  dirter: data?.dirter,
  telter: data?.telter,
  celter: data?.celter,
  ciudad: data?.ciudad,
  coddane: data?.coddane,
  codven: data?.codven,
  cupoCredito: data?.cupoCredito || 0,
  plazo: data?.plazo || 0,
});

interface Errors {
  [key: string]: string;
}

const ClienteForm: React.FC<ClienteFormProps> = ({ initialData, onSubmit, onCancel, onDirtyChange }) => {
  const [formData, setFormData] = useState(getInitialFormState(initialData));
  const [errors, setErrors] = useState<Errors>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const { tiposDocumento, tiposPersona, ciudades } = useData();


  const validate = useCallback(() => {
    const newErrors: Errors = {};
    const isPersonaJuridica = formData.tipoPersonaId === 'tp2';

    if (isPersonaJuridica) {
      if (!isNotEmpty(formData.razonSocial)) newErrors.razonSocial = 'La razón social es obligatoria.';
    } else {
      if (!isNotEmpty(formData.primerNombre)) newErrors.primerNombre = 'El primer nombre es obligatorio.';
      if (!isNotEmpty(formData.primerApellido)) newErrors.primerApellido = 'El primer apellido es obligatorio.';
    }

    if (!isNotEmpty(formData.numeroDocumento)) newErrors.numeroDocumento = 'El número de documento es obligatorio.';
    if (!isNotEmpty(formData.email)) newErrors.email = 'El correo es obligatorio.';
    else if (!isEmail(formData.email)) newErrors.email = 'El formato del correo no es válido.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  useEffect(() => {
    if (hasSubmitted) validate();
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'limiteCredito' || name === 'diasCredito') {
      const numericValue = value.replace(/[^0-9]/g, '');
      setFormData(prev => ({ ...prev, [name]: numericValue === '' ? 0 : parseInt(numericValue, 10) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    if (validate()) {
      // FIX: Map form state to the data structure expected by the backend/context.
      const isPersonaJuridica = formData.tipoPersonaId === 'tp2';

      // Encontrar el código del tipo de persona seleccionado
      const selectedTipoPersona = tiposPersona.find(tp => tp.id === formData.tipoPersonaId);
      const tipterValue = selectedTipoPersona ? parseInt(selectedTipoPersona.codigo, 10) : 2; // Default a 2 (Cliente) si no se encuentra

      const dataToSubmit: Omit<Cliente, 'id' | 'condicionPago' | 'activo' | 'createdAt' | 'nombreCompleto'> = {
        ...formData,
        nomter: isPersonaJuridica ? formData.razonSocial || '' : `${formData.primerNombre || ''} ${formData.segundoNombre || ''} ${formData.primerApellido || ''} ${formData.segundoApellido || ''}`.trim().replace(/\s+/g, ' '),
        razonSocial: isPersonaJuridica ? formData.razonSocial : undefined,
        primerNombre: !isPersonaJuridica ? formData.primerNombre : undefined,
        segundoNombre: !isPersonaJuridica ? formData.segundoNombre : undefined,
        primerApellido: !isPersonaJuridica ? formData.primerApellido : undefined,
        segundoApellido: !isPersonaJuridica ? formData.segundoApellido : undefined,
        nom1: !isPersonaJuridica ? formData.primerNombre : '',
        nom2: !isPersonaJuridica ? formData.segundoNombre : '',
        apl1: !isPersonaJuridica ? formData.primerApellido : '',
        apl2: !isPersonaJuridica ? formData.segundoApellido : '',
        dirter: formData.direccion,
        telter: formData.celular,
        celter: formData.celular,
        cupoCredito: formData.limiteCredito,
        plazo: formData.diasCredito,
        tipter: tipterValue,
      };
      onSubmit(dataToSubmit);
    }
  };

  const getInputClasses = (fieldName: keyof typeof formData) => `mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-2 dark:text-slate-200 ${errors[fieldName] ? 'border-red-500 dark:border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
    }`;

  const ErrorMessage: React.FC<{ fieldName: keyof typeof formData }> = ({ fieldName }) => (
    errors[fieldName] ? <p className="mt-1 text-xs text-red-500">{errors[fieldName]}</p> : null
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Tipo de Persona</label>
        <select name="tipoPersonaId" value={formData.tipoPersonaId} onChange={handleChange} className={getInputClasses('tipoPersonaId')}>
          {tiposPersona.map(tp => <option key={tp.id} value={tp.id}>{tp.nombre}</option>)}
        </select>
      </div>

      {formData.tipoPersonaId === 'tp2' ? (
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Razón Social</label>
          <input type="text" name="razonSocial" value={formData.razonSocial} onChange={handleChange} className={getInputClasses('razonSocial')} />
          <ErrorMessage fieldName="razonSocial" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Primer Nombre</label>
              <input type="text" name="primerNombre" value={formData.primerNombre} onChange={handleChange} className={getInputClasses('primerNombre')} />
              <ErrorMessage fieldName="primerNombre" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Segundo Nombre</label>
              <input type="text" name="segundoNombre" value={formData.segundoNombre} onChange={handleChange} className={getInputClasses('segundoNombre')} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Primer Apellido</label>
              <input type="text" name="primerApellido" value={formData.primerApellido} onChange={handleChange} className={getInputClasses('primerApellido')} />
              <ErrorMessage fieldName="primerApellido" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Segundo Apellido</label>
              <input type="text" name="segundoApellido" value={formData.segundoApellido} onChange={handleChange} className={getInputClasses('segundoApellido')} />
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Tipo de Documento</label>
          <select name="tipoDocumentoId" value={formData.tipoDocumentoId} onChange={handleChange} className={getInputClasses('tipoDocumentoId')}>
            {tiposDocumento.map(td => <option key={td.id} value={td.id}>{td.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Número de Documento</label>
          <input type="text" name="numeroDocumento" value={formData.numeroDocumento} onChange={handleChange} className={getInputClasses('numeroDocumento')} />
          <ErrorMessage fieldName="numeroDocumento" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Correo Electrónico</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} className={getInputClasses('email')} />
          <ErrorMessage fieldName="email" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Celular</label>
          <input type="tel" name="celular" value={formData.celular} onChange={handleChange} className={getInputClasses('celular')} />
          <ErrorMessage fieldName="celular" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Dirección</label>
          <input type="text" name="direccion" value={formData.direccion} onChange={handleChange} className={getInputClasses('direccion')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Ciudad</label>
          <select name="ciudadId" value={formData.ciudadId} onChange={handleChange} className={getInputClasses('ciudadId')}>
            {ciudades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Límite de Crédito</label>
          <input type="text" pattern="[0-9]*" inputMode="numeric" name="limiteCredito" value={formData.limiteCredito} onChange={handleChange} className={getInputClasses('limiteCredito')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Días de Crédito</label>
          <input type="text" pattern="[0-9]*" inputMode="numeric" name="diasCredito" value={formData.diasCredito} onChange={handleChange} className={getInputClasses('diasCredito')} />
        </div>
      </div>

      <div className="pt-5 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">Cancelar</button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
          <i className="fas fa-save mr-2"></i>
          Guardar Cliente
        </button>
      </div>
    </form>
  );
};

export default ClienteForm;