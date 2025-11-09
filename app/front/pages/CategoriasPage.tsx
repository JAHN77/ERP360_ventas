import React, { useMemo, useState } from 'react';
import { useData } from '../hooks/useData';
import { useNavigation } from '../hooks/useNavigation';
import Card, { CardContent } from '../components/ui/Card';

type CategoryFilter = 'all' | 'with-products' | 'without-products';

const CategoriasPage: React.FC = () => {
    const { setPage } = useNavigation();
    const { categorias, productos } = useData();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFilter, setSelectedFilter] = useState<CategoryFilter>('all');

    const categoriasConProductos = useMemo(() => {
        return categorias
            .filter(cat => cat.estado === 1) // Only show active categories
            .map(categoria => {
                const productosDeCategoria = productos.filter(p => p.idCategoria === categoria.id);
                const productCount = productosDeCategoria.length;
                const stockCount = productosDeCategoria.reduce((sum, p) => sum + (p.controlaExistencia || 0), 0);
                const activeProducts = productosDeCategoria.filter(p => (p as any).estado !== 0).length;
                return { ...categoria, productCount, stockCount, activeProducts };
            });
    }, [categorias, productos]);

    const totalCategorias = categoriasConProductos.length;
    const totalProductos = categoriasConProductos.reduce((acc, cat) => acc + cat.productCount, 0);
    const categoriasSinProductos = categoriasConProductos.filter(cat => cat.productCount === 0).length;

    const topCategorias = useMemo(() => {
        return [...categoriasConProductos]
            .sort((a, b) => b.productCount - a.productCount)
            .slice(0, 3);
    }, [categoriasConProductos]);

    const filteredCategorias = useMemo(() => {
        return categoriasConProductos
            .filter(cat => {
                if (selectedFilter === 'with-products') {
                    return cat.productCount > 0;
                }
                if (selectedFilter === 'without-products') {
                    return cat.productCount === 0;
                }
                return true;
            })
            .filter(cat => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase();
                return (
                    cat.nombre?.toLowerCase().includes(term) ||
                    (cat.descripcion || '').toLowerCase().includes(term)
                );
            });
    }, [categoriasConProductos, selectedFilter, searchTerm]);

    return (
        <div>
            <div className="flex flex-col gap-4 mb-8">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Categorías de Productos</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Organiza tu catálogo y encuentra rápidamente las familias de productos.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative">
                            <i className="fas fa-search text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar por nombre o descripción..."
                                className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex gap-2 bg-slate-100/70 dark:bg-slate-800/40 rounded-lg p-1">
                            {([
                                { id: 'all', label: 'Todas' },
                                { id: 'with-products', label: 'Con productos' },
                                { id: 'without-products', label: 'Sin productos' },
                            ] as { id: CategoryFilter; label: string }[]).map(filter => (
                                <button
                                    key={filter.id}
                                    onClick={() => setSelectedFilter(filter.id)}
                                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-all ${
                                        selectedFilter === filter.id
                                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-blue-500'
                                    }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-500/10">
                        <CardContent className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Categorías activas</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalCategorias}</p>
                            <span className="text-xs text-blue-600 dark:text-blue-400">Incluye solo categorías habilitadas</span>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total productos</p>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalProductos}</p>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Sumatoria de productos asociados</span>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Sin productos</p>
                            <p className="text-2xl font-bold text-amber-500">{categoriasSinProductos}</p>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Ideal para identificar oportunidades de surtido</span>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Top categorías</p>
                            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                                {topCategorias.map(cat => (
                                    <div key={cat.id} className="flex items-center justify-between gap-3">
                                        <span className="truncate">{cat.nombre}</span>
                                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{cat.productCount} prod.</span>
                                    </div>
                                ))}
                                {topCategorias.length === 0 && <span className="text-xs text-slate-400">Aún no hay datos suficientes</span>}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {filteredCategorias.length === 0 ? (
                <Card className="border-dashed border-2 border-slate-200 dark:border-slate-700">
                    <CardContent className="py-14 flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <i className="fas fa-folder-open text-slate-400"></i>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No encontramos categorías con esos criterios.</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Intenta limpiar el filtro o escribir otro término.</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredCategorias.map(cat => (
                        <Card 
                            key={cat.id}
                            className="transform hover:-translate-y-1 transition-transform duration-200 cursor-pointer hover:shadow-xl dark:hover:shadow-blue-500/20 border border-transparent hover:border-blue-200/70 dark:hover:border-blue-500/30"
                            onClick={() => setPage('categoria_detalle', { id: cat.id })}
                        >
                            <CardContent className="flex flex-col h-full">
                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                        <i className={`fas ${cat.imgruta || 'fa-tags'} text-xl`}></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 truncate">{cat.nombre}</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{cat.descripcion || 'Sin descripción'}</p>
                                    </div>
                                </div>
                                <div className="mt-6 grid grid-cols-2 gap-3 text-center">
                                    <div className="bg-slate-100 dark:bg-slate-800/60 rounded-lg py-2">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Productos</p>
                                        <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{cat.productCount}</p>
                                    </div>
                                    <div className="bg-slate-100 dark:bg-slate-800/60 rounded-lg py-2">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Stock total</p>
                                        <p className="text-base font-semibold text-blue-600 dark:text-blue-400">{cat.stockCount}</p>
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-3">
                                    <span>{cat.activeProducts} activos</span>
                                    {cat.productCount === 0 ? (
                                        <span className="inline-flex items-center gap-1 text-amber-500">
                                            <i className="fas fa-exclamation-circle"></i> Sin productos
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-emerald-500">
                                            <i className="fas fa-circle"></i> Operativa
                                        </span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CategoriasPage;
