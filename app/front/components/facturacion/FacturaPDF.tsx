import React from 'react';
import { Factura, Cliente, DocumentPreferences } from '../../types';
import { useData } from '../../hooks/useData';

interface FacturaPDFProps {
    factura: Factura;
    cliente: Cliente;
    empresa: {
        nombre: string;
        nit: string;
        direccion: string;
        ciudad: string;
        telefono: string;
        resolucionDian: string;
        rangoNumeracion: string;
        regimen: string;
    },
    preferences: DocumentPreferences;
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
  <div className="w-24 h-24 p-1 border border-slate-200 rounded-md" aria-label={`QR Code for CUFE`}>
    <a href={`https://catalogo-vpfe.dian.gov.co/document/searchqr?cufe=${cufe}`} target="_blank" rel="noopener noreferrer">
        <div className="w-full h-full bg-slate-50 flex items-center justify-center rounded">
            <i className="fas fa-qrcode text-5xl text-slate-800"></i>
        </div>
    </a>
  </div>
);

const FacturaPDF = React.forwardRef<HTMLDivElement, FacturaPDFProps>(
    ({ factura, cliente, empresa, preferences }, ref) => {
    const { productos: allProducts } = useData();

    const totalDescuentos = factura.items.reduce((acc, item) => {
        const itemTotal = item.precioUnitario * item.cantidad;
        return acc + (itemTotal * (item.descuentoPorcentaje / 100));
    }, 0);

    return (
        <div ref={ref} className="p-10 text-slate-800 bg-white font-sans text-sm print-content">
            {/* Encabezado */}
            <header className="flex justify-between items-start mb-8 pb-4 border-b border-slate-200">
                <div className="flex items-start gap-4">
                    <LogoPlaceholder />
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">{empresa.nombre}</h2>
                        <p className="text-sm text-slate-600">NIT: {empresa.nit}</p>
                        <p className="text-sm text-slate-600">{empresa.direccion}, {empresa.ciudad}</p>
                        {empresa.telefono && <p className="text-sm text-slate-600">Tel: {empresa.telefono}</p>}
                        {preferences.detailLevel === 'full' && (
                            <>
                                <p className="text-sm text-slate-600">{empresa.regimen}</p>
                                <p className="text-xs text-slate-500 mt-1">Resolución DIAN: {empresa.resolucionDian}</p>
                                <p className="text-xs text-slate-500">Rango: {empresa.rangoNumeracion}</p>
                            </>
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
                    {preferences.detailLevel === 'full' && (
                        <>
                            <p className="text-sm"><span className="font-semibold text-slate-700 w-32 inline-block">Fecha de Vencimiento:</span> {new Date(factura.fechaVencimiento || factura.fechaFactura).toLocaleDateString('es-CO')}</p>
                        </>
                    )}
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
                            <th className="p-3 text-right whitespace-nowrap text-white">P. Unitario</th>
                            <th className="p-3 text-center whitespace-nowrap text-white">% IVA</th>
                            <th className="p-3 text-center whitespace-nowrap text-white">% Dcto</th>
                            <th className="p-3 text-right rounded-r-lg whitespace-nowrap text-white">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {factura.items.map((item) => {
                             const product = allProducts.find(p => p.id === item.productoId);
                             return (
                                <tr key={item.productoId} className="text-sm">
                                    <td className="p-3 text-slate-600 align-top">{product?.referencia || 'N/A'}</td>
                                    <td className="p-3 font-semibold text-slate-800 align-top">
                                        {item.descripcion}
                                        {preferences.detailLevel === 'full' && product?.nombre && (
                                            <p className="text-xs text-slate-500 font-normal">SKU: {product.nombre}</p>
                                        )}
                                    </td>
                                    <td className="p-3 text-slate-600 align-top">{product?.unidadMedida || '—'}</td>
                                    <td className="p-3 text-right text-slate-600 align-top">{item.cantidad}</td>
                                    <td className="p-3 text-right text-slate-600 align-top">{formatCurrency(item.precioUnitario)}</td>
                                    <td className="p-3 text-center text-slate-600 align-top">{item.ivaPorcentaje.toFixed(2)}%</td>
                                    <td className="p-3 text-center text-red-600 align-top">{item.descuentoPorcentaje.toFixed(2)}%</td>
                                    <td className="p-3 text-right font-medium text-slate-800 align-top">{formatCurrency(item.total)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </section>
            
            {/* Totales y Validación Fiscal */}
            <section className="flex justify-between items-start mb-8">
                <div className="w-1/2">
                    {preferences.signatureType === 'digital' && factura.cufe ? (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
                            <h3 className="text-xs font-semibold text-slate-500 mb-2 tracking-wider uppercase">Validación Fiscal</h3>
                            <div className="flex items-start gap-4">
                                <QRCode cufe={factura.cufe} />
                                <div className="flex-1">
                                    <p className="text-xs text-slate-600 mb-2">
                                        Escanee el código QR para validar la autenticidad de este documento en el portal DIAN.
                                    </p>
                                    <p className="text-xs font-semibold text-slate-700 break-all">
                                        CUFE: <span className="font-mono">{factura.cufe}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                            <h3 className="text-xs font-semibold text-amber-700 mb-1 tracking-wider uppercase">Estado</h3>
                            <p className="text-sm font-semibold text-amber-800">Factura en estado "Borrador"</p>
                            <p className="text-xs text-amber-700 mt-1">
                                Este documento no tiene validez fiscal hasta ser timbrado conforme a la resolución DIAN vigente.
                            </p>
                        </div>
                    )}
                </div>
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
                                <td className="pt-1 pb-2 pr-4 text-right">IVA ({factura.items[0]?.ivaPorcentaje || 19}%)</td>
                                <td className="pt-1 pb-2 text-right font-medium">{formatCurrency(factura.ivaValor)}</td>
                            </tr>
                            <tr className="font-bold text-lg bg-blue-800 text-white shadow-lg">
                                <td className="p-2 text-right rounded-l-lg text-white">TOTAL</td>
                                <td className="p-2 text-right rounded-r-lg text-white">{formatCurrency(factura.total)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
            
            {/* Términos y Firmas */}
            {(preferences.signatureType !== 'none' || preferences.detailLevel === 'full') && (
                <footer className="mt-16 text-xs text-slate-600">
                    {preferences.detailLevel === 'full' && (
                        <div className="mb-12">
                            <h3 className="text-xs font-semibold text-slate-500 mb-1 tracking-wider uppercase">Información Fiscal</h3>
                            <p>Esta es una representación impresa de una Factura de Venta generada electrónicamente conforme a la Resolución DIAN vigente.</p>
                            {factura.cufe && <p className="mt-1">Escanee el código QR para verificar la validez de esta factura en el portal DIAN.</p>}
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
                                    <p className="text-xs text-slate-500">(Firma, Nombre y Sello)</p>
                                </div>
                            </div>
                        </div>
                    )}
                     {preferences.signatureType === 'digital' && factura.cufe && (
                         <div className="text-center pt-8">
                            <p>Documento Aprobado Digitalmente</p>
                            <p className="text-xs text-slate-500 mt-1">CUFE: {factura.cufe.substring(0, 50)}...</p>
                         </div>
                    )}
                </footer>
            )}
        </div>
    );
});

export default FacturaPDF;
