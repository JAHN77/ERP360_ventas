/**
 * EJEMPLO: Cómo usar reactToHtml con CotizacionPDF
 * 
 * Este archivo muestra cómo convertir el componente CotizacionPDF a HTML
 */

import React from 'react';
import { generarPDFDesdeReact, reactToHtml } from './reactToHtml';
import CotizacionPDF from '../components/comercial/CotizacionPDF';
import { Cotizacion, Cliente, Vendedor, DocumentPreferences } from '../types';

// Ejemplo 1: Generar PDF directamente desde el componente React
export async function ejemploGenerarPDFDirecto(
  cotizacion: Cotizacion,
  cliente: Cliente,
  vendedor: Vendedor,
  empresa: any,
  preferences: DocumentPreferences
) {
  // Crear el componente React
  const componente = (
    <CotizacionPDF
      cotizacion={cotizacion}
      cliente={cliente}
      vendedor={vendedor}
      empresa={empresa}
      preferences={preferences}
    />
  );

  // Generar y descargar el PDF
  await generarPDFDesdeReact(
    componente,
    `Cotizacion-${cotizacion.numeroCotizacion}.pdf`,
    {
      includeTailwind: true,
      title: `Cotización ${cotizacion.numeroCotizacion}`,
      customStyles: `
        /* Estilos adicionales si los necesitas */
        .mi-clase-personalizada {
          color: red;
        }
      `
    }
  );
}

// Ejemplo 2: Obtener solo el HTML (sin generar PDF)
export function ejemploObtenerHTML(
  cotizacion: Cotizacion,
  cliente: Cliente,
  vendedor: Vendedor,
  empresa: any,
  preferences: DocumentPreferences
): string {
  const componente = (
    <CotizacionPDF
      cotizacion={cotizacion}
      cliente={cliente}
      vendedor={vendedor}
      empresa={empresa}
      preferences={preferences}
    />
  );

  // Obtener HTML completo
  const htmlCompleto = reactToHtml(componente, {
    includeTailwind: true,
    title: `Cotización ${cotizacion.numeroCotizacion}`
  });

  return htmlCompleto;
}

// Ejemplo 3: Usar en un componente funcional
export function CotizacionPreviewModalEjemplo() {
  const handleDownloadPDF = async () => {
    // Tus datos
    const cotizacion: Cotizacion = {
      // ... datos de la cotización
    } as Cotizacion;

    const cliente: Cliente = {
      // ... datos del cliente
    } as Cliente;

    const vendedor: Vendedor = {
      // ... datos del vendedor
    } as Vendedor;

    const empresa = {
      nombre: 'ERP360 Comercial',
      nit: '900.000.000-1',
      direccion: 'Carrera 10 #20-30',
      telefono: '+57 1 234 5678'
    };

    try {
      await ejemploGenerarPDFDirecto(
        cotizacion,
        cliente,
        vendedor,
        empresa,
        {
          showPrices: true,
          signatureType: 'physical',
          detailLevel: 'full'
        }
      );
      console.log('PDF generado exitosamente');
    } catch (error) {
      console.error('Error generando PDF:', error);
    }
  };

  return (
    <button onClick={handleDownloadPDF}>
      Descargar PDF
    </button>
  );
}

// Ejemplo 4: Obtener el body para enviarlo manualmente a la API
export function ejemploObtenerBodyParaAPI(
  cotizacion: Cotizacion,
  cliente: Cliente,
  vendedor: Vendedor,
  empresa: any,
  preferences: DocumentPreferences
) {
  const componente = (
    <CotizacionPDF
      cotizacion={cotizacion}
      cliente={cliente}
      vendedor={vendedor}
      empresa={empresa}
      preferences={preferences}
    />
  );

  const html = reactToHtml(componente, {
    includeTailwind: true,
    title: `Cotización ${cotizacion.numeroCotizacion}`
  });

  // Body listo para enviar a la API
  const body = {
    html: html,
    fileName: `Cotizacion-${cotizacion.numeroCotizacion}.pdf`
  };

  return body;
}

