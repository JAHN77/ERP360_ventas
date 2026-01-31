import React, { useEffect, useState } from 'react';
import { InvProducto } from '../../types';
import { apiClient } from '../../services/apiClient';

interface ProductDetailsProps {
    producto: InvProducto;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

const ProductDetails: React.FC<ProductDetailsProps> = ({ producto }) => {
    const precioConIva = ((producto as any).ultimoCosto || 0) * (1 + (((producto as any).tasaIva || 0) / 100));
    const hasIva = ((producto as any).tasaIva ?? 0) > 0;

    // Estado para desglose de stock
    const [stockDetails, setStockDetails] = useState<Array<{ codalm: string; nombreBodega: string; cantidad: number }>>([]);
    const [loadingStock, setLoadingStock] = useState(false);

    useEffect(() => {
        if (producto?.id) {
            setLoadingStock(true);
            apiClient.getProductStock(producto.id)
                .then(res => {
                    if (res.success && res.data) {
                        setStockDetails(res.data);
                    }
                })
                .catch(err => console.error(err))
                .finally(() => setLoadingStock(false));
        }
    }, [producto]);

    const DetailItem = ({ label, value, icon, highlight = false }: { label: string; value: React.ReactNode; icon?: string; highlight?: boolean }) => (
        <div className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${highlight ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
            {icon && (
                <div className={`mt-1 w-5 text-center ${highlight ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    <i className={`fas ${icon}`}></i>
                </div>
            )}
            <div className="flex-1">
                <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${highlight ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>{label}</p>
                <div className={`text-sm font-medium break-words ${highlight ? 'text-blue-900 dark:text-blue-100' : 'text-slate-800 dark:text-slate-200'}`}>
                    {value || <span className="text-slate-400 italic">No especificado</span>}
                </div>
            </div>
        </div>
    );

    const SectionTitle = ({ title, icon }: { title: string; icon: string }) => (
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <i className={`fas ${icon}`}></i>
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        </div>
    );

    return (
        <div className="space-y-8 p-2">
            {/* Header Summary */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-100 dark:border-slate-700">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{producto.nombre}</h2>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                <i className="fas fa-barcode mr-1.5 text-slate-400"></i>
                                {producto.referencia || 'S/R'}
                            </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl leading-relaxed">
                            {(producto as any).descripcion || 'Sin descripción disponible.'}
                        </p>
                    </div>
                    {producto.idTipoProducto !== 2 && (
                        <div className="flex flex-col items-end gap-2">
                            <div className={`px-4 py-2 rounded-lg text-center min-w-[120px] ${(producto as any).stock < 10 ? 'bg-red-50 border border-red-100 dark:bg-red-900/20 dark:border-red-800' : 'bg-green-50 border border-green-100 dark:bg-green-900/20 dark:border-green-800'}`}>
                                <span className={`block text-xs font-bold uppercase tracking-wider ${(producto as any).stock < 10 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>Stock Actual</span>
                                <span className={`text-2xl font-bold ${(producto as any).stock < 10 ? 'text-red-800 dark:text-red-300' : 'text-green-800 dark:text-green-300'}`}>{(producto as any).stock ?? 0}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>


            {/* Nueva Sección: Distribución de Stock por Bodega */}
            {producto.idTipoProducto !== 2 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <SectionTitle title="Distribución de Inventario" icon="fa-warehouse" />

                    {loadingStock ? (
                        <div className="text-center py-4 text-slate-500"><i className="fas fa-spinner fa-spin mr-2"></i>Cargando inventario...</div>
                    ) : stockDetails.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {stockDetails.map((bodega) => (
                                <div key={bodega.codalm} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 gap-3">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex-shrink-0 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                            <i className="fas fa-building text-xs"></i>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase truncate">{bodega.codalm}</div>
                                            <div className="text-sm font-medium text-slate-800 dark:text-slate-200 break-words line-clamp-2" title={bodega.nombreBodega}>{bodega.nombreBodega}</div>
                                        </div>
                                    </div>
                                    <div className={`text-lg font-bold whitespace-nowrap flex-shrink-0 ${bodega.cantidad > 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                        {bodega.cantidad}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-500 dark:text-slate-400 italic">No hay información de stock disponible.</p>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Columna Izquierda */}
                <div className="space-y-8">
                    <section>
                        <SectionTitle title="Información General" icon="fa-box" />
                        <div className="grid grid-cols-1 gap-1">
                            <DetailItem label="Referencia" value={producto.referencia} icon="fa-hashtag" />
                            <DetailItem label="Unidad de Medida" value={(producto as any).unidadMedidaNombre || (producto as any).unidadMedida || 'Unidad'} icon="fa-ruler" />
                            <DetailItem label="Categoría" value={(producto as any).categoriaNombre || 'General'} icon="fa-folder" />
                            <DetailItem label="Marca" value={(producto as any).marca || 'Genérica'} icon="fa-tag" />
                        </div>
                    </section>
                </div>

                {/* Columna Derecha */}
                <div className="space-y-8">
                    <section>
                        <SectionTitle title="Precios e Impuestos" icon="fa-hand-holding-usd" />
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                            <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-900/10">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-xs text-blue-600 dark:text-blue-400 uppercase font-bold tracking-wider mb-1">Precio de Venta</p>
                                        <p className="text-3xl font-bold text-slate-800 dark:text-white">
                                            {formatCurrency(precioConIva)}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Incluye todos los impuestos</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${hasIva ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                                            {hasIva ? `IVA ${(producto as any).tasaIva}%` : 'Exento de IVA'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-2 grid grid-cols-1 gap-1">
                                <DetailItem label="Costo Base" value={formatCurrency((producto as any).ultimoCosto || 0)} icon="fa-dollar-sign" />
                                <DetailItem label="Utilidad Estimada" value={`${(producto as any).margenUtilidad || 0}%`} icon="fa-percentage" />
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div >
    );
};

export default ProductDetails;
