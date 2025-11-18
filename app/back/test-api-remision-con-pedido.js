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
    console.log('🔌 Conectando a la base de datos...');
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

    // Buscar un pedido con items
    console.log('📋 Buscando pedido con items...');
    const pedidoResult = await pool.request().query(`
      SELECT TOP 1 p.id, p.numero_pedido, p.codter
      FROM ven_pedidos p
      WHERE EXISTS (
        SELECT 1 FROM ven_detapedidos pd 
        WHERE pd.pedido_id = p.id
      )
      ORDER BY p.id DESC
    `);
    
    if (pedidoResult.recordset.length === 0) {
      console.log('⚠️ No se encontró ningún pedido con items. Creando remisión sin pedido...\n');
      // Continuar sin pedido
      var pedidoId = null;
      var pedido = null;
    } else {
      const pedidoData = pedidoResult.recordset[0];
      pedidoId = pedidoData.id;
      pedido = pedidoData;
      console.log(`✅ Pedido encontrado: ${pedidoData.numero_pedido} (ID: ${pedidoId})\n`);
      
      // Obtener items del pedido con detaPedidoId
      const itemsPedidoResult = await pool.request()
        .input('pedidoId', sql.Int, pedidoId)
        .query(`
          SELECT 
            pd.id as detaPedidoId,
            pd.codins,
            pd.canped as cantidad,
            (SELECT TOP 1 id FROM inv_insumos WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(pd.codins))) as productoId
          FROM ven_detapedidos pd
          WHERE pd.pedido_id = @pedidoId
          ORDER BY pd.id
        `);
      
      console.log(`📦 Items del pedido encontrados: ${itemsPedidoResult.recordset.length}`);
      itemsPedidoResult.recordset.forEach((item, idx) => {
        console.log(`   ${idx + 1}. codins: ${item.codins}, cantidad: ${item.cantidad}, detaPedidoId: ${item.detaPedidoId}`);
      });
      console.log('');
    }

    // Obtener cliente
    const clienteCodter = pedido ? pedido.codter : null;
    if (!clienteCodter) {
      const clienteResult = await pool.request().query(`
        SELECT TOP 1 codter FROM con_terceros WHERE activo = 1 ORDER BY NEWID()
      `);
      if (clienteResult.recordset.length > 0) {
        clienteCodter = clienteResult.recordset[0].codter;
      } else {
        throw new Error('No se encontró ningún cliente');
      }
    }

    // Si hay pedido, usar sus items. Si no, obtener productos aleatorios
    let items = [];
    if (pedido && itemsPedidoResult.recordset.length > 0) {
      // Usar items del pedido
      for (const itemPedido of itemsPedidoResult.recordset.slice(0, 3)) { // Máximo 3 items
        const productoResult = await pool.request()
          .input('productoId', sql.Int, itemPedido.productoId)
          .query(`
            SELECT TOP 1 id, codins, nomins, ultimo_costo, tasa_iva
            FROM inv_insumos WHERE id = @productoId
          `);
        
        if (productoResult.recordset.length > 0) {
          const producto = productoResult.recordset[0];
          const cantidad = Math.min(itemPedido.cantidad, 5); // Máximo 5 para la prueba
          const precioUnitario = parseFloat(producto.ultimo_costo || 10000);
          const ivaPorcentaje = parseFloat(producto.tasa_iva || 19);
          const subtotal = cantidad * precioUnitario;
          const valorIva = subtotal * (ivaPorcentaje / 100);
          const total = subtotal + valorIva;

          items.push({
            productoId: producto.id,
            cantidad: cantidad,
            codProducto: producto.codins.trim(),
            cantidadEnviada: cantidad,
            detaPedidoId: itemPedido.detaPedidoId, // CRÍTICO: Incluir detaPedidoId
            precioUnitario: precioUnitario,
            descuentoPorcentaje: 0,
            ivaPorcentaje: ivaPorcentaje,
            descripcion: producto.nomins,
            subtotal: subtotal,
            valorIva: valorIva,
            total: total,
            cantidadFacturada: 0,
            cantidadDevuelta: 0
          });
        }
      }
    } else {
      // Obtener productos aleatorios
      const productosResult = await pool.request().query(`
        SELECT TOP 3 id, codins, nomins, ultimo_costo, tasa_iva
        FROM inv_insumos 
        WHERE activo = 1 AND codins IS NOT NULL AND LTRIM(RTRIM(codins)) != ''
        ORDER BY NEWID()
      `);
      
      productosResult.recordset.forEach((producto, idx) => {
        const cantidad = (idx + 1) * 5;
        const precioUnitario = parseFloat(producto.ultimo_costo || 10000);
        const ivaPorcentaje = parseFloat(producto.tasa_iva || 19);
        const subtotal = cantidad * precioUnitario;
        const valorIva = subtotal * (ivaPorcentaje / 100);
        const total = subtotal + valorIva;

        items.push({
          productoId: producto.id,
          cantidad: cantidad,
          codProducto: producto.codins.trim(),
          cantidadEnviada: cantidad,
          detaPedidoId: null, // Sin pedido
          precioUnitario: precioUnitario,
          descuentoPorcentaje: 0,
          ivaPorcentaje: ivaPorcentaje,
          descripcion: producto.nomins,
          subtotal: subtotal,
          valorIva: valorIva,
          total: total,
          cantidadFacturada: 0,
          cantidadDevuelta: 0
        });
      });
    }

    if (items.length === 0) {
      throw new Error('No se pudieron obtener items para la remisión');
    }

    // Calcular totales
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const ivaValor = items.reduce((sum, item) => sum + item.valorIva, 0);
    const total = items.reduce((sum, item) => sum + item.total, 0);

    // Construir payload
    const payload = {
      pedidoId: pedidoId,
      clienteId: clienteCodter,
      vendedorId: null,
      fechaRemision: new Date().toISOString().split('T')[0],
      fechaDespacho: null,
      subtotal: subtotal,
      descuentoValor: 0,
      ivaValor: ivaValor,
      total: total,
      observaciones: 'Remisión de prueba CON pedidoId - Verificando detaPedidoId',
      estado: 'BORRADOR',
      empresaId: '001',
      codalm: '001',
      codusu: 'TEST_USER',
      items: items
    };

    console.log('📤 BODY QUE SE ENVÍA A LA API:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(JSON.stringify(payload, null, 2));
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📊 RESUMEN DEL PAYLOAD:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Pedido ID: ${pedidoId || 'NULL'}`);
    console.log(`   Cliente ID: ${clienteCodter}`);
    console.log(`   Items: ${items.length}`);
    items.forEach((item, idx) => {
      console.log(`   Item ${idx + 1}: codProducto=${item.codProducto}, detaPedidoId=${item.detaPedidoId || 'NULL'}`);
    });
    console.log('═══════════════════════════════════════════════════════════\n');

    // Enviar petición
    console.log('🚀 Enviando petición POST a la API...\n');
    const response = await makeRequest(API_ENDPOINT, payload);

    console.log('📥 RESPUESTA DE LA API:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Status Code: ${response.status}`);
    console.log(`   Success: ${response.data.success}`);
    if (response.data.data && response.data.data.id) {
      console.log(`   Remisión ID: ${response.data.data.id}`);
    }
    console.log('═══════════════════════════════════════════════════════════\n');

    if (response.data.success && response.data.data) {
      const remisionId = response.data.data.id;
      
      // Verificar detalle
      const verifyDet = await pool.request()
        .input('remision_id', sql.Int, remisionId)
        .query(`
          SELECT * FROM ven_remiciones_det WHERE remision_id = @remision_id ORDER BY id
        `);

      console.log('✅ VERIFICACIÓN DE deta_pedido_id:');
      console.log('═══════════════════════════════════════════════════════════');
      verifyDet.recordset.forEach((item, idx) => {
        const expectedDetaPedidoId = items[idx]?.detaPedidoId || null;
        const actualDetaPedidoId = item.deta_pedido_id;
        const match = expectedDetaPedidoId === actualDetaPedidoId ? '✅' : '❌';
        console.log(`   Item ${idx + 1}:`);
        console.log(`      codins: ${item.codins}`);
        console.log(`      deta_pedido_id esperado: ${expectedDetaPedidoId || 'NULL'}`);
        console.log(`      deta_pedido_id guardado: ${actualDetaPedidoId || 'NULL'} ${match}`);
      });
      console.log('═══════════════════════════════════════════════════════════\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('🔌 Conexión cerrada');
    }
  }
})();

