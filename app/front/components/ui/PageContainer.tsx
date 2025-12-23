import React from 'react';

interface PageContainerProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * PageContainer - Contenedor estándar para todas las páginas
 * Proporciona animación de entrada y espaciado consistente
 */
const PageContainer: React.FC<PageContainerProps> = ({ children, className = '' }) => {
    return (
        <div className={`page-container space-y-6 ${className}`}>
            {children}
        </div>
    );
};

export default PageContainer;
