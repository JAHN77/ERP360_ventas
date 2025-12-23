import React from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import Modal from '../ui/Modal';
import OrdenCompraPDFDocument from './OrdenCompraPDFDocument';
import { useData } from '../../hooks/useData';

interface OrdenCompraPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    orden: any;
}

const OrdenCompraPreviewModal: React.FC<OrdenCompraPreviewModalProps> = ({ isOpen, onClose, orden }) => {
    const { datosEmpresa } = useData();

    if (!isOpen || !orden) return null;

    // Robust order number resolution
    // Check multiple possible paths due to backend/frontend mapping variations
    const orderNumber =
        orden.numcom ||
        orden.numeroOrden ||
        orden.header?.numcom ||
        orden.header?.numeroOrden ||
        orden.id ||
        'N/A';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Orden de Compra #${orderNumber}`}
            size="4xl"
            noPadding={true}
        >
            {/* Contenedor principal con altura maximizada (88vh) */}
            <div className="flex flex-col h-[88vh] w-full bg-slate-100 dark:bg-slate-900">

                {/* Área del PDF: Overflow auto y altura explícita con calc() */}
                <div className="relative w-full overflow-auto bg-slate-200 dark:bg-slate-950">
                    <PDFViewer
                        width="100%"
                        style={{ height: 'calc(88vh - 64px)' }}
                        className="w-full border-none block"
                        showToolbar={true}
                    >
                        <OrdenCompraPDFDocument data={orden} empresa={datosEmpresa} />
                    </PDFViewer>
                </div>

                {/* Footer fijo: Altura fija (64px = h-16) */}
                <div className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 h-16 shrink-0 z-10">
                    <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                        Vista previa del documento PDF
                    </span>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-slate-700 bg-white border border-slate-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg text-sm font-semibold shadow-sm transition-all"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default OrdenCompraPreviewModal;
