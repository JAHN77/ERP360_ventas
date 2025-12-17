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

interface CotizacionPreviewModalProps {
    cotizacion: Cotizacion | null;
    onClose: () => void;
}

const CotizacionPreviewModal: React.FC<CotizacionPreviewModalProps> = ({ cotizacion, onClose }) => {
    const { addNotification } = useNotifications();
    const { clientes, vendedores, datosEmpresa, productos } = useData();
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
                empresa={{
                    nombre: datosEmpresa.nombre,
                    nit: datosEmpresa.nit,
                    direccion: datosEmpresa.direccion,
                    telefono: datosEmpresa.telefono
                }}
                preferences={preferences}
                productos={productos}
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

    const handleSendEmail = async () => {
        await handleDownload();
        setTimeout(() => {
            setIsEmailModalOpen(true);
        }, 100);
    };

    const handleConfirmSendEmail = (emailData: { to: string }) => {
        if (!cotizacion) return;
        addNotification({
            message: `PDF descargado. Se ha abierto tu cliente de correo para enviar la cotización ${cotizacion.numeroCotizacion}.`,
            type: 'success',
        });
        setIsEmailModalOpen(false);
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

Adjuntamos la cotización N° ${cotizacion.numeroCotizacion} solicitada.

Quedamos a su disposición.
Atentamente,
El equipo de ${datosEmpresa.nombre}`}
                />
            )}
        </>
    );
};

export default CotizacionPreviewModal;
