import React, { useRef, useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import { useNotifications } from '../../hooks/useNotifications';
import { useDocumentPreferences, DocumentType } from '../../hooks/useDocumentPreferences';
import DocumentOptionsToolbar from './DocumentOptionsToolbar';
import { DocumentPreferences } from '../../types';
import SendEmailModal from './SendEmailModal';
import { useData } from '../../hooks/useData';
import { descargarElementoComoPDF } from '../../utils/pdfClient';

interface DocumentPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    onConfirm: () => void;
    onEdit: () => void;
    children: React.ReactNode;
    confirmLabel?: string;
    isConfirming?: boolean;
    onSaveAndSend?: () => void;
    isSaving?: boolean;
    saveAndSendLabel?: string;
    documentType: DocumentType;
    clientEmail?: string; // Nuevo prop
    clientName?: string; // Nuevo prop
}


const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
    isOpen,
    onClose,
    title,
    onConfirm,
    onEdit,
    children,
    confirmLabel = 'Aprobar y Continuar',
    isConfirming = false,
    onSaveAndSend,
    isSaving = false,
    saveAndSendLabel = 'Guardar',
    documentType,
    clientEmail,
    clientName,
}) => {
    const { addNotification } = useNotifications();
    const { datosEmpresa } = useData();
    const documentRef = useRef<HTMLDivElement>(null);
    const { preferences, updatePreferences, resetPreferences } = useDocumentPreferences(documentType);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        // Buscar el elemento que contiene el contenido visible
        const contentElement = documentRef.current || 
            document.querySelector('.bg-white.shadow-lg.rounded-md') as HTMLElement;
        
        if (!contentElement || isDownloading) {
            if (!isDownloading) {
                addNotification({ message: 'No hay contenido para descargar. Por favor, intenta nuevamente.', type: 'warning' });
            }
            return;
        }

        // Validar que el elemento tenga contenido
        if (!contentElement.innerHTML || contentElement.innerHTML.trim().length < 100) {
            addNotification({ message: 'El contenido está vacío. Por favor, verifica la previsualización.', type: 'warning' });
            return;
        }

        setIsDownloading(true);
        addNotification({ message: 'Generando PDF desde la previsualización...', type: 'info' });

        try {
            // Esperar un momento para asegurar que el contenido esté completamente renderizado
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Generar nombre de archivo seguro
            const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `Previsualizacion-${safeTitle}.pdf`;

            // Usar el servicio de PDF con Puppeteer que captura correctamente el contenido
            await descargarElementoComoPDF(contentElement, {
                fileName,
                format: 'A4',
                margin: {
                    top: '10mm',
                    right: '12mm',
                    bottom: '12mm',
                    left: '12mm'
                }
            });

            addNotification({ message: 'PDF generado correctamente desde la previsualización.', type: 'success' });
        } catch (error) {
            console.error('Error al generar el PDF:', error);
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            addNotification({ 
                message: `No se pudo generar el archivo: ${errorMessage}. Intenta nuevamente.`, 
                type: 'error' 
            });
        } finally {
            setIsDownloading(false);
        }
    };

    const handleSendNotification = (emailData: { to: string }) => {
        addNotification({
            message: `PDF descargado. Se ha abierto tu cliente de correo para enviar el documento.`,
            type: 'success',
        });
        setIsEmailModalOpen(false);
    };
    
    // Clone child to pass preferences (el ref ahora está en el contenedor)
    const childWithProps = React.isValidElement(children) 
        ? React.cloneElement(children, { preferences } as { preferences: DocumentPreferences }) 
        : children;

    const documentNumber = title.split(': ')[1] || 'N/A';
    
    const emailBody = useMemo(() => {
        if (documentType === 'cotizacion') {
            return `Estimado/a ${clientName || 'cliente'},

Dando seguimiento a su solicitud, nos complace enviarle la cotización N° ${documentNumber} con el detalle de los productos/servicios solicitados.
Quedamos a su disposición para cualquier consulta o si desea proceder con el pedido.

Atentamente,
El equipo de ${datosEmpresa.nombre}`;
        }
        if (documentType === 'pedido') {
            return `Estimado/a ${clientName || 'cliente'},

Este correo es para confirmar que hemos recibido y estamos procesando su orden de compra N° ${documentNumber}.
Adjuntamos una copia del pedido para sus registros. Le notificaremos una vez que sus productos hayan sido despachados.

¡Gracias por su compra!

Atentamente,
El equipo de ${datosEmpresa.nombre}`;
        }
        // Fallback genérico
        return `Estimado ${clientName || 'cliente'},

Adjuntamos su documento ${documentNumber} de ${datosEmpresa.nombre}.

Por favor, no dude en contactarnos si tiene alguna pregunta.

Atentamente,
El equipo de ${datosEmpresa.nombre}`;
    }, [documentType, clientName, documentNumber, datosEmpresa.nombre]);


    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="" size="5xl" noPadding>
                <div className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between p-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 px-2 truncate">{title}</h3>
                        <div className="flex items-center space-x-1 bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-lg">
                            {/* Group 1: Edit/Export */}
                            <button onClick={onEdit} disabled={isDownloading} title="Editar" className="h-8 w-8 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                <i className="fas fa-pencil-alt"></i>
                            </button>
                            <button onClick={handleDownload} disabled={isDownloading} title={isDownloading ? "Generando PDF..." : "Descargar Borrador PDF"} className="h-8 w-8 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-sky-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
                            </button>
                             {clientEmail && (
                                <button
                                    onClick={async () => {
                                        await handleDownload();
                                        if (!isDownloading) {
                                            setIsEmailModalOpen(true);
                                        }
                                    }}
                                    disabled={isDownloading}
                                    title={isDownloading ? "Generando PDF..." : "Enviar por Correo"}
                                    className="h-8 w-8 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                                </button>
                            )}
                            {/* Divider */}
                            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                            {/* Group 2: Main Actions */}
                            <div className="flex items-center gap-1">
                            {onSaveAndSend && (
                                <button 
                                    onClick={onSaveAndSend}
                                    disabled={isSaving || isConfirming}
                                        className="px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-400 flex items-center gap-2"
                                >
                                        {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                                        <span className="hidden sm:inline">{saveAndSendLabel}</span>
                                </button>
                            )}
                            {onConfirm && (
                                <button 
                                    onClick={onConfirm}
                                    disabled={isConfirming || isSaving}
                                        className="px-3 py-1.5 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-slate-400 flex items-center gap-2"
                                >
                                        {isConfirming ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check"></i>}
                                        <span>{confirmLabel}</span>
                                </button>
                            )}
                            </div>
                            {/* Divider */}
                            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                            {/* Group 3: Close */}
                            <button onClick={onClose} title="Cerrar" className="h-8 w-8 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-red-500 transition-colors">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <DocumentOptionsToolbar
                        preferences={preferences}
                        onPreferenceChange={updatePreferences}
                        onReset={resetPreferences}
                        supportedOptions={{ prices: true, signatures: true, details: true }}
                    />
                </div>


                <div className="bg-slate-200 dark:bg-slate-900 p-4 sm:p-8">
                    <div ref={documentRef} className="bg-white shadow-lg rounded-md max-w-4xl mx-auto" style={{ overflow: 'visible' }}>
                        {childWithProps}
                    </div>
                </div>
            </Modal>
            {isEmailModalOpen && clientEmail && (
                <SendEmailModal
                    isOpen={isEmailModalOpen}
                    onClose={() => setIsEmailModalOpen(false)}
                    onSend={handleSendNotification}
                    to={clientEmail}
                    subject={`${documentType === 'cotizacion' ? 'Cotización' : 'Pedido'}: ${documentNumber} de ${datosEmpresa.nombre}`}
                    body={emailBody}
                />
            )}
        </>
    );
};

export default DocumentPreviewModal;