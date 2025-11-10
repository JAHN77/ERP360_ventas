/**
 * Validador de HTML: Valida estructura HTML antes de enviar
 */
import { HtmlValidationResult } from './types';

export class HtmlValidator {
  /**
   * Valida estructura HTML antes de enviar
   */
  static validate(html: string): HtmlValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar que tenga DOCTYPE
    if (!html.includes('<!DOCTYPE')) {
      errors.push('HTML debe tener DOCTYPE');
    }

    // Validar que tenga <html>
    if (!html.includes('<html')) {
      errors.push('HTML debe tener tag <html>');
    }

    // Validar que tenga <body>
    if (!html.includes('<body')) {
      errors.push('HTML debe tener tag <body>');
    }

    // Validar que tenga #pdf-container
    if (!html.includes('id="pdf-container"')) {
      errors.push('HTML debe tener contenedor #pdf-container');
    }

    // Validar que tenga contenido
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      const bodyContent = bodyMatch[1];
      if (bodyContent.trim().length < 100) {
        errors.push('Body debe tener al menos 100 caracteres de contenido');
      }
    } else {
      errors.push('No se pudo extraer contenido del body');
    }

    // Validar que tenga CSS
    if (!html.includes('<style')) {
      warnings.push('HTML no tiene estilos CSS embebidos');
    }

    // Validar tamaño
    if (html.length < 500) {
      errors.push('HTML es demasiado pequeño');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

