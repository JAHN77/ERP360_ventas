import React, { useMemo, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import { Factura } from '../../types';
import FacturaPDF from './FacturaPDF';
import { useNotifications } from '../../hooks/useNotifications';
import { useDocumentPreferences } from '../../hooks/useDocumentPreferences';
import DocumentOptionsToolbar from '../comercial/DocumentOptionsToolbar';
import SendEmailModal from '../comercial/SendEmailModal';
import { useData } from '../../hooks/useData';
import { findClienteByIdentifier } from '../../utils/clientes';
import { descargarElementoComoPDF } from '../../utils/pdfClient';

interface FacturaPreviewModalProps {
    factura: Factura | null;
    onClose: () => void;
}


const FacturaPreviewModal: React.FC<FacturaPreviewModalProps> = ({ factura, onClose }) => {
    const { addNotification } = useNotifications();
    const { clientes, datosEmpresa } = useData();
    const componentRef = useRef<HTMLDivElement>(null);
    const { preferences, updatePreferences, resetPreferences } = useDocumentPreferences('factura');
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    
    const cliente = useMemo(() => {
        if (!factura) return null;
        return findClienteByIdentifier(
            clientes,
            factura.clienteId ?? (factura as any).cliente_id ?? (factura as any).nitCliente
        ) || null;
    }, [factura, clientes]);

    const handlePrint = async () => {
        if (!factura || !cliente || !componentRef.current || isPrinting) {
            if (!isPrinting) {
                addNotification({ message: 'No hay contenido para imprimir. Por favor, intenta nuevamente.', type: 'warning' });
            }
            return;
        }
    
        setIsPrinting(true);
        addNotification({ message: `Preparando impresión para ${factura.numeroFactura}...`, type: 'info' });
    
        try {
            const safeClientName = cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');
            await descargarElementoComoPDF(componentRef.current, {
                fileName: `Factura-${factura.numeroFactura}-${safeClientName}-${factura.fechaFactura}.pdf`,
            });
            
            // Abrir el PDF en una nueva ventana para imprimir
            setTimeout(() => {
                window.print();
            }, 500);
        } catch (error) {
            console.error('Error al generar el PDF para impresión:', error);
            addNotification({ message: 'No se pudo generar el documento para imprimir.', type: 'warning' });
        } finally {
            setIsPrinting(false);
        }
    };

    const handleDownload = async () => {
        if (!factura || !cliente || !componentRef.current || isDownloading) {
            if (!isDownloading) {
                addNotification({ message: 'No hay contenido para descargar. Por favor, intenta nuevamente.', type: 'warning' });
            }
            return;
        }

        setIsDownloading(true);
        addNotification({ message: `Generando PDF para ${factura.numeroFactura}...`, type: 'info' });

        try {
            const safeClientName = cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');
            await descargarElementoComoPDF(componentRef.current, {
                fileName: `Factura-${factura.numeroFactura}-${safeClientName}-${factura.fechaFactura}.pdf`,
            });
            addNotification({ message: 'PDF generado correctamente.', type: 'success' });
        } catch (error) {
            console.error('Error al generar el PDF:', error);
            addNotification({ message: 'No se pudo generar el archivo. Intenta nuevamente.', type: 'warning' });
        } finally {
            setIsDownloading(false);
        }
    };

    const handleSendEmail = async () => {
        if (isDownloading || isPrinting) return;
        await handleDownload(); // Primero descarga el archivo
        // Esperar a que termine la descarga antes de abrir el modal
        setTimeout(() => {
            setIsEmailModalOpen(true); // Luego abre el modal
        }, 100);
    };

    const handleConfirmSendEmail = (emailData: { to: string; }) => {
        if (!factura) return;
        addNotification({
            message: `PDF descargado. Se ha abierto tu cliente de correo para enviar la factura ${factura.numeroFactura}.`,
            type: 'success',
        });
        setIsEmailModalOpen(false);
    };

    // ✅ Validación mejorada con mensaje de error visible
    if (!factura) {
        return (
            <Modal isOpen={true} onClose={onClose} title="Error" size="md">
                <div className="p-4 text-center">
                    <i className="fas fa-exclamation-triangle text-red-500 text-3xl mb-3"></i>
                    <p className="text-red-600 dark:text-red-400 font-semibold mb-2">No se puede mostrar la previsualización</p>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">No hay información de factura disponible.</p>
                </div>
            </Modal>
        );
    }

    if (!cliente) {
        return (
            <Modal isOpen={true} onClose={onClose} title="Error" size="md">
                <div className="p-4 text-center">
                    <i className="fas fa-exclamation-triangle text-red-500 text-3xl mb-3"></i>
                    <p className="text-red-600 dark:text-red-400 font-semibold mb-2">No se puede mostrar la previsualización</p>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">No se encontró información del cliente asociado a esta factura.</p>
                </div>
            </Modal>
        );
    }
    
    const childWithProps = <FacturaPDF 
        ref={componentRef}
        factura={factura}
        cliente={cliente}
        empresa={datosEmpresa}
        preferences={preferences}
    />

    return (
        <>
            <Modal isOpen={!!factura} onClose={onClose} title="" size="3xl" noPadding>
                <div className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between p-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 px-2 truncate">
                            Factura: {factura.numeroFactura}
                        </h3>
                        <div className="flex items-center space-x-1 bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-lg">
                            <button 
                                onClick={handleDownload}
                                disabled={isDownloading || isPrinting}
                                title={isDownloading ? "Generando PDF..." : "Descargar Borrador PDF"}
                                className="h-8 w-8 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-sky-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
                            </button>
                            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                             <button 
                                onClick={handleSendEmail}
                                disabled={isDownloading || isPrinting}
                                title={isDownloading ? "Generando PDF..." : "Enviar por Correo"}
                                className="h-8 w-8 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
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
                     <DocumentOptionsToolbar
                        preferences={preferences}
                        onPreferenceChange={updatePreferences}
                        onReset={resetPreferences}
                        supportedOptions={{ prices: false, signatures: true, details: true }}
                    />
                </div>
                <div className="bg-slate-200 dark:bg-slate-900 p-4 sm:p-8">
                     <div className="bg-white shadow-lg rounded-md overflow-hidden max-w-4xl mx-auto">
                         {childWithProps}
                     </div>
                </div>
            </Modal>
            {isEmailModalOpen && factura && cliente && (
                <SendEmailModal
                    isOpen={isEmailModalOpen}
                    onClose={() => setIsEmailModalOpen(false)}
                    onSend={handleConfirmSendEmail}
                    to={cliente.email}
                    subject={`Factura ${factura.numeroFactura} de ${datosEmpresa.nombre}`}
                    body={
`Estimado ${cliente.nombreCompleto},

Adjuntamos su factura electrónica N° ${factura.numeroFactura}.

Por favor, no dude en contactarnos si tiene alguna pregunta.

Atentamente,
El equipo de ${datosEmpresa.nombre}`
                    }
                />
            )}
        </>
    );
};

export default FacturaPreviewModal;