import React, { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { Factura } from '../../types';
import { useNotifications } from '../../hooks/useNotifications';
import { useDocumentPreferences } from '../../hooks/useDocumentPreferences';
import DocumentOptionsToolbar from '../comercial/DocumentOptionsToolbar';
import SendEmailModal from '../comercial/SendEmailModal';
import { useData } from '../../hooks/useData';
import { findClienteByIdentifier } from '../../utils/clientes';
import { pdf, PDFViewer } from '@react-pdf/renderer';
import FacturaPDFDocument from './FacturaPDFDocument';

interface FacturaPreviewModalProps {
    factura: Factura | null;
    onClose: () => void;
    onTimbrar?: (id: string) => Promise<void>;
}

const FacturaPreviewModal: React.FC<FacturaPreviewModalProps> = ({ factura, onClose, onTimbrar }) => {
    const { addNotification } = useNotifications();
    const { clientes, datosEmpresa, productos, firmaVendedor } = useData();
    const { preferences, updatePreferences, resetPreferences } = useDocumentPreferences('factura');
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isStamping, setIsStamping] = useState(false);

    const handleTimbrarClick = async () => {
        if (!factura || !onTimbrar) return;

        // Confirmar acción
        if (!window.confirm(`¿Está seguro de que desea timbrar la factura ${factura.numeroFactura}? Esto enviará el documento a la DIAN.`)) {
            return;
        }

        setIsStamping(true);
        try {
            await onTimbrar(factura.id);
            // El modal se cerrará o actualizará externamente tras el éxito
        } catch (error) {
            console.error('Error al timbrar desde modal:', error);
            // Notificación ya manejada externamente, pero aseguramos estado
        } finally {
            setIsStamping(false);
        }
    };

    const cliente = useMemo(() => {
        if (!factura) return null;
        return findClienteByIdentifier(
            clientes,
            factura.clienteId ?? (factura as any).cliente_id ?? (factura as any).nitCliente
        ) || null;
    }, [factura, clientes]);

    // Use useMemo for the document component to allow PDFViewer to update correctly without unmounting/remounting
    const documentComponent = useMemo(() => {
        if (!factura || !cliente) return null;

        return (
            <FacturaPDFDocument
                factura={factura}
                cliente={cliente}
                empresa={datosEmpresa}
                preferences={preferences}
                productos={productos}
                firmaVendedor={firmaVendedor}
            />
        );
    }, [factura, cliente, datosEmpresa, preferences, productos]);

    const handleDownload = async () => {
        if (!documentComponent) return;

        setIsGenerating(true);
        addNotification({ message: `Generando PDF para factura ${factura?.numeroFactura}...`, type: 'info' });

        try {
            const blob = await pdf(documentComponent).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const safeClientName = cliente?.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_') || 'Cliente';

            link.href = url;
            link.download = `Factura-${factura?.numeroFactura}-${safeClientName}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            addNotification({ message: 'PDF descargado correctamente.', type: 'success' });
        } catch (error) {
            console.error('Error generando PDF:', error);
            addNotification({ message: 'Error al generar el PDF.', type: 'warning' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendEmail = async () => {
        await handleDownload();
        setTimeout(() => {
            setIsEmailModalOpen(true);
        }, 100);
    };

    const handleConfirmSendEmail = async (emailData: { to: string; subject: string; body: string }) => {
        if (!factura) return;

        const subjectEncoded = encodeURIComponent(emailData.subject);
        const bodyEncoded = encodeURIComponent(emailData.body);
        const mailtoLink = `mailto:${emailData.to}?subject=${subjectEncoded}&body=${bodyEncoded}`;

        window.location.href = mailtoLink;

        addNotification({
            message: `PDF descargado. Se ha abierto tu cliente de correo para enviar la factura ${factura.numeroFactura}.`,
            type: 'success',
        });
        setIsEmailModalOpen(false);
    };

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

    return (
        <>
            <Modal isOpen={!!factura} onClose={onClose} title="" size="4xl" noPadding>
                <div className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between p-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 px-2 truncate">
                            Factura: {factura.numeroFactura}
                            {factura.estado === 'BORRADOR' && (
                                <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                    BORRADOR
                                </span>
                            )}
                        </h3>
                        <div className="flex items-center space-x-1 bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-lg">
                            {onTimbrar && factura.estado === 'BORRADOR' && (
                                <>
                                    <button
                                        onClick={handleTimbrarClick}
                                        disabled={isGenerating || isStamping}
                                        title="Timbrar y Enviar a DIAN"
                                        className="h-8 px-3 flex items-center justify-center rounded bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed mr-1"
                                    >
                                        {isStamping ? (
                                            <>
                                                <i className="fas fa-spinner fa-spin mr-2"></i>
                                                <span>Timbrando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-paper-plane mr-2"></i>
                                                <span className="font-medium text-sm">Timbrar</span>
                                            </>
                                        )}
                                    </button>
                                    <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                                </>
                            )}
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
                        supportedOptions={{ prices: true, signatures: false, details: true }}
                    />
                </div>

                <div className="bg-slate-100 dark:bg-slate-900 h-[80vh] flex justify-center overflow-hidden">
                    {documentComponent && (
                        <PDFViewer
                            key={JSON.stringify(preferences)}
                            width="100%"
                            height="100%"
                            className="w-full h-full border-none"
                            showToolbar={false}
                        >
                            {documentComponent}
                        </PDFViewer>
                    )}
                </div>
            </Modal>
            {isEmailModalOpen && factura && cliente && (
                <SendEmailModal
                    isOpen={isEmailModalOpen}
                    onClose={() => setIsEmailModalOpen(false)}
                    onSend={handleConfirmSendEmail}
                    to={cliente.email || ''}
                    subject={`Factura ${factura.numeroFactura} de ${datosEmpresa.nombre}`}
                    body={`Estimado/a ${cliente.nombreCompleto},

Adjuntamos su factura electrónica N° ${factura.numeroFactura}.

Gracias por su compra.
Atentamente,
El equipo de ${datosEmpresa.nombre}`}
                />
            )}
        </>
    );
};

export default FacturaPreviewModal;