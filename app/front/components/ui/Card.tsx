import React, { ReactNode } from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700/50 p-4 ${className}`} {...props}>
      {children}
    </div>
  );
};

export default Card;

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className }) => {
  return <div className={`border-b border-slate-200 dark:border-slate-700 pb-3 mb-3 ${className}`}>{children}</div>
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export const CardTitle: React.FC<CardTitleProps> = ({ children, className }) => {
  return <h3 className={`text-lg font-semibold text-slate-800 dark:text-slate-100 ${className}`}>{children}</h3>
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const CardContent: React.FC<CardContentProps> = ({ children, className, style }) => {
  return <div className={className} style={{ overflowX: 'visible', maxWidth: '100%', ...style }}>{children}</div>
}