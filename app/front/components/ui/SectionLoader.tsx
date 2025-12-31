import React from 'react';
import { Spinner } from './Spinner';

interface SectionLoaderProps {
    text?: string;
    height?: string;
    className?: string;
}

export const SectionLoader: React.FC<SectionLoaderProps> = ({
    text = 'Cargando...',
    height = 'h-64',
    className = ''
}) => {
    return (
        <div className={`flex flex-col items-center justify-center ${height} ${className} space-y-4 animate-fade-in`}>
            <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
                <Spinner size="xl" color="text-indigo-600 dark:text-indigo-400" />
            </div>
            {text && (
                <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse text-sm tracking-wide">
                    {text}
                </p>
            )}
        </div>
    );
};
