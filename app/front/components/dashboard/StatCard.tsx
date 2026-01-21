import React from 'react';
import Card from '../ui/Card';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
  colorName: 'blue' | 'green' | 'orange' | 'violet';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, colorName }) => {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-100 dark:bg-blue-900/50',
      text: 'text-blue-500 dark:text-blue-400',
    },
    green: {
      bg: 'bg-green-100 dark:bg-green-900/50',
      text: 'text-green-500 dark:text-green-400',
    },
    orange: {
      bg: 'bg-orange-100 dark:bg-orange-900/50',
      text: 'text-orange-500 dark:text-orange-400',
    },
    violet: {
      bg: 'bg-violet-100 dark:bg-violet-900/50',
      text: 'text-violet-500 dark:text-violet-400',
    },
  };

  const selectedColor = colorClasses[colorName];

  return (
    <Card className="dark:bg-slate-800/50">
      <div className="flex items-center gap-4">
        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${selectedColor.bg}`}>
          <i className={`fas ${icon} fa-lg ${selectedColor.text}`}></i>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase truncate">{title}</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 truncate">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
      </div>
    </Card>
  );
};

export default StatCard;