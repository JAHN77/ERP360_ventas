/**
 * Servicio principal de generación de PDF
 * Orquesta todo el proceso de generación
 */
import { StyleEngine } from './StyleEngine';
import { HtmlBuilder } from './HtmlBuilder';
import { HtmlValidator } from './HtmlValidator';
import { pdfApiClient } from '../api/pdfApiClient';
import { GeneratePdfOptions, PdfGenerationResult, PdfError } from './types';

export class PdfService {
  /**
   * Genera PDF desde un elemento HTML
   */
  static async generatePdf(
    element: HTMLElement,
    options: GeneratePdfOptions = {}
  ): Promise<PdfGenerationResult> {
    const startTime = Date.now();

    try {
      // 1. Validar elemento
      this.validateElement(element);

      // 2. Esperar renderizado completo
      await this.waitForRender();

      // 3. Clonar y preparar elemento
      const clone = this.prepareElement(element);

      // 4. Aplicar estilos
      StyleEngine.applyStylesRecursively(element, clone);

      // 5. Serializar HTML
      const serialized = this.serializeElement(clone);

      // 6. Construir documento completo
      const htmlDocument = await HtmlBuilder.buildDocument(serialized);

      // 7. Validar HTML
      const validation = HtmlValidator.validate(htmlDocument);
      if (!validation.valid) {
        throw new Error(`HTML inválido: ${validation.errors.join(', ')}`);
      }

      // 8. Enviar al backend
      const blob = await pdfApiClient.generatePdf(htmlDocument, options);

      // 9. Validar blob
      if (!blob || blob.size < 1000) {
        throw new Error('PDF generado está vacío o es muy pequeño');
      }

      const generationTime = Date.now() - startTime;

      return {
        success: true,
        blob,
        metadata: {
          size: blob.size,
          generationTime,
          method: 'puppeteer',
          fileName: options.fileName
        }
      };

    } catch (error) {
      return this.handleError(error, startTime);
    }
  }

  private static validateElement(element: HTMLElement): void {
    if (!element) {
      throw new Error('Elemento no proporcionado');
    }

    if (!element.innerHTML || element.innerHTML.trim().length === 0) {
      throw new Error('Elemento no tiene contenido');
    }

    if (element.offsetWidth === 0 && element.offsetHeight === 0) {
      throw new Error('Elemento no tiene dimensiones visibles');
    }
  }

  private static async waitForRender(): Promise<void> {
    // Esperar fuentes
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // Esperar frames de renderizado
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  private static prepareElement(element: HTMLElement): HTMLElement {
    const clone = element.cloneNode(true) as HTMLElement;

    // Remover elementos ignorados
    clone.querySelectorAll('[data-ignore-pdf="true"]').forEach(node => node.remove());

    // Asegurar visibilidad
    clone.style.display = 'block';
    clone.style.visibility = 'visible';
    clone.style.opacity = '1';

    return clone;
  }

  private static serializeElement(element: HTMLElement): string {
    try {
      const serialized = new XMLSerializer().serializeToString(element);
      
      if (!serialized || serialized.trim().length < 100) {
        throw new Error('HTML serializado está vacío o es muy corto');
      }

      return serialized;
    } catch (error) {
      throw new Error(`Error serializando HTML: ${error}`);
    }
  }

  private static handleError(
    error: unknown,
    startTime: number
  ): PdfGenerationResult {
    const generationTime = Date.now() - startTime;

    const pdfError: PdfError = {
      code: 'PDF_GENERATION_ERROR',
      message: error instanceof Error ? error.message : 'Error desconocido',
      details: error,
      recoverable: false
    };

    return {
      success: false,
      error: pdfError,
      metadata: {
        size: 0,
        generationTime,
        method: 'puppeteer'
      }
    };
  }
}

