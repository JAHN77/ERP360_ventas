import React from 'react';
import { DocumentPreferences } from '../../types';

interface DocumentOptionsToolbarProps {
  preferences: DocumentPreferences;
  onPreferenceChange: (newPrefs: Partial<DocumentPreferences>) => void;
  onReset: () => void;
  supportedOptions: {
    prices?: boolean;
    signatures?: boolean;
    details?: boolean;
  };
}

const OptionButton: React.FC<{
  label: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
  tooltip: string;
}> = ({ label, icon, isActive, onClick, tooltip }) => (
  <button
    onClick={onClick}
    title={tooltip}
    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
      isActive
        ? 'bg-blue-600 text-white shadow'
        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
    }`}
  >
    <i className={`fas ${icon} w-4 text-center`}></i>
    <span>{label}</span>
  </button>
);

const DocumentOptionsToolbar: React.FC<DocumentOptionsToolbarProps> = ({
  preferences,
  onPreferenceChange,
  onReset,
  supportedOptions,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-2 bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
      {supportedOptions.prices && (
        <div key="prices-options" className="flex items-center gap-1 p-1 bg-slate-200 dark:bg-slate-700 rounded-lg">
          <OptionButton
            label="Con Precios"
            icon="fa-dollar-sign"
            isActive={preferences.showPrices}
            onClick={() => onPreferenceChange({ showPrices: true })}
            tooltip="Mostrar precios y totales"
          />
          <OptionButton
            label="Sin Precios"
            icon="fa-receipt"
            isActive={!preferences.showPrices}
            onClick={() => onPreferenceChange({ showPrices: false })}
            tooltip="Ocultar precios (para logística)"
          />
        </div>
      )}

      {supportedOptions.signatures && (
        <div key="signatures-options" className="flex items-center gap-1 p-1 bg-slate-200 dark:bg-slate-700 rounded-lg">
          <OptionButton
            label="Firma Física"
            icon="fa-signature"
            isActive={preferences.signatureType === 'physical'}
            onClick={() => onPreferenceChange({ signatureType: 'physical' })}
            tooltip="Incluir espacio para firma física"
          />
          <OptionButton
            label="Firma Digital"
            icon="fa-qrcode"
            isActive={preferences.signatureType === 'digital'}
            onClick={() => onPreferenceChange({ signatureType: 'digital' })}
            tooltip="Incluir QR y validación digital"
          />
          <OptionButton
            label="Sin Firma"
            icon="fa-ban"
            isActive={preferences.signatureType === 'none'}
            onClick={() => onPreferenceChange({ signatureType: 'none' })}
            tooltip="Ocultar sección de firmas"
          />
        </div>
      )}

      {supportedOptions.details && (
        <div key="details-options" className="flex items-center gap-1 p-1 bg-slate-200 dark:bg-slate-700 rounded-lg">
          <OptionButton
            label="Completo"
            icon="fa-file-alt"
            isActive={preferences.detailLevel === 'full'}
            onClick={() => onPreferenceChange({ detailLevel: 'full' })}
            tooltip="Mostrar todos los detalles"
          />
          <OptionButton
            label="Resumido"
            icon="fa-file"
            isActive={preferences.detailLevel === 'summary'}
            onClick={() => onPreferenceChange({ detailLevel: 'summary' })}
            tooltip="Mostrar solo información esencial"
          />
        </div>
      )}

      <button
        onClick={onReset}
        title="Restablecer a la configuración por defecto"
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
      >
        <i className="fas fa-undo w-4 text-center"></i>
        <span>Restablecer</span>
      </button>
    </div>
  );
};

export default DocumentOptionsToolbar;