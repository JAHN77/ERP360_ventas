import React from 'react';
import Modal from '../ui/Modal';

interface DIANSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    cufe: string;
    documentType: 'factura' | 'nota-credito';
    documentNumber?: string | number;
}

const DIANSuccessModal: React.FC<DIANSuccessModalProps> = ({
    isOpen,
    onClose,
    cufe,
    documentType,
    documentNumber
}) => {
    const documentTitle = documentType === 'factura' ? 'Factura' : 'Nota de Crédito';
    const icon = documentType === 'factura' ? 'fa-file-invoice' : 'fa-file-circle-minus';

    const copyToClipboard = () => {
        navigator.clipboard.writeText(cufe);
        // You could add a toast notification here
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`✅ ${documentTitle} Enviada Exitosamente`}
            size="lg"
        >
            <div className="space-y-6">
                {/* Success Icon */}
                <div className="flex justify-center">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <i className={`fas ${icon} text-4xl text-green-600 dark:text-green-400`}></i>
                    </div>
                </div>

                {/* Success Message */}
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        Proceso Completado
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400">
                        {documentTitle} {documentNumber ? `#${documentNumber}` : ''} ha sido enviada y aprobada por la DIAN exitosamente.
                    </p>
                </div>

                {/* CUFE Section */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <i className="fas fa-barcode text-slate-500"></i>
                                CUFE / UID
                            </label>
                            <button
                                onClick={copyToClipboard}
                                className="text-xs px-3 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-md transition-colors flex items-center gap-1"
                                title="Copiar CUFE"
                            >
                                <i className="fas fa-copy"></i>
                                Copiar
                            </button>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-md p-3 border border-slate-200 dark:border-slate-700">
                            <p className="font-mono text-xs break-all text-slate-700 dark:text-slate-300 select-all leading-relaxed">
                                {cufe}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Info Badge */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                        <i className="fas fa-info-circle text-blue-600 dark:text-blue-400 mt-0.5"></i>
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                            El CUFE es el identificador único de este documento electrónico ante la DIAN.
                            Guárdelo para futuras consultas.
                        </p>
                    </div>
                </div>

                {/* Action Button */}
                <div className="flex justify-center pt-2">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2"
                    >
                        <i className="fas fa-check"></i>
                        Aceptar
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default DIANSuccessModal;
