import { useState, useMemo, useCallback, useEffect } from 'react';
import { Column } from '../components/ui/Table';

// Type for the state managed by the hook
export interface ManagedColumn<T> extends Column<T> {
  isVisible: boolean;
}

// Type for the data stored in localStorage
interface SavedColumnState {
  accessor: string;
  isVisible: boolean;
}

export const useColumnManager = <T extends { id: string | number }>(
  tableId: string,
  defaultColumns: Column<T>[]
) => {
  const storageKey = `table_columns_${tableId}`;

  const getInitialState = useCallback((): ManagedColumn<T>[] => {
    try {
      const savedStateJSON = window.localStorage.getItem(storageKey);
      if (savedStateJSON) {
        const savedColumns: SavedColumnState[] = JSON.parse(savedStateJSON);

        // Reconstruct columns based on saved order and visibility, including new columns
        const reconstructedColumns: ManagedColumn<T>[] = [];
        const addedAccessors = new Set<string>();

        savedColumns.forEach(savedCol => {
          const defaultCol = defaultColumns.find(dc => dc.accessor as string === savedCol.accessor);
          if (defaultCol) {
            reconstructedColumns.push({ ...defaultCol, isVisible: savedCol.isVisible });
            addedAccessors.add(defaultCol.accessor as string);
          }
        });

        // Add any new columns from defaultColumns that weren't in the saved state
        defaultColumns.forEach(defaultCol => {
          if (!addedAccessors.has(defaultCol.accessor as string)) {
            reconstructedColumns.push({ ...defaultCol, isVisible: true });
          }
        });

        return reconstructedColumns;
      }
    } catch (error) {
      console.warn(`Error reading column preferences for ${tableId}:`, error);
    }
    // Default state if nothing is saved
    return defaultColumns.map(col => ({ ...col, isVisible: true }));
  }, [tableId, defaultColumns]);

  const [managedColumns, setManagedColumns] = useState<ManagedColumn<T>[]>(getInitialState);

  // Sync with defaultColumns when they change (important for dynamic cell renderers)
  useEffect(() => {
    setManagedColumns(prev => {
      return prev.map(managedCol => {
        const updatedCol = defaultColumns.find(dc => dc.accessor === managedCol.accessor);
        if (updatedCol) {
          return { ...managedCol, ...updatedCol };
        }
        return managedCol;
      });
    });
  }, [defaultColumns]);

  const saveColumns = (columnsToSave: ManagedColumn<T>[]) => {
    try {
      const stateToSave: SavedColumnState[] = columnsToSave.map(c => ({
        accessor: c.accessor as string,
        isVisible: c.isVisible,
      }));
      window.localStorage.setItem(storageKey, JSON.stringify(stateToSave));
      setManagedColumns(columnsToSave);
    } catch (error) {
      console.warn(`Error saving column preferences for ${tableId}:`, error);
    }
  };

  const resetColumns = () => {
    try {
      window.localStorage.removeItem(storageKey);
      setManagedColumns(defaultColumns.map(col => ({ ...col, isVisible: true })));
    } catch (error) {
      console.warn(`Error resetting column preferences for ${tableId}:`, error);
    }
  };

  const visibleColumns = useMemo(() => {
    return managedColumns.filter(col => col.isVisible);
  }, [managedColumns]);

  return {
    visibleColumns,
    allManagedColumns: managedColumns,
    setManagedColumns: saveColumns,
    resetManagedColumns: resetColumns,
  };
};