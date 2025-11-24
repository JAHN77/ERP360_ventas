import React, { useMemo, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import { Pedido } from '../../types';
import { PedidoPDF } from './PedidoPDF';
import { useNotifications } from '../../hooks/useNotifications';
import { useDocumentPreferences } from '../../hooks/useDocumentPreferences';
import DocumentOptionsToolbar from './DocumentOptionsToolbar';
import SendEmailModal from './SendEmailModal';
import { useData } from '../../hooks/useData';
import { findClienteByIdentifier } from '../../utils/clientes';
import { descargarElementoComoPDF } from '../../utils/pdfClient';

interface PedidoPreviewModalProps {
    pedido: Pedido | null;
    onClose: () => void;
}


const PedidoPreviewModal: React.FC<PedidoPreviewModalProps> = ({ pedido, onClose }) => {
    const { addNotification } = useNotifications();
    const { clientes, datosEmpresa } = useData();
    const componentRef = useRef<HTMLDivElement>(null);
    const { preferences, updatePreferences, resetPreferences } = useDocumentPreferences('pedido');
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    
    const cliente = useMemo(() => {
        if (!pedido) return null;
        return findClienteByIdentifier(
            clientes,
            pedido.clienteId ?? (pedido as any).cliente_id ?? (pedido as any).nitCliente
        ) || null;
    }, [pedido, clientes]);

    const handlePrint = async () => {
        if (!pedido || !cliente || !componentRef.current || isPrinting) return;
    
        setIsPrinting(true);
        addNotification({ message: `Preparando impresión para ${pedido.numeroPedido}...`, type: 'info' });
    
        try {
            const safeClientName = cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');
            await descargarElementoComoPDF(componentRef.current, {
                fileName: `Pedido-${pedido.numeroPedido}-${safeClientName}.pdf`,
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
        if (!pedido || !cliente || !componentRef.current || isDownloading) return;
        
        setIsDownloading(true);
        addNotification({ message: `Generando PDF para ${pedido.numeroPedido}...`, type: 'info' });

        try {
            const safeClientName = cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');
            await descargarElementoComoPDF(componentRef.current, {
                fileName: `Pedido-${pedido.numeroPedido}-${safeClientName}.pdf`,
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
        await handleDownload();
        // Esperar a que termine la descarga antes de abrir el modal
        setTimeout(() => {
            setIsEmailModalOpen(true);
        }, 100);
    };

    const handleConfirmSendEmail = (emailData: { to: string }) => {
        if (!pedido) return;
        addNotification({
            message: `PDF descargado. Se ha abierto tu cliente de correo para enviar el pedido ${pedido.numeroPedido}.`,
            type: 'success',
        });
        setIsEmailModalOpen(false);
    };


    if (!pedido || !cliente) {
        return null;
    }
    
    const childWithProps = <PedidoPDF 
        ref={componentRef}
        pedido={pedido}
        cliente={cliente}
        empresa={datosEmpresa}
        preferences={preferences}
    />;

    return (
        <>
            <Modal isOpen={!!pedido} onClose={onClose} title="" size="3xl" noPadding>
                <div className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between p-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 px-2 truncate">
                            Pedido: {pedido.numeroPedido}
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
                        supportedOptions={{ prices: true, signatures: true, details: true }}
                    />
                </div>

                <div className="bg-slate-200 dark:bg-slate-900 p-4 sm:p-8">
                    <div className="bg-white shadow-lg rounded-md overflow-hidden max-w-4xl mx-auto">
                        {childWithProps}
                    </div>
                </div>
            </Modal>
            {isEmailModalOpen && pedido && cliente && (
                <SendEmailModal
                    isOpen={isEmailModalOpen}
                    onClose={() => setIsEmailModalOpen(false)}
                    onSend={handleConfirmSendEmail}
                    to={cliente.email || ''}
                    subject={`Pedido ${pedido.numeroPedido} de ${datosEmpresa.nombre}`}
                    body={`Estimado/a ${cliente.nombreCompleto},

Adjuntamos la orden de compra N° ${pedido.numeroPedido} para su registro.

Gracias por su compra.
Atentamente,
El equipo de ${datosEmpresa.nombre}`}
                />
            )}
        </>
    );
};

export default PedidoPreviewModal;
