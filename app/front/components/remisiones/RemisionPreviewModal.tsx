import React, { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { Remision } from '../../types';
import { useNotifications } from '../../hooks/useNotifications';
import { useDocumentPreferences } from '../../hooks/useDocumentPreferences';
import DocumentOptionsToolbar from '../comercial/DocumentOptionsToolbar';
import SendEmailModal from '../comercial/SendEmailModal';
import { useData } from '../../hooks/useData';
import { findClienteByIdentifier } from '../../utils/clientes';
import { pdf, PDFViewer } from '@react-pdf/renderer';
import RemisionPDFDocument from './RemisionPDFDocument';

interface RemisionPreviewModalProps {
    remision: Remision | null;
    onClose: () => void;
}

const RemisionPreviewModal: React.FC<RemisionPreviewModalProps> = ({ remision, onClose }) => {
    const { addNotification } = useNotifications();
    const { pedidos, clientes, datosEmpresa, productos, firmaVendedor } = useData();
    const { preferences, updatePreferences, resetPreferences } = useDocumentPreferences('remision');
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const relatedData = useMemo(() => {
        if (!remision) return null;
        const remisionPedidoId = remision.pedidoId ?? (remision as any).pedido_id;
        const remisionClienteId = remision.clienteId ?? (remision as any).cliente_id ?? (remision as any).nitCliente;

        const pedido = pedidos.find(p => {
            const pedidoId = p?.id ?? (p as any)?.pedido_id;
            return String(pedidoId ?? '').trim() === String(remisionPedidoId ?? '').trim();
        });
        const cliente = findClienteByIdentifier(clientes, remisionClienteId);
        return { pedido, cliente };
    }, [remision, pedidos, clientes]);

    const getDocumentComponent = () => {
        if (!remision || !relatedData?.cliente || !relatedData.pedido) return null;

        return (
            <RemisionPDFDocument
                remision={remision}
                pedido={relatedData.pedido}
                cliente={relatedData.cliente}
                empresa={datosEmpresa}
                preferences={preferences}
                productos={productos}
                firmaVendedor={firmaVendedor}
            />
        );
    };

    const handleDownload = async () => {
        if (!remision || !relatedData?.cliente) return;
        const doc = getDocumentComponent();
        if (!doc) return;

        setIsGenerating(true);
        addNotification({ message: `Generando PDF para remisión ${remision.numeroRemision}...`, type: 'info' });

        try {
            const blob = await pdf(doc).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const safeClientName = relatedData.cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');

            link.href = url;
            link.download = `Remision-${remision.numeroRemision}-${safeClientName}.pdf`;
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
        // Esperar a que termine la descarga antes de abrir el modal
        setTimeout(() => {
            setIsEmailModalOpen(true);
        }, 100);
    };

    const handleConfirmSendEmail = async (emailData: { to: string; subject: string; body: string }) => {
        if (!remision) return;

        const subjectEncoded = encodeURIComponent(emailData.subject);
        const bodyEncoded = encodeURIComponent(emailData.body);
        const mailtoLink = `mailto:${emailData.to}?subject=${subjectEncoded}&body=${bodyEncoded}`;

        window.location.href = mailtoLink;

        addNotification({
            message: `PDF descargado. Se ha abierto tu cliente de correo para enviar la remisión ${remision.numeroRemision}.`,
            type: 'success',
        });
        setIsEmailModalOpen(false);
    };


    if (!remision || !relatedData || !relatedData.pedido || !relatedData.cliente) {
        return null;
    }

    return (
        <>
            <Modal isOpen={!!remision} onClose={onClose} title="" size="4xl" noPadding>
                <div className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between p-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 px-2 truncate">
                            Remisión: {remision.numeroRemision}
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
                        supportedOptions={{ prices: true, signatures: true, details: false }}
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
            {isEmailModalOpen && remision && relatedData?.cliente && (
                <SendEmailModal
                    isOpen={isEmailModalOpen}
                    onClose={() => setIsEmailModalOpen(false)}
                    onSend={handleConfirmSendEmail}
                    to={relatedData.cliente.email}
                    subject={`Remisión ${remision.numeroRemision} de ${datosEmpresa.nombre}`}
                    body={
                        `Estimado/a ${relatedData.cliente.nombreCompleto},

Le escribimos para informarle que su pedido está en camino. Adjuntamos la nota de remisión N° ${remision.numeroRemision} con los detalles de los productos despachados.
Puede utilizar este documento para verificar la mercancía al momento de la entrega.

Atentamente,
El equipo de ${datosEmpresa.nombre}`
                    }
                />
            )}
        </>
    );
};

export default RemisionPreviewModal;