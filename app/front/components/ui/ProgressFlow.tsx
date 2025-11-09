import React from 'react';

interface ProgressStepProps {
  title: string;
  status: 'complete' | 'current' | 'incomplete';
  children?: React.ReactNode;
}

export const ProgressStep: React.FC<ProgressStepProps> = ({ title, status, children }) => {
    const colorClasses = {
        complete: 'bg-green-500 border-green-600',
        current: 'bg-blue-500 border-blue-600 animate-pulse',
        incomplete: 'bg-slate-300 dark:bg-slate-600 border-slate-400 dark:border-slate-500',
    };
    const textClasses = {
        complete: 'text-green-700 dark:text-green-300',
        current: 'text-blue-700 dark:text-blue-300',
        incomplete: 'text-slate-500 dark:text-slate-400',
    };
    const iconContent = {
        complete: <i className="fas fa-check"></i>,
        current: <i className="fas fa-ellipsis-h"></i>,
        incomplete: <span className="text-xs font-bold text-slate-500 dark:text-slate-400">...</span>
    }

    return (
        <div className="flex-1 text-center">
            <div className="flex items-center justify-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold border-2 ${colorClasses[status]}`}>
                    {iconContent[status]}
                </div>
            </div>
            <p className={`mt-2 text-xs font-semibold ${textClasses[status]}`}>{title}</p>
            {children && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{children}</div>}
        </div>
    );
};


interface ProgressFlowProps {
  children: React.ReactNode;
}

export const ProgressFlow: React.FC<ProgressFlowProps> = ({ children }) => {
  const steps = React.Children.toArray(children);
  return (
    <div className="flex items-start justify-center">
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          {step}
          {index < steps.length - 1 && (
            <div className="flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-600 mt-4 mx-2"></div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};