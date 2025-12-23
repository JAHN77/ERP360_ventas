import React from 'react';

interface SkeletonProps {
    className?: string;
    count?: number; // Number of lines/blocks to render
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    count = 1,
    variant = 'text',
    width,
    height
}) => {
    const baseClasses = "animate-pulse bg-slate-200 dark:bg-slate-700 rounded";

    const variantClasses = {
        text: "h-4 w-full mb-2 last:mb-0",
        circular: "rounded-full",
        rectangular: "h-32 w-full"
    };

    const elements = Array.from({ length: count }).map((_, index) => (
        <div
            key={index}
            className={`
        ${baseClasses} 
        ${variantClasses[variant]} 
        ${className}
      `}
            style={{
                width: width,
                height: height
            }}
        />
    ));

    return <>{elements}</>;
};
