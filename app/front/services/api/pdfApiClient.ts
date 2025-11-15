/**
 * Cliente API para generación de PDF
 */
import { GeneratePdfOptions } from '../pdf/types';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) ||
  'http://localhost:3001/api';

const PDF_ENDPOINT = `${API_BASE_URL}/generar-pdf`;

export const pdfApiClient = {
  async generatePdf(html: string, options: GeneratePdfOptions = {}): Promise<Blob> {
    const response = await fetch(PDF_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, fileName: options.fileName }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error generando PDF (${response.status}): ${errorText}`);
    }

    return await response.blob();
  }
};

