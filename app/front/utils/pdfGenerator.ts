import ReactDOM from 'react-dom/client';
import React from 'react';
import RemisionPDF from '../components/remisiones/RemisionPDF';
import { Remision, Pedido, Cliente, DocumentPreferences, Factura } from '../types';
import FacturaPDF from '../components/facturacion/FacturaPDF';

declare global {
  interface Window {
    jspdf: any;
    html2canvas: any;
  }
}

export const generarRemisionPDFenBlob = async (
    remision: Remision,
    pedido: Pedido,
    cliente: Cliente,
    empresa: any,
    preferences: DocumentPreferences
): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
        const node = document.createElement('div');
        node.className = 'pdf-render-root';
        node.style.position = 'fixed';
        node.style.left = '-9999px';
        node.style.top = '0';
        node.style.width = '210mm'; // A4 width
        node.style.minHeight = '297mm';
        node.style.padding = '18mm';
        node.style.display = 'flex';
        node.style.alignItems = 'stretch';
        node.style.justifyContent = 'center';
        node.style.background = '#f3f4f6';
        document.body.appendChild(node);
        
        const root = ReactDOM.createRoot(node);
        
        const ComponentToRender = React.createElement(RemisionPDF, {
            remision,
            pedido,
            cliente,
            empresa,
            preferences
        });

        root.render(ComponentToRender);
        
        // Wait a bit for the component to fully render, especially with images or complex layouts
        setTimeout(async () => {
            try {
                const { jsPDF } = window.jspdf;
                if (document.fonts?.ready) {
                    await document.fonts.ready.catch(() => undefined);
                }
                await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
                const canvas = await window.html2canvas(node, {
                    scale: 2.5,
                    useCORS: true,
                    backgroundColor: '#f3f4f6',
                    logging: false
                });
                const imgData = canvas.toDataURL('image/png');
                
                const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const imgProps = pdf.getImageProperties(imgData);
                const ratio = imgProps.width / imgProps.height;
                let finalWidth = pdfWidth;
                let finalHeight = finalWidth / ratio;
                
                if (finalHeight > pdfHeight) {
                    finalHeight = pdfHeight;
                    finalWidth = finalHeight * ratio;
                }
        
                const x = (pdfWidth - finalWidth) / 2;
                const y = Math.max((pdfHeight - finalHeight) / 2, 12);

                pdf.setFillColor(243, 244, 246);
                pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
        
                pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
                
                const pdfBlob = pdf.output('blob');
                
                // Cleanup
                root.unmount();
                if (document.body.contains(node)) {
                    document.body.removeChild(node);
                }
                
                resolve(pdfBlob);

            } catch (error) {
                // Cleanup on error
                root.unmount();
                if (document.body.contains(node)) {
                    document.body.removeChild(node);
                }
                console.error('Error generating PDF blob:', error);
                reject(error);
            }
        }, 500); // 500ms delay
    });
};

export const generarFacturaPDFenBlob = async (
    factura: Factura,
    cliente: Cliente,
    empresa: any,
    preferences: DocumentPreferences
): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
        const node = document.createElement('div');
        node.className = 'pdf-render-root';
        node.style.position = 'fixed';
        node.style.left = '-9999px';
        node.style.top = '0';
        node.style.width = '210mm'; // A4 width
        node.style.minHeight = '297mm';
        node.style.padding = '18mm';
        node.style.display = 'flex';
        node.style.alignItems = 'stretch';
        node.style.justifyContent = 'center';
        node.style.background = '#f3f4f6';
        document.body.appendChild(node);
        
        const root = ReactDOM.createRoot(node);
        
        const ComponentToRender = React.createElement(FacturaPDF, {
            factura,
            cliente,
            empresa,
            preferences
        });

        root.render(ComponentToRender);
        
        setTimeout(async () => {
            try {
                const { jsPDF } = window.jspdf;
                if (document.fonts?.ready) {
                    await document.fonts.ready.catch(() => undefined);
                }
                await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
                const canvas = await window.html2canvas(node, {
                    scale: 2.5,
                    useCORS: true,
                    backgroundColor: '#f3f4f6',
                    logging: false
                });
                const imgData = canvas.toDataURL('image/png');
                
                const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const imgProps = pdf.getImageProperties(imgData);
                const ratio = imgProps.width / imgProps.height;
                let finalWidth = pdfWidth;
                let finalHeight = finalWidth / ratio;
                
                if (finalHeight > pdfHeight) {
                    finalHeight = pdfHeight;
                    finalWidth = finalHeight * ratio;
                }
        
                const x = (pdfWidth - finalWidth) / 2;
                const y = Math.max((pdfHeight - finalHeight) / 2, 12);

                pdf.setFillColor(243, 244, 246);
                pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
        
                pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
                
                const pdfBlob = pdf.output('blob');
                
                root.unmount();
                if (document.body.contains(node)) {
                    document.body.removeChild(node);
                }
                
                resolve(pdfBlob);

            } catch (error) {
                root.unmount();
                if (document.body.contains(node)) {
                    document.body.removeChild(node);
                }
                console.error('Error generating Invoice PDF blob:', error);
                reject(error);
            }
        }, 500);
    });
};