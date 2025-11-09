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

const LogoPlaceholder: React.FC<{ variant?: 'default' | 'inverse' }> = ({ variant = 'default' }) => (
    <div
        className={`h-16 w-16 flex items-center justify-center rounded-2xl border ${
            variant === 'inverse'
                ? 'bg-white/10 border-white/30 text-white'
                : 'bg-slate-100 border-slate-200 text-slate-400'
        }`}
    >
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.2}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2 1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
        </svg>
    </div>
);

const QRCode: React.FC<{ cufe: string }> = ({ cufe }) => (
  <div className="w-24 h-24 p-1 border" aria-label={`QR Code for CUFE`}>
    <a href={`https://catalogo-vpfe.dian.gov.co/document/searchqr?cufe=${cufe}`} target="_blank" rel="noopener noreferrer">
        <div className="w-full h-full bg-slate-50 flex items-center justify-center">
            <i className="fas fa-qrcode text-5xl text-slate-800"></i>
        </div>
    </a>
  </div>
);

const FacturaPDF = React.forwardRef<HTMLDivElement, FacturaPDFProps>(
    ({ factura, cliente, empresa, preferences }, ref) => {
    const { productos: allProducts } = useData();
    const accentGradient = 'linear-gradient(135deg, var(--color-primario, #1d4ed8) 0%, #1e3a8a 45%, #0ea5e9 100%)';
    const accentColor = 'var(--color-primario, #1d4ed8)';
    const dangerColor = 'var(--color-secundario, #ef4444)';
    const subtleSurface = 'rgba(15, 23, 42, 0.04)';

    const totalDescuentos = factura.items.reduce((acc, item) => {
        const itemTotal = item.precioUnitario * item.cantidad;
        return acc + (itemTotal * (item.descuentoPorcentaje / 100));
    }, 0);

    return (
        <div
            ref={ref}
            className="relative flex flex-col gap-0 rounded-[28px] border border-slate-200/60 bg-white text-slate-800 shadow-[0_24px_80px_rgba(15,23,42,0.12)] font-sans text-[13px] leading-relaxed"
        >
            <header
                className="flex items-start justify-between gap-10 px-12 py-10 text-white"
                style={{ background: accentGradient }}
            >
                <div className="flex items-start gap-5">
                    <LogoPlaceholder variant="inverse" />
                    <div className="space-y-1.5">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/70">Detalle de la Empresa</p>
                        <h2 className="text-2xl font-bold tracking-tight">{empresa.nombre}</h2>
                        <p className="text-sm font-medium text-white/80">NIT: {empresa.nit}</p>
                        {preferences.detailLevel === 'full' && (
                            <div className="text-sm text-white/80 space-y-0.5">
                                <p>{empresa.regimen}</p>
                                <p>{empresa.direccion} · {empresa.ciudad}</p>
                                <p>{empresa.telefono}</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-3 text-right">
                    <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3">
                        <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">Factura de Venta</h1>
                        <p className="mt-1 text-3xl font-black tracking-tight">{factura.numeroFactura}</p>
                    </div>
                    {preferences.detailLevel === 'full' && (
                        <div className="rounded-xl bg-white/12 px-4 py-3 text-xs leading-5 text-white/80">
                            <p className="font-semibold uppercase tracking-widest text-white/70">Resolución DIAN</p>
                            <p>{empresa.resolucionDian}</p>
                            <p>Rango habilitado: {empresa.rangoNumeracion}</p>
                        </div>
                    )}
                </div>
            </header>

            <main className="flex flex-col gap-8 bg-gradient-to-b from-white via-white to-slate-50 px-12 py-10">
                <section className="grid grid-cols-2 gap-6">
                    <div
                        className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm"
                        style={{ boxShadow: '0 20px 40px rgba(15, 23, 42, 0.06)' }}
                    >
                        <h3 className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">Cliente</h3>
                        <p className="mt-2 text-lg font-bold text-slate-900">{cliente.nombreCompleto}</p>
                        <div className="mt-3 space-y-1 text-sm text-slate-600">
                            <p><span className="font-semibold text-slate-700">{cliente.tipoDocumentoId}:</span> {cliente.numeroDocumento}</p>
                        <p>{cliente.direccion}, {cliente.ciudadId}</p>
                            <p>{cliente.email}</p>
                        </div>
                    </div>
                    <div
                        className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm"
                        style={{ boxShadow: '0 20px 40px rgba(15, 23, 42, 0.06)' }}
                    >
                        <h3 className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">Condiciones Comerciales</h3>
                        <div className="mt-3 space-y-1 text-sm text-slate-600">
                            <p><span className="font-semibold text-slate-700">Fecha de emisión:</span> {new Date(factura.fechaFactura).toLocaleDateString('es-CO')}</p>
                            <p><span className="font-semibold text-slate-700">Forma de pago:</span> {cliente.condicionPago}</p>
                            {preferences.detailLevel === 'full' && (
                                <p><span className="font-semibold text-slate-700">Fecha de vencimiento:</span> {new Date(factura.fechaVencimiento || factura.fechaFactura).toLocaleDateString('es-CO')}</p>
                            )}
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200/70 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)] overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr
                                className="text-xs font-semibold uppercase tracking-[0.25em] text-white"
                                style={{ background: accentGradient }}
                            >
                                <th className="px-4 py-3 text-left">Referencia</th>
                                <th className="px-4 py-3 text-left w-2/5">Descripción</th>
                                <th className="px-4 py-3 text-right">Unidad</th>
                                <th className="px-4 py-3 text-right">Cantidad</th>
                                <th className="px-4 py-3 text-right">P. Unitario</th>
                                <th className="px-4 py-3 text-center">% IVA</th>
                                <th className="px-4 py-3 text-center">% Dcto</th>
                                <th className="px-4 py-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-[13px]">
                            {factura.items.map((item) => {
                                 const product = allProducts.find(p => p.id === item.productoId);
                                 return (
                                    <tr key={item.productoId} className="transition-colors even:bg-slate-50/70 hover:bg-slate-100/60">
                                        <td className="px-4 py-3 align-top font-medium text-slate-700">{product?.referencia || 'N/A'}</td>
                                        <td className="px-4 py-3 align-top text-slate-900">
                                            <p className="font-semibold">{item.descripcion}</p>
                                            {preferences.detailLevel === 'full' && product?.nombre && (
                                                <p className="text-xs text-slate-500">SKU: {product.nombre}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 align-top text-right text-slate-600">{product?.unidadMedida || '—'}</td>
                                        <td className="px-4 py-3 align-top text-right font-semibold text-slate-700">{item.cantidad}</td>
                                        <td className="px-4 py-3 align-top text-right text-slate-700">{formatCurrency(item.precioUnitario)}</td>
                                        <td className="px-4 py-3 align-top text-center text-slate-700">{item.ivaPorcentaje.toFixed(2)}</td>
                                        <td className="px-4 py-3 align-top text-center">
                                            <span
                                                className="inline-flex min-w-[48px] justify-center rounded-full px-2 py-1 text-xs font-semibold"
                                                style={{
                                                    background: subtleSurface,
                                                    color: Number(item.descuentoPorcentaje) > 0 ? dangerColor : accentColor,
                                                }}
                                            >
                                                {item.descuentoPorcentaje.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 align-top text-right font-semibold text-slate-900">{formatCurrency(item.total)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </section>
                
                <section className="grid grid-cols-2 gap-6">
                    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                        {preferences.signatureType === 'digital' && factura.cufe ? (
                            <div className="flex items-start gap-4">
                                <div className="rounded-xl border border-slate-200/60 bg-slate-50/70 p-3">
                                    <QRCode cufe={factura.cufe} />
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Validación Fiscal</h4>
                                    <p className="text-xs leading-5 text-slate-600">
                                        Escanee el código QR para validar la autenticidad de este documento en el portal DIAN o copie el CUFE abajo.
                                    </p>
                                    <p className="rounded-xl bg-slate-900/90 px-3 py-2 text-[11px] font-semibold text-emerald-200 shadow-inner">
                                        CUFE: <span className="break-all text-white">{factura.cufe}</span>
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-5 text-amber-700 shadow-inner">
                                <p className="text-sm font-semibold">Factura en estado “Borrador”.</p>
                                <p className="mt-1 text-xs leading-5">
                                    Este documento no tiene validez fiscal hasta ser timbrado conforme a la resolución DIAN vigente.
                                </p>
                            </div>
                        )}
                    </div>
                     <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                        <table className="w-full text-[13px] text-slate-700">
                            <tbody className="space-y-2">
                                <tr className="border-b border-dashed border-slate-200/70 text-slate-600">
                                    <td className="py-1 pr-4 text-right font-medium uppercase tracking-[0.25em] text-slate-400">Subtotal bruto</td>
                                    <td className="py-1 text-right font-semibold text-slate-800">{formatCurrency(factura.subtotal + totalDescuentos)}</td>
                                </tr>
                                <tr className="border-b border-dashed border-slate-200/70 text-slate-600">
                                    <td className="py-1 pr-4 text-right font-medium uppercase tracking-[0.25em] text-slate-400">Descuentos</td>
                                    <td className="py-1 text-right font-semibold text-rose-600">-{formatCurrency(totalDescuentos)}</td>
                                </tr>
                                <tr className="border-b border-dashed border-slate-200/70 text-slate-600">
                                    <td className="py-1 pr-4 text-right font-medium uppercase tracking-[0.25em] text-slate-400">Subtotal neto</td>
                                    <td className="py-1 text-right font-semibold text-slate-800">{formatCurrency(factura.subtotal)}</td>
                                </tr>
                                <tr className="text-slate-600">
                                    <td className="py-1 pr-4 text-right font-medium uppercase tracking-[0.25em] text-slate-400">IVA (19%)</td>
                                    <td className="py-1 text-right font-semibold text-slate-800">{formatCurrency(factura.ivaValor)}</td>
                                </tr>
                                <tr
                                    className="text-lg font-bold text-white"
                                    style={{ background: accentGradient }}
                                >
                                    <td className="rounded-l-xl px-4 py-3 text-right uppercase tracking-[0.35em] text-white/80">Total</td>
                                    <td className="rounded-r-xl px-4 py-3 text-right text-2xl font-black tracking-tight">{formatCurrency(factura.total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
            
            {(preferences.signatureType === 'physical' || preferences.detailLevel === 'full') && (
                <footer className="flex flex-col gap-6 border-t border-slate-200/70 bg-white px-12 py-8">
                    {preferences.signatureType === 'physical' && (
                        <div className="grid grid-cols-2 gap-16">
                            <div className="text-center">
                                <div className="rounded-2xl border border-slate-300/80 px-6 py-5">
                                    <p className="font-semibold text-slate-700 tracking-wide">ELABORADO POR</p>
                                    <p className="mt-1 text-xs text-slate-500 uppercase tracking-[0.35em]">Nombre y Firma</p>
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="rounded-2xl border border-slate-300/80 px-6 py-5">
                                    <p className="font-semibold text-slate-700 tracking-wide">RECIBIDO Y ACEPTADO</p>
                                    <p className="mt-1 text-xs text-slate-500 uppercase tracking-[0.35em]">Nombre · Firma · C.C. · Sello</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {preferences.detailLevel === 'full' && (
                        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/90 px-6 py-4 text-center text-[11px] text-slate-500">
                            <p>Esta es una representación impresa de una Factura de Venta generada electrónicamente conforme a la Resolución DIAN vigente.</p>
                            {factura.cufe && <p className="mt-1">Escanee el código QR para verificar la validez de esta factura en el portal DIAN.</p>}
                        </div>
                    )}
                </footer>
            )}

        </div>
    );
});

export default FacturaPDF;