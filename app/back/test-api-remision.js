const http = require('http');
const sql = require('mssql');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const API_ENDPOINT = `${API_BASE_URL}/api/remisiones`;

// Función para hacer petición HTTP POST
function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 3001,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

(async () => {
  let pool;
  
  try {
    console.log('🔌 Conectando a la base de datos para obtener datos de prueba...');
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
    console.log('✅ Conectado a la base de datos\n');

    // Obtener un cliente activo
    console.log('📋 Obteniendo cliente de prueba...');
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
    console.log(`✅ Cliente seleccionado: ${cliente.nomter} (${cliente.codter})\n`);

    // Obtener productos activos con codins
    console.log('📦 Obteniendo productos de prueba...');
    const productosResult = await pool.request().query(`
      SELECT TOP 3 id, codins, nomins, ultimo_costo, tasa_iva
      FROM inv_insumos 
      WHERE activo = 1 AND codins IS NOT NULL AND LTRIM(RTRIM(codins)) != ''
      ORDER BY NEWID()
    `);
    
    if (productosResult.recordset.length === 0) {
      throw new Error('No se encontraron productos activos con codins en la base de datos');
    }
    const productos = productosResult.recordset;
    console.log(`✅ Productos seleccionados: ${productos.length}`);
    productos.forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.nomins} (${p.codins})`);
    });
    console.log('');

    // Obtener un pedido existente (opcional)
    console.log('📋 Buscando pedido existente (opcional)...');
    const pedidoResult = await pool.request().query(`
      SELECT TOP 1 id, numero_pedido, codter
      FROM ven_pedidos
      WHERE estado IN ('CONFIRMADO', 'EN_PROCESO')
      ORDER BY NEWID()
    `);
    const pedidoExistente = pedidoResult.recordset.length > 0 ? pedidoResult.recordset[0] : null;
    if (pedidoExistente) {
      console.log(`✅ Pedido encontrado: ${pedidoExistente.numero_pedido} (ID: ${pedidoExistente.id})\n`);
    } else {
      console.log('ℹ️ No se encontró pedido existente, se creará remisión sin pedido\n');
    }

    // Construir items para la remisión
    const items = productos.map((producto, idx) => {
      const cantidad = (idx + 1) * 5; // 5, 10, 15
      const precioUnitario = parseFloat(producto.ultimo_costo || 10000);
      const ivaPorcentaje = parseFloat(producto.tasa_iva || 19);
      const subtotal = cantidad * precioUnitario;
      const valorIva = subtotal * (ivaPorcentaje / 100);
      const total = subtotal + valorIva;

      return {
        productoId: producto.id,
        cantidad: cantidad,
        codProducto: producto.codins.trim(), // CRÍTICO: codins del producto
        cantidadEnviada: cantidad,
        detaPedidoId: null, // Opcional
        precioUnitario: precioUnitario,
        descuentoPorcentaje: 0,
        ivaPorcentaje: ivaPorcentaje,
        descripcion: producto.nomins,
        subtotal: subtotal,
        valorIva: valorIva,
        total: total,
        cantidadFacturada: 0,
        cantidadDevuelta: 0
      };
    });

    // Calcular totales
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const ivaValor = items.reduce((sum, item) => sum + item.valorIva, 0);
    const total = items.reduce((sum, item) => sum + item.total, 0);

    // Construir payload para la API
    const payload = {
      pedidoId: pedidoExistente ? pedidoExistente.id : null,
      clienteId: cliente.codter,
      vendedorId: null, // Opcional
      fechaRemision: new Date().toISOString().split('T')[0],
      fechaDespacho: null,
      subtotal: subtotal,
      descuentoValor: 0,
      ivaValor: ivaValor,
      total: total,
      observaciones: 'Remisión de prueba creada mediante script de testing',
      estado: 'BORRADOR',
      empresaId: '001', // Código de bodega
      codalm: '001', // Código de almacén
      codusu: 'TEST', // Usuario de prueba
      items: items
    };

    console.log('📤 Enviando petición POST a la API...');
    console.log(`   URL: ${API_ENDPOINT}`);
    console.log(`   Cliente: ${cliente.codter}`);
    console.log(`   Items: ${items.length}`);
    console.log(`   Total: $${total.toLocaleString('es-CO')}\n`);

    const response = await makeRequest(API_ENDPOINT, payload);

    console.log('📥 Respuesta de la API:');
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${response.data.success}`);
    console.log(`   Message: ${response.data.message || 'N/A'}`);
    
    if (response.data.error) {
      console.log(`   Error: ${response.data.error}`);
      if (response.data.details) {
        console.log(`   Details: ${JSON.stringify(response.data.details, null, 2)}`);
      }
    }

    if (response.data.success && response.data.data) {
      const remisionId = response.data.data.id;
      console.log(`   Remisión ID: ${remisionId}\n`);

      // Verificar que se guardó en la base de datos
      console.log('🔍 Verificando que se guardó en la base de datos...');
      const verifyResult = await pool.request()
        .input('id', sql.Int, remisionId)
        .query(`
          SELECT r.*, 
            (SELECT COUNT(*) FROM ven_remiciones_det WHERE remision_id = r.id) as items_count
          FROM ven_remiciones_enc r
          WHERE r.id = @id
        `);

      if (verifyResult.recordset.length > 0) {
        const remision = verifyResult.recordset[0];
        console.log('✅✅✅ REMISIÓN GUARDADA CORRECTAMENTE ✅✅✅');
        console.log(`   ID: ${remision.id}`);
        console.log(`   Número: ${remision.numero_remision}`);
        console.log(`   Cliente: ${remision.codter}`);
        console.log(`   Fecha: ${remision.fecha_remision}`);
        console.log(`   Estado: ${remision.estado}`);
        console.log(`   Items: ${remision.items_count}`);

        // Verificar items
        const itemsResult = await pool.request()
          .input('remision_id', sql.Int, remisionId)
          .query(`
            SELECT * FROM ven_remiciones_det WHERE remision_id = @remision_id
          `);

        console.log(`\n📦 Items guardados (${itemsResult.recordset.length}):`);
        itemsResult.recordset.forEach((item, idx) => {
          console.log(`   ${idx + 1}. ${item.codins} - Cantidad: ${item.cantidad_enviada}`);
        });
      } else {
        console.log('❌ ERROR: La remisión no se encontró en la base de datos');
        console.log('   Esto indica que el commit no se ejecutó correctamente');
      }
    } else {
      console.log('\n❌ ERROR: La API no retornó success=true');
      console.log('   Revisa los logs del servidor para más detalles');
    }

  } catch (error) {
    console.error('\n❌❌❌ ERROR EN LA PRUEBA ❌❌❌');
    console.error('Mensaje:', error.message);
    console.error('Stack:', error.stack);
    if (error.originalError) {
      console.error('Error original:', error.originalError.message);
    }
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Conexión cerrada');
    }
  }
})();

