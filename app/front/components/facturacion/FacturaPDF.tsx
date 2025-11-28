import React from 'react';
import { Factura, Cliente, DocumentPreferences } from '../../types';
import { useData } from '../../hooks/useData';
import { defaultPreferences } from '../../hooks/useDocumentPreferences';

interface FacturaPDFProps {
    factura: Factura;
    cliente: Cliente;
    empresa: {
        nombre: string;
        nit: string;
        direccion: string;
        ciudad?: string;
        telefono?: string;
        resolucionDian?: string;
        rangoNumeracion?: string;
        regimen?: string;
    },
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

const QRCode: React.FC<{ cufe: string }> = ({ cufe }) => (
  <div className="w-24 h-24 p-1 border border-slate-200 rounded-md bg-slate-50" aria-label={`QR Code for CUFE`}>
    <a href={`https://catalogo-vpfe.dian.gov.co/document/searchqr?cufe=${cufe}`} target="_blank" rel="noopener noreferrer">
        <div className="w-full h-full bg-slate-50 flex items-center justify-center">
            <i className="fas fa-qrcode text-5xl text-slate-800"></i>
        </div>
    </a>
  </div>
);

const FacturaPDF = React.forwardRef<HTMLDivElement, FacturaPDFProps>(
    ({ factura, cliente, empresa, preferences = defaultPreferences.factura }, ref) => {
    const { productos: allProducts } = useData();

    const totalDescuentos = factura.items.reduce((acc, item) => {
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
                        {preferences.detailLevel === 'full' && empresa.resolucionDian && (
                            <div className="mt-2 text-xs text-slate-500">
                                <p>Resolución DIAN: {empresa.resolucionDian}</p>
                                {empresa.rangoNumeracion && <p>Rango: {empresa.rangoNumeracion}</p>}
                            </div>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="text-2xl font-bold text-slate-900">FACTURA DE VENTA</h1>
                    <p className="font-semibold text-xl text-red-600">{factura.numeroFactura}</p>
                    <div className="mt-4 text-sm text-slate-600">
                        <p><span className="font-semibold text-slate-700">Fecha de Emisión:</span> {new Date(factura.fechaFactura).toLocaleDateString('es-CO')}</p>
                        {factura.fechaVencimiento && (
                            <p><span className="font-semibold text-slate-700">Fecha de Vencimiento:</span> {new Date(factura.fechaVencimiento).toLocaleDateString('es-CO')}</p>
                        )}
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
                     <p className="text-sm"><span className="font-semibold text-slate-700 w-32 inline-block">Forma de Pago:</span> {cliente.condicionPago}</p>
                     {preferences.detailLevel === 'full' && factura.cufe && (
                         <p className="text-sm mt-2"><span className="font-semibold text-slate-700 w-32 inline-block">CUFE:</span> <span className="text-xs break-all">{factura.cufe}</span></p>
                     )}
                </div>
            </section>

            {/* Tabla de Items */}
            <section className="mb-8">
                <table className="w-full text-left">
                    <thead className="rounded-lg">
                        <tr className="text-white text-sm font-semibold bg-blue-800">
                            <th className="p-3 text-left rounded-l-lg whitespace-nowrap">Referencia</th>
                            <th className="p-3 text-left w-2/5">Descripción</th>
                            <th className="p-3 text-left whitespace-nowrap">Unidad</th>
                            <th className="p-3 text-right whitespace-nowrap">Cant.</th>
                            {preferences.showPrices && (
                                <>
                                    <th className="p-3 text-right whitespace-nowrap">P. Unitario</th>
                                    <th className="p-3 text-center whitespace-nowrap">% IVA</th>
                                    <th className="p-3 text-center whitespace-nowrap">% Dcto</th>
                                    <th className="p-3 text-right whitespace-nowrap">Subtotal</th>
                                    <th className="p-3 text-right rounded-r-lg whitespace-nowrap">Valor IVA</th>
                                </>
                            )}
                            {!preferences.showPrices && <th className="p-3 text-right rounded-r-lg"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {factura.items.map((item) => {
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
                                            <td className="p-3 text-center text-slate-600 align-top">{item.ivaPorcentaje.toFixed(2)}%</td>
                                            <td className="p-3 text-center text-red-600 align-top">{item.descuentoPorcentaje.toFixed(2)}%</td>
                                            <td className="p-3 text-right font-medium text-slate-800 align-top">{formatCurrency(item.subtotal)}</td>
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
                    {preferences.detailLevel === 'full' && factura.cufe && (
                        <div className="mb-4">
                            <h3 className="text-xs font-semibold text-slate-500 mb-2 tracking-wider uppercase">Validación Fiscal</h3>
                            <div className="flex items-start gap-4 p-3 border border-slate-200 rounded-md bg-slate-50">
                                <QRCode cufe={factura.cufe} />
                                <div className="flex-1">
                                    <p className="text-xs text-slate-600 mb-2">Escanee el código QR para validar la autenticidad de este documento en el portal DIAN.</p>
                                    <p className="text-xs font-mono text-slate-700 break-all">{factura.cufe}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {!factura.cufe && (
                        <div className="mb-4">
                            <h3 className="text-xs font-semibold text-slate-500 mb-1 tracking-wider uppercase">Estado</h3>
                            <p className="p-2 border border-amber-200 rounded-md bg-amber-50 text-sm text-amber-700">
                                Factura en estado "Borrador". Este documento no tiene validez fiscal hasta ser timbrado.
                            </p>
                        </div>
                    )}
                    <h3 className="text-xs font-semibold text-slate-500 mb-1 tracking-wider uppercase">Observaciones</h3>
                    <p className="p-2 border border-slate-200 rounded-md bg-slate-50 h-24 text-sm">
                        {factura.observaciones || 'Factura generada electrónicamente conforme a la Resolución DIAN vigente.'}
                    </p>
                 </div>
                 {preferences.showPrices && (
                     <div className="w-2/5">
                        <table className="w-full text-sm">
                            <tbody>
                                <tr className="text-slate-700">
                                    <td className="py-1 pr-4 text-right">Subtotal Bruto</td>
                                    <td className="py-1 text-right font-medium">{formatCurrency(factura.subtotal + totalDescuentos)}</td>
                                </tr>
                                <tr className="text-red-500">
                                    <td className="py-1 pr-4 text-right">Descuentos</td>
                                    <td className="py-1 text-right font-medium">-{formatCurrency(totalDescuentos)}</td>
                                </tr>
                                <tr className="text-slate-800 font-semibold border-t border-blue-200">
                                    <td className="py-1 pr-4 text-right">Subtotal Neto</td>
                                    <td className="py-1 text-right">{formatCurrency(factura.subtotal)}</td>
                                </tr>
                                <tr className="text-slate-700">
                                    <td className="pt-1 pb-2 pr-4 text-right">IVA ({(() => {
                                        // Calcular porcentaje de IVA promedio desde los items del backend
                                        if (factura.items && factura.items.length > 0 && factura.subtotal > 0) {
                                            const ivaPorcentajePromedio = (factura.ivaValor / factura.subtotal) * 100;
                                            // Redondear a porcentajes estándar (19%, 8%, 5%, 0%)
                                            if (Math.abs(ivaPorcentajePromedio - 19) < 1) return '19';
                                            if (Math.abs(ivaPorcentajePromedio - 8) < 1) return '8';
                                            if (Math.abs(ivaPorcentajePromedio - 5) < 1) return '5';
                                            if (ivaPorcentajePromedio < 0.5) return '0';
                                            // Si no es estándar, mostrar con 2 decimales
                                            return ivaPorcentajePromedio.toFixed(2);
                                        }
                                        // Fallback: usar ivaPorcentaje del primer item del backend
                                        return factura.items?.[0]?.ivaPorcentaje?.toFixed(2) || '19';
                                    })()}%)</td>
                                    <td className="pt-1 pb-2 text-right font-medium">{formatCurrency(factura.ivaValor)}</td>
                                </tr>
                                <tr className="font-bold text-lg bg-blue-800 text-white shadow-lg">
                                    <td className="p-2 text-right rounded-l-lg">TOTAL</td>
                                    <td className="p-2 text-right rounded-r-lg">{formatCurrency(factura.total)}</td>
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
                            <p>1. Esta factura ha sido generada electrónicamente conforme a la Resolución DIAN vigente.</p>
                            <p>2. El pago debe realizarse según las condiciones comerciales acordadas.</p>
                            {factura.cufe && <p>3. Escanee el código QR para verificar la validez de esta factura en el portal DIAN.</p>}
                        </div>
                    )}
                    {preferences.signatureType === 'physical' && (
                         <div className="grid grid-cols-2 gap-16 pt-8">
                             <div className="text-center">
                                <div className="border-t-2 border-slate-400 pt-2">
                                    <p className="font-semibold text-slate-700">ELABORADO POR</p>
                                    <p className="text-xs text-slate-500">(Nombre y Firma)</p>
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="border-t-2 border-slate-400 pt-2">
                                    <p className="font-semibold text-slate-700">RECIBIDO Y ACEPTADO</p>
                                    <p className="text-xs text-slate-500">(Nombre, Firma, C.C. y Sello)</p>
                                </div>
                            </div>
                        </div>
                    )}
                     {preferences.signatureType === 'digital' && (
                         <div className="text-center pt-8">
                            <p>Documento Aprobado Digitalmente</p>
                            {factura.cufe && <p className="mt-1 text-xs">CUFE: {factura.cufe}</p>}
                         </div>
                    )}
                </footer>
            )}
        </div>
    );
});

export default FacturaPDF;
