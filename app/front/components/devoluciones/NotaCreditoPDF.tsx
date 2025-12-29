import React from 'react';
import { NotaCredito, Factura, Cliente } from '../../types';
import { useData } from '../../hooks/useData';

interface NotaCreditoPDFProps {
    notaCredito: NotaCredito;
    factura: Factura;
    cliente: Cliente;
    empresa: {
        nombre: string;
        nit: string;
        direccion: string;
    };
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

const LogoPlaceholder: React.FC = () => (
    <div className="h-16 w-16 bg-slate-100 flex items-center justify-center rounded-md text-slate-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    </div>
);

const NotaCreditoPDF = React.forwardRef<HTMLDivElement, NotaCreditoPDFProps>(
    ({ notaCredito, factura, cliente, empresa }, ref) => {
        const { productos: allProducts } = useData();

        const totalDescuentos = notaCredito.itemsDevueltos.reduce((acc, item) => {
            const itemTotal = item.precioUnitario * item.cantidad;
            return acc + (itemTotal * (item.descuentoPorcentaje / 100));
        }, 0);

        return (
            <div ref={ref} className="p-8 text-slate-800 bg-white font-sans text-xs max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between" style={{ width: '210mm', boxSizing: 'border-box' }}>
                <div>
                    {/* Header */}
                    <header className="flex justify-between items-start mb-8 pb-6 border-b border-slate-200">
                        <div className="flex items-center gap-4">
                            <LogoPlaceholder />
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 leading-tight uppercase tracking-tight">{empresa.nombre}</h2>
                                <div className="text-slate-500 mt-1 space-y-0.5">
                                    <p>NIT: {empresa.nit}</p>
                                    <p>{empresa.direccion}</p>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="inline-block px-4 py-2 bg-red-50 text-red-700 border border-red-100 rounded-md mb-2">
                                <h1 className="text-xl font-black tracking-wider uppercase">NOTA DE CRÉDITO</h1>
                            </div>
                            <p className="font-bold text-2xl text-slate-800">{notaCredito.numero}</p>
                        </div>
                    </header>

                    {/* Info Grid */}
                    <section className="grid grid-cols-2 gap-8 mb-8">
                        <div className="relative p-5 rounded-lg border border-slate-200 bg-slate-50/50">
                            <div className="absolute top-0 left-0 bg-blue-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-br-md rounded-tl-md tracking-wider">
                                Cliente
                            </div>
                            <div className="mt-2 space-y-1">
                                <h3 className="font-bold text-lg text-slate-900 leading-tight">{cliente.nombreCompleto}</h3>
                                <p className="text-slate-600"><span className="font-semibold">ID:</span> {cliente.tipoDocumentoId} {cliente.numeroDocumento}</p>
                                <p className="text-slate-600"><span className="font-semibold">Dir:</span> {cliente.direccion}, {cliente.ciudadId}</p>
                            </div>
                        </div>
                        <div className="relative p-5 rounded-lg border border-slate-200 bg-slate-50/50">
                            <div className="absolute top-0 left-0 bg-slate-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-br-md rounded-tl-md tracking-wider">
                                Referencia
                            </div>
                            <div className="mt-2 space-y-2">
                                <div className="flex justify-between border-b border-slate-200 pb-1">
                                    <span className="text-slate-600 font-medium">Fecha de Emisión:</span>
                                    <span className="font-bold text-slate-900">{new Date(notaCredito.fechaEmision).toLocaleDateString('es-CO')}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 pb-1">
                                    <span className="text-slate-600 font-medium">Factura Afectada:</span>
                                    <span className="font-bold text-slate-900">{factura.numeroFactura}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600 font-medium">Motivo:</span>
                                    <span className="font-medium text-slate-900 truncate max-w-[150px]" title={notaCredito.motivo}>{notaCredito.motivo}</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Table */}
                    <section className="mb-8 overflow-hidden rounded-lg border border-slate-200">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wide border-b border-slate-200">
                                    <th className="p-3 border-r border-slate-200 w-24">Código</th>
                                    <th className="p-3 border-r border-slate-200">Descripción</th>
                                    <th className="p-3 border-r border-slate-200 text-right w-16">Cant.</th>
                                    <th className="p-3 border-r border-slate-200 text-right w-24">Precio</th>
                                    <th className="p-3 border-r border-slate-200 text-right w-24">Desc.</th>
                                    <th className="p-3 text-right w-24">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {notaCredito.itemsDevueltos.map((item, idx) => {
                                    const product = allProducts.find(p => p.id === item.productoId);
                                    const subtotalItem = (item.precioUnitario || 0) * (item.cantidad || 0);
                                    const valorDescuento = subtotalItem * ((item.descuentoPorcentaje || 0) / 100);
                                    const totalItem = subtotalItem - valorDescuento; // Sin IVA aquí según requerimiento layout anterior, o ajustamos
                                    // La tabla anterior mostraba subtotal vs IVA. Vamos a simplificar para evitar overlapping.

                                    return (
                                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                            <td className="p-3 border-r border-slate-100 text-slate-600 text-xs whitespace-nowrap">{product?.referencia || 'N/A'}</td>
                                            <td className="p-3 border-r border-slate-100 text-slate-800 font-medium text-xs break-words max-w-[200px]">{item.descripcion || product?.nombre}</td>
                                            <td className="p-3 border-r border-slate-100 text-right text-slate-600">{item.cantidad}</td>
                                            <td className="p-3 border-r border-slate-100 text-right text-slate-600 whitespace-nowrap">{formatCurrency(item.precioUnitario)}</td>
                                            <td className="p-3 border-r border-slate-100 text-right text-red-500 whitespace-nowrap">{item.descuentoPorcentaje > 0 ? `${item.descuentoPorcentaje}%` : '-'}</td>
                                            <td className="p-3 text-right font-bold text-slate-900 whitespace-nowrap bg-slate-50">{formatCurrency(item.subtotal ?? totalItem)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </section>

                    {/* Totals */}
                    <section className="flex justify-end mb-12">
                        <div className="w-1/2 bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm">
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr className="text-slate-600">
                                        <td className="py-1 pr-4 text-right font-medium">Subtotal Bruto</td>
                                        <td className="py-1 text-right">{formatCurrency(notaCredito.subtotal + totalDescuentos)}</td>
                                    </tr>
                                    <tr className="text-red-500">
                                        <td className="py-1 pr-4 text-right font-medium">Descuentos</td>
                                        <td className="py-1 text-right">-{formatCurrency(totalDescuentos)}</td>
                                    </tr>
                                    <tr className="border-t border-slate-200">
                                        <td className="py-1 pr-4 text-right font-bold text-slate-800 pt-2">Subtotal Neto</td>
                                        <td className="py-1 text-right font-bold text-slate-800 pt-2">{formatCurrency(notaCredito.subtotal)}</td>
                                    </tr>
                                    <tr className="text-slate-600">
                                        <td className="py-1 pr-4 text-right font-medium">IVA</td>
                                        <td className="py-1 text-right">{formatCurrency(notaCredito.iva)}</td>
                                    </tr>
                                    <tr className="bg-blue-600 text-white rounded-lg overflow-hidden mt-2 block">
                                        {/* Hack para rounded tr en table no funciona simple, usaremos estilo directo */}
                                    </tr>
                                    {/* Total destacado */}
                                    <tr>
                                        <td colSpan={2} className="pt-3">
                                            <div className="flex justify-between items-center bg-slate-900 text-white p-3 rounded-md shadow-md">
                                                <span className="font-bold text-lg uppercase">Total a Devolver</span>
                                                <span className="font-bold text-xl">{formatCurrency(notaCredito.total)}</span>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <footer className="grid grid-cols-2 gap-12 mt-auto pt-8 border-t border-slate-200">
                    <div className="text-center">
                        <div className="h-16 w-full border-b border-dashed border-slate-400 mb-2"></div>
                        <p className="font-bold text-slate-700 text-xs uppercase tracking-wider">Autorizado Por</p>
                        <p className="text-[10px] text-slate-500">{empresa.nombre}</p>
                    </div>
                    <div className="text-center">
                        <div className="h-16 w-full border-b border-dashed border-slate-400 mb-2"></div>
                        <p className="font-bold text-slate-700 text-xs uppercase tracking-wider">Recibido a Conformidad</p>
                        <p className="text-[10px] text-slate-500">C.C. / NIT</p>
                    </div>
                </footer>
            </div>
        );
    });

export default NotaCreditoPDF;