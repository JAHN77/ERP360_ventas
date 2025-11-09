import React from 'react';

interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  labelLeft: string;
  labelRight: string;
  disabled?: boolean;
  size?: 'default' | 'compact';
  width?: 'auto' | 'equal';
  className?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  id,
  checked,
  onChange,
  labelLeft,
  labelRight,
  disabled = false,
  size = 'default',
  width = 'auto',
  className = '',
}) => {
  const isCompact = size === 'compact';
  const rootPadding = isCompact ? 'p-0.5' : 'p-1';
  const optionPadding = isCompact ? 'py-1.5 px-6 text-sm' : 'py-2.5 px-8 text-base';
  const sliderPosition = isCompact ? 'top-0.5 left-0.5 h-[calc(100%-6px)]' : 'top-1 left-1 h-[calc(100%-8px)]';
  const optionWidthClass = width === 'equal' ? 'flex-1' : 'w-1/2';

  return (
    <div
      role="group"
      className={`relative flex w-full items-center justify-center rounded-full bg-slate-700/50 ${rootPadding} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${className}`}
    >
      {/* The sliding background element */}
      <div
        className={`absolute ${sliderPosition} w-1/2 transform rounded-full bg-slate-900 shadow-lg transition-transform duration-300 ease-in-out`}
        style={{ transform: checked ? 'translateX(calc(100% - 4px))' : 'translateX(0)' }}
        aria-hidden="true"
      />

      <div
        onClick={() => !disabled && onChange(false)}
        className={`relative flex ${optionWidthClass} items-center justify-center rounded-full ${optionPadding} text-base font-semibold transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus:ring-offset-slate-800 whitespace-nowrap ${
          !checked ? 'text-white' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {labelLeft}
      </div>
      <div
        onClick={() => !disabled && onChange(true)}
        className={`relative flex ${optionWidthClass} items-center justify-center rounded-full ${optionPadding} text-base font-semibold transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible-ring-offset-2 dark:focus:ring-offset-slate-800 whitespace-nowrap ${
          checked ? 'text-white' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {labelRight}
      </div>
    </div>
  );
};

export default ToggleSwitch;