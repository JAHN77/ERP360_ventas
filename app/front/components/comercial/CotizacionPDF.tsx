import React from 'react';
import { Cotizacion, Cliente, Vendedor, DocumentPreferences } from '../../types';
import { useData } from '../../hooks/useData';
import { defaultPreferences } from '../../hooks/useDocumentPreferences';

interface CotizacionPDFProps {
    cotizacion: Cotizacion;
    cliente: Cliente;
    vendedor: Vendedor;
    empresa: {
        nombre: string;
        nit: string;
        direccion: string;
        telefono?: string;
        email?: string;
    };
    preferences?: DocumentPreferences;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
}

const LogoPlaceholder: React.FC = () => (
    <div className="h-16 w-16 bg-slate-100 flex items-center justify-center rounded-md text-slate-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    </div>
);

const CotizacionPDF = React.forwardRef<HTMLDivElement, CotizacionPDFProps>(
    ({ cotizacion, cliente, vendedor, empresa, preferences = defaultPreferences.cotizacion }, ref) => {
    const { productos: allProducts } = useData();

    const totalDescuentos = cotizacion.items.reduce((acc, item) => {
        const itemTotal = item.precioUnitario * item.cantidad;
        return acc + (itemTotal * (item.descuentoPorcentaje / 100));
    }, 0);

    return (
        <div ref={ref} className="p-10 text-slate-800 bg-white font-sans text-sm">
            {/* Encabezado */}
            <header className="flex justify-between items-start mb-8 pb-4 border-b border-slate-200">
                <div className="flex items-start gap-4">
                    <LogoPlaceholder />
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">{empresa.nombre}</h2>
                        <p className="text-sm text-slate-600">NIT: {empresa.nit}</p>
                        <p className="text-sm text-slate-600">{empresa.direccion}</p>
                        {empresa.telefono && <p className="text-sm text-slate-600">Tel: {empresa.telefono}</p>}
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="text-2xl font-bold text-slate-900">COTIZACIÓN</h1>
                    <p className="font-semibold text-xl text-red-600">{cotizacion.numeroCotizacion}</p>
                    <div className="mt-4 text-sm text-slate-600">
                        <p><span className="font-semibold text-slate-700">Fecha de Emisión:</span> {new Date(cotizacion.fechaCotizacion).toLocaleDateString('es-CO')}</p>
                        <p><span className="font-semibold text-slate-700">Válida hasta:</span> {new Date(cotizacion.fechaVencimiento).toLocaleDateString('es-CO')}</p>
                    </div>
                </div>
            </header>

            {/* Datos del Cliente y Condiciones */}
            <section className="grid grid-cols-2 gap-x-6 my-8">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
                    <h3 className="text-xs font-semibold text-slate-500 mb-1 tracking-wider uppercase">CLIENTE</h3>
                    <p className="font-bold text-base text-slate-900">{cliente.nombreCompleto}</p>
                    <p className="text-sm text-slate-600">{cliente.tipoDocumentoId}: {cliente.numeroDocumento}</p>
                    <p className="text-sm text-slate-600">{cliente.direccion}, {cliente.ciudadId}</p>
                    <p className="text-sm text-slate-600">{cliente.email} | {cliente.telefono}</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
                     <h3 className="text-xs font-semibold text-slate-500 mb-1 tracking-wider uppercase">CONDICIONES</h3>
                     <p className="text-sm"><span className="font-semibold text-slate-700 w-32 inline-block">Vendedor:</span> {vendedor.primerNombre} {vendedor.primerApellido}</p>
                     <p className="text-sm"><span className="font-semibold text-slate-700 w-32 inline-block">Cond. de Pago:</span> {cliente.condicionPago}</p>
                     <p className="text-sm"><span className="font-semibold text-slate-700 w-32 inline-block">Tiempo de Entrega:</span> 5-7 días hábiles</p>
                </div>
            </section>

            {/* Tabla de Items */}
            <section className="mb-8">
                <table className="w-full text-left">
                    <thead className="rounded-lg">
                        <tr className="text-white text-sm font-semibold bg-blue-800">
                            <th className="p-3 text-left rounded-l-lg whitespace-nowrap text-white">Referencia</th>
                            <th className="p-3 text-left w-2/5 text-white">Descripción</th>
                            <th className="p-3 text-left whitespace-nowrap text-white">Unidad</th>
                            <th className="p-3 text-right whitespace-nowrap text-white">Cant.</th>
                            {preferences.showPrices && (
                                <>
                                    <th className="p-3 text-right whitespace-nowrap text-white">P. Unitario</th>
                                    <th className="p-3 text-right whitespace-nowrap text-white">% Dcto</th>
                                    <th className="p-3 text-right whitespace-nowrap text-white">Subtotal</th>
                                    <th className="p-3 text-right rounded-r-lg whitespace-nowrap text-white">Valor IVA</th>
                                </>
                            )}
                            {!preferences.showPrices && <th className="p-3 text-right rounded-r-lg text-white"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {cotizacion.items.map((item) => {
                             const product = allProducts.find(p => p.id === item.productoId);
                             return (
                                <tr key={item.productoId} className="text-sm">
                                    <td className="p-3 text-slate-600 align-top">{product?.referencia || 'N/A'}</td>
                                    <td className="p-3 font-semibold text-slate-800 align-top">{item.descripcion}</td>
                                    <td className="p-3 text-slate-600 align-top">{product?.unidadMedida}</td>
                                    <td className="p-3 text-right text-slate-600 align-top">{item.cantidad}</td>
                                    {preferences.showPrices ? (
                                        <>
                                            <td className="p-3 text-right text-slate-600 align-top">{formatCurrency(item.precioUnitario)}</td>
                                            <td className="p-3 text-right text-red-600 align-top">{item.descuentoPorcentaje.toFixed(2)}%</td>
                                            <td className="p-3 text-right font-medium text-slate-800 align-top">{formatCurrency(item.total)}</td>
                                            <td className="p-3 text-right text-slate-600 align-top">{formatCurrency(item.valorIva)}</td>
                                        </>
                                    ) : (
                                        <td></td>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </section>
            
            {/* Totales y Observaciones */}
            <section className="flex justify-between items-start">
                 <div className="w-1/2 text-slate-600">
                    <h3 className="text-xs font-semibold text-slate-500 mb-1 tracking-wider uppercase">Observaciones</h3>
                    <p className="p-2 border border-slate-200 rounded-md bg-slate-50 h-24 text-sm">
                        Costos de transporte no incluidos. La instalación se cotiza por separado.
                    </p>
                 </div>
                 {preferences.showPrices && (
                     <div className="w-2/5">
                        <table className="w-full text-sm">
                            <tbody>
                                <tr className="text-slate-700">
                                    <td className="py-1 pr-4 text-right">Subtotal Bruto</td>
                                    <td className="py-1 text-right font-medium">{formatCurrency(cotizacion.subtotal + totalDescuentos)}</td>
                                </tr>
                                <tr className="text-red-500">
                                    <td className="py-1 pr-4 text-right">Descuentos</td>
                                    <td className="py-1 text-right font-medium">-{formatCurrency(totalDescuentos)}</td>
                                </tr>
                                <tr className="text-slate-800 font-semibold border-t border-blue-200">
                                    <td className="py-1 pr-4 text-right">Subtotal Neto</td>
                                    <td className="py-1 text-right">{formatCurrency(cotizacion.subtotal)}</td>
                                </tr>
                                <tr className="text-slate-700">
                                    <td className="pt-1 pb-2 pr-4 text-right">IVA ({cotizacion.items[0]?.ivaPorcentaje || 19}%)</td>
                                    <td className="pt-1 pb-2 pr-4 text-right font-medium">{formatCurrency(cotizacion.ivaValor)}</td>
                                </tr>
                                {cotizacion.domicilios && cotizacion.domicilios > 0 && (
                                <tr className="text-slate-700">
                                    <td className="py-1 pr-4 text-right">Domicilios</td>
                                    <td className="py-1 pr-4 text-right font-medium">{formatCurrency(cotizacion.domicilios)}</td>
                                </tr>
                                )}
                                <tr className="font-bold text-lg bg-blue-800 text-white shadow-lg">
                                    <td className="p-2 text-right rounded-l-lg text-white">TOTAL</td>
                                    <td className="p-2 text-right rounded-r-lg text-white">{formatCurrency(cotizacion.total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                 )}
            </section>
            
            {/* Términos y Firmas */}
            {preferences.signatureType !== 'none' && (
                <footer className="mt-16 text-xs text-slate-600">
                    {preferences.detailLevel === 'full' && (
                        <div className="mb-12">
                            <h3 className="text-xs font-semibold text-slate-500 mb-1 tracking-wider uppercase">Términos y Condiciones</h3>
                            <p>1. Precios sujetos a cambio sin previo aviso. Validez de la oferta hasta la fecha indicada.</p>
                            <p>2. Garantía de 12 meses sobre defectos de fabricación. No cubre mal uso.</p>
                        </div>
                    )}
                    {preferences.signatureType === 'physical' && (
                         <div className="grid grid-cols-2 gap-16 pt-8">
                             <div className="text-center">
                                <div className="border-t-2 border-slate-400 pt-2">
                                    <p className="font-semibold text-slate-700">{vendedor.primerNombre} {vendedor.primerApellido}</p>
                                    <p>Asesor Comercial, {empresa.nombre}</p>
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="border-t-2 border-slate-400 pt-2">
                                    <p className="font-semibold text-slate-700">Aprobado por Cliente</p>
                                    <p>(Firma, Nombre y Sello)</p>
                                </div>
                            </div>
                        </div>
                    )}
                     {preferences.signatureType === 'digital' && (
                         <div className="text-center pt-8">
                            <p>Documento Aprobado Digitalmente</p>
                         </div>
                    )}
                </footer>
            )}
        </div>
    );
});

export default CotizacionPDF;