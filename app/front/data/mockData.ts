import { Departamento, Ciudad, TipoDocumento, TipoPersona, RegimenFiscal, Categoria, Usuario, Empresa, Sede, Vendedor } from '../types';

// --- GENERACIÓN DE DATOS BÁSICOS (CATÁLOGOS ESTÁTICOS) ---
// Estos datos se mantienen para agilizar la carga inicial y como fallback.

export const departamentos: Departamento[] = [
    { id: 'd1', codigo: '11', nombre: 'Bogotá D.C.' },
    { id: 'd2', codigo: '05', nombre: 'Antioquia' },
    { id: 'd3', codigo: '76', nombre: 'Valle del Cauca' },
    { id: 'd4', codigo: '13', nombre: 'Bolívar' },
    { id: 'd5', codigo: '68', nombre: 'Santander' },
    { id: 'd6', codigo: '08', nombre: 'Atlántico' },
    { id: 'd7', codigo: '54', nombre: 'Norte de Santander' },
];

export const ciudades: Ciudad[] = [
    { id: 'c1', departamento_id: 'd1', codigo: '11001', nombre: 'Bogotá D.C.' },
    { id: 'c2', departamento_id: 'd2', codigo: '05001', nombre: 'Medellín' },
    { id: 'c3', departamento_id: 'd3', codigo: '76001', nombre: 'Cali' },
    { id: 'c4', departamento_id: 'd4', codigo: '13001', nombre: 'Cartagena' },
    { id: 'c5', departamento_id: 'd5', codigo: '68001', nombre: 'Bucaramanga' },
    { id: 'c6', departamento_id: 'd6', codigo: '08001', nombre: 'Barranquilla' },
    { id: 'c7', departamento_id: 'd7', codigo: '54001', nombre: 'Cúcuta' },
];

export const tiposDocumento: TipoDocumento[] = [
    { id: 'td1', codigo: '13', nombre: 'Cédula de Ciudadanía (13)' },
    { id: 'td2', codigo: '31', nombre: 'NIT (31)' },
];

export const tiposPersona: TipoPersona[] = [
    { id: 'tp1', codigo: '2', nombre: 'Cliente' },
];

export const regimenesFiscales: RegimenFiscal[] = [
    { id: 'rf1', codigo: 'R-99-PN', nombre: 'No Responsable de IVA' },
    { id: 'rf2', codigo: 'O-48', nombre: 'Responsable de IVA' },
];

export let categorias: Categoria[] = [
    { id: 1, nombre: 'Tecnología', isreceta: 0, requiere_empaques: 1, estado: 1, imgruta: 'fa-laptop-code' },
    { id: 2, nombre: 'Mobiliario', isreceta: 0, requiere_empaques: 0, estado: 1, imgruta: 'fa-couch' },
    { id: 3, nombre: 'Consumibles', isreceta: 0, requiere_empaques: 1, estado: 1, imgruta: 'fa-paperclip' },
    { id: 4, nombre: 'Herramientas', isreceta: 0, requiere_empaques: 0, estado: 0, imgruta: 'fa-tools' }, // Inactive category
];

// --- EMPRESA, USUARIOS Y VENDEDORES (Para autenticación) ---

export const empresas: Empresa[] = [
    { id: 5, razonSocial: 'MULTIACABADOS S.A.S.', nit: '802024306-1', direccion: 'Avenida Siempre Viva 123', ciudad: 'Bogotá D.C.', telefono: '601-555-1234' },
    { id: 6, razonSocial: 'ORQUIDEA IA SOLUTIONS S.A.S', nit: '901994818-0', direccion: 'Calle 123 # 45-67', ciudad: 'Medellín', telefono: '604-555-5678' },
];

export const sedes: Sede[] = [
    { id: 101, nombre: 'Sede Principal - Bogotá', codigo: 'BOG', empresaId: 1, municipioId: 11001 },
    { id: 102, nombre: 'Sede Medellín', codigo: 'MDE', empresaId: 1, municipioId: 5001 },
    { id: 201, nombre: 'Oficina Central', codigo: 'CEN', empresaId: 2, municipioId: 11001 },
];

export const usuarios: Omit<Usuario, 'empresas'>[] = [
    { id: 1, primerNombre: 'Ana', primerApellido: 'Gómez', email: 'admin@erp360.com', username: 'admin', rol: 'admin' },
    { id: 2, primerNombre: 'Carlos', primerApellido: 'Ruiz', email: 'vendedor@erp360.com', username: 'cruiz', rol: 'vendedor' },
    { id: 3, primerNombre: 'Sara', primerApellido: 'Lee', email: 'almacenista@erp360.com', username: 'slee', rol: 'almacenista' },
];

export const vendedores: Vendedor[] = [
    { id: 'ven1', numeroDocumento: '12345678', primerNombre: 'Carlos', primerApellido: 'Ruiz', codigoVendedor: 'V-001', empresaId: 1 },
    { id: 'ven2', numeroDocumento: '87654321', primerNombre: 'Laura', primerApellido: 'Jimenez', codigoVendedor: 'V-002', empresaId: 1 },
];


// --- DATOS TRANSACCIONALES ---
// Se han eliminado los arrays de clientes, productos, facturas, cotizaciones, etc.
// Estos datos ahora se obtendrán directamente de la base de datos a través del DataContext.


// --- LÓGICA DE MANIPULACIÓN DE DATOS (Simulación de Backend) ---
// Esta lógica ahora reside en el DataContext y se comunica con Supabase.
// Se eliminan las funciones crearCliente, actualizarCliente, etc., de este archivo.

export const motivosDevolucion: string[] = [
    'Producto defectuoso',
    'Producto incorrecto',
    'Dañado en transporte',
    'Exceso de inventario',
    'Cliente cancela pedido'
];

export const almacenes: { id: string; nombre: string; }[] = [
    { id: '001', nombre: 'BODEGA PRINCIPAL' },
    { id: '002', nombre: 'PUNTO DE VENTA 1' },
];
