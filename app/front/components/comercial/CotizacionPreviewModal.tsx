import React, { useMemo, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import { Cotizacion } from '../../types';
import CotizacionPDF from './CotizacionPDF';
import { useNotifications } from '../../hooks/useNotifications';
import { useDocumentPreferences } from '../../hooks/useDocumentPreferences';
import DocumentOptionsToolbar from './DocumentOptionsToolbar';
import SendEmailModal from './SendEmailModal';
import { useData } from '../../hooks/useData';
import { findClienteByIdentifier } from '../../utils/clientes';
import { descargarElementoComoPDF } from '../../utils/pdfClient';

interface CotizacionPreviewModalProps {
    cotizacion: Cotizacion | null;
    onClose: () => void;
}

const CotizacionPreviewModal: React.FC<CotizacionPreviewModalProps> = ({ cotizacion, onClose }) => {
    const { addNotification } = useNotifications();
    const { clientes, vendedores, datosEmpresa } = useData();
    const componentRef = useRef<HTMLDivElement>(null);
    const { preferences, updatePreferences, resetPreferences } = useDocumentPreferences('cotizacion');
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    
    const cliente = useMemo(() => {
        if (!cotizacion) return null;
        return findClienteByIdentifier(
            clientes,
            cotizacion.clienteId ?? (cotizacion as any).cliente_id ?? (cotizacion as any).nitCliente
        ) || null;
    }, [cotizacion, clientes]);
    const vendedor = cotizacion ? vendedores.find(v => v.id === cotizacion.vendedorId) : null;


    const handleDownload = async () => {
        if (!cotizacion || !cliente || !vendedor || !componentRef.current) return;

        addNotification({ message: `Generando PDF para ${cotizacion.numeroCotizacion}...`, type: 'info' });

        try {
            const safeClientName = cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');
            await descargarElementoComoPDF(componentRef.current, {
                fileName: `Cotizacion-${cotizacion.numeroCotizacion}-${safeClientName}.pdf`,
            });
            addNotification({ message: 'PDF generado correctamente.', type: 'success' });
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
        if (!cotizacion) return;
        addNotification({
            message: `PDF descargado. Se ha abierto tu cliente de correo para enviar la cotización ${cotizacion.numeroCotizacion}.`,
            type: 'success',
        });
        setIsEmailModalOpen(false);
    };


    if (!cotizacion || !cliente || !vendedor) {
        return null;
    }
    
    const childWithProps = <CotizacionPDF 
        ref={componentRef}
        cotizacion={cotizacion}
        cliente={cliente}
        vendedor={vendedor}
        empresa={datosEmpresa}
        preferences={preferences}
    />;

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
                    <DocumentOptionsToolbar
                        preferences={preferences}
                        onPreferenceChange={updatePreferences}
                        onReset={resetPreferences}
                        supportedOptions={{ prices: true, signatures: true, details: true }}
                    />
                </div>

                <div className="bg-slate-200 dark:bg-slate-900 p-4 sm:p-8">
                    <div className="bg-white shadow-lg rounded-md overflow-hidden max-w-4xl mx-auto">
                        {childWithProps}
                    </div>
                </div>
            </Modal>
            {isEmailModalOpen && cotizacion && cliente && (
                <SendEmailModal
                    isOpen={isEmailModalOpen}
                    onClose={() => setIsEmailModalOpen(false)}
                    onSend={handleConfirmSendEmail}
                    to={cliente.email || ''}
                    subject={`Cotización ${cotizacion.numeroCotizacion} de ${datosEmpresa.nombre}`}
                    body={`Estimado/a ${cliente.nombreCompleto},

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
