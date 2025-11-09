/**
 * Utilidades para manejo seguro de arrays en TypeScript/React
 * Previene errores de "Cannot read properties of undefined (reading 'map')"
 */

/**
 * Convierte cualquier valor en un array seguro, nunca undefined ni null
 * @param arr - Array, undefined, null o cualquier valor
 * @returns Array vacío si el valor no es un array, o el array original
 * @example
 * const safe = safeArray(undefined); // []
 * const safe = safeArray(null); // []
 * const safe = safeArray([1, 2, 3]); // [1, 2, 3]
 */
export const safeArray = <T,>(arr: T[] | undefined | null): T[] => {
  return Array.isArray(arr) ? arr : [];
};

/**
 * Obtiene la longitud de un array de forma segura
 * @param arr - Array, undefined o null
 * @returns La longitud del array o 0 si no es un array
 */
export const safeArrayLength = <T,>(arr: T[] | undefined | null): number => {
  return Array.isArray(arr) ? arr.length : 0;
};

/**
 * Verifica si un array tiene elementos
 * @param arr - Array, undefined o null
 * @returns true si es un array con elementos, false en caso contrario
 */
export const hasItems = <T,>(arr: T[] | undefined | null): boolean => {
  return Array.isArray(arr) && arr.length > 0;
};

/**
 * Obtiene el primer elemento de un array de forma segura
 * @param arr - Array, undefined o null
 * @returns El primer elemento o undefined
 */
export const safeFirst = <T,>(arr: T[] | undefined | null): T | undefined => {
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : undefined;
};

/**
 * Obtiene el último elemento de un array de forma segura
 * @param arr - Array, undefined o null
 * @returns El último elemento o undefined
 */
export const safeLast = <T,>(arr: T[] | undefined | null): T | undefined => {
  return Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : undefined;
};

/**
 * Filtra un array de forma segura
 * @param arr - Array, undefined o null
 * @param predicate - Función de filtrado
 * @returns Array filtrado o array vacío
 */
export const safeFilter = <T,>(
  arr: T[] | undefined | null,
  predicate: (item: T, index: number) => boolean
): T[] => {
  return Array.isArray(arr) ? arr.filter(predicate) : [];
};

/**
 * Mapea un array de forma segura
 * @param arr - Array, undefined o null
 * @param mapper - Función de mapeo
 * @returns Array mapeado o array vacío
 */
export const safeMap = <T, R>(
  arr: T[] | undefined | null,
  mapper: (item: T, index: number) => R
): R[] => {
  return Array.isArray(arr) ? arr.map(mapper) : [];
};

/**
 * Encuentra un elemento en un array de forma segura
 * @param arr - Array, undefined o null
 * @param predicate - Función de búsqueda
 * @returns El elemento encontrado o undefined
 */
export const safeFind = <T,>(
  arr: T[] | undefined | null,
  predicate: (item: T) => boolean
): T | undefined => {
  return Array.isArray(arr) ? arr.find(predicate) : undefined;
};

