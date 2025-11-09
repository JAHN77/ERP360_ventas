import React, { useMemo } from 'react';

const formatCurrencyForAxis = (value: number) => {
    if (value === 0) return '$0';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact', compactDisplay: 'short' }).format(value);
};

const formatFullCurrency = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);

interface ChartData {
  [key: string]: any;
}

interface SimpleChartProps {
  data: ChartData[];
  type: 'line' | 'bar';
  dataKey: string;
  labelKey: string;
  height?: string;
}

const SimpleChart: React.FC<SimpleChartProps> = ({ data, type, dataKey, labelKey, height = 'h-80' }) => {
  const maxValue = useMemo(() => {
    const max = Math.max(...data.map(d => d[dataKey]), 0);
    return max === 0 ? 1 : max * 1.1; // Add 10% padding to top
  }, [data, dataKey]);

  const indicesToShow = useMemo(() => {
    const indices = new Set<number>();
    const numItems = data.length;
    if (numItems <= 1) {
        if (numItems === 1) indices.add(0);
        return indices;
    }
    const maxLabels = window.innerWidth < 768 ? 6 : 12; // Fewer labels on smaller screens
    if (numItems <= maxLabels) {
      for (let i = 0; i < numItems; i++) indices.add(i);
      return indices;
    }
    const skip = Math.ceil(numItems / maxLabels);
    for (let i = 0; i < numItems; i += skip) indices.add(i);
    indices.add(numItems - 1);
    return indices;
  }, [data.length]);


  const renderBarChart = () => (
    <div className={`w-full ${height} flex items-end justify-around gap-1 sm:gap-2 px-2 pb-8 relative`}>
      {data.map((item, index) => (
        <div key={index} className="flex-1 h-full flex flex-col items-center justify-end group relative min-w-0">
          <div className="absolute -top-8 text-xs bg-slate-800 text-white px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200 transform scale-95 group-hover:scale-100 whitespace-nowrap z-10 pointer-events-none">
            {formatFullCurrency(item[dataKey])}
          </div>
          <div 
            className="w-full bg-gradient-to-b from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 group-hover:from-blue-400 group-hover:to-blue-500 transition-all duration-200 rounded-t-md"
            style={{ height: `${(item[dataKey] / maxValue) * 100}%` }}
          ></div>
          <div className="absolute -bottom-5 text-xs text-slate-500 dark:text-slate-400 mt-2 text-center truncate group-hover:font-semibold">
            {indicesToShow.has(index) ? item[labelKey] : ''}
          </div>
        </div>
      ))}
    </div>
  );

  const renderLineChart = () => {
    // Define SVG dimensions and margins
    const SVG_WIDTH = 500;
    const SVG_HEIGHT = 250;
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
    const width = SVG_WIDTH - margin.left - margin.right;
    const height = SVG_HEIGHT - margin.top - margin.bottom;

    if (data.length === 0) {
        return <div className={`w-full ${height} flex items-center justify-center text-slate-500 dark:text-slate-400`}><p>No hay datos disponibles.</p></div>;
    }
     if (data.length === 1) {
        return <div className={`w-full ${height} flex items-center justify-center text-slate-500 dark:text-slate-400`}><p>Se necesita al menos 2 puntos de datos para una línea.</p></div>;
    }

    const points = data.map((item, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((item[dataKey] / maxValue) * height);
        return { x, y };
    });

    const pathData = points.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x} ${p.y}`).join(' ');
    const areaPathData = `${pathData} L ${points[points.length-1].x} ${height} L ${points[0].x} ${height} Z`;

    const yAxisTicks = [0, 0.25, 0.5, 0.75, 1].map(m => maxValue * m);

    return (
        <div className={`w-full ${height}`}>
            <style>
                {`
                    .line-path {
                        stroke-dasharray: 1500;
                        stroke-dashoffset: 1500;
                        animation: draw-line 1.5s ease-out forwards;
                    }
                    .area-path {
                        opacity: 0;
                        animation: fade-in 0.5s ease-out 0.5s forwards;
                    }
                    @keyframes draw-line {
                        to { stroke-dashoffset: 0; }
                    }
                    @keyframes fade-in {
                        to { opacity: 1; }
                    }
                `}
            </style>
            <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primario, #002B5B)" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="var(--color-primario, #002B5B)" stopOpacity="0" />
                    </linearGradient>
                </defs>

                <g transform={`translate(${margin.left}, ${margin.top})`}>
                    {/* Y-Axis and Grid Lines */}
                    {yAxisTicks.map(tickValue => (
                        <g key={tickValue} className="text-slate-500 dark:text-slate-400">
                            <text x="-10" y={height - (tickValue / maxValue * height)} textAnchor="end" alignmentBaseline="middle" className="text-[10px] fill-current">
                                {formatCurrencyForAxis(tickValue)}
                            </text>
                            {tickValue > 0 && (
                                <line 
                                    x1="0" y1={height - (tickValue / maxValue * height)}
                                    x2={width} y2={height - (tickValue / maxValue * height)}
                                    className="stroke-slate-200 dark:stroke-slate-700"
                                    strokeWidth="1" 
                                    strokeDasharray="3 3"
                                />
                            )}
                        </g>
                    ))}
                    <line x1="0" y1={height} x2={width} y2={height} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1"/>

                    {/* Area Path */}
                    <path d={areaPathData} fill="url(#areaGradient)" className="area-path" />

                    {/* Line Path */}
                    <path d={pathData} fill="none" className="stroke-blue-500 dark:stroke-blue-400 line-path" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>

                    {/* Data Points */}
                    {points.map((p, i) => (
                        <g key={i} className="group cursor-pointer">
                            <title>{`${data[i][labelKey]}: ${formatFullCurrency(data[i][dataKey])}`}</title>
                            <circle cx={p.x} cy={p.y} r="8" className="fill-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <circle cx={p.x} cy={p.y} r="4" className="fill-white dark:fill-slate-800 stroke-blue-500 dark:stroke-blue-400 group-hover:fill-blue-500" strokeWidth="2" />
                        </g>
                    ))}
                    
                    {/* X-Axis Labels */}
                    {data.map((item, i) => {
                        if (!indicesToShow.has(i)) return null;
                        const x = (i / (data.length - 1)) * width;
                        return (
                             <text key={i} x={x} y={height + 20} textAnchor="middle" className="text-[10px] fill-current text-slate-500 dark:text-slate-400">
                                {item[labelKey]}
                            </text>
                        )
                    })}
                </g>
            </svg>
        </div>
    );
  };

  return (
    <div className="relative w-full">
        {type === 'bar' ? renderBarChart() : renderLineChart()}
    </div>
  );
};

export default SimpleChart;