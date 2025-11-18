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

    console.log('\n🌐 CONFIGURACIÓN DE LA PETICIÓN HTTP:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📍 URL Completa: ${url}`);
    console.log(`🔗 Endpoint: ${urlObj.pathname}`);
    console.log(`🌍 Host: ${urlObj.hostname}:${urlObj.port || 3001}`);
    console.log(`📡 Método: ${options.method}`);
    console.log(`📦 Tamaño del body: ${Buffer.byteLength(postData)} bytes`);
    console.log('═══════════════════════════════════════════════════════════\n');

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
      console.log(`   ${idx + 1}. ${p.nomins} (${p.codins}) - Costo: $${p.ultimo_costo}`);
    });
    console.log('');

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
      pedidoId: null,
      clienteId: cliente.codter,
      vendedorId: null,
      fechaRemision: new Date().toISOString().split('T')[0],
      fechaDespacho: null,
      subtotal: subtotal,
      descuentoValor: 0,
      ivaValor: ivaValor,
      total: total,
      observaciones: 'Remisión de prueba - Test detallado de guardado',
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
    console.log(`   Cliente ID: ${payload.clienteId}`);
    console.log(`   Items: ${payload.items.length}`);
    console.log(`   Subtotal: $${payload.subtotal.toLocaleString('es-CO')}`);
    console.log(`   IVA: $${payload.ivaValor.toLocaleString('es-CO')}`);
    console.log(`   Total: $${payload.total.toLocaleString('es-CO')}`);
    console.log(`   Estado: ${payload.estado}`);
    console.log(`   Almacén: ${payload.codalm}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Enviar petición
    console.log('🚀 Enviando petición POST a la API...\n');
    const response = await makeRequest(API_ENDPOINT, payload);

    console.log('📥 RESPUESTA DE LA API:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Status Code: ${response.status}`);
    console.log(`   Success: ${response.data.success}`);
    console.log(`   Message: ${response.data.message || 'N/A'}`);
    if (response.data.error) {
      console.log(`   Error: ${response.data.error}`);
    }
    if (response.data.data && response.data.data.id) {
      console.log(`   Remisión ID: ${response.data.data.id}`);
    }
    console.log('═══════════════════════════════════════════════════════════\n');

    if (response.data.success && response.data.data) {
      const remisionId = response.data.data.id;
      console.log('🔍 VERIFICANDO GUARDADO EN BASE DE DATOS:');
      console.log('═══════════════════════════════════════════════════════════\n');

      // Verificar encabezado
      const verifyEnc = await pool.request()
        .input('id', sql.Int, remisionId)
        .query(`
          SELECT * FROM ven_remiciones_enc WHERE id = @id
        `);

      if (verifyEnc.recordset.length > 0) {
        const rem = verifyEnc.recordset[0];
        console.log('✅ TABLA: ven_remiciones_enc');
        console.log('   Datos guardados:');
        Object.keys(rem).forEach(key => {
          const value = rem[key] === null ? 'NULL' : rem[key];
          console.log(`      ${key.padEnd(20)} = ${value}`);
        });
        console.log('');

        // Verificar detalle
        const verifyDet = await pool.request()
          .input('remision_id', sql.Int, remisionId)
          .query(`
            SELECT * FROM ven_remiciones_det WHERE remision_id = @remision_id ORDER BY id
          `);

        console.log(`✅ TABLA: ven_remiciones_det (${verifyDet.recordset.length} registros)`);
        verifyDet.recordset.forEach((item, idx) => {
          console.log(`\n   Item ${idx + 1}:`);
          Object.keys(item).forEach(key => {
            const value = item[key] === null ? 'NULL' : item[key];
            console.log(`      ${key.padEnd(20)} = ${value}`);
          });
        });
        console.log('');

        // Verificar kardex
        const verifyKardex = await pool.request()
          .input('numrem', sql.VarChar(50), rem.numero_remision)
          .query(`
            SELECT TOP 3 * FROM inv_kardex 
            WHERE numrem = @numrem 
            ORDER BY id DESC
          `);

        if (verifyKardex.recordset.length > 0) {
          console.log(`✅ TABLA: inv_kardex (${verifyKardex.recordset.length} movimientos encontrados)`);
          verifyKardex.recordset.forEach((mov, idx) => {
            console.log(`\n   Movimiento ${idx + 1}:`);
            Object.keys(mov).forEach(key => {
              const value = mov[key] === null ? 'NULL' : mov[key];
              console.log(`      ${key.padEnd(15)} = ${value}`);
            });
          });
        } else {
          console.log('⚠️  No se encontraron movimientos en inv_kardex');
        }
      } else {
        console.log('❌ ERROR: La remisión no se encontró en la base de datos');
      }

      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('✅✅✅ PROCESO COMPLETADO EXITOSAMENTE ✅✅✅');
      console.log('═══════════════════════════════════════════════════════════');
    } else {
      console.log('\n❌ ERROR: La API no retornó success=true');
      console.log('   Revisa los logs del servidor para más detalles');
    }

  } catch (error) {
    console.error('\n❌❌❌ ERROR EN LA PRUEBA ❌❌❌');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('Mensaje:', error.message);
    console.error('Stack:', error.stack);
    if (error.originalError) {
      console.error('Error original:', error.originalError.message);
    }
    console.error('═══════════════════════════════════════════════════════════');
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Conexión cerrada');
    }
  }
})();

