import { Column } from '../components/ui/Table';

// Helper function to handle special characters for CSV format
const getCSVValue = <T,>(item: T, accessor: keyof T): string => {
  let value = item[accessor] as any;

  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
      return value.toLocaleDateString('es-CO');
  }

  const stringValue = String(value);
  // If the value contains a comma, newline, or double quote, wrap it in double quotes
  if (/[",\n\r]/.test(stringValue)) {
    // Also, double up any existing double quotes inside the string
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};


export const exportToCSV = <T extends object>(
  data: T[], 
  columns: Pick<Column<T>, 'header' | 'accessor'>[],
  fileName: string
) => {
  if (!data || data.length === 0) {
    console.warn("No data to export.");
    return;
  }

  const headers = columns.map(c => `"${c.header}"`).join(',');

  const rows = data.map(item => 
    columns.map(col => getCSVValue(item, col.accessor)).join(',')
  ).join('\n');

  // BOM for Excel to recognize UTF-8 correctly
  const bom = '\uFEFF';
  const csvContent = bom + headers + '\n' + rows;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${fileName}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};