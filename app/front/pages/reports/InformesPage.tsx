import React, { useState } from 'react';
import Card from '../../components/ui/Card';
import VentasPorClienteReport from './VentasPorClienteReport';
import VentasPorPeriodoReport from './VentasPorPeriodoReport';
import MovimientosInventarioReport from './MovimientosInventarioReport';

type ReportTab = 'ventasCliente' | 'ventasPeriodo' | 'movimientosInventario';

const InformesPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ReportTab>('ventasPeriodo');

    const renderTabContent = () => {
        switch (activeTab) {
            case 'ventasCliente':
                return <VentasPorClienteReport />;
            case 'ventasPeriodo':
                return <VentasPorPeriodoReport />;
            case 'movimientosInventario':
                return <MovimientosInventarioReport />;
            default:
                return null;
        }
    };

    const TabButton: React.FC<{ tabId: ReportTab; label: string; icon: string }> = ({ tabId, label, icon }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`flex items-center gap-2 whitespace-nowrap py-3 px-4 border-b-2 font-semibold text-sm rounded-t-lg ${
                activeTab === tabId
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
        >
            <i className={`fas ${icon}`}></i>
            {label}
        </button>
    );

    return (
        <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-4">Centro de Informes</h1>
            <Card>
                <div className="border-b border-slate-200 dark:border-slate-700">
                    <nav className="-mb-px flex space-x-2 overflow-x-auto" aria-label="Tabs">
                        <TabButton tabId="ventasPeriodo" label="Ventas por Período" icon="fa-chart-line" />
                        <TabButton tabId="ventasCliente" label="Ventas por Cliente" icon="fa-chart-pie" />
                        <TabButton tabId="movimientosInventario" label="Movimientos de Inventario" icon="fa-dolly-flatbed" />
                    </nav>
                </div>
                <div className="pt-6">
                    {renderTabContent()}
                </div>
            </Card>
        </div>
    );
};

export default InformesPage;
