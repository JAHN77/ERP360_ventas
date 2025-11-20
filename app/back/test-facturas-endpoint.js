/**
 * Script de prueba para el endpoint POST /api/facturas
 * Verifica que todos los campos estén dentro de los límites permitidos
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Función para hacer peticiones HTTP
async function request(method, endpoint, data = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    const result = await response.json();
    return { status: response.status, ...result };
  } catch (error) {
    return { status: 0, success: false, error: error.message };
  }
}

// Función para obtener datos de prueba
async function obtenerDatosPrueba() {
  console.log('📋 Obteniendo datos de prueba...');
  
  // Obtener clientes
  const clientesRes = await request('GET', '/api/clientes');
  const clientes = clientesRes.success ? clientesRes.data : [];
  const cliente = clientes.find(c => c.activo === 1 || c.activo === true) || clientes[0];
  
  if (!cliente) {
    throw new Error('No se encontraron clientes activos para la prueba');
  }
  
  // Obtener productos
  const productosRes = await request('GET', '/api/productos');
  const productos = productosRes.success ? productosRes.data : [];
  const productosActivos = productos.filter(p => p.activo !== false).slice(0, 3);
  
  if (productosActivos.length === 0) {
    throw new Error('No se encontraron productos activos para la prueba');
  }
  
  // Obtener vendedores
  const vendedoresRes = await request('GET', '/api/vendedores');
  const vendedores = vendedoresRes.success ? vendedoresRes.data : [];
  const vendedor = vendedores.find(v => v.activo === 1 || v.activo === true) || vendedores[0];
  
  // Obtener almacenes
  const almacenesRes = await request('GET', '/api/almacenes');
  const almacenes = almacenesRes.success ? almacenesRes.data : [];
  const almacen = almacenes[0] || { codigo: '001' };
  
  console.log('✅ Datos de prueba obtenidos:', {
    cliente: cliente?.nombreCompleto || cliente?.codter,
    productos: productosActivos.length,
    vendedor: vendedor?.nombreCompleto || vendedor?.codigoVendedor,
    almacen: almacen?.codigo
  });
  
  return { cliente, productos: productosActivos, vendedor, almacen };
}

// Función para probar creación de factura con diferentes escenarios
async function probarCrearFactura() {
  console.log('\n🧪 Iniciando pruebas del endpoint POST /api/facturas...\n');
  
  try {
    const { cliente, productos, vendedor, almacen } = await obtenerDatosPrueba();
    
    // Escenario 1: Factura básica con valores normales
    console.log('📝 Prueba 1: Factura básica con valores normales');
    const facturaBasica = {
      numeroFactura: 'AUTO',
      fechaFactura: new Date().toISOString().split('T')[0],
      fechaVencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      clienteId: cliente.codter || cliente.numeroDocumento || cliente.id,
      vendedorId: vendedor?.codiEmple || vendedor?.id || vendedor?.codigoVendedor,
      subtotal: 100000,
      descuentoValor: 0,
      ivaValor: 19000,
      total: 119000,
      observaciones: 'Factura de prueba básica',
      estado: 'BORRADOR',
      empresaId: almacen?.codigo || '001',
      items: productos.slice(0, 2).map((p, idx) => ({
        productoId: p.id,
        cantidad: (idx + 1) * 2,
        precioUnitario: 50000,
        descuentoPorcentaje: 0,
        ivaPorcentaje: 19,
        descripcion: p.nombre || p.nomins || `Producto ${p.id}`,
        subtotal: (idx + 1) * 2 * 50000,
        valorIva: (idx + 1) * 2 * 50000 * 0.19,
        total: (idx + 1) * 2 * 50000 * 1.19
      }))
    };
    
    const res1 = await request('POST', '/api/facturas', facturaBasica);
    console.log('   Resultado:', res1.success ? '✅ Éxito' : `❌ Error: ${res1.error || res1.message}`);
    if (!res1.success) {
      console.log('   Detalles:', JSON.stringify(res1.details || res1, null, 2));
    }
    
    // Escenario 2: Factura con observaciones muy largas (debe truncarse)
    console.log('\n📝 Prueba 2: Factura con observaciones muy largas');
    const facturaObservacionesLargas = {
      ...facturaBasica,
      numeroFactura: 'AUTO',
      observaciones: 'A'.repeat(600) // Más de 500 caracteres
    };
    
    const res2 = await request('POST', '/api/facturas', facturaObservacionesLargas);
    console.log('   Resultado:', res2.success ? '✅ Éxito (truncado correctamente)' : `❌ Error: ${res2.error || res2.message}`);
    if (!res2.success) {
      console.log('   Detalles:', JSON.stringify(res2.details || res2, null, 2));
    }
    
    // Escenario 3: Factura con descripciones de items muy largas
    console.log('\n📝 Prueba 3: Factura con descripciones de items muy largas');
    const facturaDescripcionesLargas = {
      ...facturaBasica,
      numeroFactura: 'AUTO',
      items: productos.slice(0, 2).map((p, idx) => ({
        productoId: p.id,
        cantidad: (idx + 1) * 2,
        precioUnitario: 50000,
        descuentoPorcentaje: 0,
        ivaPorcentaje: 19,
        descripcion: 'B'.repeat(300), // Más de 255 caracteres
        subtotal: (idx + 1) * 2 * 50000,
        valorIva: (idx + 1) * 2 * 50000 * 0.19,
        total: (idx + 1) * 2 * 50000 * 1.19
      }))
    };
    
    const res3 = await request('POST', '/api/facturas', facturaDescripcionesLargas);
    console.log('   Resultado:', res3.success ? '✅ Éxito (truncado correctamente)' : `❌ Error: ${res3.error || res3.message}`);
    if (!res3.success) {
      console.log('   Detalles:', JSON.stringify(res3.details || res3, null, 2));
    }
    
    // Escenario 4: Factura sin fechaVencimiento (debe calcularse automáticamente)
    console.log('\n📝 Prueba 4: Factura sin fechaVencimiento');
    const facturaSinVencimiento = {
      ...facturaBasica,
      numeroFactura: 'AUTO',
      fechaVencimiento: undefined
    };
    delete facturaSinVencimiento.fechaVencimiento;
    
    const res4 = await request('POST', '/api/facturas', facturaSinVencimiento);
    console.log('   Resultado:', res4.success ? '✅ Éxito (fecha calculada automáticamente)' : `❌ Error: ${res4.error || res4.message}`);
    if (!res4.success) {
      console.log('   Detalles:', JSON.stringify(res4.details || res4, null, 2));
    }
    
    // Escenario 5: Factura con campos VARCHAR al límite
    console.log('\n📝 Prueba 5: Factura con campos VARCHAR al límite');
    const facturaLimites = {
      ...facturaBasica,
      numeroFactura: 'A'.repeat(50), // Exactamente 50 caracteres
      tipoFactura: 'B'.repeat(10), // Exactamente 10 caracteres
      documentoContable: 'C'.repeat(20), // Exactamente 20 caracteres
      resolucionDian: 'D'.repeat(50), // Exactamente 50 caracteres
      observaciones: 'E'.repeat(500), // Exactamente 500 caracteres
      estadoEnvio: 'F'.repeat(20), // Exactamente 20 caracteres
      seyKey: 'G'.repeat(100), // Exactamente 100 caracteres
      cufe: 'H'.repeat(100) // Exactamente 100 caracteres
    };
    
    const res5 = await request('POST', '/api/facturas', facturaLimites);
    console.log('   Resultado:', res5.success ? '✅ Éxito' : `❌ Error: ${res5.error || res5.message}`);
    if (!res5.success) {
      console.log('   Detalles:', JSON.stringify(res5.details || res5, null, 2));
    }
    
    // Escenario 6: Factura con campos VARCHAR excediendo límites (debe truncarse)
    console.log('\n📝 Prueba 6: Factura con campos VARCHAR excediendo límites');
    const facturaExcediendo = {
      ...facturaBasica,
      numeroFactura: 'AUTO',
      tipoFactura: 'B'.repeat(15), // Más de 10 caracteres
      documentoContable: 'C'.repeat(25), // Más de 20 caracteres
      resolucionDian: 'D'.repeat(60), // Más de 50 caracteres
      observaciones: 'E'.repeat(600), // Más de 500 caracteres
      estadoEnvio: 'F'.repeat(25), // Más de 20 caracteres
      seyKey: 'G'.repeat(120), // Más de 100 caracteres
      cufe: 'H'.repeat(120) // Más de 100 caracteres
    };
    
    const res6 = await request('POST', '/api/facturas', facturaExcediendo);
    console.log('   Resultado:', res6.success ? '✅ Éxito (truncado correctamente)' : `❌ Error: ${res6.error || res6.message}`);
    if (!res6.success) {
      console.log('   Detalles:', JSON.stringify(res6.details || res6, null, 2));
    }
    
    console.log('\n✅ Pruebas completadas\n');
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
    process.exit(1);
  }
}

// Ejecutar pruebas
if (require.main === module) {
  probarCrearFactura().then(() => {
    console.log('✅ Todas las pruebas finalizadas');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { probarCrearFactura };

