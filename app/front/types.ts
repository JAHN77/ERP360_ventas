import type { Page } from './contexts/NavigationContext';
import type { Role } from './config/rolesConfig';

// --- GEOGRAFÍA Y TIPOS BÁSICOS ---
export interface Departamento {
  id: string; // uuid
  codigo: string;
  nombre: string;
}

export interface Ciudad {
  id: string; // uuid
  departamento_id: string;
  codigo: string;
  nombre: string;
}

export interface TipoDocumento {
  id: string; // uuid
  codigo: string;
  nombre: string;
}

export interface TipoPersona {
  id: string; // uuid
  codigo: string;
  nombre: string;
}

export interface RegimenFiscal {
  id: string; // uuid
  codigo: string;
  nombre: string;
}

// --- EMPRESA Y USUARIOS ---
export interface Empresa {
  id: number;
  razonSocial: string;
  nit: string;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  email?: string;
  sedes?: Sede[];
}

export interface Bodega {
  id: string;
  nombre: string;
}

export interface Sede {
  id: number;
  nombre: string;
  codigo: string;
  empresaId: number;
  municipioId: number;
}

export interface Usuario {
  id: number;
  identificacion?: string;
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  email: string;
  username: string;
  rol: Role;
  empresas: Empresa[];
  nombre?: string;
}

// --- ENTIDADES COMERCIALES ---

export interface Cliente {
  id: string; // Mapeado de codter
  numeroDocumento: string; // Mapeado de codter
  nombreCompleto: string; // Construido
  tipoDocumento: string;
  tipter: number;
  isproveedor: boolean;
  apl1?: string;
  apl2?: string;
  nom1?: string;
  nom2?: string;
  nomter: string; // Razón Social
  dirter?: string;
  telter?: string;
  celter?: string;
  email?: string;
  ciudad?: string;
  coddane?: string;
  codven?: string;
  cupoCredito: number;
  plazo: number;
  activo: number;
  createdAt: string; // Mapeado de fecing
  condicionPago?: string;

  // Campos originales mantenidos para compatibilidad de la UI, se mapean desde los nuevos.
  tipoPersonaId: string;
  tipoDocumentoId: string;
  razonSocial?: string;
  primerNombre?: string;
  // FIX: Added missing property to Cliente interface
  segundoNombre?: string;
  primerApellido?: string;
  // FIX: Added missing property to Cliente interface
  segundoApellido?: string;
  celular?: string;
  direccion?: string;
  ciudadId?: string;
  limiteCredito: number;
  diasCredito: number;
  empresaId: number;
  // FIX: Added missing property to Cliente interface
  regimenFiscalId?: string;
}


export interface Vendedor {
  id: string; // uuid o codi_emple
  numeroDocumento: string;
  primerNombre: string;
  primerApellido: string;
  codigoVendedor: string;
  codiEmple?: string; // Código de empleado (codi_emple)
  nombreCompleto?: string; // Nombre completo del vendedor
  activo?: number | boolean; // Estado activo (1 = activo, 0 = inactivo)
  empresaId: number;
}


export interface InvProducto {
  id: number; // Mapeado de ID autoincremental
  codins: string; // Código de Insumo
  nomins: string;
  codigoLinea: string;
  codigoSublinea: string;
  codigoMedida: string;
  tasaIva: number;
  ultimoCosto: number;
  costoPromedio: number;
  referencia?: string;
  karins: boolean; // Controla existencia
  activo: boolean;
  // Campos para compatibilidad de UI, mapeados desde los de arriba
  nombre: string;
  idMedida?: number;
  idTipoProducto: number;
  idCategoria: number;
  idSublineas: number;
  idMarca?: number;
  controlaExistencia: number | null;
  precio: number;
  aplicaIva: boolean;
  descripcion: string;
  unidadMedida: string;
  // Campos de inventario desde inv_invent
  stock?: number; // ucoins desde inv_invent
  precioInventario?: number; // valinv desde inv_invent
}
export type Producto = InvProducto;

export interface Categoria {
  id: number;
  nombre: string;
  isreceta?: number;
  requiere_empaques?: number;
  estado?: number;
  imgruta?: string;
}

