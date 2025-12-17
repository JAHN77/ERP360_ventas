import React from 'react';
import Modal from './Modal';

interface SummaryDetail {
    label: string;
    value: React.ReactNode;
    isSeparator?: boolean;
    isTotal?: boolean;
    isDiscount?: boolean;
}

interface Action {
    label: string;
    onClick: () => void;
    icon?: string;
}

interface ApprovalSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: React.ReactNode;
    summaryTitle: string;
    summaryDetails: SummaryDetail[];
    primaryAction: Action;
    secondaryActions?: Action[];
}

const ApprovalSuccessModal: React.FC<ApprovalSuccessModalProps> = ({
    isOpen,
    onClose,
    title,
    message,
    summaryTitle,
    summaryDetails,
    primaryAction,
    secondaryActions = []
}) => {

    const handlePrimaryAction = () => {
        primaryAction.onClick();
    }

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
            <div className="relative pt-6 pb-2">
                {/* Background decorative elements */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-green-50 to-transparent dark:from-green-900/20 dark:to-transparent -z-10 rounded-t-2xl opacity-50"></div>

                <div className="text-center px-4">
                    {/* Icon with scaling animation */}
                    <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/50 mb-6 shadow-lg shadow-green-200 dark:shadow-green-900/20 animate-in zoom-in duration-300">
                        <i className="fas fa-check fa-3x text-green-600 dark:text-green-400"></i>
                    </div>

                    <h3 className="text-2xl leading-8 font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                        {title}
                    </h3>

                    <div className="max-w-md mx-auto">
                        <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                            {message}
                        </p>
                    </div>
                </div>

                {/* Receipt-style Summary Card */}
                <div className="mt-8 mx-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10">
                    <div className="bg-slate-100/50 dark:bg-slate-700/50 px-5 py-3 border-b border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <i className="fas fa-list-alt opacity-70"></i>
                            {summaryTitle}
                        </h4>
                    </div>

                    <div className="p-5 space-y-3">
                        {summaryDetails.map((detail, index) => {
                            if (detail.isSeparator) {
                                return <div key={`sep-${index}`} className="border-t border-dashed border-slate-300 dark:border-slate-600 my-3"></div>;
                            }
                            return (
                                <div key={detail.label || index} className={`flex justify-between items-start text-sm group ${detail.isTotal ? 'pt-2 mt-2 border-t border-slate-200 dark:border-slate-700' : ''}`}>
                                    <span className={`text-slate-500 dark:text-slate-400 font-medium ${detail.isTotal ? 'text-base text-slate-800 dark:text-slate-100' : ''} ${detail.isDiscount ? 'text-red-500 dark:text-red-400' : ''}`}>
                                        {detail.label}:
                                    </span>
                                    <div className={`font-semibold text-slate-800 dark:text-slate-200 text-right ${detail.isTotal ? 'text-xl text-blue-600 dark:text-blue-400 font-bold' : ''} ${detail.isDiscount ? 'text-red-600 dark:text-red-400' : ''}`}>
                                        {detail.value}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-8 px-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-5">
                    {/* Mobile Close Button (Hidden on Desktop if actions exist) */}
                    <button
                        type="button"
                        className="sm:hidden w-full inline-flex justify-center rounded-xl border border-slate-300 dark:border-slate-600 shadow-sm px-4 py-3 bg-white dark:bg-slate-800 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        onClick={onClose}
                    >
                        Cerrar
                    </button>

                    {secondaryActions.map(action => (
                        <button
                            key={action.label}
                            type="button"
                            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 shadow-sm px-5 py-2.5 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all hover:-translate-y-0.5"
                            onClick={action.onClick}
                        >
                            {action.icon && <i className={`fas ${action.icon} mr-2 text-slate-400`}></i>}
                            {action.label}
                        </button>
                    ))}

                    <button
                        type="button"
                        className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-transparent shadow-lg shadow-blue-500/30 px-6 py-2.5 bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all hover:-translate-y-0.5"
                        onClick={handlePrimaryAction}
                    >
                        {primaryAction.icon && <i className={`fas ${primaryAction.icon} mr-2`}></i>}
                        {primaryAction.label}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export default ApprovalSuccessModal;