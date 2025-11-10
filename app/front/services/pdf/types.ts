/**
 * Tipos TypeScript para el sistema de generación de PDF
 */

export interface GeneratePdfOptions {
  fileName?: string;
  format?: 'A4' | 'Letter';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  quality?: 'low' | 'medium' | 'high';
  timeout?: number;
  retries?: number;
}

export interface PdfGenerationResult {
  success: boolean;
  blob?: Blob;
  error?: PdfError;
  metadata?: {
    size: number;
    generationTime: number;
    method: 'puppeteer' | 'fallback';
    fileName?: string;
  };
}

export interface PdfError {
  code: string;
  message: string;
  details?: unknown;
  recoverable: boolean;
}

export interface StyleMapping {
  className: string;
  cssProperty: string;
  cssValue: string;
  priority: 'high' | 'medium' | 'low';
}

export interface HtmlValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

