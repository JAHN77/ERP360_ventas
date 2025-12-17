import { useState, useEffect } from 'react';
import { apiGetClientesConFacturasAceptadas, ApiResponse } from '../services/apiClient';

export interface FacturaAceptada {
    id: string;
    numeroFactura: string;
    fechaFactura: string;
    total: number;
    codalm: string;
    cufe: string;
}

export interface ClienteConFacturas {
    id: string;
    numeroDocumento: string;
    nombreCompleto: string;
    telefono?: string;
    email?: string;
    facturasAceptadas: FacturaAceptada[];
}

export const useClientesConFacturasAceptadas = () => {
    const [data, setData] = useState<ClienteConFacturas[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response: ApiResponse<ClienteConFacturas[]> = await apiGetClientesConFacturasAceptadas();
            if (response.success && response.data) {
                setData(response.data);
            } else {
                setError(response.message || 'Error al cargar clientes');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return {
        clientes: data,
        isLoading,
        error,
        refresh: fetchData
    };
};
