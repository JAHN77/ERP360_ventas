import React from 'react';

export interface DateRangeOption {
  label: string;
  value: string;
}

interface DateRangePickerProps {
  options: DateRangeOption[];
  activeOption: string;
  onOptionChange: (value: string) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ options, activeOption, onOptionChange }) => {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => onOptionChange(option.value)}
          className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors duration-200 ${
            activeOption === option.value
              ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white'
              : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default DateRangePicker;