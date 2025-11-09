import { ActivityLog } from '../types';

export const initialActivityLog: ActivityLog[] = [
    {
        id: 'log-1',
        timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        // FIX: Changed user ID to a number to match the ActivityLog type.
        user: { id: 2, nombre: 'Carlos Ruiz', rol: 'vendedor' },
        action: 'Creación de Cotización',
        details: 'Se creó una nueva cotización por un total de $10,710,000.',
        entity: { type: 'Cotización', id: 'cot1', name: 'COT-2023-001' }
    },
    {
        id: 'log-2',
        timestamp: Date.now() - 2 * 60 * 1000, // 2 minutes ago
        // FIX: Changed user ID to a number to match the ActivityLog type.
        user: { id: 1, nombre: 'Ana Gómez', rol: 'admin' },
        action: 'Aprobación de Cotización',
        details: 'La cotización fue aprobada por el cliente (simulado). Se generó el pedido PED-2023-001.',
        entity: { type: 'Cotización', id: 'cot1', name: 'COT-2023-001' }
    }
];

// The addActivityLog function is now handled by DataContext