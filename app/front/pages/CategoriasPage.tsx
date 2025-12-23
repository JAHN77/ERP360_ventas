import React from 'react';
import LinesSublinesManager from '../components/LinesSublinesManager';

const CategoriasPage: React.FC = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                        Líneas y Sublíneas
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Administra las líneas y sublíneas de productos
                    </p>
                </div>
            </div>

            {/* Content */}
            <LinesSublinesManager />
        </div>
    );
};

export default CategoriasPage;
