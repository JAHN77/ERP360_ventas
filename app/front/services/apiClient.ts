// Cliente API para conectar con el backend SQL Server
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) ||
  (isLocal ? 'http://localhost:3001/api' : '/api');

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: any;
  status?: number;
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

      // Crear un AbortController solo si no hay uno existente en options
      let controller: AbortController | null = null;
      let timeoutId: NodeJS.Timeout | null = null;
      const existingSignal = options.signal;

      // Solo crear un timeout si no hay un signal existente
      // Para endpoints de test-connection, usar timeout más corto (5 segundos)
      // Para otros endpoints, usar timeout más largo (30 segundos)
      if (!existingSignal) {
        controller = new AbortController();
        const timeoutDuration = endpoint.includes('test-connection') ? 5000 : 30000;
        timeoutId = setTimeout(() => {
          if (controller) {
            controller.abort();
          }
        }, timeoutDuration);
      }

      try {
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          ...options,
          signal: controller?.signal || existingSignal, // Usar el signal del controller o el existente
        });

        // Limpiar timeout solo si lo creamos nosotros
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

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
      } finally {
        // Limpiar timeout solo si lo creamos nosotros
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    } catch (error) {
      // Detectar AbortError de múltiples formas
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorName = error instanceof Error ? error.name : '';
      const isAbortError = errorName === 'AbortError' ||
        errorMessage.includes('aborted') ||
        errorMessage.includes('signal is aborted');

      if (isAbortError) {
        // Si es un AbortError, retornar respuesta de error de conexión sin loguear como error crítico
        if (typeof window !== 'undefined') {
          console.warn(`[api] Solicitud cancelada por timeout o abort: ${endpoint}`);
        }
        return {
          success: false,
          error: 'Error de conexión con el servidor. La solicitud tardó demasiado tiempo o fue cancelada.',
          message: 'No se pudo conectar con el servidor (timeout)'
        };
      }

      console.error(`Error en API request ${endpoint}:`, error);
      // Retornar respuesta con estructura consistente para que el frontend pueda manejarla
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
  async getClientes(page?: number, pageSize?: number, hasEmail?: boolean) {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', String(page));
    if (pageSize) queryParams.append('pageSize', String(pageSize));
    if (hasEmail) queryParams.append('hasEmail', 'true');
    const params = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request(`/clientes${params}`);
  }

  async getClientesConFacturasAceptadas() {
    return this.request('/devoluciones/clientes-con-facturas-aceptadas');
  }

  async getProductos(codalm?: string, page?: number, pageSize?: number, search?: string, sortColumn?: string, sortDirection?: 'asc' | 'desc') {
    const queryParams = new URLSearchParams();
    if (codalm) queryParams.append('codalm', codalm);
    queryParams.append('page', String(page || 1));
    // Aumentar límite por defecto para cargar más productos
    queryParams.append('pageSize', String(pageSize || 5000));
    if (search) queryParams.append('search', search);
    if (sortColumn) queryParams.append('sortColumn', sortColumn);
    if (sortDirection) queryParams.append('sortDirection', sortDirection);

    const params = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request(`/productos${params}`);
  }

  async getFacturas() {
    return this.request('/facturas');
  }

  async getFacturasDetalle(facturaId?: string | number) {
    const queryParams = new URLSearchParams();
    if (facturaId) queryParams.append('facturaId', String(facturaId));
    const params = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request(`/facturas-detalle${params}`);
  }

  async getCotizaciones() {
    return this.request('/cotizaciones');
  }

  async getCotizacionesDetalle(cotizacionId?: string | number) {
    const queryParams = new URLSearchParams();
    if (cotizacionId) queryParams.append('cotizacionId', String(cotizacionId));
    const params = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request(`/cotizaciones-detalle${params}`);
  }

  async getPedidos(page?: number, pageSize?: number, search?: string, estado?: string, codter?: string) {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', String(page));
    if (pageSize) queryParams.append('pageSize', String(pageSize));
    if (search) queryParams.append('search', search);
    if (estado) queryParams.append('estado', estado);
    if (codter) queryParams.append('codter', codter);
    const params = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request(`/pedidos${params}`);
  }

  async getPedidosDetalle(pedidoId?: string) {
    const queryParams = new URLSearchParams();
    if (pedidoId) queryParams.append('pedidoId', pedidoId);
    const params = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request(`/pedidos-detalle${params}`);
  }

  async getRemisiones(page?: number, pageSize?: number, search?: string, codter?: string, codalm?: string, estrec?: string) {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', String(page));
    if (pageSize) queryParams.append('pageSize', String(pageSize));
    if (search) queryParams.append('search', search);
    if (codter) queryParams.append('codter', codter);
    if (codalm) queryParams.append('codalm', codalm);
    if (estrec) queryParams.append('estrec', estrec);
    const params = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request(`/remisiones${params}`);
  }

  async getRemisionesDetalle() {
    return this.request('/remisiones-detalle');
  }

  async getRemisionDetalleById(id: string | number) {
    return this.request(`/remisiones/${id}/detalle`);
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

  async getCiudades() {
    return this.request('/ciudades');
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

  async getProductStock(id: number | string) {
    return this.request<{ codalm: string; nombreBodega: string; cantidad: number }[]>(`/productos/${id}/stock`);
  }

  async getStock(productoId: number | string, codalm: string) {
    const queryParams = new URLSearchParams({ codalm });
    return this.request<{ stock: number; codalm: string; productoId: string }>(`/inventario/stock/${productoId}?${queryParams.toString()}`);
  }

  async getInventoryMovements(page: number = 1, pageSize: number = 20, search: string = '', sortBy: string = 'fecha', sortOrder: 'asc' | 'desc' = 'desc') {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      search,
      sortBy,
      sortOrder
    });
    return this.request<any>(`/inventario/movimientos?${queryParams.toString()}`);
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

  async updateCliente(id: string | number, payload: any) {
    return this.request(`/clientes/${id}`, {
      method: 'PUT',
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
export const fetchClientes = (page?: number, pageSize?: number, hasEmail?: boolean) => apiClient.getClientes(page, pageSize, hasEmail);
export const fetchProductos = (codalm?: string, page?: number, pageSize?: number, search?: string) => apiClient.getProductos(codalm, page, pageSize, search);
export const fetchFacturas = () => apiClient.getFacturas();
export const fetchFacturasDetalle = (facturaId?: string | number) => apiClient.getFacturasDetalle(facturaId);
export const fetchCotizaciones = () => apiClient.getCotizaciones();
export const fetchCotizacionesDetalle = (cotizacionId?: string | number) => apiClient.getCotizacionesDetalle(cotizacionId);
export const fetchPedidos = (page?: number, pageSize?: number, search?: string, estado?: string, codter?: string) =>
  apiClient.getPedidos(page, pageSize, search, estado, codter);
export const fetchPedidosDetalle = (pedidoId?: string) => apiClient.getPedidosDetalle(pedidoId);
export const fetchRemisiones = (page?: number, pageSize?: number, search?: string, codter?: string, codalm?: string, estrec?: string) =>
  apiClient.getRemisiones(page, pageSize, search, codter, codalm, estrec);
export const fetchRemisionesDetalle = () => apiClient.getRemisionesDetalle();
export const fetchNotasCredito = () => apiClient.getNotasCredito();
export const fetchMedidas = () => apiClient.getMedidas();
export const fetchCategorias = () => apiClient.getCategorias();
export const fetchVendedores = () => apiClient.getVendedores();
export const fetchBodegas = () => apiClient.getBodegas();
export const fetchCiudades = () => apiClient.getCiudades();
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
export const apiUpdateCliente = (id: string | number, payload: any) => apiClient.updateCliente(id, payload);

export const apiSetClienteListaPrecios = (id: number | string, listaPrecioId: number | string) => apiClient.setClienteListaPrecios(id, listaPrecioId);
export const apiGetClienteById = (id: number | string) => apiClient.getClienteById(id);
export const apiCreateNotaCredito = (payload: any) => apiClient.createNotaCredito(payload);
export const apiUpdateNotaCredito = (id: number | string, payload: any) => apiClient.updateNotaCredito(id, payload);
export const apiGetClientesConFacturasAceptadas = () => apiClient.getClientesConFacturasAceptadas();
export const fetchStock = (productoId: number | string, codalm: string) => apiClient.getStock(productoId, codalm);
export const fetchInventoryMovements = (page?: number, pageSize?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc') => apiClient.getInventoryMovements(page, pageSize, search, sortBy, sortOrder);

export default apiClient;
