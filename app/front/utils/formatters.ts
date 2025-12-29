/**
 * Utilidades centralizadas para formateo de datos
 */

/**
 * Formatea un número como moneda colombiana (COP)
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

/**
 * Formatea un número como moneda (sin decimales por requerimiento global)
 */
export const formatCurrencyWithDecimals = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

/**
 * Formatea una fecha a formato legible (DD/MM/YYYY)
 */
export const formatDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'Fecha inválida';

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();

  return `${day}/${month}/${year}`;
};

/**
 * Formatea una fecha con hora (DD/MM/YYYY HH:MM)
 */
export const formatDateTime = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'Fecha inválida';

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

/**
 * Formatea un número con separadores de miles
 */
export const formatNumber = (value: number, decimals: number = 0): string => {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

/**
 * Formatea un porcentaje
 */
export const formatPercentage = (value: number, decimals: number = 0): string => {
  return `${formatNumber(value, decimals)}%`;
};

/**
 * Formatea una fecha para mostrar solo la fecha sin hora (YYYY-MM-DD)
 * Extrae solo la parte de fecha de valores ISO (ej: 2025-11-15T00:00:00.000Z -> 2025-11-15)
 */
export const formatDateOnly = (fecha: string | Date | null | undefined): string => {
  if (!fecha) return 'N/A';
  try {
    const fechaStr = String(fecha);
    // Si es una fecha ISO con hora, extraer solo la fecha
    if (fechaStr.includes('T')) {
      return fechaStr.split('T')[0];
    }
    // Si ya es solo fecha, devolverla tal cual
    return fechaStr.substring(0, 10);
  } catch (error) {
    return String(fecha);
  }
};

