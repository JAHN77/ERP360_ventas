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
            <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
                    <i className="fas fa-check fa-2x text-green-600 dark:text-green-400"></i>
                </div>
                <h3 className="text-lg leading-6 font-bold text-slate-900 dark:text-white mt-4">{title}</h3>
                <div className="mt-2 px-2 py-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
                </div>
            </div>

            <div className="mt-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
                <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3">{summaryTitle}</h4>
                <div className="space-y-2">
                    {summaryDetails.map((detail, index) => {
                        if (detail.isSeparator) {
                            return <div key={`sep-${index}`} className="border-t border-slate-200 dark:border-slate-600 my-2"></div>;
                        }
                        return (
                             <div key={detail.label} className={`flex justify-between items-center text-sm ${detail.isTotal ? 'font-bold text-lg border-t border-slate-200 dark:border-slate-600 pt-2 mt-2' : ''}`}>
                                <p className={`text-slate-600 dark:text-slate-400 ${detail.isDiscount ? 'text-red-600 dark:text-red-500' : ''}`}>{detail.label}:</p>
                                <div className={`font-semibold text-slate-800 dark:text-slate-200 text-right ${detail.isTotal ? 'text-blue-600 dark:text-blue-400' : ''} ${detail.isDiscount ? 'text-red-600 dark:text-red-500' : ''}`}>
                                    {detail.value}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-3">
                 <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm order-1"
                    onClick={handlePrimaryAction}
                >
                    {primaryAction.icon && <i className={`fas ${primaryAction.icon} -ml-1 mr-2 h-5 w-5`}></i>}
                    {primaryAction.label}
                </button>
                 {secondaryActions.map(action => (
                    <button
                        key={action.label}
                        type="button"
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-800 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                        onClick={action.onClick}
                    >
                         {action.icon && <i className={`fas ${action.icon} -ml-1 mr-2 h-5 w-5 text-slate-400`}></i>}
                        {action.label}
                    </button>
                ))}
                 <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-800 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm sm:hidden"
                    onClick={onClose}
                >
                    Cerrar
                </button>
            </div>
        </Modal>
    );
}

export default ApprovalSuccessModal;