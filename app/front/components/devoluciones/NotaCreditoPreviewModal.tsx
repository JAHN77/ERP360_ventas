import React, { useRef, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { NotaCredito } from '../../types';
import NotaCreditoPDF from './NotaCreditoPDF';
import { useNotifications } from '../../hooks/useNotifications';
import SendEmailModal from '../comercial/SendEmailModal';
import { useData } from '../../hooks/useData';
import { findClienteByIdentifier } from '../../utils/clientes';

interface NotaCreditoPreviewModalProps {
    notaCredito: NotaCredito | null;
    onClose: () => void;
}

declare global {
  interface Window {
    jspdf: any;
    html2canvas: any;
  }
}

const NotaCreditoPreviewModal: React.FC<NotaCreditoPreviewModalProps> = ({ notaCredito, onClose }) => {
    const { addNotification } = useNotifications();
    const { facturas: allFacturas, clientes, datosEmpresa } = useData();
    const componentRef = useRef<HTMLDivElement>(null);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    
    const relatedData = useMemo(() => {
        if (!notaCredito) return null;
        const notaFacturaId = notaCredito.facturaId ?? (notaCredito as any).factura_id;
        const factura = allFacturas.find(f => {
            const facturaId = f?.id ?? (f as any)?.factura_id;
            return String(facturaId ?? '').trim() === String(notaFacturaId ?? '').trim();
        });
        const cliente = findClienteByIdentifier(
            clientes,
            notaCredito.clienteId ?? (notaCredito as any).cliente_id ?? (notaCredito as any).nitCliente
        );
        return { factura, cliente };
    }, [notaCredito, allFacturas, clientes]);

    const handlePrint = async () => {
        if (!notaCredito || !componentRef.current) return;
    
        addNotification({ message: `Preparando impresión para ${notaCredito.numero}...`, type: 'info' });
    
        try {
            const { jsPDF } = window.jspdf;
            const canvas = await window.html2canvas(componentRef.current, { scale: 2, useCORS: true });
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
            const y = (pdfHeight - finalHeight) / 2;
    
            pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
            pdf.autoPrint();
            
            const pdfBlob = pdf.output('blob');
            const blobUrl = URL.createObjectURL(pdfBlob);
    
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = blobUrl;
    
            iframe.onload = () => {
                URL.revokeObjectURL(blobUrl);
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            };
    
            document.body.appendChild(iframe);
    
        } catch (error) {
            console.error('Error al generar el PDF para impresión:', error);
            addNotification({ message: 'No se pudo generar el documento para imprimir.', type: 'warning' });
        }
    };

    const handleDownload = async () => {
        if (!notaCredito || !relatedData?.cliente || !componentRef.current) return;
        
        const cliente = relatedData.cliente;

        addNotification({ message: `La descarga de la Nota de Crédito ${notaCredito.numero} ha comenzado...`, type: 'info' });

        try {
            const { jsPDF } = window.jspdf;
            const canvas = await window.html2canvas(componentRef.current, { scale: 2, useCORS: true });
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
            const y = (pdfHeight - finalHeight) / 2;

            pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
            
            const safeClientName = cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `NotaCredito-${notaCredito.numero}-${safeClientName}-${notaCredito.fechaEmision}.pdf`;
            
            pdf.save(fileName);

        } catch (error) {
            console.error('Error al generar el PDF:', error);
            addNotification({ message: 'No se pudo generar el archivo. Intenta nuevamente.', type: 'warning' });
        }
    };

    const handleSendEmail = async () => {
        await handleDownload();
        setIsEmailModalOpen(true);
    };

    const handleConfirmSendEmail = (emailData: { to: string }) => {
        if (!notaCredito) return;
        addNotification({
            message: `PDF descargado. Se ha abierto tu cliente de correo para enviar la Nota de Crédito ${notaCredito.numero}.`,
            type: 'success',
        });
        setIsEmailModalOpen(false);
    };


    if (!notaCredito || !relatedData || !relatedData.factura || !relatedData.cliente) {
        return null;
    }
    
    const childWithProps = <NotaCreditoPDF 
        ref={componentRef}
        notaCredito={notaCredito}
        factura={relatedData.factura}
        cliente={relatedData.cliente}
        empresa={{
            nombre: datosEmpresa.nombre,
            nit: datosEmpresa.nit,
            direccion: datosEmpresa.direccion
        }}
    />;

    return (
        <>
            <Modal isOpen={!!notaCredito} onClose={onClose} title="" size="3xl" noPadding>
                <div className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between p-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 px-2 truncate">
                            Previsualizar Nota de Crédito: {notaCredito.numero}
                        </h3>
                        <div className="flex items-center space-x-1 bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-lg">
                            <button 
                                onClick={handleDownload}
                                title="Descargar Borrador PDF"
                                className="h-8 w-8 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-sky-500 transition-colors"
                            >
                                <i className="fas fa-download"></i>
                            </button>
                            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                            <button
                                onClick={handleSendEmail}
                                title="Enviar por Correo"
                                className="h-8 w-8 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-500 transition-colors"
                            >
                                <i className="fas fa-paper-plane"></i>
                            </button>
                            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                            <button 
                                onClick={onClose} 
                                title="Cerrar"
                                className="h-8 w-8 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-red-500 transition-colors"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-200 dark:bg-slate-900 p-4 sm:p-8">
                    <div className="bg-white shadow-lg rounded-md overflow-hidden max-w-4xl mx-auto">
                        {childWithProps}
                    </div>
                </div>
            </Modal>
            {isEmailModalOpen && notaCredito && relatedData?.cliente && relatedData.factura && (
                <SendEmailModal
                    isOpen={isEmailModalOpen}
                    onClose={() => setIsEmailModalOpen(false)}
                    onSend={handleConfirmSendEmail}
                    to={relatedData.cliente.email}
                    subject={`Nota de Crédito ${notaCredito.numero} de ${datosEmpresa.nombre}`}
                    body={
`Estimado/a ${relatedData.cliente.nombreCompleto},

Le informamos que hemos procesado una nota de crédito a su favor con el número ${notaCredito.numero}.
Este documento, que se adjunta, detalla la devolución correspondiente a la factura ${relatedData.factura.numeroFactura}. El valor será aplicado a su estado de cuenta.

Atentamente,
El equipo de ${datosEmpresa.nombre}`
                    }
                />
            )}
        </>
    );
};

export default NotaCreditoPreviewModal;
