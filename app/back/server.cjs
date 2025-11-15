const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const os = require('os');
const { executeQuery, executeQueryWithParams, testConnection } = require('./services/sqlServerClient.cjs');
const { QUERIES, TABLE_NAMES } = require('./services/dbConfig.cjs');
const { getConnection } = require('./services/sqlServerClient.cjs');
const sql = require('mssql');
const { GoogleGenerativeAI } = require('@google/generative-ai');
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
    console.error('Error fetching facturas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo facturas',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Ruta para obtener detalles de facturas
app.get('/api/facturas-detalle', async (req, res) => {
  try {
    const detalles = await executeQuery(QUERIES.GET_FACTURAS_DETALLE);
    res.json({ success: true, data: detalles });
  } catch (error) {
    console.error('Error fetching facturas detalle:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo detalles de facturas',
      error: error instanceof Error ? error.message : 'Unknown error'
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
          // ven_recibos usa numped para relacionarse con pedidos, no pedido_id
          const reqRemisiones = new sql.Request(pool);
          reqRemisiones.input('pedidoId', sql.Int, pedidoId);
          // Primero obtener el numero_pedido para generar numped
          const reqPedidoNum = new sql.Request(pool);
          reqPedidoNum.input('pedidoId', sql.Int, pedidoId);
          const pedidoNumResult = await reqPedidoNum.query(`
            SELECT numero_pedido
            FROM ven_pedidos
            WHERE id = @pedidoId
          `);
          const numeroPedido = pedidoNumResult.recordset[0]?.numero_pedido;
          
          // Generar numped desde numero_pedido
          let numpedForRemisiones = null;
          if (numeroPedido) {
            const match = String(numeroPedido).match(/(\d+)/);
            if (match) {
              numpedForRemisiones = 'PED' + match[1].padStart(5, '0');
            } else {
              numpedForRemisiones = String(numeroPedido).replace(/-/g, '').substring(0, 8).padStart(8, '0');
            }
            numpedForRemisiones = numpedForRemisiones.substring(0, 8).padStart(8, '0');
          }
          
          let remisionesResult;
          if (numpedForRemisiones) {
            reqRemisiones.input('numped', sql.Char(8), numpedForRemisiones);
            remisionesResult = await reqRemisiones.query(`
              SELECT COUNT(*) as total
              FROM ven_recibos
              WHERE numped = @numped
            `);
          } else {
            // Fallback: intentar con pedido_id si existe
            remisionesResult = await reqRemisiones.query(`
              SELECT COUNT(*) as total
              FROM ven_recibos
              WHERE pedido_id = @pedidoId
            `);
          }
          
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
            let itemsRemitidosResult;
            // ven_recibos usa numped, no pedido_id. ven_detarecibo no tiene items de productos, solo pagos
            // Por ahora, asumir que no hay items remitidos ya que ven_detarecibo es para pagos
            // Si necesitas verificar items remitidos, necesitarías otra tabla o estructura
            itemsRemitidosResult = { recordset: [] };
            
            // Verificar si todos los items están completamente remitidos
            let todosRemitidos = true;
            let algunoRemitido = false;
            
            for (const itemPedido of itemsPedidoResult.recordset) {
              const itemRemitido = itemsRemitidosResult.recordset.find(
                ir => ir.producto_id === itemPedido.producto_id
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
    console.log('📦 [Backend] Obteniendo remisiones desde ven_recibos...');
    const { codter, codalm, numped, estrec, page, pageSize, search } = req.query;
    
    // Construir WHERE dinámicamente
    let whereClauses = [];
    if (codter) whereClauses.push(`LTRIM(RTRIM(r.codter)) = LTRIM(RTRIM('${codter}'))`);
    if (codalm) whereClauses.push(`r.codalm = '${codalm}'`);
    if (numped) whereClauses.push(`r.numped = ${numped}`);
    if (estrec) {
      // Mapear estado del frontend al estado de BD
      const estadoMap = {
        'BORRADOR': 'B',
        'ENTREGADO': 'E',
        'EN_TRANSITO': 'T',
        'CANCELADO': 'C'
      };
      const estadoDb = estadoMap[estrec] || estrec;
      whereClauses.push(`r.estrec = '${estadoDb}'`);
    }
    
    // Búsqueda por número de remisión, cliente o observaciones
    if (search && search.trim() !== '' && search !== '[object Object]') {
      const searchTerm = search.trim().replace(/'/g, "''"); // Escapar comillas simples
      whereClauses.push(`(
        CAST(r.numrec AS VARCHAR) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(r.codter)) LIKE '%${searchTerm}%' OR
        LTRIM(RTRIM(r.observa)) LIKE '%${searchTerm}%'
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
      FROM ven_recibos r
      ${where}
    `;
    const countResult = await executeQuery(countQuery);
    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / size);
    
    // Query principal con paginación
    const sqlQuery = `
      SELECT 
        r.id,
        -- Mapear numrec a numeroRemision (formato: REM-0001)
        'REM-' + RIGHT('0000' + CAST(r.numrec AS VARCHAR), 4) as numeroRemision,
        r.numrec,
        r.codalm,
        r.tipdoc,
        -- Mapear fecrec a fechaRemision
        CAST(r.fecrec AS DATE) as fechaRemision,
        r.fecrec,
        -- Mapear numped a pedidoId (puede ser NULL)
        CAST(r.numped AS VARCHAR(20)) as pedidoId,
        r.numped,
        -- Mapear codter a clienteId
        LTRIM(RTRIM(r.codter)) as clienteId,
        r.codter,
        -- Mapear CODVEN a vendedorId
        LTRIM(RTRIM(r.CODVEN)) as vendedorId,
        r.CODVEN as codVendedor,
        -- Mapear valores: valrec = total, netrec = neto, desrec = descuento
        COALESCE(r.netrec, 0) as subtotal,
        COALESCE(r.desrec, 0) as descuentoValor,
        -- Calcular IVA si es necesario (valrec - netrec - desrec)
        COALESCE(r.valrec, 0) - COALESCE(r.netrec, 0) - COALESCE(r.desrec, 0) as ivaValor,
        COALESCE(r.valrec, 0) as total,
        -- Mapear observa a observaciones
        LTRIM(RTRIM(COALESCE(r.observa, ''))) as observaciones,
        -- Mapear estrec a estado (B=BORRADOR, otros estados según corresponda)
        CASE 
          WHEN r.estrec = 'B' THEN 'BORRADOR'
          WHEN r.estrec = 'E' THEN 'ENTREGADO'
          WHEN r.estrec = 'T' THEN 'EN_TRANSITO'
          WHEN r.estrec = 'C' THEN 'CANCELADO'
          ELSE 'BORRADOR'
        END as estado,
        r.estrec as estadoOriginal,
        -- Mapear codalm a empresaId
        r.codalm as empresaId,
        -- Campos adicionales de la BD real
        r.fecsys as fechaCreacion,
        r.codusu as codUsuario,
        -- Campos que no existen en la BD pero se dejan como NULL para compatibilidad
        NULL as facturaId,
        NULL as estadoEnvio,
        NULL as metodoEnvio,
        NULL as transportadoraId,
        NULL as transportadora,
        NULL as numeroGuia,
        NULL as fechaDespacho
      FROM ven_recibos r
      ${where}
      ORDER BY r.fecrec DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${size} ROWS ONLY
    `;
    
    const remisiones = await executeQuery(sqlQuery);
    console.log(`✅ [Backend] Remisiones encontradas: ${remisiones.length} de ${total} total (página ${pageNum}/${totalPages})`);
    res.json({ 
      success: true, 
      data: remisiones,
      pagination: {
        page: pageNum,
        pageSize: size,
        total: total,
        totalPages: totalPages
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo remisiones:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Detalle de pagos/cobros asociados (ven_detarecibo)
app.get('/api/remisiones/:numrec/detalle', async (req, res) => {
  try {
    const { numrec } = req.params;
    const { codalm, tipdoc } = req.query;
    if (!codalm || !tipdoc) {
      return res.status(400).json({ success: false, message: 'codalm y tipdoc son requeridos para identificar el recibo' });
    }
    const sql = `
      SELECT
        id,
        codalm,
        tipdoc,
        numrec,
        valcuo,
        forpag,
        numdoc,
        codban,
        feccheq,
        abocuo,
        salcuo,
        estrec
      FROM ven_detarecibo
      WHERE numrec = ${numrec} AND codalm = '${codalm}' AND tipdoc = '${tipdoc}'
    `;
    const data = await executeQuery(sql);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para obtener items de productos de una remisión (desde el pedido relacionado)
app.get('/api/remisiones-detalle', async (req, res) => {
  try {
    console.log('📦 [Backend] Obteniendo detalles de remisiones (items de productos)...');
    
    // Obtener todas las remisiones con sus pedidos relacionados
    // Compatible con ambas estructuras: numped (real) y pedido_id (alternativa)
    const remisionesQuery = `
      SELECT DISTINCT
        r.id as remisionId,
        r.numrec,
        COALESCE(r.numped, CAST(r.pedido_id AS VARCHAR)) as numped,
        r.pedido_id,
        r.codalm,
        r.tipdoc
      FROM ven_recibos r
      WHERE (r.numped IS NOT NULL AND r.numped > 0) OR (r.pedido_id IS NOT NULL AND r.pedido_id > 0)
    `;
    const remisiones = await executeQuery(remisionesQuery);
    
    if (remisiones.length === 0) {
      console.log('⚠️ [Backend] No se encontraron remisiones con pedidos relacionados');
      return res.json({ success: true, data: [] });
    }
    
    // Obtener numpeds únicos y también pedido_ids para mapear
    const numpeds = remisiones.map(r => r.numped).filter(v => v && v !== '0' && v !== '');
    const pedidoIds = remisiones.map(r => r.pedido_id).filter(v => v && v > 0);
    
    if (numpeds.length === 0 && pedidoIds.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    // Construir query para obtener items, compatible con ambas estructuras
    let itemsQuery;
    if (numpeds.length > 0) {
      // Usar numped (estructura real)
      const numpedsStr = numpeds.map(n => `'${String(n).substring(0, 8).padStart(8, '0')}'`).join(',');
      itemsQuery = `
        SELECT 
          pd.numped,
          pd.codins as codProducto,
          pd.codins,
          -- Buscar el ID del producto desde inv_insumos
          (SELECT TOP 1 id FROM inv_insumos WHERE codins = pd.codins) as productoId,
          pd.canped as cantidad,
          pd.valins as precioUnitario,
          COALESCE(pd.dctped, 0) as descuentoPorcentaje,
          COALESCE(pd.ivaped, 0) as ivaPorcentaje,
          -- Obtener descripción del producto
          (SELECT TOP 1 LTRIM(RTRIM(COALESCE(desins, ''))) FROM inv_insumos WHERE codins = pd.codins) as descripcion,
          -- Calcular subtotal, IVA y total
          pd.canped * pd.valins * (1 - COALESCE(pd.dctped, 0) / 100) as subtotal,
          pd.canped * pd.valins * (1 - COALESCE(pd.dctped, 0) / 100) * (COALESCE(pd.ivaped, 0) / 100) as valorIva,
          pd.canped * pd.valins * (1 - COALESCE(pd.dctped, 0) / 100) * (1 + COALESCE(pd.ivaped, 0) / 100) as total,
          -- Campos adicionales
          COALESCE(pd.canent, 0) as cantEntregada,
          COALESCE(pd.canfac, 0) as cantFacturada,
          pd.estped as estadoItem,
          pd.codalm,
          pd.serial,
          pd.numfac
        FROM ven_detapedidos pd
        WHERE pd.numped IN (${numpedsStr})
      `;
    } else {
      // Usar pedido_id (estructura alternativa)
      const pedidoIdsStr = pedidoIds.join(',');
      itemsQuery = `
        SELECT 
          CAST(pd.pedido_id AS VARCHAR) as numped,
          pd.codins as codProducto,
          pd.codins,
          pd.producto_id as productoId,
          pd.cantidad,
          pd.precio_unitario as precioUnitario,
          COALESCE(pd.descuento_porcentaje, 0) as descuentoPorcentaje,
          COALESCE(pd.iva_porcentaje, 0) as ivaPorcentaje,
          pd.descripcion,
          COALESCE(pd.subtotal, 0) as subtotal,
          COALESCE(pd.valor_iva, 0) as valorIva,
          COALESCE(pd.total, 0) as total,
          0 as cantEntregada,
          0 as cantFacturada,
          'P' as estadoItem,
          pd.codalm,
          NULL as serial,
          NULL as numfac
        FROM ven_detapedidos pd
        WHERE pd.pedido_id IN (${pedidoIdsStr})
      `;
    }
    
    const items = await executeQuery(itemsQuery);
    
    // Mapear items a remisiones usando numped o pedido_id
    const itemsMapeados = [];
    items.forEach(item => {
      // Encontrar todas las remisiones que corresponden a este pedido
      const remisionesDelPedido = remisiones.filter(r => {
        const remisionNumped = String(r.numped || '').trim();
        const itemNumped = String(item.numped || '').trim();
        return remisionNumped === itemNumped || 
               (r.pedido_id && String(r.pedido_id) === itemNumped);
      });
      
      remisionesDelPedido.forEach(remision => {
        itemsMapeados.push({
          id: `rem-${remision.remisionId}-prod-${item.codProducto}`,
          remisionId: String(remision.remisionId),
          numrec: remision.numrec, // Agregar numrec para facilitar el match
          productoId: item.productoId ? Number(item.productoId) : null,
          codProducto: item.codProducto,
          cantidad: Number(item.cantidad) || 0,
          precioUnitario: Number(item.precioUnitario) || 0,
          descuentoPorcentaje: Number(item.descuentoPorcentaje) || 0,
          ivaPorcentaje: Number(item.ivaPorcentaje) || 0,
          descripcion: item.descripcion || '',
          subtotal: Number(item.subtotal) || 0,
          valorIva: Number(item.valorIva) || 0,
          total: Number(item.total) || 0,
          cantEntregada: Number(item.cantEntregada) || 0,
          cantFacturada: Number(item.cantFacturada) || 0,
          estadoItem: item.estadoItem,
          codalm: item.codalm,
          serial: item.serial,
          numFactura: item.numfac
        });
      });
    });
    
    console.log(`✅ [Backend] Items de remisiones encontrados: ${itemsMapeados.length}`);
    res.json({ success: true, data: itemsMapeados });
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
      FROM ven_notas
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
    console.error('Error fetching notas credito:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo notas de crédito',
      error: error instanceof Error ? error.message : 'Unknown error'
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
      const subtotalNum = Number(subtotal) || 0;
      const descuentoValorNum = Number(descuentoValor) || 0;
      const ivaValorNum = Number(ivaValor) || 0;
      const totalNum = Number(total) || 0;
      const impoconsumoValorNum = Number(impoconsumoValor) || 0;
      
      // Validar que sean números finitos
      const subtotalFinal = isFinite(subtotalNum) ? Math.max(0, subtotalNum) : 0;
      const descuentoValorFinal = isFinite(descuentoValorNum) ? Math.max(0, descuentoValorNum) : 0;
      const ivaValorFinal = isFinite(ivaValorNum) ? Math.max(0, ivaValorNum) : 0;
      const totalFinal = isFinite(totalNum) ? Math.max(0, totalNum) : 0;
      const impoconsumoValorFinal = isFinite(impoconsumoValorNum) ? Math.max(0, impoconsumoValorNum) : 0;
      
      // Calcular porcentajes si es necesario - Limitar a rango válido para DECIMAL(5,2) (máx 999.99)
      let descuentoPorcentaje = 0;
      if (subtotalFinal > 0 && descuentoValorFinal > 0) {
        descuentoPorcentaje = (descuentoValorFinal / subtotalFinal) * 100;
        // Limitar a 999.99 (máximo para DECIMAL(5,2))
        descuentoPorcentaje = Math.min(Math.max(descuentoPorcentaje, 0), 999.99);
        // Redondear a 2 decimales
        descuentoPorcentaje = Math.round(descuentoPorcentaje * 100) / 100;
      }
      
      let ivaPorcentaje = 0;
      const baseParaIva = subtotalFinal - descuentoValorFinal;
      if (baseParaIva > 0 && ivaValorFinal > 0) {
        ivaPorcentaje = (ivaValorFinal / baseParaIva) * 100;
        // Limitar a 999.99 (máximo para DECIMAL(5,2))
        ivaPorcentaje = Math.min(Math.max(ivaPorcentaje, 0), 999.99);
        // Redondear a 2 decimales
        ivaPorcentaje = Math.round(ivaPorcentaje * 100) / 100;
      }
      
      // Validar que no sean NaN o Infinity
      if (!isFinite(descuentoPorcentaje)) descuentoPorcentaje = 0;
      if (!isFinite(ivaPorcentaje)) ivaPorcentaje = 0;
      
      // Asegurar que los porcentajes estén dentro del rango válido y redondeados
      descuentoPorcentaje = Math.max(0, Math.min(999.99, Math.round(descuentoPorcentaje * 100) / 100));
      ivaPorcentaje = Math.max(0, Math.min(999.99, Math.round(ivaPorcentaje * 100) / 100));
      
      // Limitar valores DECIMAL(18,2) al máximo permitido y asegurar exactamente 2 decimales
      const maxDecimal18_2 = 9999999999999999.99;
      const subtotalFinalLimited = parseFloat(Math.min(subtotalFinal, maxDecimal18_2).toFixed(2));
      const descuentoValorFinalLimited = parseFloat(Math.min(descuentoValorFinal, maxDecimal18_2).toFixed(2));
      const ivaValorFinalLimited = parseFloat(Math.min(ivaValorFinal, maxDecimal18_2).toFixed(2));
      const impoconsumoValorFinalLimited = parseFloat(Math.min(impoconsumoValorFinal, maxDecimal18_2).toFixed(2));
      const totalFinalLimited = parseFloat(Math.min(totalFinal, maxDecimal18_2).toFixed(2));
      
      // Asegurar que los porcentajes tengan exactamente 2 decimales
      const descuentoPorcentajeFinal = parseFloat(descuentoPorcentaje.toFixed(2));
      const ivaPorcentajeFinal = parseFloat(ivaPorcentaje.toFixed(2));
      
      // Log de depuración
      console.log('📊 Valores validados para inserción:', {
        subtotal: subtotalFinalLimited,
        descuentoValor: descuentoValorFinalLimited,
        descuentoPorcentaje: descuentoPorcentajeFinal,
        ivaValor: ivaValorFinalLimited,
        ivaPorcentaje: ivaPorcentajeFinal,
        impoconsumoValor: impoconsumoValorFinalLimited,
        total: totalFinalLimited
      });
      
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
      const empresaIdNum = Number(empresaId) || 1;
      const empresaIdValid = isFinite(empresaIdNum) && empresaIdNum >= -2147483648 && empresaIdNum <= 2147483647 
        ? Math.floor(empresaIdNum) 
        : 1;
      
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
        const cantidadNum = Number(it.cantidad) || 0;
        const precioUnitarioNum = Number(it.precioUnitario) || 0;
        const descuentoValorNum = Number(it.descuentoValor) || 0;
        const valorIvaNum = Number(it.valorIva) || 0;
        
        // Validar que sean números finitos y limitar a rango válido para DECIMAL(18,2)
        // DECIMAL(18,2) puede almacenar valores hasta 9999999999999999.99
        const maxDecimal = 9999999999999999.99;
        const cantidad = isFinite(cantidadNum) ? Math.max(0, Math.min(cantidadNum, maxDecimal)) : 0;
        const valins = isFinite(precioUnitarioNum) ? Math.max(0, Math.min(precioUnitarioNum, maxDecimal)) : 0;
        const dctped = isFinite(descuentoValorNum) ? Math.max(0, Math.min(descuentoValorNum, maxDecimal)) : 0;
        const ivaped = isFinite(valorIvaNum) ? Math.max(0, Math.min(valorIvaNum, maxDecimal)) : 0;
        
        // Redondear a 2 decimales y limitar al máximo permitido, asegurando exactamente 2 decimales
        const maxDecimal18_2 = 9999999999999999.99;
        const cantidadFinal = parseFloat(Math.min(Math.max(0, cantidad), maxDecimal18_2).toFixed(2));
        const valinsFinal = parseFloat(Math.min(Math.max(0, valins), maxDecimal18_2).toFixed(2));
        const dctpedFinal = parseFloat(Math.min(Math.max(0, dctped), maxDecimal18_2).toFixed(2));
        const ivapedFinal = parseFloat(Math.min(Math.max(0, ivaped), maxDecimal18_2).toFixed(2));
        
        // Validar que sean números finitos
        const cantidadFinalValid = isFinite(cantidadFinal) ? cantidadFinal : 0;
        const valinsFinalValid = isFinite(valinsFinal) ? valinsFinal : 0;
        const dctpedFinalValid = isFinite(dctpedFinal) ? dctpedFinal : 0;
        const ivapedFinalValid = isFinite(ivapedFinal) ? ivapedFinal : 0;
        
        // Log de depuración para items
        console.log(`📦 Item ${idx + 1} valores validados:`, {
          cantidad: cantidadFinalValid,
          valins: valinsFinalValid,
          dctped: dctpedFinalValid,
          ivaped: ivapedFinalValid
        });
        
        // Formatear codalm correctamente (CHAR(3))
        const codalmFormatted = (empresaId || '001').toString().substring(0, 3).padStart(3, '0');
        
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
    console.error('❌ Error creando pedido:', error);
    console.error('Stack trace:', error.stack);
    console.error('Error completo:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    const errorMessage = error.message || 'Error desconocido al crear pedido';
    const errorDetails = error.originalError?.info || error.originalError?.message || null;
    
    res.status(500).json({ 
      success: false, 
      message: 'Error creando pedido', 
      error: errorMessage,
      details: errorDetails,
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
      
      if (body.subtotal !== undefined) {
        updates.push('subtotal = @subtotal');
        reqUpdate.input('subtotal', sql.Decimal(18, 2), body.subtotal);
      }
      
      if (body.descuentoValor !== undefined) {
        updates.push('descuento_valor = @descuento_valor');
        reqUpdate.input('descuento_valor', sql.Decimal(18, 2), body.descuentoValor);
      }
      
      if (body.ivaValor !== undefined) {
        updates.push('iva_valor = @iva_valor');
        reqUpdate.input('iva_valor', sql.Decimal(18, 2), body.ivaValor);
      }
      
      if (body.total !== undefined) {
        updates.push('total = @total');
        reqUpdate.input('total', sql.Decimal(18, 2), body.total);
      }
      
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
        const checkResult = await reqCheck.query('SELECT id, numero_pedido, estado FROM ven_pedidos WHERE id = @pedidoId');
        
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
      empresaId, items = []
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
            FROM ven_recibos 
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
          FROM ven_recibos 
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
      const estadoMapeado = mapEstadoToDb(estado);
      
      req1.input('numero_remision', numeroRemisionFinal);
      req1.input('fecha_remision', fechaRemisionFinal);
      req1.input('fecha_despacho', fechaDespacho || null);
      req1.input('pedido_id', pedidoIdFinal);
      req1.input('factura_id', facturaIdFinal);
      req1.input('cliente_id', sql.VarChar(20), clienteIdStr);
      if (vendedorIdFinal) {
        req1.input('vendedor_id', sql.VarChar(20), vendedorIdFinal);
      } else {
        req1.input('vendedor_id', sql.VarChar(20), null);
      }
      req1.input('empresa_id', empresaId || 1);
      req1.input('subtotal', subtotal);
      req1.input('descuento_valor', descuentoValor);
      req1.input('iva_valor', ivaValor);
      req1.input('total', total);
      req1.input('observaciones', observaciones);
      req1.input('estado', estadoMapeado);
      req1.input('estado_envio', estadoEnvio);
      req1.input('metodo_envio', metodoEnvio || null);
      req1.input('transportadora_id', transportadoraIdFinal);
      req1.input('transportadora', transportadora || null);
      req1.input('numero_guia', numeroGuia || null);

      const insertHeader = await req1.query(`
        INSERT INTO ven_recibos (
          numero_remision, fecha_remision, fecha_despacho,
          pedido_id, factura_id, cliente_id, vendedor_id, empresa_id,
          subtotal, descuento_valor, iva_valor, total,
          observaciones, estado, estado_envio, metodo_envio,
          transportadora_id, transportadora, numero_guia
        ) VALUES (
          @numero_remision, @fecha_remision, @fecha_despacho,
          @pedido_id, @factura_id, @cliente_id, @vendedor_id, @empresa_id,
          @subtotal, @descuento_valor, @iva_valor, @total,
          @observaciones, @estado, @estado_envio, @metodo_envio,
          @transportadora_id, @transportadora, @numero_guia
        );
        SELECT SCOPE_IDENTITY() AS id;`);
      const newId = insertHeader.recordset[0].id;

      console.log(`📦 Guardando ${items.length} items de remisión...`);
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
        
        reqDet.input('remision_id', newId);
        reqDet.input('producto_id', sql.Int, productoIdNum);
        reqDet.input('cantidad', sql.Decimal(18, 2), it.cantidad);
        reqDet.input('precio_unitario', sql.Decimal(18, 2), it.precioUnitario);
        reqDet.input('descuento_porcentaje', sql.Decimal(5, 2), it.descuentoPorcentaje || 0);
        reqDet.input('iva_porcentaje', sql.Decimal(5, 2), it.ivaPorcentaje || 0);
        reqDet.input('descripcion', sql.VarChar(500), it.descripcion || '');
        reqDet.input('subtotal', sql.Decimal(18, 2), it.subtotal || 0);
        reqDet.input('valor_iva', sql.Decimal(18, 2), it.valorIva || 0);
        reqDet.input('total', sql.Decimal(18, 2), it.total);
        
        await reqDet.query(`
          INSERT INTO ven_detarecibo (
            remision_id, producto_id, cantidad, precio_unitario,
            descuento_porcentaje, iva_porcentaje, descripcion,
            subtotal, valor_iva, total
          ) VALUES (
            @remision_id, @producto_id, @cantidad, @precio_unitario,
            @descuento_porcentaje, @iva_porcentaje, @descripcion,
            @subtotal, @valor_iva, @total
          );`);
        console.log(`✅ Item ${idx + 1} guardado correctamente`);
      }
      console.log(`✅ Todos los ${items.length} items de remisión guardados`);

      // Actualizar estado del pedido si se proporcionó pedidoId
      if (pedidoIdFinal) {
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
            FROM ven_recibos
            WHERE pedido_id = @pedidoId
          `);
          
          // Obtener total de items remitidos (incluyendo esta nueva remisión)
          const reqItemsRemitidos = new sql.Request(tx);
          reqItemsRemitidos.input('pedidoId', sql.Int, pedidoIdFinal);
          const itemsRemitidosResult = await reqItemsRemitidos.query(`
            SELECT 
              dr.producto_id,
              SUM(dr.cantidad) as cantidad_remitida
            FROM ven_detarecibo dr
            INNER JOIN ven_recibos r ON dr.remision_id = r.id
            WHERE r.pedido_id = @pedidoId
            GROUP BY dr.producto_id
          `);
          
          // Obtener total de items del pedido
          const reqItemsPedido = new sql.Request(tx);
          reqItemsPedido.input('pedidoId', sql.Int, pedidoIdFinal);
          const itemsPedidoResult = await reqItemsPedido.query(`
            SELECT 
              producto_id,
              cantidad
            FROM ven_detapedidos
            WHERE pedido_id = @pedidoId
          `);
          
          // Verificar si todos los items están completamente remitidos
          let todosRemitidos = true;
          let algunoRemitido = false;
          
          for (const itemPedido of itemsPedidoResult.recordset) {
            const itemRemitido = itemsRemitidosResult.recordset.find(
              ir => ir.producto_id === itemPedido.producto_id
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
      }

      await tx.commit();
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
    console.error('❌ Error creando remisión:', error);
    console.error('Stack trace:', error.stack);
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
        const estadoMapeado = mapEstadoToDb(body.estado);
        updates.push('estado = @estado');
        reqUpdate.input('estado', sql.VarChar(20), estadoMapeado);
        console.log(`🔄 Actualizando estado: ${body.estado} -> ${estadoMapeado}`);
      }
      
      if (body.fechaDespacho !== undefined) {
        updates.push('fecha_despacho = @fecha_despacho');
        reqUpdate.input('fecha_despacho', sql.Date, body.fechaDespacho || null);
      }
      
      if (body.numeroGuia !== undefined) {
        updates.push('numero_guia = @numero_guia');
        reqUpdate.input('numero_guia', sql.VarChar(50), body.numeroGuia || null);
      }
      
      if (body.observaciones !== undefined) {
        updates.push('observaciones = @observaciones');
        reqUpdate.input('observaciones', sql.VarChar(500), body.observaciones || '');
      }
      
      if (updates.length === 0) {
        await tx.rollback();
        return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
      }
      
      reqUpdate.input('remisionId', sql.Int, idNum);
      
      const updateQuery = `
        UPDATE ven_recibos 
        SET ${updates.join(', ')}
        WHERE id = @remisionId;
        SELECT * FROM ven_recibos WHERE id = @remisionId;
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
        const checkResult = await reqCheck.query('SELECT id, numero_remision, estado FROM ven_recibos WHERE id = @remisionId');
        
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
      console.log('✅ Remisión actualizada exitosamente:', {
        id: updatedRemision.id,
        numeroRemision: updatedRemision.numero_remision,
        estado: mapEstadoFromDb(updatedRemision.estado)
      });
      
      res.json({ 
        success: true, 
        data: {
          id: updatedRemision.id,
          numeroRemision: updatedRemision.numero_remision,
          estado: mapEstadoFromDb(updatedRemision.estado),
          fechaDespacho: updatedRemision.fecha_despacho,
          numeroGuia: updatedRemision.numero_guia,
          observaciones: updatedRemision.observaciones
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
            FROM ven_recibos 
            WHERE id = @remisionId
          `);
        } else {
          // Es un string, buscar por numero_remision
          reqRemision.input('numeroRemision', sql.VarChar(50), remisionIdStr);
          remisionResult = await reqRemision.query(`
            SELECT id, numero_remision, estado 
            FROM ven_recibos 
            WHERE numero_remision = @numeroRemision
          `);
        }
        
        if (remisionResult.recordset.length === 0) {
          await tx.rollback();
          
          // Obtener ejemplos de remisiones existentes
          const reqEjemplos = new sql.Request(tx);
          const ejemplosResult = await reqEjemplos.query(`
            SELECT TOP 5 id, numero_remision, estado 
            FROM ven_recibos 
            ORDER BY id DESC
          `);
          
          return res.status(400).json({ 
            success: false, 
            message: 'REMISION_NOT_FOUND',
            error: `Remisión con ID/código "${remisionIdStr}" no encontrada en ven_recibos`,
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
        // Generar número automático
        const reqMax = new sql.Request(tx);
        const maxResult = await reqMax.query(`
          SELECT MAX(CAST(SUBSTRING(numero_factura, 4, LEN(numero_factura)) AS INT)) as maxNum
          FROM ven_facturas
          WHERE numero_factura LIKE 'FC-%' 
            AND ISNUMERIC(SUBSTRING(numero_factura, 4, LEN(numero_factura))) = 1
        `);
        
        const maxNum = maxResult.recordset[0]?.maxNum || 0;
        const nextNum = maxNum + 1;
        numeroFacturaFinal = `FC-${String(nextNum).padStart(4, '0')}`;
        console.log(`📝 Número de factura generado automáticamente: "${numeroFacturaFinal}"`);
      } else {
        // Validar que no exista
        const reqExistente = new sql.Request(tx);
        reqExistente.input('numeroFactura', sql.VarChar(50), numeroFacturaFinal);
        const existenteResult = await reqExistente.query(`
          SELECT id, numero_factura, estado 
          FROM ven_facturas 
          WHERE numero_factura = @numeroFactura
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
                id: existenteResult.recordset[0].id,
                numero_factura: existenteResult.recordset[0].numero_factura,
                estado: existenteResult.recordset[0].estado
              },
              sugerencia: 'Use un número de factura diferente o "AUTO" para generar automáticamente'
            }
          });
        }
        
        console.log(`📝 Número de factura proporcionado y válido: "${numeroFacturaFinal}"`);
      }
      
      // ========== INSERTAR FACTURA ==========
      const req1 = new sql.Request(tx);
      const estadoMapeado = mapEstadoToDb(estado);
      
      req1.input('numero_factura', numeroFacturaFinal);
      req1.input('fecha_factura', fechaFactura);
      req1.input('fecha_vencimiento', fechaVencimiento || null);
      req1.input('cliente_id', sql.VarChar(20), clienteIdStr);
      req1.input('vendedor_id', sql.VarChar(20), vendedorIdFinal);
      req1.input('remision_id', remisionIdFinal);
      req1.input('pedido_id', pedidoIdFinal);
      req1.input('empresa_id', empresaId || 1);
      req1.input('subtotal', subtotal);
      req1.input('descuento_valor', descuentoValor);
      req1.input('iva_valor', ivaValor);
      req1.input('total', total);
      req1.input('observaciones', observaciones);
      req1.input('estado', estadoMapeado);

      const insertHeader = await req1.query(`
        INSERT INTO ven_facturas (
          numero_factura, fecha_factura, fecha_vencimiento,
          cliente_id, vendedor_id, remision_id, pedido_id, empresa_id,
          subtotal, descuento_valor, iva_valor, total,
          observaciones, estado
        ) VALUES (
          @numero_factura, @fecha_factura, @fecha_vencimiento,
          @cliente_id, @vendedor_id, @remision_id, @pedido_id, @empresa_id,
          @subtotal, @descuento_valor, @iva_valor, @total,
          @observaciones, @estado
        );
        SELECT SCOPE_IDENTITY() AS id;`);
      const newId = insertHeader.recordset[0].id;

      console.log(`📦 Guardando ${items.length} items de factura...`);
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
        
        reqDet.input('factura_id', newId);
        reqDet.input('producto_id', sql.Int, productoIdNum);
        reqDet.input('cantidad', sql.Decimal(18, 2), it.cantidad);
        reqDet.input('precio_unitario', sql.Decimal(18, 2), it.precioUnitario);
        reqDet.input('descuento_porcentaje', sql.Decimal(5, 2), it.descuentoPorcentaje || 0);
        reqDet.input('iva_porcentaje', sql.Decimal(5, 2), it.ivaPorcentaje || 0);
        reqDet.input('descripcion', sql.VarChar(500), it.descripcion || '');
        reqDet.input('subtotal', sql.Decimal(18, 2), it.subtotal || 0);
        reqDet.input('valor_iva', sql.Decimal(18, 2), it.valorIva || 0);
        reqDet.input('total', sql.Decimal(18, 2), it.total);
        
        await reqDet.query(`
          INSERT INTO ven_detafact (
            factura_id, producto_id, cantidad, precio_unitario,
            descuento_porcentaje, iva_porcentaje, descripcion,
            subtotal, valor_iva, total
          ) VALUES (
            @factura_id, @producto_id, @cantidad, @precio_unitario,
            @descuento_porcentaje, @iva_porcentaje, @descripcion,
            @subtotal, @valor_iva, @total
          );`);
        console.log(`✅ Item ${idx + 1} guardado correctamente`);
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
      
      // Actualizar todas las remisiones relacionadas
      if (remisionesParaActualizar.length > 0) {
        for (const remisionIdStr of remisionesParaActualizar) {
          const remisionIdNum = typeof remisionIdStr === 'number' ? remisionIdStr : parseInt(String(remisionIdStr), 10);
          if (!isNaN(remisionIdNum)) {
            const reqUpdateRemision = new sql.Request(tx);
            reqUpdateRemision.input('factura_id', newId);
            reqUpdateRemision.input('remision_id', remisionIdNum);
            await reqUpdateRemision.query(`
              UPDATE ven_recibos 
              SET factura_id = @factura_id 
              WHERE id = @remision_id
            `);
            console.log(`✅ Remisión ${remisionIdNum} actualizada con factura_id ${newId}`);
          }
        }
      }
      
      // También actualizar todas las remisiones del mismo cliente que estén en estado ENTREGADO y sin factura
      // Esto asegura que si hay múltiples remisiones relacionadas, todas se vinculen
      const reqUpdateRemisionesCliente = new sql.Request(tx);
      reqUpdateRemisionesCliente.input('factura_id', newId);
      reqUpdateRemisionesCliente.input('cliente_id', sql.VarChar(20), clienteIdStr);
      const updateResult = await reqUpdateRemisionesCliente.query(`
        UPDATE ven_recibos 
        SET factura_id = @factura_id 
        WHERE cliente_id = @cliente_id 
          AND estado = 'D' 
          AND factura_id IS NULL
      `);
      console.log(`✅ ${updateResult.rowsAffected[0]} remisión(es) del cliente ${clienteIdStr} actualizada(s) con factura_id ${newId}`);

      await tx.commit();
      res.json({ success: true, data: { id: newId } });
    } catch (inner) {
      await tx.rollback();
      throw inner;
    }
  } catch (error) {
    console.error('❌ Error creando factura:', error);
    res.status(500).json({ success: false, message: 'Error creando factura', error: error.message });
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
        SELECT id, numero_factura, estado 
        FROM ven_facturas 
        WHERE id = @id
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
      console.log(`✅ Factura encontrada: ${facturaExistente.numero_factura} (estado: ${facturaExistente.estado})`);
      
      // Mapear estado del frontend al backend si es necesario
      const estadoDb = body.estado ? mapEstadoToDb(body.estado) : facturaExistente.estado;
      
      // Construir la consulta de actualización dinámicamente
      const updates = [];
      const reqUpdate = new sql.Request(tx);
      reqUpdate.input('id', sql.Int, idNum);
      
      // Si se está timbrando (cambiando estado a ENVIADA), simular el proceso de timbrado
      let cufeGenerado = null;
      let fechaTimbradoGenerada = null;
      let estadoFinal = estadoDb;
      
      if (body.estado === 'ENVIADA' && facturaExistente.estado !== 'E') {
        // Simular proceso de timbrado
        console.log(`🔄 Simulando proceso de timbrado para factura ${facturaExistente.numero_factura}...`);
        
        // Simular aceptación o rechazo (80% probabilidad de aceptación)
        const probabilidadAceptacion = Math.random();
        const aceptada = probabilidadAceptacion < 0.8;
        
        if (aceptada) {
          // Factura aceptada - generar CUFE simulado
          // Formato CUFE simulado: prefijo + timestamp + número de factura + hash simulado
          const timestamp = Date.now();
          const numeroFacturaLimpio = facturaExistente.numero_factura.replace(/[^0-9]/g, '');
          const hashSimulado = Math.random().toString(36).substring(2, 15).toUpperCase();
          cufeGenerado = `CUFE-${timestamp}-${numeroFacturaLimpio}-${hashSimulado}`;
          fechaTimbradoGenerada = new Date();
          estadoFinal = 'E'; // ENVIADA
          
          console.log(`✅ Factura aceptada y timbrada. CUFE generado: ${cufeGenerado}`);
        } else {
          // Factura rechazada
          estadoFinal = 'R'; // RECHAZADA
          console.log(`❌ Factura rechazada en el proceso de timbrado`);
        }
      }
      
      if (body.estado !== undefined) {
        reqUpdate.input('estado', sql.VarChar(20), estadoFinal);
        updates.push('estado = @estado');
      }
      
      if (body.observaciones !== undefined) {
        reqUpdate.input('observaciones', sql.VarChar(500), body.observaciones);
        updates.push('observaciones = @observaciones');
      }
      
      // Si se generó un CUFE en la simulación, usarlo
      if (cufeGenerado) {
        reqUpdate.input('cufe', sql.VarChar(100), cufeGenerado);
        updates.push('cufe = @cufe');
      } else if (body.cufe !== undefined) {
        reqUpdate.input('cufe', sql.VarChar(100), body.cufe);
        updates.push('cufe = @cufe');
      }
      
      // Si se generó una fecha de timbrado en la simulación, usarla
      if (fechaTimbradoGenerada) {
        reqUpdate.input('fecha_timbrado', sql.DateTime, fechaTimbradoGenerada);
        updates.push('fecha_timbrado = @fecha_timbrado');
      } else if (body.fechaTimbrado !== undefined) {
        reqUpdate.input('fecha_timbrado', sql.DateTime, body.fechaTimbrado);
        updates.push('fecha_timbrado = @fecha_timbrado');
      }
      
      if (updates.length === 0) {
        await tx.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'No se proporcionaron campos para actualizar',
          error: 'NO_UPDATES'
        });
      }
      
      // Agregar fecha de actualización
      reqUpdate.input('updated_at', sql.DateTime, new Date());
      updates.push('updated_at = @updated_at');
      
      const updateQuery = `
        UPDATE ven_facturas 
        SET ${updates.join(', ')}
        WHERE id = @id;
        
        SELECT 
          f.id,
          f.numero_factura as numeroFactura,
          f.fecha_factura as fechaFactura,
          f.fecha_vencimiento as fechaVencimiento,
          f.cliente_id as clienteId,
          f.vendedor_id as vendedorId,
          f.remision_id as remisionId,
          f.pedido_id as pedidoId,
          f.empresa_id as empresaId,
          f.subtotal,
          f.descuento_valor as descuentoValor,
          f.iva_valor as ivaValor,
          f.total,
          f.observaciones,
          f.estado,
          f.cufe,
          f.fecha_timbrado as fechaTimbrado,
          -- Obtener todas las remisiones relacionadas con esta factura
          STUFF((
            SELECT ',' + CAST(r.id AS VARCHAR)
            FROM ven_recibos r
            WHERE r.factura_id = f.id
            FOR XML PATH('')
          ), 1, 1, '') as remisionesIds
        FROM ven_facturas f
        WHERE f.id = @id;
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
