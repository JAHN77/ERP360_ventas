/**
 * Mapeos completos de clases Tailwind a valores CSS
 * Estos mapeos se usan como fallback cuando el CSS no se carga correctamente
 */

import { StyleMapping } from '../services/pdf/types';

export const TAILWIND_MAPPINGS: StyleMapping[] = [
  // Padding
  { className: 'p-0', cssProperty: 'padding', cssValue: '0', priority: 'high' },
  { className: 'p-1', cssProperty: 'padding', cssValue: '0.25rem', priority: 'high' },
  { className: 'p-2', cssProperty: 'padding', cssValue: '0.5rem', priority: 'high' },
  { className: 'p-3', cssProperty: 'padding', cssValue: '0.75rem', priority: 'high' },
  { className: 'p-4', cssProperty: 'padding', cssValue: '1rem', priority: 'high' },
  { className: 'p-5', cssProperty: 'padding', cssValue: '1.25rem', priority: 'high' },
  { className: 'p-6', cssProperty: 'padding', cssValue: '1.5rem', priority: 'high' },
  { className: 'p-8', cssProperty: 'padding', cssValue: '2rem', priority: 'high' },
  { className: 'p-10', cssProperty: 'padding', cssValue: '2.5rem', priority: 'high' },
  { className: 'p-12', cssProperty: 'padding', cssValue: '3rem', priority: 'high' },
  
  // Padding X
  { className: 'px-0', cssProperty: 'padding-left', cssValue: '0', priority: 'high' },
  { className: 'px-0', cssProperty: 'padding-right', cssValue: '0', priority: 'high' },
  { className: 'px-2', cssProperty: 'padding-left', cssValue: '0.5rem', priority: 'high' },
  { className: 'px-2', cssProperty: 'padding-right', cssValue: '0.5rem', priority: 'high' },
  { className: 'px-4', cssProperty: 'padding-left', cssValue: '1rem', priority: 'high' },
  { className: 'px-4', cssProperty: 'padding-right', cssValue: '1rem', priority: 'high' },
  { className: 'px-6', cssProperty: 'padding-left', cssValue: '1.5rem', priority: 'high' },
  { className: 'px-6', cssProperty: 'padding-right', cssValue: '1.5rem', priority: 'high' },
  { className: 'px-8', cssProperty: 'padding-left', cssValue: '2rem', priority: 'high' },
  { className: 'px-8', cssProperty: 'padding-right', cssValue: '2rem', priority: 'high' },
  { className: 'px-10', cssProperty: 'padding-left', cssValue: '2.5rem', priority: 'high' },
  { className: 'px-10', cssProperty: 'padding-right', cssValue: '2.5rem', priority: 'high' },
  
  // Padding Y
  { className: 'py-0', cssProperty: 'padding-top', cssValue: '0', priority: 'high' },
  { className: 'py-0', cssProperty: 'padding-bottom', cssValue: '0', priority: 'high' },
  { className: 'py-2', cssProperty: 'padding-top', cssValue: '0.5rem', priority: 'high' },
  { className: 'py-2', cssProperty: 'padding-bottom', cssValue: '0.5rem', priority: 'high' },
  { className: 'py-4', cssProperty: 'padding-top', cssValue: '1rem', priority: 'high' },
  { className: 'py-4', cssProperty: 'padding-bottom', cssValue: '1rem', priority: 'high' },
  { className: 'py-6', cssProperty: 'padding-top', cssValue: '1.5rem', priority: 'high' },
  { className: 'py-6', cssProperty: 'padding-bottom', cssValue: '1.5rem', priority: 'high' },
  { className: 'py-8', cssProperty: 'padding-top', cssValue: '2rem', priority: 'high' },
  { className: 'py-8', cssProperty: 'padding-bottom', cssValue: '2rem', priority: 'high' },
  { className: 'py-10', cssProperty: 'padding-top', cssValue: '2.5rem', priority: 'high' },
  { className: 'py-10', cssProperty: 'padding-bottom', cssValue: '2.5rem', priority: 'high' },
  
  // Margin
  { className: 'm-0', cssProperty: 'margin', cssValue: '0', priority: 'high' },
  { className: 'm-2', cssProperty: 'margin', cssValue: '0.5rem', priority: 'high' },
  { className: 'm-4', cssProperty: 'margin', cssValue: '1rem', priority: 'high' },
  { className: 'm-6', cssProperty: 'margin', cssValue: '1.5rem', priority: 'high' },
  { className: 'm-8', cssProperty: 'margin', cssValue: '2rem', priority: 'high' },
  
  // Margin Bottom
  { className: 'mb-0', cssProperty: 'margin-bottom', cssValue: '0', priority: 'high' },
  { className: 'mb-2', cssProperty: 'margin-bottom', cssValue: '0.5rem', priority: 'high' },
  { className: 'mb-4', cssProperty: 'margin-bottom', cssValue: '1rem', priority: 'high' },
  { className: 'mb-6', cssProperty: 'margin-bottom', cssValue: '1.5rem', priority: 'high' },
  { className: 'mb-8', cssProperty: 'margin-bottom', cssValue: '2rem', priority: 'high' },
  
  // Margin Top
  { className: 'mt-0', cssProperty: 'margin-top', cssValue: '0', priority: 'high' },
  { className: 'mt-2', cssProperty: 'margin-top', cssValue: '0.5rem', priority: 'high' },
  { className: 'mt-4', cssProperty: 'margin-top', cssValue: '1rem', priority: 'high' },
  { className: 'mt-6', cssProperty: 'margin-top', cssValue: '1.5rem', priority: 'high' },
  { className: 'mt-8', cssProperty: 'margin-top', cssValue: '2rem', priority: 'high' },
  
  // Background Colors
  { className: 'bg-white', cssProperty: 'background-color', cssValue: 'rgb(255, 255, 255)', priority: 'high' },
  { className: 'bg-slate-50', cssProperty: 'background-color', cssValue: 'rgb(248, 250, 252)', priority: 'high' },
  { className: 'bg-slate-100', cssProperty: 'background-color', cssValue: 'rgb(241, 245, 249)', priority: 'high' },
  { className: 'bg-slate-200', cssProperty: 'background-color', cssValue: 'rgb(226, 232, 240)', priority: 'high' },
  
  // Text Colors
  { className: 'text-slate-500', cssProperty: 'color', cssValue: 'rgb(100, 116, 139)', priority: 'high' },
  { className: 'text-slate-600', cssProperty: 'color', cssValue: 'rgb(71, 85, 105)', priority: 'high' },
  { className: 'text-slate-700', cssProperty: 'color', cssValue: 'rgb(51, 65, 85)', priority: 'high' },
  { className: 'text-slate-800', cssProperty: 'color', cssValue: 'rgb(30, 41, 59)', priority: 'high' },
  { className: 'text-red-600', cssProperty: 'color', cssValue: 'rgb(220, 38, 38)', priority: 'high' },
  { className: 'text-white', cssProperty: 'color', cssValue: 'rgb(255, 255, 255)', priority: 'high' },
  
  // Display
  { className: 'flex', cssProperty: 'display', cssValue: 'flex', priority: 'high' },
  { className: 'grid', cssProperty: 'display', cssValue: 'grid', priority: 'high' },
  { className: 'block', cssProperty: 'display', cssValue: 'block', priority: 'high' },
  { className: 'inline-block', cssProperty: 'display', cssValue: 'inline-block', priority: 'high' },
  { className: 'hidden', cssProperty: 'display', cssValue: 'none', priority: 'high' },
  
  // Flexbox
  { className: 'justify-between', cssProperty: 'justify-content', cssValue: 'space-between', priority: 'high' },
  { className: 'justify-center', cssProperty: 'justify-content', cssValue: 'center', priority: 'high' },
  { className: 'items-start', cssProperty: 'align-items', cssValue: 'flex-start', priority: 'high' },
  { className: 'items-center', cssProperty: 'align-items', cssValue: 'center', priority: 'high' },
  { className: 'items-end', cssProperty: 'align-items', cssValue: 'flex-end', priority: 'high' },
  
  // Gap
  { className: 'gap-2', cssProperty: 'gap', cssValue: '0.5rem', priority: 'high' },
  { className: 'gap-4', cssProperty: 'gap', cssValue: '1rem', priority: 'high' },
  { className: 'gap-6', cssProperty: 'gap', cssValue: '1.5rem', priority: 'high' },
  { className: 'gap-8', cssProperty: 'gap', cssValue: '2rem', priority: 'high' },
  
  // Grid
  { className: 'grid-cols-1', cssProperty: 'grid-template-columns', cssValue: 'repeat(1, minmax(0, 1fr))', priority: 'high' },
  { className: 'grid-cols-2', cssProperty: 'grid-template-columns', cssValue: 'repeat(2, minmax(0, 1fr))', priority: 'high' },
  { className: 'grid-cols-3', cssProperty: 'grid-template-columns', cssValue: 'repeat(3, minmax(0, 1fr))', priority: 'high' },
  
  // Typography
  { className: 'text-xs', cssProperty: 'font-size', cssValue: '0.75rem', priority: 'high' },
  { className: 'text-sm', cssProperty: 'font-size', cssValue: '0.875rem', priority: 'high' },
  { className: 'text-base', cssProperty: 'font-size', cssValue: '1rem', priority: 'high' },
  { className: 'text-lg', cssProperty: 'font-size', cssValue: '1.125rem', priority: 'high' },
  { className: 'text-xl', cssProperty: 'font-size', cssValue: '1.25rem', priority: 'high' },
  { className: 'text-2xl', cssProperty: 'font-size', cssValue: '1.5rem', priority: 'high' },
  { className: 'font-normal', cssProperty: 'font-weight', cssValue: '400', priority: 'high' },
  { className: 'font-medium', cssProperty: 'font-weight', cssValue: '500', priority: 'high' },
  { className: 'font-semibold', cssProperty: 'font-weight', cssValue: '600', priority: 'high' },
  { className: 'font-bold', cssProperty: 'font-weight', cssValue: '700', priority: 'high' },
  { className: 'text-left', cssProperty: 'text-align', cssValue: 'left', priority: 'high' },
  { className: 'text-center', cssProperty: 'text-align', cssValue: 'center', priority: 'high' },
  { className: 'text-right', cssProperty: 'text-align', cssValue: 'right', priority: 'high' },
  
  // Borders
  { className: 'border', cssProperty: 'border-width', cssValue: '1px', priority: 'medium' },
  { className: 'border', cssProperty: 'border-style', cssValue: 'solid', priority: 'medium' },
  { className: 'border-slate-200', cssProperty: 'border-color', cssValue: 'rgb(226, 232, 240)', priority: 'high' },
  { className: 'rounded-md', cssProperty: 'border-radius', cssValue: '0.375rem', priority: 'high' },
  { className: 'rounded-lg', cssProperty: 'border-radius', cssValue: '0.5rem', priority: 'high' },
];

