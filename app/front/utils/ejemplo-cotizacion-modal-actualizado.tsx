/**
 * EJEMPLO: CotizacionPreviewModal actualizado con ambas opciones
 * 
 * Este ejemplo muestra cómo usar tanto el método actual como el nuevo
 * para generar PDFs desde componentes React
 */

import React, { useMemo, useRef, useState } from 'react';
import { Cotizacion, Cliente, Vendedor } from '../types';
import CotizacionPDF from '../components/comercial/CotizacionPDF';
import { descargarElementoComoPDF } from './pdfClient';
import { generarPDFDesdeReact } from './reactToHtml';

interface CotizacionPreviewModalProps {
    cotizacion: Cotizacion | null;
    cliente: Cliente | null;
    vendedor: Vendedor | null;
    empresa: any;
    preferences: any;
    onClose: () => void;
}

/**
 * Versión actualizada con ambas opciones de generación de PDF
 */
export const CotizacionPreviewModalActualizado: React.FC<CotizacionPreviewModalProps> = ({
    cotizacion,
    cliente,
    vendedor,
    empresa,
    preferences,
    onClose
}) => {
    const componentRef = useRef<HTMLDivElement>(null);
    const [useReactToHtml, setUseReactToHtml] = useState(false); // Toggle entre métodos

    // Método 1: Actual (usa el elemento renderizado en el DOM)
    const handleDownloadActual = async () => {
        if (!cotizacion || !cliente || !vendedor || !componentRef.current) return;

        try {
            const safeClientName = cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');
            await descargarElementoComoPDF(componentRef.current, {
                fileName: `Cotizacion-${cotizacion.numeroCotizacion}-${safeClientName}.pdf`,
            });
            console.log('PDF generado con método actual');
        } catch (error) {
            console.error('Error generando PDF:', error);
        }
    };

    // Método 2: Nuevo (convierte React directamente a HTML)
    const handleDownloadNuevo = async () => {
        if (!cotizacion || !cliente || !vendedor) return;

        try {
            const safeClientName = cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');
            
            await generarPDFDesdeReact(
                <CotizacionPDF
                    cotizacion={cotizacion}
                    cliente={cliente}
                    vendedor={vendedor}
                    empresa={empresa}
                    preferences={preferences}
                />,
                `Cotizacion-${cotizacion.numeroCotizacion}-${safeClientName}.pdf`,
                {
                    includeTailwind: true,
                    title: `Cotización ${cotizacion.numeroCotizacion}`
                }
            );
            console.log('PDF generado con método nuevo');
        } catch (error) {
            console.error('Error generando PDF:', error);
        }
    };

    // Método unificado: usa el método seleccionado
    const handleDownload = async () => {
        if (useReactToHtml) {
            await handleDownloadNuevo();
        } else {
            await handleDownloadActual();
        }
    };

    if (!cotizacion || !cliente || !vendedor) {
        return null;
    }

    return (
        <div>
            {/* Toggle para cambiar entre métodos (solo para desarrollo) */}
            <div style={{ padding: '10px', background: '#f0f0f0', marginBottom: '10px' }}>
                <label>
                    <input
                        type="checkbox"
                        checked={useReactToHtml}
                        onChange={(e) => setUseReactToHtml(e.target.checked)}
                    />
                    Usar método nuevo (React a HTML directo)
                </label>
                <p style={{ fontSize: '12px', marginTop: '5px', color: '#666' }}>
                    {useReactToHtml 
                        ? 'Método nuevo: Convierte React directamente a HTML (no requiere ref)'
                        : 'Método actual: Usa el elemento renderizado en el DOM (requiere ref)'
                    }
                </p>
            </div>

            {/* Botón de descarga */}
            <button onClick={handleDownload}>
                Descargar PDF
            </button>

            {/* Preview del componente (solo necesario para método actual) */}
            {!useReactToHtml && (
                <div ref={componentRef}>
                    <CotizacionPDF
                        cotizacion={cotizacion}
                        cliente={cliente}
                        vendedor={vendedor}
                        empresa={empresa}
                        preferences={preferences}
                    />
                </div>
            )}

            {/* Preview siempre visible */}
            <div style={{ marginTop: '20px' }}>
                <CotizacionPDF
                    cotizacion={cotizacion}
                    cliente={cliente}
                    vendedor={vendedor}
                    empresa={empresa}
                    preferences={preferences}
                />
            </div>
        </div>
    );
};

/**
 * Versión simplificada: Solo método nuevo (recomendado)
 */
export const CotizacionPreviewModalSimplificado: React.FC<CotizacionPreviewModalProps> = ({
    cotizacion,
    cliente,
    vendedor,
    empresa,
    preferences,
    onClose
}) => {
    const handleDownload = async () => {
        if (!cotizacion || !cliente || !vendedor) return;

        try {
            const safeClientName = cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');
            
            // Método nuevo: Más simple, no requiere ref
            await generarPDFDesdeReact(
                <CotizacionPDF
                    cotizacion={cotizacion}
                    cliente={cliente}
                    vendedor={vendedor}
                    empresa={empresa}
                    preferences={preferences}
                />,
                `Cotizacion-${cotizacion.numeroCotizacion}-${safeClientName}.pdf`,
                {
                    includeTailwind: true,
                    title: `Cotización ${cotizacion.numeroCotizacion}`
                }
            );
        } catch (error) {
            console.error('Error generando PDF:', error);
        }
    };

    if (!cotizacion || !cliente || !vendedor) {
        return null;
    }

    return (
        <div>
            <button onClick={handleDownload}>
                Descargar PDF
            </button>

            {/* Preview del componente */}
            <div style={{ marginTop: '20px' }}>
                <CotizacionPDF
                    cotizacion={cotizacion}
                    cliente={cliente}
                    vendedor={vendedor}
                    empresa={empresa}
                    preferences={preferences}
                />
            </div>
        </div>
    );
};

