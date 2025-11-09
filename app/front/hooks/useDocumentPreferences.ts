import { useState, useCallback, useMemo } from 'react';
import { DocumentPreferences } from '../types';

export type DocumentType = 'cotizacion' | 'pedido' | 'remision' | 'factura';

// FIX: Exported defaultPreferences to be used as default props in PDF components.
export const defaultPreferences: Record<DocumentType, DocumentPreferences> = {
  cotizacion: {
    showPrices: true,
    signatureType: 'physical',
    detailLevel: 'full',
  },
  pedido: {
    showPrices: true,
    signatureType: 'physical',
    detailLevel: 'full',
  },
  remision: {
    showPrices: false,
    signatureType: 'physical',
    detailLevel: 'summary',
  },
  factura: {
    showPrices: true,
    signatureType: 'digital',
    detailLevel: 'full',
  },
};

export const useDocumentPreferences = (documentType: DocumentType) => {
  const storageKey = useMemo(() => `erp360-prefs-${documentType}`, [documentType]);

  const getInitialState = useCallback((): DocumentPreferences => {
    try {
      const item = window.localStorage.getItem(storageKey);
      return item ? { ...defaultPreferences[documentType], ...JSON.parse(item) } : defaultPreferences[documentType];
    } catch (error) {
      console.warn(`Error reading localStorage key “${storageKey}”:`, error);
      return defaultPreferences[documentType];
    }
  }, [storageKey, documentType]);

  const [preferences, setPreferences] = useState<DocumentPreferences>(getInitialState);

  const updatePreferences = useCallback((newPrefs: Partial<DocumentPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...newPrefs };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (error) {
        console.warn(`Error setting localStorage key “${storageKey}”:`, error);
      }
      return updated;
    });
  }, [storageKey]);

  const resetPreferences = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn(`Error removing localStorage key “${storageKey}”:`, error);
    }
    setPreferences(defaultPreferences[documentType]);
  }, [storageKey, documentType]);

  return { preferences, updatePreferences, resetPreferences };
};