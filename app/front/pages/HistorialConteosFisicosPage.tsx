import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Card from '../components/ui/Card';
import PageContainer from '../components/ui/PageContainer';
import SectionHeader from '../components/ui/SectionHeader';
import { apiGetConteos } from '../services/apiClient';

interface ConteoFisico {
    idconteo: number;
    codalm: string;
    fecha: string;
    fecsys: string;
    totalProductos: number;
    totalDiferencias: number;
    valorTotal: number;
    usuario: string;
    estado?: 'PENDIENTE' | 'APLICADO';
}

const HistorialConteosFisicosPage: React.FC = () => {
    const navigate = useNavigate();
    const { selectedSede } = useAuth();
    const [conteos, setConteos] = useState<ConteoFisico[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log('HistorialConteosFisicosPage - selectedSede:', selectedSede);
        cargarConteos();
    }, [selectedSede]);

    const cargarConteos = async () => {
        try {
            console.log('[Frontend] Iniciando carga de conteos...');
            setLoading(true);

            // Usar apiGetConteos que tiene la URL base correcta
            const response = await apiGetConteos();

            console.log('[Frontend] Respuesta de conteos:', response);
            console.log('[Frontend] response.success:', response.success);
            console.log('[Frontend] response.data:', response.data);

            if (response.success && response.data) {
                console.log('[Frontend] Estableciendo conteos. Total:', response.data.length);
                setConteos(response.data);
            } else {
                console.warn('[Frontend] No se recibieron datos');
                setConteos([]);
            }
        } catch (error) {
            console.error('[Frontend] Error al cargar conteos:', error);
            setConteos([]);
        } finally {
            console.log('[Frontend] Finalizando carga');
            setLoading(false);
        }
    };

    const handleNuevoConteo = () => {
        navigate('/inventarios/conteo-fisico/nuevo');
    };

    const handleVerDetalle = (idconteo: number) => {
        navigate(`/inventarios/conteo-fisico/${idconteo}`);
    };

    const formatFecha = (fecha: string) => {
        return new Date(fecha).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(value);
    };

    return (
        <PageContainer>
            <SectionHeader
                title="Historial de Conteos Físicos"
                subtitle="Gestión y seguimiento de inventarios físicos"
                action={
                    <button
                        onClick={handleNuevoConteo}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
                    >
                        <span>+</span>
                        Nuevo Conteo Físico
                    </button>
                }
            />

            <Card>
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : conteos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                            <p className="text-lg font-medium">No hay conteos físicos registrados</p>
                            <p className="text-sm">Crea un nuevo conteo para comenzar</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        # Toma
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Almacén
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Fecha
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Usuario
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Productos
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Diferencias
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Valor Total
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                                {conteos.map((conteo) => (
                                    <tr
                                        key={conteo.idconteo}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                                #{conteo.idconteo}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                                            <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-xs">
                                                {conteo.codalm}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                                            {formatFecha(conteo.fecha)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                                            {conteo.usuario}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                                                {conteo.totalProductos}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {conteo.totalDiferencias > 0 ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                                                    {conteo.totalDiferencias}
                                                </span>
                                            ) : (
                                                <span className="text-sm text-slate-500 dark:text-slate-400">
                                                    0
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900 dark:text-white">
                                            {formatCurrency(conteo.valorTotal)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <button
                                                onClick={() => handleVerDetalle(conteo.idconteo)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                            >
                                                Ver Detalle
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>
        </PageContainer>
    );
};

export default HistorialConteosFisicosPage;
