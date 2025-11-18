const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const os = require('os');
const { executeQuery, executeQueryWithParams, testConnection } = require('./services/sqlServerClient.cjs');
const { QUERIES, TABLE_NAMES } = require('./services/dbConfig.cjs');
const { getConnection } = require('./services/sqlServerClient.cjs');
const sql = require('mssql');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const DIANService = require('./services/dian-service.cjs');
// puppeteer ahora se usa a través de PuppeteerService

// Cargar variables de entorno
dotenv.config();

// Funciones de mapeo de estados
const mapEstadoToDb = (estado) => {
  const estadoMap = {
    'BORRADOR': 'B',
    'ENVIADA': 'E',
    'APROBADA': 'A',
    'RECHAZADA': 'R',
    'VENCIDA': 'V',
    'CONFIRMADO': 'C',
    'EN_PROCESO': 'P',
    'PARCIALMENTE_REMITIDO': 'PR',
    'REMITIDO': 'M',
    'CANCELADO': 'X',
    'EN_TRANSITO': 'T',
    'ENTREGADO': 'D',
    'ACEPTADA': 'AC',
    'ANULADA': 'AN'
  };
  return estadoMap[estado] || estado;
};

const mapEstadoFromDb = (estado) => {
  if (!estado) return estado;
  const estadoStr = String(estado).trim().toUpperCase();
  const estadoMap = {
    'B': 'BORRADOR',
    'E': 'ENVIADA',
    'A': 'APROBADA',
    'R': 'RECHAZADA',
    'V': 'VENCIDA',
    'C': 'CONFIRMADO',
    'P': 'EN_PROCESO',
    'PR': 'PARCIALMENTE_REMITIDO',
    'M': 'REMITIDO',
    'X': 'CANCELADO',
    'T': 'EN_TRANSITO',
    'D': 'ENTREGADO',
    'AC': 'ACEPTADA',
    'AN': 'ANULADA'
  };
  return estadoMap[estadoStr] || estado;
};

const app = express();
const PORT = process.env.PORT || 3001;

// Función para obtener la IP local de la red (definida temprano para uso en rutas)
const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignorar direcciones internas (no IPv4) y localhost
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const getGeminiModel = () => {
  if (!GEMINI_API_KEY || !GEMINI_API_KEY.trim()) {
    throw new Error('GEMINI_API_KEY no configurada en el servidor');
  }
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.trim());
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
};

// Middleware
// CORS configurado para permitir solicitudes desde el frontend y otros dispositivos en la red
if (process.env.VERCEL) {
  // En Vercel, frontend y backend están en el mismo dominio, permitir todas las solicitudes
app.use(cors());
} else {
  // En desarrollo, permitir solicitudes desde cualquier origen (útil para acceso desde otros dispositivos)
  app.use(cors({
    origin: '*', // Permitir todas las solicitudes en desarrollo
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false, // No usar credentials cuando origin es '*'
    optionsSuccessStatus: 200 // Algunos navegadores antiguos requieren esto
  }));
}

// Manejar preflight requests (OPTIONS) explícitamente
// Express 5 no acepta '*' directamente, usamos un middleware que captura todas las rutas
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    return res.sendStatus(200);
  }
  next();
});

// Middleware para agregar headers CORS a todas las respuestas
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  next();
});

app.use(express.json({ limit: '5mb' }));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Importar servicios refactorizados
const PdfService = require('./services/pdf/PdfService');

app.post('/api/generar-pdf', async (req, res) => {
  const { html, fileName } = req.body || {};
  
  if (!html || typeof html !== 'string' || !html.trim()) {
    return res.status(400).json({ 
      success: false, 
      message: 'El contenido HTML es requerido.' 
    });
  }

  const pdfService = new PdfService();
  
  try {
    // Generar PDF usando el servicio refactorizado
    const pdfBuffer = await pdfService.generatePdf(html, {
      fileName,
      format: 'A4',
      margin: {
        top: '10mm',
        right: '12mm',
        bottom: '12mm',
        left: '12mm'
      }
    });

    // Preparar respuesta
    const safeName = typeof fileName === 'string' && fileName.trim()
      ? fileName.trim().replace(/[^\w.-]/g, '_')
      : 'documento.pdf';

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);

  } catch (error) {
    console.error('[PDF] Error generando PDF:', error);
    res.status(500).json({
      success: false,
      message: 'No se pudo generar el PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Ruta de prueba de conexión
app.get('/api/test-connection', async (req, res) => {
  try {
    const isConnected = await testConnection();
    res.json({ 
      success: isConnected, 
      message: isConnected ? 'Conexión exitosa' : 'Error de conexión',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Endpoint para proxy de Gemini
app.post('/api/ai/generate', async (req, res) => {
  try {
    const { type, payload = {} } = req.body || {};

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar el tipo de contenido a generar.'
      });
    }

    let prompt = '';

    switch (type) {
      case 'accountingNote': {
        const { totalDevolucion, subtotal, iva, costo, motivos } = payload;
        prompt = `Actúa como un contador experto. Basado en los siguientes datos de una devolución (nota de crédito), genera una nota explicativa concisa y profesional para el comprobante contable. Datos: Total Devolución: ${totalDevolucion}, Subtotal: ${subtotal}, IVA: ${iva}, Costo de Mercancía Reingresado: ${costo}. Motivos principales: ${motivos}. La nota debe ser breve, técnica y clara.`;
        break;
      }
      case 'returnEmail': {
        const { clienteNombre, facturaId, notaCreditoId, valorTotal } = payload;
        prompt = `Actúa como un asistente de servicio al cliente. Redacta un correo electrónico profesional y amable para un cliente llamado "${clienteNombre}". El propósito es notificarle que se ha procesado una nota de crédito a su favor (ID: ${notaCreditoId}) por un valor total de ${valorTotal}, correspondiente a una devolución de productos de la factura No. ${facturaId}. Menciona que este valor será aplicado a su saldo pendiente. El tono debe ser formal pero cercano. No incluyas un Asunto, solo el cuerpo del correo.`;
        break;
      }
      case 'custom': {
        if (!payload.prompt) {
          return res.status(400).json({
            success: false,
            message: 'Para el tipo custom debe proporcionar el campo prompt.'
          });
        }
        prompt = String(payload.prompt);
        break;
      }
      default:
        return res.status(400).json({
          success: false,
          message: `Tipo de generación desconocido: ${type}`
        });
    }

    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() || '';

    if (!text.trim()) {
      throw new Error('Respuesta vacía del modelo Gemini');
    }

    res.json({ success: true, data: { text } });
  } catch (error) {
    console.error('Error en proxy Gemini:', error);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Error generando contenido con Gemini',
    });
  }
});

// --- BUSQUEDAS (server-side, con límite y validación) - DEBEN IR ANTES DE RUTAS CON PARÁMETROS ---
const handleSearchClientes = async (req, res) => {
  try {
    const { search = '', limit = 20 } = req.query;
    if (String(search).trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Ingrese al menos 2 caracteres' });
    }
    const like = `%${search}%`;
    const query = `
      SELECT TOP (@limit)
        id,
        codter as numeroDocumento,
        nomter as razonSocial,
        apl1 as primerApellido,
        apl2 as segundoApellido,
        nom1 as primerNombre,
        nom2 as segundoNombre,
        dirter as direccion,
        TELTER as telefono,
        CELTER as celular,
        EMAIL as email,
        ciudad,
        codven as vendedorId
      FROM con_terceros
      WHERE activo = 1 AND (nomter LIKE @like OR codter LIKE @like OR nom1 LIKE @like OR apl1 LIKE @like)
      ORDER BY nomter`;
    const data = await executeQueryWithParams(query, { like, limit: Number(limit) });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error buscando clientes:', error);
    res.status(500).json({ success: false, message: 'Error en búsqueda de clientes', error: error.message });
  }
};
app.get('/api/buscar/clientes', handleSearchClientes);
// Ruta alternativa para compatibilidad
app.get('/api/clientes/search', handleSearchClientes);

app.get('/api/buscar/vendedores', async (req, res) => {
  try {
    const { search = '', limit = 20 } = req.query;
    if (String(search).trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Ingrese al menos 2 caracteres' });
    }
    const like = `%${search}%`;
    const likeUpper = `%${search.toUpperCase()}%`;
    // Usando la tabla ven_vendedor con las columnas REALES de la BD
    // Mapeo: ideven -> codi_emple, nomven -> nomb_emple, codven -> codi_labor
    // Búsqueda case-insensitive usando UPPER() para que funcione con mayúsculas y minúsculas
    const query = `
      SELECT TOP (@limit)
        CAST(ideven AS VARCHAR(20)) as id,
        codven as codigo,
        codven as codigoVendedor,
        LTRIM(RTRIM(nomven)) as nombreCompleto,
        LTRIM(RTRIM(nomven)) as primerNombre,
        '' as primerApellido,
        '' as segundoNombre,
        '' as segundoApellido,
        '' as email,
        CAST(ideven AS VARCHAR(20)) as cedula
      FROM ven_vendedor
      WHERE Activo = 1
        AND (UPPER(LTRIM(RTRIM(nomven))) LIKE @likeUpper OR codven LIKE @like OR CAST(ideven AS VARCHAR(20)) LIKE @like)
      ORDER BY nomven`;
    const data = await executeQueryWithParams(query, { likeUpper, like, limit: Number(limit) });
    
    // Procesar los datos para extraer primer nombre y apellido del nombre completo
    const processedData = data.map((item) => {
      const nombreCompleto = item.nombreCompleto || '';
      const partes = nombreCompleto.trim().split(/\s+/);
      return {
        ...item,
        primerNombre: partes[0] || '',
        primerApellido: partes.length > 1 ? partes.slice(1).join(' ') : '',
        nombreCompleto: nombreCompleto.trim()
      };
    });
    
    res.json({ success: true, data: processedData });
  } catch (error) {
    console.error('Error buscando vendedores:', error);
    console.error('Detalles del error:', {
      message: error.message,
      code: error.code,
      number: error.number,
      originalError: error.originalError
    });
    res.status(500).json({ success: false, message: 'Error en búsqueda de vendedores', error: error.message, details: error.originalError?.info || null });
  }
});

app.get('/api/buscar/productos', async (req, res) => {
  try {
    const { search = '', limit = 20 } = req.query;
    if (String(search).trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Ingrese al menos 2 caracteres' });
    }
    const like = `%${search}%`;
    // Usando caninv (cantidad de inventario) en lugar de ucoins para el stock
    const query = `
      SELECT TOP (@limit)
        ins.id,
        ins.nomins AS nombre,
        LTRIM(RTRIM(COALESCE(ins.referencia, ''))) AS referencia,
        ins.ultimo_costo AS ultimoCosto,
        COALESCE(SUM(inv.caninv), 0) AS stock,
        COALESCE(SUM(inv.valinv), 0) AS precioInventario,
        ins.undins AS unidadMedidaCodigo,
        m.nommed AS unidadMedidaNombre,
        ins.tasa_iva AS tasaIva
      FROM inv_insumos ins
      LEFT JOIN inv_invent inv ON inv.codins = ins.codins
      LEFT JOIN inv_medidas m ON m.codmed = ins.Codigo_Medida
      WHERE ins.activo = 1 AND (ins.nomins LIKE @like OR ins.referencia LIKE @like)
      GROUP BY ins.id, ins.nomins, ins.referencia, ins.ultimo_costo, ins.undins, m.nommed, ins.tasa_iva
      ORDER BY ins.nomins`;
    const data = await executeQueryWithParams(query, { like, limit: Number(limit) });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error buscando productos:', error);
    res.status(500).json({ success: false, message: 'Error en búsqueda de productos', error: error.message });
  }
});

// Ruta para obtener clientes
app.get('/api/clientes', async (req, res) => {
  try {
    const clientes = await executeQuery(QUERIES.GET_CLIENTES);
    res.json({ success: true, data: clientes });
  } catch (error) {
    console.error('Error fetching clientes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo clientes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Obtener cliente por id (incluye lista de precios)
app.get('/api/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 [Backend] Buscando cliente con ID:', id);
    
    // Determinar si es un ID numérico o un codter (string)
    const idNum = parseInt(id, 10);
    const isNumeric = !isNaN(idNum) && String(idNum) === String(id).trim();
    
    let query, params;
    if (isNumeric) {
      // Buscar por ID numérico
      query = `
        SELECT 
          id,
          codter as numeroDocumento,
          nomter as razonSocial,
          apl1 as primerApellido,
          apl2 as segundoApellido,
          nom1 as primerNombre,
          nom2 as segundoNombre,
          EMAIL as email,
          dirter as direccion,
          TELTER as telefono,
          CELTER as celular,
          ciudad,
          ciudad as ciudadId,
          ciudad as ciudadIdCodigo,
          codven as vendedorId,
          COALESCE(cupo_credito, 0) as limiteCredito,
          COALESCE(plazo, 0) as diasCredito,
          COALESCE(tasa_descuento, 0) as tasaDescuento,
          Forma_pago as formaPago,
          regimen_tributario as regimenTributario,
          CAST(activo AS INT) as activo,
          contacto,
          FECING as fechaIngreso
        FROM con_terceros
        WHERE id = @id AND activo = 1`;
      params = { id: idNum };
    } else {
      // Buscar por codter (número de documento)
      query = `
        SELECT 
          id,
          codter as numeroDocumento,
          nomter as razonSocial,
          apl1 as primerApellido,
          apl2 as segundoApellido,
          nom1 as primerNombre,
          nom2 as segundoNombre,
          EMAIL as email,
          dirter as direccion,
          TELTER as telefono,
          CELTER as celular,
          ciudad,
          ciudad as ciudadId,
          ciudad as ciudadIdCodigo,
          codven as vendedorId,
          COALESCE(cupo_credito, 0) as limiteCredito,
          COALESCE(plazo, 0) as diasCredito,
          COALESCE(tasa_descuento, 0) as tasaDescuento,
          Forma_pago as formaPago,
          regimen_tributario as regimenTributario,
          CAST(activo AS INT) as activo,
          contacto,
          FECING as fechaIngreso
        FROM con_terceros
        WHERE codter = @codter AND activo = 1`;
      params = { codter: String(id).trim() };
    }
    
    const data = await executeQueryWithParams(query, params);
    console.log('🔍 [Backend] Cliente encontrado:', data.length > 0 ? 'Sí' : 'No');
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success:false, message:'Cliente no encontrado' });
    }
    
    // Si hay múltiples resultados, tomar el primero (debería haber solo uno)
    const cliente = data[0];
    
    // Construir nombre completo si no existe
    if (!cliente.nombreCompleto) {
      if (cliente.razonSocial) {
        cliente.nombreCompleto = cliente.razonSocial;
      } else {
        const nombres = [cliente.primerNombre, cliente.segundoNombre].filter(Boolean).join(' ');
        const apellidos = [cliente.primerApellido, cliente.segundoApellido].filter(Boolean).join(' ');
        cliente.nombreCompleto = [nombres, apellidos].filter(Boolean).join(' ').trim() || cliente.razonSocial || 'Sin nombre';
      }
    }
    
    res.json({ success:true, data: cliente });
  } catch (error) {
    console.error('❌ [Backend] Error obteniendo cliente por id:', error);
    res.status(500).json({ success:false, message:'Error obteniendo cliente', error: error.message });
  }
});

// Ruta para obtener productos (filtrado por bodega si se proporciona)
app.get('/api/productos', async (req, res) => {
  try {
    const { codalm, page = '1', pageSize = '50', search } = req.query; // Parámetros de paginación y búsqueda
    const codalmFormatted = codalm ? String(codalm).padStart(3, '0') : null;
    
    // Convertir a números
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(10, parseInt(String(pageSize), 10) || 50)); // Máximo 100, mínimo 10
    const offset = (pageNum - 1) * pageSizeNum;
    
    // Normalizar parámetro de búsqueda (puede venir como string, array, o objeto)
    let searchTerm = null;
    if (search) {
      if (Array.isArray(search)) {
        searchTerm = String(search[0] || '').trim();
      } else if (typeof search === 'object') {
        // Si es un objeto, intentar extraer el valor
        searchTerm = String(Object.values(search)[0] || '').trim();
    } else {
        searchTerm = String(search).trim();
      }
      // Si después de convertir es "[object Object]", ignorarlo
      if (searchTerm === '[object Object]' || searchTerm === '') {
        searchTerm = null;
      }
    }
    
    // Construir query con paginación
    let query = QUERIES.GET_PRODUCTOS;
    
    // Agregar condición de búsqueda si existe
    if (searchTerm) {
      query = query.replace(
        'WHERE ins.activo = 1',
        `WHERE ins.activo = 1 AND (ins.nomins LIKE @search OR ins.referencia LIKE @search)`
      );
    }
    
    // Agregar paginación SQL Server (OFFSET/FETCH)
    query += ` OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`;
    
    // Parámetros para la query
    const params = {
      codalm: codalmFormatted,
      offset: offset,
      pageSize: pageSizeNum
    };
    
    if (searchTerm) {
      params.search = `%${searchTerm}%`;
    }
    
    // Query para contar total (sin paginación)
    let countQuery = `
      SELECT COUNT(DISTINCT ins.id) as total
      FROM ${TABLE_NAMES.productos} ins
      LEFT JOIN inv_invent inv ON inv.codins = ins.codins
        AND (@codalm IS NULL OR inv.codalm = @codalm)
      WHERE ins.activo = 1
    `;
    
    if (searchTerm) {
      countQuery = countQuery.replace(
        'WHERE ins.activo = 1',
        `WHERE ins.activo = 1 AND (ins.nomins LIKE @search OR ins.referencia LIKE @search)`
      );
    }
    
    const countParams = { codalm: codalmFormatted };
    if (searchTerm) {
      countParams.search = `%${searchTerm}%`;
    }
    
    // Ejecutar ambas queries en paralelo
    const [productos, countResult] = await Promise.all([
      executeQueryWithParams(query, params),
      executeQueryWithParams(countQuery, countParams)
    ]);
    
    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / pageSizeNum);
    
    console.log(`📦 [Productos] Página ${pageNum}/${totalPages}, Tamaño: ${pageSizeNum}, Total: ${total}${codalmFormatted ? `, Bodega: ${codalmFormatted}` : ''}${searchTerm ? `, Búsqueda: ${searchTerm}` : ''}`);
    
    res.json({ 
      success: true, 
      data: productos,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total: total,
        totalPages: totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Error fetching productos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo productos',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/inventario/entradas', async (req, res) => {
  const {
    productoId,
    cantidad,
    costoUnitario = 0,
    motivo = '',
    documentoReferencia = '',
    usuario = null,
    codalm
  } = req.body || {};

  try {
    if (!productoId) {
      return res.status(400).json({ success: false, message: 'productoId es obligatorio' });
    }

    const cantidadNumber = Number(cantidad);
    if (!Number.isFinite(cantidadNumber) || cantidadNumber <= 0) {
      return res.status(400).json({ success: false, message: 'La cantidad debe ser mayor a cero' });
    }

    const costoNumber = Number(costoUnitario || 0);
    if (!Number.isFinite(costoNumber) || costoNumber < 0) {
      return res.status(400).json({ success: false, message: 'El costo unitario no puede ser negativo' });
    }

    const codalmNormalized = codalm
      ? String(codalm).trim().padStart(3, '0')
      : '001';

    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const productoRequest = new sql.Request(transaction);
      productoRequest.input('productoId', sql.Int, parseInt(productoId, 10));
      const productoResult = await productoRequest.query(`
        SELECT TOP 1
          id,
          codins,
          nomins,
          undins,
          ultimo_costo AS ultimoCosto,
          costo_promedio AS costoPromedio
        FROM inv_insumos
        WHERE id = @productoId
      `);

      if (!productoResult.recordset || productoResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Producto no encontrado' });
      }

      const producto = productoResult.recordset[0];
      // codins es CHAR(8) en la BD, necesitamos formatearlo correctamente
      const codinsRaw = String(producto.codins || '').trim();
      const codinsFormatted = codinsRaw.substring(0, 8).padEnd(8, ' '); // Asegurar 8 caracteres

      if (!codinsRaw) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'El producto no tiene código de inventario (codins) asociado' });
      }

      const cantidadDecimal = parseFloat(cantidadNumber.toFixed(4));
      const costoDecimal = parseFloat(costoNumber.toFixed(4));
      const totalValor = parseFloat((cantidadDecimal * costoDecimal).toFixed(4));

      const inventarioSelectRequest = new sql.Request(transaction);
      inventarioSelectRequest.input('codins', sql.Char(8), codinsFormatted);
      inventarioSelectRequest.input('codalm', sql.Char(3), codalmNormalized);
      // Usando caninv (cantidad de inventario) en lugar de ucoins
      // La tabla inv_invent NO tiene columna id, usa codalm + codins como clave
      const inventarioResult = await inventarioSelectRequest.query(`
        SELECT TOP 1 caninv, valinv
        FROM inv_invent
        WHERE codins = @codins AND codalm = @codalm
      `);

      if (inventarioResult.recordset && inventarioResult.recordset.length > 0) {
        // El registro existe, actualizar caninv y valinv
        const inventarioUpdateRequest = new sql.Request(transaction);
        inventarioUpdateRequest.input('codins', sql.Char(8), codinsFormatted);
        inventarioUpdateRequest.input('codalm', sql.Char(3), codalmNormalized);
        inventarioUpdateRequest.input('cantidad', sql.Decimal(18, 4), cantidadDecimal);
        inventarioUpdateRequest.input('valor', sql.Decimal(18, 4), totalValor);
        // Actualizar caninv (cantidad de inventario) en lugar de ucoins
        // La tabla no tiene ultima_actualizacion, solo actualizamos caninv y valinv
        await inventarioUpdateRequest.query(`
          UPDATE inv_invent
          SET 
            caninv = COALESCE(caninv, 0) + @cantidad,
            valinv = COALESCE(valinv, 0) + @valor
          WHERE codins = @codins AND codalm = @codalm
        `);
      } else {
        // El registro no existe, insertar nuevo
        const inventarioInsertRequest = new sql.Request(transaction);
        inventarioInsertRequest.input('codins', sql.Char(8), codinsFormatted);
        inventarioInsertRequest.input('codalm', sql.Char(3), codalmNormalized);
        inventarioInsertRequest.input('cantidad', sql.Decimal(18, 4), cantidadDecimal);
        inventarioInsertRequest.input('valor', sql.Decimal(18, 4), totalValor);
        // Insertar con caninv (cantidad de inventario) en lugar de ucoins
        // La tabla no tiene ultima_actualizacion ni id
        await inventarioInsertRequest.query(`
          INSERT INTO inv_invent (codins, codalm, caninv, valinv)
          VALUES (@codins, @codalm, @cantidad, @valor)
        `);
      }

      if (costoDecimal > 0) {
        const costoUpdateRequest = new sql.Request(transaction);
        costoUpdateRequest.input('productoId', sql.Int, producto.id);
        costoUpdateRequest.input('costoUnitario', sql.Decimal(18, 4), costoDecimal);
        await costoUpdateRequest.query(`
          UPDATE inv_insumos
          SET 
            ultimo_costo = @costoUnitario,
            costo_promedio = CASE 
              WHEN costo_promedio IS NULL OR costo_promedio = 0 THEN @costoUnitario
              ELSE (COALESCE(costo_promedio, 0) + @costoUnitario) / 2.0
            END,
            fecsys = GETDATE()
          WHERE id = @productoId
        `);
      }

      const productoActualizadoRequest = new sql.Request(transaction);
      productoActualizadoRequest.input('productoId', sql.Int, producto.id);
      productoActualizadoRequest.input('codalm', sql.VarChar(3), codalmNormalized);
      // Usando caninv (cantidad de inventario) en lugar de ucoins para el stock
      const productoActualizadoResult = await productoActualizadoRequest.query(`
        SELECT 
          ins.id,
          ins.codins                 AS codigo,
          ins.nomins                 AS nombre,
          ins.codigo_linea           AS codigoLinea,
          ins.codigo_sublinea        AS codigoSublinea,
          ins.Codigo_Medida          AS idMedida,
          ins.undins                 AS unidadMedida,
          ins.tasa_iva               AS tasaIva,
          ins.ultimo_costo           AS ultimoCosto,
          ins.costo_promedio         AS costoPromedio,
          ins.referencia,
          ins.karins                 AS controlaExistencia,
          COALESCE(SUM(inv.caninv), 0) AS stock,
          COALESCE(SUM(inv.valinv), 0) AS precioInventario,
          ins.activo,
          ins.MARGEN_VENTA           AS margenVenta,
          ins.precio_publico         AS precioPublico,
          ins.precio_mayorista       AS precioMayorista,
          ins.precio_minorista       AS precioMinorista,
          ins.fecsys                 AS fechaCreacion
        FROM inv_insumos ins
        LEFT JOIN inv_invent inv ON inv.codins = ins.codins
          AND inv.codalm = @codalm
        WHERE ins.id = @productoId
        GROUP BY ins.id, ins.codins, ins.nomins, ins.codigo_linea, ins.codigo_sublinea, 
                 ins.Codigo_Medida, ins.undins, ins.tasa_iva, ins.ultimo_costo, 
                 ins.costo_promedio, ins.referencia, ins.karins, ins.activo, 
                 ins.MARGEN_VENTA, ins.precio_publico, ins.precio_mayorista, 
                 ins.precio_minorista, ins.fecsys
      `);

      const productoActualizado = productoActualizadoResult.recordset
        ? productoActualizadoResult.recordset[0]
        : null;

      await transaction.commit();

      res.json({
        success: true,
        data: {
          producto: productoActualizado || null,
          movimiento: {
            productoId: producto.id,
            codins,
            codalm: codalmNormalized,
            cantidad: cantidadDecimal,
            costoUnitario: costoDecimal,
            valorTotal: totalValor,
            motivo: String(motivo || '').trim(),
            documentoReferencia: String(documentoReferencia || '').trim(),
            usuario: usuario ? {
              id: usuario.id,
              nombre: usuario.nombre || usuario.username || `${usuario.primerNombre || ''} ${usuario.primerApellido || ''}`.trim(),
              rol: usuario.rol || null
            } : null,
            timestamp: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      console.error('❌ Error registrando entrada de inventario:', error);
      try {
        if (!transaction._aborted) {
          await transaction.rollback();
        }
      } catch (rollbackError) {
        console.error('❌ Error realizando rollback de inventario:', rollbackError);
      }
      res.status(500).json({
        success: false,
        message: 'Error registrando la entrada de inventario',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('❌ Error procesando entrada de inventario:', error);
    res.status(500).json({
      success: false,
      message: 'Error procesando la solicitud de inventario',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Ruta para obtener facturas
app.get('/api/facturas', async (req, res) => {
  try {
    const facturas = await executeQuery(QUERIES.GET_FACTURAS);
    const facturasMapeadas = facturas.map(f => ({
      ...f,
      estado: mapEstadoFromDb(f.estado)
    }));
    res.json({ success: true, data: facturasMapeadas });
  } catch (error) {
    console.error('❌ Error obteniendo facturas:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Detalles completos:', {
      message: error.message,
      code: error.code,
      number: error.number,
      originalError: error.originalError,
      sqlMessage: error.originalError?.info?.message
    });
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo facturas',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        sqlMessage: error.originalError?.info?.message,
        tableName: TABLE_NAMES.facturas
      } : undefined
    });
  }
});

// Ruta para obtener detalles de facturas
app.get('/api/facturas-detalle', async (req, res) => {
  try {
    const detalles = await executeQuery(QUERIES.GET_FACTURAS_DETALLE);
    res.json({ success: true, data: detalles });
  } catch (error) {
    console.error('❌ Error obteniendo detalles de facturas:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Detalles completos:', {
      message: error.message,
      code: error.code,
      number: error.number,
      originalError: error.originalError,
      sqlMessage: error.originalError?.info?.message
    });
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo detalles de facturas',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        sqlMessage: error.originalError?.info?.message,
        tableName: TABLE_NAMES.facturas_detalle
      } : undefined
    });
  }
});

// Ruta para obtener cotizaciones
app.get('/api/cotizaciones', async (req, res) => {
  try {
    const cotizaciones = await executeQuery(QUERIES.GET_COTIZACIONES);
    // Mapear estados de BD a frontend
    const cotizacionesMapeadas = cotizaciones.map(c => ({
      ...c,
      estado: mapEstadoFromDb(c.estado)
    }));
    res.json({ success: true, data: cotizacionesMapeadas });
  } catch (error) {
    console.error('Error fetching cotizaciones:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo cotizaciones',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Ruta para obtener detalles de cotizaciones
app.get('/api/cotizaciones-detalle', async (req, res) => {
  try {
    const detalles = await executeQuery(QUERIES.GET_COTIZACIONES_DETALLE);
    res.json({ success: true, data: detalles });
  } catch (error) {
    console.error('Error fetching cotizaciones detalle:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo detalles de cotizaciones',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Ruta para obtener pedidos
app.get('/api/pedidos', async (req, res) => {
  try {
    console.log('📦 [Backend] Obteniendo pedidos...');
    const { page, pageSize, search, estado, codter } = req.query;
    const pool = await getConnection();
    
    // Construir WHERE dinámicamente
    let whereClauses = [];
    if (estado) {
      const estadoMap = {
        'BORRADOR': 'B',
        'CONFIRMADO': 'C',
        'EN_PROCESO': 'P',
        'PARCIALMENTE_REMITIDO': 'P',
        'REMITIDO': 'R',
        'CANCELADO': 'X'
      };
      const estadoDb = estadoMap[estado] || estado;
      whereClauses.push(`p.estado = '${estadoDb}'`);
    }
    if (codter) {
      // Usar codter (estructura real)
      whereClauses.push(`LTRIM(RTRIM(p.codter)) = LTRIM(RTRIM('${codter}'))`);
    }
    if (search && search.trim() !== '' && search !== '[object Object]') {
      const searchTerm = search.trim().replace(/'/g, "''");
      whereClauses.push(`(
        p.numped LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(p.codter)) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(COALESCE(p.observa, ''))) LIKE '%${searchTerm}%'
      )`);
    }
    let where = whereClauses.length > 0 ? "WHERE " + whereClauses.join(' AND ') : "";
    
    // Paginación
    const pageNum = parseInt(page) || 1;
    const size = parseInt(pageSize) || 50;
    const offset = (pageNum - 1) * size;
    
    // Query para contar total de registros
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${TABLE_NAMES.pedidos} p
      ${where}
    `;
    const countResult = await executeQuery(countQuery);
    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / size);
    
    // Query principal con paginación - Usando estructura real de ven_pedidos
    // Columnas: id, numero_pedido, fecha_pedido, fecha_entrega_estimada, codter, codven, empresa_id, codtar, codusu, cotizacion_id, subtotal, descuento_valor, descuento_porcentaje, iva_valor, iva_porcentaje, impoconsumo_valor, total, observaciones, instrucciones_entrega, estado, fec_creacion, fec_modificacion
    const pedidosQuery = `
      SELECT 
        p.id,
        p.numero_pedido as numeroPedido,
        p.fecha_pedido as fechaPedido,
        LTRIM(RTRIM(COALESCE(p.codter, ''))) as clienteId,
        LTRIM(RTRIM(COALESCE(p.codven, ''))) as vendedorId,
        CAST(COALESCE(p.cotizacion_id, NULL) AS VARCHAR(50)) as cotizacionId,
        LTRIM(RTRIM(COALESCE(c.numcot, ''))) as numeroCotizacionOrigen,
        COALESCE(p.subtotal, 0) as subtotal,
        COALESCE(p.descuento_valor, 0) as descuentoValor,
        COALESCE(p.iva_valor, 0) as ivaValor,
        COALESCE(p.total, 0) as total,
        LTRIM(RTRIM(COALESCE(p.observaciones, ''))) as observaciones,
        p.estado,
        COALESCE(p.empresa_id, 1) as empresaId,
        p.fecha_entrega_estimada as fechaEntregaEstimada,
        NULL as listaPrecioId,
        COALESCE(p.descuento_porcentaje, 0) as descuentoPorcentaje,
        COALESCE(p.iva_porcentaje, 0) as ivaPorcentaje,
        COALESCE(p.impoconsumo_valor, 0) as impoconsumoValor,
        LTRIM(RTRIM(COALESCE(p.instrucciones_entrega, ''))) as instruccionesEntrega
      FROM ${TABLE_NAMES.pedidos} p
      LEFT JOIN ven_cotizacion c ON c.id = p.cotizacion_id
      ${where}
      ORDER BY p.fecha_pedido DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${size} ROWS ONLY
    `;
    
    // Obtener pedidos
    const pedidos = await executeQuery(pedidosQuery);
    console.log(`✅ [Backend] Pedidos encontrados: ${pedidos.length} de ${total} total (página ${pageNum}/${totalPages})`);
    
    // Sincronizar estados de pedidos basándose en remisiones existentes
    // Esto corrige pedidos que tienen remisiones pero siguen en estado CONFIRMADO
    // Verificar TODOS los pedidos que podrían tener remisiones (no solo CONFIRMADO)
    const pedidosParaSincronizar = pedidos.filter(p => {
      const estadoMapeado = mapEstadoFromDb(p.estado);
      // Sincronizar pedidos en estados que podrían necesitar actualización
      return estadoMapeado === 'CONFIRMADO' || 
             estadoMapeado === 'EN_PROCESO' || 
             estadoMapeado === 'PARCIALMENTE_REMITIDO' ||
             estadoMapeado === 'REMITIDO'; // También verificar REMITIDO por si acaso
    });
    
    if (pedidosParaSincronizar.length > 0) {
      console.log(`🔄 [Backend] Sincronizando estados de ${pedidosParaSincronizar.length} pedidos con posibles remisiones...`);
      
      for (const pedido of pedidosParaSincronizar) {
        try {
          const pedidoId = pedido.id;
          const estadoActual = mapEstadoFromDb(pedido.estado);
          
          // Verificar si tiene remisiones
          // ven_remiciones_enc usa pedido_id para relacionarse con pedidos
          const reqRemisiones = new sql.Request(pool);
          reqRemisiones.input('pedidoId', sql.Int, pedidoId);
          const remisionesResult = await reqRemisiones.query(`
            SELECT COUNT(*) as total
            FROM ${TABLE_NAMES.remisiones}
            WHERE pedido_id = @pedidoId
          `);
          
          const tieneRemisiones = remisionesResult.recordset[0].total > 0;
          
          if (tieneRemisiones) {
            let numeroPedidoStr = pedido.numeroPedido || pedido.numero_pedido || 'N/A';
            console.log(`🔍 [Backend] Verificando pedido ${numeroPedidoStr} (ID: ${pedidoId}, Estado actual: ${estadoActual})`);
            
            // Obtener items del pedido y remisiones
            // La BD real usa numped (CHAR(8)) en ven_detapedidos, necesitamos generar numped desde numero_pedido
            const reqItemsPedido = new sql.Request(pool);
            reqItemsPedido.input('pedidoId', sql.Int, pedidoId);
            // Obtener numero_pedido del pedido
            const pedidoNumResult = await reqItemsPedido.query(`
              SELECT numero_pedido
              FROM ven_pedidos
              WHERE id = @pedidoId
            `);
            const numeroPedido = pedidoNumResult.recordset[0]?.numero_pedido;
            
            // Generar numped desde numero_pedido (formato: PED-001 -> PED0001)
            let numpedPedido = null;
            if (numeroPedido) {
              const match = String(numeroPedido).match(/(\d+)/);
              if (match) {
                numpedPedido = 'PED' + match[1].padStart(5, '0');
              } else {
                numpedPedido = String(numeroPedido).replace(/-/g, '').substring(0, 8).padStart(8, '0');
              }
              numpedPedido = numpedPedido.substring(0, 8).padStart(8, '0');
            }
            
            // Obtener items usando numped (estructura real) o pedido_id (estructura alternativa)
            const reqItemsPedido2 = new sql.Request(pool);
            let itemsPedidoResult;
            if (numpedPedido) {
              reqItemsPedido2.input('numped', sql.Char(8), numpedPedido);
              const itemsQuery = `
                SELECT 
                  pd.codins,
                  (SELECT TOP 1 id FROM inv_insumos WHERE codins = pd.codins) as producto_id,
                  pd.canped as cantidad
                FROM ven_detapedidos pd
                WHERE pd.numped = @numped
              `;
              itemsPedidoResult = await reqItemsPedido2.query(itemsQuery);
            } else {
              // Fallback: intentar con pedido_id si existe
              reqItemsPedido2.input('pedidoId', sql.Int, pedidoId);
              itemsPedidoResult = await reqItemsPedido2.query(`
              SELECT 
                pd.codins,
                (SELECT TOP 1 id FROM inv_insumos WHERE codins = pd.codins) as producto_id,
                pd.canped as cantidad
              FROM ven_detapedidos pd
              WHERE pd.pedido_id = @pedidoId
            `);
            }
            
            if (itemsPedidoResult.recordset.length === 0) {
              console.log(`⚠️ [Backend] Pedido ${numeroPedidoStr} no tiene items, saltando sincronización`);
              continue;
            }
            
            const reqItemsRemitidos = new sql.Request(pool);
            reqItemsRemitidos.input('pedidoId', sql.Int, pedidoId);
            // Obtener items remitidos desde ven_remiciones_det usando cantidad_enviada
            const itemsRemitidosResult = await reqItemsRemitidos.query(`
              SELECT 
                rd.codins,
                (SELECT TOP 1 id FROM inv_insumos WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(rd.codins))) as producto_id,
                SUM(rd.cantidad_enviada) as cantidad_remitida
              FROM ${TABLE_NAMES.remisiones_detalle} rd
              INNER JOIN ${TABLE_NAMES.remisiones} r ON rd.remision_id = r.id
              WHERE r.pedido_id = @pedidoId
              GROUP BY rd.codins
            `);
            
            // Verificar si todos los items están completamente remitidos
            let todosRemitidos = true;
            let algunoRemitido = false;
            
            for (const itemPedido of itemsPedidoResult.recordset) {
              const itemRemitido = itemsRemitidosResult.recordset.find(
                ir => String(ir.codins || '').trim() === String(itemPedido.codins || '').trim()
              );
              const cantidadRemitida = itemRemitido ? parseFloat(itemRemitido.cantidad_remitida) : 0;
              const cantidadPedida = parseFloat(itemPedido.cantidad);
              
              if (cantidadRemitida > 0) {
                algunoRemitido = true;
              }
              // Usar comparación con tolerancia para evitar problemas de precisión decimal
              if (Math.abs(cantidadRemitida - cantidadPedida) > 0.01) {
                todosRemitidos = false;
              }
            }
            
            // Determinar nuevo estado
            let nuevoEstado = estadoActual;
            
            if (todosRemitidos && algunoRemitido) {
              nuevoEstado = 'REMITIDO';
              console.log(`📊 [Backend] Pedido ${numeroPedidoStr}: Todos los items remitidos (${itemsPedidoResult.recordset.length} items)`);
            } else if (algunoRemitido && !todosRemitidos) {
              nuevoEstado = 'PARCIALMENTE_REMITIDO';
              console.log(`📊 [Backend] Pedido ${numeroPedidoStr}: Remisión parcial`);
            } else if (estadoActual === 'CONFIRMADO' && algunoRemitido) {
              nuevoEstado = 'EN_PROCESO';
              console.log(`📊 [Backend] Pedido ${numeroPedidoStr}: Primera remisión`);
            }
            
            // Actualizar estado si cambió
            if (nuevoEstado !== estadoActual) {
              const reqUpdate = new sql.Request(pool);
              reqUpdate.input('pedidoId', sql.Int, pedidoId);
              reqUpdate.input('nuevoEstado', sql.VarChar(20), mapEstadoToDb(nuevoEstado));
              
              await reqUpdate.query(`
                UPDATE ven_pedidos
                SET estado = @nuevoEstado
                WHERE id = @pedidoId
              `);
              
              pedido.estado = mapEstadoToDb(nuevoEstado);
              console.log(`✅ [Backend] Estado del pedido ${numeroPedidoStr} sincronizado: ${estadoActual} -> ${nuevoEstado}`);
            } else {
              console.log(`ℹ️ [Backend] Pedido ${numeroPedidoStr}: Estado correcto (${estadoActual})`);
            }
          } else {
            // Si no tiene remisiones pero está en un estado de remisión, podría ser un error
            let numeroPedidoStr = pedido.numeroPedido || pedido.numero_pedido || 'N/A';
            if (estadoActual === 'REMITIDO' || estadoActual === 'PARCIALMENTE_REMITIDO' || estadoActual === 'EN_PROCESO') {
              console.log(`⚠️ [Backend] Pedido ${numeroPedidoStr} está en estado ${estadoActual} pero no tiene remisiones`);
            }
          }
        } catch (syncError) {
          console.error(`⚠️ [Backend] Error sincronizando pedido ${pedido.id}:`, syncError);
          console.error(`⚠️ [Backend] Stack trace:`, syncError.stack);
          // Continuar con el siguiente pedido
        }
      }
    }
    
    // Mapear estados para la respuesta
    const pedidosMapeados = pedidos.map(p => ({
      ...p,
      estado: mapEstadoFromDb(p.estado)
    }));
    console.log(`✅ [Backend] Pedidos mapeados: ${pedidosMapeados.length}`);
    res.json({ 
      success: true, 
      data: pedidosMapeados,
      pagination: {
        page: pageNum,
        pageSize: size,
        total: total,
        totalPages: totalPages
      }
    });
  } catch (error) {
    console.error('❌ [Backend] Error fetching pedidos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo pedidos',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Ruta para obtener detalles de pedidos
app.get('/api/pedidos-detalle', async (req, res) => {
  try {
    const detalles = await executeQuery(QUERIES.GET_PEDIDOS_DETALLE);
    res.json({ success: true, data: detalles });
  } catch (error) {
    console.error('Error fetching pedidos detalle:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo detalles de pedidos',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Ruta para obtener remisiones
app.get('/api/remisiones', async (req, res) => {
  try {
    console.log('📦 [Backend] Obteniendo remisiones desde ven_remiciones_enc...');
    const { codter, codalm, pedidoId, estado, page, pageSize, search } = req.query;
    
    // Construir WHERE dinámicamente
    let whereClauses = [];
    if (codter) whereClauses.push(`LTRIM(RTRIM(r.codter)) = LTRIM(RTRIM('${codter}'))`);
    if (codalm) whereClauses.push(`LTRIM(RTRIM(r.codalm)) = LTRIM(RTRIM('${codalm}'))`);
    if (pedidoId) {
      const pedidoIdNum = parseInt(pedidoId);
      if (isFinite(pedidoIdNum)) {
        whereClauses.push(`r.pedido_id = ${pedidoIdNum}`);
      }
    }
    if (estado) {
      // Mapear el estado del frontend a formato de BD antes de buscar
      const estadoDb = mapEstadoToDb(estado);
      whereClauses.push(`LTRIM(RTRIM(r.estado)) = LTRIM(RTRIM('${estadoDb}'))`);
    }
    
    // Búsqueda ampliada: número de remisión, cliente ID, cliente nombre, pedido origen, vendedor, estado, observaciones
    // Validar que tenga al menos 2 caracteres
    if (search && search.trim() !== '' && search !== '[object Object]' && search.trim().length >= 2) {
      const searchTerm = search.trim().replace(/'/g, "''"); // Escapar comillas simples
      whereClauses.push(`(
        LTRIM(RTRIM(r.numero_remision)) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(r.codter)) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(CAST(r.pedido_id AS VARCHAR))) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(r.estado)) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(r.observaciones)) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(COALESCE(c.nomter, ''))) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(COALESCE(c.nom1, ''))) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(COALESCE(c.nom2, ''))) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(COALESCE(c.apl1, ''))) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(COALESCE(c.apl2, ''))) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(COALESCE(v.nomven, ''))) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(COALESCE(CAST(v.ideven AS VARCHAR(20)), ''))) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(COALESCE(v.codven, ''))) LIKE '%${searchTerm}%'
      )`);
    }
    
    let where = whereClauses.length > 0 ? "WHERE " + whereClauses.join(' AND ') : "";
    
    // Paginación
    const pageNum = parseInt(page) || 1;
    const size = parseInt(pageSize) || 50;
    const offset = (pageNum - 1) * size;
    
    // Query para contar total de registros (con JOINs para búsqueda en cliente y vendedor)
    // NOTA: ven_vendedor usa ideven como ID, que se mapea a codi_emple. El JOIN debe usar ideven o codven
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${TABLE_NAMES.remisiones} r
      LEFT JOIN ${TABLE_NAMES.clientes} c ON LTRIM(RTRIM(r.codter)) = LTRIM(RTRIM(c.codter))
      LEFT JOIN ${TABLE_NAMES.vendedores} v ON (
        LTRIM(RTRIM(r.codven)) = LTRIM(RTRIM(CAST(v.ideven AS VARCHAR(20)))) OR
        LTRIM(RTRIM(r.codven)) = LTRIM(RTRIM(v.codven))
      )
      ${where}
    `;
    const countResult = await executeQuery(countQuery);
    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / size);
    
    // Query principal con paginación - Usando estructura de ven_remiciones_enc
    const sqlQuery = `
      SELECT 
        r.id,
        LTRIM(RTRIM(COALESCE(r.numero_remision, ''))) as numeroRemision,
        LTRIM(RTRIM(COALESCE(r.codalm, ''))) as codalm,
        CAST(r.fecha_remision AS DATE) as fechaRemision,
        CAST(COALESCE(r.pedido_id, NULL) AS INT) as pedidoId,
        LTRIM(RTRIM(COALESCE(r.codter, ''))) as clienteId,
        LTRIM(RTRIM(COALESCE(r.codven, ''))) as vendedorId,
        LTRIM(RTRIM(COALESCE(r.estado, 'BORRADOR'))) as estado,
        LTRIM(RTRIM(COALESCE(r.observaciones, ''))) as observaciones,
        LTRIM(RTRIM(COALESCE(r.codusu, ''))) as codUsuario,
        COALESCE(r.fec_creacion, GETDATE()) as fechaCreacion,
        -- Campos calculados/compatibilidad (no existen en la tabla pero se dejan como NULL)
        NULL as subtotal,
        NULL as descuentoValor,
        NULL as ivaValor,
        NULL as total,
        NULL as empresaId,
        NULL as facturaId,
        NULL as estadoEnvio,
        NULL as metodoEnvio,
        NULL as transportadoraId,
        NULL as transportadora,
        NULL as numeroGuia,
        NULL as fechaDespacho
      FROM ${TABLE_NAMES.remisiones} r
      LEFT JOIN ${TABLE_NAMES.clientes} c ON LTRIM(RTRIM(r.codter)) = LTRIM(RTRIM(c.codter))
      LEFT JOIN ${TABLE_NAMES.vendedores} v ON (
        LTRIM(RTRIM(r.codven)) = LTRIM(RTRIM(CAST(v.ideven AS VARCHAR(20)))) OR
        LTRIM(RTRIM(r.codven)) = LTRIM(RTRIM(v.codven))
      )
      ${where}
      ORDER BY r.fecha_remision DESC, r.id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${size} ROWS ONLY
    `;
    
    const remisiones = await executeQuery(sqlQuery);
    
    // Mapear estados de BD a frontend usando mapEstadoFromDb
    const remisionesMapeadas = remisiones.map(r => ({
      ...r,
      estado: mapEstadoFromDb(r.estado)
    }));
    
    console.log(`✅ [Backend] Remisiones encontradas: ${remisionesMapeadas.length} de ${total} total (página ${pageNum}/${totalPages})`);
    res.json({ 
      success: true, 
      data: remisionesMapeadas,
      pagination: {
        page: pageNum,
        pageSize: size,
        total: total,
        totalPages: totalPages
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo remisiones:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Detalles completos:', {
      message: error.message,
      code: error.code,
      number: error.number,
      originalError: error.originalError,
      sqlMessage: error.originalError?.info?.message,
      sqlNumber: error.originalError?.info?.number,
      sqlState: error.originalError?.info?.state,
      sqlClass: error.originalError?.info?.class
    });
    console.error('❌ Query que causó el error:', {
      countQuery,
      sqlQuery: sqlQuery?.substring(0, 500) + '...'
    });
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo remisiones',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' ? {
        sqlError: {
          message: error.originalError?.info?.message,
          number: error.originalError?.info?.number,
          state: error.originalError?.info?.state,
          class: error.originalError?.info?.class
        },
        details: {
          sqlMessage: error.originalError?.info?.message,
          tableName: TABLE_NAMES.remisiones
        }
      } : {})
    });
  }
});

