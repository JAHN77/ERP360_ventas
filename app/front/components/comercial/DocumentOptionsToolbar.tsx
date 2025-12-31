import React, { useState, useRef, useEffect } from 'react';
import { DocumentPreferences } from '../../types';
import { useData } from '../../hooks/useData';

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

const DocumentOptionsToolbar: React.FC<DocumentOptionsToolbarProps> = ({
  preferences,
  onPreferenceChange,
  onReset,
  supportedOptions,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { firmaVendedor, setFirmaVendedor } = useData();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;

        // --- Procesamiento de imagen para quitar fondo blanco ---
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Convertir píxeles "blancos" a transparentes
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              // Si el pixel es muy claro (cerca de blanco)
              if (r > 200 && g > 200 && b > 200) {
                data[i + 3] = 0; // Alpha = 0 (transparente)
              }
            }
            ctx.putImageData(imageData, 0, 0);
            setFirmaVendedor(canvas.toDataURL('image/png'));
          }
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  const getActiveOptionsText = () => {
    const options: string[] = [];

    if (supportedOptions.prices) {
      options.push(preferences.showPrices ? 'Con Precios' : 'Sin Precios');
    }

    if (supportedOptions.signatures) {
      const sigMap = {
        physical: 'Firma Física',
        digital: 'Firma Digital',
        none: 'Sin Firma'
      };
      options.push(sigMap[preferences.signatureType]);
    }

    if (supportedOptions.details) {
      options.push(preferences.detailLevel === 'full' ? 'Completo' : 'Resumido');
    }

    return options.join(' • ');
  };

  return (
    <div className="relative p-1.5 bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700" ref={dropdownRef}>
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-300 dark:border-slate-600"
        >
          <i className="fas fa-sliders-h text-[10px]"></i>
          <span className="hidden sm:inline text-[11px]">Opciones:</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400 text-[11px]">{getActiveOptionsText()}</span>
          <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} ml-0.5 text-[9px]`}></i>
        </button>

        <button
          onClick={onReset}
          title="Restablecer a la configuración por defecto"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-colors text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          <i className="fas fa-undo text-[10px]"></i>
          <span className="hidden sm:inline">Restablecer</span>
        </button>
      </div>

      {/* Dropdown Menu - Compact Version */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 mx-2 bg-white dark:bg-slate-800 rounded-md shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
          <div className="p-2.5 space-y-2.5">
            {supportedOptions.prices && (
              <div>
                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Precios
                </label>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      onPreferenceChange({ showPrices: true });
                      setIsOpen(false);
                    }}
                    className={`flex-1 px-2 py-1 text-[11px] font-medium rounded transition-all ${preferences.showPrices
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                  >
                    <i className="fas fa-dollar-sign mr-1 text-[9px]"></i>Con Precios
                  </button>
                  <button
                    onClick={() => {
                      onPreferenceChange({ showPrices: false });
                      setIsOpen(false);
                    }}
                    className={`flex-1 px-2 py-1 text-[11px] font-medium rounded transition-all ${!preferences.showPrices
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                  >
                    <i className="fas fa-receipt mr-1 text-[9px]"></i>Sin Precios
                  </button>
                </div>
              </div>
            )}

            {supportedOptions.signatures && (
              <div>
                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Firmas
                </label>
                <div className="flex gap-1.5 mb-2">
                  <button
                    onClick={() => onPreferenceChange({ signatureType: 'physical' })}
                    className={`flex-1 px-1 py-1 text-[10px] font-medium rounded transition-all ${preferences.signatureType === 'physical'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                  >
                    <i className="fas fa-signature mr-1 text-[9px]"></i>Física
                  </button>
                  <button
                    onClick={() => onPreferenceChange({ signatureType: 'digital' })}
                    className={`flex-1 px-1 py-1 text-[10px] font-medium rounded transition-all ${preferences.signatureType === 'digital'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                  >
                    <i className="fas fa-qrcode mr-1 text-[9px]"></i>Digital
                  </button>
                  <button
                    onClick={() => onPreferenceChange({ signatureType: 'none' })}
                    className={`flex-1 px-1 py-1 text-[10px] font-medium rounded transition-all ${preferences.signatureType === 'none'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                  >
                    <i className="fas fa-ban mr-1 text-[9px]"></i>Sin
                  </button>
                </div>

                {/* Seller Signature Upload */}
                <div className="bg-slate-50 dark:bg-slate-900/40 p-1.5 rounded border border-dashed border-slate-300 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-medium">Firma Vendedor:</span>
                    <div className="flex gap-1">
                      {firmaVendedor && (
                        <button
                          onClick={() => setFirmaVendedor(null)}
                          className="h-5 w-5 rounded bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 transition-colors"
                          title="Eliminar firma"
                        >
                          <i className="fas fa-trash-alt text-[9px]"></i>
                        </button>
                      )}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className={`h-5 px-1.5 rounded flex items-center gap-1 transition-colors ${firmaVendedor
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 text-[9px]'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200 text-[9px]'
                          }`}
                      >
                        <i className={`fas ${firmaVendedor ? 'fa-sync-alt' : 'fa-upload'}`}></i>
                        {firmaVendedor ? 'Cambiar' : 'Subir'}
                      </button>
                    </div>
                  </div>
                  {firmaVendedor && (
                    <div className="mt-1 flex justify-center bg-white dark:bg-white/10 rounded p-1 border border-slate-200 dark:border-slate-600 h-10 overflow-hidden">
                      <img src={firmaVendedor} alt="Vista previa firma" className="h-full object-contain" />
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>
            )}

            {supportedOptions.details && (
              <div>
                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Nivel de Detalle
                </label>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      onPreferenceChange({ detailLevel: 'full' });
                      setIsOpen(false);
                    }}
                    className={`flex-1 px-2 py-1 text-[11px] font-medium rounded transition-all ${preferences.detailLevel === 'full'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                  >
                    <i className="fas fa-file-alt mr-1 text-[9px]"></i>Completo
                  </button>
                  <button
                    onClick={() => {
                      onPreferenceChange({ detailLevel: 'summary' });
                      setIsOpen(false);
                    }}
                    className={`flex-1 px-2 py-1 text-[11px] font-medium rounded transition-all ${preferences.detailLevel === 'summary'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                  >
                    <i className="fas fa-file mr-1 text-[9px]"></i>Resumido
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentOptionsToolbar;