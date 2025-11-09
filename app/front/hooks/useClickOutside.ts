import { useEffect, RefObject } from 'react';

/**
 * Custom hook para detectar clicks fuera de un elemento
 * @param ref - Referencia al elemento que queremos monitorear
 * @param handler - Función que se ejecuta cuando se hace click fuera del elemento
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>,
  handler: (event: MouseEvent | TouchEvent) => void
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      // Si el ref no existe o si se hizo clic DENTRO del ref, no hacer nada
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }

      // Si se hizo clic FUERA, llamar al handler
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      // Limpiar al desmontar
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]); // Volver a registrar solo si el ref o el handler cambian
}

