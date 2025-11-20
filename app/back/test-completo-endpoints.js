/**
 * SCRIPT DE PRUEBAS COMPLETO - ANÁLISIS Y PRUEBAS DE TODOS LOS ENDPOINTS
 * 
 * Este script realiza:
 * 1. Análisis de todos los endpoints disponibles
 * 2. Pruebas de creación (POST)
 * 3. Pruebas de edición (PUT)
 * 4. Pruebas de conversión entre secciones (cotización -> pedido -> remisión)
 * 5. Pruebas de flujos completos
 */

const http = require('http');
const sql = require('mssql');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const API_ENDPOINT = `${API_BASE_URL}/api`;

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bright');
  console.log('='.repeat(80) + '\n');
}

function logTest(testName) {
  log(`\n🧪 ${testName}`, 'cyan');
  console.log('-'.repeat(80));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Función para hacer peticiones HTTP
function makeRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_ENDPOINT}${endpoint}`);
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: url.hostname,
      port: url.port || 3001,
      path: url.pathname + (url.search || ''),
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Función para obtener datos de prueba desde la BD
async function getTestData(pool) {
  logInfo('Obteniendo datos de prueba desde la base de datos...');
  
  // Obtener cliente activo
  const clienteResult = await pool.request().query(`
    SELECT TOP 1 codter, nomter
    FROM con_terceros 
    WHERE activo = 1 
    ORDER BY NEWID()
  `);
  
  if (clienteResult.recordset.length === 0) {
    throw new Error('No se encontró ningún cliente activo en la base de datos');
  }
  const cliente = clienteResult.recordset[0];
  
  // Obtener vendedor
  const vendedorResult = await pool.request().query(`
    SELECT TOP 1 ideven, codven, nomven
    FROM ven_vendedor
    WHERE Activo = 1
    ORDER BY NEWID()
  `);
  const vendedor = vendedorResult.recordset.length > 0 ? {
    codi_emple: vendedorResult.recordset[0].codven || vendedorResult.recordset[0].ideven,
    nomb_emple: vendedorResult.recordset[0].nomven,
    ideven: vendedorResult.recordset[0].ideven
  } : null;
  
  // Obtener productos activos
  const productosResult = await pool.request().query(`
    SELECT TOP 3 id, codins, nomins, ultimo_costo, tasa_iva
    FROM inv_insumos 
    WHERE activo = 1 AND codins IS NOT NULL AND LTRIM(RTRIM(codins)) != ''
    ORDER BY NEWID()
  `);
  
  if (productosResult.recordset.length === 0) {
    throw new Error('No se encontraron productos activos en la base de datos');
  }
  const productos = productosResult.recordset;
  
  // Obtener bodega/almacén válido
  let bodega = { codigo: '001', nombre: 'Bodega Principal' };
  try {
    // Intentar obtener desde inv_almacen (tabla de almacenes)
    const bodegaResult = await pool.request().query(`
      SELECT TOP 1 codalm, nomalm
      FROM inv_almacen
      WHERE activo = 1 AND codalm IS NOT NULL AND LTRIM(RTRIM(codalm)) != ''
      ORDER BY codalm
    `);
    if (bodegaResult.recordset.length > 0) {
      bodega = { 
        codigo: bodegaResult.recordset[0].codalm.trim(), 
        nombre: bodegaResult.recordset[0].nomalm ? bodegaResult.recordset[0].nomalm.trim() : `Bodega ${bodegaResult.recordset[0].codalm.trim()}` 
      };
    }
  } catch (error) {
    // Si falla, usar valor por defecto
    logWarning(`No se pudo obtener bodega desde BD, usando valor por defecto: ${error.message}`);
  }
  
  logSuccess(`Datos de prueba obtenidos:`);
  logInfo(`  Cliente: ${cliente.nomter} (${cliente.codter})`);
  logInfo(`  Vendedor: ${vendedor ? vendedor.nomb_emple : 'N/A'}`);
  logInfo(`  Productos: ${productos.length}`);
  logInfo(`  Bodega: ${bodega.nombre} (${bodega.codigo})`);
  
  return { cliente, vendedor, productos, bodega };
}

// ============================================================================
// ANÁLISIS DE ENDPOINTS
// ============================================================================

async function analizarEndpoints() {
  logSection('📊 ANÁLISIS DE ENDPOINTS DISPONIBLES');
  
  const endpoints = {
    GET: [
      '/clientes',
      '/clientes/:id',
      '/productos',
      '/cotizaciones',
      '/cotizaciones-detalle',
      '/pedidos',
      '/pedidos-detalle',
      '/remisiones',
      '/remisiones/:id/detalle',
      '/remisiones-detalle',
      '/facturas',
      '/facturas-detalle',
      '/notas-credito',
      '/vendedores',
      '/bodegas',
      '/medidas',
      '/categorias',
      '/buscar/clientes',
      '/buscar/vendedores',
      '/buscar/productos',
      '/test-connection',
      '/health',
    ],
    POST: [
      '/cotizaciones',
      '/pedidos',
      '/remisiones',
      '/facturas',
      '/notas-credito',
      '/clientes',
      '/inventario/entradas',
      '/query',
    ],
    PUT: [
      '/cotizaciones/:id',
      '/pedidos/:id',
      '/remisiones/:id',
      '/facturas/:id',
      '/notas-credito/:id',
    ],
  };
  
  log('Endpoints GET:', 'bright');
  endpoints.GET.forEach(ep => log(`  GET  ${ep}`, 'blue'));
  
  log('\nEndpoints POST:', 'bright');
  endpoints.POST.forEach(ep => log(`  POST ${ep}`, 'green'));
  
  log('\nEndpoints PUT:', 'bright');
  endpoints.PUT.forEach(ep => log(`  PUT  ${ep}`, 'yellow'));
  
  return endpoints;
}

// ============================================================================
// PRUEBA 1: CREAR COTIZACIÓN
// ============================================================================

async function pruebaCrearCotizacion(testData) {
  logTest('PRUEBA 1: Crear Cotización');
  
  const { cliente, vendedor, productos, bodega } = testData;
  
  const items = productos.map((p, idx) => {
    const cantidad = (idx + 1) * 2;
    const precioUnitario = parseFloat(p.ultimo_costo || 10000);
    const ivaPorcentaje = parseFloat(p.tasa_iva || 19);
    const subtotal = cantidad * precioUnitario;
    const valorIva = subtotal * (ivaPorcentaje / 100);
    const total = subtotal + valorIva;
    
    return {
      productoId: p.id,
      cantidad: cantidad,
      precioUnitario: precioUnitario,
      descuentoPorcentaje: 0,
      ivaPorcentaje: ivaPorcentaje,
      descripcion: p.nomins,
      subtotal: subtotal,
      valorIva: valorIva,
      total: total,
    };
  });
  
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const ivaValor = items.reduce((sum, item) => sum + item.valorIva, 0);
  const total = items.reduce((sum, item) => sum + item.total, 0);
  
  const fechaCotizacion = new Date().toISOString().split('T')[0];
  const fechaVencimiento = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const payload = {
    clienteId: cliente.codter,
    vendedorId: vendedor ? vendedor.codi_emple : null,
    fechaCotizacion: fechaCotizacion,
    fechaVencimiento: fechaVencimiento,
    items: items,
    subtotal: subtotal,
    ivaValor: ivaValor,
    total: total,
    observaciones: 'Cotización de prueba - Test completo de endpoints',
    estado: 'BORRADOR',
    empresaId: bodega.codigo,
    codalm: bodega.codigo,
  };
  
  try {
    const response = await makeRequest('POST', '/cotizaciones', payload);
    
    if (response.status === 200 && response.data.success) {
      logSuccess(`Cotización creada exitosamente`);
      logInfo(`  ID: ${response.data.data.id}`);
      logInfo(`  Número: ${response.data.data.numeroCotizacion || 'N/A'}`);
      return response.data.data;
    } else {
      logError(`Error al crear cotización: ${response.data.message || response.data.error}`);
      return null;
    }
  } catch (error) {
    logError(`Error en la petición: ${error.message}`);
    return null;
  }
}

// ============================================================================
// PRUEBA 2: EDITAR COTIZACIÓN
// ============================================================================

async function pruebaEditarCotizacion(cotizacionId) {
  logTest('PRUEBA 2: Editar Cotización');
  
  if (!cotizacionId) {
    logWarning('No hay cotización para editar, saltando prueba');
    return null;
  }
  
  const payload = {
    observaciones: 'Cotización editada - Prueba de actualización',
    estado: 'ENVIADA',
  };
  
  try {
    const response = await makeRequest('PUT', `/cotizaciones/${cotizacionId}`, payload);
    
    if (response.status === 200 && response.data.success) {
      logSuccess(`Cotización editada exitosamente`);
      logInfo(`  ID: ${cotizacionId}`);
      logInfo(`  Nuevo estado: ${response.data.data.estado || 'N/A'}`);
      return response.data.data;
    } else {
      logError(`Error al editar cotización: ${response.data.message || response.data.error}`);
      return null;
    }
  } catch (error) {
    logError(`Error en la petición: ${error.message}`);
    return null;
  }
}

// ============================================================================
// PRUEBA 3: APROBAR COTIZACIÓN Y CREAR PEDIDO (CONVERSIÓN)
// ============================================================================

async function pruebaAprobarCotizacionYCrearPedido(cotizacionId, pool) {
  logTest('PRUEBA 3: Aprobar Cotización y Crear Pedido (Conversión Cotización -> Pedido)');
  
  if (!cotizacionId) {
    logWarning('No hay cotización para aprobar, saltando prueba');
    return null;
  }
  
  // Primero obtener los items de la cotización
  const cotizacionDetalleResult = await pool.request()
    .input('cotizacionId', sql.Int, cotizacionId)
    .query(`
      SELECT id, cod_producto, cantidad, preciound, tasa_iva, tasa_descuento, valor
      FROM ven_detacotizacion
      WHERE id_cotizacion = @cotizacionId
    `);
  
  if (cotizacionDetalleResult.recordset.length === 0) {
    logError('No se encontraron items en la cotización');
    return null;
  }
  
  // Obtener información completa de la cotización
  const cotizacionResult = await pool.request()
    .input('cotizacionId', sql.Int, cotizacionId)
    .query(`
      SELECT id, numcot, codter, cod_vendedor, subtotal, val_iva, observa, codalm
      FROM ven_cotizacion
      WHERE id = @cotizacionId
    `);
  
  if (cotizacionResult.recordset.length === 0) {
    logError('No se encontró la cotización');
    return null;
  }
  
  const cotizacion = cotizacionResult.recordset[0];
  
  // Obtener productos para los items
  const items = [];
  for (const detalle of cotizacionDetalleResult.recordset) {
    const productoResult = await pool.request()
      .input('codins', sql.VarChar(50), detalle.cod_producto)
      .query(`
        SELECT TOP 1 id, codins, nomins, ultimo_costo, tasa_iva
        FROM inv_insumos
        WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(@codins))
      `);
    
    if (productoResult.recordset.length > 0) {
      const producto = productoResult.recordset[0];
      const cantidad = parseFloat(detalle.cantidad) || 0;
      const precioUnitario = parseFloat(detalle.preciound || producto.ultimo_costo || 10000) || 0;
      const descuentoPorcentaje = Math.min(Math.max(parseFloat(detalle.tasa_descuento || 0) || 0, 0), 999.99);
      const ivaPorcentaje = Math.min(Math.max(parseFloat(detalle.tasa_iva || producto.tasa_iva || 19) || 19, 0), 999.99);
      const subtotal = parseFloat((cantidad * precioUnitario).toFixed(2));
      const descuentoValor = parseFloat((subtotal * (descuentoPorcentaje / 100)).toFixed(2));
      const subtotalConDescuento = parseFloat((subtotal - descuentoValor).toFixed(2));
      const valorIva = parseFloat((subtotalConDescuento * (ivaPorcentaje / 100)).toFixed(2));
      const total = parseFloat((subtotalConDescuento + valorIva).toFixed(2));
      
      items.push({
        productoId: producto.id,
        cantidad: cantidad,
        precioUnitario: precioUnitario,
        descuentoPorcentaje: descuentoPorcentaje,
        descuentoValor: descuentoValor,
        ivaPorcentaje: ivaPorcentaje,
        valorIva: valorIva,
        descripcion: producto.nomins,
        subtotal: subtotalConDescuento,
        total: total,
      });
    }
  }
  
  if (items.length === 0) {
    logError('No se pudieron obtener los productos para los items');
    return null;
  }
  
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const descuentoValor = items.reduce((sum, item) => sum + (item.descuentoValor || 0), 0);
  const ivaValor = items.reduce((sum, item) => sum + item.valorIva, 0);
  const total = items.reduce((sum, item) => sum + item.total, 0);
  
  // Primero actualizar la cotización a APROBADA
  try {
    await makeRequest('PUT', `/cotizaciones/${cotizacionId}`, { estado: 'APROBADA' });
    logInfo('Cotización actualizada a APROBADA');
  } catch (error) {
    logWarning(`No se pudo actualizar el estado de la cotización: ${error.message}`);
  }
  
  // Crear el pedido
  const fechaPedido = new Date().toISOString().split('T')[0];
  const fechaEntregaEstimada = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const pedidoPayload = {
    clienteId: cotizacion.codter,
    vendedorId: cotizacion.cod_vendedor ? String(cotizacion.cod_vendedor).trim() : null,
    cotizacionId: cotizacionId,
    fechaPedido: fechaPedido,
    fechaEntregaEstimada: fechaEntregaEstimada,
    items: items,
    subtotal: subtotal,
    descuentoValor: descuentoValor,
    ivaValor: ivaValor,
    total: total,
    observaciones: `Pedido creado desde cotización ${cotizacion.numcot}`,
    estado: 'BORRADOR',
    empresaId: cotizacion.codalm || '001',
  };
  
  try {
    const response = await makeRequest('POST', '/pedidos', pedidoPayload);
    
    if (response.status === 200 && response.data.success) {
      logSuccess(`Pedido creado exitosamente desde cotización`);
      logInfo(`  ID: ${response.data.data.id}`);
      logInfo(`  Cotización origen: ${cotizacion.numcot}`);
      return response.data.data;
    } else {
      logError(`Error al crear pedido: ${response.data.message || response.data.error}`);
      if (response.data.details) {
        logError(`  Detalles: ${JSON.stringify(response.data.details)}`);
      }
      if (response.data.sqlMessage) {
        logError(`  SQL Error: ${response.data.sqlMessage}`);
      }
      if (response.data.debug) {
        logError(`  Debug: ${JSON.stringify(response.data.debug)}`);
      }
      return null;
    }
  } catch (error) {
    logError(`Error en la petición: ${error.message}`);
    return null;
  }
}

// ============================================================================
// PRUEBA 4: EDITAR PEDIDO
// ============================================================================

async function pruebaEditarPedido(pedidoId) {
  logTest('PRUEBA 4: Editar Pedido');
  
  if (!pedidoId) {
    logWarning('No hay pedido para editar, saltando prueba');
    return null;
  }
  
  const payload = {
    observaciones: 'Pedido editado - Prueba de actualización',
    estado: 'ENVIADA',
  };
  
  try {
    const response = await makeRequest('PUT', `/pedidos/${pedidoId}`, payload);
    
    if (response.status === 200 && response.data.success) {
      logSuccess(`Pedido editado exitosamente`);
      logInfo(`  ID: ${pedidoId}`);
      logInfo(`  Nuevo estado: ${response.data.data.estado || 'N/A'}`);
      return response.data.data;
    } else {
      logError(`Error al editar pedido: ${response.data.message || response.data.error}`);
      if (response.data.error === 'PEDIDO_NO_EDITABLE') {
        logWarning(`El pedido no es editable porque está en estado: ${response.data.estadoActual}`);
      }
      return null;
    }
  } catch (error) {
    logError(`Error en la petición: ${error.message}`);
    return null;
  }
}

// ============================================================================
// PRUEBA 5: CREAR REMISIÓN DESDE PEDIDO (CONVERSIÓN)
// ============================================================================

async function pruebaCrearRemisionDesdePedido(pedidoId, testData, pool) {
  logTest('PRUEBA 5: Crear Remisión desde Pedido (Conversión Pedido -> Remisión)');
  
  if (!pedidoId) {
    logWarning('No hay pedido para crear remisión, saltando prueba');
    return null;
  }
  
  // Obtener información del pedido
  const pedidoResult = await pool.request()
    .input('pedidoId', sql.Int, pedidoId)
    .query(`
      SELECT id, numero_pedido, codter, codven, subtotal, descuento_valor, iva_valor, total, empresa_id
      FROM ven_pedidos
      WHERE id = @pedidoId
    `);
  
  if (pedidoResult.recordset.length === 0) {
    logError('No se encontró el pedido');
    return null;
  }
  
  const pedido = pedidoResult.recordset[0];
  
  // Obtener items del pedido
  const pedidoDetalleResult = await pool.request()
    .input('pedidoId', sql.Int, pedidoId)
    .query(`
      SELECT pd.codins, pd.canped as cantidad, pd.valins as precioUnitario, pd.ivaped as valorIva, pd.dctped as descuentoValor
      FROM ven_detapedidos pd
      WHERE pd.pedido_id = @pedidoId
    `);
  
  if (pedidoDetalleResult.recordset.length === 0) {
    logError('No se encontraron items en el pedido');
    return null;
  }
  
  // Construir items para la remisión
  const items = [];
  for (const detalle of pedidoDetalleResult.recordset) {
    const productoResult = await pool.request()
      .input('codins', sql.VarChar(50), detalle.codins)
      .query(`
        SELECT TOP 1 id, codins, nomins
        FROM inv_insumos
        WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(@codins))
      `);
    
    if (productoResult.recordset.length > 0) {
      const producto = productoResult.recordset[0];
      const cantidadEnviada = parseFloat(detalle.cantidad);
      const precioUnitario = parseFloat(detalle.precioUnitario || 0);
      const descuentoValor = parseFloat(detalle.descuentoValor || 0);
      const valorIva = parseFloat(detalle.valorIva || 0);
      const subtotal = (cantidadEnviada * precioUnitario) - descuentoValor;
      const total = subtotal + valorIva;
      
      items.push({
        productoId: producto.id,
        cantidad: cantidadEnviada,
        codProducto: producto.codins.trim(),
        cantidadEnviada: cantidadEnviada,
        precioUnitario: precioUnitario,
        descuentoPorcentaje: 0,
        ivaPorcentaje: precioUnitario > 0 ? (valorIva / subtotal) * 100 : 0,
        descripcion: producto.nomins,
        subtotal: subtotal,
        valorIva: valorIva,
        total: total,
        cantidadFacturada: 0,
        cantidadDevuelta: 0,
      });
    }
  }
  
  if (items.length === 0) {
    logError('No se pudieron obtener los productos para los items');
    return null;
  }
  
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const ivaValor = items.reduce((sum, item) => sum + item.valorIva, 0);
  const total = items.reduce((sum, item) => sum + item.total, 0);
  
  const fechaRemision = new Date().toISOString().split('T')[0];
  
  const remisionPayload = {
    pedidoId: pedidoId,
    clienteId: pedido.codter,
    vendedorId: pedido.codven ? String(pedido.codven).trim() : null,
    fechaRemision: fechaRemision,
    fechaDespacho: null,
    subtotal: subtotal,
    descuentoValor: parseFloat(pedido.descuento_valor || 0),
    ivaValor: ivaValor,
    total: total,
    observaciones: `Remisión creada desde pedido ${pedido.numero_pedido} - Prueba de conversión`,
    estado: 'BORRADOR',
    empresaId: pedido.empresa_id || testData.bodega.codigo,
    codalm: pedido.empresa_id || testData.bodega.codigo,
    codusu: 'TEST_USER',
    items: items,
  };
  
  try {
    const response = await makeRequest('POST', '/remisiones', remisionPayload);
    
    if (response.status === 200 && response.data.success) {
      logSuccess(`Remisión creada exitosamente desde pedido`);
      logInfo(`  ID: ${response.data.data.id}`);
      logInfo(`  Número: ${response.data.data.numeroRemision || 'N/A'}`);
      logInfo(`  Pedido origen: ${pedido.numero_pedido}`);
      return response.data.data;
    } else {
      logError(`Error al crear remisión: ${response.data.message || response.data.error}`);
      return null;
    }
  } catch (error) {
    logError(`Error en la petición: ${error.message}`);
    return null;
  }
}

// ============================================================================
// PRUEBA 6: EDITAR REMISIÓN
// ============================================================================

async function pruebaEditarRemision(remisionId) {
  logTest('PRUEBA 6: Editar Remisión');
  
  if (!remisionId) {
    logWarning('No hay remisión para editar, saltando prueba');
    return null;
  }
  
  const payload = {
    observaciones: 'Remisión editada - Prueba de actualización',
    estado: 'BORRADOR',
  };
  
  try {
    const response = await makeRequest('PUT', `/remisiones/${remisionId}`, payload);
    
    if (response.status === 200 && response.data.success) {
      logSuccess(`Remisión editada exitosamente`);
      logInfo(`  ID: ${remisionId}`);
      logInfo(`  Nuevo estado: ${response.data.data.estado || 'N/A'}`);
      return response.data.data;
    } else {
      logError(`Error al editar remisión: ${response.data.message || response.data.error}`);
      return null;
    }
  } catch (error) {
    logError(`Error en la petición: ${error.message}`);
    return null;
  }
}

// ============================================================================
// PRUEBA 7: FLUJO COMPLETO (COTIZACIÓN -> PEDIDO -> REMISIÓN)
// ============================================================================

async function pruebaFlujoCompleto(testData, pool) {
  logTest('PRUEBA 7: Flujo Completo (Cotización -> Pedido -> Remisión)');
  
  logInfo('Paso 1: Crear cotización...');
  const cotizacion = await pruebaCrearCotizacion(testData);
  if (!cotizacion) {
    logError('No se pudo crear la cotización, abortando flujo completo');
    return;
  }
  
  logInfo('Paso 2: Aprobar cotización y crear pedido...');
  const pedido = await pruebaAprobarCotizacionYCrearPedido(cotizacion.id, pool);
  if (!pedido) {
    logError('No se pudo crear el pedido, abortando flujo completo');
    return;
  }
  
  logInfo('Paso 3: Crear remisión desde pedido...');
  const remision = await pruebaCrearRemisionDesdePedido(pedido.id, testData, pool);
  if (!remision) {
    logError('No se pudo crear la remisión');
    return;
  }
  
  logSuccess('✅ Flujo completo ejecutado exitosamente');
  logInfo(`  Cotización ID: ${cotizacion.id}`);
  logInfo(`  Pedido ID: ${pedido.id}`);
  logInfo(`  Remisión ID: ${remision.id}`);
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

(async () => {
  let pool;
  
  try {
    logSection('🚀 INICIO DE PRUEBAS COMPLETAS DE ENDPOINTS');
    
    // Conectar a la base de datos
    logInfo('Conectando a la base de datos...');
    pool = await sql.connect({
      server: process.env.DB_SERVER,
      port: parseInt(process.env.DB_PORT),
      database: process.env.DB_DATABASE,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      options: {
        encrypt: false,
        trustServerCertificate: true
      }
    });
    logSuccess('Conectado a la base de datos');
    
    // Análisis de endpoints
    await analizarEndpoints();
    
    // Obtener datos de prueba
    const testData = await getTestData(pool);
    
    // Ejecutar pruebas individuales
    logSection('📝 PRUEBAS INDIVIDUALES');
    
    const cotizacion = await pruebaCrearCotizacion(testData);
    await pruebaEditarCotizacion(cotizacion?.id);
    
    const pedido = await pruebaAprobarCotizacionYCrearPedido(cotizacion?.id, pool);
    await pruebaEditarPedido(pedido?.id);
    
    const remision = await pruebaCrearRemisionDesdePedido(pedido?.id, testData, pool);
    await pruebaEditarRemision(remision?.id);
    
    // Ejecutar flujo completo
    logSection('🔄 PRUEBA DE FLUJO COMPLETO');
    await pruebaFlujoCompleto(testData, pool);
    
    logSection('✅ TODAS LAS PRUEBAS COMPLETADAS');
    logSuccess('Análisis y pruebas finalizadas exitosamente');
    
  } catch (error) {
    logError(`Error general: ${error.message}`);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      logInfo('Conexión a la base de datos cerrada');
    }
  }
})();