// Detalle de items de una remisión específica (ven_remiciones_det)
app.get('/api/remisiones/:id/detalle', async (req, res) => {
  try {
    const { id } = req.params;
    const remisionIdNum = parseInt(id);
    if (!isFinite(remisionIdNum) || remisionIdNum < 1) {
      return res.status(400).json({ success: false, message: 'ID de remisión inválido' });
    }
    
    const sqlQuery = `
      SELECT
        rd.id,
        CAST(COALESCE(rd.remision_id, 0) AS INT) as remisionId,
        CAST(COALESCE(rd.deta_pedido_id, NULL) AS INT) as detaPedidoId,
        LTRIM(RTRIM(COALESCE(rd.codins, ''))) as codProducto,
        -- Obtener el ID del producto desde inv_insumos usando codins
        COALESCE(
          (SELECT TOP 1 id FROM inv_insumos WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(rd.codins))),
          NULL
        ) as productoId,
        -- Obtener descripción del producto
        COALESCE(
          (SELECT TOP 1 LTRIM(RTRIM(COALESCE(nomins, ''))) FROM inv_insumos WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(rd.codins))),
          LTRIM(RTRIM(COALESCE(rd.codins, '')))
        ) as descripcion,
        COALESCE(rd.cantidad_enviada, 0) as cantidadEnviada,
        COALESCE(rd.cantidad_facturada, 0) as cantidadFacturada,
        COALESCE(rd.cantidad_devuelta, 0) as cantidadDevuelta,
        -- Campos calculados/compatibilidad
        COALESCE(rd.cantidad_enviada, 0) as cantidad,
        NULL as precioUnitario,
        NULL as descuentoPorcentaje,
        NULL as ivaPorcentaje,
        NULL as subtotal,
        NULL as valorIva,
        NULL as total
      FROM ${TABLE_NAMES.remisiones_detalle} rd
      WHERE rd.remision_id = ${remisionIdNum}
    `;
    const data = await executeQuery(sqlQuery);
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Error obteniendo detalle de remisión:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para obtener items de productos de todas las remisiones (desde ven_remiciones_det)
app.get('/api/remisiones-detalle', async (req, res) => {
  try {
    console.log('📦 [Backend] Obteniendo detalles de remisiones (items de productos)...');
    
    // Obtener todos los items de remisiones desde ven_remiciones_det
    const sqlQuery = `
        SELECT 
        rd.id,
        CAST(COALESCE(rd.remision_id, 0) AS INT) as remisionId,
        CAST(COALESCE(rd.deta_pedido_id, NULL) AS INT) as detaPedidoId,
        LTRIM(RTRIM(COALESCE(rd.codins, ''))) as codProducto,
        -- Obtener el ID del producto desde inv_insumos usando codins
        COALESCE(
          (SELECT TOP 1 id FROM inv_insumos WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(rd.codins))),
          NULL
        ) as productoId,
          -- Obtener descripción del producto
        COALESCE(
          (SELECT TOP 1 LTRIM(RTRIM(COALESCE(nomins, ''))) FROM inv_insumos WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(rd.codins))),
          LTRIM(RTRIM(COALESCE(rd.codins, '')))
        ) as descripcion,
        COALESCE(rd.cantidad_enviada, 0) as cantidadEnviada,
        COALESCE(rd.cantidad_facturada, 0) as cantidadFacturada,
        COALESCE(rd.cantidad_devuelta, 0) as cantidadDevuelta,
        -- Campos calculados/compatibilidad
        COALESCE(rd.cantidad_enviada, 0) as cantidad,
        NULL as precioUnitario,
        NULL as descuentoPorcentaje,
        NULL as ivaPorcentaje,
        NULL as subtotal,
        NULL as valorIva,
        NULL as total
      FROM ${TABLE_NAMES.remisiones_detalle} rd
      WHERE rd.remision_id IS NOT NULL
      ORDER BY rd.remision_id, rd.id
    `;
    
    const items = await executeQuery(sqlQuery);
    
    console.log(`✅ [Backend] Items de remisiones encontrados: ${items.length}`);
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('❌ Error obteniendo detalles de remisiones:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const mapNotaCreditoHeader = (row) => ({
  id: row.id,
  numero: row.numero,
  facturaId: row.facturaId,
  clienteId: row.clienteId,
  fechaEmision: row.fechaEmision,
  subtotal: Number(row.subtotal) || 0,
  iva: Number(row.iva) || 0,
  total: Number(row.total) || 0,
  motivo: row.motivo,
  estadoDian: row.estadoDian,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

const mapNotaCreditoDetalle = (row) => ({
  id: row.id,
  productoId: row.productoId,
  cantidad: Number(row.cantidad) || 0,
  precioUnitario: Number(row.precioUnitario) || 0,
  descuentoPorcentaje: Number(row.descuentoPorcentaje) || 0,
  ivaPorcentaje: Number(row.ivaPorcentaje) || 0,
  subtotal: Number(row.subtotal) || 0,
  valorIva: Number(row.valorIva) || 0,
  total: Number(row.total) || 0,
  createdAt: row.createdAt
});

const fetchNotaCreditoById = async (connection, notaId, transaction = null) => {
  const runner = transaction ? new sql.Request(transaction) : connection.request();
  runner.input('notaId', sql.Int, notaId);
  const notaResult = await runner.query(`
    SELECT 
      id,
      numero,
      factura_id AS facturaId,
      cliente_id AS clienteId,
      fecha_emision AS fechaEmision,
      subtotal,
      iva,
      total,
      motivo,
      estado_dian AS estadoDian,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM ven_notas
    WHERE id = @notaId
  `);

  if (notaResult.recordset.length === 0) {
    return null;
  }

  const detalleRunner = transaction ? new sql.Request(transaction) : connection.request();
  detalleRunner.input('notaId', sql.Int, notaId);
  const detalleResult = await detalleRunner.query(`
    SELECT 
      id,
      nota_id AS notaId,
      producto_id AS productoId,
      cantidad,
      precio_unitario AS precioUnitario,
      descuento_porcentaje AS descuentoPorcentaje,
      iva_porcentaje AS ivaPorcentaje,
      subtotal,
      valor_iva AS valorIva,
      total,
      created_at AS createdAt
    FROM ven_detanotas
    WHERE nota_id = @notaId
    ORDER BY id ASC
  `);

  return {
    ...mapNotaCreditoHeader(notaResult.recordset[0]),
    itemsDevueltos: (detalleResult.recordset || []).map(mapNotaCreditoDetalle)
  };
};

// Ruta para obtener notas de crédito
app.get('/api/notas-credito', async (req, res) => {
  try {
    const pool = await getConnection();
    const request = pool.request();
    const notasResult = await request.query(`
      SELECT 
        id,
        numero,
        factura_id AS facturaId,
        cliente_id AS clienteId,
        fecha_emision AS fechaEmision,
        subtotal,
        iva,
        total,
        motivo,
        estado_dian AS estadoDian,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM ${TABLE_NAMES.notas_credito}
      ORDER BY fecha_emision DESC, id DESC
    `);

    const notas = notasResult.recordset || [];
    let detalleMap = new Map();

    if (notas.length > 0) {
      const idsList = notas.map((nota) => nota.id).join(',');
      const detallesQuery = `
        SELECT 
          id,
          nota_id AS notaId,
          producto_id AS productoId,
          cantidad,
          precio_unitario AS precioUnitario,
          descuento_porcentaje AS descuentoPorcentaje,
          iva_porcentaje AS ivaPorcentaje,
          subtotal,
          valor_iva AS valorIva,
          total,
          created_at AS createdAt
        FROM ven_detanotas
        ${idsList ? `WHERE nota_id IN (${idsList})` : ''}
        ORDER BY id ASC
      `;
      const detallesResult = await pool.request().query(detallesQuery);
      detalleMap = (detallesResult.recordset || []).reduce((acc, detalle) => {
        const key = detalle.notaId;
        if (!acc.has(key)) {
          acc.set(key, []);
        }
        acc.get(key).push(mapNotaCreditoDetalle(detalle));
        return acc;
      }, new Map());
    }

    const data = notas.map((nota) => ({
      ...mapNotaCreditoHeader(nota),
      itemsDevueltos: detalleMap.get(nota.id) || []
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Error obteniendo notas de crédito:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Detalles completos:', {
      message: error.message,
      code: error.code,
      number: error.number,
      originalError: error.originalError,
      sqlMessage: error.originalError?.info?.message
    });
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo notas de crédito',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        sqlMessage: error.originalError?.info?.message,
        tableName: TABLE_NAMES.notas_credito
      } : undefined
    });
  }
});

const generateNumeroNotaCredito = async (transaction) => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const baseNumero = `NC-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;

  const req = new sql.Request(transaction);
  req.input('numero', sql.VarChar(50), baseNumero);
  const existing = await req.query(`
    SELECT id 
    FROM ven_notas 
    WHERE numero = @numero
  `);

  if (existing.recordset.length === 0) {
    return baseNumero;
  }

  return `${baseNumero}-${Math.floor(Math.random() * 9000) + 1000}`;
};

const sanitizeNumber = (value, precision = 2) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(value.toFixed(precision));
  }
  const parsed = parseFloat(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Number(parsed.toFixed(precision));
};

const toPositiveNumber = (value, precision = 2) => {
  const num = sanitizeNumber(value, precision);
  return num < 0 ? 0 : num;
};

const buildNotaDetallePayload = (item) => {
  const productoIdNum = typeof item.productoId === 'number'
    ? item.productoId
    : parseInt(String(item.productoId).trim(), 10);

  if (!Number.isFinite(productoIdNum)) {
    throw new Error(`Producto inválido: ${item.productoId}`);
  }

  const cantidad = toPositiveNumber(item.cantidad, 4);
  const precioUnitario = toPositiveNumber(item.precioUnitario, 4);
  const descuentoPorcentaje = toPositiveNumber(item.descuentoPorcentaje, 4);
  const ivaPorcentaje = toPositiveNumber(item.ivaPorcentaje, 4);

  const base = Number((precioUnitario * cantidad).toFixed(4));
  const descuentoValor = Number((base * (descuentoPorcentaje / 100)).toFixed(4));
  const subtotal = Number((base - descuentoValor).toFixed(4));
  const valorIva = Number((subtotal * (ivaPorcentaje / 100)).toFixed(4));
  const total = Number((subtotal + valorIva).toFixed(4));

  if (cantidad <= 0) {
    throw new Error(`La cantidad debe ser mayor que cero para el producto ${productoIdNum}`);
  }

  return {
    productoId: productoIdNum,
    cantidad,
    precioUnitario,
    descuentoPorcentaje,
    ivaPorcentaje,
    subtotal: Number(subtotal.toFixed(2)),
    valorIva: Number(valorIva.toFixed(2)),
    total: Number(total.toFixed(2))
  };
};

const TOLERANCIA_CANTIDADES = 0.0001;

const determinarEstadoDevolucion = (detalleFactura, devolucionesPrevias, devolucionesActuales) => {
  let hayDevolucion = false;
  let esTotal = true;

  detalleFactura.forEach(({ key, cantidad: cantidadFactura }) => {
    const cantidadDevuelta = (devolucionesPrevias.get(key) || 0) + (devolucionesActuales.get(key) || 0);
    if (cantidadDevuelta > TOLERANCIA_CANTIDADES) {
      hayDevolucion = true;
    }
    if (Math.abs(cantidadDevuelta - cantidadFactura) > TOLERANCIA_CANTIDADES) {
      esTotal = false;
    }
  });

  if (!hayDevolucion) {
    return null;
  }

  return esTotal ? 'DEVOLUCION_TOTAL' : 'DEVOLUCION_PARCIAL';
};

// Crear nota de crédito (devolución)
app.post('/api/notas-credito', async (req, res) => {
  console.log('📥 Recibida solicitud POST /api/notas-credito');
  const body = req.body || {};

  try {
    const {
      facturaId,
      clienteId,
      motivo,
      items = [],
      fechaEmision,
      numero,
      estadoDian
    } = body;

    if (!facturaId) {
      return res.status(400).json({
        success: false,
        message: 'facturaId es obligatorio para registrar una nota de crédito'
      });
    }

    if (!motivo || !String(motivo).trim()) {
      return res.status(400).json({
        success: false,
        message: 'motivo es obligatorio para registrar una nota de crédito'
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe incluir al menos un item devuelto'
      });
    }

    const pool = await getConnection();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const facturaRequest = new sql.Request(tx);
      let factura;
      const facturaIdNum = typeof facturaId === 'number' ? facturaId : parseInt(String(facturaId).trim(), 10);

      if (!Number.isNaN(facturaIdNum)) {
        facturaRequest.input('facturaId', sql.Int, facturaIdNum);
        const facturaResult = await facturaRequest.query(`
          SELECT 
            id,
            numero_factura AS numeroFactura,
            cliente_id AS clienteId,
            subtotal,
            total
          FROM ven_facturas
          WHERE id = @facturaId
        `);

        if (facturaResult.recordset.length === 0) {
          await tx.rollback();
          return res.status(404).json({
            success: false,
            message: `Factura con ID ${facturaId} no encontrada`
          });
        }
        factura = facturaResult.recordset[0];
      } else {
        const facturaNumero = String(facturaId).trim();
        if (!facturaNumero) {
          await tx.rollback();
          return res.status(400).json({
            success: false,
            message: 'facturaId inválido. Debe ser un número de ID o el número de factura'
          });
        }

        const facturaNumeroRequest = new sql.Request(tx);
        facturaNumeroRequest.input('numeroFactura', sql.VarChar(50), facturaNumero);
        const facturaResult = await facturaNumeroRequest.query(`
          SELECT 
            id,
            numero_factura AS numeroFactura,
            cliente_id AS clienteId,
            subtotal,
            total
          FROM ven_facturas
          WHERE numero_factura = @numeroFactura
        `);

        if (facturaResult.recordset.length === 0) {
          await tx.rollback();
          return res.status(404).json({
            success: false,
            message: `Factura con número ${facturaNumero} no encontrada`
          });
        }
        factura = facturaResult.recordset[0];
      }

      const clienteFacturaId = String(factura.clienteId || '').trim();
      const clienteFinal = clienteFacturaId || String(clienteId || '').trim();

      if (!clienteFinal) {
        await tx.rollback();
        return res.status(400).json({
          success: false,
          message: 'No se pudo determinar el cliente asociado a la nota de crédito'
        });
      }

      if (clienteId && String(clienteId).trim() && clienteFacturaId && clienteFacturaId !== String(clienteId).trim()) {
        await tx.rollback();
        return res.status(400).json({
          success: false,
          message: `El cliente proporcionado (${clienteId}) no coincide con el cliente de la factura (${clienteFacturaId})`
        });
      }

      const detalleFacturaRequest = new sql.Request(tx);
      detalleFacturaRequest.input('facturaId', sql.Int, factura.id);
      const detalleFacturaResult = await detalleFacturaRequest.query(`
        SELECT 
          producto_id AS productoId,
          cantidad
        FROM ven_detafact
        WHERE factura_id = @facturaId
      `);

      if (detalleFacturaResult.recordset.length === 0) {
        await tx.rollback();
        return res.status(400).json({
          success: false,
          message: 'La factura seleccionada no tiene detalles registrados'
        });
      }

      const detalleFactura = detalleFacturaResult.recordset.map((row) => ({
        key: String(row.productoId).trim().toLowerCase(),
        cantidad: Number(row.cantidad) || 0
      }));

      const devolucionesPreviasRequest = new sql.Request(tx);
      devolucionesPreviasRequest.input('facturaId', sql.Int, factura.id);
      const devolucionesPreviasResult = await devolucionesPreviasRequest.query(`
        SELECT 
          dn.producto_id AS productoId,
          dn.cantidad
        FROM ven_detanotas dn
        INNER JOIN ven_notas n ON n.id = dn.nota_id
        WHERE n.factura_id = @facturaId
      `);

      const devolucionesPrevias = (devolucionesPreviasResult.recordset || []).reduce((acc, row) => {
        const key = String(row.productoId).trim().toLowerCase();
        const cantidad = Number(row.cantidad) || 0;
        acc.set(key, (acc.get(key) || 0) + cantidad);
        return acc;
      }, new Map());

      const productosCache = new Map();
      const devolucionesActuales = new Map();

      const detallesNormalizados = [];

      for (const rawItem of items) {
        const normalizado = buildNotaDetallePayload(rawItem);

        if (!productosCache.has(normalizado.productoId)) {
          const reqProducto = new sql.Request(tx);
          reqProducto.input('productoId', sql.Int, normalizado.productoId);
          const productoResult = await reqProducto.query(`
            SELECT TOP 1 id, codins 
            FROM inv_insumos
            WHERE id = @productoId
          `);

          if (productoResult.recordset.length === 0) {
            await tx.rollback();
            return res.status(400).json({
              success: false,
              message: `Producto con ID ${normalizado.productoId} no existe en inv_insumos`
            });
          }

          productosCache.set(normalizado.productoId, {
            id: productoResult.recordset[0].id,
            codins: productoResult.recordset[0].codins ? String(productoResult.recordset[0].codins).trim().toLowerCase() : null
          });
        }

        const productoInfo = productosCache.get(normalizado.productoId);
        const posiblesKeys = [
          String(normalizado.productoId).trim().toLowerCase()
        ];

        if (productoInfo.codins) {
          posiblesKeys.push(productoInfo.codins);
        }

        const detalleFacturaMatch = detalleFactura.find((detalle) => posiblesKeys.includes(detalle.key));

        if (!detalleFacturaMatch) {
          await tx.rollback();
          return res.status(400).json({
            success: false,
            message: `El producto ${normalizado.productoId} no pertenece a la factura seleccionada`
          });
        }

        const cantidadFactura = detalleFacturaMatch.cantidad || 0;
        const keyDetalle = detalleFacturaMatch.key;
        const cantidadDevueltaAnterior = devolucionesPrevias.get(keyDetalle) || 0;
        const cantidadDevueltaActual = devolucionesActuales.get(keyDetalle) || 0;
        const cantidadNuevaTotal = cantidadDevueltaAnterior + cantidadDevueltaActual + normalizado.cantidad;

        if (cantidadNuevaTotal - cantidadFactura > TOLERANCIA_CANTIDADES) {
          await tx.rollback();
          return res.status(400).json({
            success: false,
            message: `La cantidad devuelta para el producto ${normalizado.productoId} excede la cantidad facturada. Cantidad factura: ${cantidadFactura}, devuelta previamente: ${cantidadDevueltaAnterior}, nueva devolución: ${normalizado.cantidad}`
          });
        }

        devolucionesActuales.set(keyDetalle, cantidadDevueltaActual + normalizado.cantidad);
        detallesNormalizados.push({ ...normalizado, matchKey: keyDetalle });
      }

      const subtotalTotal = detallesNormalizados.reduce((acc, item) => acc + item.subtotal, 0);
      const ivaTotal = detallesNormalizados.reduce((acc, item) => acc + item.valorIva, 0);
      const totalTotal = detallesNormalizados.reduce((acc, item) => acc + item.total, 0);

      const fechaNota = fechaEmision ? new Date(fechaEmision) : new Date();
      if (Number.isNaN(fechaNota.getTime())) {
        await tx.rollback();
        return res.status(400).json({
          success: false,
          message: 'fechaEmision inválida'
        });
      }

      let numeroNota = String(numero || '').trim();
      if (!numeroNota) {
        numeroNota = await generateNumeroNotaCredito(tx);
      } else {
        const numeroReq = new sql.Request(tx);
        numeroReq.input('numero', sql.VarChar(50), numeroNota);
        const numeroResult = await numeroReq.query(`
          SELECT id FROM ven_notas WHERE numero = @numero
        `);

        if (numeroResult.recordset.length > 0) {
          await tx.rollback();
          return res.status(409).json({
            success: false,
            message: `Ya existe una nota de crédito con el número ${numeroNota}`
          });
        }
      }

      const insertNotaRequest = new sql.Request(tx);
      insertNotaRequest.input('numero', sql.VarChar(50), numeroNota);
      insertNotaRequest.input('facturaId', sql.Int, factura.id);
      insertNotaRequest.input('clienteId', sql.VarChar(20), clienteFinal);
      insertNotaRequest.input('fechaEmision', sql.Date, fechaNota);
      insertNotaRequest.input('motivo', sql.Text, String(motivo).trim());
      insertNotaRequest.input('subtotal', sql.Decimal(18, 2), Number(subtotalTotal.toFixed(2)));
      insertNotaRequest.input('iva', sql.Decimal(18, 2), Number(ivaTotal.toFixed(2)));
      insertNotaRequest.input('total', sql.Decimal(18, 2), Number(totalTotal.toFixed(2)));
      insertNotaRequest.input('estadoDian', sql.VarChar(20), String(estadoDian || 'PENDIENTE').trim());

      const insertNotaResult = await insertNotaRequest.query(`
        INSERT INTO ven_notas (
          numero,
          factura_id,
          cliente_id,
          fecha_emision,
          motivo,
          subtotal,
          iva,
          total,
          estado_dian
        )
        OUTPUT INSERTED.id
        VALUES (
          @numero,
          @facturaId,
          @clienteId,
          @fechaEmision,
          @motivo,
          @subtotal,
          @iva,
          @total,
          @estadoDian
        );
      `);

      const nuevaNotaId = insertNotaResult.recordset[0]?.id;

      if (!nuevaNotaId) {
        await tx.rollback();
        return res.status(500).json({
          success: false,
          message: 'No se pudo registrar la nota de crédito'
        });
      }

      for (const detalle of detallesNormalizados) {
        const insertDetalleRequest = new sql.Request(tx);
        insertDetalleRequest.input('notaId', sql.Int, nuevaNotaId);
        insertDetalleRequest.input('productoId', sql.Int, detalle.productoId);
        insertDetalleRequest.input('cantidad', sql.Decimal(18, 4), detalle.cantidad);
        insertDetalleRequest.input('precioUnitario', sql.Decimal(18, 4), detalle.precioUnitario);
        insertDetalleRequest.input('descuentoPorcentaje', sql.Decimal(18, 4), detalle.descuentoPorcentaje);
        insertDetalleRequest.input('ivaPorcentaje', sql.Decimal(18, 4), detalle.ivaPorcentaje);
        insertDetalleRequest.input('subtotal', sql.Decimal(18, 2), detalle.subtotal);
        insertDetalleRequest.input('valorIva', sql.Decimal(18, 2), detalle.valorIva);
        insertDetalleRequest.input('total', sql.Decimal(18, 2), detalle.total);

        await insertDetalleRequest.query(`
          INSERT INTO ven_detanotas (
            nota_id,
            producto_id,
            cantidad,
            precio_unitario,
            descuento_porcentaje,
            iva_porcentaje,
            subtotal,
            valor_iva,
            total
          )
          VALUES (
            @notaId,
            @productoId,
            @cantidad,
            @precioUnitario,
            @descuentoPorcentaje,
            @ivaPorcentaje,
            @subtotal,
            @valorIva,
            @total
          );
        `);
      }

      const estadoDevolucion = determinarEstadoDevolucion(detalleFactura, devolucionesPrevias, devolucionesActuales);

      if (estadoDevolucion) {
        const updateFacturaRequest = new sql.Request(tx);
        updateFacturaRequest.input('estadoDevolucion', sql.VarChar(20), estadoDevolucion);
        updateFacturaRequest.input('facturaId', sql.Int, factura.id);
        await updateFacturaRequest.query(`
          UPDATE ven_facturas
          SET estado_devolucion = @estadoDevolucion, updated_at = GETDATE()
          WHERE id = @facturaId
        `);
      }

      await tx.commit();

      const notaCreada = await fetchNotaCreditoById(pool, nuevaNotaId);

      res.status(201).json({
        success: true,
        data: notaCreada
      });
    } catch (innerError) {
      await tx.rollback();
      console.error('❌ Error creando nota de crédito:', innerError);
      res.status(500).json({
        success: false,
        message: innerError.message || 'Error creando nota de crédito'
      });
    }
  } catch (error) {
    console.error('❌ Error general en POST /api/notas-credito:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creando nota de crédito'
    });
  }
});

// Actualizar nota de crédito (campos administrativos)
app.put('/api/notas-credito/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};

  try {
    const notaId = parseInt(String(id).trim(), 10);
    if (Number.isNaN(notaId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de nota de crédito inválido'
      });
    }

    if (body.items) {
      return res.status(400).json({
        success: false,
        message: 'La actualización de los ítems devueltos no está permitida con esta ruta'
      });
    }

    const camposActualizables = [];
    const requestPayload = new Map();

    if (body.motivo !== undefined) {
      camposActualizables.push('motivo = @motivo');
      requestPayload.set('motivo', { type: sql.Text, value: String(body.motivo).trim() });
    }

    if (body.estadoDian !== undefined) {
      camposActualizables.push('estado_dian = @estadoDian');
      requestPayload.set('estadoDian', { type: sql.VarChar(20), value: String(body.estadoDian).trim() });
    }

    if (body.fechaEmision !== undefined) {
      const fecha = new Date(body.fechaEmision);
      if (Number.isNaN(fecha.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'fechaEmision inválida'
        });
      }
      camposActualizables.push('fecha_emision = @fechaEmision');
      requestPayload.set('fechaEmision', { type: sql.Date, value: fecha });
    }

    if (body.numero !== undefined) {
      const numeroNota = String(body.numero).trim();
      if (!numeroNota) {
        return res.status(400).json({
          success: false,
          message: 'numero no puede estar vacío'
        });
      }
      camposActualizables.push('numero = @numero');
      requestPayload.set('numero', { type: sql.VarChar(50), value: numeroNota });
    }

    if (camposActualizables.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionaron campos para actualizar'
      });
    }

    const pool = await getConnection();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      if (requestPayload.has('numero')) {
        const numeroReq = new sql.Request(tx);
        numeroReq.input('notaId', sql.Int, notaId);
        numeroReq.input('numero', requestPayload.get('numero').value);
        const numeroResult = await numeroReq.query(`
          SELECT id 
          FROM ven_notas 
          WHERE numero = @numero AND id <> @notaId
        `);

        if (numeroResult.recordset.length > 0) {
          await tx.rollback();
          return res.status(409).json({
            success: false,
            message: `Ya existe otra nota de crédito con el número ${requestPayload.get('numero').value}`
          });
        }
      }

      const updateReq = new sql.Request(tx);
      updateReq.input('notaId', sql.Int, notaId);
      requestPayload.forEach((payload, key) => {
        updateReq.input(key, payload.type, payload.value);
      });

      const updateQuery = `
        UPDATE ven_notas
        SET ${camposActualizables.join(', ')}, updated_at = GETDATE()
        WHERE id = @notaId
      `;

      const updateResult = await updateReq.query(updateQuery);

      if (updateResult.rowsAffected[0] === 0) {
        await tx.rollback();
        return res.status(404).json({
          success: false,
          message: `Nota de crédito con ID ${notaId} no encontrada`
        });
      }

      await tx.commit();

      const notaActualizada = await fetchNotaCreditoById(pool, notaId);
      res.json({
        success: true,
        data: notaActualizada
      });
    } catch (innerError) {
      await tx.rollback();
      console.error('❌ Error actualizando nota de crédito:', innerError);
      res.status(500).json({
        success: false,
        message: innerError.message || 'Error actualizando nota de crédito'
      });
    }
  } catch (error) {
    console.error('❌ Error general en PUT /api/notas-credito/:id', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error actualizando nota de crédito'
    });
  }
});

// Ruta para obtener medidas
app.get('/api/medidas', async (req, res) => {
  try {
    const medidas = await executeQuery(QUERIES.GET_MEDIDAS);
    res.json({ success: true, data: medidas });
  } catch (error) {
    console.error('Error fetching medidas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo medidas',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Ruta para obtener categorías
app.get('/api/categorias', async (req, res) => {
  try {
    const categorias = await executeQuery(QUERIES.GET_CATEGORIAS);
    res.json({ success: true, data: categorias });
  } catch (error) {
    console.error('Error fetching categorias (intentando fallback):', error);
    try {
      const fallback = await executeQuery(`SELECT id, nombre FROM inv_categorias`);
      res.json({ success: true, data: fallback });
    } catch (inner) {
      console.error('Fallback categorias también falló:', inner);
      res.status(500).json({ success: false, message: 'Error obteniendo categorías', error: inner.message });
    }
  }
});

// Ruta de vendedores (desde ven_vendedor)
app.get('/api/vendedores', async (req, res) => {
  try {
    // Usando las columnas REALES de la BD: ideven, nomven, codven, Activo
    const data = await executeQuery(`
      SELECT 
        CAST(ideven AS VARCHAR(20)) as id,
        CAST(ideven AS VARCHAR(20)) as numeroDocumento,
        LTRIM(RTRIM(nomven)) as nombreCompleto,
        codven as codigoVendedor,
        CAST(ideven AS VARCHAR(20)) as codiEmple,
        '' as email,
        CAST(Activo AS INT) as activo
      FROM ven_vendedor
      WHERE Activo = 1
      ORDER BY nomven`);
    
    // Procesar los datos para extraer primer nombre y apellido del nombre completo
    const processedData = data.map((item) => {
      const nombreCompleto = item.nombreCompleto || '';
      const partes = nombreCompleto.trim().split(/\s+/);
      return {
        ...item,
        primerNombre: partes[0] || '',
        primerApellido: partes.length > 1 ? partes.slice(1).join(' ') : '',
        nombreCompleto: nombreCompleto.trim(),
        empresaId: 1 // Default
      };
    });
    
    res.json({ success: true, data: processedData });
  } catch (error) {
    console.error('Error fetching vendedores:', error);
    console.error('Detalles del error:', {
      message: error.message,
      code: error.code,
      number: error.number,
      originalError: error.originalError
    });
    res.status(500).json({ success:false, message:'Error obteniendo vendedores', error: error.message, details: error.originalError?.info || null });
  }
});

// Ruta para obtener bodegas/almacenes
app.get('/api/bodegas', async (req, res) => {
  try {
    console.log('📦 [Backend] Obteniendo almacenes activos desde inv_almacen...');
    const bodegas = await executeQuery(`
      SELECT 
        codalm,
        LTRIM(RTRIM(nomalm)) as nomalm,
        LTRIM(RTRIM(COALESCE(diralm, ''))) as diralm,
        LTRIM(RTRIM(COALESCE(ciualm, ''))) as ciualm,
        CAST(activo AS INT) as activo
      FROM inv_almacen
      WHERE activo = 1
      ORDER BY codalm
    `);
    console.log(`✅ [Backend] Almacenes encontrados: ${bodegas.length}`);
    // Mapear a formato consistente para el frontend
    const bodegasMapeadas = bodegas.map(b => ({
      id: b.codalm, // Usar codalm como ID (es la PK)
      codigo: b.codalm, // Código del almacén
      nombre: b.nomalm || 'Sin nombre',
      direccion: b.diralm || '',
      ciudad: b.ciualm || '',
      activo: b.activo === 1 || b.activo === true
    }));
    res.json({ success: true, data: bodegasMapeadas });
  } catch (error) {
    console.error('❌ Error fetching bodegas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo bodegas',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// --- Adjuntos ---
// Listar adjuntos por entidad
app.get('/api/adjuntos', async (req, res) => {
  try {
    const { entidadId, entidadTipo } = req.query;
    if (!entidadId || !entidadTipo) {
      return res.status(400).json({ success: false, message: 'entidadId y entidadTipo son requeridos' });
    }
    const adjuntos = await executeQueryWithParams(QUERIES.GET_ADJUNTOS_BY_ENTIDAD, {
      entidadId,
      entidadTipo
    });
    res.json({ success: true, data: adjuntos });
  } catch (error) {
    console.error('Error fetching adjuntos:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo adjuntos', error: error.message });
  }
});

// Obtener metadatos de un adjunto
app.get('/api/adjuntos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [adjunto] = await executeQueryWithParams(QUERIES.GET_ADJUNTO_BY_ID, { id });
    if (!adjunto) return res.status(404).json({ success: false, message: 'Adjunto no encontrado' });
    res.json({ success: true, data: adjunto });
  } catch (error) {
    console.error('Error fetching adjunto:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo adjunto', error: error.message });
  }
});

// Descargar archivo adjunto (placeholder – integrar almacenamiento)
app.get('/api/adjuntos/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const [adjunto] = await executeQueryWithParams(QUERIES.GET_ADJUNTO_BY_ID, { id });
    if (!adjunto) return res.status(404).json({ success: false, message: 'Adjunto no encontrado' });
    // NOTA: La descarga de archivos adjuntos requiere integración con almacenamiento
    // (disco local, red, S3, etc.). Actualmente solo se devuelven metadatos.
    // Para implementar: agregar servicio de almacenamiento y actualizar esta ruta.
    res.status(501).json({ 
      success: false, 
      message: 'Descarga de archivos adjuntos no implementada aún. Se requiere servicio de almacenamiento.',
      data: adjunto 
    });
  } catch (error) {
    console.error('Error downloading adjunto:', error);
    res.status(500).json({ success: false, message: 'Error descargando adjunto', error: error.message });
  }
});

// Ruta para ejecutar consulta personalizada
app.post('/api/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Query es requerida y debe ser un string' 
      });
    }
    
    const result = await executeQuery(query);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error executing custom query:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error ejecutando consulta',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Ruta raíz - Información del servidor
app.get('/', (req, res) => {
  const localIP = getLocalIP();
  res.json({ 
    success: true, 
    message: '🚀 Servidor ERP360 API funcionando correctamente',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      testConnection: '/api/test-connection',
      clientes: '/api/clientes',
      productos: '/api/productos',
      cotizaciones: '/api/cotizaciones',
      pedidos: '/api/pedidos',
      remisiones: '/api/remisiones',
      facturas: '/api/facturas'
    },
    network: {
      localIP: localIP,
      port: PORT,
      accessURL: `http://${localIP}:${PORT}`
    }
  });
});

