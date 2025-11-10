/**
 * Validador de HTML: Valida estructura HTML antes de procesar
 */
class HtmlValidator {
  static validate(html) {
    const errors = [];
    const warnings = [];

    if (!html || typeof html !== 'string' || html.trim().length === 0) {
      errors.push('HTML vacío o inválido');
      return { valid: false, errors, warnings };
    }

    // Validar estructura básica
    if (!html.includes('<!DOCTYPE')) {
      errors.push('HTML debe tener DOCTYPE');
    }

    if (!html.includes('<html')) {
      errors.push('HTML debe tener tag <html>');
    }

    if (!html.includes('<body')) {
      errors.push('HTML debe tener tag <body>');
    }

    // Validar contenedor
    if (!html.includes('id="pdf-container"')) {
      errors.push('HTML debe tener contenedor #pdf-container');
    }

    // Validar contenido del body
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      const bodyContent = bodyMatch[1];
      if (bodyContent.trim().length < 100) {
        errors.push('Body debe tener al menos 100 caracteres de contenido');
      }
    } else {
      errors.push('No se pudo extraer contenido del body');
    }

    // Validar CSS
    if (!html.includes('<style')) {
      warnings.push('HTML no tiene estilos CSS embebidos');
    }

    if (!html.includes('pdf-all-css')) {
      warnings.push('HTML no tiene CSS de Tailwind embebido');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = HtmlValidator;

