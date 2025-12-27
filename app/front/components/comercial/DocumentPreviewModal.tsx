import React, { useRef, useState, useMemo } from 'react';
import { PDFViewer, pdf } from '@react-pdf/renderer'; // NEW IMPORTS
import Modal from '../ui/Modal';
import { useNotifications } from '../../hooks/useNotifications';
import { useDocumentPreferences, DocumentType } from '../../hooks/useDocumentPreferences';
import DocumentOptionsToolbar from './DocumentOptionsToolbar';
import { DocumentPreferences } from '../../types';
import SendEmailModal from './SendEmailModal';
import { useData } from '../../hooks/useData';
import { apiSendGenericEmail } from '../../services/apiClient';
// import { descargarElementoComoPDF } from '../../utils/pdfClient'; // REMOVED


interface DocumentPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    onConfirm?: () => Promise<void> | void; // Optional
    onEdit?: () => void; // Optional
    children: React.ReactNode;
    confirmLabel?: string;
    isConfirming?: boolean;
    onSaveAndSend?: () => void;
    isSaving?: boolean;
    saveAndSendLabel?: string;
    documentType: DocumentType;
    clientEmail?: string;
    clientName?: string;
    documentId?: string | number; // ID del documento para enviar por correo
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
    documentId,
}) => {

    const { addNotification } = useNotifications();
    const { datosEmpresa, firmaVendedor } = useData();
    // const documentRef = useRef<HTMLDivElement>(null); // Removed ref
    const { preferences, updatePreferences, resetPreferences } = useDocumentPreferences(documentType);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // Clone child to pass preferences and temporary signature
    const childWithProps = React.isValidElement(children)
        ? React.cloneElement(children, {
            preferences,
            firmaVendedor // Pass signature here
        } as any)
        : children;

    const handleDownload = async () => {
        setIsDownloading(true);
        addNotification({ message: 'Generando PDF...', type: 'info' });

        try {
            // Generate Blob using ReactPDF
            const blob = await pdf(childWithProps as React.ReactElement).toBlob();

            // Create download link
            const url = URL.createObjectURL(blob);
            const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `Previsualizacion-${safeTitle}.pdf`;

            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            addNotification({ message: 'PDF descargado correctamente.', type: 'success' });
        } catch (error) {
            console.error('Error al generar el PDF:', error);
            addNotification({
                message: `No se pudo generar el archivo: ${error}.`,
                type: 'error'
            });
        } finally {
            setIsDownloading(false);
        }
    };

    const handleSendEmail = async (destinatario: string, asunto: string, mensaje: string) => {
        setIsDownloading(true);
        addNotification({ message: 'Preparando envío de correo...', type: 'info' });

        try {
            // 1. Generar PDF Blob (Reutilizando lógica de descarga)
            const blob = await pdf(childWithProps as React.ReactElement).toBlob();

            // 2. Convertir a Base64
            const reader = new FileReader();
            reader.readAsDataURL(blob);

            reader.onloadend = async () => {
                const base64data = reader.result as string;

                // 3. Enviar al backend usando el servicio genérico
                try {
                    const result = await apiSendGenericEmail({
                        to: destinatario,
                        subject: asunto,
                        body: mensaje,
                        attachment: {
                            filename: `${documentType === 'cotizacion' ? 'Cotizacion' : documentType === 'pedido' ? 'Pedido' : documentType === 'factura' ? 'Factura' : 'Documento'}_${documentNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
                            content: base64data,
                            contentType: 'application/pdf'
                        }
                    });

                    if (result.success) {
                        addNotification({ message: '✅ Correo enviado exitosamente.', type: 'success' });
                        setIsEmailModalOpen(false);
                    } else {
                        throw new Error(result.message || 'Error al enviar el correo');
                    }
                } catch (apiError) {
                    console.error('Error API Email:', apiError);
                    addNotification({ message: `Error enviando correo: ${apiError instanceof Error ? apiError.message : 'Error desconocido'}`, type: 'error' });
                } finally {
                    setIsDownloading(false);
                }
            };

            reader.onerror = () => {
                addNotification({ message: 'Error procesando el archivo PDF para envío.', type: 'error' });
                setIsDownloading(false);
            };

        } catch (error) {
            console.error('Error generando PDF para email:', error);
            addNotification({
                message: `Error al generar el documento para envío: ${error instanceof Error ? error.message : error}`,
                type: 'error',
            });
            setIsDownloading(false);
        }
    };


    const documentNumber = title.includes(': ') ? title.split(': ')[1] : 'Borrador';

    const handleConfirm = async () => {
        if (!onConfirm) return;
        try {
            await onConfirm();
            // Después de aprobar con éxito, abrir automáticamente el modal de correo
            setIsEmailModalOpen(true);
        } catch (error) {
            console.error('Error en confirmación:', error);
        }
    };

    const emailBody = useMemo(() => {
        if (documentType === 'cotizacion') {
            return `Estimado/a ${clientName || 'Cliente'},
            
Nos es grato saludarle y presentarle a continuación nuestra propuesta comercial a través de la cotización N° ${documentNumber}.
Hemos analizado sus requerimientos y estamos seguros de que esta oferta se ajusta a sus necesidades.

Quedamos atentos a sus comentarios para poder avanzar.

Cordialmente,
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
        if (documentType === 'nota_credito') {
            return `Estimado/a ${clientName || 'cliente'},

Le informamos que se ha generado la Nota de Crédito N° ${documentNumber}.
Adjuntamos el documento para sus registros contables.

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
                            {onEdit && (
                                <button onClick={onEdit} disabled={isDownloading} title="Editar" className="h-8 w-8 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    <i className="fas fa-pencil-alt"></i>
                                </button>
                            )}
                            <button onClick={handleDownload} disabled={isDownloading} title={isDownloading ? "Generando PDF..." : "Descargar PDF"} className="h-8 w-8 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-sky-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
                            </button>
                            {clientEmail && (
                                <button
                                    onClick={() => setIsEmailModalOpen(true)}
                                    disabled={isDownloading}
                                    title="Enviar por Correo"
                                    className="h-8 w-8 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <i className={`fas ${isEmailModalOpen ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                                </button>
                            )}
                            {/* Divider */}
                            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                            {/* Group 2: Main Actions */}
                            <div className="flex items-center gap-1">
                                {onConfirm && (
                                    <button
                                        onClick={handleConfirm}
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


                <div className="bg-slate-200 dark:bg-slate-900 p-4 sm:p-8 h-[85vh]">
                    {/* Replace Direct Render with PDFViewer */}
                    <div className="bg-white shadow-lg rounded-md max-w-5xl mx-auto h-full overflow-hidden">
                        <PDFViewer
                            style={{ width: '100%', height: '100%' }}
                            showToolbar={true}
                            className="border-none"
                        >
                            {childWithProps as React.ReactElement}
                        </PDFViewer>
                    </div>
                </div>
            </Modal>
            {isEmailModalOpen && clientEmail && (
                <SendEmailModal
                    isOpen={isEmailModalOpen}
                    onClose={() => setIsEmailModalOpen(false)}
                    onSend={async (data) => {
                        await handleSendEmail(data.to, data.subject, data.body);
                    }}
                    to={clientEmail}
                    subject={`${documentType === 'cotizacion' ? 'Cotización' : documentType === 'pedido' ? 'Pedido' : 'Documento'}: #${documentNumber} - ${datosEmpresa.nombre}`}
                    body={emailBody}
                />
            )}
        </>
    );
};

export default DocumentPreviewModal;