// Ruta de salud del servidor
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// --- CREAR COTIZACIÓN (cabecera + detalle) ---
app.post('/api/cotizaciones', async (req, res) => {
  const body = req.body || {};
  console.log('📥 Recibida solicitud POST /api/cotizaciones con body:', JSON.stringify(body, null, 2));
  try {
    const {
      numeroCotizacion, fechaCotizacion, fechaVencimiento,
      codter, codi_emple, // Aceptar codter y codi_emple directamente
      clienteId, vendedorId, // Mantener compatibilidad con nombres antiguos
      subtotal, descuentoValor = 0, ivaValor = 0, total = 0,
      observaciones = '', estado = 'ENVIADA', empresaId, items = [],
      formaPago = '01', // Forma de pago (01: Contado, 02: Crédito, 03: Mixto)
      valorAnticipo = 0, // Valor de anticipo
      numOrdenCompra = null // Número de orden de compra del cliente
    } = body;

    // Usar codter y codi_emple directamente, o los valores antiguos si vienen
    const codterCliente = codter || clienteId;
    const codiEmpleVendedor = codi_emple || vendedorId;

    console.log('📋 Datos parseados:', { 
      numeroCotizacion, 
      codter: codterCliente, 
      codi_emple: codiEmpleVendedor,
      items: items.length, 
      empresaId, 
      estado 
    });

    // Validaciones más específicas
    if (!codterCliente) {
      return res.status(400).json({ 
        success: false, 
        message: 'codter (código de tercero/cliente) es requerido', 
        error: 'MISSING_CODTER' 
      });
    }
    if (!codiEmpleVendedor) {
      return res.status(400).json({ 
        success: false, 
        message: 'codi_emple (código de empleado/vendedor) es requerido', 
        error: 'MISSING_CODI_EMPLE' 
      });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items debe ser un array con al menos un elemento', error: 'MISSING_ITEMS' });
    }
    if (!empresaId) {
      return res.status(400).json({ success: false, message: 'empresaId es requerido', error: 'MISSING_EMPRESA_ID' });
    }

    const pool = await getConnection();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      // Validar que el codter (cliente) existe en con_terceros
      const codterStr = String(codterCliente || '').trim();
      
      console.log(`🔍 Validando codter (cliente): "${codterStr}"`);
      
      const reqCliente = new sql.Request(tx);
      reqCliente.input('codter', sql.VarChar(50), codterStr);
      const clienteResult = await reqCliente.query(`
        SELECT codter, id, nomter, activo 
        FROM con_terceros 
        WHERE codter = @codter AND activo = 1
      `);
      
      if (clienteResult.recordset.length === 0) {
        console.error(`❌ Cliente NO encontrado: codter="${codterStr}"`);
        
        // Mostrar ejemplos de clientes disponibles ANTES del rollback
        let ejemplosClientes = [];
        try {
          const reqDebug = new sql.Request(pool);
        const debugResult = await reqDebug.query(`
          SELECT TOP 5 codter, nomter, activo 
          FROM con_terceros 
          WHERE activo = 1
          ORDER BY nomter
        `);
          ejemplosClientes = debugResult.recordset;
          console.log(`   📋 Ejemplos de clientes activos en BD:`, ejemplosClientes);
        } catch (debugError) {
          console.error('   ⚠️ Error obteniendo ejemplos de clientes:', debugError);
        }
        
        // Ahora hacer rollback
        try {
          await tx.rollback();
        } catch (rollbackError) {
          console.error('   ⚠️ Error en rollback (puede ser normal si la transacción ya estaba cerrada):', rollbackError.message);
        }
        
        return res.status(400).json({ 
          success: false, 
          message: `Cliente con codter '${codterStr}' no encontrado o inactivo. Verifique que el código de tercero exista en la base de datos.`, 
          error: 'CLIENTE_NOT_FOUND',
          debug: {
            codterRecibido: codterStr,
            ejemplosClientes: ejemplosClientes
          }
        });
      }
      
      console.log(`✅ Cliente encontrado: codter="${codterStr}" (${clienteResult.recordset[0].nomter})`);
      
      // Validar que el vendedor existe en ven_vendedor
      // El código puede venir como ideven (número) o como string
      const codiEmpleStr = String(codiEmpleVendedor || '').trim();
      const idevenNum = parseInt(codiEmpleStr, 10);
      const isNumeric = !isNaN(idevenNum) && String(idevenNum) === codiEmpleStr;
      
      console.log(`🔍 Validando vendedor: "${codiEmpleStr}" (numeric: ${isNumeric})`);
      
      const reqVendedor = new sql.Request(tx);
      if (isNumeric) {
        // Buscar por ideven (número)
        reqVendedor.input('ideven', sql.Int, idevenNum);
        var vendedorQuery = `
          SELECT CAST(ideven AS VARCHAR(20)) as codi_emple, LTRIM(RTRIM(nomven)) as nomb_emple, CAST(Activo AS INT) as activo, codven
        FROM ven_vendedor 
          WHERE ideven = @ideven AND Activo = 1
        `;
      } else {
        // Buscar por codven (código de vendedor) como fallback
        reqVendedor.input('codven', sql.VarChar(20), codiEmpleStr);
        var vendedorQuery = `
          SELECT CAST(ideven AS VARCHAR(20)) as codi_emple, LTRIM(RTRIM(nomven)) as nomb_emple, CAST(Activo AS INT) as activo, codven
          FROM ven_vendedor 
          WHERE codven = @codven AND Activo = 1
        `;
      }
      const vendedorResult = await reqVendedor.query(vendedorQuery);
      
      if (vendedorResult.recordset.length === 0) {
        console.error(`❌ Vendedor NO encontrado: "${codiEmpleStr}"`);
        
        // Mostrar ejemplos de vendedores disponibles ANTES del rollback
        let ejemplosVendedores = [];
        try {
          const reqDebugVendedor = new sql.Request(pool);
        const debugVendedorResult = await reqDebugVendedor.query(`
            SELECT TOP 5 CAST(ideven AS VARCHAR(20)) as codi_emple, LTRIM(RTRIM(nomven)) as nomb_emple, CAST(Activo AS INT) as activo 
          FROM ven_vendedor 
            WHERE Activo = 1
            ORDER BY nomven
          `);
          ejemplosVendedores = debugVendedorResult.recordset;
          console.log(`   📋 Ejemplos de vendedores activos en BD:`, ejemplosVendedores);
        } catch (debugError) {
          console.error('   ⚠️ Error obteniendo ejemplos de vendedores:', debugError);
        }
        
        // Ahora hacer rollback
        try {
          await tx.rollback();
        } catch (rollbackError) {
          console.error('   ⚠️ Error en rollback (puede ser normal si la transacción ya estaba cerrada):', rollbackError.message);
        }
        
        return res.status(400).json({ 
          success: false, 
          message: `Vendedor '${codiEmpleStr}' no encontrado o inactivo. Verifique que el código de empleado exista en la base de datos.`, 
          error: 'VENDEDOR_NOT_FOUND',
          debug: {
            codi_empleRecibido: codiEmpleStr,
            ejemplosVendedores: ejemplosVendedores
          }
        });
      }
      
      console.log(`✅ Vendedor encontrado: "${codiEmpleStr}" (${vendedorResult.recordset[0].nomb_emple})`);
      
      // Validar que el codalm (empresaId) existe en inv_almacen
      const codalmFormatted = String(empresaId || '001').padStart(3, '0');
      console.log(`🔍 Validando codalm (almacén/bodega): "${codalmFormatted}"`);
      
      const reqAlmacen = new sql.Request(tx);
      reqAlmacen.input('codalm', sql.VarChar(3), codalmFormatted);
      const almacenResult = await reqAlmacen.query(`
        SELECT codalm, nomalm, activo 
        FROM inv_almacen 
        WHERE codalm = @codalm AND activo = 1
      `);
      
      if (almacenResult.recordset.length === 0) {
        console.error(`❌ Almacén NO encontrado: codalm="${codalmFormatted}"`);
        
        // Mostrar ejemplos de almacenes disponibles ANTES del rollback
        // Usar una nueva conexión para la query de debug ya que la transacción se va a cerrar
        let ejemplosAlmacenes = [];
        try {
          const reqDebugAlmacen = new sql.Request(pool);
        const debugAlmacenResult = await reqDebugAlmacen.query(`
          SELECT TOP 5 codalm, nomalm, activo 
          FROM inv_almacen 
          WHERE activo = 1
          ORDER BY codalm
        `);
          ejemplosAlmacenes = debugAlmacenResult.recordset;
          console.log(`   📋 Ejemplos de almacenes activos en BD:`, ejemplosAlmacenes);
        } catch (debugError) {
          console.error('   ⚠️ Error obteniendo ejemplos de almacenes:', debugError);
        }
        
        // Ahora hacer rollback
        try {
          await tx.rollback();
        } catch (rollbackError) {
          console.error('   ⚠️ Error en rollback (puede ser normal si la transacción ya estaba cerrada):', rollbackError.message);
        }
        
        return res.status(400).json({ 
          success: false, 
          message: `Almacén/Bodega con código '${codalmFormatted}' no encontrado o inactivo. Verifique que el código de almacén exista en la base de datos.`, 
          error: 'ALMACEN_NOT_FOUND',
          debug: {
            codalmRecibido: codalmFormatted,
            empresaIdOriginal: empresaId,
            ejemplosAlmacenes: ejemplosAlmacenes
          }
        });
      }
      
      console.log(`✅ Almacén encontrado: codalm="${codalmFormatted}" (${almacenResult.recordset[0].nomalm})`);
      
      // Generar número de cotización automáticamente si es necesario
      // SIEMPRE generar un número válido, nunca usar "AUTO"
      let numcotFinal = numeroCotizacion || '';
      const numcotStr = String(numcotFinal || '').trim();
      const necesitaGenerar = !numcotFinal || 
                              numcotStr === '' || 
                              numcotStr === 'COT-PREVIEW' || 
                              numcotStr === 'AUTO' ||
                              numcotStr.toUpperCase() === 'AUTO' ||
                              numcotStr === 'undefined' ||
                              numcotStr === 'null';
      
      console.log(`🔍 Evaluando número de cotización:`, {
        numeroCotizacionOriginal: numeroCotizacion,
        numcotFinal: numcotFinal,
        numcotStr: numcotStr,
        necesitaGenerar: necesitaGenerar
      });
      
      if (necesitaGenerar) {
        // Buscar el último número de cotización con formato COT-XXX
        const reqUltimaCot = new sql.Request(tx);
        let siguienteNumero = 1;
        
        try {
          // Obtener todas las cotizaciones que empiezan con COT- y filtrar en JavaScript
          const ultimaCotResult = await reqUltimaCot.query(`
            SELECT numcot 
            FROM ven_cotizacion 
            WHERE numcot LIKE 'COT-%'
            ORDER BY numcot DESC
          `);
          
          console.log(`🔍 Encontradas ${ultimaCotResult.recordset.length} cotizaciones con formato COT-*`);
          
          if (ultimaCotResult.recordset.length > 0) {
            // Filtrar y encontrar el número más alto
            const numeros = ultimaCotResult.recordset
              .map(row => row.numcot)
              .filter(numcot => numcot && /^COT-\d+$/.test(String(numcot).trim()))
              .map(numcot => {
                const match = String(numcot).trim().match(/^COT-(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
              })
              .filter(num => num > 0 && !isNaN(num));
            
            if (numeros.length > 0) {
              siguienteNumero = Math.max(...numeros) + 1;
              console.log(`🔢 Número más alto encontrado: ${Math.max(...numeros)}, siguiente será: ${siguienteNumero}`);
            } else {
              console.log(`⚠️ No se encontraron números válidos en las cotizaciones, empezando desde 1`);
            }
          } else {
            console.log(`📋 No hay cotizaciones previas, empezando desde COT-001`);
          }
        } catch (error) {
          console.error('⚠️ Error al obtener último número de cotización:', error);
          console.error('   Usando COT-001 como fallback');
          siguienteNumero = 1;
        }
        
        // SIEMPRE generar un número válido con formato COT-001, COT-002, etc.
        numcotFinal = `COT-${String(siguienteNumero).padStart(3, '0')}`;
        console.log(`✅ Número de cotización generado automáticamente: "${numcotFinal}"`);
      } else {
        // Validar que el número proporcionado tenga formato válido
        if (!/^COT-\d+$/.test(String(numcotFinal).trim())) {
          console.warn(`⚠️ Número de cotización proporcionado "${numcotFinal}" no tiene formato válido, generando uno nuevo`);
          // Regenerar si el formato no es válido
          const reqUltimaCot = new sql.Request(tx);
          const ultimaCotResult = await reqUltimaCot.query(`
            SELECT numcot FROM ven_cotizacion WHERE numcot LIKE 'COT-%' ORDER BY numcot DESC
          `);
          let siguienteNumero = 1;
          if (ultimaCotResult.recordset.length > 0) {
            const numeros = ultimaCotResult.recordset
              .map(row => row.numcot)
              .filter(numcot => /^COT-\d+$/.test(String(numcot)))
              .map(numcot => {
                const match = String(numcot).match(/^COT-(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
              })
              .filter(num => num > 0);
            if (numeros.length > 0) siguienteNumero = Math.max(...numeros) + 1;
          }
          numcotFinal = `COT-${String(siguienteNumero).padStart(3, '0')}`;
        }
        console.log(`📝 Número de cotización proporcionado: "${numcotFinal}"`);
      }
      
      // Validación final: NUNCA usar "AUTO"
      if (!numcotFinal || numcotFinal === 'AUTO' || numcotFinal.toUpperCase() === 'AUTO') {
        console.error('❌ ERROR CRÍTICO: numcotFinal es "AUTO", generando número válido');
        numcotFinal = 'COT-001';
      }
      
      console.log(`📝 VALIDACIÓN FINAL - numcot a insertar: "${numcotFinal}"`);
      
      // Validación CRÍTICA: NUNCA insertar "AUTO"
      const numcotParaInsertar = String(numcotFinal || '').trim();
      if (!numcotParaInsertar || 
          numcotParaInsertar === 'AUTO' || 
          numcotParaInsertar.toUpperCase() === 'AUTO' ||
          numcotParaInsertar === 'COT-PREVIEW') {
        console.error(`❌ ERROR CRÍTICO: numcotFinal es inválido: "${numcotFinal}", regenerando...`);
        // Regenerar número de emergencia
        const reqUltimaCot = new sql.Request(tx);
        try {
          const ultimaCotResult = await reqUltimaCot.query(`
            SELECT numcot FROM ven_cotizacion WHERE numcot LIKE 'COT-%' ORDER BY numcot DESC
          `);
          let siguienteNumero = 1;
          if (ultimaCotResult.recordset.length > 0) {
            const numeros = ultimaCotResult.recordset
              .map(row => row.numcot)
              .filter(numcot => /^COT-\d+$/.test(String(numcot)))
              .map(numcot => {
                const match = String(numcot).match(/^COT-(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
              })
              .filter(num => num > 0);
            if (numeros.length > 0) siguienteNumero = Math.max(...numeros) + 1;
          }
          numcotFinal = `COT-${String(siguienteNumero).padStart(3, '0')}`;
          console.log(`✅ Número regenerado de emergencia: "${numcotFinal}"`);
        } catch (error) {
          console.error('❌ Error crítico al regenerar número:', error);
          numcotFinal = 'COT-001';
        }
      }
      
      // Validación final antes de insertar
      if (numcotFinal === 'AUTO' || numcotFinal.toUpperCase() === 'AUTO') {
        console.error('❌ ABORTANDO: No se puede insertar "AUTO"');
        await tx.rollback();
        return res.status(500).json({ 
          success: false, 
          message: 'Error interno: No se pudo generar un número de cotización válido', 
          error: 'INVALID_NUMCOT' 
        });
      }
      
      const req1 = new sql.Request(tx);
      const estadoMapeado = mapEstadoToDb(estado);
      console.log('🔄 Estado mapeado:', estado, '->', estadoMapeado);
      console.log(`📝 Insertando cotización con codter: "${codterStr}", codi_emple: "${codiEmpleStr}" y numcot: "${numcotFinal}"`);
      console.log(`🔒 VALIDACIÓN PRE-INSERT: numcotFinal="${numcotFinal}" (tipo: ${typeof numcotFinal})`);
      
      req1.input('numcot', sql.VarChar(50), numcotFinal);
      req1.input('fecha', fechaCotizacion);
      req1.input('fecha_vence', fechaVencimiento);
      req1.input('codter', sql.VarChar(50), codterStr);
      // cod_vendedor en venv_cotizacion es CHAR(10), usar codven del vendedor (ya incluido en la consulta)
      const codvenVendedor = (vendedorResult.recordset[0].codven || '').trim();
      // Asegurar que tenga máximo 10 caracteres y rellenar con espacios si es necesario
      const codvenFormatted = codvenVendedor.substring(0, 10).padEnd(10, ' ');
      req1.input('cod_vendedor', sql.Char(10), codvenFormatted);
      req1.input('subtotal', subtotal);
      req1.input('val_descuento', descuentoValor);
      req1.input('val_iva', ivaValor);
      req1.input('observa', observaciones);
      req1.input('estado', estadoMapeado);
      // Usar el codalm ya validado anteriormente
      req1.input('codalm', codalmFormatted);

      // cod_usuario es NOT NULL, usar un valor por defecto si no se proporciona
      const codUsuario = req.body.cod_usuario || req.body.codUsuario || 'SISTEMA';
      req1.input('cod_usuario', sql.VarChar(10), codUsuario.substring(0, 10));
      req1.input('COD_TARIFA', sql.Char(2), (req.body.COD_TARIFA || req.body.codTarifa || '  ').substring(0, 2).padEnd(2, ' '));
      
      // Campos adicionales
      const formaPagoFormatted = String(formaPago || '01').substring(0, 2).padEnd(2, ' ');
      req1.input('formapago', sql.NChar(2), formaPagoFormatted);
      req1.input('valor_anticipo', sql.Decimal(18, 2), Number(valorAnticipo) || 0);
      req1.input('num_orden_compra', sql.Int, numOrdenCompra ? parseInt(numOrdenCompra, 10) : null);

      const insertHeader = await req1.query(`
        INSERT INTO ven_cotizacion (
          numcot, fecha, fecha_vence,
          codter, cod_vendedor, subtotal, val_descuento, val_iva,
          observa, estado, codalm, cod_usuario, COD_TARIFA, fecsys,
          formapago, valor_anticipo, num_orden_compra
        ) VALUES (
          @numcot, @fecha, @fecha_vence,
          @codter, @cod_vendedor, @subtotal, @val_descuento, @val_iva,
          @observa, @estado, @codalm, @cod_usuario, @COD_TARIFA, GETDATE(),
          @formapago, @valor_anticipo, @num_orden_compra
        );
        SELECT SCOPE_IDENTITY() AS id;`);
      const newId = insertHeader.recordset[0].id;
      console.log('✅ Cotización creada con ID:', newId);

      console.log(`📦 Guardando ${items.length} items de cotización...`);
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const reqDet = new sql.Request(tx);
        console.log(`➕ Insertando item ${idx + 1}/${items.length}:`, { 
          productoId: it.productoId, 
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario,
          descuentoPorcentaje: it.descuentoPorcentaje || 0,
          ivaPorcentaje: it.ivaPorcentaje || 0,
          total: it.total
        });
        
        // Validar que el productoId sea numérico y obtener codins y codigo_medida del producto
        const productoIdNum = typeof it.productoId === 'number' ? it.productoId : parseInt(it.productoId, 10);
        if (isNaN(productoIdNum)) {
          throw new Error(`Item ${idx + 1}: productoId inválido: ${it.productoId}`);
        }
        
        // Obtener codins (CHAR(8)) y codigo_medida (CHAR(3)) del producto
        const reqProducto = new sql.Request(tx);
        reqProducto.input('productoId', sql.Int, productoIdNum);
        const productoResult = await reqProducto.query(`
          SELECT codins, Codigo_Medida 
          FROM inv_insumos 
          WHERE id = @productoId
        `);
        
        if (!productoResult.recordset || productoResult.recordset.length === 0) {
          throw new Error(`Item ${idx + 1}: Producto con ID ${productoIdNum} no encontrado`);
        }
        
        const producto = productoResult.recordset[0];
        const codins = String(producto.codins || '').trim().substring(0, 8).padEnd(8, ' '); // CHAR(8)
        const codigoMedida = String(producto.Codigo_Medida || '').trim().substring(0, 3).padEnd(3, ' '); // CHAR(3)
        
        if (!codins || codins.trim() === '') {
          throw new Error(`Item ${idx + 1}: El producto con ID ${productoIdNum} no tiene codins válido`);
        }
        
        // cod_producto es CHAR(8) en venv_detacotizacion, usar codins
        reqDet.input('id_cotizacion', sql.BigInt, newId);
        reqDet.input('cod_producto', sql.Char(8), codins);
        reqDet.input('cantidad', sql.Decimal(9, 2), it.cantidad);
        reqDet.input('preciound', sql.Decimal(19, 5), it.precioUnitario);
        reqDet.input('tasa_descuento', sql.Decimal(9, 5), it.descuentoPorcentaje || 0);
        reqDet.input('tasa_iva', sql.Decimal(5, 2), it.ivaPorcentaje || 0);
        reqDet.input('valor', sql.Decimal(18, 2), it.total);
        reqDet.input('codigo_medida', sql.Char(3), codigoMedida);
        
        await reqDet.query(`
          INSERT INTO ven_detacotizacion (
            id_cotizacion, cod_producto, cantidad, preciound,
            tasa_descuento, tasa_iva, valor, codigo_medida
          ) VALUES (
            @id_cotizacion, @cod_producto, @cantidad, @preciound,
            @tasa_descuento, @tasa_iva, @valor, @codigo_medida
          );`);
        console.log(`✅ Item ${idx + 1} guardado correctamente (cod_producto: ${codins.trim()})`);
      }
      console.log(`✅ Todos los ${items.length} items de cotización guardados`);

      await tx.commit();
      console.log('✅ Transacción completada exitosamente');
      res.json({ success: true, data: { id: newId } });
    } catch (inner) {
      console.error('❌ Error en transacción interna:', inner);
      console.error('❌ Detalles del error:', {
        message: inner.message,
        code: inner.code,
        number: inner.number,
        originalError: inner.originalError
      });
      // Intentar rollback solo si la transacción está activa
      try {
      await tx.rollback();
      } catch (rollbackError) {
        // Si el rollback falla, puede ser porque la transacción ya fue cerrada
        console.error('   ⚠️ Error en rollback (puede ser normal si la transacción ya estaba cerrada):', rollbackError.message);
      }
      throw inner;
    }
  } catch (error) {
    console.error('❌ Error creando cotización:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Detalles completos:', {
      message: error.message,
      code: error.code,
      number: error.number,
      originalError: error.originalError,
      lineNumber: error.lineNumber
    });
    
    // Mensaje de error más descriptivo
    let errorMessage = 'Error creando cotización';
    if (error.originalError) {
      const originalError = error.originalError;
      if (originalError.info) {
        errorMessage = originalError.info.message || errorMessage;
      } else if (originalError.message) {
        errorMessage = originalError.message;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage,
      error: error.message,
      details: error.originalError?.info || null
    });
  }
});

// --- ACTUALIZAR COTIZACIÓN ---
app.put('/api/cotizaciones/:id', async (req, res) => {
  console.log(`✅ Endpoint PUT /api/cotizaciones/:id alcanzado`);
  console.log(`   Params:`, req.params);
  console.log(`   Method:`, req.method);
  console.log(`   Path:`, req.path);
  const { id } = req.params;
  const body = req.body || {};
  const idNum = parseInt(id, 10);
  
  if (isNaN(idNum)) {
    return res.status(400).json({ 
      success: false, 
      message: `ID de cotización inválido: ${id}`,
      error: 'INVALID_ID'
    });
  }
  
  console.log(`📥 Recibida solicitud PUT /api/cotizaciones/${idNum} (tipo: ${typeof idNum}) con body:`, JSON.stringify(body, null, 2));
  
  try {
    const pool = await getConnection();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    
    try {
      const reqUpdate = new sql.Request(tx);
      
      // Construir campos a actualizar dinámicamente
      const updates = [];
      const params = { cotizacionId: id };
      
      if (body.estado !== undefined) {
        const estadoMapeado = mapEstadoToDb(body.estado);
        updates.push('estado = @estado');
        reqUpdate.input('estado', sql.VarChar(10), estadoMapeado);
        console.log(`🔄 Actualizando estado: ${body.estado} -> ${estadoMapeado}`);
      }
      
      if (body.fechaCotizacion !== undefined) {
        updates.push('fecha = @fecha');
        reqUpdate.input('fecha', sql.Date, body.fechaCotizacion);
      }
      
      if (body.fechaVencimiento !== undefined) {
        updates.push('fecha_vence = @fecha_vence');
        reqUpdate.input('fecha_vence', sql.Date, body.fechaVencimiento);
      }
      
      if (body.observaciones !== undefined || body.observacionesInternas !== undefined) {
        updates.push('observa = @observa');
        reqUpdate.input('observa', sql.VarChar(500), body.observaciones || body.observacionesInternas || '');
      }
      
      if (updates.length === 0) {
        await tx.rollback();
        return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
      }
      
      reqUpdate.input('cotizacionId', sql.Int, idNum);
      
      const updateQuery = `
        UPDATE ven_cotizacion 
        SET ${updates.join(', ')}
        WHERE id = @cotizacionId;
        SELECT * FROM ven_cotizacion WHERE id = @cotizacionId;
      `;
      
      console.log(`🔍 Ejecutando query de actualización para cotización ID: ${idNum}`);
      const result = await reqUpdate.query(updateQuery);
      
      console.log(`📊 Resultados de la actualización:`, {
        rowsAffected: result.rowsAffected,
        recordsetLength: result.recordset?.length || 0,
        recordset: result.recordset
      });
      
      if (result.recordset.length === 0) {
        await tx.rollback();
        console.error(`❌ Cotización con ID ${idNum} no encontrada después de actualizar`);
        
        // Verificar si la cotización existe antes de actualizar
        const reqCheck = new sql.Request(tx);
        reqCheck.input('cotizacionId', sql.Int, idNum);
        const checkResult = await reqCheck.query('SELECT id, numcot, estado FROM ven_cotizacion WHERE id = @cotizacionId');
        
        if (checkResult.recordset.length === 0) {
          return res.status(404).json({ 
            success: false, 
            message: `Cotización con ID ${idNum} no existe en la base de datos` 
          });
        } else {
          return res.status(500).json({ 
            success: false, 
            message: `Cotización existe pero no se pudo actualizar. Verifique los logs del servidor.` 
          });
        }
      }
      
      await tx.commit();
      
      const updatedCotizacion = result.recordset[0];
      console.log('✅ Cotización actualizada exitosamente:', {
        id: updatedCotizacion.id,
        numcot: updatedCotizacion.numcot,
        estado: updatedCotizacion.estado,
        estadoMapeado: mapEstadoFromDb(updatedCotizacion.estado)
      });
      
      res.json({ 
        success: true, 
        data: {
          id: updatedCotizacion.id,
          numeroCotizacion: updatedCotizacion.numcot,
          estado: mapEstadoFromDb(updatedCotizacion.estado),
          fechaCotizacion: updatedCotizacion.fecha,
          fechaVencimiento: updatedCotizacion.fecha_vence,
          observaciones: updatedCotizacion.observa
        }
      });
    } catch (inner) {
      await tx.rollback();
      console.error('❌ Error interno en transacción:', inner);
      throw inner;
    }
  } catch (error) {
    console.error('❌ Error actualizando cotización:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: `Error actualizando cotización: ${error.message}`, 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// --- CREAR CLIENTE (TERCERO) ---
app.post('/api/clientes', async (req, res) => {
  try {
    const b = req.body || {};
    const required = ['numeroDocumento','razonSocial','direccion','ciudadId'];
    for (const k of required) { if (!b[k]) return res.status(400).json({ success:false, message:`Falta ${k}` }); }
    
    // Asegurar que todos los parámetros opcionales tengan valores por defecto
    const params = {
      numeroDocumento: b.numeroDocumento,
      razonSocial: b.razonSocial,
      primerApellido: b.primerApellido || null,
      segundoApellido: b.segundoApellido || null,
      primerNombre: b.primerNombre || null,
      segundoNombre: b.segundoNombre || null,
      direccion: b.direccion,
      ciudadId: b.ciudadId,
      vendedorId: b.vendedorId || null,
      email: b.email || null,
      telefono: b.telefono || null,
      celular: b.celular || null,
      diasCredito: b.diasCredito || 0,
      formaPago: b.formaPago || null,
      regimenTributario: b.regimenTributario || null
    };
    
    const insert = await executeQueryWithParams(`
      INSERT INTO con_terceros (
        codter, nomter, apl1, apl2, nom1, nom2, dirter, ciudad, codven,
        EMAIL, TELTER, CELTER, plazo, Forma_pago, regimen_tributario, activo
      ) VALUES (
        @numeroDocumento, @razonSocial, @primerApellido, @segundoApellido, @primerNombre, @segundoNombre,
        @direccion, @ciudadId, @vendedorId, @email, @telefono, @celular, @diasCredito, @formaPago, @regimenTributario, 1
      );
      SELECT SCOPE_IDENTITY() AS id;`, params);
    res.json({ success:true, data: insert[0] });
  } catch (error) {
    console.error('Error creando cliente:', error);
    res.status(500).json({ success:false, message:'Error creando cliente', error: error.message });
  }
});

// Asignar lista de precios a cliente
app.post('/api/clientes/:id/lista-precios', async (req, res) => {
  try {
    const { id } = req.params;
    const { listaPrecioId } = req.body || {};
    if (!listaPrecioId) return res.status(400).json({ success:false, message:'listaPrecioId requerido' });
    await executeQueryWithParams(`UPDATE con_terceros SET lista_precios_id = @listaPrecioId WHERE id = @clienteId;`, { listaPrecioId, clienteId: id });
    res.json({ success:true });
  } catch (error) {
    console.error('Error asignando lista de precios:', error);
    res.status(500).json({ success:false, message:'Error asignando lista de precios', error: error.message });
  }
});

// --- CREAR PEDIDO ---
app.post('/api/pedidos', async (req, res) => {
  const body = req.body || {};
  console.log('📥 Recibida solicitud POST /api/pedidos');
  try {
    const {
      numeroPedido, fechaPedido, fechaEntregaEstimada,
      clienteId, vendedorId, cotizacionId, subtotal, descuentoValor = 0, ivaValor = 0, total = 0,
      impoconsumoValor = 0, observaciones = '', instruccionesEntrega = '',
      estado = 'ENVIADA', empresaId, items = []
    } = body;

    if (!clienteId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Datos incompletos para crear pedido' });
    }

    const pool = await getConnection();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      // Validar que el cotizacionId existe si se proporciona
      // Puede ser un ID numérico o un número de cotización (numcot) como "COT-003"
      let cotizacionIdFinal = null;
      if (cotizacionId !== null && cotizacionId !== undefined) {
        const cotizacionIdStr = String(cotizacionId).trim();
        const cotizacionIdNum = typeof cotizacionId === 'number' ? cotizacionId : parseInt(cotizacionIdStr, 10);
        
        console.log(`🔍 Validando cotizacionId: "${cotizacionIdStr}" (tipo: ${typeof cotizacionId})`);
        
        const reqCheckCot = new sql.Request(tx);
        let cotizacionResult;
        
        // Si es numérico, buscar por ID; si no, buscar por numcot
        if (!isNaN(cotizacionIdNum) && cotizacionIdStr === String(cotizacionIdNum)) {
          // Es un ID numérico
          reqCheckCot.input('cotizacionId', sql.Int, cotizacionIdNum);
          cotizacionResult = await reqCheckCot.query(`
            SELECT id, numcot, estado 
            FROM ven_cotizacion 
            WHERE id = @cotizacionId
          `);
          console.log(`   → Buscando por ID numérico: ${cotizacionIdNum}`);
        } else {
          // Es un número de cotización (numcot) como "COT-003"
          reqCheckCot.input('numcot', sql.VarChar(50), cotizacionIdStr);
          cotizacionResult = await reqCheckCot.query(`
            SELECT id, numcot, estado 
            FROM ven_cotizacion 
            WHERE numcot = @numcot
          `);
          console.log(`   → Buscando por numcot: "${cotizacionIdStr}"`);
        }
        
        if (cotizacionResult.recordset.length === 0) {
          // Obtener ejemplos antes de hacer rollback
          const reqDebugCot = new sql.Request(tx);
          let debugCotResult;
          try {
            debugCotResult = await reqDebugCot.query(`
              SELECT TOP 5 id, numcot, estado 
              FROM ven_cotizacion 
              ORDER BY id DESC
            `);
            console.log(`   📋 Ejemplos de cotizaciones en BD:`, debugCotResult.recordset);
          } catch (err) {
            console.error('Error obteniendo ejemplos de cotizaciones:', err);
          }
          
          await tx.rollback();
          console.error(`❌ Cotización NO encontrada: cotizacionId="${cotizacionIdStr}"`);
          
          return res.status(400).json({ 
            success: false, 
            message: `Cotización con ID/numcot '${cotizacionIdStr}' no encontrada. Verifique que la cotización exista en la base de datos.`, 
            error: 'COTIZACION_NOT_FOUND',
            debug: {
              cotizacionIdRecibido: cotizacionIdStr,
              tipo: typeof cotizacionId,
              ejemplosCotizaciones: debugCotResult?.recordset || []
            }
          });
        }
        
        cotizacionIdFinal = cotizacionResult.recordset[0].id;
        console.log(`✅ Cotización encontrada: id=${cotizacionIdFinal}, numcot=${cotizacionResult.recordset[0].numcot}`);
      }
      
      // Validar que el cliente existe
      const clienteIdStr = String(clienteId || '').trim();
      console.log(`🔍 Validando cliente: "${clienteIdStr}"`);
      
      const reqCheckCliente = new sql.Request(tx);
      reqCheckCliente.input('codter', sql.VarChar(50), clienteIdStr);
      const clienteResult = await reqCheckCliente.query(`
        SELECT codter, id, nomter, activo 
        FROM con_terceros 
        WHERE codter = @codter AND activo = 1
      `);
      
      if (clienteResult.recordset.length === 0) {
        await tx.rollback();
        console.error(`❌ Cliente NO encontrado: codter="${clienteIdStr}"`);
        
        return res.status(400).json({ 
          success: false, 
          message: `Cliente con codter '${clienteIdStr}' no encontrado o inactivo. Verifique que el cliente exista en la base de datos.`, 
          error: 'CLIENTE_NOT_FOUND'
        });
      }
      
      console.log(`✅ Cliente encontrado: codter="${clienteIdStr}" (${clienteResult.recordset[0].nomter})`);
      
      // Validar que el almacén existe (empresaId debe corresponder a un almacén activo)
      const empresaIdStr = String(empresaId || '001').trim();
      console.log(`🔍 Validando almacén: "${empresaIdStr}"`);
      
      const reqCheckAlmacen = new sql.Request(tx);
      reqCheckAlmacen.input('codalm', sql.VarChar(10), empresaIdStr);
      const almacenResult = await reqCheckAlmacen.query(`
        SELECT codalm, nomalm, activo
        FROM inv_almacen
        WHERE codalm = @codalm AND activo = 1
      `);
      
      if (almacenResult.recordset.length === 0) {
        await tx.rollback();
        console.error(`❌ Almacén NO encontrado o inactivo: codalm="${empresaIdStr}"`);
        
        // Obtener ejemplos de almacenes disponibles
        let ejemplosAlmacenes = [];
        try {
          const reqEjemplos = new sql.Request(tx);
          const ejemplosResult = await reqEjemplos.query(`
            SELECT TOP 5 codalm, nomalm, activo
            FROM inv_almacen
            ORDER BY codalm
          `);
          ejemplosAlmacenes = ejemplosResult.recordset;
        } catch (err) {
          console.error('Error obteniendo ejemplos de almacenes:', err);
        }
        
        return res.status(400).json({ 
          success: false, 
          message: `Almacén/Bodega con código '${empresaIdStr}' no encontrado o inactivo. Verifique que el código de almacén exista en la base de datos.`, 
          error: 'ALMACEN_NOT_FOUND',
          debug: {
            empresaIdRecibido: empresaIdStr,
            ejemplosAlmacenes: ejemplosAlmacenes
          }
        });
      }
      
      console.log(`✅ Almacén encontrado: codalm="${empresaIdStr}" (${almacenResult.recordset[0].nomalm})`);
      
      // Validar que el vendedor existe si se proporciona
      let vendedorIdFinal = null;
      if (vendedorId !== null && vendedorId !== undefined) {
        const vendedorIdStr = String(vendedorId || '').trim();
        const idevenNum = parseInt(vendedorIdStr, 10);
        const isNumeric = !isNaN(idevenNum) && String(idevenNum) === vendedorIdStr;
        
        console.log(`🔍 Validando vendedor: "${vendedorIdStr}" (numeric: ${isNumeric})`);
        
        const reqCheckVendedor = new sql.Request(tx);
        let vendedorQuery;
        if (isNumeric) {
          reqCheckVendedor.input('ideven', sql.Int, idevenNum);
          vendedorQuery = `
            SELECT CAST(ideven AS VARCHAR(20)) as codi_emple, 
                   LTRIM(RTRIM(COALESCE(codven, CAST(ideven AS VARCHAR(20))))) as codven,
                   LTRIM(RTRIM(nomven)) as nomb_emple, 
                   CAST(Activo AS INT) as activo 
            FROM ven_vendedor 
            WHERE ideven = @ideven AND Activo = 1
          `;
        } else {
          reqCheckVendedor.input('codven', sql.VarChar(20), vendedorIdStr);
          vendedorQuery = `
            SELECT CAST(ideven AS VARCHAR(20)) as codi_emple,
                   LTRIM(RTRIM(COALESCE(codven, CAST(ideven AS VARCHAR(20))))) as codven,
                   LTRIM(RTRIM(nomven)) as nomb_emple, 
                   CAST(Activo AS INT) as activo 
            FROM ven_vendedor 
            WHERE codven = @codven AND Activo = 1
          `;
        }
        const vendedorResult = await reqCheckVendedor.query(vendedorQuery);
        
        if (vendedorResult.recordset.length === 0) {
          await tx.rollback();
          console.error(`❌ Vendedor NO encontrado: "${vendedorIdStr}"`);
          
          return res.status(400).json({ 
            success: false, 
            message: `Vendedor '${vendedorIdStr}' no encontrado o inactivo. Verifique que el vendedor exista en la base de datos.`, 
            error: 'VENDEDOR_NOT_FOUND'
          });
        }
        
        // Para la estructura real, usar codven (código del vendedor), no codi_emple
        // codven es CHAR(10) en ven_pedidos.cod_vendedor
        vendedorIdFinal = vendedorResult.recordset[0].codven || vendedorResult.recordset[0].codi_emple;
        console.log(`✅ Vendedor encontrado: codven="${vendedorIdFinal}" (${vendedorResult.recordset[0].nomb_emple})`);
      }
      
      // Validar y generar número de pedido
      let numeroPedidoFinal = numeroPedido || '';
      const numeroPedidoStr = String(numeroPedidoFinal || '').trim();
      const necesitaGenerar = !numeroPedidoFinal || 
                              numeroPedidoStr === '' || 
                              numeroPedidoStr === 'AUTO' ||
                              numeroPedidoStr.toUpperCase() === 'AUTO';
      
      if (necesitaGenerar) {
        // Generar número automáticamente
        const reqUltimoPed = new sql.Request(tx);
        let siguienteNumero = 1;
        
        try {
          const ultimoPedResult = await reqUltimoPed.query(`
            SELECT numero_pedido 
            FROM ven_pedidos 
            WHERE numero_pedido LIKE 'PED-%'
            ORDER BY numero_pedido DESC
          `);
          
          if (ultimoPedResult.recordset.length > 0) {
            const numeros = ultimoPedResult.recordset
              .map(row => row.numero_pedido)
              .filter(num => num && /^PED-\d+$/.test(String(num).trim()))
              .map(num => {
                const match = String(num).trim().match(/^PED-(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
              })
              .filter(num => num > 0 && !isNaN(num));
            
            if (numeros.length > 0) {
              siguienteNumero = Math.max(...numeros) + 1;
            }
          }
        } catch (error) {
          console.error('⚠️ Error al obtener último número de pedido:', error);
          siguienteNumero = 1;
        }
        
        numeroPedidoFinal = `PED-${String(siguienteNumero).padStart(3, '0')}`;
        console.log(`✅ Número de pedido generado automáticamente: "${numeroPedidoFinal}"`);
      } else {
        // Validar que el número proporcionado no exista ya
        const reqCheckNumPed = new sql.Request(tx);
        reqCheckNumPed.input('numero_pedido', sql.VarChar(50), numeroPedidoStr);
        const pedidoExistente = await reqCheckNumPed.query(`
          SELECT id, numero_pedido 
          FROM ven_pedidos 
          WHERE numero_pedido = @numero_pedido
        `);
        
        if (pedidoExistente.recordset.length > 0) {
          await tx.rollback();
          console.error(`❌ Número de pedido ya existe: "${numeroPedidoStr}"`);
          
          return res.status(400).json({ 
            success: false, 
            message: `El número de pedido '${numeroPedidoStr}' ya existe en la base de datos. Por favor, use un número diferente o omita el campo para generar uno automáticamente.`, 
            error: 'NUMERO_PEDIDO_DUPLICADO',
            numeroPedidoExistente: numeroPedidoStr,
            idPedidoExistente: pedidoExistente.recordset[0].id
          });
        }
        
        console.log(`📝 Número de pedido proporcionado y válido: "${numeroPedidoFinal}"`);
      }
      
      // Generar fechaPedido automáticamente si no se proporciona
      let fechaPedidoFinal = fechaPedido;
      if (!fechaPedidoFinal || fechaPedidoFinal === null || fechaPedidoFinal === undefined || fechaPedidoFinal === '') {
        // Usar fecha actual en formato YYYY-MM-DD
        const fechaActual = new Date();
        const año = fechaActual.getFullYear();
        const mes = String(fechaActual.getMonth() + 1).padStart(2, '0');
        const dia = String(fechaActual.getDate()).padStart(2, '0');
        fechaPedidoFinal = `${año}-${mes}-${dia}`;
        console.log(`📅 Fecha de pedido generada automáticamente: "${fechaPedidoFinal}"`);
      } else {
        console.log(`📅 Fecha de pedido proporcionada: "${fechaPedidoFinal}"`);
      }
      
      const req1 = new sql.Request(tx);
      const estadoMapeado = mapEstadoToDb(estado);
      
      // Insertar con estructura real de la tabla ven_pedidos
      // Columnas reales: id, numero_pedido, fecha_pedido, fecha_entrega_estimada, codter, codven, 
      // empresa_id, codtar, codusu, cotizacion_id, subtotal, descuento_valor, descuento_porcentaje,
      // iva_valor, iva_porcentaje, impoconsumo_valor, total, observaciones, instrucciones_entrega,
      // estado, fec_creacion, fec_modificacion
      const codVendedorFinal = vendedorIdFinal ? String(vendedorIdFinal).trim() : null;
      
      // Normalizar y validar valores numéricos
      // CRÍTICO: Validar todos los valores antes de procesarlos
      const subtotalRaw = subtotal;
      const descuentoValorRaw = descuentoValor;
      const ivaValorRaw = ivaValor;
      const totalRaw = total;
      const impoconsumoValorRaw = impoconsumoValor;
      
      console.log('📊 Valores recibidos del body:', {
        subtotal: subtotalRaw,
        descuentoValor: descuentoValorRaw,
        ivaValor: ivaValorRaw,
        total: totalRaw,
        impoconsumoValor: impoconsumoValorRaw
      });
      
      // Convertir a número y validar
      const subtotalNum = typeof subtotalRaw === 'number' ? subtotalRaw : parseFloat(subtotalRaw);
      const descuentoValorNum = typeof descuentoValorRaw === 'number' ? descuentoValorRaw : parseFloat(descuentoValorRaw);
      const ivaValorNum = typeof ivaValorRaw === 'number' ? ivaValorRaw : parseFloat(ivaValorRaw);
      const totalNum = typeof totalRaw === 'number' ? totalRaw : parseFloat(totalRaw);
      const impoconsumoValorNum = typeof impoconsumoValorRaw === 'number' ? impoconsumoValorRaw : parseFloat(impoconsumoValorRaw);
      
      // Validar que sean números finitos y no NaN
      if (!isFinite(subtotalNum) || isNaN(subtotalNum)) {
        console.error(`❌ subtotal inválido: ${subtotalRaw} → ${subtotalNum}`);
        throw new Error(`subtotal inválido: ${subtotalRaw}`);
      }
      if (!isFinite(totalNum) || isNaN(totalNum)) {
        console.error(`❌ total inválido: ${totalRaw} → ${totalNum}`);
        throw new Error(`total inválido: ${totalRaw}`);
      }
      
      // Validar que sean números finitos y limitar a rango válido para DECIMAL(18,2)
      const maxDecimal18_2 = 9999999999999999.99;
      const subtotalFinal = Math.max(0, Math.min(Math.abs(subtotalNum), maxDecimal18_2));
      const descuentoValorFinal = Math.max(0, Math.min(Math.abs(descuentoValorNum || 0), maxDecimal18_2));
      const ivaValorFinal = Math.max(0, Math.min(Math.abs(ivaValorNum || 0), maxDecimal18_2));
      const totalFinal = Math.max(0, Math.min(Math.abs(totalNum), maxDecimal18_2));
      const impoconsumoValorFinal = Math.max(0, Math.min(Math.abs(impoconsumoValorNum || 0), maxDecimal18_2));
      
      // Validar valores DECIMAL(18,2) sin redondeo - usar valores exactos
      const subtotalFinalLimited = Math.min(subtotalFinal, maxDecimal18_2);
      const descuentoValorFinalLimited = Math.min(descuentoValorFinal, maxDecimal18_2);
      const ivaValorFinalLimited = Math.min(ivaValorFinal, maxDecimal18_2);
      const impoconsumoValorFinalLimited = Math.min(impoconsumoValorFinal, maxDecimal18_2);
      const totalFinalLimited = Math.min(totalFinal, maxDecimal18_2);
      
      // Calcular porcentajes si es necesario - Limitar a rango válido para DECIMAL(5,2) (máx 999.99)
      let descuentoPorcentaje = 0;
      if (subtotalFinalLimited > 0 && subtotalFinalLimited !== Infinity && descuentoValorFinalLimited > 0 && descuentoValorFinalLimited !== Infinity) {
        const descuentoPorcentajeCalc = (descuentoValorFinalLimited / subtotalFinalLimited) * 100;
        // Validar que sea finito antes de limitar
        if (isFinite(descuentoPorcentajeCalc) && !isNaN(descuentoPorcentajeCalc)) {
          descuentoPorcentaje = Math.min(Math.max(descuentoPorcentajeCalc, 0), 999.99);
        }
      }
      
      let ivaPorcentaje = 0;
      const baseParaIva = subtotalFinalLimited - descuentoValorFinalLimited;
      if (baseParaIva > 0 && baseParaIva !== Infinity && ivaValorFinalLimited > 0 && ivaValorFinalLimited !== Infinity) {
        const ivaPorcentajeCalc = (ivaValorFinalLimited / baseParaIva) * 100;
        // Validar que sea finito antes de limitar
        if (isFinite(ivaPorcentajeCalc) && !isNaN(ivaPorcentajeCalc)) {
          ivaPorcentaje = Math.min(Math.max(ivaPorcentajeCalc, 0), 999.99);
        }
      }
      
      // Validación final: asegurar que no sean NaN, Infinity o valores fuera de rango
      if (!isFinite(descuentoPorcentaje) || isNaN(descuentoPorcentaje) || descuentoPorcentaje < 0 || descuentoPorcentaje > 999.99) {
        descuentoPorcentaje = 0;
      }
      if (!isFinite(ivaPorcentaje) || isNaN(ivaPorcentaje) || ivaPorcentaje < 0 || ivaPorcentaje > 999.99) {
        ivaPorcentaje = 0;
      }
      
      // Asegurar que los porcentajes estén dentro del rango válido (sin redondeo)
      descuentoPorcentaje = Math.max(0, Math.min(999.99, descuentoPorcentaje));
      ivaPorcentaje = Math.max(0, Math.min(999.99, ivaPorcentaje));
      
      // Usar valores exactos sin redondeo
      const descuentoPorcentajeFinal = descuentoPorcentaje;
      const ivaPorcentajeFinal = ivaPorcentaje;
      
      // Log de depuración detallado
      console.log('📊 Valores validados para inserción:', {
        subtotal: subtotalFinalLimited,
        descuentoValor: descuentoValorFinalLimited,
        descuentoPorcentaje: descuentoPorcentajeFinal,
        ivaValor: ivaValorFinalLimited,
        ivaPorcentaje: ivaPorcentajeFinal,
        impoconsumoValor: impoconsumoValorFinalLimited,
        total: totalFinalLimited,
        validaciones: {
          subtotalEsFinite: isFinite(subtotalFinalLimited),
          descuentoPorcentajeEnRango: descuentoPorcentajeFinal >= 0 && descuentoPorcentajeFinal <= 999.99,
          ivaPorcentajeEnRango: ivaPorcentajeFinal >= 0 && ivaPorcentajeFinal <= 999.99,
          totalEsFinite: isFinite(totalFinalLimited)
        }
      });
      
      // Validación final antes de insertar - verificar que todos los valores estén en rango
      if (descuentoPorcentajeFinal > 999.99 || descuentoPorcentajeFinal < 0) {
        console.error(`❌ descuentoPorcentaje fuera de rango: ${descuentoPorcentajeFinal}`);
        throw new Error(`descuentoPorcentaje fuera de rango válido (0-999.99): ${descuentoPorcentajeFinal}`);
      }
      if (ivaPorcentajeFinal > 999.99 || ivaPorcentajeFinal < 0) {
        console.error(`❌ ivaPorcentaje fuera de rango: ${ivaPorcentajeFinal}`);
        throw new Error(`ivaPorcentaje fuera de rango válido (0-999.99): ${ivaPorcentajeFinal}`);
      }
      if (subtotalFinalLimited > maxDecimal18_2 || subtotalFinalLimited < 0) {
        console.error(`❌ subtotal fuera de rango: ${subtotalFinalLimited}`);
        throw new Error(`subtotal fuera de rango válido: ${subtotalFinalLimited}`);
      }
      if (totalFinalLimited > maxDecimal18_2 || totalFinalLimited < 0) {
        console.error(`❌ total fuera de rango: ${totalFinalLimited}`);
        throw new Error(`total fuera de rango válido: ${totalFinalLimited}`);
      }
      
      req1.input('numero_pedido', sql.VarChar(50), numeroPedidoFinal);
      req1.input('fecha_pedido', sql.Date, fechaPedidoFinal);
      req1.input('fecha_entrega_estimada', sql.Date, fechaEntregaEstimada || null);
      req1.input('codter', sql.VarChar(20), clienteIdStr);
        if (codVendedorFinal) {
        req1.input('codven', sql.VarChar(20), codVendedorFinal);
        } else {
        req1.input('codven', sql.VarChar(20), null);
      }
      // Validar empresa_id (INT: -2,147,483,648 a 2,147,483,647)
      // empresaId puede venir como string (codalm) o como número
      // Intentar convertir codalm a número, si no es posible, usar 1
      let empresaIdValid = 1;
      try {
        // Intentar convertir el codalm a número
        const empresaIdNum = parseInt(empresaIdStr, 10);
        if (!isNaN(empresaIdNum) && empresaIdNum >= -2147483648 && empresaIdNum <= 2147483647) {
          empresaIdValid = empresaIdNum;
        } else {
          // Si no es un número válido, usar 1 como fallback
          // El almacén ya fue validado arriba, así que sabemos que existe
          empresaIdValid = 1;
        }
      } catch (err) {
        // Si hay error al convertir, usar 1
        empresaIdValid = 1;
      }
      
      // Validar cotizacion_id (INT o NULL)
      let cotizacionIdValid = null;
      if (cotizacionIdFinal !== null && cotizacionIdFinal !== undefined) {
        const cotizacionIdNum = Number(cotizacionIdFinal);
        if (isFinite(cotizacionIdNum) && cotizacionIdNum >= -2147483648 && cotizacionIdNum <= 2147483647) {
          cotizacionIdValid = Math.floor(cotizacionIdNum);
        }
      }
      
      req1.input('empresa_id', sql.Int, empresaIdValid);
      req1.input('codtar', sql.VarChar(20), null); // No se proporciona en el request
      req1.input('codusu', sql.VarChar(20), null); // No se proporciona en el request
      req1.input('cotizacion_id', sql.Int, cotizacionIdValid);
      req1.input('subtotal', sql.Decimal(18, 2), subtotalFinalLimited);
      req1.input('descuento_valor', sql.Decimal(18, 2), descuentoValorFinalLimited);
      req1.input('descuento_porcentaje', sql.Decimal(5, 2), descuentoPorcentajeFinal);
      req1.input('iva_valor', sql.Decimal(18, 2), ivaValorFinalLimited);
      req1.input('iva_porcentaje', sql.Decimal(5, 2), ivaPorcentajeFinal);
      req1.input('impoconsumo_valor', sql.Decimal(18, 2), impoconsumoValorFinalLimited);
      req1.input('total', sql.Decimal(18, 2), totalFinalLimited);
      req1.input('observaciones', sql.VarChar(500), observaciones || '');
      req1.input('instrucciones_entrega', sql.VarChar(500), instruccionesEntrega || '');
      req1.input('estado', sql.VarChar(20), estadoMapeado);
      req1.input('fec_creacion', sql.DateTime, new Date());
      req1.input('fec_modificacion', sql.DateTime, new Date());
      
      const insertHeader = await req1.query(`
          INSERT INTO ven_pedidos (
            numero_pedido, fecha_pedido, fecha_entrega_estimada,
          codter, codven, empresa_id, codtar, codusu, cotizacion_id,
          subtotal, descuento_valor, descuento_porcentaje, iva_valor, iva_porcentaje, 
          impoconsumo_valor, total,
          observaciones, instrucciones_entrega, estado, fec_creacion, fec_modificacion
          ) VALUES (
            @numero_pedido, @fecha_pedido, @fecha_entrega_estimada,
          @codter, @codven, @empresa_id, @codtar, @codusu, @cotizacion_id,
          @subtotal, @descuento_valor, @descuento_porcentaje, @iva_valor, @iva_porcentaje,
          @impoconsumo_valor, @total,
          @observaciones, @instrucciones_entrega, @estado, @fec_creacion, @fec_modificacion
          );
          SELECT SCOPE_IDENTITY() AS id;`);
      const newIdRaw = insertHeader.recordset[0].id;
      
      // Validar que newId sea un número entero válido
      const newIdNum = Number(newIdRaw);
      if (!isFinite(newIdNum) || newIdNum < 1 || newIdNum > 2147483647) {
        throw new Error(`ID de pedido inválido generado: ${newIdRaw}`);
      }
      const newId = Math.floor(newIdNum);
      console.log(`✅ Pedido creado con ID: ${newId}`);

      console.log(`📦 Guardando ${items.length} items de pedido...`);
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const reqDet = new sql.Request(tx);
        console.log(`➕ Insertando item ${idx + 1}/${items.length}:`, { 
          productoId: it.productoId, 
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario,
          descripcion: it.descripcion || '',
          total: it.total
        });
        
        // Validar que el productoId sea numérico (producto_id es INT)
        const productoIdNum = typeof it.productoId === 'number' ? it.productoId : parseInt(it.productoId, 10);
        if (isNaN(productoIdNum)) {
          throw new Error(`Item ${idx + 1}: productoId inválido: ${it.productoId}`);
        }
        
        // Obtener el código del producto (codins) desde inv_insumos
        const reqGetCodins = new sql.Request(tx);
        reqGetCodins.input('productoId', sql.Int, productoIdNum);
        const codinsResult = await reqGetCodins.query(`
          SELECT TOP 1 codins
          FROM inv_insumos
          WHERE id = @productoId
        `);
        
        if (codinsResult.recordset.length === 0) {
          throw new Error(`Item ${idx + 1}: Producto con ID ${productoIdNum} no encontrado en inv_insumos`);
        }
        
        const codins = codinsResult.recordset[0].codins.trim();
        
        // La BD real usa numped (CHAR(8)) en ven_detapedidos
        // Generar numped desde numero_pedido (formato: PED-001 -> PED0001)
          // Extraer número de "PED-001" o "PED001" y formatear a 8 caracteres
        const match = String(numeroPedidoFinal).match(/(\d+)/);
        let numped;
          if (match) {
            numped = 'PED' + match[1].padStart(5, '0');
          } else {
          numped = String(numeroPedidoFinal).replace(/-/g, '').substring(0, 8).padStart(8, '0');
        }
        
        // Asegurar que numped tenga exactamente 8 caracteres
        numped = String(numped).substring(0, 8).padStart(8, '0');
        
        // Normalizar y validar valores numéricos del item
        // CRÍTICO: Validar todos los valores antes de usar parseFloat para evitar overflow
        const cantidadRaw = it.cantidad;
        const precioUnitarioRaw = it.precioUnitario;
        const descuentoValorRaw = it.descuentoValor || it.descuentoPorcentaje || 0;
        const valorIvaRaw = it.valorIva || 0;
        
        // Convertir a número y validar
        const cantidadNum = typeof cantidadRaw === 'number' ? cantidadRaw : parseFloat(cantidadRaw);
        const precioUnitarioNum = typeof precioUnitarioRaw === 'number' ? precioUnitarioRaw : parseFloat(precioUnitarioRaw);
        const descuentoValorNum = typeof descuentoValorRaw === 'number' ? descuentoValorRaw : parseFloat(descuentoValorRaw);
        const valorIvaNum = typeof valorIvaRaw === 'number' ? valorIvaRaw : parseFloat(valorIvaRaw);
        
        // Validar que sean números finitos y no NaN
        if (!isFinite(cantidadNum) || isNaN(cantidadNum)) {
          console.error(`❌ Item ${idx + 1}: cantidad inválida:`, cantidadRaw, '→', cantidadNum);
          throw new Error(`Item ${idx + 1}: cantidad inválida (${cantidadRaw})`);
        }
        if (!isFinite(precioUnitarioNum) || isNaN(precioUnitarioNum)) {
          console.error(`❌ Item ${idx + 1}: precioUnitario inválido:`, precioUnitarioRaw, '→', precioUnitarioNum);
          throw new Error(`Item ${idx + 1}: precioUnitario inválido (${precioUnitarioRaw})`);
        }
        
        // Validar que sean números finitos y limitar a rango válido para DECIMAL(18,2)
        // DECIMAL(18,2) puede almacenar valores hasta 9999999999999999.99
        const maxDecimal18_2 = 9999999999999999.99;
        const minDecimal = 0;
        
        // Asegurar que estén en el rango válido
        // Validar valores sin redondeo - usar valores exactos
        const cantidad = Math.max(minDecimal, Math.min(Math.abs(cantidadNum), maxDecimal18_2));
        const valins = Math.max(minDecimal, Math.min(Math.abs(precioUnitarioNum), maxDecimal18_2));
        const dctped = Math.max(minDecimal, Math.min(Math.abs(descuentoValorNum || 0), maxDecimal18_2));
        const ivaped = Math.max(minDecimal, Math.min(Math.abs(valorIvaNum || 0), maxDecimal18_2));
        
        // Validación final: asegurar que sean números finitos y válidos (sin redondeo)
        const cantidadFinalValid = isFinite(cantidad) && !isNaN(cantidad) ? cantidad : 0;
        const valinsFinalValid = isFinite(valins) && !isNaN(valins) ? valins : 0;
        const dctpedFinalValid = isFinite(dctped) && !isNaN(dctped) ? dctped : 0;
        const ivapedFinalValid = isFinite(ivaped) && !isNaN(ivaped) ? ivaped : 0;
        
        // Log de depuración detallado para items
        console.log(`📦 Item ${idx + 1} - Valores originales:`, {
          cantidadRaw,
          precioUnitarioRaw,
          descuentoValorRaw,
          valorIvaRaw
        });
        console.log(`📦 Item ${idx + 1} - Valores validados:`, {
          cantidad: cantidadFinalValid,
          valins: valinsFinalValid,
          dctped: dctpedFinalValid,
          ivaped: ivapedFinalValid,
          isFinite: {
            cantidad: isFinite(cantidadFinalValid),
            valins: isFinite(valinsFinalValid),
            dctped: isFinite(dctpedFinalValid),
            ivaped: isFinite(ivapedFinalValid)
          }
        });
        
        // Formatear codalm correctamente (CHAR(3))
        // Usar el codalm del almacén validado arriba
        const codalmFormatted = empresaIdStr.substring(0, 3).padStart(3, '0');
        
        reqDet.input('numped', sql.Char(8), numped.substring(0, 8).padStart(8, '0'));
        reqDet.input('codins', sql.Char(8), codins.substring(0, 8).padStart(8, '0'));
        reqDet.input('valins', sql.Decimal(18, 2), valinsFinalValid);
        reqDet.input('canped', sql.Decimal(18, 2), cantidadFinalValid);
        reqDet.input('ivaped', sql.Decimal(18, 2), ivapedFinalValid);
        reqDet.input('dctped', sql.Decimal(18, 2), dctpedFinalValid);
        reqDet.input('estped', sql.Char(1), 'B'); // B=BORRADOR
        reqDet.input('codalm', sql.Char(3), codalmFormatted);
        reqDet.input('pedido_id', sql.Int, newId); // Relación con ven_pedidos.id (ya validado arriba)
        reqDet.input('feccargo', sql.Date, fechaPedidoFinal); // Fecha de cargo
        reqDet.input('codtec', sql.VarChar(20), ''); // Código técnico (requerido, usar string vacío si no se proporciona)
        
        await reqDet.query(`
          INSERT INTO ven_detapedidos (
            numped, codins, valins, canped, ivaped, dctped,
            estped, codalm, pedido_id, feccargo, codtec, Fecsys
          ) VALUES (
            @numped, @codins, @valins, @canped, @ivaped, @dctped,
            @estped, @codalm, @pedido_id, @feccargo, @codtec, GETDATE()
          );`);
        console.log(`✅ Item ${idx + 1} guardado correctamente`);
      }
      console.log(`✅ Todos los ${items.length} items de pedido guardados`);

      await tx.commit();
      console.log(`✅ Pedido guardado exitosamente con ID: ${newId}`);
      res.json({ success: true, data: { id: newId } });
    } catch (inner) {
      if (tx) {
        try {
          await tx.rollback();
          console.error('❌ Transacción revertida debido a error');
        } catch (rollbackError) {
          console.error('❌ Error al hacer rollback:', rollbackError);
        }
      }
      throw inner;
    }
  } catch (error) {
    console.error('❌❌❌ ERROR CREANDO PEDIDO ❌❌❌');
    console.error('Mensaje:', error.message);
    console.error('Stack trace:', error.stack);
    if (error.originalError) {
      console.error('Error original:', error.originalError.message);
      if (error.originalError.info) {
        console.error('Info SQL:', error.originalError.info.message);
        console.error('Número de error SQL:', error.originalError.info.number);
        console.error('Estado SQL:', error.originalError.info.state);
        console.error('Clase SQL:', error.originalError.info.class);
        console.error('Procedimiento SQL:', error.originalError.info.procName);
        console.error('Línea SQL:', error.originalError.info.lineNumber);
      }
    }
    console.error('Error completo:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    const errorMessage = error.message || 'Error desconocido al crear pedido';
    const errorDetails = error.originalError?.info || error.originalError?.message || null;
    
    res.status(500).json({ 
      success: false, 
      message: 'Error creando pedido', 
      error: errorMessage,
      details: errorDetails,
      sqlMessage: process.env.NODE_ENV === 'development' ? error.originalError?.info?.message : undefined,
      originalError: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// --- ACTUALIZAR PEDIDO ---
app.put('/api/pedidos/:id', async (req, res) => {
  console.log(`✅ Endpoint PUT /api/pedidos/:id alcanzado`);
  console.log(`   Params:`, req.params);
  console.log(`   Method:`, req.method);
  console.log(`   Path:`, req.path);
  const { id } = req.params;
  const body = req.body || {};
  const idNum = parseInt(id, 10);
  
  if (isNaN(idNum)) {
    return res.status(400).json({ 
      success: false, 
      message: `ID de pedido inválido: ${id}`,
      error: 'INVALID_ID'
    });
  }
  
  console.log(`📥 Recibida solicitud PUT /api/pedidos/${idNum} (tipo: ${typeof idNum}) con body:`, JSON.stringify(body, null, 2));
  
  try {
    const pool = await getConnection();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    
    try {
      // Primero verificar que el pedido existe y obtener su estado actual
      const reqCheck = new sql.Request(tx);
      reqCheck.input('pedidoId', sql.Int, idNum);
      const checkResult = await reqCheck.query(`
        SELECT id, numero_pedido, estado, numero_pedido as numeroPedido
        FROM ven_pedidos 
        WHERE id = @pedidoId
      `);
      
      if (checkResult.recordset.length === 0) {
        await tx.rollback();
        return res.status(404).json({ 
          success: false, 
          message: `Pedido con ID ${idNum} no existe en la base de datos` 
        });
      }
      
      const pedidoActual = checkResult.recordset[0];
      const estadoActual = mapEstadoFromDb(pedidoActual.estado);
      
      // Validar que el pedido puede ser editado
      // Solo se pueden editar pedidos en estado BORRADOR o ENVIADA
      // No se pueden editar pedidos CONFIRMADO, EN_PROCESO, PARCIALMENTE_REMITIDO, REMITIDO, CANCELADO
      const estadosNoEditables = ['CONFIRMADO', 'EN_PROCESO', 'PARCIALMENTE_REMITIDO', 'REMITIDO', 'CANCELADO'];
      if (estadosNoEditables.includes(estadoActual)) {
        await tx.rollback();
        return res.status(400).json({ 
          success: false, 
          message: `No se puede editar un pedido en estado '${estadoActual}'. Solo se pueden editar pedidos en estado BORRADOR o ENVIADA.`,
          error: 'PEDIDO_NO_EDITABLE',
          estadoActual: estadoActual
        });
      }
      
      console.log(`✅ Pedido encontrado: ${pedidoActual.numeroPedido}, estado actual: ${estadoActual}`);
      
      const reqUpdate = new sql.Request(tx);
      
      // Construir campos a actualizar dinámicamente
      const updates = [];
      
      if (body.estado !== undefined) {
        const estadoMapeado = mapEstadoToDb(body.estado);
        updates.push('estado = @estado');
        reqUpdate.input('estado', sql.VarChar(20), estadoMapeado);
        console.log(`🔄 Actualizando estado: ${body.estado} -> ${estadoMapeado}`);
      }
      
      if (body.fechaPedido !== undefined) {
        updates.push('fecha_pedido = @fecha_pedido');
        reqUpdate.input('fecha_pedido', sql.Date, body.fechaPedido);
      }
      
      if (body.fechaEntregaEstimada !== undefined) {
        updates.push('fecha_entrega_estimada = @fecha_entrega_estimada');
        reqUpdate.input('fecha_entrega_estimada', sql.Date, body.fechaEntregaEstimada || null);
      }
      
      if (body.observaciones !== undefined) {
        updates.push('observaciones = @observaciones');
        reqUpdate.input('observaciones', sql.VarChar(500), body.observaciones || '');
      }
      
      if (body.instruccionesEntrega !== undefined) {
        updates.push('instrucciones_entrega = @instrucciones_entrega');
        reqUpdate.input('instrucciones_entrega', sql.VarChar(500), body.instruccionesEntrega || '');
      }
      
      // Validar y normalizar valores numéricos (SIN redondeo - usar valores exactos de la BD)
      const maxDecimal18_2 = 9999999999999999.99;
      
      if (body.subtotal !== undefined) {
        const subtotalNum = Number(body.subtotal) || 0;
        if (!isFinite(subtotalNum)) {
          throw new Error(`subtotal inválido: ${body.subtotal}`);
        }
        const subtotalFinal = Math.max(0, Math.min(Math.abs(subtotalNum), maxDecimal18_2));
        if (subtotalFinal > maxDecimal18_2 || subtotalFinal < 0) {
          throw new Error(`subtotal fuera de rango válido: ${subtotalFinal}`);
        }
        updates.push('subtotal = @subtotal');
        reqUpdate.input('subtotal', sql.Decimal(18, 2), subtotalFinal);
      }
      
      if (body.descuentoValor !== undefined) {
        const descuentoNum = Number(body.descuentoValor) || 0;
        if (!isFinite(descuentoNum)) {
          throw new Error(`descuentoValor inválido: ${body.descuentoValor}`);
        }
        const descuentoFinal = Math.max(0, Math.min(Math.abs(descuentoNum), maxDecimal18_2));
        if (descuentoFinal > maxDecimal18_2 || descuentoFinal < 0) {
          throw new Error(`descuentoValor fuera de rango válido: ${descuentoFinal}`);
        }
        updates.push('descuento_valor = @descuento_valor');
        reqUpdate.input('descuento_valor', sql.Decimal(18, 2), descuentoFinal);
      }
      
      if (body.ivaValor !== undefined) {
        const ivaNum = Number(body.ivaValor) || 0;
        if (!isFinite(ivaNum)) {
          throw new Error(`ivaValor inválido: ${body.ivaValor}`);
        }
        const ivaFinal = Math.max(0, Math.min(Math.abs(ivaNum), maxDecimal18_2));
        if (ivaFinal > maxDecimal18_2 || ivaFinal < 0) {
          throw new Error(`ivaValor fuera de rango válido: ${ivaFinal}`);
        }
        updates.push('iva_valor = @iva_valor');
        reqUpdate.input('iva_valor', sql.Decimal(18, 2), ivaFinal);
      }
      
      if (body.total !== undefined) {
        const totalNum = Number(body.total) || 0;
        if (!isFinite(totalNum)) {
          throw new Error(`total inválido: ${body.total}`);
        }
        const totalFinal = Math.max(0, Math.min(Math.abs(totalNum), maxDecimal18_2));
        if (totalFinal > maxDecimal18_2 || totalFinal < 0) {
          throw new Error(`total fuera de rango válido: ${totalFinal}`);
        }
        updates.push('total = @total');
        reqUpdate.input('total', sql.Decimal(18, 2), totalFinal);
      }
      
      // Siempre actualizar fec_modificacion
      updates.push('fec_modificacion = @fec_modificacion');
      reqUpdate.input('fec_modificacion', sql.DateTime, new Date());
      
      if (updates.length === 0) {
        await tx.rollback();
        return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
      }
      
      reqUpdate.input('pedidoId', sql.Int, idNum);
      
      const updateQuery = `
        UPDATE ven_pedidos 
        SET ${updates.join(', ')}
        WHERE id = @pedidoId;
        SELECT * FROM ven_pedidos WHERE id = @pedidoId;
      `;
      
      console.log(`🔍 Ejecutando query de actualización para pedido ID: ${idNum}`);
      const result = await reqUpdate.query(updateQuery);
      
      // Si se envían items, actualizar los items del pedido
      if (body.items && Array.isArray(body.items) && body.items.length > 0) {
        console.log(`📦 Actualizando ${body.items.length} items del pedido...`);
        
        // Obtener el numero_pedido y empresa_id del pedido existente para generar numped y codalm
        const pedidoActualizado = result.recordset[0];
        const numeroPedidoFinal = pedidoActualizado?.numero_pedido || pedidoActual.numeroPedido;
        const empresaIdDelPedido = pedidoActualizado?.empresa_id || pedidoActual.empresa_id || 1;
        
        // Obtener codalm del almacén asociado al pedido
        let codalmDelPedido = '001';
        try {
          const reqAlmacen = new sql.Request(tx);
          reqAlmacen.input('empresaId', sql.Int, empresaIdDelPedido);
          const almacenResult = await reqAlmacen.query(`
            SELECT TOP 1 codalm
            FROM inv_almacen
            WHERE CAST(codalm AS INT) = @empresaId OR codalm = CAST(@empresaId AS VARCHAR(10))
          `);
          if (almacenResult.recordset.length > 0) {
            codalmDelPedido = almacenResult.recordset[0].codalm.trim();
          }
        } catch (err) {
          console.warn(`⚠️ No se pudo obtener codalm del pedido, usando '001': ${err.message}`);
        }
        
        const match = String(numeroPedidoFinal).match(/(\d+)/);
        let numped;
        if (match) {
          numped = 'PED' + match[1].padStart(5, '0');
        } else {
          numped = String(numeroPedidoFinal).replace(/-/g, '').substring(0, 8).padStart(8, '0');
        }
        numped = String(numped).substring(0, 8).padStart(8, '0');
        
        // Eliminar items antiguos
        const reqDeleteItems = new sql.Request(tx);
        reqDeleteItems.input('pedidoId', sql.Int, idNum);
        await reqDeleteItems.query(`DELETE FROM ven_detapedidos WHERE pedido_id = @pedidoId`);
        console.log(`🗑️ Items antiguos eliminados`);
        
        // Insertar nuevos items
        for (let idx = 0; idx < body.items.length; idx++) {
          const it = body.items[idx];
          const reqDet = new sql.Request(tx);
          
          // Validar productoId
          const productoIdNum = typeof it.productoId === 'number' ? it.productoId : parseInt(it.productoId, 10);
          if (isNaN(productoIdNum)) {
            throw new Error(`Item ${idx + 1}: productoId inválido: ${it.productoId}`);
          }
          
          // Obtener codins del producto
          const reqGetCodins = new sql.Request(tx);
          reqGetCodins.input('productoId', sql.Int, productoIdNum);
          const codinsResult = await reqGetCodins.query(`
            SELECT TOP 1 codins
            FROM inv_insumos
            WHERE id = @productoId
          `);
          
          if (codinsResult.recordset.length === 0) {
            throw new Error(`Item ${idx + 1}: Producto con ID ${productoIdNum} no encontrado en inv_insumos`);
          }
          
          const codins = codinsResult.recordset[0].codins.trim();
          
          // Validar y normalizar valores numéricos (igual que en POST)
          const cantidadRaw = it.cantidad;
          const precioUnitarioRaw = it.precioUnitario;
          const descuentoValorRaw = it.descuentoValor || it.descuentoPorcentaje || 0;
          const valorIvaRaw = it.valorIva || 0;
          
          const cantidadNum = typeof cantidadRaw === 'number' ? cantidadRaw : parseFloat(cantidadRaw);
          const precioUnitarioNum = typeof precioUnitarioRaw === 'number' ? precioUnitarioRaw : parseFloat(precioUnitarioRaw);
          const descuentoValorNum = typeof descuentoValorRaw === 'number' ? descuentoValorRaw : parseFloat(descuentoValorRaw);
          const valorIvaNum = typeof valorIvaRaw === 'number' ? valorIvaRaw : parseFloat(valorIvaRaw);
          
          if (!isFinite(cantidadNum) || isNaN(cantidadNum)) {
            throw new Error(`Item ${idx + 1}: cantidad inválida (${cantidadRaw})`);
          }
          if (!isFinite(precioUnitarioNum) || isNaN(precioUnitarioNum)) {
            throw new Error(`Item ${idx + 1}: precioUnitario inválido (${precioUnitarioRaw})`);
          }
          
          // Validar y normalizar valores (SIN redondeo - usar valores exactos de la BD)
          const maxDecimal18_2 = 9999999999999999.99;
          
          // Validar que sean finitos y dentro del rango permitido
          if (!isFinite(cantidadNum) || cantidadNum < 0 || cantidadNum > maxDecimal18_2) {
            throw new Error(`Item ${idx + 1}: cantidad fuera de rango válido: ${cantidadNum}`);
          }
          if (!isFinite(precioUnitarioNum) || precioUnitarioNum < 0 || precioUnitarioNum > maxDecimal18_2) {
            throw new Error(`Item ${idx + 1}: precioUnitario fuera de rango válido: ${precioUnitarioNum}`);
          }
          if (!isFinite(descuentoValorNum) || descuentoValorNum < 0 || descuentoValorNum > maxDecimal18_2) {
            throw new Error(`Item ${idx + 1}: descuentoValor fuera de rango válido: ${descuentoValorNum}`);
          }
          if (!isFinite(valorIvaNum) || valorIvaNum < 0 || valorIvaNum > maxDecimal18_2) {
            throw new Error(`Item ${idx + 1}: valorIva fuera de rango válido: ${valorIvaNum}`);
          }
          
          // Usar valores exactos sin redondeo
          const cantidadFinal = Math.max(0, Math.abs(cantidadNum));
          const valinsFinal = Math.max(0, Math.abs(precioUnitarioNum));
          const dctpedFinal = Math.max(0, Math.abs(descuentoValorNum || 0));
          const ivapedFinal = Math.max(0, Math.abs(valorIvaNum || 0));
          
          // Usar codalm del pedido existente, no del body
          const codalmFormatted = codalmDelPedido.substring(0, 3).padStart(3, '0');
          
          reqDet.input('numped', sql.Char(8), numped);
          reqDet.input('codins', sql.Char(8), codins.substring(0, 8).padStart(8, '0'));
          reqDet.input('valins', sql.Decimal(18, 2), valinsFinal);
          reqDet.input('canped', sql.Decimal(18, 2), cantidadFinal);
          reqDet.input('ivaped', sql.Decimal(18, 2), ivapedFinal);
          reqDet.input('dctped', sql.Decimal(18, 2), dctpedFinal);
          reqDet.input('estped', sql.Char(1), 'B');
          reqDet.input('codalm', sql.Char(3), codalmFormatted);
          reqDet.input('pedido_id', sql.Int, idNum);
          reqDet.input('feccargo', sql.Date, body.fechaPedido || new Date().toISOString().split('T')[0]);
          reqDet.input('codtec', sql.VarChar(20), '');
          
          await reqDet.query(`
            INSERT INTO ven_detapedidos (
              numped, codins, valins, canped, ivaped, dctped,
              estped, codalm, pedido_id, feccargo, codtec, Fecsys
            ) VALUES (
              @numped, @codins, @valins, @canped, @ivaped, @dctped,
              @estped, @codalm, @pedido_id, @feccargo, @codtec, GETDATE()
            );`);
          console.log(`✅ Item ${idx + 1} actualizado correctamente`);
        }
        console.log(`✅ Todos los ${body.items.length} items del pedido actualizados`);
      }
      
      console.log(`📊 Resultados de la actualización:`, {
        rowsAffected: result.rowsAffected,
        recordsetLength: result.recordset?.length || 0,
        recordset: result.recordset
      });
      
      if (result.recordset.length === 0) {
        await tx.rollback();
        console.error(`❌ Pedido con ID ${idNum} no encontrado después de actualizar`);
        
        // Verificar si el pedido existe antes de actualizar
        const reqCheck = new sql.Request(tx);
        reqCheck.input('pedidoId', sql.Int, idNum);
        const checkResult = await reqCheck.query('SELECT id, numero_pedido, estado, empresa_id FROM ven_pedidos WHERE id = @pedidoId');
        
        if (checkResult.recordset.length === 0) {
          return res.status(404).json({ 
            success: false, 
            message: `Pedido con ID ${idNum} no existe en la base de datos` 
          });
        } else {
          return res.status(500).json({ 
            success: false, 
            message: `Pedido existe pero no se pudo actualizar. Verifique los logs del servidor.` 
          });
        }
      }
      
      await tx.commit();
      
      const updatedPedido = result.recordset[0];
      console.log('✅ Pedido actualizado exitosamente:', {
        id: updatedPedido.id,
        numeroPedido: updatedPedido.numero_pedido,
        estado: updatedPedido.estado,
        estadoMapeado: mapEstadoFromDb(updatedPedido.estado)
      });
      
      res.json({ 
        success: true, 
        data: {
          id: updatedPedido.id,
          numeroPedido: updatedPedido.numero_pedido,
          estado: mapEstadoFromDb(updatedPedido.estado),
          fechaPedido: updatedPedido.fecha_pedido,
          fechaEntregaEstimada: updatedPedido.fecha_entrega_estimada,
          observaciones: updatedPedido.observaciones,
          subtotal: updatedPedido.subtotal,
          descuentoValor: updatedPedido.descuento_valor,
          ivaValor: updatedPedido.iva_valor,
          total: updatedPedido.total
        }
      });
    } catch (inner) {
      await tx.rollback();
      console.error('❌ Error interno en transacción:', inner);
      throw inner;
    }
  } catch (error) {
    console.error('❌ Error actualizando pedido:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: `Error actualizando pedido: ${error.message}`, 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// --- CREAR REMISIÓN ---
app.post('/api/remisiones', async (req, res) => {
  const body = req.body || {};
  console.log('📥 Recibida solicitud POST /api/remisiones');
  console.log('📥 Body recibido:', JSON.stringify(body, null, 2));
  try {
    const {
      numeroRemision, fechaRemision, fechaDespacho,
      pedidoId, facturaId, clienteId, vendedorId,
      subtotal, descuentoValor = 0, ivaValor = 0, total = 0,
      observaciones = '', estado = 'BORRADOR',
      estadoEnvio = 'Total', metodoEnvio, transportadoraId, transportadora, numeroGuia,
      empresaId, codalm, codusu, items = []
    } = body;

    console.log('📋 Datos parseados:', {
      clienteId,
      pedidoId,
      vendedorId,
      itemsCount: Array.isArray(items) ? items.length : 'NO ES ARRAY',
      items: Array.isArray(items) ? items : 'NO ES ARRAY',
      transportadoraId,
      empresaId
    });

    if (!clienteId) {
      return res.status(400).json({ 
        success: false, 
        message: 'clienteId es requerido para crear remisión',
        error: 'MISSING_CLIENTE_ID',
        received: { clienteId, itemsCount: Array.isArray(items) ? items.length : 'NO ES ARRAY' }
      });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({ 
        success: false, 
        message: 'items debe ser un array',
        error: 'INVALID_ITEMS_FORMAT',
        received: { items, itemsType: typeof items }
      });
    }

    if (items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Debe incluir al menos un item para crear remisión',
        error: 'EMPTY_ITEMS',
        received: { itemsCount: items.length }
      });
    }

    const pool = await getConnection();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      // Validar que el pedidoId existe si se proporciona
      let pedidoIdFinal = null;
      if (pedidoId !== null && pedidoId !== undefined) {
        const pedidoIdNum = typeof pedidoId === 'number' ? pedidoId : parseInt(pedidoId, 10);
        if (!isNaN(pedidoIdNum)) {
          console.log(`🔍 Validando pedidoId: ${pedidoIdNum}`);
          
          const reqCheckPed = new sql.Request(tx);
          reqCheckPed.input('pedidoId', sql.Int, pedidoIdNum);
          const pedidoResult = await reqCheckPed.query(`
            SELECT id, numero_pedido, estado 
            FROM ven_pedidos 
            WHERE id = @pedidoId
          `);
          
          if (pedidoResult.recordset.length === 0) {
            await tx.rollback();
            console.error(`❌ Pedido NO encontrado: pedidoId="${pedidoIdNum}"`);
            
            return res.status(400).json({ 
              success: false, 
              message: `Pedido con ID '${pedidoIdNum}' no encontrado. Verifique que el pedido exista en la base de datos.`, 
              error: 'PEDIDO_NOT_FOUND'
            });
          }
          
          pedidoIdFinal = pedidoResult.recordset[0].id;
          console.log(`✅ Pedido encontrado: id=${pedidoIdFinal}, numero_pedido=${pedidoResult.recordset[0].numero_pedido}`);
        } else {
          await tx.rollback();
          return res.status(400).json({ 
            success: false, 
            message: `pedidoId inválido: '${pedidoId}'. Debe ser un número entero.`, 
            error: 'INVALID_PEDIDO_ID' 
          });
        }
      }
      
      // Validar que el facturaId existe si se proporciona
      let facturaIdFinal = null;
      if (facturaId !== null && facturaId !== undefined) {
        const facturaIdNum = typeof facturaId === 'number' ? facturaId : parseInt(facturaId, 10);
        if (!isNaN(facturaIdNum)) {
          console.log(`🔍 Validando facturaId: ${facturaIdNum}`);
          
          const reqCheckFact = new sql.Request(tx);
          reqCheckFact.input('facturaId', sql.Int, facturaIdNum);
          const facturaResult = await reqCheckFact.query(`
            SELECT id, numero_factura, estado 
            FROM ven_facturas 
            WHERE id = @facturaId
          `);
          
          if (facturaResult.recordset.length === 0) {
            await tx.rollback();
            console.error(`❌ Factura NO encontrada: facturaId="${facturaIdNum}"`);
            
            return res.status(400).json({ 
              success: false, 
              message: `Factura con ID '${facturaIdNum}' no encontrada. Verifique que la factura exista en la base de datos.`, 
              error: 'FACTURA_NOT_FOUND'
            });
          }
          
          facturaIdFinal = facturaResult.recordset[0].id;
          console.log(`✅ Factura encontrada: id=${facturaIdFinal}, numero_factura=${facturaResult.recordset[0].numero_factura}`);
        } else {
          await tx.rollback();
          return res.status(400).json({ 
            success: false, 
            message: `facturaId inválido: '${facturaId}'. Debe ser un número entero.`, 
            error: 'INVALID_FACTURA_ID' 
          });
        }
      }
      
      // Validar que el cliente existe
      const clienteIdStr = String(clienteId || '').trim();
      console.log(`🔍 Validando cliente: "${clienteIdStr}"`);
      
      const reqCheckCliente = new sql.Request(tx);
      reqCheckCliente.input('codter', sql.VarChar(50), clienteIdStr);
      const clienteResult = await reqCheckCliente.query(`
        SELECT codter, id, nomter, activo 
        FROM con_terceros 
        WHERE codter = @codter AND activo = 1
      `);
      
      if (clienteResult.recordset.length === 0) {
        await tx.rollback();
        console.error(`❌ Cliente NO encontrado: codter="${clienteIdStr}"`);
        
        return res.status(400).json({ 
          success: false, 
          message: `Cliente con codter '${clienteIdStr}' no encontrado o inactivo. Verifique que el cliente exista en la base de datos.`, 
          error: 'CLIENTE_NOT_FOUND'
        });
      }
      
      console.log(`✅ Cliente encontrado: codter="${clienteIdStr}" (${clienteResult.recordset[0].nomter})`);
      
      // Validar que el vendedor existe si se proporciona (vendedorId es opcional)
      let vendedorIdFinal = null;
      if (vendedorId !== null && vendedorId !== undefined && String(vendedorId).trim() !== '') {
        const vendedorIdStr = String(vendedorId || '').trim();
        const idevenNum = parseInt(vendedorIdStr, 10);
        const isNumeric = !isNaN(idevenNum) && String(idevenNum) === vendedorIdStr;
        
        console.log(`🔍 Validando vendedor: "${vendedorIdStr}" (numeric: ${isNumeric})`);
        
        const reqCheckVendedor = new sql.Request(tx);
        let vendedorQuery;
        if (isNumeric) {
          reqCheckVendedor.input('ideven', sql.Int, idevenNum);
          vendedorQuery = `
            SELECT CAST(ideven AS VARCHAR(20)) as codi_emple, LTRIM(RTRIM(nomven)) as nomb_emple, CAST(Activo AS INT) as activo 
          FROM ven_vendedor 
            WHERE ideven = @ideven AND Activo = 1
          `;
        } else {
          reqCheckVendedor.input('codven', sql.VarChar(20), vendedorIdStr);
          vendedorQuery = `
            SELECT CAST(ideven AS VARCHAR(20)) as codi_emple, LTRIM(RTRIM(nomven)) as nomb_emple, CAST(Activo AS INT) as activo 
            FROM ven_vendedor 
            WHERE codven = @codven AND Activo = 1
          `;
        }
        const vendedorResult = await reqCheckVendedor.query(vendedorQuery);
        
        if (vendedorResult.recordset.length === 0) {
          await tx.rollback();
          console.error(`❌ Vendedor NO encontrado: "${vendedorIdStr}"`);
          
          return res.status(400).json({ 
            success: false, 
            message: `Vendedor '${vendedorIdStr}' no encontrado o inactivo. Verifique que el vendedor exista en la base de datos.`, 
            error: 'VENDEDOR_NOT_FOUND'
          });
        }
        
        vendedorIdFinal = vendedorResult.recordset[0].codi_emple;
        console.log(`✅ Vendedor encontrado: "${vendedorIdFinal}" (${vendedorResult.recordset[0].nomb_emple})`);
      } else {
        console.log(`ℹ️ Vendedor no proporcionado o vacío, continuando sin validar vendedor`);
      }
      
      // Validar que transportadoraId existe si se proporciona
      let transportadoraIdFinal = null;
      const transportadoraIdStr = transportadoraId !== null && transportadoraId !== undefined ? String(transportadoraId).trim() : '';
      
      // Solo validar si transportadoraId tiene un valor no vacío
      if (transportadoraIdStr && transportadoraIdStr !== '') {
        console.log(`🔍 Validando transportadoraId: "${transportadoraIdStr}"`);
        
        try {
          const reqCheckTransp = new sql.Request(tx);
          reqCheckTransp.input('transportadoraId', sql.VarChar(36), transportadoraIdStr);
          const transportadoraResult = await reqCheckTransp.query(`
            SELECT id, nombre, activo 
            FROM transportadoras 
            WHERE id = @transportadoraId AND activo = 1
          `);
          
          if (transportadoraResult.recordset.length === 0) {
            // Obtener ejemplos de transportadoras disponibles ANTES del rollback
            const reqDebugTransp = new sql.Request(tx);
            let debugTranspResult;
            try {
              debugTranspResult = await reqDebugTransp.query(`
                SELECT TOP 5 id, nombre, activo 
                FROM transportadoras 
                WHERE activo = 1
                ORDER BY nombre
              `);
            } catch (err) {
              console.error('Error obteniendo ejemplos de transportadoras:', err);
            }
            
            await tx.rollback();
            console.error(`❌ Transportadora NO encontrada: transportadoraId="${transportadoraIdStr}"`);
            
            return res.status(400).json({ 
              success: false, 
              message: `Transportadora con ID '${transportadoraIdStr}' no encontrada o inactiva. Verifique que la transportadora exista en la base de datos.`, 
              error: 'TRANSPORTADORA_NOT_FOUND',
              debug: {
                transportadoraIdRecibido: transportadoraIdStr,
                tipoRecibido: typeof transportadoraId,
                ejemplosTransportadoras: debugTranspResult?.recordset || []
              }
            });
          }
          
          transportadoraIdFinal = transportadoraResult.recordset[0].id;
          console.log(`✅ Transportadora encontrada: id="${transportadoraIdFinal}" (${transportadoraResult.recordset[0].nombre})`);
        } catch (validationError) {
          await tx.rollback();
          console.error(`❌ Error al validar transportadora:`, validationError);
          return res.status(400).json({ 
            success: false, 
            message: `Error al validar transportadora: ${validationError.message}`, 
            error: 'TRANSPORTADORA_VALIDATION_ERROR',
            transportadoraIdRecibido: transportadoraIdStr
          });
        }
      } else if (transportadoraId !== null && transportadoraId !== undefined) {
        // Si se envía un valor pero está vacío después de trim, es un error
        console.warn(`⚠️ transportadoraId proporcionado pero vacío: "${transportadoraId}"`);
      }
      
      // Validar y generar número de remisión
      let numeroRemisionFinal = numeroRemision || '';
      const numeroRemisionStr = String(numeroRemisionFinal || '').trim();
      const necesitaGenerar = !numeroRemisionFinal || 
                              numeroRemisionStr === '' || 
                              numeroRemisionStr === 'AUTO' ||
                              numeroRemisionStr.toUpperCase() === 'AUTO';
      
      if (necesitaGenerar) {
        // Generar número automáticamente
        const reqUltimaRem = new sql.Request(tx);
        let siguienteNumero = 1;
        
        try {
          const ultimaRemResult = await reqUltimaRem.query(`
            SELECT numero_remision 
            FROM ${TABLE_NAMES.remisiones} 
            WHERE numero_remision LIKE 'REM-%'
            ORDER BY numero_remision DESC
          `);
          
          if (ultimaRemResult.recordset.length > 0) {
            const numeros = ultimaRemResult.recordset
              .map(row => row.numero_remision)
              .filter(num => num && /^REM-\d+$/.test(String(num).trim()))
              .map(num => {
                const match = String(num).trim().match(/^REM-(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
              })
              .filter(num => num > 0 && !isNaN(num));
            
            if (numeros.length > 0) {
              siguienteNumero = Math.max(...numeros) + 1;
            }
          }
        } catch (error) {
          console.error('⚠️ Error al obtener último número de remisión:', error);
          siguienteNumero = 1;
        }
        
        numeroRemisionFinal = `REM-${String(siguienteNumero).padStart(3, '0')}`;
        console.log(`✅ Número de remisión generado automáticamente: "${numeroRemisionFinal}"`);
      } else {
        // Validar que el número proporcionado no exista ya
        const reqCheckNumRem = new sql.Request(tx);
        reqCheckNumRem.input('numero_remision', sql.VarChar(50), numeroRemisionStr);
        const remisionExistente = await reqCheckNumRem.query(`
          SELECT id, numero_remision 
          FROM ${TABLE_NAMES.remisiones} 
          WHERE numero_remision = @numero_remision
        `);
        
        if (remisionExistente.recordset.length > 0) {
          await tx.rollback();
          console.error(`❌ Número de remisión ya existe: "${numeroRemisionStr}"`);
          
          return res.status(400).json({ 
            success: false, 
            message: `El número de remisión '${numeroRemisionStr}' ya existe en la base de datos. Por favor, use un número diferente o omita el campo para generar uno automáticamente.`, 
            error: 'NUMERO_REMISION_DUPLICADO',
            numeroRemisionExistente: numeroRemisionStr,
            idRemisionExistente: remisionExistente.recordset[0].id
          });
        }
        
        console.log(`📝 Número de remisión proporcionado y válido: "${numeroRemisionFinal}"`);
      }
      
      // Generar fecha de remisión automáticamente si no se proporciona
      let fechaRemisionFinal = fechaRemision;
      if (!fechaRemisionFinal || fechaRemisionFinal === null || fechaRemisionFinal === undefined || fechaRemisionFinal === '') {
        // Usar fecha actual en formato YYYY-MM-DD
        const fechaActual = new Date();
        const año = fechaActual.getFullYear();
        const mes = String(fechaActual.getMonth() + 1).padStart(2, '0');
        const dia = String(fechaActual.getDate()).padStart(2, '0');
        fechaRemisionFinal = `${año}-${mes}-${dia}`;
        console.log(`📅 Fecha de remisión generada automáticamente: "${fechaRemisionFinal}"`);
      } else {
        console.log(`📅 Fecha de remisión proporcionada: "${fechaRemisionFinal}"`);
      }
      
      const req1 = new sql.Request(tx);
      const estadoMapeado = estado || 'BORRADOR'; // Usar estado directamente sin mapeo
      
      // Validar codalm (requerido en ven_remiciones_enc)
      // Si viene empresaId, usarlo como codalm, sino usar el codalm del body o '001'
      const codalmFinal = codalm || empresaId || '001'; // Valor por defecto si no se proporciona
      
      console.log('📝 Preparando INSERT en ven_remiciones_enc con los siguientes valores:');
      console.log(`   - codalm: "${codalmFinal}"`);
      console.log(`   - numero_remision: "${numeroRemisionFinal}"`);
      console.log(`   - fecha_remision: "${fechaRemisionFinal}"`);
      console.log(`   - pedido_id: ${pedidoIdFinal}`);
      console.log(`   - codter: "${clienteIdStr}"`);
      console.log(`   - codven: "${vendedorIdFinal || 'NULL'}"`);
      console.log(`   - estado: "${estadoMapeado}"`);
      console.log(`   - observaciones: "${observaciones || ''}"`);
      console.log(`   - codusu: "${codusu || 'NULL'}"`);
      
      req1.input('codalm', sql.VarChar(10), codalmFinal);
      req1.input('numero_remision', sql.VarChar(50), numeroRemisionFinal);
      req1.input('fecha_remision', sql.Date, fechaRemisionFinal);
      req1.input('pedido_id', sql.Int, pedidoIdFinal);
      req1.input('codter', sql.VarChar(20), clienteIdStr);
      if (vendedorIdFinal) {
        req1.input('codven', sql.VarChar(20), vendedorIdFinal);
      } else {
        req1.input('codven', sql.VarChar(20), null);
      }
      req1.input('estado', sql.VarChar(20), estadoMapeado);
      req1.input('observaciones', sql.VarChar(500), observaciones || '');
      req1.input('codusu', sql.VarChar(20), codusu || null);
      req1.input('fec_creacion', sql.DateTime, new Date());

      console.log('🔄 Ejecutando INSERT en ven_remiciones_enc...');
      const insertHeader = await req1.query(`
        INSERT INTO ${TABLE_NAMES.remisiones} (
          codalm, numero_remision, fecha_remision,
          pedido_id, codter, codven, estado, observaciones, codusu, fec_creacion
        ) VALUES (
          @codalm, @numero_remision, @fecha_remision,
          @pedido_id, @codter, @codven, @estado, @observaciones, @codusu, @fec_creacion
        );
        SELECT SCOPE_IDENTITY() AS id;`);
      const newId = insertHeader.recordset[0].id;
      console.log(`✅ INSERT exitoso. ID generado: ${newId}`);

      console.log(`📦 Guardando ${items.length} items de remisión...`);
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const reqDet = new sql.Request(tx);
        console.log(`➕ Insertando item ${idx + 1}/${items.length}:`, { 
          codProducto: it.codProducto, 
          cantidadEnviada: it.cantidadEnviada || it.cantidad,
          detaPedidoId: it.detaPedidoId
        });
        
        // Validar codins (requerido en ven_remiciones_det)
        const codinsFinal = String(it.codProducto || it.codins || '').trim();
        if (!codinsFinal) {
          throw new Error(`Item ${idx + 1}: codProducto/codins es requerido`);
        }
        
        // Validar cantidad_enviada
        const cantidadEnviadaNum = Number(it.cantidadEnviada || it.cantidad || 0);
        const cantidadEnviadaFinal = isFinite(cantidadEnviadaNum) ? Math.max(0, cantidadEnviadaNum) : 0;
        
        // Obtener deta_pedido_id (ID del detalle del pedido en ven_detapedidos)
        // Si viene en el item, usarlo. Si no, buscarlo usando pedidoId y codins
        let detaPedidoIdFinal = null;
        
        if (it.detaPedidoId !== null && it.detaPedidoId !== undefined) {
          // Si viene en el payload, usarlo
          const detaPedidoIdNum = Number(it.detaPedidoId);
          if (isFinite(detaPedidoIdNum) && detaPedidoIdNum > 0) {
            detaPedidoIdFinal = Math.floor(detaPedidoIdNum);
            console.log(`   ✅ detaPedidoId del payload: ${detaPedidoIdFinal}`);
          }
        } else if (pedidoIdFinal && pedidoIdFinal !== null) {
          // NOTA: ven_detapedidos NO tiene columna 'id' como clave primaria
          // La tabla no tiene un identificador único por registro
          // Por lo tanto, deta_pedido_id se deja como NULL
          // La relación se mantiene a través de pedido_id en ven_remiciones_enc
          console.log(`   ℹ️ ven_detapedidos no tiene columna 'id', deta_pedido_id se dejará como NULL`);
          console.log(`   ℹ️ La relación se mantiene a través de pedido_id=${pedidoIdFinal} y codins=${codinsFinal}`);
        }
        
        // Validar y normalizar cantidad_facturada y cantidad_devuelta
        const cantidadFacturadaNum = Number(it.cantidadFacturada || 0);
        const cantidadFacturadaFinal = isFinite(cantidadFacturadaNum) ? Math.max(0, parseFloat(cantidadFacturadaNum.toFixed(2))) : 0;
        
        const cantidadDevueltaNum = Number(it.cantidadDevuelta || 0);
        const cantidadDevueltaFinal = isFinite(cantidadDevueltaNum) ? Math.max(0, parseFloat(cantidadDevueltaNum.toFixed(2))) : 0;
        
        reqDet.input('remision_id', sql.Int, newId);
        reqDet.input('deta_pedido_id', sql.Int, detaPedidoIdFinal);
        reqDet.input('codins', sql.VarChar(50), codinsFinal);
        reqDet.input('cantidad_enviada', sql.Decimal(18, 2), cantidadEnviadaFinal);
        reqDet.input('cantidad_facturada', sql.Decimal(18, 2), cantidadFacturadaFinal);
        reqDet.input('cantidad_devuelta', sql.Decimal(18, 2), cantidadDevueltaFinal);
        
        try {
        await reqDet.query(`
            INSERT INTO ${TABLE_NAMES.remisiones_detalle} (
              remision_id, deta_pedido_id, codins, cantidad_enviada, cantidad_facturada, cantidad_devuelta
          ) VALUES (
              @remision_id, @deta_pedido_id, @codins, @cantidad_enviada, @cantidad_facturada, @cantidad_devuelta
          );`);
        console.log(`✅ Item ${idx + 1} guardado correctamente`);
        } catch (itemError) {
          console.error(`❌ Error insertando item ${idx + 1}:`, itemError.message);
          if (itemError.originalError?.info) {
            console.error('Info SQL:', itemError.originalError.info.message);
          }
          throw itemError; // Re-lanzar para que se capture en el catch externo
        }
      }
      console.log(`✅ Todos los ${items.length} items de remisión guardados`);

      // Registrar movimientos en inv_kardex para cada item de la remisión
      // NOTA: Temporalmente deshabilitado - se implementará después de verificar que las remisiones se guarden correctamente
      // NOTA: Si el kardex falla, no interrumpe la creación de la remisión
      /*
      console.log(`📝 Intentando registrar movimientos en inv_kardex...`);
      let kardexRegistrados = 0;
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const codinsFinal = String(it.codProducto || it.codins || '').trim();
        const cantidadEnviadaNum = Number(it.cantidadEnviada || it.cantidad || 0);
        const cantidadEnviadaFinal = isFinite(cantidadEnviadaNum) ? Math.max(0, cantidadEnviadaNum) : 0;
        
        if (codinsFinal && cantidadEnviadaFinal > 0) {
          try {
            // Obtener costo del producto desde inv_insumos
            const reqProducto = new sql.Request(tx);
            reqProducto.input('codins', sql.VarChar(50), codinsFinal);
            const productoResult = await reqProducto.query(`
              SELECT TOP 1 ultimo_costo, costo_promedio 
              FROM inv_insumos 
              WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(@codins))
            `);
            
            const costoUnitario = productoResult.recordset.length > 0 
              ? parseFloat(productoResult.recordset[0].ultimo_costo || productoResult.recordset[0].costo_promedio || 0)
              : 0;
            const precioVenta = parseFloat((it.precioUnitario || 0).toFixed(2));
            
            // Insertar en inv_kardex
            // Estructura real: codalm char(3), codins char(8), feckar datetime, tipkar char(2), dockar int, etc.
            const codalmKardex = String(codalmFinal || '001').substring(0, 3).padEnd(3, ' '); // Exactamente 3 caracteres
            const codinsKardex = String(codinsFinal).substring(0, 8).padEnd(8, ' '); // Exactamente 8 caracteres
            const tipkarKardex = 'S '; // Salida - exactamente 2 caracteres
            const dockarKardex = newId; // Usar el ID de la remisión como dockar (INT)
            const observaKardex = String(`Rem ${numeroRemisionFinal}`).substring(0, 100); // Máximo 100 caracteres
            const numremKardex = newId; // Usar el ID de la remisión como numrem (INT)
            const fechaRemisionDateTime = new Date(fechaRemisionFinal + 'T00:00:00');
            
            const reqKardex = new sql.Request(tx);
            reqKardex.input('codalm', sql.Char(3), codalmKardex);
            reqKardex.input('codins', sql.Char(8), codinsKardex);
            reqKardex.input('feckar', sql.DateTime, fechaRemisionDateTime);
            reqKardex.input('tipkar', sql.Char(2), tipkarKardex);
            reqKardex.input('dockar', sql.Int, dockarKardex);
            reqKardex.input('cankar', sql.Numeric(18, 2), -cantidadEnviadaFinal); // Negativo porque es salida
            reqKardex.input('coskar', sql.Numeric(18, 2), costoUnitario);
            reqKardex.input('venkar', sql.Numeric(18, 2), precioVenta);
            reqKardex.input('codter', sql.VarChar(15), clienteIdStr ? String(clienteIdStr).substring(0, 15) : null);
            reqKardex.input('codusu', sql.VarChar(12), codusu ? String(codusu).substring(0, 12) : 'SISTEMA');
            reqKardex.input('numrem', sql.Int, numremKardex);
            reqKardex.input('FECREM', sql.DateTime, fechaRemisionDateTime);
            reqKardex.input('numcom', sql.Int, null);
            reqKardex.input('observa', sql.VarChar(100), observaKardex);
            
            await reqKardex.query(`
              INSERT INTO inv_kardex (
                codalm, codins, feckar, tipkar, dockar, cankar, coskar, venkar,
                codter, codusu, numrem, FECREM, numcom, observa, fecsys
              ) VALUES (
                @codalm, @codins, @feckar, @tipkar, @dockar, @cankar, @coskar, @venkar,
                @codter, @codusu, @numrem, @FECREM, @numcom, @observa, GETDATE()
              )
            `);
            kardexRegistrados++;
            console.log(`✅ Movimiento kardex registrado para ${codinsFinal} (cantidad: ${cantidadEnviadaFinal})`);
          } catch (kardexError) {
            console.error(`⚠️ Error registrando kardex para item ${idx + 1} (${codinsFinal}):`, kardexError.message);
            if (kardexError.originalError?.info) {
              console.error('   Info SQL:', kardexError.originalError.info.message);
            }
            // Continuar con el siguiente item sin interrumpir la transacción
          }
        }
      }
      console.log(`✅ Movimientos de kardex: ${kardexRegistrados}/${items.length} registrados`);
      */

      // Actualizar estado del pedido si se proporcionó pedidoId
      // SOLUCIÓN: Envolver en try-catch para que no interrumpa la creación de la remisión si falla
      if (pedidoIdFinal && pedidoIdFinal !== null && pedidoIdFinal !== undefined) {
        try {
        console.log(`🔄 Actualizando estado del pedido ID: ${pedidoIdFinal}`);
        
        // Obtener el pedido actual para verificar su estado y cantidades
        const reqPedido = new sql.Request(tx);
        reqPedido.input('pedidoId', sql.Int, pedidoIdFinal);
        const pedidoResult = await reqPedido.query(`
          SELECT id, estado, numero_pedido
          FROM ven_pedidos
          WHERE id = @pedidoId
        `);
        
        if (pedidoResult.recordset.length > 0) {
          const pedidoActual = pedidoResult.recordset[0];
          const estadoActual = mapEstadoFromDb(pedidoActual.estado);
          
          // Obtener todas las remisiones previas para este pedido
          const reqRemisionesPrevias = new sql.Request(tx);
          reqRemisionesPrevias.input('pedidoId', sql.Int, pedidoIdFinal);
          const remisionesPreviasResult = await reqRemisionesPrevias.query(`
            SELECT id, numero_remision
              FROM ${TABLE_NAMES.remisiones}
            WHERE pedido_id = @pedidoId
          `);
          
          // Obtener total de items remitidos (incluyendo esta nueva remisión)
            // Usar cantidad_enviada desde ven_remiciones_det
          const reqItemsRemitidos = new sql.Request(tx);
          reqItemsRemitidos.input('pedidoId', sql.Int, pedidoIdFinal);
          const itemsRemitidosResult = await reqItemsRemitidos.query(`
            SELECT 
                rd.codins,
                SUM(rd.cantidad_enviada) as cantidad_remitida
              FROM ${TABLE_NAMES.remisiones_detalle} rd
              INNER JOIN ${TABLE_NAMES.remisiones} r ON rd.remision_id = r.id
            WHERE r.pedido_id = @pedidoId
              GROUP BY rd.codins
          `);
          
          // Obtener total de items del pedido
          const reqItemsPedido = new sql.Request(tx);
          reqItemsPedido.input('pedidoId', sql.Int, pedidoIdFinal);
          const itemsPedidoResult = await reqItemsPedido.query(`
            SELECT 
                codins,
                canped as cantidad
              FROM ${TABLE_NAMES.pedidos_detalle}
            WHERE pedido_id = @pedidoId
          `);
          
          // Verificar si todos los items están completamente remitidos
          let todosRemitidos = true;
          let algunoRemitido = false;
          
          for (const itemPedido of itemsPedidoResult.recordset) {
            const itemRemitido = itemsRemitidosResult.recordset.find(
                ir => String(ir.codins || '').trim() === String(itemPedido.codins || '').trim()
            );
            const cantidadRemitida = itemRemitido ? parseFloat(itemRemitido.cantidad_remitida) : 0;
            const cantidadPedida = parseFloat(itemPedido.cantidad);
            
            if (cantidadRemitida > 0) {
              algunoRemitido = true;
            }
            if (cantidadRemitida < cantidadPedida) {
              todosRemitidos = false;
            }
          }
          
          // Determinar nuevo estado del pedido
          let nuevoEstado = estadoActual;
          
          if (todosRemitidos && algunoRemitido) {
            nuevoEstado = 'REMITIDO';
            console.log(`✅ Pedido completamente remitido. Cambiando estado a: ${nuevoEstado}`);
          } else if (algunoRemitido && !todosRemitidos) {
            nuevoEstado = 'PARCIALMENTE_REMITIDO';
            console.log(`✅ Pedido parcialmente remitido. Cambiando estado a: ${nuevoEstado}`);
          } else if (estadoActual === 'CONFIRMADO') {
            nuevoEstado = 'EN_PROCESO';
            console.log(`✅ Primera remisión del pedido. Cambiando estado de ${estadoActual} a: ${nuevoEstado}`);
          }
          
          // Actualizar estado del pedido si cambió
          if (nuevoEstado !== estadoActual) {
            const reqUpdatePedido = new sql.Request(tx);
            reqUpdatePedido.input('pedidoId', sql.Int, pedidoIdFinal);
            reqUpdatePedido.input('nuevoEstado', sql.VarChar(20), mapEstadoToDb(nuevoEstado));
            
            await reqUpdatePedido.query(`
              UPDATE ven_pedidos
              SET estado = @nuevoEstado
              WHERE id = @pedidoId
            `);
            
            console.log(`✅ Estado del pedido ${pedidoActual.numero_pedido} actualizado: ${estadoActual} -> ${nuevoEstado}`);
          } else {
            console.log(`ℹ️ Estado del pedido no cambió: ${estadoActual}`);
          }
        } else {
          console.warn(`⚠️ No se encontró el pedido ID: ${pedidoIdFinal} para actualizar su estado`);
          }
        } catch (pedidoError) {
          console.error(`⚠️ Error actualizando estado del pedido (no interrumpe la creación de la remisión):`, pedidoError.message);
          if (pedidoError.originalError?.info) {
            console.error('   Info SQL:', pedidoError.originalError.info.message);
          }
          // NO lanzar el error - continuar con el commit de la remisión
        }
      }

      console.log('🔄 Haciendo commit de la transacción...');
      await tx.commit();
      console.log('✅✅✅ COMMIT EXITOSO - Remisión guardada en la base de datos ✅✅✅');
      console.log(`📊 Resumen de la remisión guardada:`);
      console.log(`   - ID: ${newId}`);
      console.log(`   - Número: ${numeroRemisionFinal}`);
      console.log(`   - Cliente: ${clienteIdStr}`);
      console.log(`   - Items: ${items.length}`);
      console.log(`   - Pedido ID: ${pedidoIdFinal || 'N/A'}`);
      console.log(`   - Tabla: ${TABLE_NAMES.remisiones}`);
      
      res.json({ success: true, data: { id: newId } });
    } catch (inner) {
      if (tx) {
        try {
          await tx.rollback();
        } catch (rollbackError) {
          console.error('Error al hacer rollback:', rollbackError);
        }
      }
      throw inner;
    }
  } catch (error) {
    console.error('❌❌❌ ERROR CREANDO REMISIÓN ❌❌❌');
    console.error('Mensaje:', error.message);
    console.error('Stack trace:', error.stack);
    if (error.originalError) {
      console.error('Error original:', error.originalError.message);
      if (error.originalError.info) {
        console.error('Info SQL:', error.originalError.info.message);
        console.error('Número de error SQL:', error.originalError.info.number);
        console.error('Estado SQL:', error.originalError.info.state);
        console.error('Clase SQL:', error.originalError.info.class);
        console.error('Procedimiento SQL:', error.originalError.info.procName);
        console.error('Línea SQL:', error.originalError.info.lineNumber);
      }
    }
    console.error('Error completo:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    const errorMessage = error.message || 'Error desconocido al crear remisión';
    const errorDetails = error.originalError?.info || error.originalError?.message || null;
    
    res.status(500).json({ 
      success: false, 
      message: 'Error creando remisión', 
      error: errorMessage,
      details: errorDetails,
      originalError: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// --- ACTUALIZAR REMISIÓN ---
app.put('/api/remisiones/:id', async (req, res) => {
  console.log(`✅ Endpoint PUT /api/remisiones/:id alcanzado`);
  const { id } = req.params;
  const body = req.body || {};
  const idNum = parseInt(id, 10);
  
  if (isNaN(idNum)) {
    return res.status(400).json({ 
      success: false, 
      message: `ID de remisión inválido: ${id}`,
      error: 'INVALID_ID'
    });
  }
  
  console.log(`📥 Recibida solicitud PUT /api/remisiones/${idNum} con body:`, JSON.stringify(body, null, 2));
  
  try {
    const pool = await getConnection();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    
    try {
      const reqUpdate = new sql.Request(tx);
      
      // Construir campos a actualizar dinámicamente
      const updates = [];
      
      if (body.estado !== undefined) {
        // Mapear el estado del frontend al formato de la BD
        const estadoMapeado = mapEstadoToDb(body.estado);
        updates.push('estado = @estado');
        reqUpdate.input('estado', sql.VarChar(20), estadoMapeado);
        console.log(`🔄 Actualizando estado: ${body.estado} → ${estadoMapeado} (BD)`);
      }
      
      if (body.observaciones !== undefined) {
        updates.push('observaciones = @observaciones');
        reqUpdate.input('observaciones', sql.VarChar(500), body.observaciones || '');
      }
      
      if (body.codalm !== undefined) {
        updates.push('codalm = @codalm');
        reqUpdate.input('codalm', sql.VarChar(10), body.codalm);
      }
      
      if (body.codven !== undefined) {
        updates.push('codven = @codven');
        reqUpdate.input('codven', sql.VarChar(20), body.codven || null);
      }
      
      if (updates.length === 0) {
        await tx.rollback();
        return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
      }
      
      // Verificar que la remisión existe antes de actualizar
      const reqCheck = new sql.Request(tx);
      reqCheck.input('remisionId', sql.Int, idNum);
      const checkResult = await reqCheck.query(`
        SELECT id, numero_remision, estado, pedido_id, codter
        FROM ${TABLE_NAMES.remisiones} 
        WHERE id = @remisionId
      `);
      
      if (checkResult.recordset.length === 0) {
        await tx.rollback();
        console.error(`❌ Remisión con ID ${idNum} no encontrada`);
        return res.status(404).json({ 
          success: false, 
          message: `Remisión con ID ${idNum} no existe en la base de datos`,
          error: 'REMISION_NOT_FOUND'
        });
      }
      
      const remisionActual = checkResult.recordset[0];
      const estadoActualMapeado = mapEstadoFromDb(remisionActual.estado);
      console.log(`✅ Remisión encontrada: ID=${remisionActual.id}, estado actual=${remisionActual.estado} (${estadoActualMapeado})`);
      
      // Validar que se puede actualizar el estado si se está cambiando a ENTREGADO
      if (body.estado === 'ENTREGADO' || body.estado === 'ENTREGADA') {
        // Solo se pueden marcar como entregadas remisiones en estado BORRADOR o EN_TRANSITO
        if (estadoActualMapeado !== 'BORRADOR' && estadoActualMapeado !== 'EN_TRANSITO') {
          await tx.rollback();
          console.error(`❌ No se puede marcar como entregada una remisión en estado: ${estadoActualMapeado}`);
          return res.status(400).json({ 
            success: false, 
            message: `No se puede marcar como entregada una remisión en estado '${estadoActualMapeado}'. Solo se pueden marcar como entregadas remisiones en estado BORRADOR o EN_TRANSITO.`,
            error: 'ESTADO_INVALIDO',
            estadoActual: estadoActualMapeado
          });
        }
      }
      
      reqUpdate.input('remisionId', sql.Int, idNum);
      
      const updateQuery = `
        UPDATE ${TABLE_NAMES.remisiones} 
        SET ${updates.join(', ')}
        WHERE id = @remisionId;
        SELECT * FROM ${TABLE_NAMES.remisiones} WHERE id = @remisionId;
      `;
      
      console.log(`🔍 Ejecutando query de actualización para remisión ID: ${idNum}`);
      const result = await reqUpdate.query(updateQuery);
      
      console.log(`📊 Resultados de la actualización:`, {
        rowsAffected: result.rowsAffected,
        recordsetLength: result.recordset?.length || 0
      });
      
      if (result.recordset.length === 0) {
        await tx.rollback();
        console.error(`❌ Remisión con ID ${idNum} no encontrada después de actualizar`);
        
        // Verificar si la remisión existe antes de actualizar
        const reqCheck = new sql.Request(tx);
        reqCheck.input('remisionId', sql.Int, idNum);
        const checkResult = await reqCheck.query(`SELECT id, numero_remision, estado FROM ${TABLE_NAMES.remisiones} WHERE id = @remisionId`);
        
        if (checkResult.recordset.length === 0) {
          return res.status(404).json({ 
            success: false, 
            message: `Remisión con ID ${idNum} no existe en la base de datos` 
          });
        } else {
          return res.status(500).json({ 
            success: false, 
            message: `Remisión existe pero no se pudo actualizar. Verifique los logs del servidor.` 
          });
        }
      }
      
      await tx.commit();
      
      const updatedRemision = result.recordset[0];
      const estadoMapeado = mapEstadoFromDb(updatedRemision.estado);
      console.log('✅ Remisión actualizada exitosamente:', {
        id: updatedRemision.id,
        numeroRemision: updatedRemision.numero_remision,
        estadoBD: updatedRemision.estado,
        estadoMapeado: estadoMapeado
      });
      
      res.json({ 
        success: true, 
        data: {
          id: updatedRemision.id,
          numeroRemision: updatedRemision.numero_remision,
          estado: estadoMapeado, // Mapear de vuelta al formato del frontend
          observaciones: updatedRemision.observaciones || '',
          codalm: updatedRemision.codalm || '',
          codven: updatedRemision.codven || null,
          pedidoId: updatedRemision.pedido_id || null,
          clienteId: updatedRemision.codter || '',
          fechaRemision: updatedRemision.fecha_remision ? new Date(updatedRemision.fecha_remision).toISOString().split('T')[0] : null
        }
      });
    } catch (inner) {
      await tx.rollback();
      console.error('❌ Error interno en transacción:', inner);
      throw inner;
    }
  } catch (error) {
    console.error('❌ Error actualizando remisión:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: `Error actualizando remisión: ${error.message}`, 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// --- CREAR FACTURA ---
app.post('/api/facturas', async (req, res) => {
  const body = req.body || {};
  console.log('📥 Recibida solicitud POST /api/facturas');
  try {
    const {
      numeroFactura, fechaFactura, fechaVencimiento,
      clienteId, vendedorId, remisionId, pedidoId,
      subtotal, descuentoValor = 0, ivaValor = 0, total = 0,
      observaciones = '', estado = 'BORRADOR', empresaId, items = []
    } = body;

    if (!clienteId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Datos incompletos para crear factura' });
    }

    const pool = await getConnection();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      // ========== VALIDACIONES ==========
      
      // 1. Validar clienteId (codter)
      const clienteIdStr = String(clienteId).trim();
      if (!clienteIdStr) {
        await tx.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'CLIENTE_REQUERIDO',
          error: 'El código del cliente (clienteId) es requerido'
        });
      }
      
      const reqCliente = new sql.Request(tx);
      reqCliente.input('codter', sql.VarChar(20), clienteIdStr);
      // Usar CASE para asegurar que activo se convierta correctamente a 1 o 0
      const clienteResult = await reqCliente.query(`
        SELECT 
          codter, 
          nomter, 
          activo,
          CAST(activo AS INT) as activoInt,
          CASE WHEN activo = 1 THEN 1 ELSE 0 END as activoCase
        FROM con_terceros 
        WHERE codter = @codter
      `);
      
      console.log(`🔍 [Backend] Búsqueda de cliente: codter="${clienteIdStr}"`);
      console.log(`🔍 [Backend] Resultados encontrados: ${clienteResult.recordset.length}`);
      
      if (clienteResult.recordset.length === 0) {
        await tx.rollback();
        
        // Intentar buscar sin espacios para debug
        const reqDebug = new sql.Request(tx);
        reqDebug.input('codter', sql.VarChar(20), clienteIdStr.trim());
        const debugResult = await reqDebug.query(`
          SELECT TOP 5 codter, nomter, activo, CAST(activo AS INT) as activoInt
          FROM con_terceros 
          WHERE codter LIKE '%' + @codter + '%'
          ORDER BY codter
        `);
        console.log(`   📋 Clientes similares encontrados:`, debugResult.recordset);
        
        return res.status(400).json({ 
          success: false, 
          message: 'CLIENTE_NOT_FOUND',
          error: `Cliente con código "${clienteIdStr}" no encontrado en con_terceros`,
          debug: {
            clienteIdProporcionado: clienteIdStr,
            clientesSimilares: debugResult.recordset,
            sugerencia: 'Verifique que el código del cliente sea correcto'
          }
        });
      }
      
      const cliente = clienteResult.recordset[0];
      
      // El campo BIT puede venir como boolean (true/false) o como número (1/0)
      // Convertir a número para comparación segura - manejar todos los casos posibles
      // Priorizar activoCase (más confiable), luego activoInt, luego activo
      let activoValue = 0;
      if (cliente.activoCase !== undefined && cliente.activoCase !== null) {
        // Usar el valor del CASE (más confiable)
        activoValue = Number(cliente.activoCase);
      } else if (cliente.activoInt !== undefined && cliente.activoInt !== null) {
        // Si tenemos el valor convertido a INT, usarlo directamente
        activoValue = Number(cliente.activoInt);
      } else if (cliente.activo !== undefined && cliente.activo !== null) {
        // Si tenemos el valor BIT original, convertirlo
        if (cliente.activo === true || cliente.activo === 1 || cliente.activo === '1' || String(cliente.activo) === 'true') {
          activoValue = 1;
        } else if (cliente.activo === false || cliente.activo === 0 || cliente.activo === '0' || String(cliente.activo) === 'false') {
          activoValue = 0;
        } else {
          // Intentar convertir a número
          activoValue = Number(cliente.activo) || 0;
        }
      }
      
      console.log(`🔍 [Backend] Cliente encontrado:`, {
        codter: cliente.codter,
        nomter: cliente.nomter,
        activo: cliente.activo,
        activoInt: cliente.activoInt,
        activoCase: cliente.activoCase,
        activoValue: activoValue,
        tipoActivo: typeof cliente.activo,
        tipoActivoInt: typeof cliente.activoInt,
        tipoActivoCase: typeof cliente.activoCase,
        activoString: String(cliente.activo),
        activoIntString: String(cliente.activoInt),
        activoCaseString: String(cliente.activoCase)
      });
      
      // Comparar con 1 (activo) - usar comparación estricta de número
      if (Number(activoValue) !== 1) {
        await tx.rollback();
        console.error(`❌ [Backend] Cliente inactivo detectado:`, {
          codter: cliente.codter,
          nomter: cliente.nomter,
          activo: cliente.activo,
          activoInt: cliente.activoInt,
          activoCase: cliente.activoCase,
          activoValue: activoValue,
          activoValueNumber: Number(activoValue)
        });
        return res.status(400).json({ 
          success: false, 
          message: 'CLIENTE_INACTIVO',
          error: `Cliente "${cliente.nomter}" (${clienteIdStr}) está inactivo`,
          debug: {
            codter: cliente.codter,
            activo: cliente.activo,
            activoInt: cliente.activoInt,
            activoCase: cliente.activoCase,
            activoValue: activoValue,
            activoValueNumber: Number(activoValue),
            tipoActivo: typeof cliente.activo,
            tipoActivoInt: typeof cliente.activoInt,
            tipoActivoCase: typeof cliente.activoCase
          }
        });
      }
      
      console.log(`✅ [Backend] Cliente válido y activo: ${cliente.nomter} (${cliente.codter})`);
      
      // 2. Validar vendedorId si se proporciona (buscar por ideven o codven)
      let vendedorIdFinal = null;
      if (vendedorId && String(vendedorId).trim()) {
        const vendedorIdStr = String(vendedorId).trim();
        const idevenNum = parseInt(vendedorIdStr, 10);
        const isNumeric = !isNaN(idevenNum) && String(idevenNum) === vendedorIdStr;
        
        const reqVendedor = new sql.Request(tx);
        let vendedorQuery;
        if (isNumeric) {
          reqVendedor.input('ideven', sql.Int, idevenNum);
          vendedorQuery = `
          SELECT 
              CAST(ideven AS VARCHAR(20)) as codi_emple, 
              LTRIM(RTRIM(nomven)) as nomb_emple, 
              CAST(Activo AS INT) as activo,
              Activo as activoBit
          FROM ven_vendedor 
            WHERE ideven = @ideven
          `;
        } else {
          reqVendedor.input('codven', sql.VarChar(20), vendedorIdStr);
          vendedorQuery = `
            SELECT 
              CAST(ideven AS VARCHAR(20)) as codi_emple, 
              LTRIM(RTRIM(nomven)) as nomb_emple, 
              CAST(Activo AS INT) as activo,
              Activo as activoBit
            FROM ven_vendedor 
            WHERE codven = @codven
          `;
        }
        
        console.log(`🔍 [Backend] Búsqueda de vendedor: "${vendedorIdStr}" (numeric: ${isNumeric})`);
        const vendedorResult = await reqVendedor.query(vendedorQuery);
        console.log(`🔍 [Backend] Resultados encontrados: ${vendedorResult.recordset.length}`);
        
        if (vendedorResult.recordset.length === 0) {
          await tx.rollback();
          console.error(`❌ Vendedor NO encontrado: "${vendedorIdStr}"`);
          return res.status(400).json({ 
            success: false, 
            message: 'VENDEDOR_NOT_FOUND',
            error: `Vendedor "${vendedorIdStr}" no encontrado en ven_vendedor`,
            debug: {
              vendedorIdProporcionado: vendedorIdStr,
              sugerencia: 'Verifique que el código del vendedor sea correcto (ideven o codven)'
            }
          });
        }
        
        const vendedor = vendedorResult.recordset[0];
        // Activo viene como INT (0 o 1) desde CAST(Activo AS INT)
        const activoValue = Number(vendedor.activo) || 0;
        
        console.log(`🔍 [Backend] Vendedor encontrado:`, {
          codi_emple: vendedor.codi_emple,
          nomb_emple: vendedor.nomb_emple,
          activo: activoValue
        });
        
        if (activoValue !== 1) {
          await tx.rollback();
          console.error(`❌ [Backend] Vendedor inactivo detectado:`, {
            codi_emple: vendedor.codi_emple,
            nomb_emple: vendedor.nomb_emple,
            activo: activoValue
          });
          return res.status(400).json({ 
            success: false, 
            message: 'VENDEDOR_INACTIVO',
            error: `Vendedor "${vendedor.nomb_emple}" (${vendedorIdStr}) está inactivo`,
            debug: {
              codi_emple: vendedor.codi_emple,
              activo: activoValue
            }
          });
        }
        
        console.log(`✅ [Backend] Vendedor válido y activo: ${vendedor.nomb_emple} (${vendedor.codi_emple})`);
        vendedorIdFinal = vendedor.codi_emple; // Usar el codi_emple obtenido de la consulta
      } else {
        console.log(`ℹ️ [Backend] Vendedor no proporcionado, continuando sin vendedor`);
      }
      
      // 3. Validar pedidoId si se proporciona (puede ser número o string como "PED-001")
      let pedidoIdFinal = null;
      if (pedidoId !== null && pedidoId !== undefined && pedidoId !== '') {
        const pedidoIdStr = String(pedidoId).trim();
        const pedidoIdNum = parseInt(pedidoIdStr, 10);
        
        let pedidoResult;
        const reqPedido = new sql.Request(tx);
        
        if (!isNaN(pedidoIdNum)) {
          // Es un número, buscar por ID
          reqPedido.input('pedidoId', sql.Int, pedidoIdNum);
          pedidoResult = await reqPedido.query(`
            SELECT id, numero_pedido, estado 
            FROM ven_pedidos 
            WHERE id = @pedidoId
          `);
        } else {
          // Es un string, buscar por numero_pedido
          reqPedido.input('numeroPedido', sql.VarChar(50), pedidoIdStr);
          pedidoResult = await reqPedido.query(`
            SELECT id, numero_pedido, estado 
            FROM ven_pedidos 
            WHERE numero_pedido = @numeroPedido
          `);
        }
        
        if (pedidoResult.recordset.length === 0) {
          await tx.rollback();
          
          // Obtener ejemplos de pedidos existentes
          const reqEjemplos = new sql.Request(tx);
          const ejemplosResult = await reqEjemplos.query(`
            SELECT TOP 5 id, numero_pedido, estado 
            FROM ven_pedidos 
            ORDER BY id DESC
          `);
          
          return res.status(400).json({ 
            success: false, 
            message: 'PEDIDO_NOT_FOUND',
            error: `Pedido con ID/código "${pedidoIdStr}" no encontrado en ven_pedidos`,
            debug: {
              pedidoIdProporcionado: pedidoIdStr,
              ejemplosExistentes: ejemplosResult.recordset.map(p => ({
                id: p.id,
                numero_pedido: p.numero_pedido,
                estado: p.estado
              })),
              sugerencia: 'Use un ID numérico o un número de pedido válido (ej: "PED-001")'
            }
          });
        }
        
        pedidoIdFinal = pedidoResult.recordset[0].id;
        console.log(`✅ Pedido validado: ID=${pedidoIdFinal}, numero_pedido=${pedidoResult.recordset[0].numero_pedido}`);
      }
      
      // 4. Validar remisionId si se proporciona (puede ser número o string como "REM-001")
      let remisionIdFinal = null;
      if (remisionId !== null && remisionId !== undefined && remisionId !== '') {
        const remisionIdStr = String(remisionId).trim();
        const remisionIdNum = parseInt(remisionIdStr, 10);
        
        let remisionResult;
        const reqRemision = new sql.Request(tx);
        
        if (!isNaN(remisionIdNum)) {
          // Es un número, buscar por ID
          reqRemision.input('remisionId', sql.Int, remisionIdNum);
          remisionResult = await reqRemision.query(`
            SELECT id, numero_remision, estado 
            FROM ${TABLE_NAMES.remisiones} 
            WHERE id = @remisionId
          `);
        } else {
          // Es un string, buscar por numero_remision
          reqRemision.input('numeroRemision', sql.VarChar(50), remisionIdStr);
          remisionResult = await reqRemision.query(`
            SELECT id, numero_remision, estado 
            FROM ${TABLE_NAMES.remisiones} 
            WHERE numero_remision = @numeroRemision
          `);
        }
        
        if (remisionResult.recordset.length === 0) {
          await tx.rollback();
          
          // Obtener ejemplos de remisiones existentes
          const reqEjemplos = new sql.Request(tx);
          const ejemplosResult = await reqEjemplos.query(`
            SELECT TOP 5 id, numero_remision, estado 
            FROM ${TABLE_NAMES.remisiones} 
            ORDER BY id DESC
          `);
          
          return res.status(400).json({ 
            success: false, 
            message: 'REMISION_NOT_FOUND',
            error: `Remisión con ID/código "${remisionIdStr}" no encontrada en ${TABLE_NAMES.remisiones}`,
            debug: {
              remisionIdProporcionado: remisionIdStr,
              ejemplosExistentes: ejemplosResult.recordset.map(r => ({
                id: r.id,
                numero_remision: r.numero_remision,
                estado: r.estado
              })),
              sugerencia: 'Use un ID numérico o un número de remisión válido (ej: "REM-001")'
            }
          });
        }
        
        remisionIdFinal = remisionResult.recordset[0].id;
        console.log(`✅ Remisión validada: ID=${remisionIdFinal}, numero_remision=${remisionResult.recordset[0].numero_remision}`);
      }
      
      // 5. Validar y generar numeroFactura
      let numeroFacturaFinal = numeroFactura ? String(numeroFactura).trim() : null;
      
      if (!numeroFacturaFinal || numeroFacturaFinal === 'AUTO' || numeroFacturaFinal === '') {
        // Generar número automático usando la columna numfact
        const reqMax = new sql.Request(tx);
        const maxResult = await reqMax.query(`
          SELECT MAX(CAST(SUBSTRING(numfact, 4, LEN(numfact)) AS INT)) as maxNum
          FROM ${TABLE_NAMES.facturas}
          WHERE numfact LIKE 'FC-%' 
            AND ISNUMERIC(SUBSTRING(numfact, 4, LEN(numfact))) = 1
        `);
        
        const maxNum = maxResult.recordset[0]?.maxNum || 0;
        const nextNum = maxNum + 1;
        numeroFacturaFinal = `FC-${String(nextNum).padStart(4, '0')}`;
        console.log(`📝 Número de factura generado automáticamente: "${numeroFacturaFinal}"`);
      } else {
        // Validar que no exista usando la columna numfact
        const reqExistente = new sql.Request(tx);
        reqExistente.input('numfact', sql.VarChar(50), numeroFacturaFinal);
        const existenteResult = await reqExistente.query(`
          SELECT ID, numfact, estfac 
          FROM ${TABLE_NAMES.facturas} 
          WHERE numfact = @numfact
        `);
        
        if (existenteResult.recordset.length > 0) {
          await tx.rollback();
          return res.status(400).json({ 
            success: false, 
            message: 'NUMERO_FACTURA_DUPLICADO',
            error: `Ya existe una factura con el número "${numeroFacturaFinal}"`,
            debug: {
              numeroFacturaProporcionado: numeroFacturaFinal,
              facturaExistente: {
                ID: existenteResult.recordset[0].ID,
                numfact: existenteResult.recordset[0].numfact,
                estfac: existenteResult.recordset[0].estfac
              },
              sugerencia: 'Use un número de factura diferente o "AUTO" para generar automáticamente'
            }
          });
        }
        
        console.log(`📝 Número de factura proporcionado y válido: "${numeroFacturaFinal}"`);
      }
      
      // 6. Obtener codalm desde empresaId o usar default
      let codalmFinal = '001';
      if (empresaId) {
        try {
          const reqAlmacen = new sql.Request(tx);
          reqAlmacen.input('empresaId', sql.Int, empresaId);
          const almacenResult = await reqAlmacen.query(`
            SELECT TOP 1 codalm
            FROM inv_almacen
            WHERE CAST(codalm AS INT) = @empresaId OR codalm = CAST(@empresaId AS VARCHAR(10))
          `);
          if (almacenResult.recordset.length > 0) {
            codalmFinal = almacenResult.recordset[0].codalm.trim();
          }
        } catch (err) {
          console.warn(`⚠️ No se pudo obtener codalm del empresaId ${empresaId}, usando '001': ${err.message}`);
        }
      }
      // Asegurar que codalmFinal tenga máximo 3 caracteres
      codalmFinal = String(codalmFinal || '001').trim();
      // Si es un número, convertirlo a string y asegurar que tenga 3 dígitos
      if (/^\d+$/.test(codalmFinal)) {
        codalmFinal = codalmFinal.padStart(3, '0').substring(0, 3);
      } else {
        codalmFinal = codalmFinal.substring(0, 3).padStart(3, '0');
      }
      
      // ========== INSERTAR FACTURA ==========
      const req1 = new sql.Request(tx);
      const estadoMapeado = mapEstadoToDb(estado);
      
      // Validar y normalizar valores numéricos
      const maxDecimal18_2 = 9999999999999999.99;
      const subtotalFinal = Math.max(0, Math.min(Math.abs(parseFloat(subtotal) || 0), maxDecimal18_2));
      const descuentoValorFinal = Math.max(0, Math.min(Math.abs(parseFloat(descuentoValor) || 0), maxDecimal18_2));
      const ivaValorFinal = Math.max(0, Math.min(Math.abs(parseFloat(ivaValor) || 0), maxDecimal18_2));
      const totalFinal = Math.max(0, Math.min(Math.abs(parseFloat(total) || 0), maxDecimal18_2));
      
      // Validar y truncar todos los campos VARCHAR antes de insertar
      // IMPORTANTE: Los límites deben coincidir EXACTAMENTE con los definidos en la tabla ven_facturas
      // Estructura real: numfact VARCHAR(15), tipfac CHAR(2), codter VARCHAR(15), codcue CHAR(8), codusu VARCHAR(10)
      // Observa VARCHAR(150), resolucion_dian CHAR(2), estfac VARCHAR(1), estado_envio BIT, sey_key VARCHAR(120), CUFE VARCHAR(600)
      const numfactFinal = String(numeroFacturaFinal || '').trim().substring(0, 15);
      const codalmFinalTrunc = codalmFinal; // Ya está truncado arriba (CHAR(3))
      const tipfacFinal = String(body.tipoFactura || '01').trim().substring(0, 2).padEnd(2, ' '); // CHAR(2) - rellenar con espacios
      const codterFinal = String(clienteIdStr || '').trim().substring(0, 15);
      const doccocFinal = body.documentoContable ? String(body.documentoContable).trim().substring(0, 12).padEnd(12, ' ') : null; // CHAR(12)
      
      // Validar que los campos requeridos no estén vacíos
      if (!numfactFinal || numfactFinal.length === 0) {
        await tx.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'NUMERO_FACTURA_REQUERIDO',
          error: 'El número de factura es requerido'
        });
      }
      if (!codterFinal || codterFinal.length === 0) {
        await tx.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'CLIENTE_REQUERIDO',
          error: 'El código del cliente es requerido'
        });
      }
      
      req1.input('numfact', sql.VarChar(15), numfactFinal);
      req1.input('codalm', sql.Char(3), codalmFinalTrunc);
      req1.input('tipfac', sql.Char(2), tipfacFinal);
      req1.input('codter', sql.VarChar(15), codterFinal);
      req1.input('doccoc', sql.Char(12), doccocFinal);
      req1.input('fecfac', sql.DateTime, fechaFactura);
      
      // Calcular fecha de vencimiento si no se proporciona
      // Si no viene fechaVencimiento, calcularla basándose en las condiciones de pago del cliente
      let fechaVencimientoFinal = fechaVencimiento;
      if (!fechaVencimientoFinal) {
        // Intentar obtener días de crédito del cliente
        const reqClienteCredito = new sql.Request(tx);
        reqClienteCredito.input('codter', sql.VarChar(20), codterFinal);
        // Intentar obtener días de crédito del cliente
        // NOTA: La tabla con_terceros puede tener diferentes nombres de columnas
        // Intentar con los nombres más comunes
        let diasCredito = 30; // Por defecto 30 días
        try {
          const clienteCreditoResult = await reqClienteCredito.query(`
            SELECT TOP 1 plazo
            FROM con_terceros
            WHERE codter = @codter
          `);
          
          if (clienteCreditoResult.recordset.length > 0) {
            const clienteData = clienteCreditoResult.recordset[0];
            // Intentar obtener días de crédito desde el campo plazo
            if (clienteData.plazo !== null && clienteData.plazo !== undefined) {
              diasCredito = parseInt(clienteData.plazo, 10);
              if (isNaN(diasCredito) || diasCredito <= 0) {
                diasCredito = 30; // Por defecto 30 días si no es válido
              }
            }
          }
        } catch (err) {
          // Si hay error al consultar (columna no existe), usar 30 días por defecto
          console.warn(`⚠️ No se pudo obtener días de crédito del cliente ${codterFinal}, usando 30 días por defecto: ${err.message}`);
          diasCredito = 30;
        }
        
        // Calcular fecha de vencimiento sumando los días de crédito a la fecha de factura
        const fechaFacturaDate = new Date(fechaFactura);
        const fechaVencDate = new Date(fechaFacturaDate);
        fechaVencDate.setDate(fechaVencDate.getDate() + diasCredito);
        fechaVencimientoFinal = fechaVencDate.toISOString().split('T')[0];
        
        console.log(`📅 Fecha de vencimiento calculada automáticamente: ${fechaVencimientoFinal} (${diasCredito} días después de ${fechaFactura})`);
      }
      
      req1.input('venfac', sql.DateTime, fechaVencimientoFinal);
      
      // Truncar codven a máximo 3 caracteres (CHAR(3) en la BD)
      const codvenFinal = vendedorIdFinal ? String(vendedorIdFinal).trim().substring(0, 3).padEnd(3, ' ') : null;
      req1.input('codven', sql.Char(3), codvenFinal);
      req1.input('valvta', sql.Decimal(18, 2), subtotalFinal);
      req1.input('valiva', sql.Decimal(18, 2), ivaValorFinal);
      req1.input('valotr', sql.Decimal(18, 2), body.otrosValores || 0);
      req1.input('valant', sql.Decimal(18, 2), body.anticipos || 0);
      req1.input('valdev', sql.Decimal(18, 2), body.devoluciones || 0);
      req1.input('abofac', sql.Decimal(18, 2), body.abonos || 0);
      req1.input('valdcto', sql.Decimal(18, 2), descuentoValorFinal);
      req1.input('valret', sql.Decimal(18, 2), body.retenciones || 0);
      req1.input('valrica', sql.Decimal(18, 2), body.retencionICA || 0);
      req1.input('valriva', sql.Decimal(18, 2), body.retencionIVA || 0);
      req1.input('netfac', sql.Decimal(18, 2), totalFinal);
      req1.input('valcosto', sql.Decimal(18, 2), body.costo || 0);
      // Truncar todos los campos VARCHAR restantes según estructura real
      // codcue es CHAR(8) NO NULL - usar valor por defecto si no se proporciona
      const codcueFinal = String(body.cuenta || '00000000').trim().substring(0, 8).padEnd(8, '0');
      const resolucionDianFinal = body.resolucionDian ? String(body.resolucionDian).trim().substring(0, 2).padEnd(2, ' ') : null; // CHAR(2)
      const observaFinal = String(observaciones || '').trim().substring(0, 150); // VARCHAR(150)
      // codusu es VARCHAR(10) NO NULL - usar valor por defecto si no se proporciona
      const codusuFinal = String(body.usuarioId || 'SISTEMA').trim().substring(0, 10);
      const estfacFinal = String(estadoMapeado || 'B').trim().substring(0, 1); // VARCHAR(1) - solo 1 carácter
      // estado_envio es BIT en la BD, no VARCHAR - convertir a 0 o 1
      const estadoEnvioFinal = body.estadoEnvio ? (body.estadoEnvio === true || body.estadoEnvio === 1 || String(body.estadoEnvio).toLowerCase() === 'true' ? 1 : 0) : null;
      const seyKeyFinal = body.seyKey ? String(body.seyKey).trim().substring(0, 120) : null; // VARCHAR(120)
      const cufeFinal = body.cufe ? String(body.cufe).trim().substring(0, 600) : null; // VARCHAR(600)
      
      req1.input('codcue', sql.Char(8), codcueFinal);
      req1.input('efectivo', sql.Decimal(18, 2), body.efectivo || 0);
      req1.input('cheques', sql.Decimal(18, 2), body.cheques || 0);
      req1.input('credito', sql.Decimal(18, 2), body.credito || 0);
      req1.input('tarjetacr', sql.Decimal(18, 2), body.tarjetaCredito || 0);
      req1.input('TarjetaDB', sql.Decimal(18, 2), body.tarjetaDebito || 0);
      req1.input('Transferencia', sql.Decimal(18, 2), body.transferencia || 0);
      req1.input('valpagado', sql.Decimal(18, 2), body.valorPagado || 0);
      req1.input('resolucion_dian', sql.Char(2), resolucionDianFinal);
      req1.input('Observa', sql.VarChar(150), observaFinal);
      req1.input('TARIFA_CREE', sql.Decimal(18, 2), body.tarifaCREE || 0);
      req1.input('RETECREE', sql.Decimal(18, 2), body.retencionCREE || 0);
      req1.input('codusu', sql.VarChar(10), codusuFinal);
      req1.input('fecsys', sql.DateTime, new Date());
      req1.input('estfac', sql.VarChar(1), estfacFinal);
      req1.input('VALDOMICILIO', sql.Decimal(18, 2), body.valorDomicilio || 0);
      req1.input('estado_envio', sql.Bit, estadoEnvioFinal);
      req1.input('sey_key', sql.VarChar(120), seyKeyFinal);
      req1.input('CUFE', sql.VarChar(600), cufeFinal);
      req1.input('IdCaja', sql.Int, body.cajaId || null);
      req1.input('Valnotas', sql.Decimal(18, 2), body.valorNotas || 0);

      // Log detallado de todos los valores antes de insertar para debugging
      console.log('📋 Valores a insertar en ven_facturas (con límites reales):', {
        numfact: { valor: numfactFinal, longitud: numfactFinal.length, max: 15, tipo: 'VARCHAR(15)' },
        codalm: { valor: codalmFinalTrunc, longitud: codalmFinalTrunc.length, max: 3, tipo: 'CHAR(3)' },
        tipfac: { valor: tipfacFinal, longitud: tipfacFinal.length, max: 2, tipo: 'CHAR(2)' },
        codter: { valor: codterFinal, longitud: codterFinal.length, max: 15, tipo: 'VARCHAR(15)' },
        doccoc: { valor: doccocFinal, longitud: doccocFinal?.length || 0, max: 12, tipo: 'CHAR(12)' },
        codven: { valor: codvenFinal, longitud: codvenFinal?.length || 0, max: 3, tipo: 'CHAR(3)' },
        codcue: { valor: codcueFinal, longitud: codcueFinal?.length || 0, max: 8, tipo: 'CHAR(8)' },
        resolucion_dian: { valor: resolucionDianFinal, longitud: resolucionDianFinal?.length || 0, max: 2, tipo: 'CHAR(2)' },
        Observa: { valor: observaFinal, longitud: observaFinal.length, max: 150, tipo: 'VARCHAR(150)' },
        codusu: { valor: codusuFinal, longitud: codusuFinal?.length || 0, max: 10, tipo: 'VARCHAR(10)' },
        estfac: { valor: estfacFinal, longitud: estfacFinal.length, max: 1, tipo: 'VARCHAR(1)' },
        estado_envio: { valor: estadoEnvioFinal, tipo: 'BIT' },
        sey_key: { valor: seyKeyFinal, longitud: seyKeyFinal?.length || 0, max: 120, tipo: 'VARCHAR(120)' },
        CUFE: { valor: cufeFinal, longitud: cufeFinal?.length || 0, max: 600, tipo: 'VARCHAR(600)' }
      });

      let newId;
      try {
        const insertHeader = await req1.query(`
          INSERT INTO ${TABLE_NAMES.facturas} (
            numfact, codalm, tipfac, codter, doccoc, fecfac, venfac, codven,
            valvta, valiva, valotr, valant, valdev, abofac, valdcto, valret, valrica, valriva,
            netfac, valcosto, codcue, efectivo, cheques, credito, tarjetacr, TarjetaDB, Transferencia,
            valpagado, resolucion_dian, Observa, TARIFA_CREE, RETECREE, codusu, fecsys, estfac,
            VALDOMICILIO, estado_envio, sey_key, CUFE, IdCaja, Valnotas
          ) VALUES (
            @numfact, @codalm, @tipfac, @codter, @doccoc, @fecfac, @venfac, @codven,
            @valvta, @valiva, @valotr, @valant, @valdev, @abofac, @valdcto, @valret, @valrica, @valriva,
            @netfac, @valcosto, @codcue, @efectivo, @cheques, @credito, @tarjetacr, @TarjetaDB, @Transferencia,
            @valpagado, @resolucion_dian, @Observa, @TARIFA_CREE, @RETECREE, @codusu, @fecsys, @estfac,
            @VALDOMICILIO, @estado_envio, @sey_key, @CUFE, @IdCaja, @Valnotas
          );
          SELECT SCOPE_IDENTITY() AS ID;`);
        newId = insertHeader.recordset[0].ID;
        console.log(`✅ Factura header insertada correctamente con ID: ${newId}`);
      } catch (insertError) {
        console.error('❌ Error insertando header de factura:', insertError);
        console.error('❌ Detalles del error SQL:', {
          message: insertError.message,
          code: insertError.code,
          number: insertError.number,
          state: insertError.state,
          class: insertError.class,
          serverName: insertError.serverName,
          procName: insertError.procName,
          lineNumber: insertError.lineNumber,
          originalError: insertError.originalError
        });
        console.error('❌ Valores que causaron el error:', {
          numfact: numfactFinal,
          codalm: codalmFinalTrunc,
          tipfac: tipfacFinal,
          codter: codterFinal,
          doccoc: doccocFinal,
          codven: codvenFinal,
          codcue: codcueFinal,
          resolucion_dian: resolucionDianFinal,
          Observa: observaFinal,
          codusu: codusuFinal,
          estfac: estfacFinal,
          estado_envio: estadoEnvioFinal,
          sey_key: seyKeyFinal,
          CUFE: cufeFinal
        });
        await tx.rollback();
        throw new Error(`Error insertando factura: ${insertError.message}. Verifique que todos los campos estén dentro de los límites permitidos.`);
      }

      console.log(`📦 Guardando ${items.length} items de factura...`);
      console.log(`📋 Items recibidos:`, JSON.stringify(items.map(it => ({
        productoId: it.productoId,
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
        descuentoPorcentaje: it.descuentoPorcentaje,
        ivaPorcentaje: it.ivaPorcentaje,
        subtotal: it.subtotal,
        valorIva: it.valorIva,
        total: it.total
      })), null, 2));
      
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const reqDet = new sql.Request(tx);
        
        // Validar que el productoId sea numérico
        const productoIdNum = typeof it.productoId === 'number' ? it.productoId : parseInt(it.productoId, 10);
        if (isNaN(productoIdNum) || productoIdNum <= 0) {
          console.error(`❌ Item ${idx + 1}: productoId inválido:`, it.productoId);
          throw new Error(`Item ${idx + 1}: productoId inválido: ${it.productoId}`);
        }
        
        // Obtener codins desde inv_insumos usando el id del producto
        const reqProducto = new sql.Request(tx);
        reqProducto.input('productoId', sql.Int, productoIdNum);
        const productoResult = await reqProducto.query(`
          SELECT TOP 1 codins, nomins
          FROM inv_insumos
          WHERE id = @productoId
        `);
        
        if (productoResult.recordset.length === 0) {
          await tx.rollback();
          throw new Error(`Item ${idx + 1}: Producto con ID ${productoIdNum} no encontrado en inv_insumos`);
        }
        
        const codins = String(productoResult.recordset[0].codins || '').trim().substring(0, 8).padStart(8, '0');
        const nomins = String(productoResult.recordset[0].nomins || '').trim();
        
        // Validar y normalizar valores numéricos
        const maxDecimal18_2 = 9999999999999999.99;
        const cantidadRaw = it.cantidad;
        const precioUnitarioRaw = it.precioUnitario;
        const descuentoPorcentajeRaw = it.descuentoPorcentaje || 0;
        const ivaPorcentajeRaw = it.ivaPorcentaje || 0;
        const subtotalRaw = it.subtotal;
        const valorIvaRaw = it.valorIva || 0;
        
        const cantidadNum = typeof cantidadRaw === 'number' ? cantidadRaw : parseFloat(cantidadRaw);
        const precioUnitarioNum = typeof precioUnitarioRaw === 'number' ? precioUnitarioRaw : parseFloat(precioUnitarioRaw);
        const descuentoPorcentajeNum = typeof descuentoPorcentajeRaw === 'number' ? descuentoPorcentajeRaw : parseFloat(descuentoPorcentajeRaw);
        const ivaPorcentajeNum = typeof ivaPorcentajeRaw === 'number' ? ivaPorcentajeRaw : parseFloat(ivaPorcentajeRaw);
        const subtotalNum = typeof subtotalRaw === 'number' ? subtotalRaw : parseFloat(subtotalRaw);
        const valorIvaNum = typeof valorIvaRaw === 'number' ? valorIvaRaw : parseFloat(valorIvaRaw);
        
        // Validar que sean números finitos
        if (!isFinite(cantidadNum) || isNaN(cantidadNum) || cantidadNum <= 0) {
          console.error(`❌ Item ${idx + 1}: cantidad inválida:`, cantidadRaw, '→', cantidadNum);
          throw new Error(`Item ${idx + 1}: cantidad inválida (${cantidadRaw})`);
        }
        if (!isFinite(precioUnitarioNum) || isNaN(precioUnitarioNum) || precioUnitarioNum < 0) {
          console.error(`❌ Item ${idx + 1}: precioUnitario inválido:`, precioUnitarioRaw, '→', precioUnitarioNum);
          throw new Error(`Item ${idx + 1}: precioUnitario inválido (${precioUnitarioRaw}). Verifique que los items de la remisión tengan precios.`);
        }
        
        // Normalizar valores dentro del rango válido
        const qtyinsFinal = Math.max(0.01, Math.min(Math.abs(cantidadNum), maxDecimal18_2));
        const valinsFinal = Math.max(0, Math.min(Math.abs(precioUnitarioNum), maxDecimal18_2));
        const desinsFinal = Math.max(0, Math.min(Math.abs(descuentoPorcentajeNum), 100));
        const ivainsFinal = Math.max(0, Math.min(Math.abs(ivaPorcentajeNum), 100));
        const valorIvaFinal = Math.max(0, Math.min(Math.abs(valorIvaNum), maxDecimal18_2));
        // Calcular valdescuento (valor del descuento, no porcentaje)
        const valdescuentoFinal = Math.max(0, Math.min(Math.abs(subtotalNum * (desinsFinal / 100)), maxDecimal18_2));
        // cosins (costo) - usar 0 si no se proporciona
        const cosinsFinal = 0;
        
        console.log(`➕ Insertando item ${idx + 1}/${items.length}:`, { 
          productoId: productoIdNum,
          codins: codins,
          qtyins: qtyinsFinal,
          valins: valinsFinal,
          desins: desinsFinal,
          ivains: valorIvaFinal,
          valdescuento: valdescuentoFinal,
          observa: (it.descripcion || nomins || '').substring(0, 50)
        });
        
        // Mapear a columnas reales de ven_detafact
        reqDet.input('codalm', sql.Char(3), codalmFinalTrunc);
        reqDet.input('tipfact', sql.Char(2), tipfacFinal);
        reqDet.input('numfac', sql.Char(12), numfactFinal.substring(0, 12).padEnd(12, ' '));
        reqDet.input('codins', sql.VarChar(8), codins);
        reqDet.input('qtyins', sql.Decimal(18, 2), qtyinsFinal);
        reqDet.input('valins', sql.Decimal(18, 2), valinsFinal);
        reqDet.input('ivains', sql.Decimal(18, 2), valorIvaFinal);
        reqDet.input('desins', sql.Decimal(5, 2), desinsFinal);
        reqDet.input('valdescuento', sql.Decimal(18, 2), valdescuentoFinal);
        reqDet.input('cosins', sql.Decimal(18, 2), cosinsFinal);
        reqDet.input('observa', sql.VarChar(50), (it.descripcion || nomins || '').substring(0, 50));
        reqDet.input('estfac', sql.Char(1), estfacFinal);
        reqDet.input('PRECIOUND', sql.Decimal(18, 2), valinsFinal);
        reqDet.input('QTYVTA', sql.Decimal(18, 2), qtyinsFinal);
        reqDet.input('PRECIO_LISTA', sql.Decimal(18, 2), valinsFinal);
        reqDet.input('id_factura', sql.Int, newId);
        
        try {
          await reqDet.query(`
            INSERT INTO ${TABLE_NAMES.facturas_detalle} (
              codalm, tipfact, numfac, codins, qtyins, valins, ivains, desins, valdescuento, cosins,
              observa, estfac, PRECIOUND, QTYVTA, PRECIO_LISTA, id_factura
            ) VALUES (
              @codalm, @tipfact, @numfac, @codins, @qtyins, @valins, @ivains, @desins, @valdescuento, @cosins,
              @observa, @estfac, @PRECIOUND, @QTYVTA, @PRECIO_LISTA, @id_factura
            );`);
          console.log(`✅ Item ${idx + 1} guardado correctamente`);
        } catch (itemError) {
          console.error(`❌ Error insertando item ${idx + 1}:`, itemError);
          console.error(`❌ Detalles del item:`, {
            codalm: codalmFinalTrunc,
            tipfact: tipfacFinal,
            numfac: numfactFinal,
            codins: codins,
            qtyins: qtyinsFinal,
            valins: valinsFinal,
            ivains: valorIvaFinal,
            desins: desinsFinal,
            valdescuento: valdescuentoFinal,
            cosins: cosinsFinal,
            observa: (it.descripcion || nomins || '').substring(0, 50),
            estfac: estfacFinal,
            id_factura: newId
          });
          console.error(`❌ Error SQL:`, {
            message: itemError.message,
            code: itemError.code,
            number: itemError.number,
            state: itemError.state,
            sqlMessage: itemError.originalError?.message
          });
          await tx.rollback();
          throw new Error(`Error insertando item ${idx + 1}: ${itemError.message}`);
        }
      }
      console.log(`✅ Todos los ${items.length} items de factura guardados`);

      // Actualizar factura_id en las remisiones relacionadas
      // Puede venir como remisionId (singular) o remisionesIds (array)
      const remisionesParaActualizar = [];
      
      // Si viene remisionesIds como array
      if (body.remisionesIds && Array.isArray(body.remisionesIds) && body.remisionesIds.length > 0) {
        remisionesParaActualizar.push(...body.remisionesIds);
      }
      
      // Si viene remisionId (singular), agregarlo también
      if (remisionId) {
        const remisionIdStr = String(remisionId);
        if (!remisionesParaActualizar.includes(remisionIdStr)) {
          remisionesParaActualizar.push(remisionIdStr);
        }
      }
      
      // NOTA: ven_remiciones_enc no tiene campo factura_id
      // Si necesitas relacionar remisiones con facturas, considera agregar este campo a la tabla
      // o usar una tabla de relación intermedia
      // Por ahora, se omite la actualización de factura_id en remisiones
      if (remisionesParaActualizar.length > 0) {
        console.log(`ℹ️ Nota: Se recibieron ${remisionesParaActualizar.length} remisión(es) para relacionar, pero ven_remiciones_enc no tiene campo factura_id.`);
      }
      
      // NOTA: ven_remiciones_enc no tiene campo factura_id
      // Si necesitas relacionar remisiones con facturas, considera agregar este campo a la tabla
      // o usar una tabla de relación intermedia
      // Por ahora, se omite la actualización de factura_id en remisiones
      console.log(`ℹ️ Nota: ven_remiciones_enc no tiene campo factura_id. Se omite la relación remisión-factura.`);

      await tx.commit();
      res.json({ success: true, data: { id: newId } });
    } catch (inner) {
      await tx.rollback();
      throw inner;
    }
  } catch (error) {
    console.error('❌ Error creando factura:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Detalles del error:', {
      message: error.message,
      code: error.code,
      number: error.number,
      state: error.state,
      class: error.class,
      serverName: error.serverName,
      procName: error.procName,
      lineNumber: error.lineNumber,
      originalError: error.originalError
    });
    console.error('❌ Body recibido:', JSON.stringify(req.body, null, 2));
    res.status(500).json({ 
      success: false, 
      message: 'Error creando factura', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        number: error.number,
        state: error.state,
        lineNumber: error.lineNumber,
        sqlMessage: error.originalError?.message || error.message
      } : undefined
    });
  }
});

// --- ACTUALIZAR FACTURA ---
// Registrar el endpoint PUT antes de definirlo
console.log(`📝 Registrando endpoint: PUT /api/facturas/:id`);
app.put('/api/facturas/:id', async (req, res) => {
  console.log(`✅ Endpoint PUT /api/facturas/:id alcanzado`);
  console.log(`   Params:`, req.params);
  console.log(`   Method:`, req.method);
  console.log(`   Path:`, req.path);
  console.log(`   URL completa:`, req.url);
  console.log(`   Original URL:`, req.originalUrl);
  const { id } = req.params;
  const body = req.body || {};
  
  console.log(`🔍 ID recibido: "${id}" (tipo: ${typeof id})`);
  
  // Intentar convertir a número
  const idNum = parseInt(id, 10);
  
  if (isNaN(idNum)) {
    console.error(`❌ ID no es numérico: "${id}"`);
    return res.status(400).json({ 
      success: false, 
      message: `ID de factura inválido: ${id}. Se espera un número.`,
      error: 'INVALID_ID',
      debug: {
        idRecibido: id,
        tipoId: typeof id
      }
    });
  }
  
  console.log(`✅ ID convertido a número: ${idNum}`);
  
  console.log(`📥 Recibida solicitud PUT /api/facturas/${idNum} con body:`, JSON.stringify(body, null, 2));
  
  try {
    const pool = await getConnection();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    
    try {
      // Verificar que la factura existe
      const reqCheck = new sql.Request(tx);
      reqCheck.input('id', sql.Int, idNum);
      const checkResult = await reqCheck.query(`
        SELECT ID, numfact, estfac 
        FROM ${TABLE_NAMES.facturas} 
        WHERE ID = @id
      `);
      
      if (checkResult.recordset.length === 0) {
        await tx.rollback();
        return res.status(404).json({ 
          success: false, 
          message: `Factura con ID ${idNum} no encontrada`,
          error: 'FACTURA_NOT_FOUND'
        });
      }
      
      const facturaExistente = checkResult.recordset[0];
      const estadoActualMapeado = mapEstadoFromDb(facturaExistente.estfac);
      console.log(`✅ Factura encontrada: ${facturaExistente.numfact} (estado: ${facturaExistente.estfac} -> ${estadoActualMapeado})`);
      
      // Mapear estado del frontend al backend si es necesario
      const estadoDb = body.estado ? mapEstadoToDb(body.estado) : facturaExistente.estfac;
      
      // Construir la consulta de actualización dinámicamente
      const updates = [];
      const reqUpdate = new sql.Request(tx);
      reqUpdate.input('id', sql.Int, idNum);
      
      // Si se está timbrando (cambiando estado a ENVIADA), enviar a DIAN
      let cufeGenerado = null;
      let fechaTimbradoGenerada = null;
      let estadoFinal = estadoDb;
      if (body.estado === 'ENVIADA' && facturaExistente.estado !== 'E') {
        // Proceso de timbrado real con DIAN
        console.log(`🔄 Iniciando proceso de timbrado con DIAN para factura ${facturaExistente.numero_factura}...`);
        
        try {
          // 1. Obtener resolución DIAN activa
          const resolution = await DIANService.getDIANResolution();
          
          // 2. Obtener parámetros DIAN
          const dianParams = await DIANService.getDIANParameters();
          
          // 3. Obtener factura completa con detalles y cliente
          const facturaCompleta = await DIANService.getFacturaCompleta(idNum);
          
          // 4. Transformar factura al formato JSON requerido por DIAN
          const invoiceJson = await DIANService.transformVenFacturaForDIAN(
            facturaCompleta,
            resolution,
            dianParams,
            body.invoiceData || {}
          );
          
          // 5. Enviar factura a DIAN
          const dianResponse = await DIANService.sendInvoiceToDIAN(
            invoiceJson,
            dianParams.testSetID,
            dianParams.url_base
          );
          
          // 6. Procesar respuesta de DIAN
          console.log('\n' + '='.repeat(80));
          console.log('🔄 PROCESANDO RESPUESTA DE DIAN:');
          console.log('='.repeat(80));
          console.log('📋 success:', dianResponse.success);
          console.log('📋 status:', dianResponse.status);
          console.log('📋 statusCode:', dianResponse.statusCode);
          console.log('📋 cufe:', dianResponse.cufe || 'null');
          console.log('📋 uuid:', dianResponse.uuid || 'null');
          console.log('📋 isValid:', dianResponse.isValid);
          console.log('📋 message:', dianResponse.message || 'null');
          
          if (dianResponse.success && dianResponse.cufe) {
            // Factura aceptada y timbrada
            cufeGenerado = dianResponse.cufe;
            fechaTimbradoGenerada = dianResponse.fechaTimbrado || new Date();
            estadoFinal = 'E'; // ENVIADA
            
            console.log('\n✅ FACTURA ACEPTADA Y TIMBRADA POR DIAN:');
            console.log('   - CUFE:', cufeGenerado);
            console.log('   - UUID:', dianResponse.uuid || 'N/A');
            console.log('   - Fecha timbrado:', fechaTimbradoGenerada);
            console.log('   - PDF URL:', dianResponse.pdf_url || 'N/A');
            console.log('   - XML URL:', dianResponse.xml_url || 'N/A');
            console.log('   - QR Code:', dianResponse.qr_code ? 'Presente' : 'N/A');
            console.log('='.repeat(80) + '\n');
          } else {
            // Factura rechazada o error en respuesta
            estadoFinal = 'R'; // RECHAZADA
            
            console.log('\n❌ FACTURA RECHAZADA O ERROR EN RESPUESTA DIAN:');
            console.log('   - success:', dianResponse.success);
            console.log('   - status:', dianResponse.status);
            console.log('   - statusCode:', dianResponse.statusCode);
            console.log('   - message:', dianResponse.message || 'Sin mensaje');
            console.log('   - CUFE presente:', dianResponse.cufe ? 'Sí' : 'No');
            console.log('   - Respuesta completa:', JSON.stringify(dianResponse, null, 2));
            console.log('='.repeat(80) + '\n');
          }
        } catch (dianError) {
          // Error al enviar a DIAN
          console.error('❌ Error al enviar factura a DIAN:', dianError);
          console.error('   Stack:', dianError.stack);
          
          // Marcar como rechazada si hay error
          estadoFinal = 'R'; // RECHAZADA
          
          // Loggear error detallado pero continuar con la actualización
          // El estado RECHAZADA quedará guardado en la base de datos
        }
      }
      
      // Construir actualizaciones dinámicamente usando las columnas reales
      if (body.estado !== undefined) {
        reqUpdate.input('estfac', sql.VarChar(10), estadoFinal);
        updates.push('estfac = @estfac');
      }
      
      if (body.observaciones !== undefined) {
        reqUpdate.input('Observa', sql.VarChar(500), body.observaciones);
        updates.push('Observa = @Observa');
      }
      
      // Si se generó un CUFE en la simulación, usarlo
      if (cufeGenerado) {
        reqUpdate.input('CUFE', sql.VarChar(100), cufeGenerado);
        updates.push('CUFE = @CUFE');
      } else if (body.cufe !== undefined) {
        reqUpdate.input('CUFE', sql.VarChar(100), body.cufe);
        updates.push('CUFE = @CUFE');
      }
      
      // Actualizar fecsys siempre que se actualice la factura
      reqUpdate.input('fecsys', sql.DateTime, new Date());
      updates.push('fecsys = @fecsys');
      
      // Campos adicionales opcionales
      if (body.subtotal !== undefined) {
        const maxDecimal18_2 = 9999999999999999.99;
        const valvtaFinal = Math.max(0, Math.min(Math.abs(parseFloat(body.subtotal) || 0), maxDecimal18_2));
        reqUpdate.input('valvta', sql.Decimal(18, 2), valvtaFinal);
        updates.push('valvta = @valvta');
      }
      
      if (body.ivaValor !== undefined) {
        const maxDecimal18_2 = 9999999999999999.99;
        const valivaFinal = Math.max(0, Math.min(Math.abs(parseFloat(body.ivaValor) || 0), maxDecimal18_2));
        reqUpdate.input('valiva', sql.Decimal(18, 2), valivaFinal);
        updates.push('valiva = @valiva');
      }
      
      if (body.total !== undefined) {
        const maxDecimal18_2 = 9999999999999999.99;
        const netfacFinal = Math.max(0, Math.min(Math.abs(parseFloat(body.total) || 0), maxDecimal18_2));
        reqUpdate.input('netfac', sql.Decimal(18, 2), netfacFinal);
        updates.push('netfac = @netfac');
      }
      
      if (body.descuentoValor !== undefined) {
        const maxDecimal18_2 = 9999999999999999.99;
        const valdctoFinal = Math.max(0, Math.min(Math.abs(parseFloat(body.descuentoValor) || 0), maxDecimal18_2));
        reqUpdate.input('valdcto', sql.Decimal(18, 2), valdctoFinal);
        updates.push('valdcto = @valdcto');
      }
      
      if (updates.length === 0) {
        await tx.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'No se proporcionaron campos para actualizar',
          error: 'NO_UPDATES'
        });
      }
      
      const updateQuery = `
        UPDATE ${TABLE_NAMES.facturas} 
        SET ${updates.join(', ')}
        WHERE ID = @id;
        
        SELECT 
          f.ID as id,
          f.numfact as numeroFactura,
          f.codalm as empresaId,
          f.tipfac as tipoFactura,
          f.codter as clienteId,
          f.doccoc as documentoContable,
          f.fecfac as fechaFactura,
          f.venfac as fechaVencimiento,
          f.codven as vendedorId,
          f.valvta as subtotal,
          f.valiva as ivaValor,
          f.valotr as otrosValores,
          f.valant as anticipos,
          f.valdev as devoluciones,
          f.abofac as abonos,
          f.valdcto as descuentoValor,
          f.valret as retenciones,
          f.valrica as retencionICA,
          f.valriva as retencionIVA,
          f.netfac as total,
          f.valcosto as costo,
          f.codcue as cuenta,
          f.efectivo,
          f.cheques,
          f.credito,
          f.tarjetacr as tarjetaCredito,
          f.TarjetaDB as tarjetaDebito,
          f.Transferencia,
          f.valpagado as valorPagado,
          f.resolucion_dian as resolucionDian,
          f.Observa as observaciones,
          f.TARIFA_CREE as tarifaCREE,
          f.RETECREE as retencionCREE,
          f.codusu as usuarioId,
          f.fecsys as fechaSistema,
          f.estfac as estado,
          f.VALDOMICILIO as valorDomicilio,
          f.estado_envio as estadoEnvio,
          f.sey_key as seyKey,
          f.CUFE as cufe,
          f.IdCaja as cajaId,
          f.Valnotas as valorNotas
        FROM ${TABLE_NAMES.facturas} f
        WHERE f.ID = @id;
      `;
      
      const result = await reqUpdate.query(updateQuery);
      
      if (result.recordset.length === 0) {
        await tx.rollback();
        return res.status(500).json({ 
          success: false, 
          message: 'Error al actualizar la factura',
          error: 'UPDATE_FAILED'
        });
      }
      
      await tx.commit();
      
      const facturaActualizada = result.recordset[0];
      // Procesar remisionesIds: puede venir como string separado por comas o null
      let remisionesIds = [];
      if (facturaActualizada.remisionesIds) {
        if (typeof facturaActualizada.remisionesIds === 'string' && facturaActualizada.remisionesIds.trim()) {
          remisionesIds = facturaActualizada.remisionesIds.split(',').map((id) => id.trim()).filter((id) => id.length > 0);
        } else if (Array.isArray(facturaActualizada.remisionesIds)) {
          remisionesIds = facturaActualizada.remisionesIds.map((id) => String(id));
        }
      }
      // Si no hay remisionesIds pero hay remisionId (singular), usarlo
      if (remisionesIds.length === 0 && facturaActualizada.remisionId) {
        remisionesIds = [String(facturaActualizada.remisionId)];
      }
      
      // Incluir CUFE generado si existe
      const cufeFinal = cufeGenerado || facturaActualizada.cufe;
      const fechaTimbradoFinal = fechaTimbradoGenerada || facturaActualizada.fechaTimbrado;
      
      const facturaMapeada = {
        id: String(facturaActualizada.id),
        numeroFactura: facturaActualizada.numeroFactura,
        fechaFactura: facturaActualizada.fechaFactura,
        fechaVencimiento: facturaActualizada.fechaVencimiento,
        clienteId: facturaActualizada.clienteId,
        vendedorId: facturaActualizada.vendedorId,
        remisionId: facturaActualizada.remisionId,
        pedidoId: facturaActualizada.pedidoId,
        empresaId: facturaActualizada.empresaId,
        subtotal: facturaActualizada.subtotal,
        descuentoValor: facturaActualizada.descuentoValor,
        ivaValor: facturaActualizada.ivaValor,
        total: facturaActualizada.total,
        observaciones: facturaActualizada.observaciones,
        estado: mapEstadoFromDb(estadoFinal || facturaActualizada.estado),
        cufe: cufeFinal,
        fechaTimbrado: fechaTimbradoFinal,
        remisionesIds: remisionesIds
      };
      
      console.log(`✅ Factura actualizada exitosamente:`, {
        id: facturaMapeada.id,
        numeroFactura: facturaMapeada.numeroFactura,
        estado: facturaMapeada.estado
      });
      
      res.json({ 
        success: true, 
        data: facturaMapeada
      });
    } catch (inner) {
      await tx.rollback();
      console.error('❌ Error interno en transacción:', inner);
      throw inner;
    }
  } catch (error) {
    console.error('❌ Error actualizando factura:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: `Error actualizando factura: ${error.message}`, 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  console.log(`❌ Ruta no encontrada: ${req.method} ${req.path}`);
  console.log(`   Headers:`, req.headers);
  console.log(`   Body:`, req.body);
  res.status(404).json({ 
    success: false, 
    error: 'Ruta no encontrada',
    method: req.method,
    path: req.path
  });
});

// Manejo de errores globales
app.use((error, req, res, next) => {
  console.error('Error global:', error);
  res.status(500).json({ 
    success: false, 
    message: 'Error interno del servidor',
    error: error.message 
  });
});

// Manejo de errores no capturados para evitar que el proceso termine
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado (uncaughtException):', error);
  console.error('Stack:', error.stack);
  // NO hacer process.exit() - permitir que el servidor continúe
  // Solo loguear el error para debugging
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada (unhandledRejection):', reason);
  console.error('Promise:', promise);
  // NO hacer process.exit() - permitir que el servidor continúe
  // Solo loguear el error para debugging
});

// Manejo de señales de terminación para cerrar conexiones correctamente
process.on('SIGTERM', async () => {
  console.log('📡 Señal SIGTERM recibida, cerrando servidor...');
  try {
    const { closeConnection } = require('./services/sqlServerClient.cjs');
    await closeConnection();
  } catch (error) {
    console.error('Error cerrando conexión:', error);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n📡 Señal SIGINT recibida (Ctrl+C), cerrando servidor...');
  try {
    const { closeConnection } = require('./services/sqlServerClient.cjs');
    await closeConnection();
  } catch (error) {
    console.error('Error cerrando conexión:', error);
  }
  process.exit(0);
});

// Iniciar servidor solo si no estamos en Vercel (serverless)
// En Vercel, el servidor se ejecuta como función serverless
if (!process.env.VERCEL) {
  const HOST = '0.0.0.0'; // Escuchar en todas las interfaces de red
  const localIP = getLocalIP();
  
  // Intentar iniciar el servidor con manejo de errores
  try {
    const server = app.listen(PORT, HOST, () => {
      console.log('\n' + '='.repeat(60));
      console.log(`🚀 Servidor API ejecutándose en puerto ${PORT}`);
      console.log('='.repeat(60));
      console.log('\n📱 Acceso desde otros dispositivos en la red:');
      console.log(`   🌐 URL de red: http://${localIP}:${PORT}`);
      console.log(`   🔗 Health check: http://${localIP}:${PORT}/api/health`);
      console.log(`   🔗 Test connection: http://${localIP}:${PORT}/api/test-connection`);
      console.log('\n💻 Acceso local:');
      console.log(`   🏠 URL local: http://localhost:${PORT}`);
      console.log(`   🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`   🔗 Test connection: http://localhost:${PORT}/api/test-connection`);
      console.log('\n📋 Endpoints principales:');
      console.log(`   GET  /api/facturas - Listar facturas`);
      console.log(`   POST /api/facturas - Crear factura`);
      console.log(`   PUT  /api/facturas/:id - Actualizar factura`);
      console.log('\n' + '='.repeat(60));
      console.log(`✅ Servidor listo! Otros dispositivos pueden conectarse usando:`);
      console.log(`   http://${localIP}:${PORT}`);
      console.log('='.repeat(60) + '\n');
    });
    
    // Manejar errores del servidor
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Error: El puerto ${PORT} ya está en uso.`);
        console.error('💡 Intenta usar otro puerto o detén el proceso que está usando este puerto.');
      } else {
        console.error('❌ Error del servidor:', error);
      }
      // NO hacer process.exit() - solo loguear el error
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    // NO hacer process.exit() - solo loguear el error
  }
} else {
  console.log('🌐 Ejecutándose en Vercel (Serverless Functions)');
}

module.exports = app;
