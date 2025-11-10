/**
 * @deprecated Usar PdfService de services/pdf/PdfService.ts
 * Este archivo se mantiene para compatibilidad hacia atrás
 */
import { PdfService } from '../services/pdf/PdfService';
import { GeneratePdfOptions } from '../services/pdf/types';

// Re-exportar para compatibilidad
export type { GeneratePdfOptions };

/**
 * Wrapper de compatibilidad - Usa el nuevo PdfService internamente
 * @deprecated Usar PdfService.generatePdf directamente
 */
export const descargarElementoComoPDF = async (
  element: HTMLElement,
  options: GeneratePdfOptions = {},
): Promise<void> => {
  const result = await PdfService.generatePdf(element, options);

  if (!result.success) {
    throw new Error(result.error?.message || 'Error generando PDF');
  }

  if (!result.blob) {
    throw new Error('PDF generado está vacío');
  }

  // Descargar PDF
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = options.fileName ?? 'documento.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
