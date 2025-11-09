import { Cliente } from '../types';

const normalize = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = String(value).trim();
    if (!str) return '';
    const lowered = str.toLowerCase();
    const condensed = lowered.replace(/[\s\-_]/g, '');
    return condensed || lowered;
};

const buildCandidateSet = (cliente: Cliente): Set<string> => {
    const variants = [
        cliente.id,
        cliente.numeroDocumento,
        (cliente as any).codter,
        (cliente as any).clienteId,
        (cliente as any).cliente_id,
        (cliente as any).numero_documento,
        (cliente as any).nit,
    ];

    const normalized = new Set<string>();
    for (const value of variants) {
        const normalizedValue = normalize(value);
        if (normalizedValue) {
            normalized.add(normalizedValue);
        }
    }

    return normalized;
};

export const findClienteByIdentifier = (clientes: Cliente[], rawId: unknown): Cliente | undefined => {
    const target = normalize(rawId);
    if (!target) return undefined;

    for (const cliente of clientes) {
        const candidateSet = buildCandidateSet(cliente);
        if (candidateSet.has(target)) {
            return cliente;
        }
    }

    return undefined;
};

export const getClienteNombreSeguro = (cliente?: Cliente): string => {
    if (!cliente) return 'N/A';
    return cliente.nombreCompleto || cliente.razonSocial || (cliente as any).nomter || 'N/A';
};

