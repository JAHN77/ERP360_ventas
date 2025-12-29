import React from 'react';
import { Pedido, Cliente, DocumentPreferences } from '../../types';
import { useData } from '../../hooks/useData';
import { defaultPreferences } from '../../hooks/useDocumentPreferences';

interface PedidoPDFProps {
    pedido: Pedido;
    cliente: Cliente;
    empresa: {
        nombre: string;
        nit: string;
        direccion: string;
        telefono?: string;
    };
    preferences?: DocumentPreferences;
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

export const PedidoPDF = React.forwardRef<HTMLDivElement, PedidoPDFProps>(
    ({ pedido, cliente, empresa, preferences = defaultPreferences.pedido }, ref) => {
        const { productos: allProducts, cotizaciones } = useData();

        const totalDescuentos = pedido.items.reduce((acc, item) => {
            const itemTotal = item.precioUnitario * item.cantidad;
            return acc + (itemTotal * (item.descuentoPorcentaje / 100));
        }, 0);

        const cotizacionOrigen = cotizaciones.find(c => c.id === pedido.cotizacionId);

        return (
            <div ref={ref} className="p-10 text-slate-800 bg-white font-sans text-sm print-content">
                {/* Header */}
                <header className="flex justify-between items-start mb-8 pb-4 border-b border-slate-200">
                    <div className="flex items-start gap-4">
                        <LogoPlaceholder />
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">{empresa.nombre}</h2>
                            <p className="text-sm text-slate-600">NIT: {empresa.nit}</p>
                            <p className="text-sm text-slate-600">{empresa.direccion}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h1 className="text-2xl font-bold text-slate-900">ORDEN DE COMPRA</h1>
                        <p className="font-semibold text-xl text-red-600">{pedido.numeroPedido}</p>
                    </div>
                </header>

                {/* Delivery and Billing Info */}
                <section className="grid grid-cols-2 gap-x-6 my-8">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
                        <h3 className="text-xs font-semibold text-slate-500 mb-1 tracking-wider uppercase">DIRECCIÓN DE ENTREGA</h3>
                        <p className="font-bold text-base text-slate-900">{cliente.nombreCompleto}</p>
                        <p className="text-sm text-slate-600">{cliente.direccion}, {cliente.ciudadId}</p>
                        <p className="text-sm text-slate-600">{cliente.telefono}</p>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
                        <h3 className="text-xs font-semibold text-slate-500 mb-1 tracking-wider uppercase">CONDICIONES DEL PEDIDO</h3>
                        <p className="text-sm"><span className="font-semibold text-slate-700 w-32 inline-block">Fecha de Emisión:</span> {new Date(pedido.fechaPedido).toLocaleDateString('es-CO')}</p>
                        <p className="text-sm"><span className="font-semibold text-slate-700 w-32 inline-block">Cotización Ref:</span> {cotizacionOrigen?.numeroCotizacion || 'Venta Directa'}</p>
                        <p className="text-sm"><span className="font-semibold text-slate-700 w-32 inline-block">Cond. de Pago:</span> {cliente.condicionPago}</p>
                    </div>
                </section>

                {/* Items Table */}
                <section className="mb-8">
                    <table className="w-full text-left">
                        <thead className="rounded-lg">
                            <tr className="bg-blue-800 text-white text-sm font-semibold">
                                <th className="p-3 text-left rounded-tl-lg whitespace-nowrap">Referencia</th>
                                <th className="p-3 text-left w-2/5 whitespace-nowrap">Descripción</th>
                                <th className="p-3 text-left whitespace-nowrap">Unidad</th>
                                <th className="p-3 text-right whitespace-nowrap">Cant.</th>
                                {preferences.showPrices && (
                                    <>
                                        <th className="p-3 text-right whitespace-nowrap">P. Unitario</th>
                                        <th className="p-3 text-right whitespace-nowrap">Subtotal</th>
                                        <th className="p-3 text-right rounded-tr-lg whitespace-nowrap">Valor IVA</th>
                                    </>
                                )}
                                {!preferences.showPrices && <th className="p-3 text-right rounded-tr-lg"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {pedido.items.map((item) => {
                                const product = allProducts.find(p => p.id === item.productoId);
                                // Usar referencia del item si está disponible, sino buscar en el producto
                                const referencia = (item as any).referencia || product?.referencia || 'N/A';
                                return (
                                    <tr key={item.productoId} className="text-sm">
                                        <td className="p-3 text-slate-800 align-top">{referencia}</td>
                                        <td className="p-3 font-semibold text-slate-800 align-top">{item.descripcion}</td>
                                        <td className="p-3 text-slate-800 align-top">{(item as any).unidadMedida || item.codigoMedida || product?.unidadMedida || 'N/A'}</td>
                                        <td className="p-3 text-right text-slate-800 align-top">{item.cantidad}</td>
                                        {preferences.showPrices && (
                                            <>
                                                <td className="p-3 text-right text-slate-800 align-top">{formatCurrency(item.precioUnitario)}</td>
                                                <td className="p-3 text-right font-medium text-slate-800 align-top">{formatCurrency(item.subtotal)}</td>
                                                <td className="p-3 text-right text-slate-800 align-top">{formatCurrency(item.valorIva)}</td>
                                            </>
                                        )}
                                        {!preferences.showPrices && <td></td>}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </section>

                {/* Totals and Observations */}
                <section className="flex justify-between items-start">
                    <div className="w-1/2 text-slate-600">
                        <h3 className="text-xs font-semibold text-slate-500 mb-1 tracking-wider uppercase">Observaciones</h3>
                        <p className="p-2 border border-slate-200 rounded-md bg-slate-50 h-24 text-sm">
                            {pedido.observaciones || 'Sujeto a términos y condiciones estándar.'}
                        </p>
                    </div>
                    {preferences.showPrices && (
                        <div className="w-2/5">
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr className="text-slate-700">
                                        <td className="py-1 pr-4 text-right">Subtotal Bruto</td>
                                        <td className="py-1 text-right font-medium">{formatCurrency(pedido.subtotal + totalDescuentos)}</td>
                                    </tr>
                                    <tr className="text-red-500">
                                        <td className="py-1 pr-4 text-right">Descuentos</td>
                                        <td className="py-1 text-right font-medium">-{formatCurrency(totalDescuentos)}</td>
                                    </tr>
                                    <tr className="text-slate-800 font-semibold border-t border-blue-200">
                                        <td className="py-1 pr-4 text-right">Subtotal Neto</td>
                                        <td className="py-1 text-right">{formatCurrency(pedido.subtotal)}</td>
                                    </tr>
                                    <tr className="text-slate-700">
                                        <td className="pt-1 pb-2 pr-4 text-right">IVA ({pedido.items[0]?.ivaPorcentaje || 19}%)</td>
                                        <td className="pt-1 pb-2 text-right font-medium">{formatCurrency(pedido.ivaValor)}</td>
                                    </tr>
                                    <tr className="font-bold text-lg bg-blue-800 text-white shadow-lg">
                                        <td className="p-2 text-right rounded-l-lg">TOTAL</td>
                                        <td className="p-2 text-right rounded-r-lg">{formatCurrency(pedido.total)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* Signature */}
                {preferences.signatureType === 'physical' && (
                    <footer className="mt-24 pt-10 text-center">
                        <div className="inline-block border-t-2 border-slate-400 pt-2 px-16">
                            <p className="font-semibold text-slate-700">APROBADO POR</p>
                            <p className="text-xs text-slate-500">(Firma, Nombre y Sello)</p>
                        </div>
                    </footer>
                )}
            </div>
        );
    });