import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import PageHeader from '../components/ui/PageHeader';
import Card, { CardContent, CardHeader } from '../components/ui/Card';
import TablePagination from '../components/ui/TablePagination';
import { ProductoConteo } from '../types';
import {
    apiGetProductosParaConteo,
    apiGetSiguienteNumeroConteo,
    apiCreateConteo,
    apiAplicarConteo,
    fetchLinesWithSublines
} from '../services/apiClient';
import * as XLSX from 'xlsx';
import PageContainer from '../components/ui/PageContainer';
import SectionHeader from '../components/ui/SectionHeader';

const ConteoFisicoPage: React.FC = () => {
    const { selectedSede, user } = useAuth();
    const { addNotification } = useNotifications();

    // Estado de filtros
    const [numeroToma, setNumeroToma] = useState(1);
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [lineaFiltro, setLineaFiltro] = useState('TODAS');
    const [filtroTipo, setFiltroTipo] = useState<'todos' | 'con_stock' | 'sin_stock' | 'con_diferencias'>('todos');

    // Estado de datos
    const [productos, setProductos] = useState<ProductoConteo[]>([]);
    const [lineas, setLineas] = useState<{ codigo: string; nombre: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Estado Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Cargar datos iniciales
    useEffect(() => {
        const cargarDatosIniciales = async () => {
            try {
                // Cargar siguiente número
                const resNumero = await apiGetSiguienteNumeroConteo();
                if (resNumero.success && resNumero.data) {
                    setNumeroToma(resNumero.data);
                }

                // Cargar líneas independientemente
                const resLineas = await fetchLinesWithSublines();
                if (resLineas.success && resLineas.data) {
                    const lineasMapeadas = (resLineas.data as any[]).map((l: any) => ({
                        codigo: l.codline,
                        nombre: l.nomline
                    }));
                    setLineas(lineasMapeadas);
                }
            } catch (error) {
                console.error('Error al cargar datos iniciales:', error);
            }
        };
        cargarDatosIniciales();
    }, []);

    // Cargar productos cuando cambian los filtros
    useEffect(() => {
        cargarProductos();
    }, [selectedSede, lineaFiltro, filtroTipo]);

    const cargarProductos = async () => {
        if (!selectedSede) return;

        // Si la línea es TODAS, no cargamos automáticamente para evitar sobrecarga, 
        // a menos que sea una petición explícita (podríamos agregar un botón "Cargar Todo" si se requiere)
        // Por ahora, asumimos que "distribuir por líneas" implica forzar selección.
        if (lineaFiltro === 'TODAS') {
            setProductos([]);
            return;
        }

        setIsLoading(true);
        try {
            // Enviamos el código tal cual, sin forzar padding
            const codalm = String(selectedSede.codigo);
            console.log('Cargando productos para conteo:', { codalm, selectedSede, lineaFiltro, filtroTipo });

            const res = await apiGetProductosParaConteo(
                codalm,
                lineaFiltro !== 'TODAS' ? lineaFiltro : undefined,
                filtroTipo
            );
            console.log('Respuesta API conteo:', res);

            if (res.success && res.data) {
                setProductos(res.data);
                setCurrentPage(1); // Resetear a página 1 al cargar nuevos datos
                // Ya no sobreescribimos las líneas aquí, se cargan al inicio
            }
        } catch (error) {
            console.error('Error al cargar productos:', error);
            addNotification({ message: 'Error al cargar productos', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // Actualizar cantidad física de un producto
    const handleCantidadFisicaChange = (index: number, valor: string) => {
        // Calcular índice real basado en la paginación
        const realIndex = (currentPage - 1) * itemsPerPage + index;

        const newProductos = [...productos];
        const canfis = parseFloat(valor) || 0;
        newProductos[realIndex] = {
            ...newProductos[realIndex],
            canfis,
            diferencia: canfis - newProductos[realIndex].caninv
        };
        setProductos(newProductos);
    };

    // Exportar a Excel
    const exportarExcel = () => {
        const datosExcel = productos.map(p => ({
            'Código': p.codins,
            'Producto': p.nombreProducto,
            'Línea': p.nombreLinea,
            'Unidad': p.unidadMedida,
            'Costo Unitario': p.valcosto,
            'Cant. Sistema': p.caninv,
            'Cant. Física': p.canfis,
            'Diferencia': p.diferencia
        }));

        const worksheet = XLSX.utils.json_to_sheet(datosExcel);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Conteo Físico');

        const nombreArchivo = `Conteo_Fisico_${numeroToma}_${fecha}.xlsx`;
        XLSX.writeFile(workbook, nombreArchivo);

        addNotification({ message: 'Archivo Excel generado exitosamente', type: 'success' });
    };

    // Aplicar conteo
    const handleAplicarConteo = async () => {
        if (!selectedSede || !user) return;

        const productosConCantidad = productos.filter(p => p.canfis > 0 || p.diferencia !== 0);

        if (productosConCantidad.length === 0) {
            addNotification({ message: 'No hay productos con cantidades físicas ingresadas', type: 'warning' });
            return;
        }

        const confirmed = window.confirm(
            `¿Está seguro de aplicar el conteo físico #${numeroToma}?\n\n` +
            `Se actualizarán ${productosConCantidad.length} productos.\n` +
            `Esta acción ajustará las cantidades en el inventario.`
        );

        if (!confirmed) return;

        setIsProcessing(true);
        try {
            const codalm = String(selectedSede.codigo).padStart(3, '0');

            // Crear conteo
            const resCreate = await apiCreateConteo({
                idconteo: numeroToma,
                codalm,
                fecha,
                usuario: user.username || 'SYSTEM',
                productos: productosConCantidad
            });

            if (!resCreate.success) {
                throw new Error(resCreate.message || 'Error al crear conteo');
            }

            // Aplicar conteo
            const resAplicar = await apiAplicarConteo(numeroToma);

            if (!resAplicar.success) {
                throw new Error(resAplicar.message || 'Error al aplicar conteo');
            }

            addNotification({
                message: `Conteo físico #${numeroToma} aplicado exitosamente`,
                type: 'success'
            });

            // Recargar siguiente número y limpiar
            const resSiguiente = await apiGetSiguienteNumeroConteo();
            if (resSiguiente.success && resSiguiente.data) {
                setNumeroToma(resSiguiente.data);
            }

            // Recargar productos
            await cargarProductos();

        } catch (error: any) {
            console.error('Error al aplicar conteo:', error);
            addNotification({
                message: error.message || 'Error al aplicar conteo físico',
                type: 'error'
            });
        } finally {
            setIsProcessing(false);
        }
    };

    // Calcular totales
    const totales = useMemo(() => {
        return {
            totalProductos: productos.length,
            conDiferencias: productos.filter(p => p.diferencia !== 0).length,
            valorDiferencias: productos.reduce((sum, p) => sum + (Math.abs(p.diferencia) * p.valcosto), 0)
        };
    }, [productos]);

    // Productos paginados
    const displayedProductos = useMemo(() => {
        const firstIndex = (currentPage - 1) * itemsPerPage;
        return productos.slice(firstIndex, firstIndex + itemsPerPage);
    }, [productos, currentPage, itemsPerPage]);

    return (
        <PageContainer>
            <SectionHeader
                title="Conteo Físico de Inventario"
                subtitle="Registro y control de conteos físicos de inventario"
                badge={
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full font-bold">
                        Toma #{numeroToma}
                    </span>
                }
            />

            {/* Card de Filtros y Configuración */}
            <Card className="shadow-sm border border-slate-200 dark:border-slate-700">
                <CardHeader className="border-b border-slate-200 dark:border-slate-700">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                                Configuración del Conteo
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {selectedSede?.nombre} • {fecha}
                            </p>
                        </div>
                    </div>
                </CardHeader>

                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-end">
                            {/* Selector de Línea (Principal) */}
                            <div className="lg:col-span-5 flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    1. Seleccione la Línea a Contar
                                </label>
                                <select
                                    value={lineaFiltro}
                                    onChange={(e) => setLineaFiltro(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium shadow-sm"
                                >
                                    <option value="TODAS">-- Seleccione una Categoría --</option>
                                    {lineas.map(linea => (
                                        <option key={linea.codigo} value={linea.codigo}>
                                            {linea.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtros de Visualización */}
                            <div className="lg:col-span-7 flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    2. Filtrar Productos
                                </label>
                                <div className="flex flex-wrap gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                    {[
                                        { id: 'todos', label: 'Todos', icon: 'fa-list' },
                                        { id: 'con_stock', label: 'Con Stock', icon: 'fa-box' },
                                        { id: 'sin_stock', label: 'Sin Stock', icon: 'fa-box-open' },
                                        { id: 'con_diferencias', label: 'Diferencias', icon: 'fa-exclamation-triangle' }
                                    ].map((filter) => (
                                        <button
                                            key={filter.id}
                                            onClick={() => setFiltroTipo(filter.id as any)}
                                            className={`flex-1 min-w-[100px] px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${filtroTipo === filter.id
                                                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-600'
                                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'
                                                }`}
                                        >
                                            <i className={`fas ${filter.icon} text-xs`}></i>
                                            {filter.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

            {/* Card de Tabla */}
            <Card className="shadow-lg border border-slate-200 dark:border-slate-800">
                <CardHeader className="border-b border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Lista de Productos</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Ingrese las cantidades físicas cuidadosamente
                        </p>
                    </div>
                    <button
                        onClick={exportarExcel}
                        disabled={productos.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fas fa-file-excel"></i>
                        Exportar
                    </button>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Producto</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-24">Unidad</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">Costo Unit.</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider w-36 bg-blue-50/50 dark:bg-blue-900/10">Sistema</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider w-40 bg-green-50/50 dark:bg-green-900/10">
                                        <i className="fas fa-pencil-alt mr-2 mb-1"></i>
                                        Físico
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider w-32">Dif</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
                                                <p className="text-slate-500">Cargando productos...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : productos.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-slate-400 italic">
                                            Seleccione una línea para cargar los productos
                                        </td>
                                    </tr>
                                ) : (
                                    displayedProductos.map((producto, idx) => (
                                        <tr
                                            key={`${producto.codins}-${idx}`}
                                            className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800 dark:text-slate-200">
                                                    {producto.nombreProducto}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                        {producto.codins}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        {producto.nombreLinea}
                                                    </span>
                                                </div>
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
                                            <td className="px-6 py-4 bg-green-50/30 dark:bg-green-900/5">
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        value={producto.canfis}
                                                        onChange={(e) => handleCantidadFisicaChange(idx, e.target.value)}
                                                        className="w-full px-3 py-2 text-center text-sm font-medium border border-slate-300 dark:border-slate-600 rounded-md focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {producto.diferencia !== 0 ? (
                                                    <span className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-1 rounded-full text-sm font-bold shadow-sm ${producto.diferencia > 0
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                        }`}>
                                                        {producto.diferencia > 0 && '+'}
                                                        {producto.diferencia.toLocaleString()}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-700 font-medium">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>

                {/* Footer con totales, paginación y botón */}
                <div className="border-t border-slate-200 dark:border-slate-800 flex flex-col gap-4 p-4">

                    {/* Paginación */}
                    {productos.length > 0 && (
                        <div className="flex justify-center border-b border-slate-200 dark:border-slate-800 pb-4">
                            <TablePagination
                                currentPage={currentPage}
                                totalPages={Math.ceil(productos.length / itemsPerPage)}
                                onPageChange={setCurrentPage}
                                canPreviousPage={currentPage > 1}
                                canNextPage={currentPage < Math.ceil(productos.length / itemsPerPage)}
                                onPreviousPage={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                onNextPage={() => setCurrentPage(prev => Math.min(Math.ceil(productos.length / itemsPerPage), prev + 1))}
                                totalItems={productos.length}
                                rowsPerPage={itemsPerPage}
                                setRowsPerPage={(rows) => {
                                    setItemsPerPage(rows);
                                    setCurrentPage(1);
                                }}
                                rowsPerPageOptions={[20, 50, 100, 200]}
                            />
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex flex-wrap gap-6 text-sm">
                            <div>
                                <span className="text-slate-500 dark:text-slate-400">Total Productos:</span>
                                <span className="ml-2 font-bold text-slate-800 dark:text-white">{totales.totalProductos}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 dark:text-slate-400">Con Diferencias:</span>
                                <span className="ml-2 font-bold text-orange-600 dark:text-orange-400">{totales.conDiferencias}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 dark:text-slate-400">Valor Diferencias:</span>
                                <span className="ml-2 font-bold text-red-600 dark:text-red-400">
                                    ${totales.valorDiferencias.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={handleAplicarConteo}
                            disabled={isProcessing || productos.length === 0}
                            className={`flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-white shadow-lg transition-all transform hover:-translate-y-0.5 ${isProcessing || productos.length === 0
                                ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed shadow-none'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/30'
                                }`}
                        >
                            {isProcessing ? (
                                <>
                                    <i className="fas fa-spinner fa-spin"></i>
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-check-circle"></i>
                                    Aplicar Conteo
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Card>
        </PageContainer>
    );
};

export default ConteoFisicoPage;