// --- DOCUMENTOS Y DETALLES ---

export interface DocumentoDetalle {
  id?: string; // uuid
  detaPedidoId?: number; // ID del detalle del pedido en ven_detapedidos (para remisiones)
  productoId: number;
  codProducto?: string; // Código de producto (CHAR(8))
  cantidad: number;
  precioUnitario: number;
  descuentoPorcentaje: number;
  ivaPorcentaje: number;
  descripcion: string;
  subtotal: number;
  valorIva: number;
  total: number;
  // Campos adicionales de ven_detacotizacion
  cantFacturada?: number; // Cantidad facturada
  numFactura?: string; // Número de factura relacionada
  codigoMedida?: string; // Código de medida
  estado?: string; // Estado del item
  qtycot?: number; // Cantidad cotizada
}
export type DocumentItem = DocumentoDetalle;


export interface Cotizacion {
  id: string; // uuid
  numeroCotizacion: string;
  fechaCotizacion: string; // date
  fechaVencimiento: string; // date
  clienteId: string;
  codter?: string; // Código de tercero/cliente
  vendedorId?: string; // ID numérico del vendedor (ideven) o código (codven) como fallback
  codVendedor?: string; // Código del vendedor (codven)
  subtotal: number;
  descuentoValor: number;
  ivaValor: number;
  total: number;
  observaciones?: string;
  estado: 'ENVIADA' | 'APROBADA' | 'RECHAZADA' | 'VENCIDA';
  empresaId: number;
  codalm?: string; // Código de almacén
  items: DocumentoDetalle[];
  approvedItems?: number[];
  observacionesInternas?: string;
  listaPrecioId?: string;
  descuentoPorcentaje?: number;
  ivaPorcentaje?: number;
  domicilios?: number;
  // Campos adicionales de ven_cotizacion
  formaPago?: string; // Forma de pago (nchar(2))
  valorAnticipo?: number; // Valor de anticipo
  numOrdenCompra?: number; // Número de orden de compra del cliente
  fechaAprobacion?: string; // Fecha de aprobación (date)
  codUsuario?: string; // Código de usuario que creó
  idUsuario?: number; // ID de usuario
  codTarifa?: string; // Código de tarifa (char(2))
  fechaCreacion?: string; // Fecha de creación del sistema (datetime)
  notaPago?: string; // Nota de pago
}

export interface Pedido {
  id: string; // uuid
  numeroPedido: string;
  fechaPedido: string; // date
  clienteId: string;
  vendedorId?: string;
  cotizacionId?: string;
  numeroCotizacionOrigen?: string; // Número de cotización obtenido desde el JOIN
  subtotal: number;
  descuentoValor: number;
  ivaValor: number;
  total: number;
  observaciones?: string;
  estado: 'BORRADOR' | 'ENVIADA' | 'CONFIRMADO' | 'EN_PROCESO' | 'PARCIALMENTE_REMITIDO' | 'REMITIDO' | 'CANCELADO';
  empresaId: number;
  items: DocumentoDetalle[];
  historial?: { timestamp: number; usuario: string; accion: string }[];
  fechaEntregaEstimada?: string; // date
  listaPrecioId?: string;
  descuentoPorcentaje?: number;
  ivaPorcentaje?: number;
  impoconsumoValor?: number;
  instruccionesEntrega?: string;
  notaPago?: string; // Nota de pago
  formaPago?: string; // Forma de pago: 1=Contado, 2=Crédito
}


