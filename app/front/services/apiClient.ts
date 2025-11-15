// Cliente API para conectar con el backend SQL Server
const API_BASE_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      if (typeof window !== 'undefined') {
        // Diagnóstico en desarrollo
        // eslint-disable-next-line no-console
        console.debug('[api] request:', url, options.method || 'GET');
      }
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        // Intentar obtener el mensaje de error del backend
        let errorMessage = `HTTP error! status: ${response.status}`;
        let errorDetails = null;
        let errorResponse = null;
        try {
          errorResponse = await response.json();
          errorMessage = errorResponse.message || errorResponse.error || errorMessage;
          errorDetails = errorResponse.details || null;
          // Si hay detalles adicionales, agregarlos al mensaje
          if (errorDetails && errorDetails.message) {
            errorMessage = errorDetails.message;
          }
        } catch (e) {
          // Si no hay JSON en la respuesta, usar el mensaje por defecto
        }
        
        // Si el error viene del backend con estructura {success: false, ...}, retornarlo directamente
        // Esto permite que el frontend maneje el error sin lanzar excepción
        if (errorResponse && errorResponse.success === false) {
          return errorResponse;
        }
        
        // Para otros errores HTTP, retornar estructura consistente en lugar de lanzar excepción
        return {
          success: false,
          error: errorMessage,
          message: errorMessage,
          details: errorDetails,
          status: response.status
        };
      }

      const data = await response.json();
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.log('🔵 [API Response] URL:', url);
        // eslint-disable-next-line no-console
        console.log('🔵 [API Response] Status:', response.status);
        // eslint-disable-next-line no-console
        console.log('🔵 [API Response] Data recibida:', data);
        // eslint-disable-next-line no-console
        console.log('🔵 [API Response] Tipo de data:', typeof data);
        // eslint-disable-next-line no-console
        console.log('🔵 [API Response] Es Array?:', Array.isArray(data));
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          // eslint-disable-next-line no-console
          console.log('🔵 [API Response] Keys del objeto:', Object.keys(data));
          if (data.data) {
            // eslint-disable-next-line no-console
            console.log('🔵 [API Response] data.data tipo:', typeof data.data);
            // eslint-disable-next-line no-console
            console.log('🔵 [API Response] data.data es Array?:', Array.isArray(data.data));
            if (Array.isArray(data.data) && data.data.length > 0) {
              // eslint-disable-next-line no-console
              console.log('🔵 [API Response] Primer elemento:', data.data[0]);
              // eslint-disable-next-line no-console
              console.log('🔵 [API Response] Keys del primer elemento:', Object.keys(data.data[0]));
              // eslint-disable-next-line no-console
              console.log('🔵 [API Response] Total de elementos:', data.data.length);
            }
          }
        }
      }
      return data;
    } catch (error) {
      console.error(`Error en API request ${endpoint}:`, error);
      // Retornar respuesta con estructura consistente para que el frontend pueda manejarla
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Si es un error de red (fetch falló), indicarlo claramente
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
        return {
          success: false,
          error: 'Error de conexión con el servidor. Verifique que el backend esté ejecutándose.',
          message: 'No se pudo conectar con el servidor'
        };
      }
      return {
        success: false,
        error: errorMessage,
        message: errorMessage
      };
    }
  }

  // Métodos para obtener datos
  async getClientes() {
    return this.request('/clientes');
  }

  async getProductos(codalm?: string, page?: number, pageSize?: number, search?: string) {
    const queryParams = new URLSearchParams();
    if (codalm) queryParams.append('codalm', codalm);
    if (page) queryParams.append('page', String(page));
    if (pageSize) queryParams.append('pageSize', String(pageSize));
    if (search) queryParams.append('search', search);
    const params = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request(`/productos${params}`);
  }

  async getFacturas() {
    return this.request('/facturas');
  }

  async getFacturasDetalle() {
    return this.request('/facturas-detalle');
  }

  async getCotizaciones() {
    return this.request('/cotizaciones');
  }

  async getCotizacionesDetalle() {
    return this.request('/cotizaciones-detalle');
  }

  async getPedidos() {
    return this.request('/pedidos');
  }

  async getPedidosDetalle() {
    return this.request('/pedidos-detalle');
  }

  async getRemisiones() {
    return this.request('/remisiones');
  }

  async getRemisionesDetalle() {
    return this.request('/remisiones-detalle');
  }

  async getNotasCredito() {
    return this.request('/notas-credito');
  }

  async getMedidas() {
    return this.request('/medidas');
  }

  async getCategorias() {
    return this.request('/categorias');
  }
  async getVendedores() {
    return this.request('/vendedores');
  }

  async getBodegas() {
    return this.request('/bodegas');
  }

  async registerInventoryEntry(payload: any) {
    return this.request('/inventario/entradas', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Método para ejecutar consultas personalizadas
  async executeQuery(query: string) {
    return this.request('/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  // Método para probar la conexión
  async testConnection() {
    return this.request('/test-connection');
  }

  // Método para verificar la salud del servidor
  async healthCheck() {
    return this.request('/health');
  }

  // --- Búsquedas server-side ---
  async searchClientes(search: string, limit = 20) {
    const trimmedSearch = String(search || '').trim();
    if (trimmedSearch.length < 2) {
      return { success: false, message: 'Ingrese al menos 2 caracteres', data: [] };
    }
    const params = new URLSearchParams({ search: trimmedSearch, limit: String(limit) });
    // Ruta principal
    try {
      return await this.request(`/buscar/clientes?${params.toString()}`);
    } catch (e) {
      // Fallback a ruta alternativa
      return await this.request(`/clientes/search?${params.toString()}`);
    }
  }

  async searchVendedores(search: string, limit = 20) {
    const trimmedSearch = String(search || '').trim();
    if (trimmedSearch.length < 2) {
      return { success: false, message: 'Ingrese al menos 2 caracteres', data: [] };
    }
    const params = new URLSearchParams({ search: trimmedSearch, limit: String(limit) });
    return this.request(`/buscar/vendedores?${params.toString()}`);
    }

  async searchProductos(search: string, limit = 20) {
    const trimmedSearch = String(search || '').trim();
    if (trimmedSearch.length < 2) {
      return { success: false, message: 'Ingrese al menos 2 caracteres', data: [] };
    }
    const params = new URLSearchParams({ search: trimmedSearch, limit: String(limit) });
    return this.request(`/buscar/productos?${params.toString()}`);
  }

  // --- Crear documentos ---
  async createCotizacion(payload: any) {
    return this.request('/cotizaciones', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateCotizacion(id: string | number, payload: any) {
    return this.request(`/cotizaciones/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async createPedido(payload: any) {
    return this.request('/pedidos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updatePedido(id: string | number, payload: any) {
    return this.request(`/pedidos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async createRemision(payload: any) {
    return this.request('/remisiones', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateRemision(id: string | number, payload: any) {
    return this.request(`/remisiones/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async createFactura(payload: any) {
    return this.request('/facturas', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateFactura(id: string | number, payload: any) {
    return this.request(`/facturas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async createNotaCredito(payload: any) {
    return this.request('/notas-credito', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateNotaCredito(id: string | number, payload: any) {
    return this.request(`/notas-credito/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  // --- Crear cliente / set lista de precios ---
  async createCliente(payload: any) {
    return this.request('/clientes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getClienteById(id: string | number) {
    return this.request(`/clientes/${id}`);
  }

  async setClienteListaPrecios(clienteId: number | string, listaPrecioId: number | string) {
    return this.request(`/clientes/${clienteId}/lista-precios`, {
      method: 'POST',
      body: JSON.stringify({ listaPrecioId }),
    });
  }
}

// Instancia singleton del cliente API
export const apiClient = new ApiClient();

// Funciones de conveniencia para usar en el DataContext
export const fetchClientes = () => apiClient.getClientes();
export const fetchProductos = (codalm?: string) => apiClient.getProductos(codalm);
export const fetchFacturas = () => apiClient.getFacturas();
export const fetchFacturasDetalle = () => apiClient.getFacturasDetalle();
export const fetchCotizaciones = () => apiClient.getCotizaciones();
export const fetchCotizacionesDetalle = () => apiClient.getCotizacionesDetalle();
export const fetchPedidos = () => apiClient.getPedidos();
export const fetchPedidosDetalle = () => apiClient.getPedidosDetalle();
export const fetchRemisiones = () => apiClient.getRemisiones();
export const fetchRemisionesDetalle = () => apiClient.getRemisionesDetalle();
export const fetchNotasCredito = () => apiClient.getNotasCredito();
export const fetchMedidas = () => apiClient.getMedidas();
export const fetchCategorias = () => apiClient.getCategorias();
export const fetchVendedores = () => apiClient.getVendedores();
export const fetchBodegas = () => apiClient.getBodegas();
export const testApiConnection = () => apiClient.testConnection();
export const executeCustomQuery = (query: string) => apiClient.executeQuery(query);
export const apiRegisterInventoryEntry = (payload: any) => apiClient.registerInventoryEntry(payload);

// búsquedas/crear
export const apiSearchClientes = (q: string, limit?: number) => apiClient.searchClientes(q, limit);
export const apiSearchVendedores = (q: string, limit?: number) => apiClient.searchVendedores(q, limit);
export const apiSearchProductos = (q: string, limit?: number) => apiClient.searchProductos(q, limit);
export const apiCreateCotizacion = (payload: any) => apiClient.createCotizacion(payload);
export const apiUpdateCotizacion = (id: string | number, payload: any) => apiClient.updateCotizacion(id, payload);
export const apiCreatePedido = (payload: any) => apiClient.createPedido(payload);
export const apiUpdatePedido = (id: string | number, payload: any) => apiClient.updatePedido(id, payload);
export const apiCreateRemision = (payload: any) => apiClient.createRemision(payload);
export const apiUpdateRemision = (id: string | number, payload: any) => apiClient.updateRemision(id, payload);
export const apiCreateFactura = (payload: any) => apiClient.createFactura(payload);
export const apiUpdateFactura = (id: string | number, payload: any) => apiClient.updateFactura(id, payload);
export const apiCreateCliente = (payload: any) => apiClient.createCliente(payload);
export const apiSetClienteListaPrecios = (id: number | string, listaPrecioId: number | string) => apiClient.setClienteListaPrecios(id, listaPrecioId);
export const apiGetClienteById = (id: number | string) => apiClient.getClienteById(id);
export const apiCreateNotaCredito = (payload: any) => apiClient.createNotaCredito(payload);
export const apiUpdateNotaCredito = (id: number | string, payload: any) => apiClient.updateNotaCredito(id, payload);

export default apiClient;
