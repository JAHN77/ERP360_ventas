import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import Card from '../components/ui/Card';
import PageContainer from '../components/ui/PageContainer';
import SectionHeader from '../components/ui/SectionHeader';
import TablePagination from '../components/ui/TablePagination';
import { ProductoConteo } from '../types';
import { apiGetProductosParaConteo, apiAplicarConteo } from '../services/apiClient';
import * as XLSX from 'xlsx';

const DetalleConteoFisicoPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { addNotification } = useNotifications();

    const [productos, setProductos] = useState<ProductoConteo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    useEffect(() => {
        if (id) {
            cargarDetalleConteo();
        }
    }, [id]);

    const cargarDetalleConteo = async () => {
        if (!id) return;

        setIsLoading(true);
        try {
            // Obtener productos del conteo con diferencias
            const res = await apiGetProductosParaConteo(
                '', // codalm se obtiene del conteo
                undefined,
                'con_diferencias',
                parseInt(id)
            );

            if (res.success && res.data) {
                setProductos(res.data);
            }
        } catch (error) {
            console.error('Error al cargar detalle del conteo:', error);
            addNotification({ message: 'Error al cargar detalle del conteo', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAplicarConteo = async () => {
        if (!id) return;

        if (!confirm('¿Está seguro de aplicar este conteo físico? Esta acción actualizará el inventario y no se puede deshacer.')) {
            return;
        }

        setIsProcessing(true);
        try {
            const res = await apiAplicarConteo(parseInt(id));

            if (res.success) {
                addNotification({ message: 'Conteo físico aplicado exitosamente', type: 'success' });
                navigate('/inventarios/conteo-fisico');
            } else {
                addNotification({ message: res.message || 'Error al aplicar conteo', type: 'error' });
            }
        } catch (error) {
            console.error('Error al aplicar conteo:', error);
            addNotification({ message: 'Error al aplicar conteo físico', type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExportarExcel = () => {
        const dataExport = productos.map((p) => ({
            'Código': p.codins,
            'Producto': p.nombreProducto,
            'Línea': p.nombreLinea,
            'U.M.': p.unidadMedida,
            'Costo': p.valcosto,
            'Sistema': p.caninv,
            'Físico': p.canfis,
            'Diferencia': p.diferencia,
            'Valor Diferencia': p.diferencia * p.valcosto
        }));

        const ws = XLSX.utils.json_to_sheet(dataExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Conteo ${id}`);
        XLSX.writeFile(wb, `Detalle_Conteo_${id}.xlsx`);
    };

    const totalProductos = productos.length;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const productosPaginados = productos.slice(startIndex, endIndex);

    const totalDiferencias = productos.filter(p => p.diferencia !== 0).length;
    const valorTotalDiferencias = productos.reduce((sum, p) =>
        sum + Math.abs(p.diferencia * p.valcosto), 0
    );

    return (
        <PageContainer>
            <SectionHeader
                title={`Conteo Físico #${id}`}
                subtitle="Detalle del conteo físico de inventario"
                action={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate('/inventarios/conteo-fisico')}
                            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            ← Volver
                        </button>
                        {productos.length > 0 && (
                            <>
                                <button
                                    onClick={handleExportarExcel}
                                    className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    📥 Exportar Excel
                                </button>
                                <button
                                    onClick={handleAplicarConteo}
                                    disabled={isProcessing}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors shadow-sm"
                                >
                                    ✓ {isProcessing ? 'Aplicando...' : 'Aplicar Conteo'}
                                </button>
                            </>
                        )}
                    </div>
                }
            />

            {isLoading ? (
                <Card>
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                </Card>
            ) : (
                <>
                    {/* Resumen */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <div className="p-6">
                                <p className="text-sm text-slate-600 dark:text-slate-400">Total Productos</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                    {totalProductos}
                                </p>
                            </div>
                        </Card>
                        <Card>
                            <div className="p-6">
                                <p className="text-sm text-slate-600 dark:text-slate-400">Diferencias Encontradas</p>
                                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                                    {totalDiferencias}
                                </p>
                            </div>
                        </Card>
                        <Card>
                            <div className="p-6">
                                <p className="text-sm text-slate-600 dark:text-slate-400">Valor Total Diferencias</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                    ${valorTotalDiferencias.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                                </p>
                            </div>
                        </Card>
                    </div>

                    {/* Tabla de Productos */}
                    <Card>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Código
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Producto
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Línea
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            U.M.
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Costo
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-blue-50/30 dark:bg-blue-900/10">
                                            Sistema
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-green-50/30 dark:bg-green-900/10">
                                            Físico
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-orange-50/30 dark:bg-orange-900/10">
                                            Diferencia
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Valor Dif.
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                                    {productosPaginados.map((producto) => (
                                        <tr key={producto.codins} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600 dark:text-slate-400">
                                                {producto.codins}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">
                                                {producto.nombreProducto}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                                                {producto.nombreLinea}
                                            </td>
                                            <td className="px-6 py-4 text-center text-sm text-slate-600 dark:text-slate-400">
                                                {producto.unidadMedida}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-sm text-slate-600 dark:text-slate-400">
                                                ${producto.valcosto.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-center bg-blue-50/30 dark:bg-blue-900/5">
                                                <span className="font-semibold text-sm text-blue-700 dark:text-blue-400">
                                                    {producto.caninv.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center bg-green-50/30 dark:bg-green-900/5">
                                                <span className="font-semibold text-sm text-green-700 dark:text-green-400">
                                                    {producto.canfis.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center bg-orange-50/30 dark:bg-orange-900/5">
                                                <span className={`font-semibold text-sm ${producto.diferencia > 0
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : producto.diferencia < 0
                                                        ? 'text-red-600 dark:text-red-400'
                                                        : 'text-slate-500 dark:text-slate-400'
                                                    }`}>
                                                    {producto.diferencia > 0 ? '+' : ''}{producto.diferencia.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-sm text-slate-900 dark:text-white">
                                                ${(Math.abs(producto.diferencia * producto.valcosto)).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <TablePagination
                            currentPage={currentPage}
                            totalPages={Math.ceil(totalProductos / itemsPerPage)}
                            totalItems={totalProductos}
                            rowsPerPage={itemsPerPage}
                            setRowsPerPage={setItemsPerPage}
                            onPageChange={setCurrentPage}
                            canPreviousPage={currentPage > 1}
                            canNextPage={currentPage < Math.ceil(totalProductos / itemsPerPage)}
                            onPreviousPage={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            onNextPage={() => setCurrentPage(Math.min(Math.ceil(totalProductos / itemsPerPage), currentPage + 1))}
                            rowsPerPageOptions={[10, 25, 50, 100]}
                        />
                    </Card>
                </>
            )}
        </PageContainer>
    );
};

export default DetalleConteoFisicoPage;