export interface Remision {
  id: string; // id de ven_recibos (int convertido a string)
  numeroRemision: string; // Formato: REM-0001
  fechaRemision: string; // date (fecrec)
  pedidoId?: string; // numped (relación con ven_pedidos)
  facturaId?: string;
  clienteId: string; // codter
  codter?: string; // Código de tercero/cliente
  vendedorId?: string; // CODVEN o codVendedor
  codVendedor?: string; // Código del vendedor (CODVEN)
  subtotal: number; // netrec
  descuentoValor: number; // desrec
  ivaValor: number; // Calculado: valrec - netrec - desrec
  total: number; // valrec
  observaciones?: string; // observa
  estado: 'BORRADOR' | 'EN_TRANSITO' | 'ENTREGADO' | 'CANCELADO'; // Mapeado desde estrec
  empresaId: number | string; // codalm
  codalm?: string; // Código de almacén
  items: DocumentoDetalle[];
  estadoEnvio?: 'Total' | 'Parcial'; // Opcional, no existe en BD real
  metodoEnvio?: 'transportadoraExterna' | 'transportePropio' | 'recogeCliente'; // Opcional
  transportadoraId?: string; // Opcional
  transportadora?: string; // Opcional
  numeroGuia?: string; // Opcional
  fechaDespacho?: string; // Opcional
  // Campos adicionales de la BD real
  numrec?: number; // Número de recibo
  tipdoc?: string; // Tipo de documento
  fechaCreacion?: string; // fecsys
  codUsuario?: string; // codusu
  estadoOriginal?: string; // estrec (estado original de la BD)
}


export interface Factura {
  id: string; // uuid
  numeroFactura: string;
  fechaFactura: string; // date
  fechaVencimiento?: string; // date
  remisionId?: string;
  pedidoId?: string;
  clienteId: string;
  vendedorId?: string;
  subtotal: number;
  descuentoValor: number;
  ivaValor: number;
  total: number;
  observaciones?: string;
  estado: 'BORRADOR' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA' | 'ANULADA';
  cufe?: string;
  empresaId: number;
  items: DocumentoDetalle[];
  remisionesIds: string[];
  estadoDevolucion?: 'DEVOLUCION_PARCIAL' | 'DEVOLUCION_TOTAL';
  fechaTimbrado?: string;
  motivoRechazo?: string; // Motivo del rechazo cuando la factura es rechazada
  formaPago?: string; // Forma de pago: 1=Contado, 2=Crédito
}


export interface NotaCredito {
  id: string; // uuid
  numero: string;
  facturaId: string;
  clienteId: string;
  fechaEmision: string;
  subtotal: number;
  iva: number;
  total: number;
  motivo: string;
  estadoDian?: 'Transmitido' | 'PENDIENTE' | 'Error';
  itemsDevueltos: DocumentoDetalle[];
}

export interface Medida {
  id: number;
  codigo: string;
  nombre: string;
  abreviatura: string;
}

export interface Transportadora {
  id: string; // uuid
  nombre: string;
  nitOIdentificacion?: string;
  activo: boolean;
  empresaId: number;
}

// --- ARCHIVOS ADJUNTOS ---
export interface ArchivoAdjunto {
  id: string; // uuid
  entidadId: string; // uuid, ID de la remisión, factura, etc.
  entidadTipo: 'REMISION' | 'FACTURA' | 'COTIZACION' | 'PEDIDO' | 'NOTA_CREDITO';
  nombreArchivo: string;
  rutaStorage: string;
  tipoMime: string;
  tamañoBytes: number;
  empresaId: number;
  createdAt: string;
}

// --- OTROS TIPOS DE APLICACIÓN ---

export interface Notification {
  id: string;
  message: string;
  type: 'warning' | 'info' | 'success';
  timestamp: number;
  isRead: boolean;
  relatedId?: string;
  link?: {
    page: Page;
    params?: Record<string, any>;
  };
}

export interface ActivityLog {
  id: string;
  timestamp: number;
  user: {
    id: number;
    nombre: string;
    rol: Role;
  };
  action: string;
  details: string;
  entity: {
    type: string;
    id: string | number;
    name: string;
  }
}

// --- PREFERENCIAS DE DOCUMENTOS ---
export type SignatureType = 'physical' | 'digital' | 'none';
export type DetailLevel = 'full' | 'summary';

export interface DocumentPreferences {
  showPrices: boolean;
  signatureType: SignatureType;
  detailLevel: DetailLevel;
}

// --- BÚSQUEDA GLOBAL ---
export interface GlobalSearchResults {
  cotizaciones: Cotizacion[];
  pedidos: Pedido[];
  facturas: Factura[];
  remisiones: Remision[];
  productos: InvProducto[];
  clientes: Cliente[];
}