import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
  containerId?: string;
}

/**
 * Portal component que renderiza children fuera del árbol DOM actual
 * Útil para dropdowns, modales, tooltips que necesitan escapar del overflow del contenedor padre
 */
const Portal: React.FC<PortalProps> = ({ children, containerId = 'portal-root' }) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Buscar o crear el contenedor portal
    let portalContainer = document.getElementById(containerId);
    
    if (!portalContainer) {
      // Crear el contenedor si no existe
      portalContainer = document.createElement('div');
      portalContainer.id = containerId;
      portalContainer.style.position = 'fixed';
      portalContainer.style.top = '0';
      portalContainer.style.left = '0';
      portalContainer.style.width = '100%';
      portalContainer.style.height = '100%';
      portalContainer.style.pointerEvents = 'none'; // No interceptar eventos de mouse
      portalContainer.style.zIndex = '9999';
      document.body.appendChild(portalContainer);
    }
    
    setContainer(portalContainer);
    
    // Cleanup: remover el contenedor cuando el componente se desmonte (opcional)
    // return () => {
    //   if (portalContainer && portalContainer.parentNode) {
    //     portalContainer.parentNode.removeChild(portalContainer);
    //   }
    // };
  }, [containerId]);

  if (!container) return null;

  return createPortal(children, container);
};

export default Portal;

