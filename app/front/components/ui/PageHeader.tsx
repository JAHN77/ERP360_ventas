import React, { ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    description?: string;
    children?: ReactNode; // For actions (buttons, etc)
    className?: string;
    showBackButton?: boolean;
    onBack?: () => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, children, className = '', showBackButton, onBack }) => {
    return (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-6 ${className}`}>
            <div className="flex items-start gap-3">
                {showBackButton && (
                    <button
                        onClick={onBack}
                        className="mt-1 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        type="button"
                    >
                        <i className="fas fa-arrow-left"></i>
                    </button>
                )}
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                        {title}
                    </h1>
                    {description && (
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            {description}
                        </p>
                    )}
                </div>
            </div>
            {children && (
                <div className="flex flex-wrap items-center gap-3">
                    {children}
                </div>
            )}
        </div>
    );
};

export default PageHeader;
