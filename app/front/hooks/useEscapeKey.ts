import { useEffect } from 'react';

/**
 * Custom hook para detectar cuando se presiona la tecla Escape
 * @param handler - Función que se ejecuta cuando se presiona Escape
 * @param isEnabled - Si está habilitado o no (opcional, por defecto true)
 */
export function useEscapeKey(
  handler: () => void,
  isEnabled: boolean = true
) {
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handler();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handler, isEnabled]);
}

