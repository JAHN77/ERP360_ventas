import React, { useMemo } from 'react';
import { Remision, Pedido, Cliente, DocumentPreferences } from '../../types';
import { useData } from '../../hooks/useData';

interface RemisionPDFProps {
    remision: Remision;
    pedido: Pedido;
    cliente: Cliente;
    empresa: {
        nombre: string;
        nit: string;
        direccion: string;
        ciudad: string;
        telefono: string;
    };
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


const RemisionPDF = React.forwardRef<HTMLDivElement, RemisionPDFProps>(
    ({ remision, pedido, cliente, empresa, preferences }, ref) => {
    const { productos: allProducts } = useData();
    
    const totals = useMemo(() => {
        if (!preferences.showPrices) return null;
        
        const subtotalBruto = remision.items.reduce((acc, item) => acc + (item.precioUnitario * item.cantidad), 0);
        const descuentoTotal = remision.items.reduce((acc, item) => {
            const itemTotalBruto = item.precioUnitario * item.cantidad;
            return acc + (itemTotalBruto * (item.descuentoPorcentaje / 100));
        }, 0);
        const subtotalNeto = subtotalBruto - descuentoTotal;
        const iva = remision.items.reduce((acc, item) => acc + (item.total * (item.ivaPorcentaje / 100)), 0);
        const total = subtotalNeto + iva;

        return { subtotalBruto, descuentoTotal, subtotalNeto, iva, total };
    }, [remision.items, preferences.showPrices]);

    return (
        <div ref={ref} className="p-10 text-slate-800 bg-white font-sans text-sm">
            <header className="flex justify-between items-start mb-10">
                <div className="flex items-start gap-4">
                    <LogoPlaceholder />
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">{empresa.nombre}</h2>
                        <p className="text-sm text-slate-600">NIT: {empresa.nit}</p>
                        <p className="text-sm text-slate-600">{empresa.direccion}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="text-2xl font-bold text-slate-900">NOTA DE REMISIÓN</h1>
                    <p className="font-semibold text-xl">{remision.numeroRemision}</p>
                    <div className="mt-4 text-sm text-slate-600">
                        <p><span className="font-semibold text-slate-700">Fecha de Emisión:</span> {new Date(remision.fechaRemision).toLocaleDateString('es-CO')}</p>
                        <p><span className="font-semibold text-slate-700">Pedido Origen:</span> {pedido.numeroPedido}</p>
                    </div>
                </div>
            </header>

            <section className="grid grid-cols-2 gap-6 mb-10">
                <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
                    <h3 className="text-xs font-semibold text-slate-500 mb-2 tracking-wider uppercase">Origen (Entrega)</h3>
                    <p className="font-bold text-base text-slate-900">{empresa.nombre}</p>
                    <p className="text-sm text-slate-600">{empresa.direccion}</p>
                    <p className="text-sm text-slate-600">{empresa.ciudad}</p>
                </div>
                <div className="p-4 border border-slate-200 rounded-md bg-slate-50">
                    <h3 className="text-xs font-semibold text-slate-500 mb-2 tracking-wider uppercase">Destino (Recibe)</h3>
                    <p className="font-bold text-base text-slate-900">{cliente.nombreCompleto}</p>
                    <p className="text-sm text-slate-600">{cliente.direccion}</p>
                    <p className="text-sm text-slate-600">{cliente.ciudadId}</p>
                </div>
            </section>
            
            <section className="mb-10 p-4 border border-slate-200 rounded-md">
                 <h3 className="text-xs font-semibold text-slate-500 mb-2 tracking-wider uppercase">Detalles Logísticos</h3>
                 <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-600">
                    <p><span className="font-semibold text-slate-700 w-32 inline-block">Método de Envío:</span>
                        {
                            remision.metodoEnvio === 'transportadoraExterna' ? 'Transportadora Externa' :
                            remision.metodoEnvio === 'transportePropio' ? 'Transporte Propio' : 'Recoge Cliente'
                        }
                    </p>
                    {remision.transportadora && (
                        <p><span className="font-semibold text-slate-700 w-32 inline-block">Transportadora:</span> {remision.transportadora}</p>
                    )}
                    {remision.numeroGuia && (
                        <p><span className="font-semibold text-slate-700 w-32 inline-block">Número de Guía:</span> {remision.numeroGuia}</p>
                    )}
                    {remision.fechaDespacho && (
                         <p><span className="font-semibold text-slate-700 w-32 inline-block">Fecha de Despacho:</span> {remision.fechaDespacho}</p>
                    )}
                </div>
            </section>

            <section className="mb-10">
                <table className="w-full text-left">
                    <thead className="rounded-lg">
                        <tr className="bg-blue-800 text-white text-sm font-semibold">
                            <th className="p-3 text-left rounded-tl-lg whitespace-nowrap">Referencia</th>
                            <th className="p-3 text-left w-2/5 whitespace-nowrap">Descripción</th>
                            <th className="p-3 text-left whitespace-nowrap">Unidad</th>
                            <th className="p-3 text-right whitespace-nowrap">Cant. Enviada</th>
                            {preferences.showPrices ? (
                                <>
                                    <th className="p-3 text-right whitespace-nowrap">P. Unitario</th>
                                    <th className="p-3 text-right whitespace-nowrap">Subtotal</th>
                                    <th className="p-3 text-right rounded-tr-lg whitespace-nowrap">Valor IVA</th>
                                </>
                            ) : (
                                <th className="p-3 text-right rounded-tr-lg"></th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {remision.items.map((item, index) => {
                            // Buscar producto por ID (puede ser numérico o string)
                            const product = allProducts.find(p => 
                                String(p.id) === String(item.productoId) ||
                                p.id === item.productoId
                            );
                            
                            // Obtener nombre del producto: primero del producto encontrado, luego del item
                            const productoNombre = product?.nombre || 
                                                  item.descripcion || 
                                                  item.nombre || 
                                                  `Producto ${index + 1}`;
                            
                            return (
                                <tr key={item.productoId || `item-${index}`} className="text-sm">
                                    <td className="p-3 text-slate-800 align-top">{product?.referencia || 'N/A'}</td>
                                    <td className="p-3 font-semibold text-slate-800 align-top">{productoNombre}</td>
                                    <td className="p-3 text-slate-800 align-top">{product?.unidadMedida}</td>
                                    <td className="p-3 text-right text-slate-800 align-top">{item.cantidad}</td>
                                    {preferences.showPrices ? (
                                        <>
                                            <td className="p-3 text-right text-slate-800 align-top">{formatCurrency(item.precioUnitario)}</td>
                                            <td className="p-3 text-right font-semibold text-slate-800 align-top">{formatCurrency(item.total)}</td>
                                            <td className="p-3 text-right text-slate-800 align-top">{formatCurrency(item.total * (item.ivaPorcentaje / 100))}</td>
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

            {remision.observaciones && (
                <section className="mb-10">
                    <h3 className="text-xs font-semibold text-slate-500 mb-2 tracking-wider uppercase">Observaciones</h3>
                    <p className="p-4 border border-slate-200 rounded-md text-sm text-slate-600 bg-slate-50">{remision.observaciones}</p>
                </section>
            )}

            {preferences.showPrices && totals && (
                 <section className="flex justify-end items-start mt-8">
                     <div className="w-2/5">
                        <table className="w-full text-sm">
                            <tbody>
                                <tr className="text-slate-700">
                                    <td className="py-1 pr-4 text-right">Subtotal Bruto</td>
                                    <td className="py-1 text-right font-medium">{formatCurrency(totals.subtotalBruto)}</td>
                                </tr>
                                <tr className="text-red-500">
                                    <td className="py-1 pr-4 text-right">Descuentos</td>
                                    <td className="py-1 text-right font-medium">-{formatCurrency(totals.descuentoTotal)}</td>
                                </tr>
                                <tr className="text-slate-800 font-semibold border-t border-blue-200">
                                    <td className="py-1 pr-4 text-right">Subtotal Neto</td>
                                    <td className="py-1 text-right">{formatCurrency(totals.subtotalNeto)}</td>
                                </tr>
                                <tr className="text-slate-700">
                                    <td className="pt-1 pb-2 pr-4 text-right">IVA ({remision.items[0]?.ivaPorcentaje || 19}%)</td>
                                    <td className="pt-1 pb-2 text-right font-medium">{formatCurrency(totals.iva)}</td>
                                </tr>
                                <tr className="font-bold text-lg bg-blue-800 text-white shadow-lg">
                                    <td className="p-2 text-right rounded-l-lg">TOTAL</td>
                                    <td className="p-2 text-right rounded-r-lg">{formatCurrency(totals.total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
            
            {preferences.signatureType === 'physical' && (
                <footer className="mt-24 grid grid-cols-2 gap-16 pt-10">
                     <div className="text-center">
                        <div className="border-t-2 border-slate-400 pt-2">
                            <p className="font-semibold text-slate-700">ENTREGADO POR</p>
                            <p className="text-xs text-slate-500">(Nombre y Firma)</p>
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="border-t-2 border-slate-400 pt-2">
                            <p className="font-semibold text-slate-700">RECIBIDO POR</p>
                            <p className="text-xs text-slate-500">(Nombre, Firma, C.C. y Sello)</p>
                        </div>
                    </div>
                </footer>
            )}
            {preferences.signatureType === 'digital' && (
                 <footer className="mt-24 text-center text-sm text-slate-600">
                    <p>Documento validado digitalmente.</p>
                    <p className="font-bold">ID de Entrega: {remision.id}</p>
                 </footer>
            )}
        </div>
    );
});

export default RemisionPDF;