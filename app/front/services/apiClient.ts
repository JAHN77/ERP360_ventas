// Cliente API para conectar con el backend SQL Server
const isProduction = import.meta.env.PROD || window.location.hostname !== 'localhost';
const API_BASE_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) ||
  (isProduction ? '/api' : 'http://localhost:3001/api');
export const BACKEND_URL = API_BASE_URL.replace('/api', '');

import { ProductoConteo } from '../types';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: any;
  status?: number;
  code?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  public async login(username: string, password: string): Promise<ApiResponse<any>> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }

  public async sendCreditNoteEmail(id: number | string, to: string, body: string, pdfBase64?: string, customerName?: string) {
    return this.request('/email/credit-note', {
      method: 'POST',
      body: JSON.stringify({ id, to, body, pdfBase64, customerName })
    });
  }

  async archiveDocumentToDrive(data: {
    type: 'cotizacion' | 'pedido' | 'remision' | 'factura' | 'nota_credito';
    number: string;
    date?: string | Date;
    recipientName: string;
    fileBase64: string;
    replace?: boolean;
  }) {
    return this.request('/drive/archive', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async updateSignature(firmaBase64: string): Promise<ApiResponse<any>> {
    return this.request('/auth/firma', {
      method: 'POST',
      body: JSON.stringify({ firmaBase64 })
    });
  }

  public async getMe(): Promise<ApiResponse<any>> {
    return this.request('/auth/me');
  }

  // --- Users Management ---
  public async getUsers(): Promise<ApiResponse<any[]>> {
    return this.request('/users');
  }

  public async createUser(userData: any): Promise<ApiResponse<any>> {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  public async updateUser(id: number, userData: any): Promise<ApiResponse<any>> {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  }

  public async deleteUser(id: number): Promise<ApiResponse<any>> {
    return this.request(`/users/${id}`, {
      method: 'DELETE'
    });
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
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
        const fetchOptions: RequestInit = {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(typeof window !== 'undefined' && localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {}),
            ...options.headers,
          },
          signal: controller?.signal || existingSignal,
        };

        const response = await fetch(url, fetchOptions);

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
  async getClientes(page?: number, pageSize?: number, hasEmail?: boolean, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', isProveedor?: boolean | string, tipoPersonaId?: string, diasCredito?: string) {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', String(page));
    if (pageSize) queryParams.append('pageSize', String(pageSize));
    if (hasEmail) queryParams.append('hasEmail', 'true');
    if (search) queryParams.append('search', search);
    if (sortBy) queryParams.append('sortBy', sortBy);
    if (sortOrder) queryParams.append('sortOrder', sortOrder);
    if (isProveedor !== undefined) queryParams.append('isProveedor', String(isProveedor));
    if (tipoPersonaId) queryParams.append('tipoPersonaId', tipoPersonaId);
    if (diasCredito) queryParams.append('diasCredito', diasCredito);
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

  async createProducto(payload: any) {
    return this.request('/productos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateProducto(id: string | number, payload: any) {
    return this.request(`/productos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getFacturas(page?: number, pageSize?: number, search?: string, estado?: string, fechaInicio?: string, fechaFin?: string, clienteId?: string, sortBy?: string, sortOrder?: 'asc' | 'desc') {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', String(page));
    if (pageSize) queryParams.append('pageSize', String(pageSize));
    if (search) queryParams.append('search', search);
    if (estado) queryParams.append('estado', estado);
    if (fechaInicio) queryParams.append('fechaInicio', fechaInicio);
    if (fechaFin) queryParams.append('fechaFin', fechaFin);
    if (clienteId) queryParams.append('clienteId', clienteId);
    if (sortBy) queryParams.append('sortBy', sortBy);
    if (sortOrder) queryParams.append('sortOrder', sortOrder);

    const params = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request(`/facturas${params}`);
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

  // --- Inventory Concepts ---
  async getInventoryConcepts() {
    return this.request('/conceptos-inventario');
  }

  async createInventoryConcept(data: any) {
    return this.request('/conceptos-inventario', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateInventoryConcept(codcon: string, data: any) {
    return this.request(`/conceptos-inventario/${codcon}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteInventoryConcept(codcon: string) {
    return this.request(`/conceptos-inventario/${codcon}`, {
      method: 'DELETE'
    });
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

  // --- Lines and Sublines ---
  async getLinesWithSublines() {
    return this.request('/categorias/lineas-sublineas');
  }

  async createLine(data: any) {
    return this.request('/categorias/lineas', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateLine(codline: string, data: any) {
    return this.request(`/categorias/lineas/${codline}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteLine(codline: string) {
    return this.request(`/categorias/lineas/${codline}`, {
      method: 'DELETE'
    });
  }

  async createSubline(data: any) {
    return this.request('/categorias/sublineas', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateSubline(codline: string, codsub: string, data: any) {
    return this.request(`/categorias/sublineas/${codline}/${codsub}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteSubline(codline: string, codsub: string) {
    return this.request(`/categorias/sublineas/${codline}/${codsub}`, {
      method: 'DELETE'
    });
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

  async getEmpresa() {
    return this.request('/empresa');
  }

  async registerInventoryEntry(data: {
    productoId: number;
    cantidad: number;
    costoUnitario: number;
    documentoRef: string;
    motivo: string;
    codalm: string;
    codcon: string;
    numComprobante?: number;
    numRemision?: number;
    clienteId?: string;
  }) {
    return this.request('/inventario/entradas', {
      method: 'POST',
      body: JSON.stringify(data)
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

  async searchProductos(search: string, limit = 20, codalm?: string) {
    const trimmedSearch = String(search || '').trim();
    if (trimmedSearch.length < 2) {
      return { success: false, message: 'Ingrese al menos 2 caracteres', data: [] };
    }
    const params = new URLSearchParams({ search: trimmedSearch, limit: String(limit) });
    if (codalm) params.append('codalm', codalm);
    return this.request(`/buscar/productos?${params.toString()}`);
  }

  async getProductStock(id: number | string) {
    return this.request<{ codalm: string; nombreBodega: string; cantidad: number }[]>(`/productos/${id}/stock`);
  }

  async getStock(productoId: number | string, codalm: string) {
    const queryParams = new URLSearchParams({ codalm });
    return this.request<{ stock: number; codalm: string; productoId: string }>(`/inventario/stock/${productoId}?${queryParams.toString()}`);
  }

  async getInventoryMovements(page: number = 1, pageSize: number = 20, search: string = '', sortBy: string = 'fecha', sortOrder: 'asc' | 'desc' = 'desc', codalm?: string, tipo?: string) {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      search,
      sortBy,
      sortOrder
    });
    if (codalm) queryParams.append('codalm', codalm);
    if (tipo) queryParams.append('tipo', tipo);
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

  async sendCotizacionEmail(id: string | number, payload: { firmaVendedor?: string | null, destinatario?: string, asunto?: string, mensaje?: string, pdfBase64?: string }) {
    return this.request(`/cotizaciones/${id}/send-email`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendPedidoEmail(id: string | number, payload: { destinatario?: string, asunto?: string, mensaje?: string, pdfBase64?: string }) {
    return this.request(`/pedidos/${id}/send-email`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendRemisionEmail(id: string | number, payload: { destinatario?: string, asunto?: string, mensaje?: string, pdfBase64?: string }) {
    return this.request(`/remisiones/${id}/send-email`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendFacturaEmail(id: string | number, payload: { destinatario?: string, asunto?: string, mensaje?: string, pdfBase64?: string }) {
    return this.request(`/facturas/${id}/send-email`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendNotaCreditoEmail(id: string | number, payload: { destinatario?: string, asunto?: string, mensaje?: string, pdfBase64?: string }) {
    return this.request(`/notas-credito/${id}/email`, { // Note: controller path is /:id/email or /:id/send-email? I should check routes.
      method: 'POST',
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
  // --- ORDENES DE COMPRA ---
  async getOrdenesCompra(page: number = 1, pageSize: number = 50, search: string = '', codalm?: string) {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      search
    });
    if (codalm) queryParams.append('codalm', codalm);
    return this.request<any[]>(`/ordenes-compra?${queryParams.toString()}`);
  }

  async getOrdenCompraById(id: string) {
    return this.request<any>(`/ordenes-compra/${id}`);
  }

  async getOrdenCompraByNumber(number: string, codalm?: string) {
    const queryParams = new URLSearchParams();
    if (codalm) queryParams.append('codalm', codalm);
    const params = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request<any>(`/ordenes-compra/numero/${number}${params}`);
  }

  async createOrdenCompra(data: any) {
    return this.request<any>('/ordenes-compra', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async searchProveedoresOrden(search: string, limit: number = 20) {
    const queryParams = new URLSearchParams({
      search,
      limit: limit.toString()
    });
    return this.request<any[]>(`/ordenes-compra/buscar-proveedores?${queryParams.toString()}`);
  }

  // Métodos públicos para uso externo
  async get<T = any>(endpoint: string) {
    return this.request<T>(endpoint);
  }

  async post<T = any>(endpoint: string, data: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async put<T = any>(endpoint: string, data: any) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
  async sendEmail(payload: { to: string, subject: string, body: string, attachment?: { filename: string, content: string, contentType: string } }) {
    return this.request('/email/send', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getNextQuoteNumber(): Promise<ApiResponse<{ nextNumber: string }>> {
    return this.request<{ nextNumber: string }>('/cotizaciones/next-number');
  }

  public async getNextOrderNumber(): Promise<ApiResponse<{ nextNumber: string }>> {
    return this.request<{ nextNumber: string }>('/pedidos/next-number');
  }

  public async getNextInvoiceNumber(): Promise<ApiResponse<{ nextNumber: string }>> {
    return this.request<{ nextNumber: string }>('/facturas/next-number');
  }

  public async getNextCreditNoteNumber(): Promise<ApiResponse<{ nextNumber: string }>> {
    return this.request<{ nextNumber: string }>('/notas-credito/next-number');
  }
}

// Instancia singleton del cliente API
export const apiClient = new ApiClient();

// Funciones de conveniencia para usar en el DataContext
export const fetchClientes = (page?: number, pageSize?: number, hasEmail?: boolean, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', isProveedor?: boolean | string, tipoPersonaId?: string, diasCredito?: string) => apiClient.getClientes(page, pageSize, hasEmail, search, sortBy, sortOrder, isProveedor, tipoPersonaId, diasCredito);
export const fetchProductos = (codalm?: string, page?: number, pageSize?: number, search?: string, sortColumn?: string, sortDirection?: 'asc' | 'desc') => apiClient.getProductos(codalm, page, pageSize, search, sortColumn, sortDirection);
export const fetchFacturas = (page?: number, pageSize?: number, search?: string, estado?: string, fechaInicio?: string, fechaFin?: string, clienteId?: string, sortBy?: string, sortOrder?: 'asc' | 'desc') => apiClient.getFacturas(page, pageSize, search, estado, fechaInicio, fechaFin, clienteId, sortBy, sortOrder);
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
export const fetchEmpresa = () => apiClient.getEmpresa();
export const testApiConnection = () => apiClient.testConnection();
export const executeCustomQuery = (query: string) => apiClient.executeQuery(query);
export const apiRegisterInventoryEntry = (payload: any) => apiClient.registerInventoryEntry(payload);


// --- ORDENES DE COMPRA WRAPPERS ---
export const apiFetchOrdenesCompra = (page?: number, pageSize?: number, search?: string, codalm?: string) => apiClient.getOrdenesCompra(page, pageSize, search, codalm);
export const apiFetchOrdenCompraById = (id: string) => apiClient.getOrdenCompraById(id);
export const apiFetchOrdenCompraByNumber = (number: string, codalm?: string) => apiClient.getOrdenCompraByNumber(number, codalm);
export const apiCreateOrdenCompra = (data: any) => apiClient.createOrdenCompra(data);
export const apiSearchProveedores = (search: string, limit?: number) => apiClient.searchProveedoresOrden(search, limit);

// búsquedas/crear
export const apiSearchClientes = (q: string, limit?: number) => apiClient.searchClientes(q, limit);
export const apiSearchVendedores = (q: string, limit?: number) => apiClient.searchVendedores(q, limit);
export const apiSearchProductos = (q: string, limit?: number, codalm?: string) => apiClient.searchProductos(q, limit, codalm);
export const apiCreateCotizacion = (payload: any) => apiClient.createCotizacion(payload);
export const apiUpdateCotizacion = (id: string | number, payload: any) => apiClient.updateCotizacion(id, payload);
export const apiSendCotizacionEmail = (id: string | number, payload: { firmaVendedor?: string | null; destinatario?: string; asunto?: string; mensaje?: string; pdfBase64?: string }) => apiClient.sendCotizacionEmail(id, payload);
export const apiSendPedidoEmail = (id: string | number, payload: { destinatario?: string; asunto?: string; mensaje?: string; pdfBase64?: string }) => apiClient.sendPedidoEmail(id, payload);
export const apiSendRemisionEmail = (id: string | number, payload: { destinatario?: string; asunto?: string; mensaje?: string; pdfBase64?: string }) => apiClient.sendRemisionEmail(id, payload);
export const apiSendFacturaEmail = (id: string | number, payload: { destinatario?: string; asunto?: string; mensaje?: string; pdfBase64?: string }) => apiClient.sendFacturaEmail(id, payload);


export const apiCreatePedido = (payload: any) => apiClient.createPedido(payload);
export const apiUpdatePedido = (id: string | number, payload: any) => apiClient.updatePedido(id, payload);
export const apiCreateRemision = (payload: any) => apiClient.createRemision(payload);
export const apiUpdateRemision = (id: string | number, payload: any) => apiClient.updateRemision(id, payload);
export const apiCreateFactura = (payload: any) => apiClient.createFactura(payload);
export const apiUpdateFactura = (id: string | number, payload: any) => apiClient.updateFactura(id, payload);
export const apiCreateCliente = (payload: any) => apiClient.createCliente(payload);
export const apiUpdateCliente = (id: string | number, payload: any) => apiClient.updateCliente(id, payload);

export const apiCreateProducto = (payload: any) => apiClient.createProducto(payload);
export const apiUpdateProducto = (id: string | number, payload: any) => apiClient.updateProducto(id, payload);

export const apiSetClienteListaPrecios = (id: number | string, listaPrecioId: number | string) => apiClient.setClienteListaPrecios(id, listaPrecioId);
export const apiGetClienteById = (id: number | string) => apiClient.getClienteById(id);
export const apiCreateNotaCredito = (payload: any) => apiClient.createNotaCredito(payload);
export const apiUpdateNotaCredito = (id: number | string, payload: any) => apiClient.updateNotaCredito(id, payload);
export const apiGetClientesConFacturasAceptadas = () => apiClient.getClientesConFacturasAceptadas();
export const fetchStock = (productoId: number | string, codalm: string) => apiClient.getStock(productoId, codalm);
export const fetchInventoryMovements = (page?: number, pageSize?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc') => apiClient.getInventoryMovements(page, pageSize, search, sortBy, sortOrder);



// Lines and Sublines exports
export const fetchLinesWithSublines = () => apiClient.getLinesWithSublines();
export const apiCreateLine = (data: any) => apiClient.createLine(data);
export const apiUpdateLine = (id: string, data: any) => apiClient.updateLine(id, data);
export const apiDeleteLine = (id: string) => apiClient.deleteLine(id);
export const apiCreateSubline = (data: any) => apiClient.createSubline(data);
export const apiUpdateSubline = (lineId: string, subId: string, data: any) => apiClient.updateSubline(lineId, subId, data);
export const apiDeleteSubline = (lineId: string, subId: string) => apiClient.deleteSubline(lineId, subId);

// --- CONTEO FÍSICO DE INVENTARIO ---
// --- CONTEO FÍSICO DE INVENTARIO ---
export const apiGetProductosParaConteo = async (codalm: string, linea?: string, filtro?: string, idconteo?: number) => {
  const params = new URLSearchParams({ codalm });
  if (linea) params.append('linea', linea);
  if (filtro) params.append('filtro', filtro);
  if (idconteo) params.append('idconteo', idconteo.toString());

  return apiClient.request<ProductoConteo[]>(`/inventario-fisico/productos?${params.toString()}`);
};

export const apiGetConteos = async (codalm?: string) => {
  const params = codalm ? `?codalm=${codalm}` : '';
  return apiClient.request<any[]>(`/inventario-fisico/conteos${params}`);
};

export const apiGetSiguienteNumeroConteo = async () => {
  return apiClient.request<number>('/inventario-fisico/siguiente-numero');
};

export const apiCreateConteo = async (data: any) => {
  return apiClient.request<any>('/inventario-fisico/conteo', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const apiUpdateConteoFisico = async (id: number, canfis: number) => {
  return apiClient.request<any>(`/inventario-fisico/conteo/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ canfis })
  });
};

export const apiAplicarConteo = async (idconteo: number) => {
  return apiClient.request<any>(`/inventario-fisico/aplicar/${idconteo}`, {
    method: 'POST',
    body: JSON.stringify({})
  });
};

export const apiSendGenericEmail = (payload: { to: string, subject: string, body: string, attachment?: { filename: string, content: string, contentType: string } }) => apiClient.sendEmail(payload);

export const apiGetNextQuoteNumber = () => apiClient.getNextQuoteNumber();
export const apiGetNextOrderNumber = () => apiClient.getNextOrderNumber();
export const apiGetNextInvoiceNumber = () => apiClient.getNextInvoiceNumber();
export const apiGetNextCreditNoteNumber = () => apiClient.getNextCreditNoteNumber();



// Export standalone functions for easier usage
export const apiSendCreditNoteEmail = (id: string | number, to: string, body: string, pdfBase64?: string, customerName?: string) => apiClient.sendCreditNoteEmail(id, to, body, pdfBase64, customerName);
export const apiArchiveDocumentToDrive = (data: any) => apiClient.archiveDocumentToDrive(data);

export default apiClient;
