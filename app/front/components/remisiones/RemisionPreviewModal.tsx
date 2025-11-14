import React, { useRef, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { Remision } from '../../types';
import RemisionPDF from './RemisionPDF';
import { useNotifications } from '../../hooks/useNotifications';
import { useDocumentPreferences } from '../../hooks/useDocumentPreferences';
import DocumentOptionsToolbar from '../comercial/DocumentOptionsToolbar';
import SendEmailModal from '../comercial/SendEmailModal';
import { useData } from '../../hooks/useData';
import { findClienteByIdentifier } from '../../utils/clientes';
import { descargarElementoComoPDF } from '../../utils/pdfClient';

interface RemisionPreviewModalProps {
    remision: Remision | null;
    onClose: () => void;
}

const RemisionPreviewModal: React.FC<RemisionPreviewModalProps> = ({ remision, onClose }) => {
    const { addNotification } = useNotifications();
    const { pedidos, clientes, datosEmpresa } = useData();
    const componentRef = useRef<HTMLDivElement>(null);
    const { preferences, updatePreferences, resetPreferences } = useDocumentPreferences('remision');
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    
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

    const handlePrint = async () => {
        if (!remision || !relatedData?.cliente || !componentRef.current) return;
    
        addNotification({ message: `Preparando impresión para ${remision.numeroRemision}...`, type: 'info' });
    
        try {
            const cliente = relatedData.cliente;
            const safeClientName = cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `Remision-${remision.numeroRemision}-${safeClientName}-${remision.fechaRemision}.pdf`;
            
            // Usar la API para generar el PDF
            await descargarElementoComoPDF(componentRef.current, {
                fileName: fileName
            });
            
            addNotification({ 
                message: 'PDF generado. Puedes abrirlo e imprimirlo desde tu dispositivo.', 
                type: 'success' 
            });
        } catch (error) {
            console.error('Error al generar el PDF para impresión:', error);
            addNotification({ message: 'No se pudo generar el documento para imprimir.', type: 'warning' });
        }
    };

    const handleDownload = async () => {
        if (!remision || !relatedData?.cliente || !componentRef.current) return;
        
        const cliente = relatedData.cliente;

        addNotification({ message: `Generando PDF para ${remision.numeroRemision}...`, type: 'info' });

        try {
            const safeClientName = cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');
            await descargarElementoComoPDF(componentRef.current, {
                fileName: `Remision-${remision.numeroRemision}-${safeClientName}-${remision.fechaRemision}.pdf`
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
        if (!remision) return;
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
                        supportedOptions={{ prices: true, signatures: true, details: false }}
                    />
                </div>

                <div className="bg-slate-200 dark:bg-slate-900 p-4 sm:p-8">
                    <div className="bg-white shadow-lg rounded-md overflow-hidden max-w-4xl mx-auto">
                        {/* Envolver el componente en un div con el ref para capturar el contenido completo */}
                        <div ref={componentRef}>
                            <RemisionPDF 
                                remision={remision}
                                pedido={relatedData.pedido}
                                cliente={relatedData.cliente}
                                empresa={datosEmpresa}
                                preferences={preferences}
                            />
                        </div>
                    </div>
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