import React, { useState, useEffect, useCallback } from 'react';
import { Cliente } from '../../types';
import { useNotifications } from '../../hooks/useNotifications';
import { useData } from '../../hooks/useData';

// --- Shared Components (Ideally move to a separate file, but keeping here for now as requested) ---
const SectionHeader = ({ title, icon }: { title: string, icon?: string }) => (
  <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 text-white px-4 py-2 text-sm font-bold uppercase mb-4 mt-6 rounded-md shadow-lg flex justify-between items-center tracking-wide border border-blue-400/20">
    <span className="flex items-center gap-2">
      {icon && <i className={`fas ${icon} text-blue-200/80`}></i>}
      {title}
    </span>
    <div className="flex gap-1.5 opacity-60">
      <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
    </div>
  </div>
);

const Label = ({ children, required }: { children: React.ReactNode, required?: boolean }) => (
  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide ml-0.5">
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement> & { icon?: string }) => (
  <div className="relative group">
    {props.icon && (
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <i className={`fas ${props.icon} text-slate-400 group-focus-within:text-blue-500 transition-colors`}></i>
      </div>
    )}
    <input
      {...props}
      onChange={props.onChange}
      className={`w-full ${props.icon ? 'pl-9' : 'pl-3'} pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 transition-all shadow-sm ${props.disabled ? 'bg-slate-50 dark:bg-slate-900 opacity-70 cursor-not-allowed' : 'bg-white'} ${props.className || ''}`}
    />
  </div>
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative">
    <select
      {...props}
      className={`w-full pl-3 pr-8 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100 transition-all shadow-sm appearance-none ${props.className || ''}`}
    >
      {props.children}
    </select>
    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-500">
      <i className="fas fa-chevron-down text-xs"></i>
    </div>
  </div>
);

