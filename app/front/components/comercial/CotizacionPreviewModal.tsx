import React, { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { Cotizacion } from '../../types';
import { useNotifications } from '../../hooks/useNotifications';
import { useDocumentPreferences } from '../../hooks/useDocumentPreferences';
import DocumentOptionsToolbar from './DocumentOptionsToolbar';
import SendEmailModal from './SendEmailModal';
import { useData } from '../../hooks/useData';
import { findClienteByIdentifier } from '../../utils/clientes';
import { pdf, PDFViewer } from '@react-pdf/renderer';
import CotizacionPDFDocument from './CotizacionPDFDocument';
import { apiSendCotizacionEmail } from '../../services/apiClient';
import { generateEmailHtml } from '../../utils/emailTemplates';

interface CotizacionPreviewModalProps {
    cotizacion: Cotizacion | null;
    onClose: () => void;
}

const CotizacionPreviewModal: React.FC<CotizacionPreviewModalProps> = ({ cotizacion, onClose }) => {
    const { addNotification } = useNotifications();
    const { clientes, vendedores, datosEmpresa, productos, firmaVendedor } = useData();
    const { preferences, updatePreferences, resetPreferences } = useDocumentPreferences('cotizacion');
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const relatedData = useMemo(() => {
        if (!cotizacion) return null;
        const cliente = findClienteByIdentifier(
            clientes,
            cotizacion.clienteId ?? (cotizacion as any).cliente_id ?? (cotizacion as any).nitCliente
        ) || null;
        const vendedor = vendedores.find(v => v.id === cotizacion.vendedorId) || null;
        return { cliente, vendedor };
    }, [cotizacion, clientes, vendedores]);

    const getDocumentComponent = () => {
        if (!cotizacion || !relatedData?.cliente || !relatedData.vendedor) return null;

        return (
            <CotizacionPDFDocument
                cotizacion={cotizacion}
                cliente={relatedData.cliente}
                vendedor={relatedData.vendedor}
                empresa={datosEmpresa}
                preferences={preferences}
                productos={productos}
                firmaVendedor={firmaVendedor}
            />
        );
    };

    const handleDownload = async () => {
        if (!cotizacion || !relatedData?.cliente || !relatedData.vendedor) return;
        const doc = getDocumentComponent();
        if (!doc) return;

        setIsGenerating(true);
        addNotification({ message: `Generando PDF para ${cotizacion.numeroCotizacion}...`, type: 'info' });

        try {
            const blob = await pdf(doc).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const safeClientName = relatedData.cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');

            link.href = url;
            link.download = `Cotizacion-${cotizacion.numeroCotizacion}-${safeClientName}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            addNotification({ message: 'PDF generado correctamente.', type: 'success' });
        } catch (error) {
            console.error('Error al generar el PDF:', error);
            addNotification({ message: 'No se pudo generar el archivo. Intenta nuevamente.', type: 'warning' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendEmail = () => {
        setIsEmailModalOpen(true);
    };

    const handleConfirmSendEmail = async (emailData: { to: string; subject: string; body: string }) => {
        if (!cotizacion || !relatedData?.cliente) return;

        setIsGenerating(true);
        addNotification({ message: 'Preparando y enviando correo...', type: 'info' });

        try {
            // 1. Generar PDF
            const doc = getDocumentComponent();
            if (!doc) throw new Error('No se pudo generar el documento PDF');

            const blob = await pdf(doc).toBlob();

            // 2. Convertir a Base64
            const base64Content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    // Remover prefijo data:application/pdf;base64,
                    const base64 = result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            // 3. Enviar al backend
            const safeClientName = relatedData.cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');
            const filename = `Cotizacion-${cotizacion.numeroCotizacion}-${safeClientName}.pdf`;

            // 3. Enviar al backend usando el endpoint específico de cotizaciones
            // Esto asegura que se use la plantilla profesional y se guarde registro si aplica
            const response = await apiSendCotizacionEmail(cotizacion.id!, {
                destinatario: emailData.to,
                asunto: emailData.subject,
                mensaje: emailData.body, // Mensaje personalizado del usuario
                pdfBase64: base64Content,
                firmaVendedor: firmaVendedor // Pasar firma si está disponible en contexto
            });

            if (response.success) {
                addNotification({
                    message: `Correo enviado exitosamente a ${emailData.to}`,
                    type: 'success',
                });
                setIsEmailModalOpen(false);
            } else {
                throw new Error(response.message || 'Error al enviar el correo');
            }

        } catch (error) {
            console.error('Error sending email:', error);
            addNotification({
                message: error instanceof Error ? error.message : 'Error al enviar el correo.',
                type: 'error'
            });
        } finally {
            setIsGenerating(false);
        }
    };


    if (!cotizacion || !relatedData || !relatedData.cliente || !relatedData.vendedor) {
        return null;
    }

    return (
        <>
            <Modal isOpen={!!cotizacion} onClose={onClose} title="" size="4xl" noPadding>
                <div className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between p-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 px-2 truncate">
                            Cotización: {cotizacion.numeroCotizacion}
                        </h3>
                        <div className="flex items-center space-x-1 bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-lg">
                            <button
                                onClick={handleDownload}
                                disabled={isGenerating}
                                title="Descargar PDF"
                                className="h-8 w-8 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-sky-500 transition-colors"
                            >
                                <i className={`fas ${isGenerating ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
                            </button>
                            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                            <button
                                onClick={handleSendEmail}
                                disabled={isGenerating}
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
                    <DocumentOptionsToolbar
                        preferences={preferences}
                        onPreferenceChange={updatePreferences}
                        onReset={resetPreferences}
                        supportedOptions={{ prices: true, signatures: true, details: true }}
                    />
                </div>

                <div className="bg-slate-100 dark:bg-slate-900 h-[80vh] flex justify-center overflow-hidden">
                    <PDFViewer
                        key={JSON.stringify(preferences)}
                        width="100%"
                        height="100%"
                        className="w-full h-full border-none"
                        showToolbar={false}
                    >
                        {getDocumentComponent()}
                    </PDFViewer>
                </div>
            </Modal>
            {isEmailModalOpen && cotizacion && relatedData.cliente && (
                <SendEmailModal
                    isOpen={isEmailModalOpen}
                    onClose={() => setIsEmailModalOpen(false)}
                    onSend={handleConfirmSendEmail}
                    to={relatedData.cliente.email || ''}
                    subject={`Cotización ${cotizacion.numeroCotizacion} de ${datosEmpresa.nombre}`}
                    body={`Estimado/a ${relatedData.cliente.nombreCompleto},

Esperamos que este mensaje le encuentre bien.

Adjunto a este correo encontrará la cotización N° ${cotizacion.numeroCotizacion} solicitada.

Quedamos atentos a sus comentarios.

Cordialmente,
El equipo de ${datosEmpresa.nombre}`}
                />
            )}
        </>
    );
};

export default CotizacionPreviewModal;
