

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) ||
  'http://localhost:3001/api';

interface GeminiResponse {
  success: boolean;
  message?: string;
  data?: { text?: string };
}

const callGeminiProxy = async (type: string, payload: Record<string, any>): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type, payload })
    });

    const data: GeminiResponse = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || `Error HTTP ${response.status}`);
    }

    const text = data.data?.text ?? '';
    if (!text || !text.trim()) {
      throw new Error('Respuesta vacía del servicio de IA');
    }

    return text;
  } catch (error) {
    console.error('[Gemini Proxy] Error:', error);
    throw error instanceof Error
      ? error
      : new Error('Error desconocido al comunicarse con el servicio de IA');
  }
};

export const generateAccountingNote = async (
  totalDevolucion: string,
  subtotal: string,
  iva: string,
  costo: string,
  motivos: string
): Promise<string> => {
  try {
    return await callGeminiProxy('accountingNote', {
      totalDevolucion,
      subtotal,
      iva,
      costo,
      motivos
    });
  } catch (error) {
    console.error("Error llamando al proxy de Gemini para la nota contable:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Error al generar la nota explicativa con el servicio de IA."
    );
  }
};


export const generateEmailForReturn = async (
  clienteNombre: string,
  facturaId: string,
  notaCreditoId: string,
  valorTotal: string
): Promise<string> => {
  try {
    return await callGeminiProxy('returnEmail', {
      clienteNombre,
      facturaId,
      notaCreditoId,
      valorTotal
    });
  } catch (error) {
    console.error("Error llamando al proxy de Gemini para el correo:", error);
    throw new Error(
      error instanceof Error ? error.message : "Error desconocido al generar el correo."
    );
  }
};