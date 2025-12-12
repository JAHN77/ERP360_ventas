import React from 'react';
import { Cliente } from '../../types';
import { useData } from '../../hooks/useData';

interface ClientDetailsProps {
    cliente: Cliente;
}

const ClientDetails: React.FC<ClientDetailsProps> = ({ cliente }) => {
    const { tiposDocumento, tiposPersona, ciudades } = useData();

    const tipoDocumento = tiposDocumento.find(td => td.id === cliente.tipoDocumentoId);
    const tipoPersona = tiposPersona.find(tp => tp.id === cliente.tipoPersonaId);
    const ciudad = ciudades.find(c => String(c.codigo) === String(cliente.ciudadId))?.nombre || cliente.ciudadId;

    const DetailItem = ({ label, value, icon }: { label: string; value: React.ReactNode; icon?: string }) => (
        <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            {icon && (
                <div className="mt-1 text-slate-400 dark:text-slate-500">
                    <i className={`fas ${icon} w-5 text-center`}></i>
                </div>
            )}
            <div className="flex-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                <div className="text-sm text-slate-800 dark:text-slate-200 font-medium break-words">
                    {value || <span className="text-slate-400 italic">No especificado</span>}
                </div>
            </div>
        </div>
    );

    const SectionTitle = ({ title, icon }: { title: string; icon: string }) => (
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <i className={`fas ${icon}`}></i>
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        </div>
    );

    return (
        <div className="space-y-8 p-2">
            {/* Header Summary */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-100 dark:border-slate-700">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{cliente.nombreCompleto}</h2>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cliente.activo
                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cliente.activo ? 'bg-green-600 dark:bg-green-400' : 'bg-red-600 dark:bg-red-400'}`}></span>
                            {cliente.activo ? 'Activo' : 'Inactivo'}
                        </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-2">
                        <i className="far fa-id-card"></i>
                        {tipoDocumento?.codigo} {cliente.numeroDocumento}
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span className="capitalize">{tipoPersona?.nombre || 'Tipo no definido'}</span>
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Cliente desde</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {cliente.createdAt ? new Date(cliente.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Columna Izquierda */}
                <div className="space-y-8">
                    <section>
                        <SectionTitle title="Datos de Contacto" icon="fa-address-book" />
                        <div className="grid grid-cols-1 gap-1">
                            <DetailItem label="Correo Electrónico" value={cliente.email} icon="fa-envelope" />
                            <DetailItem label="Teléfono Fijo" value={cliente.telter} icon="fa-phone" />
                            <DetailItem label="Celular" value={cliente.celular} icon="fa-mobile-alt" />
                        </div>
                    </section>

                    <section>
                        <SectionTitle title="Ubicación" icon="fa-map-marker-alt" />
                        <div className="grid grid-cols-1 gap-1">
                            <DetailItem label="Dirección" value={cliente.direccion} icon="fa-map-pin" />
                            <DetailItem label="Ciudad / Municipio" value={ciudad} icon="fa-city" />
                        </div>
                    </section>
                </div>

                {/* Columna Derecha */}
                <div className="space-y-8">
                    <section>
                        <SectionTitle title="Información Comercial" icon="fa-briefcase" />
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700 border-b border-slate-200 dark:border-slate-700">
                                <div className="p-4 text-center">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Cupo de Crédito</p>
                                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(cliente.limiteCredito || 0))}
                                    </p>
                                </div>
                                <div className="p-4 text-center">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Días de Plazo</p>
                                    <p className="text-xl font-bold text-slate-700 dark:text-slate-200">
                                        {cliente.diasCredito ?? 0} <span className="text-sm font-normal text-slate-500">días</span>
                                    </p>
                                </div>
                            </div>
                            <div className="p-4">
                                <DetailItem label="Condición de Pago" value={cliente.condicionPago} icon="fa-money-bill-wave" />
                                <DetailItem label="Régimen Fiscal" value={cliente.regimenFiscalId} icon="fa-file-invoice-dollar" />
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default ClientDetails;
