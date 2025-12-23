import React from 'react';

interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    badge?: React.ReactNode;
}

/**
 * SectionHeader - Encabezado estándar para secciones de página
 * Proporciona título, subtítulo opcional y área de acciones
 */
const SectionHeader: React.FC<SectionHeaderProps> = ({
    title,
    subtitle,
    action,
    badge
}) => {
    return (
        <div className="page-header">
            <div className="flex-1">
                <div className="flex items-center gap-3">
                    <h1 className="page-header-title">{title}</h1>
                    {badge}
                </div>
                {subtitle && (
                    <p className="page-header-subtitle mt-1">{subtitle}</p>
                )}
            </div>
            {action && (
                <div className="flex-shrink-0">
                    {action}
                </div>
            )}
        </div>
    );
};

export default SectionHeader;
