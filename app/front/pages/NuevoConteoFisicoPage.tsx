import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import Card from '../components/ui/Card';
import PageContainer from '../components/ui/PageContainer';
import SectionHeader from '../components/ui/SectionHeader';
import { ProductoConteo } from '../types';
import {
    apiGetProductosParaConteo,
    apiGetSiguienteNumeroConteo,
    apiCreateConteo,
    fetchLinesWithSublines
} from '../services/apiClient';
import * as XLSX from 'xlsx';

interface LineaSeleccionada {
    codigo: string;
    nombre: string;
    productos: ProductoConteo[];
}

const NuevoConteoFisicoPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { selectedSede, user } = useAuth();
    const { addNotification } = useNotifications();

    // Estado básico
    const [numeroToma, setNumeroToma] = useState(1);
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [lineas, setLineas] = useState<{ codigo: string; nombre: string }[]>([]);
    const [lineasSeleccionadas, setLineasSeleccionadas] = useState<LineaSeleccionada[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Estado para agregar línea y filtros
    const [lineaParaAgregar, setLineaParaAgregar] = useState('');
    const [filtroStock, setFiltroStock] = useState<'todos' | 'con_stock' | 'sin_stock'>('con_stock');
    const [searchTerm, setSearchTerm] = useState(''); // Nuevo estado para búsqueda

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [jumpPage, setJumpPage] = useState('');

    // Cargar datos iniciales
    useEffect(() => {
        const cargarDatosIniciales = async () => {
            try {
                const resNumero = await apiGetSiguienteNumeroConteo();
                if (resNumero.success && resNumero.data) {
                    setNumeroToma(resNumero.data);
                }

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

    const handleAgregarLinea = async () => {
        if (!lineaParaAgregar || !selectedSede) return;

        if (lineasSeleccionadas.some(l => l.codigo === lineaParaAgregar)) {
            addNotification({ message: 'Esta línea ya está agregada al conteo', type: 'warning' });
            return;
        }

        setIsLoading(true);
        try {
            const codalm = String(selectedSede.codigo);
            const res = await apiGetProductosParaConteo(codalm, lineaParaAgregar, filtroStock);

            if (res.success && res.data) {
                const lineaInfo = lineas.find(l => l.codigo === lineaParaAgregar);

                setLineasSeleccionadas([
                    ...lineasSeleccionadas,
                    {
                        codigo: lineaParaAgregar,
                        nombre: lineaInfo?.nombre || lineaParaAgregar,
                        productos: res.data
                    }
                ]);

                setLineaParaAgregar('');
                addNotification({ message: `Línea ${lineaInfo?.nombre} agregada con ${res.data.length} productos`, type: 'success' });
            }
        } catch (error) {
            console.error('Error al cargar productos de la línea:', error);
            addNotification({ message: 'Error al cargar productos de la línea', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleEliminarLinea = (codigo: string) => {
        setLineasSeleccionadas(lineasSeleccionadas.filter(l => l.codigo !== codigo));
    };

    const handleCantidadFisicaChange = (lineaCodigo: string, productoIndex: number, valor: string) => {
        setLineasSeleccionadas(lineasSeleccionadas.map(linea => {
            if (linea.codigo === lineaCodigo) {
                const nuevosProductos = [...linea.productos];
                nuevosProductos[productoIndex] = {
                    ...nuevosProductos[productoIndex],
                    canfis: parseFloat(valor) || 0,
                    diferencia: (parseFloat(valor) || 0) - nuevosProductos[productoIndex].caninv
                };
                return { ...linea, productos: nuevosProductos };
            }
            return linea;
        }));
    };

    const handleGuardarConteo = async () => {
        if (!selectedSede || lineasSeleccionadas.length === 0) {
            addNotification({ message: 'Debe agregar al menos una línea al conteo', type: 'warning' });
            return;
        }

        const todosLosProductos = lineasSeleccionadas.flatMap(linea => linea.productos);

        if (todosLosProductos.length === 0) {
            addNotification({ message: 'No hay productos para guardar', type: 'warning' });
            return;
        }

        setIsProcessing(true);
        try {
            const codalm = String(selectedSede.codigo);
            const res = await apiCreateConteo({
                idconteo: numeroToma,
                codalm,
                fecha,
                usuario: user?.username || 'SISTEMA',
                productos: todosLosProductos
            });

            if (res.success) {
                addNotification({ message: 'Conteo físico guardado exitosamente', type: 'success' });
                navigate('/inventarios/conteo-fisico');
            } else {
                addNotification({ message: res.message || 'Error al guardar conteo', type: 'error' });
            }
        } catch (error) {
            console.error('Error al guardar conteo:', error);
            addNotification({ message: 'Error al guardar conteo físico', type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExportarExcel = () => {
        const todosLosProductos = lineasSeleccionadas.flatMap(linea =>
            linea.productos.map(p => ({
                ...p,
                nombreLinea: linea.nombre
            }))
        );

        const dataExport = todosLosProductos.map((p) => ({
            'Línea': p.nombreLinea,
            'Código': p.codins,
            'Producto': p.nombreProducto,
            'U.M.': p.unidadMedida,
            'Costo': p.valcosto,
            'Sistema': p.caninv,
            'Físico': p.canfis,
            'Diferencia': p.diferencia
        }));

        const ws = XLSX.utils.json_to_sheet(dataExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Conteo Físico');
        XLSX.writeFile(wb, `Conteo_Fisico_${numeroToma}_${fecha}.xlsx`);
    };

    // Obtener todos los productos planos
    const todosLosProductos = lineasSeleccionadas.flatMap(linea =>
        linea.productos.map(p => ({
            ...p,
            lineaCodigo: linea.codigo,
            lineaNombre: linea.nombre
        }))
    );

    // Lógica de filtrado
    const productosFiltrados = todosLosProductos.filter(p => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            p.nombreProducto.toLowerCase().includes(term) ||
            p.codins.toLowerCase().includes(term)
        );
    });

    const totalProductos = productosFiltrados.length;
    const totalPages = Math.ceil(totalProductos / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const productosPaginados = productosFiltrados.slice(startIndex, endIndex);

    const totalDiferencias = todosLosProductos.filter(p => p.diferencia !== 0).length;
    const valorTotalDiferencias = todosLosProductos.reduce((sum, p) =>
        sum + Math.abs(p.diferencia * p.valcosto), 0
    );

    const handleJumpPage = (e: React.FormEvent) => {
        e.preventDefault();
        const page = parseInt(jumpPage);
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            setJumpPage('');
        }
    };

    const getPageNumbers = () => {
        const pages = [];
        let start = 1;
        let end = totalPages;

        if (totalPages > 5) {
            if (currentPage <= 3) {
                start = 1;
                end = 5;
            } else if (currentPage + 1 >= totalPages) {
                start = totalPages - 4;
                end = totalPages;
            } else {
                start = currentPage - 2;
                end = currentPage + 2;
            }
        }

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    };

    return (
        <PageContainer>
            <SectionHeader
                title={id ? `Conteo Físico #${id}` : 'Nuevo Conteo Físico'}
                subtitle={`Almacén: ${selectedSede?.nombre || 'No seleccionado'} | Fecha: ${new Date(fecha).toLocaleDateString('es-CO')}`}
                action={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate('/inventarios/conteo-fisico')}
                            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-900 shadow-sm"
                        >
                            ← Volver
                        </button>
                        {todosLosProductos.length > 0 && (
                            <>
                                <button
                                    onClick={handleExportarExcel}
                                    className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-900 shadow-sm"
                                >
                                    📥 Exportar Excel
                                </button>
                                <button
                                    onClick={handleGuardarConteo}
                                    disabled={isProcessing}
                                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors shadow-sm"
                                >
                                    ✓ {isProcessing ? 'Guardando...' : 'Guardar Conteo'}
                                </button>
                            </>
                        )}
                    </div>
                }
            />

            {/* Panel de Control Unificado */}
            <Card className="mb-6 overflow-visible">
                <div className="p-5">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Columna Izquierda: Info Básica */}
                        <div className="lg:col-span-4 grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                    # Toma
                                </label>
                                <input
                                    type="number"
                                    value={numeroToma}
                                    onChange={(e) => setNumeroToma(parseInt(e.target.value))}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    disabled={!!id}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Fecha
                                </label>
                                <input
                                    type="date"
                                    value={fecha}
                                    onChange={(e) => setFecha(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Columna Central: Filtro */}
                        <div className="lg:col-span-3">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                Filtro de Stock (Carga)
                            </label>
                            <select
                                value={filtroStock}
                                onChange={(e) => setFiltroStock(e.target.value as any)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            >
                                <option value="todos">Todos los productos</option>
                                <option value="con_stock">Solo con stock</option>
                                <option value="sin_stock">Solo sin stock</option>
                            </select>
                        </div>

                        {/* Columna Derecha: Agregar Línea */}
                        <div className="lg:col-span-5">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                Agregar Líneas
                            </label>
                            <div className="flex gap-2">
                                <select
                                    value={lineaParaAgregar}
                                    onChange={(e) => setLineaParaAgregar(e.target.value)}
                                    className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                >
                                    <option value="">Seleccione una línea...</option>
                                    {lineas
                                        .filter(l => !lineasSeleccionadas.some(ls => ls.codigo === l.codigo))
                                        .map((linea) => (
                                            <option key={linea.codigo} value={linea.codigo}>
                                                {linea.codigo} - {linea.nombre}
                                            </option>
                                        ))}
                                </select>
                                <button
                                    onClick={handleAgregarLinea}
                                    disabled={!lineaParaAgregar || isLoading}
                                    className="px-4 py-2 text-sm font-medium bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg transition-all shadow-sm whitespace-nowrap"
                                >
                                    + Agregar
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Líneas Seleccionadas */}
                    {lineasSeleccionadas.length > 0 && (
                        <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-700/50">
                            <p className="text-xs font-medium text-slate-500 mb-3 flex items-center gap-2">
                                Líneas Activas <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px]">{lineasSeleccionadas.length}</span>
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {lineasSeleccionadas.map((linea) => (
                                    <div
                                        key={linea.codigo}
                                        className="group inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm transition-all hover:border-blue-200 dark:hover:border-blue-700"
                                    >
                                        <div className="flex flex-col leading-none">
                                            <span className="font-semibold text-xs opacity-70">{linea.codigo}</span>
                                            <span className="font-medium">{linea.nombre}</span>
                                        </div>
                                        <span className="px-1.5 py-0.5 bg-white/50 dark:bg-black/20 rounded text-xs font-bold ml-1">
                                            {linea.productos.length}
                                        </span>
                                        <button
                                            onClick={() => handleEliminarLinea(linea.codigo)}
                                            className="ml-1 p-0.5 hover:bg-red-100 dark:hover:bg-red-900/50 text-blue-400 hover:text-red-500 rounded-full transition-colors"
                                        >
                                            <span className="text-lg leading-none block -mt-0.5">×</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Resumen - Estilizado */}
            {todosLosProductos.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Productos</p>
                            <div className="mt-1 flex items-baseline gap-2">
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {totalProductos}
                                </p>
                                <span className="text-xs text-slate-400">items filtrados</span>
                            </div>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                            📦
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Diferencias</p>
                            <div className="mt-1 flex items-baseline gap-2">
                                <p className={`text-2xl font-bold ${totalDiferencias > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-900 dark:text-white'}`}>
                                    {totalDiferencias}
                                </p>
                                <span className="text-xs text-slate-400">encontradas (total)</span>
                            </div>
                        </div>
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-lg ${totalDiferencias > 0 ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-400'}`}>
                            ⚠️
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor Diferencias</p>
                            <div className="mt-1 flex items-baseline gap-2">
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    ${valorTotalDiferencias.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                                </p>
                            </div>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400 font-bold text-lg">
                            💰
                        </div>
                    </div>
                </div>
            )}

            {/* Tabla de Productos - Estilizada */}
            {todosLosProductos.length > 0 && (
                <Card className="overflow-hidden border-0 shadow-md">
                    {/* Search Toolbar */}
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full md:max-w-md">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                                🔍
                            </span>
                            <input
                                type="text"
                                placeholder="Buscar por nombre o código..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                                    <th className="px-4 py-3 text-left">Línea</th>
                                    <th className="px-4 py-3 text-left">Código</th>
                                    <th className="px-4 py-3 text-left">Producto</th>
                                    <th className="px-4 py-3 text-center">U.M.</th>
                                    <th className="px-4 py-3 text-right">Costo</th>
                                    <th className="px-4 py-3 text-center bg-blue-50/50 dark:bg-blue-900/10 border-l border-r border-blue-100/50 dark:border-blue-900/20 text-blue-700 dark:text-blue-400">
                                        Sistema
                                    </th>
                                    <th className="px-4 py-3 text-center bg-green-50/50 dark:bg-green-900/10 border-r border-green-100/50 dark:border-green-900/20 text-green-700 dark:text-green-400">
                                        Físico
                                    </th>
                                    <th className="px-4 py-3 text-center bg-orange-50/50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-400">
                                        Dif.
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                {productosPaginados.length > 0 ? (
                                    productosPaginados.map((producto, idx) => {
                                        const lineaIndex = lineasSeleccionadas.findIndex(l => l.codigo === producto.lineaCodigo);
                                        const productoIndexEnLinea = lineasSeleccionadas[lineaIndex]?.productos.findIndex(
                                            p => p.codins === producto.codins
                                        );

                                        const isModified = producto.diferencia !== 0;

                                        return (
                                            <tr
                                                key={`${producto.lineaCodigo}-${producto.codins}`}
                                                className={`
                                                    group transition-colors hover:bg-blue-50/30 dark:hover:bg-blue-900/10
                                                    ${isModified ? 'bg-orange-50/10 dark:bg-orange-900/5' : ''}
                                                `}
                                            >
                                                <td className="px-4 py-2.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                                                    {producto.lineaNombre}
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap text-xs font-mono text-slate-500 dark:text-slate-400">
                                                    {producto.codins}
                                                </td>
                                                <td className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                                                    {producto.nombreProducto}
                                                </td>
                                                <td className="px-4 py-2.5 text-center text-xs text-slate-500 dark:text-slate-400">
                                                    {producto.unidadMedida}
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-500 dark:text-slate-400">
                                                    ${producto.valcosto.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-2.5 text-center bg-blue-50/20 dark:bg-blue-900/5 border-l border-r border-blue-50 dark:border-slate-800">
                                                    <span className="font-semibold text-xs text-blue-700 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                                                        {producto.caninv.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 bg-green-50/20 dark:bg-green-900/5 border-r border-green-50 dark:border-slate-800">
                                                    <input
                                                        type="number"
                                                        value={producto.canfis}
                                                        onChange={(e) => handleCantidadFisicaChange(
                                                            producto.lineaCodigo,
                                                            productoIndexEnLinea,
                                                            e.target.value
                                                        )}
                                                        className={`
                                                            w-24 px-2 py-1 text-center text-sm font-bold rounded border transition-all outline-none
                                                            ${isModified
                                                                ? 'bg-white border-orange-300 text-orange-700 shadow-sm ring-2 ring-orange-100'
                                                                : 'bg-white/50 border-transparent hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                                                            }
                                                        `}
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="px-4 py-2.5 text-center bg-orange-50/20 dark:bg-orange-900/5">
                                                    <span className={`font-bold text-xs px-2 py-0.5 rounded ${producto.diferencia > 0
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : producto.diferencia < 0
                                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                            : 'text-slate-300 dark:text-slate-600'
                                                        }`}>
                                                        {producto.diferencia > 0 ? '+' : ''}{producto.diferencia !== 0 ? producto.diferencia.toLocaleString() : '-'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                                            {searchTerm
                                                ? 'No se encontraron productos que coincidan con la búsqueda.'
                                                : 'No hay productos seleccionados.'
                                            }
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginación - Diseño Premium + Salto directo */}
                    {totalProductos > 0 && (
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                                    <span>Filas:</span>
                                    <select
                                        value={rowsPerPage}
                                        onChange={(e) => {
                                            setRowsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                                    >
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>

                                <form onSubmit={handleJumpPage} className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-4">
                                    <span className="text-xs text-slate-500 font-medium">Ir a:</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max={totalPages}
                                        value={jumpPage}
                                        onChange={(e) => setJumpPage(e.target.value)}
                                        placeholder="#"
                                        className="w-12 px-2 py-1 text-xs text-center border border-slate-200 dark:border-slate-700 rounded-md focus:ring-1 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!jumpPage}
                                        className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                                    >
                                        →
                                    </button>
                                </form>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 mr-2">
                                    {startIndex + 1}-{Math.min(endIndex, totalProductos)} de {totalProductos}
                                </span>

                                <button
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    title="Primera página"
                                >
                                    «
                                </button>
                                <button
                                    onClick={() => setCurrentPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    title="Anterior"
                                >
                                    ‹
                                </button>

                                <div className="flex items-center mx-1 gap-1">
                                    {getPageNumbers().map(pageNum => (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`
                                                w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold
                                                ${currentPage === pageNum
                                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                                    : 'text-slate-600 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                                                }
                                            `}
                                        >
                                            {pageNum}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    title="Siguiente"
                                >
                                    ›
                                </button>
                                <button
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    title="Última página"
                                >
                                    »
                                </button>
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </PageContainer>
    );
};

export default NuevoConteoFisicoPage;
