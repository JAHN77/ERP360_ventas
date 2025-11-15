/**
 * Motor de estilos: Convierte Tailwind a CSS inline
 */
import { TAILWIND_MAPPINGS } from '../../constants/tailwindMappings';

export class StyleEngine {
  private static readonly CRITICAL_PROPERTIES = [
    'display', 'visibility', 'opacity', 'position',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'box-sizing', 'overflow', 'overflow-x', 'overflow-y',
    'flex', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
    'justify-content', 'align-items', 'align-content', 'align-self',
    'grid', 'grid-template-columns', 'grid-template-rows', 'grid-gap', 'gap',
    'grid-column', 'grid-row', 'grid-area',
    'color', 'background-color', 'background', 'background-image', 'background-size',
    'background-position', 'background-repeat',
    'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-width', 'border-style', 'border-color', 'border-radius',
    'box-shadow', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
    'text-align', 'text-decoration', 'text-transform', 'letter-spacing',
    'white-space', 'word-wrap', 'word-break', 'text-overflow',
  ];

  /**
   * Extrae todos los estilos computados de un elemento
   */
  static extractComputedStyles(element: HTMLElement): Record<string, string> {
    const computed = window.getComputedStyle(element);
    const styles: Record<string, string> = {};

    this.CRITICAL_PROPERTIES.forEach(prop => {
      try {
        const value = computed.getPropertyValue(prop);
        if (this.isValidStyleValue(value)) {
          styles[prop] = value.trim();
        }
      } catch (e) {
        // Ignorar propiedades no accesibles
      }
    });

    return styles;
  }

  /**
   * Mapea clases de Tailwind a valores CSS inline
   */
  static mapTailwindClasses(element: HTMLElement): Record<string, string> {
    const className = this.getClassName(element);
    if (!className) return {};

    const styles: Record<string, string> = {};
    const classList = className.split(/\s+/);

    classList.forEach(cls => {
      const mappings = TAILWIND_MAPPINGS.filter(m => m.className === cls);
      mappings.forEach(mapping => {
        styles[mapping.cssProperty] = mapping.cssValue;
      });
    });

    return styles;
  }

  /**
   * Aplica estilos inline a un elemento clonado
   */
  static applyInlineStyles(
    clonedElement: HTMLElement,
    computedStyles: Record<string, string>,
    tailwindStyles: Record<string, string>
  ): void {
    // Aplicar estilos computados primero (más específicos)
    Object.entries(computedStyles).forEach(([prop, value]) => {
      clonedElement.style.setProperty(prop, value);
    });

    // Aplicar mapeos de Tailwind con !important (fallback)
    Object.entries(tailwindStyles).forEach(([prop, value]) => {
      clonedElement.style.setProperty(prop, value, 'important');
    });

    // Asegurar visibilidad crítica
    this.ensureVisibility(clonedElement);
  }

  /**
   * Aplica estilos recursivamente a todos los hijos
   */
  static applyStylesRecursively(
    originalElement: HTMLElement,
    clonedElement: HTMLElement
  ): void {
    const computedStyles = this.extractComputedStyles(originalElement);
    const tailwindStyles = this.mapTailwindClasses(originalElement);

    this.applyInlineStyles(clonedElement, computedStyles, tailwindStyles);

    // Procesar hijos
    const originalChildren = Array.from(originalElement.children) as HTMLElement[];
    const clonedChildren = Array.from(clonedElement.children) as HTMLElement[];

    originalChildren.forEach((originalChild, index) => {
      if (clonedChildren[index]) {
        this.applyStylesRecursively(originalChild, clonedChildren[index]);
      }
    });
  }

  private static getClassName(element: HTMLElement): string {
    if (typeof element.className === 'string') {
      return element.className;
    }
    if (element.className?.baseVal) {
      return element.className.baseVal;
    }
    return element.getAttribute('class') || '';
  }

  private static isValidStyleValue(value: string): boolean {
    if (!value || !value.trim()) return false;
    const invalidValues = ['initial', 'inherit', 'auto', 'normal', 'none', '0px', '0'];
    if (invalidValues.includes(value.trim())) return false;
    if (value.includes('calc(') || value.includes('var(')) return false;
    return true;
  }

  private static ensureVisibility(element: HTMLElement): void {
    const computed = window.getComputedStyle(element);
    if (computed.display === 'none') {
      element.style.display = 'block';
    }
    if (computed.visibility === 'hidden') {
      element.style.visibility = 'visible';
    }
    if (computed.opacity === '0') {
      element.style.opacity = '1';
    }
  }
}

