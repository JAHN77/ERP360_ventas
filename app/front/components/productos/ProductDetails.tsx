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

    const InfoCard = ({ title, children, icon }: { title: string; children: React.ReactNode; icon: string }) => (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                    <i className={`fas ${icon} text-slate-600 dark:text-slate-400 text-sm`}></i>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
                </div>
            </div>
            <div className="p-4">
                {children}
            </div>
        </div>
    );

    const DataRow = ({ label, value, icon }: { label: string; value: React.ReactNode; icon?: string }) => (
        <div className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
            <div className="flex items-center gap-2">
                {icon && <i className={`fas ${icon} text-slate-400 dark:text-slate-500 text-xs w-4`}></i>}
                <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
            </div>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {value || <span className="text-slate-400 italic">—</span>}
            </span>
        </div>
    );

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header con información principal */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            {producto.nombre}
                        </h2>
                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                            <span className="flex items-center gap-1.5">
                                <i className="fas fa-barcode text-xs"></i>
                                <span className="font-medium">Ref:</span> {producto.referencia || 'N/A'}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="flex items-center gap-1.5">
                                <i className="fas fa-tag text-xs"></i>
                                <span className="font-medium">Código:</span> {(producto as any).codins || (producto as any).codigo}
                            </span>
                        </div>
                    </div>
                    {producto.idTipoProducto !== 2 && (
                        <div className="text-right">
                            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Stock Total</div>
                            <div className={`text-3xl font-bold ${(producto as any).stock < 10 ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                {(producto as any).stock ?? 0}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {(producto as any).unidadMedidaNombre || 'unidades'}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Grid de información */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Información General */}
                <InfoCard title="Información General" icon="fa-info-circle">
                    <div className="space-y-0">
                        <DataRow label="Unidad de Medida" value={(producto as any).unidadMedidaNombre || (producto as any).unidadMedida || 'Unidad'} icon="fa-ruler" />
                        <DataRow label="Categoría" value={(producto as any).categoriaNombre || 'General'} icon="fa-folder" />
                        <DataRow label="Marca" value={(producto as any).marca || 'Genérica'} icon="fa-copyright" />
                        <DataRow label="Estado" value={
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${(producto as any).activo ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                                {(producto as any).activo ? 'Activo' : 'Inactivo'}
                            </span>
                        } icon="fa-circle" />
                    </div>
                </InfoCard>

                {/* Precios */}
                <InfoCard title="Precios" icon="fa-dollar-sign">
                    <div className="space-y-0">
                        <DataRow
                            label="Precio al Público"
                            value={
                                <span className="text-lg font-bold text-slate-900 dark:text-white">
                                    {formatCurrency((producto as any).precio_lista || precioConIva)}
                                </span>
                            }
                            icon="fa-shopping-cart"
                        />
                        {/* Solo mostrar Precio de Venta si es diferente al Precio al Público */}
                        {(producto as any).Precio_Venta && Math.abs((producto as any).Precio_Venta - ((producto as any).precio_lista || 0)) > 0.5 && (
                            <DataRow label="Precio de Venta (sin IVA)" value={formatCurrency((producto as any).Precio_Venta)} icon="fa-tag" />
                        )}
                        <DataRow
                            label="IVA"
                            value={
                                <span className={hasIva ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                                    {hasIva ? `${(producto as any).tasaIva}%` : 'Exento'}
                                </span>
                            }
                            icon="fa-percent"
                        />
                    </div>
                </InfoCard>

                {/* Márgenes y Descuentos */}
                <InfoCard title="Márgenes y Descuentos" icon="fa-chart-line">
                    <div className="space-y-0">
                        <DataRow label="Margen de Venta" value={`${Number((producto as any).margen_venta || 0).toFixed(2)}%`} icon="fa-percentage" />
                        <DataRow label="Descuento Aplicado" value={`${Number((producto as any).tasa_descuento || 0).toFixed(2)}%`} icon="fa-percent" />
                    </div>
                </InfoCard>

                {/* Costos de Inventario */}
                {producto.idTipoProducto !== 2 && (() => {
                    // Consolidar valores de costo que sean iguales
                    const costoProducto = (producto as any).costo_producto || 0;
                    const ultimoCosto = (producto as any).ultimoCosto || (producto as any).ultimoCostoCompra || 0;
                    const costoPromedio = (producto as any).costoPromedio || 0;
                    const valorInventario = (producto as any).Valinv || 0;

                    // Usar el costo principal
                    const costoReal = costoProducto || ultimoCosto;

                    return (
                        <InfoCard title="Costos de Inventario" icon="fa-calculator">
                            <div className="space-y-0">
                                <DataRow
                                    label="Costo Unitario"
                                    value={formatCurrency(costoReal)}
                                    icon="fa-dollar-sign"
                                />
                                <DataRow
                                    label="Valor Total de Inventario"
                                    value={formatCurrency(valorInventario)}
                                    icon="fa-money-bill-wave"
                                />
                            </div>
                        </InfoCard>
                    );
                })()}
            </div>

            {/* Distribución de Stock por Bodega */}
            {producto.idTipoProducto !== 2 && (
                <InfoCard title="Distribución de Inventario por Bodega" icon="fa-warehouse">
                    {loadingStock ? (
                        <div className="text-center py-8 text-slate-500">
                            <i className="fas fa-spinner fa-spin text-2xl mb-2"></i>
                            <p className="text-sm">Cargando inventario...</p>
                        </div>
                    ) : stockDetails.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {stockDetails.map((bodega) => (
                                <div key={bodega.codalm} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-600 flex-shrink-0 flex items-center justify-center">
                                            <i className="fas fa-building text-slate-600 dark:text-slate-300 text-sm"></i>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{bodega.codalm}</div>
                                            <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate" title={bodega.nombreBodega}>
                                                {bodega.nombreBodega}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`text-xl font-bold whitespace-nowrap flex-shrink-0 ml-3 ${bodega.cantidad > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                                        {bodega.cantidad}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                            No hay información de stock disponible
                        </p>
                    )}
                </InfoCard>
            )}
        </div>
    );
};

export default ProductDetails;
