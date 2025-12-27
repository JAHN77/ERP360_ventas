const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const os = require('os');
// Compresión de respuestas HTTP (opcional - instalar con: npm install compression)
let compression = null;
try {
  compression = require('compression');
} catch (error) {
  console.warn('⚠️  Módulo compression no instalado. Para habilitar compresión de respuestas, ejecuta: npm install compression');
}

const { executeQuery, executeQueryWithParams, testConnection } = require('./services/sqlServerClient.cjs');
const { QUERIES, TABLE_NAMES } = require('./services/dbConfig.cjs');
const { getConnection } = require('./services/sqlServerClient.cjs');
const sql = require('mssql');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const DIANService = require('./services/dian-service.cjs');


// Cargar variables de entorno
dotenv.config();

const {
  mapEstadoToDb,
  mapEstadoFromDb
} = require('./utils/helpers');

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

// Middleware de compresión de respuestas (optimización: reduce el tamaño de las respuestas HTTP)
if (compression) {
  app.use(compression({
    filter: (req, res) => {
      // Comprimir todas las respuestas excepto imágenes y PDFs (ya están comprimidos)
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6, // Nivel de compresión (1-9, 6 es un buen equilibrio)
    threshold: 1024 // Solo comprimir respuestas mayores a 1KB
  }));
  console.log('✅ Compresión de respuestas HTTP habilitada');
}

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// Middleware de logging mejorado - CAPTURAR TODAS LAS PETICIONES
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  // FORZAR LOGS - Incluso si hay problemas con el body parser
  const logMessage = `\n📥 [${timestamp}] ${req.method} ${req.path}`;
  console.log(logMessage);
  console.error(logMessage); // También a stderr para asegurar visibilidad

  if (req.method === 'PUT' && req.path.includes('/facturas/')) {
    console.log(`   🔍 [MIDDLEWARE] PUT /facturas/ detectada`);
    console.error(`   🔍 [MIDDLEWARE] PUT /facturas/ detectada`); // También a stderr
    console.log(`   🔍 Body recibido:`, JSON.stringify(req.body, null, 2));
    console.error(`   🔍 Body recibido:`, JSON.stringify(req.body, null, 2)); // También a stderr
    console.log(`   🔍 Params:`, req.params);
    console.error(`   🔍 Params:`, req.params); // También a stderr
  }
  next();
});

// Importar servicios refactorizados
// Importar servicios refactorizados

const productRoutes = require('./routes/productRoutes');
const productController = require('./controllers/productController');
const clientRoutes = require('./routes/clientRoutes');
const clientController = require('./controllers/clientController');
const quoteRoutes = require('./routes/quoteRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const creditNoteRoutes = require('./routes/creditNoteRoutes');
const remissionRoutes = require('./routes/remissionRoutes');
const orderRoutes = require('./routes/orderRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const commonRoutes = require('./routes/commonRoutes');
const inventoryConceptsController = require('./controllers/inventoryConceptsController');

// --- Inventory Concepts Routes ---
console.log('Registering Inventory Concepts Routes...');
app.get('/api/conceptos-inventario', inventoryConceptsController.getAllConcepts);
app.get('/api/conceptos-inventario/:codcon', inventoryConceptsController.getConceptByCode);
app.post('/api/conceptos-inventario', inventoryConceptsController.createConcept);
app.put('/api/conceptos-inventario/:codcon', inventoryConceptsController.updateConcept);
app.delete('/api/conceptos-inventario/:codcon', inventoryConceptsController.deleteConcept);


// --- Purchase Order Routes ---
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
app.use('/api', purchaseOrderRoutes);


// --- Inventario Físico Routes ---
console.log('🔧 Cargando rutas de inventario físico...');
const inventarioFisicoRoutes = require('./routes/inventarioFisicoRoutes');
console.log('🔧 inventarioFisicoRoutes cargado:', typeof inventarioFisicoRoutes);
console.log('🔧 Registrando rutas en /api/inventario-fisico');
app.use('/api/inventario-fisico', inventarioFisicoRoutes);
console.log('✅ Rutas de inventario físico registradas');





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

// --- BUSQUEDAS (server-side) ---
app.get('/api/buscar/clientes', clientController.searchClients);
// Ruta alternativa para compatibilidad
app.get('/api/clientes/search', clientController.searchClients);

// BUSQUEDA PRODUCTOS
app.get('/api/buscar/productos', productController.searchProducts);


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

// Product Routes
app.use('/api/productos', productRoutes);

// Client Routes
app.use('/api/clientes', clientRoutes);
app.use('/api', quoteRoutes); // Mounting at /api to support /api/cotizaciones and /api/cotizaciones-detalle
app.use('/api', orderRoutes); // Mounting at /api to support /api/pedidos and /api/pedidos-detalle
app.use('/api', invoiceRoutes);
app.use('/api', creditNoteRoutes);
app.use('/api', remissionRoutes); 
app.use('/api/inventario', inventoryRoutes);
app.use('/api/categorias', require('./routes/categoryRoutes')); // Registration of category routes
app.use('/api/medidas', require('./routes/measureRoutes')); // Registration of measure routes
app.use('/api', require('./routes/commonRoutes')); // Phase 6

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

// Variable global para almacenar la referencia del servidor
let httpServer = null;

// Función para cerrar el servidor de forma graceful
const gracefulShutdown = async (signal) => {
  console.log(`\n📡 Señal ${signal} recibida, cerrando servidor gracefully...`);

  // Timeout para forzar el cierre si tarda demasiado (5 segundos)
  const forceExitTimeout = setTimeout(() => {
    console.error('⚠️ Timeout alcanzado, forzando cierre...');
    process.exit(1);
  }, 5000);

  try {
    // 1. Cerrar el servidor HTTP (no aceptar nuevas conexiones)
    if (httpServer) {
      console.log('🔄 Cerrando servidor HTTP...');
      await new Promise((resolve, reject) => {
        httpServer.close((err) => {
          if (err) {
            console.error('❌ Error cerrando servidor HTTP:', err);
            reject(err);
          } else {
            console.log('✅ Servidor HTTP cerrado');
            resolve();
          }
        });
      });
    }

    // 2. Esperar un poco para que las conexiones actuales terminen (2 segundos)
    console.log('⏳ Esperando que las conexiones actuales terminen...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Cerrar conexión a la base de datos
    const { closeConnection } = require('./services/sqlServerClient.cjs');
    await closeConnection();

    // Limpiar timeout
    clearTimeout(forceExitTimeout);

    console.log('✅ Cierre graceful completado');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante el cierre graceful:', error);
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
};

// Manejo de señales de terminación
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Iniciar servidor solo si no estamos en Vercel (serverless)
// En Vercel, el servidor se ejecuta como función serverless
if (!process.env.VERCEL) {
  const HOST = '0.0.0.0'; // Escuchar en todas las interfaces de red
  const localIP = getLocalIP();

  // Intentar iniciar el servidor con manejo de errores
  try {
    httpServer = app.listen(PORT, HOST, () => {
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
    httpServer.on('error', (error) => {
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