interface ClienteFormProps {
  initialData?: any | null; // Typed weak for flexibility with backend extra fields
  onSubmit: (data: any) => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const ClienteForm: React.FC<ClienteFormProps> = ({ initialData, onSubmit, onCancel, onDirtyChange }) => {
  const { ciudades } = useData();
  const { addNotification } = useNotifications();

  const [formData, setFormData] = useState({
    regimenTributario: '0',
    tipoDocumentoId: '13', // Maps to Tipo_documento
    numeroDocumento: '',
    dv: '',
    razonSocial: '',

    // Contacto (Nombres separados)
    primerApellido: '',
    segundoApellido: '',
    primerNombre: '',
    segundoNombre: '',

    // Detalle Contacto
    celular: '',
    telefono: '',
    direccion: '',
    email: '',
    ciudad: '', // Text Field now
    codigoPostal: '',

    // Commercial / Otros
    codacteconomica: '',
    actividadNombre: '',
    liquidarRetefuente: false,
    vendedorId: '',
    vendedorNombre: '',
    vendedorSearchTerm: '',

    cupoCredito: 0,
    diasCredito: 0,
    formaPago: '0',
    tipoPersonaId: 'tp1' // UI Helper
  });

  // Actividad Search State
  const [showActividadResult, setShowActividadResult] = useState(false);
  const [actividadesFound, setActividadesFound] = useState<any[]>([]);
  const [searchingActividad, setSearchingActividad] = useState(false);

  // Vendor Search State
  const [showVendedorResult, setShowVendedorResult] = useState(false);
  const [vendedoresFound, setVendedoresFound] = useState<any[]>([]);
  const [searchingVendedor, setSearchingVendedor] = useState(false);

  // Load Initial Data
  useEffect(() => {
    if (initialData) {
      console.log("Initial Data Loaded:", initialData);

      // Extract raw values
      const rs = initialData.razonSocial || initialData.nomter || '';
      const hasRazonSocial = String(rs).trim().length > 0;
      const hasNames = !!(initialData.primerNombre || initialData.nom1 || initialData.primerApellido || initialData.apl1);

      let derivedTipoDoc = initialData.tipoDocumento || '13';

      // Strict Rule requested by user: If Razon Social exists, it IS a NIT.
      if (hasRazonSocial) {
        derivedTipoDoc = '31';
      }

      setFormData(prev => ({
        ...prev,
        regimenTributario: initialData.regimenTributario || '0',
        tipoDocumentoId: derivedTipoDoc,
        numeroDocumento: initialData.numeroDocumento || initialData.codter || '',
        razonSocial: rs,

        primerApellido: initialData.primerApellido || initialData.apl1 || '',
        segundoApellido: initialData.segundoApellido || initialData.apl2 || '',
        primerNombre: initialData.primerNombre || initialData.nom1 || '',
        segundoNombre: initialData.segundoNombre || initialData.nom2 || '',

        direccion: initialData.direccion || initialData.dirter || '',
        celular: initialData.celular || initialData.celter || '',
        telefono: initialData.telefono || initialData.telter || '',
        email: initialData.email || '',

        ciudad: initialData.ciudad || '', // Load direct text
        codigoPostal: initialData.codigoPostal || initialData.coddane || '',

        codacteconomica: initialData.codacteconomica || '',
        vendedorId: initialData.vendedorId || initialData.codven || '',
        // Initialize search term with ID if name not found yet
        vendedorSearchTerm: initialData.nombreVendedor || initialData.vendedorId || initialData.codven || '',

        cupoCredito: initialData.limiteCredito || initialData.cupo_credito || 0,
        diasCredito: initialData.diasCredito || initialData.plazo || 0,
        formaPago: initialData.formaPago || '0',

        // Logic to infer Tipo Persona: If Razon Social exists, it's Juridica (2)
        tipoPersonaId: (hasRazonSocial && !hasNames) ? 'tp2' : (initialData.tipter === 1 ? 'tp1' : 'tp2')
      }));

      // Fetch Extra Details (Async)
      if (initialData.codacteconomica) {
        const code = String(initialData.codacteconomica).trim();
        if (code) {
          fetch(`http://localhost:3001/api/clientes/actividades-ciiu?search=${encodeURIComponent(code)}`)
            .then(r => r.json())
            .then(json => {
              // Loose match or first result if it looks like a direct hit
              const found = json.data?.find((d: any) => String(d.codigo).trim() === code) || json.data?.[0];
              if (found) setFormData(prev => ({ ...prev, actividadNombre: found.nombre }));
            })
            .catch(err => console.error("Error loading actividad:", err));
        }
      }
      if (initialData.vendedorId || initialData.codven) {
        const vid = initialData.vendedorId || initialData.codven;
        fetch(`http://localhost:3001/api/vendedores?search=${vid}`)
          .then(r => r.json())
          .then(json => {
            // Try to find exact match
            const found = json.data?.find((d: any) => d.codigoVendedor == vid || d.id == vid) || json.data?.[0];
            if (found) setFormData(prev => ({
              ...prev,
              vendedorNombre: found.nombreCompleto,
              vendedorSearchTerm: `${found.codigoVendedor} - ${found.nombreCompleto}`
            }));
          });
      }
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    // Special Uppercase enforcing for Ciudad
    if (name === 'ciudad') {
      setFormData(prev => ({ ...prev, ciudad: value.toUpperCase() }));
    }
  };

  // --- ACTIVITY SEARCH ---
  useEffect(() => {
    const searchActividad = async () => {
      if (formData.codacteconomica.length >= 2) {
        setSearchingActividad(true);
        try {
          const res = await fetch(`http://localhost:3001/api/clientes/actividades-ciiu?search=${encodeURIComponent(formData.codacteconomica)}&limit=5`);
          const json = await res.json();
          if (json.success && json.data.length > 0) {
            setActividadesFound(json.data);
            setShowActividadResult(true);
          } else {
            setShowActividadResult(false);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setSearchingActividad(false);
        }
      } else {
        setShowActividadResult(false);
      }
    };
    const timeoutId = setTimeout(searchActividad, 400);
    return () => clearTimeout(timeoutId);
  }, [formData.codacteconomica]);

  const selectActividad = (act: any) => {
    setFormData(prev => ({
      ...prev,
      codacteconomica: act.codigo,
      actividadNombre: act.nombre
    }));
    setShowActividadResult(false);
  };

  // --- VENDEDOR SEARCH ---
  useEffect(() => {
    const searchVendedor = async () => {
      if (formData.vendedorSearchTerm.length >= 1) {
        setSearchingVendedor(true);
        try {
          const res = await fetch(`http://localhost:3001/api/vendedores?search=${encodeURIComponent(formData.vendedorSearchTerm)}`);
          const json = await res.json();
          if (json.success && json.data.length > 0) {
            setVendedoresFound(json.data);
            setShowVendedorResult(true);
          } else {
            setShowVendedorResult(false);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setSearchingVendedor(false);
        }
      } else {
        setShowVendedorResult(false);
      }
    };

    const timeoutId = setTimeout(searchVendedor, 400);
    return () => clearTimeout(timeoutId);
  }, [formData.vendedorSearchTerm]);

  const selectVendedor = (vend: any) => {
    setFormData(prev => ({
      ...prev,
      vendedorId: vend.codigoVendedor,
      vendedorNombre: vend.nombreCompleto,
      vendedorSearchTerm: `${vend.codigoVendedor} - ${vend.nombreCompleto}`
    }));
    setShowVendedorResult(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Construct Payload compatible with Client Interface
    const isNit = formData.tipoDocumentoId === '31';

    // Find City Name to save in 'ciudad' column (User requirement: Save Name, not Code)
    // CRITICAL: We must ensure we NEVER save a numeric code in the Name column.

    // 1. Try finding by City ID (trimmed)
    const normalizedCityId = String(formData.ciudadId || '').trim();
    let cityObj = ciudades.find(c => String(c.codigo).trim() === normalizedCityId);

    // 2. If not found by City ID, try finding by Postal Code
    if (!cityObj && formData.codigoPostal) {
      const normalizedPostal = String(formData.codigoPostal).trim();
      cityObj = ciudades.find(c => String(c.codigo).trim() === normalizedPostal);
    }

    // 3. Determine Name. If still not found, default to empty string instead of ID to prevent "08080" issue.
    // However, if the user explicitly typed a legit name in input (if it was an input), we'd keep it. 
    // But here it is a Select. So if ID fails match, we have no Name.
    let cityName = cityObj ? cityObj.nombre : '';

    // Final Safety Check: If name looks like a number, blank it out
    if (/^\d+$/.test(cityName)) {
      cityName = '';
    }

    // Logic for payload
    const payload = {
      ...formData,
      // Backend updateClient expects specific fields
      id: initialData?.id,
      tipoDocumento: formData.tipoDocumentoId,
      ciudad: (formData.ciudad || '').toUpperCase().trim(), // Send Direct Text, Uppercased
      // Ensure Postal Code is sent explicitly. If Postal Code is empty but City ID is set, use City ID as postal logic.
      coddane: formData.codigoPostal || '',

      primerNombre: isNit ? '' : formData.primerNombre,
      segundoNombre: isNit ? '' : formData.segundoNombre,
      primerApellido: isNit ? '' : formData.primerApellido,
      segundoApellido: isNit ? '' : formData.segundoApellido,
      reasonSocial: isNit ? formData.razonSocial : '',
      // Logic: if person, backend constructs nomter from names.

      limiteCredito: formData.cupoCredito,
      // Map UI helper to tipter
      // Note: Controller expects 'tipoPersonaId' to be '1' or '2'. 
      // Our 'tp1'/'tp2' map needs conversion.
      tipoPersonaId: formData.tipoPersonaId === 'tp1' ? '1' : '2',
    };

    onSubmit(payload);
  };

  const isNit = formData.tipoDocumentoId === '31';

  return (
    <form onSubmit={handleSubmit} className="px-2 pb-4">
      {/* --- ROW 1: Identificación --- */}
      <SectionHeader title="Información Básica" icon="fa-id-card" />
      <div className="grid grid-cols-12 gap-5 mb-3">
        <div className="col-span-12 md:col-span-3">
          <Label>Régimen Tributario</Label>
          <Select name="regimenTributario" value={formData.regimenTributario} onChange={handleChange}>
            <option value="0">Responsable de IVA</option>
            <option value="1">No Responsable de IVA</option>
            <option value="2">Regimen Simple</option>
            <option value="3">Ordinario</option>
          </Select>
        </div>
        <div className="col-span-12 md:col-span-3">
          <Label>Tipo de documento</Label>
          <Select name="tipoDocumentoId" value={formData.tipoDocumentoId} onChange={handleChange}>
            <option value="13">Cédula de Ciudadanía</option>
            <option value="31">NIT</option>
            <option value="42">Documento Extranjero</option>
            <option value="22">Cédula de Extranjería</option>
          </Select>
        </div>
        <div className="col-span-12 md:col-span-4 flex items-end gap-2">
          <div className="flex-1">
            <Label required>Nº documento</Label>
            <Input name="numeroDocumento" value={formData.numeroDocumento} onChange={handleChange} required placeholder="Identificación..." icon="fa-fingerprint" />
          </div>
          <div className="w-16">
            <Input name="dv" value={formData.dv} onChange={handleChange} placeholder="DV" className="text-center font-bold text-red-600 bg-red-50/50 border-red-200" maxLength={1} />
          </div>
        </div>

        {/* Razón Social */}
        <div className="col-span-12 mt-1 relative">
          {!isNit && (
            <div className="absolute inset-0 z-10 bg-slate-50/50 dark:bg-slate-900/50 cursor-not-allowed" title="Para personas naturales, use los campos de Nombres y Apellidos abajo."></div>
          )}
          <Label required={isNit}>Razón Social / Nombre Comercial</Label>
          <Input
            name="razonSocial"
            value={formData.razonSocial}
            onChange={handleChange}
            className="font-semibold text-blue-900 dark:text-blue-100"
            required={isNit}
            placeholder={isNit ? "Nombre legal de la empresa..." : "Inhabilitado para Personas Naturales"}
            icon="fa-building"
            disabled={!isNit}
          />
        </div>
      </div>

      {/* --- ROW 2: Contacto --- */}
      {!isNit && (
        <>
          <SectionHeader title="Datos de Representante" icon="fa-user-tie" />
          <div className="grid grid-cols-12 gap-5 mb-3 relative p-4 border border-slate-200 dark:border-slate-700/50 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
            <div className="col-span-6 md:col-span-3">
              <Label>Primer Apellido</Label>
              <Input name="primerApellido" value={formData.primerApellido} onChange={handleChange} />
            </div>
            <div className="col-span-6 md:col-span-3">
              <Label>Segundo Apellido</Label>
              <Input name="segundoApellido" value={formData.segundoApellido} onChange={handleChange} />
            </div>
            <div className="col-span-6 md:col-span-3">
              <Label>Primer Nombre</Label>
              <Input name="primerNombre" value={formData.primerNombre} onChange={handleChange} />
            </div>
            <div className="col-span-6 md:col-span-3">
              <Label>Segundo Nombre</Label>
              <Input name="segundoNombre" value={formData.segundoNombre} onChange={handleChange} />
            </div>
          </div>
        </>
      )}

      {/* Ubicación y Vendedor */}
      <SectionHeader title="Detalles Comerciales y Ubicación" icon="fa-map-marked-alt" />
      <div className="grid grid-cols-12 gap-5 mb-3 p-4 border border-slate-200 dark:border-slate-700/50 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
        {/* Ubicación */}
        <div className="col-span-12 md:col-span-5">
          <Label>Dirección Física</Label>
          <Input name="direccion" value={formData.direccion} onChange={handleChange} placeholder="Calle, Carrera, Av..." icon="fa-map-marker-alt" />
        </div>
        {/* Código Postal */}
        <div className="col-span-6 md:col-span-2">
          <Label>Código Postal</Label>
          <Input name="codigoPostal" value={formData.codigoPostal} onChange={handleChange} placeholder="Ej. 11001" className="text-center font-mono" />
        </div>

        <div className="col-span-6 md:col-span-5">
          <Label>Teléfonos</Label>
          <Input name="celular" value={formData.celular} onChange={handleChange} placeholder="Móvil o Fijo" icon="fa-phone" />
        </div>

        <div className="col-span-12 md:col-span-4">
          <Label>Email Corporativo</Label>
          <Input name="email" value={formData.email} onChange={handleChange} placeholder="contacto@empresa.com" icon="fa-envelope" />
        </div>

        <div className="col-span-12 md:col-span-4">
          <Label required>Ciudad / Municipio</Label>
          <Input
            name="ciudad"
            value={formData.ciudad}
            onChange={handleChange}
            placeholder="NOMBRE CIUDAD"
            className="uppercase font-bold text-blue-900"
          />
        </div>

        <div className="col-span-12 md:col-span-4">
          <Label>Cuenta Contable (CXC)</Label>
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden h-[38px]">
            <div className="px-3 flex items-center bg-slate-200 dark:bg-slate-700 border-r border-slate-300 dark:border-slate-600 text-xs font-mono text-slate-600 dark:text-slate-300">13050501</div>
            <div className="px-3 flex items-center flex-1 text-blue-700 dark:text-blue-400 text-[10px] font-bold uppercase truncate tracking-tight">CLIENTES NACIONALES</div>
          </div>
        </div>

        {/* --- ACTIVIDAD ECONÓMICA AUTOCOMPLETE --- */}
        <div className="col-span-12 md:col-span-6 relative z-20">
          <Label>Actividad Económica (CIIU)</Label>
          <div className="flex gap-2 group">
            <div className="w-24 relative">
              <Input
                name="codacteconomica"
                value={formData.codacteconomica}
                onChange={handleChange}
                placeholder="Código"
                className="text-center font-bold text-blue-700"
                autoComplete="off"
              />
              {searchingActividad && <div className="absolute right-2 top-2.5 text-xs text-slate-400"><i className="fas fa-spinner fa-spin"></i></div>}
            </div>
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-briefcase text-slate-400"></i>
              </div>
              <input
                readOnly
                value={formData.actividadNombre || ''}
                placeholder="Descripción de la actividad..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none cursor-default"
              />
              {/* Dropdown Results */}
              {showActividadResult && actividadesFound.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-xl rounded-lg max-h-56 overflow-y-auto z-50">
                  {actividadesFound.map((act) => (
                    <div
                      key={act.codigo}
                      onClick={() => selectActividad(act)}
                      className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 flex items-center gap-3"
                    >
                      <span className="font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded text-xs">{act.codigo}</span>
                      <span className="text-slate-700 dark:text-slate-300 text-sm">{act.nombre}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- VENDEDOR LIVE SEARCH (AUTOCOMPLETE) --- */}
        <div className="col-span-12 md:col-span-6 relative z-20">
          <Label>Vendedor Asignado</Label>
          <div className="relative">
            <Input
              name="vendedorSearchTerm"
              value={formData.vendedorSearchTerm}
              onChange={handleChange}
              placeholder="Buscar por ID, nombre o código..."
              icon="fa-user-tag"
              autoComplete="off"
            />
            {searchingVendedor && <div className="absolute right-3 top-2.5 text-xs text-slate-400"><i className="fas fa-spinner fa-spin"></i></div>}

            {/* Dropdown Results */}
            {showVendedorResult && vendedoresFound.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-xl rounded-lg max-h-56 overflow-y-auto z-50">
                {vendedoresFound.map((vend) => (
                  <div
                    key={vend.id}
                    onClick={() => selectVendedor(vend)}
                    className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 flex flex-col"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-700 dark:text-slate-200">{vend.nombreCompleto}</span>
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500">{vend.codigoVendedor}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 flex items-center mt-2">
          <label className="flex items-center gap-3 cursor-pointer select-none group p-2 hover:bg-blue-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors w-full sm:w-auto">
            <div className="relative flex items-center">
              <input type="checkbox" name="liquidarRetefuente" checked={formData.liquidarRetefuente} onChange={handleChange} className="peer w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 transition-all" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-700 transition-colors">Liquidar ReteFuente en Factura de Venta</span>
          </label>
        </div>
      </div>


      {/* Bottom Actions */}
      <div className="mt-8 flex flex-col-reverse md:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <i className="fas fa-asterisk text-[10px] text-red-400"></i> Campos obligatorios
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button type="button" onClick={onCancel} className="flex-1 md:flex-none px-6 py-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all font-medium text-sm">
            Cancelar
          </button>
          <button type="submit" className="flex-1 md:flex-none px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 rounded-lg hover:from-blue-700 hover:to-blue-800 transform hover:-translate-y-0.5 transition-all font-bold text-sm flex items-center justify-center gap-2">
            <i className="fas fa-save"></i>
            Actualizar Cliente
          </button>
        </div>
      </div>
    </form>
  );
};

export default ClienteForm;