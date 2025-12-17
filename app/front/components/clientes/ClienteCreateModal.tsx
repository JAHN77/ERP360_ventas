import React, { useState, useEffect, useRef } from 'react';
import Modal from '../ui/Modal';
import { apiCreateCliente } from '../../services/apiClient';
import { useNotifications } from '../../hooks/useNotifications';
import { useData } from '../../hooks/useData';

interface ClienteCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

// --- HELPER COMPONENTS (Moved outside to prevent re-creation on render) ---
const SectionHeader = ({ title, icon }: { title: string, icon?: string }) => (
    <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 text-white px-4 py-2 text-sm font-bold uppercase mb-4 mt-6 rounded-md shadow-lg flex justify-between items-center tracking-wide border border-blue-400/20">
        <span className="flex items-center gap-2">
            {icon && <i className={`fas ${icon} text-blue-200/80`}></i>}
            {title}
        </span>
        <div className="flex gap-1.5 opacity-60">
            <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
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
            // Ensure onChange is passed if provided, otherwise standard props apply
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


const ClienteCreateModal: React.FC<ClienteCreateModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { addNotification } = useNotifications();
    const { ciudades } = useData();
    const [isLoading, setIsLoading] = useState(false);

    // Initial State
    const [formData, setFormData] = useState({
        regimenTributario: '0',
        tipoDocumento: '31', // Default NIT
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
        ciudad: '',
        codigoPostal: '',
        departamento: '',

        // Commercial / Otros
        codacteconomica: '',
        actividadNombre: '',
        liquidarRetefuente: false,
        contacto: '',
        vendedorId: '',
        vendedorNombre: '',
        vendedorSearchTerm: '', // New field for the search input
        listaPrecios: '01',

        cupoCredito: 0,
        formaPago: '0',
        vencimiento: 30,
        descuento: 0,
        ruta: '002',
        cuentaContable: '13050501'
    });

    // Actividad Search State
    const [showActividadResult, setShowActividadResult] = useState(false);
    const [actividadesFound, setActividadesFound] = useState<any[]>([]);
    const [searchingActividad, setSearchingActividad] = useState(false);

    // Vendor Search State
    const [showVendedorResult, setShowVendedorResult] = useState(false);
    const [vendedoresFound, setVendedoresFound] = useState<any[]>([]);
    const [searchingVendedor, setSearchingVendedor] = useState(false);

    // Reset form on open
    useEffect(() => {
        if (isOpen) {
            setFormData({
                regimenTributario: '0',
                tipoDocumento: '31',
                numeroDocumento: '',
                dv: '',
                razonSocial: '',
                primerApellido: '',
                segundoApellido: '',
                primerNombre: '',
                segundoNombre: '',
                celular: '',
                telefono: '',
                direccion: '',
                email: '',
                ciudad: '',
                codigoPostal: '',
                departamento: '',
                codacteconomica: '',
                actividadNombre: '',
                liquidarRetefuente: false,
                contacto: '',
                vendedorId: '',
                vendedorNombre: '',
                vendedorSearchTerm: '',
                listaPrecios: '01',
                cupoCredito: 0,
                formaPago: '0',
                vencimiento: 30,
                descuento: 0,
                ruta: '002',
                cuentaContable: '13050501'
            });
            setShowActividadResult(false);
            setShowVendedorResult(false);
        }
    }, [isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    // --- ACTIVITY SEARCH LOGIC (Typing 2 chars) ---
    useEffect(() => {
        const searchActividad = async () => {
            // Only search if user is typing a code manually and it's not the selected name
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

        // Avoid searching if we just selected (optional optimization, but debounce handles it mostly)
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

    // --- VENDEDOR SEARCH LOGIC (Autocomplete) ---
    useEffect(() => {
        const searchVendedor = async () => {
            if (formData.vendedorSearchTerm.length >= 1) { // Search on 1 char or more
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


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const payload = {
            ...formData,
            tipoPersonaId: formData.tipoDocumento === '31' ? '2' : '1',
            reasonSocial: formData.razonSocial,
        };

        try {
            const response = await apiCreateCliente(payload);
            if (response.success) {
                addNotification({ type: 'success', message: 'Cliente creado correctamente' });
                onSuccess();
                onClose();
            } else {
                addNotification({ type: 'error', message: response.message || 'Error al guardar' });
            }
        } catch (error: any) {
            addNotification({ type: 'error', message: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    // Disable logic
    const isNit = formData.tipoDocumento === '31';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nuevo Tercero / Cliente" size="xb" >
            <div className="p-1.5 text-slate-800 dark:text-slate-100 bg-[#f8fafc] dark:bg-[#0f172a] min-h-[600px]">
                <form onSubmit={handleSubmit} className="px-4 pb-4">

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
                            <Select name="tipoDocumento" value={formData.tipoDocumento} onChange={handleChange}>
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
                            {/* Overlay for non-NIT to explain why it's disabled */}
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
                    <SectionHeader title="Datos de Representante" icon="fa-user-tie" />
                    <div className="grid grid-cols-12 gap-5 mb-3 relative p-4 border border-slate-200 dark:border-slate-700/50 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
                        {isNit && (
                            <div className="absolute inset-0 bg-slate-50/80 dark:bg-slate-900/80 z-10 flex items-center justify-center backdrop-blur-[1px] rounded-xl border border-dashed border-slate-300 dark:border-slate-600 transition-all">
                                <span className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                    <i className="fas fa-lock text-slate-400"></i>
                                    Solo para personas naturales
                                </span>
                            </div>
                        )}
                        <div className="col-span-6 md:col-span-3">
                            <Label>Primer Apellido</Label>
                            <Input name="primerApellido" value={formData.primerApellido} onChange={handleChange} disabled={isNit} />
                        </div>
                        <div className="col-span-6 md:col-span-3">
                            <Label>Segundo Apellido</Label>
                            <Input name="segundoApellido" value={formData.segundoApellido} onChange={handleChange} disabled={isNit} />
                        </div>
                        <div className="col-span-6 md:col-span-3">
                            <Label>Primer Nombre</Label>
                            <Input name="primerNombre" value={formData.primerNombre} onChange={handleChange} disabled={isNit} />
                        </div>
                        <div className="col-span-6 md:col-span-3">
                            <Label>Segundo Nombre</Label>
                            <Input name="segundoNombre" value={formData.segundoNombre} onChange={handleChange} disabled={isNit} />
                        </div>
                    </div>

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
                            <Label>Ciudad / Municipio</Label>
                            <Select name="ciudad" value={formData.ciudad} onChange={handleChange}>
                                <option value="">Seleccione Ciudad...</option>
                                {ciudades.map(c => (
                                    <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
                                ))}
                            </Select>
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
                            <button type="button" onClick={onClose} className="flex-1 md:flex-none px-6 py-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all font-medium text-sm">
                                Cancelar
                            </button>
                            <button type="submit" className="flex-1 md:flex-none px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 rounded-lg hover:from-blue-700 hover:to-blue-800 transform hover:-translate-y-0.5 transition-all font-bold text-sm flex items-center justify-center gap-2" disabled={isLoading}>
                                {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                                Guardar Cliente
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </Modal>
    );
};

export default ClienteCreateModal;
