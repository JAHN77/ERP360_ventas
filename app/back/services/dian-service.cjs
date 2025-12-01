const sql = require('mssql');
const { getConnection } = require('./sqlServerClient.cjs');

/**
 * Servicio para integración con DIAN Facturación Electrónica
 * Transforma facturas de la base de datos al formato JSON requerido por DIAN
 * y envía las facturas al endpoint de DIAN
 */
class DIANService {
  // NIT de la empresa
  static COMPANY_NIT = 901994818;
  
  // Datos de la empresa (hardcodeados según necesidad)
  static COMPANY_DATA = {
    identification_number: 901994818,
    name: "ORQUIDEA IA SOLUTIONS S.A.S",
    type_organization_id: 1, // 1 = Persona Jurídica
    type_document_id: "31", // NIT
    id_location: "11001", // Bogotá D.C.
    address: "CR 53 100 50",
    phone: "3044261630",
    email: "orquideaiasolutionssas@gmail.com"
  };

  /**
   * Redondea un monto a 2 decimales para COP
   * Evita errores de punto flotante en JavaScript
   */
  static roundCOP(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return 0;
    }
    return Math.round(parseFloat(amount) * 100) / 100;
  }

  /**
   * Obtiene la resolución DIAN activa desde la base de datos
   * @returns {Promise<Object>} Resolución DIAN activa
   */
  static async getDIANResolution() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 [DIAN] PASO 1: Obteniendo resolución DIAN activa');
    console.log('='.repeat(80));
    try {
      const pool = await getConnection();
      const request = pool.request();
      
      console.log('🔍 [DIAN] Buscando resolución en Dian_Resoluciones_electronica...');
      // Intentar obtener desde Dian_Resoluciones_electronica primero, luego Dian_Resoluciones
      let result = await request.query(`
        SELECT TOP 1 
          id,
          consecutivo,
          rango_inicial,
          rango_final,
          id_api,
          activa
        FROM Dian_Resoluciones_electronica
        WHERE activa = 1
        ORDER BY id DESC
      `);
      
      console.log(`📊 [DIAN] Resultados en Dian_Resoluciones_electronica: ${result.recordset.length}`);
      
      if (result.recordset.length === 0) {
        console.log('🔍 [DIAN] No se encontró en Dian_Resoluciones_electronica, buscando en Dian_Resoluciones...');
        result = await request.query(`
          SELECT TOP 1 
            id,
            consecutivo,
            rango_inicial,
            rango_final,
            id_api,
            activa
          FROM Dian_Resoluciones
          WHERE activa = 1
          ORDER BY id DESC
        `);
        console.log(`📊 [DIAN] Resultados en Dian_Resoluciones: ${result.recordset.length}`);
      }
      
      if (result.recordset.length === 0) {
        console.error('❌ [DIAN] No se encontró resolución DIAN activa en ninguna tabla');
        throw new Error('No se encontró resolución DIAN activa en la base de datos');
      }
      
      const resolution = result.recordset[0];
      console.log('✅ [DIAN] Resolución DIAN activa encontrada:');
      console.log('   - ID:', resolution.id);
      console.log('   - Consecutivo:', resolution.consecutivo);
      console.log('   - Rango Inicial:', resolution.rango_inicial);
      console.log('   - Rango Final:', resolution.rango_final);
      console.log('   - ID API:', resolution.id_api);
      console.log('   - Activa:', resolution.activa);
      console.log('='.repeat(80) + '\n');
      
      return resolution;
    } catch (error) {
      console.error('❌ [DIAN] Error obteniendo resolución DIAN:', error.message);
      console.error('   Stack:', error.stack);
      console.log('='.repeat(80) + '\n');
      throw error;
    }
  }

  /**
   * Obtiene los parámetros DIAN desde dian_parametros_fe
   * @returns {Promise<Object>} Parámetros DIAN (URL, testSetID, etc.)
   */
  static async getDIANParameters() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 [DIAN] PASO 2: Obteniendo parámetros DIAN');
    console.log('='.repeat(80));
    try {
      const pool = await getConnection();
      const request = pool.request();
      
      console.log('🔍 [DIAN] Buscando parámetros en dian_parametros_fe...');
      const result = await request.query(`
        SELECT TOP 1 *
        FROM dian_parametros_fe
        WHERE activo = 1
        ORDER BY id DESC
      `);
      
      console.log(`📊 [DIAN] Resultados encontrados: ${result.recordset.length}`);
      
      if (result.recordset.length === 0) {
        console.log('⚠️ [DIAN] No se encontraron parámetros en BD, usando valores por defecto');
        const defaultParams = {
          url_base: 'https://facturacionelectronica.mobilsaas.com',
          testSetID: '1',
          isPrueba: false,
          sync: false
        };
        console.log('✅ [DIAN] Parámetros por defecto:', defaultParams);
        console.log('='.repeat(80) + '\n');
        return defaultParams;
      }
      
      const params = result.recordset[0];
      const finalParams = {
        url_base: params.url_base || 'https://facturacionelectronica.mobilsaas.com',
        testSetID: params.testSetID || params.test_set_id || '1',
        isPrueba: params.isPrueba || params.is_prueba || false,
        sync: params.sync || false
      };
      
      console.log('✅ [DIAN] Parámetros DIAN encontrados:');
      console.log('   - URL Base:', finalParams.url_base);
      console.log('   - Test Set ID:', finalParams.testSetID);
      console.log('   - Es Prueba:', finalParams.isPrueba);
      console.log('   - Sync:', finalParams.sync);
      console.log('   - Parámetros completos desde BD:', JSON.stringify(params, null, 2));
      console.log('='.repeat(80) + '\n');
      
      return finalParams;
    } catch (error) {
      console.error('❌ [DIAN] Error obteniendo parámetros DIAN:', error.message);
      console.error('   Stack:', error.stack);
      console.log('⚠️ [DIAN] Usando valores por defecto debido al error');
      const defaultParams = {
        url_base: 'https://facturacionelectronica.mobilsaas.com',
        testSetID: '1',
        isPrueba: false,
        sync: false
      };
      console.log('✅ [DIAN] Parámetros por defecto:', defaultParams);
      console.log('='.repeat(80) + '\n');
      return defaultParams;
    }
  }

  /**
   * Obtiene los datos completos de una factura con sus detalles
   * @param {number} facturaId - ID de la factura
   * @returns {Promise<Object>} Factura completa con detalles y cliente
   */
  static async getFacturaCompleta(facturaId) {
    console.log('\n' + '='.repeat(80));
    console.log('📋 [DIAN] PASO 3: Obteniendo factura completa');
    console.log('='.repeat(80));
    console.log('🔍 [DIAN] Factura ID:', facturaId);
    try {
      const pool = await getConnection();
      
      // Obtener factura
      console.log('🔍 [DIAN] Obteniendo encabezado de factura...');
      const reqFactura = pool.request();
      reqFactura.input('facturaId', sql.Int, facturaId);
      const facturaResult = await reqFactura.query(`
        SELECT *
        FROM ven_facturas
        WHERE id = @facturaId
      `);
      
      if (facturaResult.recordset.length === 0) {
        console.error(`❌ [DIAN] Factura con ID ${facturaId} no encontrada`);
        throw new Error(`Factura con ID ${facturaId} no encontrada`);
      }
      
      const factura = facturaResult.recordset[0];
      console.log('✅ [DIAN] Factura encontrada:');
      console.log('   - ID:', factura.id);
      console.log('   - Número:', factura.numfact || factura.numero_factura);
      console.log('   - Cliente (codter):', factura.codter || factura.cliente_id);
      console.log('   - Total:', factura.netfac || factura.total);
      console.log('   - IVA:', factura.valiva || factura.iva_valor);
      console.log('   - Estado:', factura.estfac || factura.estado);
      
      // Obtener detalles de factura
      console.log('🔍 [DIAN] Obteniendo detalles de factura...');
      const reqDetalles = pool.request();
      reqDetalles.input('facturaId', sql.Int, facturaId);
      
      // Intentar con id_factura primero, luego con campos legacy
      let detallesResult = await reqDetalles.query(`
        SELECT *
        FROM ven_detafact
        WHERE id_factura = @facturaId
      `);
      
      console.log(`📊 [DIAN] Detalles encontrados con id_factura: ${detallesResult.recordset.length}`);
      
      // Si no hay resultados, intentar con campos legacy (numfac, tipfact, codalm)
      if (detallesResult.recordset.length === 0 && factura.numero_factura) {
        console.log('🔍 [DIAN] No se encontraron detalles con id_factura, intentando con campos legacy...');
        const reqDetallesLegacy = pool.request();
        reqDetallesLegacy.input('numfac', sql.VarChar(15), factura.numero_factura);
        reqDetallesLegacy.input('tipfact', sql.Char(2), factura.tipfac || '01');
        reqDetallesLegacy.input('codalm', sql.Char(3), factura.codalm || '001');
        
        detallesResult = await reqDetallesLegacy.query(`
          SELECT *
          FROM ven_detafact
          WHERE numfac = @numfac
            AND (tipfact = @tipfact OR tipfact IS NULL)
            AND codalm = @codalm
        `);
        console.log(`📊 [DIAN] Detalles encontrados con campos legacy: ${detallesResult.recordset.length}`);
      }
      
      // Obtener datos del cliente
      const codterCliente = factura.cliente_id || factura.codter;
      console.log('🔍 [DIAN] Obteniendo datos del cliente (codter):', codterCliente);
      const reqCliente = pool.request();
      reqCliente.input('codter', sql.VarChar(15), codterCliente);
      const clienteResult = await reqCliente.query(`
        SELECT *
        FROM con_terceros
        WHERE codter = @codter
      `);
      
      const cliente = clienteResult.recordset.length > 0 ? clienteResult.recordset[0] : null;
      
      if (cliente) {
        console.log('✅ [DIAN] Cliente encontrado:');
        console.log('   - Código:', cliente.codter);
        console.log('   - Nombre:', cliente.nomter || cliente.nombreCompleto);
        console.log('   - Teléfono:', cliente.TELTER || cliente.telefono || cliente.CELTER || cliente.celular || 'N/A');
        console.log('   - Email:', cliente.EMAIL || cliente.email || 'N/A');
        console.log('   - Dirección:', cliente.dirter || cliente.direccion || 'N/A');
      } else {
        console.warn('⚠️ [DIAN] Cliente no encontrado con codter:', codterCliente);
      }
      
      console.log('✅ [DIAN] Factura completa obtenida:');
      console.log('   - Total detalles:', detallesResult.recordset.length);
      console.log('   - Cliente:', cliente ? 'Encontrado' : 'No encontrado');
      console.log('='.repeat(80) + '\n');
      
      return {
        factura,
        detalles: detallesResult.recordset || [],
        cliente
      };
    } catch (error) {
      console.error('❌ [DIAN] Error obteniendo factura completa:', error.message);
      console.error('   Stack:', error.stack);
      console.log('='.repeat(80) + '\n');
      throw error;
    }
  }

  /**
   * Transforma los datos de una factura al formato JSON requerido por DIAN
   * @param {Object} facturaData - Datos completos de la factura (factura, detalles, cliente)
   * @param {Object} resolution - Resolución DIAN activa
   * @param {Object} config - Configuración (isPrueba, sync, etc.)
   * @param {Object} invoiceData - Datos adicionales opcionales (customer_document, customer_name, etc.)
   * @returns {Promise<Object>} JSON en formato DIAN
   */
  static async transformVenFacturaForDIAN(facturaData, resolution, config = {}, invoiceData = {}) {
    console.log('\n' + '='.repeat(80));
    console.log('📋 [DIAN] PASO 4: Transformando factura al formato DIAN');
    console.log('='.repeat(80));
    
    const { factura: venFactura, detalles, cliente } = facturaData;
    
    // VALIDAR invoiceData: Si tiene trackId, verificar que sea válido
    if (invoiceData && typeof invoiceData === 'object') {
      if ('trackId' in invoiceData) {
        const trackIdType = typeof invoiceData.trackId;
        const isArray = Array.isArray(invoiceData.trackId);
        const isObject = trackIdType === 'object' && invoiceData.trackId !== null;
        
        console.log('🔍 [DIAN] Validando trackId en invoiceData:');
        console.log('   - trackId presente:', 'trackId' in invoiceData);
        console.log('   - trackId valor:', invoiceData.trackId);
        console.log('   - trackId tipo:', trackIdType);
        console.log('   - trackId es array:', isArray);
        console.log('   - trackId es object:', isObject);
        
        if (isArray || isObject) {
          console.error('❌ [DIAN] ERROR: trackId en invoiceData es array u objeto!');
          console.error('   - Eliminando trackId inválido de invoiceData...');
          delete invoiceData.trackId;
        } else if (invoiceData.trackId !== null && invoiceData.trackId !== undefined) {
          // Convertir a string si es válido
          invoiceData.trackId = String(invoiceData.trackId);
          console.log('   - trackId convertido a string:', invoiceData.trackId);
        }
      }
    }
    
    console.log('📊 [DIAN] Datos de entrada:');
    console.log('   - Factura ID:', venFactura.id);
    console.log('   - Número Factura:', venFactura.numfact || venFactura.numero_factura);
    console.log('   - Total detalles:', detalles?.length || 0);
    console.log('   - Cliente:', cliente ? (cliente.nomter || cliente.nombreCompleto || cliente.codter) : 'No encontrado');
    console.log('   - Config:', JSON.stringify(config, null, 2));
    console.log('   - Invoice Data (validado):', JSON.stringify(invoiceData, null, 2));
    
    // Fechas
    const currentDate = new Date();
    const issueDate = currentDate.toISOString().split('T')[0];
    const dueDate = venFactura.fecha_vencimiento 
      ? new Date(venFactura.fecha_vencimiento).toISOString().split('T')[0]
      : issueDate;
    
    console.log('📅 [DIAN] Fechas:');
    console.log('   - Fecha Emisión:', issueDate);
    console.log('   - Fecha Vencimiento:', dueDate);
    
    // Calcular número de factura (consecutivo + 1)
    let invoiceNumber = (resolution.consecutivo || 0) + 1;
    console.log('🔢 [DIAN] Número de factura inicial:', invoiceNumber, '(consecutivo:', resolution.consecutivo, ')');
    
    // Validar que esté en el rango autorizado
    if (resolution.rango_inicial && invoiceNumber < resolution.rango_inicial) {
      console.log('⚠️ [DIAN] Número de factura menor al rango inicial, ajustando a:', resolution.rango_inicial);
      invoiceNumber = resolution.rango_inicial;
    } else if (resolution.rango_final && invoiceNumber > resolution.rango_final) {
      console.log('⚠️ [DIAN] Número de factura mayor al rango final, reiniciando a:', resolution.rango_inicial || 1);
      invoiceNumber = resolution.rango_inicial || 1; // Reinicia si se excede
    }
    console.log('✅ [DIAN] Número de factura final:', invoiceNumber);
    
    // Calcular totales - SIEMPRE usar 19% de IVA
    const ivaPercent = 19; // SIEMPRE 19% según requerimiento
    console.log('💰 [DIAN] Usando IVA fijo: 19%');
    
    // Obtener el subtotal sin IVA desde la base de datos
    const lineExtensionAmount = this.roundCOP(venFactura.valvta || venFactura.subtotal || 0);
    
    // Calcular el IVA sobre el subtotal (19%)
    const taxAmount = this.roundCOP(lineExtensionAmount * (ivaPercent / 100));
    
    // Calcular el total con IVA
    const totalAmount = this.roundCOP(lineExtensionAmount + taxAmount);
    
    console.log('💰 [DIAN] Totales calculados (con IVA 19%):');
    console.log('   - Line Extension Amount (Subtotal SIN IVA):', lineExtensionAmount);
    console.log('   - Tax Amount (IVA 19%):', taxAmount);
    console.log('   - Total Amount (con IVA):', totalAmount);
    
    // Determinar forma de pago
    let paymentFormId = 1; // Efectivo
    let paymentMethodId = 10; // Efectivo
    
    if ((venFactura.tarjetacr || 0) > 0) {
      paymentFormId = 2; // Tarjeta
      paymentMethodId = 48; // Tarjeta débito/crédito
    } else if ((venFactura.Transferencia || venFactura.transferencia || 0) > 0) {
      paymentFormId = 3; // Transferencia
      paymentMethodId = 42; // Transferencia bancaria
    } else if ((venFactura.credito || 0) > 0) {
      paymentFormId = 4; // Crédito
      paymentMethodId = 1; // Crédito
    }
    
    // Construir líneas de factura - SIEMPRE usar 19% de IVA
    let invoiceLines = [];
    
    if (detalles && detalles.length > 0) {
      // Si hay detalles, crear una línea por cada detalle
      invoiceLines = detalles.map((detalle, index) => {
        // Obtener el subtotal sin IVA del detalle
        const detalleLineExtension = this.roundCOP(detalle.subtotal || (detalle.valins || 0) - (detalle.ivains || 0));
        
        // Calcular IVA sobre el subtotal (19%)
        const detalleTaxAmount = this.roundCOP(detalleLineExtension * (ivaPercent / 100));
        
        // Calcular precio unitario sin IVA
        const detalleQuantity = parseFloat(detalle.cantidad || detalle.qtyins || 1);
        const detallePrice = detalleQuantity > 0 ? this.roundCOP(detalleLineExtension / detalleQuantity) : 0;
        
        return {
          unit_measure_id: 70, // Unidad estándar
          invoiced_quantity: detalleQuantity,
          line_extension_amount: detalleLineExtension,
          description: detalle.descripcion || "VENTA DE PRODUCTOS Y SERVICIOS",
          price_amount: detallePrice,
          code: String(detalle.productoId || detalle.codins || (index + 1)),
          type_item_identification_id: 4, // Código interno del vendedor
          base_quantity: detalleQuantity,
          free_of_charge_indicator: false,
          tax_totals: [{
            tax_id: 1,
            tax_amount: detalleTaxAmount,
            taxable_amount: detalleLineExtension,
            percent: ivaPercent // Siempre 19%
          }]
        };
      });
    } else {
      // Factura consolidada (una sola línea)
      invoiceLines = [{
        unit_measure_id: 70,
        invoiced_quantity: 1,
        line_extension_amount: this.roundCOP(lineExtensionAmount),
        description: "VENTA DE PRODUCTOS Y SERVICIOS",
        price_amount: this.roundCOP(lineExtensionAmount),
        code: "1",
        type_item_identification_id: 4,
        base_quantity: 1,
        free_of_charge_indicator: false,
        tax_totals: [{
          tax_id: 1,
          tax_amount: this.roundCOP(taxAmount),
          taxable_amount: this.roundCOP(lineExtensionAmount),
          percent: ivaPercent // Siempre 19%
        }]
      }];
    }
    
    // Datos del cliente
    const customerIdentification = Number(
      invoiceData?.customer_document || 
      cliente?.codter || 
      venFactura.codter || 
      '222222222222'
    );
    
    const customerName = (
      (invoiceData?.customer_name || 
       cliente?.nomter || 
       cliente?.nombreCompleto ||
       "CONSUMIDOR FINAL")
    ).toUpperCase().trim();
    
    // Construir JSON final
    // IMPORTANTE: sync siempre será true según requerimiento
    // Si sync es true, trackId debe ser un string válido
    // CRÍTICO: NO usar undefined, sino NO incluir el campo en absoluto
    const syncValue = true; // Siempre true según requerimiento
    
    // Construir el objeto base SIN trackId - Formato simplificado como test.jsonc
    const dianJson = {
      number: invoiceNumber,
      type_document_id: 1, // Factura de Venta
      identification_number: this.COMPANY_NIT,
      resolution_id: 101, // Por ahora fijo en 101, luego se ajustará desde BD
      sync: true, // Siempre true
      company: {
        identification_number: this.COMPANY_DATA.identification_number,
        name: this.COMPANY_DATA.name,
        type_organization_id: this.COMPANY_DATA.type_organization_id,
        type_document_id: this.COMPANY_DATA.type_document_id,
        id_location: this.COMPANY_DATA.id_location,
        address: this.COMPANY_DATA.address,
        phone: this.COMPANY_DATA.phone,
        email: this.COMPANY_DATA.email
      },
      customer: {
        identification_number: customerIdentification,
        name: customerName,
        type_organization_id: 2, // Persona Natural por defecto
        type_document_id: "13", // Cédula de ciudadanía por defecto
        id_location: cliente?.coddane || cliente?.id_location || "11001",
        address: cliente?.dirter || cliente?.direccion || "BOGOTA D.C.",
        // CRÍTICO: Validar y normalizar teléfono - DIAN requiere al menos 10 dígitos
        phone: (() => {
          let phone = invoiceData?.customer_phone || cliente?.TELTER || cliente?.telefono || cliente?.CELTER || cliente?.celular || "";
          const phoneOriginal = phone;
          console.log('📞 [DIAN] Teléfono original:', phoneOriginal);
          
          // Remover espacios, guiones, paréntesis y otros caracteres no numéricos
          phone = String(phone || "").replace(/[^\d]/g, "");
          console.log('📞 [DIAN] Teléfono después de limpiar:', phone, '(longitud:', phone.length, ')');
          
          // Si el teléfono es muy corto o vacío, usar un teléfono válido por defecto
          // DIAN requiere al menos 10 dígitos para números colombianos
          if (!phone || phone.length < 10) {
            console.log('⚠️ [DIAN] Teléfono muy corto o vacío, usando valor por defecto');
            phone = "3000000000"; // 10 dígitos mínimo
          }
          // Asegurar que tenga al menos 10 dígitos (agregar ceros al inicio si es necesario)
          if (phone.length < 10) {
            console.log('⚠️ [DIAN] Rellenando teléfono con ceros al inicio');
            phone = phone.padStart(10, "0");
          }
          // Limitar a 15 dígitos máximo (formato internacional)
          phone = phone.substring(0, 15);
          console.log('✅ [DIAN] Teléfono final normalizado:', phone, '(longitud:', phone.length, ')');
          return phone;
        })(),
        email: invoiceData?.customer_email || cliente?.EMAIL || cliente?.email || "consumidor@final.com"
      },
      tax_totals: [{
        tax_id: 1,
        tax_amount: this.roundCOP(taxAmount),
        taxable_amount: this.roundCOP(lineExtensionAmount),
        percent: ivaPercent
      }],
      legal_monetary_totals: {
        line_extension_amount: this.roundCOP(lineExtensionAmount),
        tax_exclusive_amount: this.roundCOP(lineExtensionAmount),
        tax_inclusive_amount: this.roundCOP(totalAmount),
        payable_amount: this.roundCOP(totalAmount),
        allowance_total_amount: this.roundCOP(venFactura.valdcto || venFactura.descuento_valor || 0),
        charge_total_amount: 0
      },
      invoice_lines: invoiceLines,
      payment_forms: [{
        payment_form_id: paymentFormId,
        payment_method_id: paymentMethodId,
        payment_due_date: dueDate,
        duration_measure: paymentFormId === 4 ? (venFactura.plazo || 0) : 0 // Días de crédito
      }]
    };
    
    // CRÍTICO: Solo agregar trackId si sync es true
    // NO usar undefined, sino agregar el campo SOLO cuando sea necesario
    // Si sync es false, trackId NO debe estar presente en absoluto
    if (syncValue === true) {
      // Si sync es true, trackId debe ser un string válido
      let trackIdValue = invoiceData?.trackId;
      
      // Si trackId viene en invoiceData, validar que no sea array u objeto
      if (trackIdValue !== undefined && trackIdValue !== null) {
        if (Array.isArray(trackIdValue) || (typeof trackIdValue === 'object' && trackIdValue !== null)) {
          console.warn('⚠️ [DIAN] trackId en invoiceData es array/objeto, generando nuevo trackId');
          trackIdValue = `track-${invoiceNumber}-${Date.now()}`;
        } else {
          trackIdValue = String(trackIdValue);
        }
      } else {
        // Generar un trackId nuevo si no viene
        trackIdValue = `track-${invoiceNumber}-${Date.now()}`;
      }
      
      // Agregar trackId como string válido
      dianJson.trackId = trackIdValue;
      console.log('✅ [DIAN] trackId agregado al JSON (sync: true):', dianJson.trackId, '(tipo:', typeof dianJson.trackId, ')');
    } else {
      // Si sync es false, NO agregar trackId en absoluto
      // Asegurarse de que no exista (por si acaso se agregó antes)
      if ('trackId' in dianJson) {
        delete dianJson.trackId;
        console.log('🔧 [DIAN] trackId eliminado del JSON (sync: false)');
      }
      // Verificar que realmente no exista
      if ('trackId' in dianJson) {
        console.error('❌ [DIAN] ERROR: trackId aún existe después de delete!');
      } else {
        console.log('✅ [DIAN] trackId NO agregado al JSON (sync: false) - Verificado que no existe');
      }
    }
    
    // VERIFICACIÓN FINAL EN LA CONSTRUCCIÓN: Asegurar que trackId no esté presente si sync es false
    if (syncValue === false && 'trackId' in dianJson) {
      console.error('❌❌❌ [DIAN] ERROR CRÍTICO: trackId presente cuando sync es false en construcción del JSON!');
      delete dianJson.trackId;
      console.log('   ✅ trackId eliminado en verificación de construcción');
    }
    
    console.log('✅ [DIAN] JSON DIAN generado exitosamente');
    console.log('📋 [DIAN] Resumen del JSON:');
    console.log('   - Número:', dianJson.number);
    console.log('   - Tipo Documento:', dianJson.type_document_id);
    console.log('   - Resolution ID:', dianJson.resolution_id);
    console.log('   - Sync:', dianJson.sync);
    console.log('   - Cliente ID:', dianJson.customer.identification_number);
    console.log('   - Cliente Nombre:', dianJson.customer.name);
    console.log('   - Cliente Teléfono:', dianJson.customer.phone);
    console.log('   - Cliente Email:', dianJson.customer.email);
    console.log('   - Total Líneas:', dianJson.invoice_lines.length);
    console.log('   - Total a Pagar:', dianJson.legal_monetary_totals.payable_amount);
    console.log('   - IVA Total:', dianJson.tax_totals[0].tax_amount);
    console.log('   - IVA Porcentaje:', dianJson.tax_totals[0].percent, '%');
    console.log('📋 [DIAN] JSON completo:');
    console.log(JSON.stringify(dianJson, null, 2));
    console.log('='.repeat(80) + '\n');
    
    return dianJson;
  }

  /**
   * Envía una factura al endpoint de DIAN
   * @param {Object} invoiceJson - JSON de la factura en formato DIAN
   * @param {string} testSetID - ID del testSet para el endpoint
   * @param {string} baseUrl - URL base del endpoint DIAN
   * @returns {Promise<Object>} Respuesta de DIAN con CUFE y otros datos
   */
  static async sendInvoiceToDIAN(invoiceJson, testSetID, baseUrl = 'https://facturacionelectronica.mobilsaas.com') {
    console.log('\n' + '='.repeat(80));
    console.log('📋 [DIAN] PASO 5: Enviando factura a DIAN');
    console.log('='.repeat(80));
    try {
      // Asegurar que testSetID sea string y no array/objeto
      const testSetIDStr = String(testSetID || '1').trim();
      
      // Validar que invoiceJson.sync sea boolean explícito
      if (invoiceJson.sync !== undefined && typeof invoiceJson.sync !== 'boolean') {
        console.warn('⚠️ [DIAN] sync no es boolean, convirtiendo...');
        invoiceJson.sync = Boolean(invoiceJson.sync);
      }
      
      // VALIDACIÓN CRÍTICA: Asegurar que trackId esté correcto según sync
      // Si sync es false, trackId NO debe estar presente (no debe enviarse)
      // Si sync es true, trackId debe ser un string (no array ni objeto)
      if (invoiceJson.sync === false) {
        // Si sync es false, eliminar trackId completamente del JSON
        if (invoiceJson.trackId !== undefined) {
          console.log('🔧 [DIAN] sync es false, removiendo trackId del JSON (no debe estar presente)');
          delete invoiceJson.trackId;
        }
      } else if (invoiceJson.sync === true) {
        // Si sync es true, trackId debe existir y ser string
        if (invoiceJson.trackId === undefined || invoiceJson.trackId === null) {
          // Generar un trackId si no existe
          invoiceJson.trackId = `track-${invoiceJson.number || Date.now()}-${Date.now()}`;
          console.log('🔧 [DIAN] sync es true, generando trackId:', invoiceJson.trackId);
        } else {
          // Asegurar que trackId sea string (no array ni objeto)
          const trackIdType = typeof invoiceJson.trackId;
          if (Array.isArray(invoiceJson.trackId) || (trackIdType === 'object' && invoiceJson.trackId !== null)) {
            console.error('❌ [DIAN] ERROR: trackId es array u objeto! Convertiendo a string...');
            invoiceJson.trackId = `track-${invoiceJson.number || Date.now()}-${Date.now()}`;
          } else {
            invoiceJson.trackId = String(invoiceJson.trackId);
          }
          console.log('🔧 [DIAN] trackId validado y convertido a string:', invoiceJson.trackId);
        }
      }
      
      // Construir URL completa del endpoint
      const url = `${baseUrl}/api/ubl2.1/invoice/${testSetIDStr}`;
      
      // Preparar headers
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      // VALIDACIÓN FINAL: Verificar que trackId no sea array u objeto
      // Esto es crítico porque la API de DIAN rechaza arrays/objetos en trackId
      if (invoiceJson.trackId !== undefined && invoiceJson.trackId !== null) {
        if (Array.isArray(invoiceJson.trackId) || (typeof invoiceJson.trackId === 'object')) {
          console.error('❌ [DIAN] ERROR CRÍTICO: trackId es array u objeto!');
          console.error('   - trackId tipo:', typeof invoiceJson.trackId);
          console.error('   - trackId es array:', Array.isArray(invoiceJson.trackId));
          console.error('   - trackId valor:', invoiceJson.trackId);
          
          // Si sync es false, simplemente eliminar trackId
          if (invoiceJson.sync === false) {
            console.log('🔧 [DIAN] sync es false, eliminando trackId inválido');
            delete invoiceJson.trackId;
          } else {
            // Si sync es true, generar un nuevo trackId válido
            invoiceJson.trackId = `track-${invoiceJson.number || Date.now()}-${Date.now()}`;
            console.log('🔧 [DIAN] Generando nuevo trackId válido:', invoiceJson.trackId);
          }
        } else {
          // Asegurar que sea string
          invoiceJson.trackId = String(invoiceJson.trackId);
        }
      }
      
      // Log final del JSON antes de serializar
      console.log('\n🔍 [DIAN] VALIDACIÓN FINAL DEL JSON ANTES DE ENVIAR:');
      console.log('   - sync:', invoiceJson.sync, '(tipo:', typeof invoiceJson.sync, ')');
      console.log('   - trackId presente:', invoiceJson.trackId !== undefined);
      console.log('   - trackId en objeto:', 'trackId' in invoiceJson);
      if (invoiceJson.trackId !== undefined) {
        console.log('   - trackId:', invoiceJson.trackId, '(tipo:', typeof invoiceJson.trackId, ')');
        console.log('   - trackId es array:', Array.isArray(invoiceJson.trackId));
        console.log('   - trackId es object:', typeof invoiceJson.trackId === 'object');
        console.log('   - trackId es null:', invoiceJson.trackId === null);
      }
      
      // ELIMINAR trackId SI sync es false (ANTES de crear copia limpia)
      if (invoiceJson.sync === false) {
        if ('trackId' in invoiceJson) {
          console.log('🔧 [DIAN] sync es false - Eliminando trackId del objeto antes de enviar');
          delete invoiceJson.trackId;
          console.log('   ✅ trackId eliminado del objeto');
        }
      }
      
      // Crear una copia limpia del JSON para asegurar que no haya propiedades ocultas
      let cleanJson = JSON.parse(JSON.stringify(invoiceJson));
      
      // ELIMINAR trackId de la copia limpia si sync es false
      if (cleanJson.sync === false) {
        if ('trackId' in cleanJson) {
          console.log('🔧 [DIAN] sync es false - Eliminando trackId de la copia limpia');
          delete cleanJson.trackId;
          console.log('   ✅ trackId eliminado de la copia limpia');
        }
      }
      
      console.log('\n🔍 [DIAN] VERIFICACIÓN EN COPIA LIMPIA:');
      console.log('   - sync:', cleanJson.sync);
      console.log('   - trackId presente:', 'trackId' in cleanJson);
      console.log('   - Claves del objeto:', Object.keys(cleanJson).join(', '));
      
      // Preparar body como JSON string desde la copia limpia
      let bodyString = JSON.stringify(cleanJson);
      
      // VERIFICACIÓN FINAL ABSOLUTA: Buscar trackId en el string JSON
      // Si sync es false, trackId NO debe estar en el string
      if (cleanJson.sync === false) {
        const bodyStringLower = bodyString.toLowerCase();
        if (bodyStringLower.includes('trackid')) {
          console.error('❌ [DIAN] ERROR CRÍTICO: trackId encontrado en string JSON cuando sync es false!');
          console.error('   - Buscando y eliminando trackId del string...');
          
          // Parsear, eliminar trackId, y volver a serializar
          const tempObj = JSON.parse(bodyString);
          delete tempObj.trackId;
          cleanJson = tempObj; // Actualizar la copia limpia
          bodyString = JSON.stringify(tempObj); // Regenerar el string
          
          console.log('   ✅ trackId eliminado del string JSON');
          console.log('   - Verificación final: trackId en string:', bodyString.toLowerCase().includes('trackid') ? 'AÚN EXISTE ❌' : 'ELIMINADO ✅');
        } else {
          console.log('   ✅ Verificación: trackId NO está en el string JSON');
        }
      }
      
      // USAR LA COPIA LIMPIA para todos los logs y el envío
      const finalJson = cleanJson;
      let finalBodyString = bodyString; // let porque puede ser modificado si sync es false
      
      console.log('\n🔗 [DIAN] ========== INFORMACIÓN DE LA PETICIÓN ==========');
      console.log('📡 [DIAN] URL BASE:', baseUrl);
      console.log('🔗 [DIAN] ENDPOINT:', `/api/ubl2.1/invoice/${testSetIDStr}`);
      console.log('🌐 [DIAN] URL COMPLETA:', url);
      console.log('📝 [DIAN] MÉTODO HTTP: POST');
      console.log('📋 [DIAN] TEST SET ID (original):', testSetID);
      console.log('📋 [DIAN] TEST SET ID (normalizado):', testSetIDStr);
      console.log('📋 [DIAN] sync en JSON FINAL:', finalJson.sync, '(tipo:', typeof finalJson.sync, ')');
      console.log('📋 [DIAN] trackId en JSON FINAL:', finalJson.trackId !== undefined ? finalJson.trackId : 'No presente', '(tipo:', finalJson.trackId ? typeof finalJson.trackId : 'N/A', ')');
      console.log('📋 [DIAN] trackId existe en objeto:', 'trackId' in finalJson);
      
      // Sincronizar finalBodyString con bodyString (ya limpiado arriba)
      finalBodyString = bodyString;
      
      console.log('\n📤 [DIAN] ========== HEADERS ENVIADOS ==========');
      console.log(JSON.stringify(headers, null, 2));
      
      console.log('\n📦 [DIAN] ========== BODY ENVIADO (JSON) ==========');
      console.log('📏 [DIAN] Tamaño del body:', bodyString.length, 'caracteres');
      
      // VALIDACIÓN CRÍTICA FINAL: Verificar que NO hay trackId en el string antes de mostrar
      // Parsear el body para inspeccionarlo
      let bodyObjForInspection = null;
      try {
        bodyObjForInspection = JSON.parse(bodyString);
        console.log('📋 [DIAN] Body parseado correctamente para inspección');
        
        // Verificar trackId en el objeto parseado
        if (finalJson.sync === false) {
          if ('trackId' in bodyObjForInspection) {
            console.error('\n❌❌❌ [DIAN] ERROR CRÍTICO: trackId encontrado en objeto parseado cuando sync es false!');
            console.error('   - trackId valor:', bodyObjForInspection.trackId);
            console.error('   - trackId tipo:', typeof bodyObjForInspection.trackId);
            console.error('   - trackId es array:', Array.isArray(bodyObjForInspection.trackId));
            console.error('   - trackId es object:', typeof bodyObjForInspection.trackId === 'object');
            console.error('   - trackId es null:', bodyObjForInspection.trackId === null);
            
            // ELIMINAR trackId del objeto
            delete bodyObjForInspection.trackId;
            
            // Regenerar el body string SIN trackId
            bodyString = JSON.stringify(bodyObjForInspection);
            finalBodyString = bodyString;
            bodyObjForInspection = JSON.parse(bodyString); // Re-parsear para verificar
            
            console.log('   ✅ trackId eliminado del objeto y body regenerado');
            
            // Verificar que realmente se eliminó
            if ('trackId' in bodyObjForInspection) {
              console.error('   ❌ ERROR: trackId AÚN existe después de delete!');
            } else {
              console.log('   ✅ Verificado: trackId NO existe en el objeto regenerado');
            }
          } else {
            console.log('✅ [DIAN] Verificación: trackId NO está en el objeto parseado');
          }
        }
        
        // También verificar en el string
        const trackIdIndex = bodyString.toLowerCase().indexOf('trackid');
        if (trackIdIndex !== -1 && finalJson.sync === false) {
          console.error('\n❌❌❌ [DIAN] ERROR: trackId encontrado en string JSON cuando sync es false!');
          console.error('   - Posición en string:', trackIdIndex);
          console.error('   - Contexto (100 chars antes y después):');
          const contextStart = Math.max(0, trackIdIndex - 100);
          const contextEnd = Math.min(bodyString.length, trackIdIndex + 150);
          console.error(bodyString.substring(contextStart, contextEnd));
          
          // Intentar eliminar usando regex como último recurso
          const cleanedBody = bodyString.replace(/"trackId"\s*:\s*[^,}\]]+,?/gi, '');
          const cleanedBody2 = cleanedBody.replace(/'trackId'\s*:\s*[^,}\]]+,?/gi, '');
          
          if (cleanedBody2.toLowerCase().includes('trackid')) {
            console.error('   ❌ ERROR: No se pudo eliminar trackId del string usando regex');
          } else {
            console.log('   ✅ trackId eliminado del string usando regex');
            bodyString = cleanedBody2;
            finalBodyString = bodyString;
          }
        }
      } catch (e) {
        console.error('❌ [DIAN] Error parseando body para inspección:', e.message);
      }
      
      console.log('📋 [DIAN] Body completo:');
      console.log(bodyString);
      
      // VERIFICACIÓN FINAL FINAL: Buscar trackId en el body string después de todo
      if (finalJson.sync === false) {
        const finalCheck = bodyString.toLowerCase().includes('trackid');
        if (finalCheck) {
          console.error('\n❌❌❌ [DIAN] ERROR CRÍTICO: trackId AÚN presente después de TODAS las eliminaciones!');
          console.error('   Esto NO debería pasar. El body contiene trackId cuando sync es false.');
          console.error('   Body string (primeros 2000 caracteres):', bodyString.substring(0, 2000));
          
          // Último intento: usar un objeto completamente limpio
          try {
            const finalCleanObj = JSON.parse(bodyString);
            delete finalCleanObj.trackId;
            bodyString = JSON.stringify(finalCleanObj);
            finalBodyString = bodyString;
            console.log('   ✅ Último intento: body regenerado completamente sin trackId');
          } catch (e) {
            console.error('   ❌ Error en último intento:', e.message);
          }
        } else {
          console.log('\n✅✅✅ [DIAN] VERIFICACIÓN FINAL: trackId NO está en el body string ✅✅✅');
        }
      }
      
      console.log('\n📊 [DIAN] ========== RESUMEN DEL BODY ==========');
      console.log('   - Número Factura:', finalJson.number);
      console.log('   - Tipo Documento:', finalJson.type_document_id);
      console.log('   - Fecha Emisión:', finalJson.issue_date);
      console.log('   - Fecha Vencimiento:', finalJson.due_date);
      console.log('   - Perfil:', finalJson.profile_id, '(1=Producción, 2=Prueba)');
      console.log('   - Sync:', finalJson.sync);
      console.log('   - trackId presente:', 'trackId' in finalJson);
      console.log('   - Resolución ID:', finalJson.resolution_id);
      console.log('   - Total a Pagar:', finalJson.legal_monetary_totals?.payable_amount);
      console.log('   - Subtotal:', finalJson.legal_monetary_totals?.line_extension_amount);
      console.log('   - IVA Total:', finalJson.tax_totals?.[0]?.tax_amount || 0);
      console.log('   - Total Líneas:', finalJson.invoice_lines?.length || 0);
      
      console.log('\n👤 [DIAN] ========== DATOS DEL CLIENTE ==========');
      console.log('   - Cliente Nombre:', finalJson.customer.name);
      console.log('   - Cliente ID:', finalJson.customer.identification_number);
      console.log('   - Cliente Teléfono:', finalJson.customer.phone);
      console.log('   - Cliente Email:', finalJson.customer.email);
      console.log('   - Cliente Dirección:', finalJson.customer.address || 'N/A');
      
      console.log('\n🏢 [DIAN] ========== DATOS DE LA EMPRESA ==========');
      console.log('   - Empresa NIT:', finalJson.company.identification_number);
      console.log('   - Empresa Nombre:', finalJson.company.name);
      console.log('   - Empresa Dirección:', finalJson.company.address);
      console.log('   - Empresa Teléfono:', finalJson.company.phone);
      console.log('   - Empresa Email:', finalJson.company.email);
      
      console.log('\n📦 [DIAN] ========== LÍNEAS DE FACTURA ==========');
      if (finalJson.invoice_lines && finalJson.invoice_lines.length > 0) {
        finalJson.invoice_lines.forEach((line, index) => {
          console.log(`\n   Línea ${index + 1}:`);
          console.log('     - Código:', line.code);
          console.log('     - Descripción:', line.description);
          console.log('     - Cantidad:', line.invoiced_quantity);
          console.log('     - Precio Unitario:', line.price_amount);
          console.log('     - Subtotal:', line.line_extension_amount);
          console.log('     - IVA:', line.tax_totals?.[0]?.tax_amount || 0);
          console.log('     - IVA %:', line.tax_totals?.[0]?.percent || 0);
        });
      } else {
        console.log('   ⚠️ No hay líneas de factura');
      }
      
      console.log('\n🌐 [DIAN] ========== ENVIANDO PETICIÓN HTTP POST ==========');
      const requestStartTime = Date.now();
      console.log('⏱️ [DIAN] Iniciando petición a las:', new Date().toISOString());
      
      // VERIFICACIÓN FINAL ANTES DE ENVIAR: Asegurar que trackId no esté presente si sync es false
      if (finalJson.sync === false) {
        // Verificar una última vez en el string final
        const hasTrackIdInFinalString = bodyString.toLowerCase().includes('trackid');
        if (hasTrackIdInFinalString) {
          console.error('❌ [DIAN] ERROR CRÍTICO: trackId aún presente en body string final!');
          console.error('   - Eliminando trackId una vez más...');
          try {
            const finalBodyObj = JSON.parse(bodyString);
            delete finalBodyObj.trackId;
            bodyString = JSON.stringify(finalBodyObj);
            finalBodyString = bodyString;
            console.log('   ✅ trackId eliminado definitivamente');
          } catch (e) {
            console.error('   ❌ Error parseando JSON final:', e.message);
          }
        }
      }
      
      console.log('\n📋 [DIAN] VERIFICACIÓN FINAL ANTES DE ENVIAR:');
      console.log('   - sync:', finalJson.sync);
      console.log('   - trackId en objeto:', 'trackId' in finalJson);
      console.log('   - trackId en string FINAL:', bodyString.toLowerCase().includes('trackid') ? 'SÍ ❌' : 'NO ✅');
      console.log('   - Longitud del body:', bodyString.length, 'caracteres');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: bodyString
      });
      
      const requestDuration = Date.now() - requestStartTime;
      console.log('⏱️ [DIAN] Petición completada en:', requestDuration, 'ms');
      console.log('⏱️ [DIAN] Finalizada a las:', new Date().toISOString());
      
      console.log('\n📥 [DIAN] ========== RESPUESTA RECIBIDA ==========');
      console.log('📊 [DIAN] Status HTTP:', response.status, response.statusText);
      console.log('📋 [DIAN] Headers de respuesta:');
      const responseHeaders = Object.fromEntries(response.headers.entries());
      console.log(JSON.stringify(responseHeaders, null, 2));
      
      // Obtener respuesta como texto primero
      const responseText = await response.text();
      console.log('\n📄 [DIAN] ========== BODY DE RESPUESTA (TEXTO) ==========');
      console.log('📏 [DIAN] Tamaño de la respuesta:', responseText.length, 'caracteres');
      console.log('📋 [DIAN] Respuesta completa (texto):');
      console.log(responseText);
      
      if (!response.ok) {
        console.error('\n❌ [DIAN] ========== ERROR EN RESPUESTA HTTP ==========');
        console.error('🚨 [DIAN] La respuesta HTTP indica un error');
        console.error('   - Status Code:', response.status);
        console.error('   - Status Text:', response.statusText);
        console.error('   - URL:', url);
        console.error('   - Test Set ID:', testSetID);
        
        console.error('\n📋 [DIAN] Headers de respuesta (error):');
        console.error(JSON.stringify(responseHeaders, null, 2));
        
        console.error('\n📄 [DIAN] Body de respuesta (error):');
        console.error('   Tamaño:', responseText.length, 'caracteres');
        console.error('   Contenido completo:');
        console.error(responseText);
        
        // Intentar parsear como JSON si es posible
        let errorData = null;
        try {
          errorData = JSON.parse(responseText);
          console.error('\n✅ [DIAN] Error parseado como JSON:');
          console.error(JSON.stringify(errorData, null, 2));
        } catch (e) {
          // Si no es JSON, usar el texto directamente
          errorData = responseText;
          console.error('\n⚠️ [DIAN] Error no es JSON válido:');
          console.error('   - Error de parseo:', e.message);
          console.error('   - Respuesta (texto plano):', errorData);
        }
        
        console.error('\n📋 [DIAN] ========== RESUMEN DEL ERROR ==========');
        console.error('   Status:', response.status, response.statusText);
        console.error('   Error Data:', JSON.stringify(errorData));
        console.error('='.repeat(80) + '\n');
        throw new Error(`DIAN API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }
      
      // Intentar parsear respuesta como JSON
      console.log('\n🔍 [DIAN] ========== PROCESANDO RESPUESTA ==========');
      console.log('🔍 [DIAN] Intentando parsear respuesta como JSON...');
      let responseData = null;
      try {
        responseData = JSON.parse(responseText);
        console.log('✅ [DIAN] Respuesta parseada exitosamente como JSON');
        console.log('📋 [DIAN] Claves principales en la respuesta:', Object.keys(responseData));
      } catch (parseError) {
        console.warn('\n⚠️ [DIAN] ========== RESPUESTA NO ES JSON VÁLIDO ==========');
        console.warn('   - Error de parseo:', parseError.message);
        console.warn('   - Stack:', parseError.stack);
        console.warn('   - Respuesta recibida (primeros 500 caracteres):');
        console.warn(responseText.substring(0, 500));
        console.warn('   - Respuesta completa:');
        console.warn(responseText);
        
        // Si no es JSON, intentar extraer CUFE del texto si es posible
        console.log('\n🔍 [DIAN] Intentando extraer CUFE del texto...');
        const cufeMatch = responseText.match(/CUFE[:\s]+([A-Z0-9-]+)/i) || 
                         responseText.match(/"cufe"\s*:\s*"([^"]+)"/i) ||
                         responseText.match(/"CUFE"\s*:\s*"([^"]+)"/i);
        
        if (cufeMatch) {
          console.log('✅ [DIAN] CUFE extraído del texto:', cufeMatch[1]);
          responseData = { cufe: cufeMatch[1] };
        } else {
          console.error('❌ [DIAN] No se pudo extraer CUFE del texto');
          console.error('   Respuesta completa:', responseText);
          throw new Error(`Respuesta de DIAN no es JSON válido: ${responseText.substring(0, 200)}`);
        }
      }
      
      // Log detallado de la respuesta completa de DIAN
      console.log('\n' + '='.repeat(80));
      console.log('📋 [DIAN] PASO 6: Procesando respuesta de DIAN');
      console.log('='.repeat(80));
      
      console.log('\n✅ [DIAN] ========== RESPUESTA COMPLETA DE DIAN (JSON) ==========');
      console.log('📋 [DIAN] Response Data (raw - JSON completo):');
      console.log(JSON.stringify(responseData, null, 2));
      console.log('📋 [DIAN] Todas las claves en response:', Object.keys(responseData || {}));
      
      // Verificar si la respuesta tiene estructura anidada (response.response)
      const dianResponse = responseData.response || responseData;
      console.log('\n📋 [DIAN] ========== ESTRUCTURA DE RESPUESTA ==========');
      console.log('📋 [DIAN] Verificando estructura anidada (response.response)...');
      if (responseData.response) {
        console.log('✅ [DIAN] Estructura anidada encontrada: response.response');
        console.log('📋 [DIAN] DianResponse (anidado):');
        console.log(JSON.stringify(dianResponse, null, 2));
      } else {
        console.log('✅ [DIAN] Estructura directa (sin anidación)');
        console.log('📋 [DIAN] DianResponse (directo):');
        console.log(JSON.stringify(dianResponse, null, 2));
      }
      console.log('📋 [DIAN] Claves en dianResponse:', dianResponse ? Object.keys(dianResponse) : 'null');
      
      // Verificar statusCode de DIAN (CRÍTICO)
      const statusCode = dianResponse.statusCode || dianResponse.status_code || dianResponse.code || null;
      const isValid = dianResponse.isValid !== undefined ? dianResponse.isValid : null;
      
      console.log('\n🔍 [DIAN] ANÁLISIS DE RESPUESTA DIAN:');
      console.log('   - statusCode:', statusCode, '(tipo:', typeof statusCode, ')');
      console.log('   - isValid:', isValid, '(tipo:', typeof isValid, ')');
      console.log('   - isSuccess (statusCode === "00"):', statusCode === '00');
      console.log('   - isError (statusCode === "99"):', statusCode === '99');
      
      // Extraer campos importantes
      const uuid = dianResponse.uuid || dianResponse.UUID || responseData.uuid || responseData.UUID || null;
      const cufe = dianResponse.cufe || 
                   dianResponse.CUFE || 
                   responseData.cufe ||
                   responseData.CUFE ||
                   uuid ||
                   dianResponse.trackId ||
                   responseData.trackId ||
                   null;
      
      const message = dianResponse.message || dianResponse.Message || dianResponse.error || null;
      const pdfUrl = dianResponse.pdf_url || dianResponse.pdfUrl || dianResponse.pdf || null;
      const xmlUrl = dianResponse.xml_url || dianResponse.xmlUrl || dianResponse.xml || null;
      const qrCode = dianResponse.qr_code || dianResponse.qrCode || dianResponse.qr || null;
      
      console.log('\n📦 [DIAN] CAMPOS EXTRAÍDOS:');
      console.log('   - UUID:', uuid ? `${uuid.substring(0, 20)}... (${uuid.length} chars)` : 'null');
      console.log('   - CUFE:', cufe ? `${cufe.substring(0, 20)}... (${cufe.length} chars)` : 'null');
      console.log('   - Message:', message || 'null');
      console.log('   - PDF URL:', pdfUrl || 'null');
      console.log('   - XML URL:', xmlUrl || 'null');
      console.log('   - QR Code:', qrCode ? 'Presente' : 'null');
      
      // Log adicional si hay estructura response.response
      if (responseData.response && typeof responseData.response === 'object') {
        console.log('\n📋 [DIAN] Estructura response.response encontrada:');
        console.log('   - Claves:', Object.keys(responseData.response));
        console.log('   - Contenido:', JSON.stringify(responseData.response, null, 2));
      }
      
      // Log de toda la respuesta completa para debugging
      console.log('\n📋 [DIAN] RESPUESTA COMPLETA (para debugging):');
      console.log(JSON.stringify(responseData, null, 2));
      
      if (!cufe) {
        console.warn('⚠️ [DIAN] CUFE no encontrado en la respuesta de DIAN');
        console.warn('   Estructura de respuesta completa:', JSON.stringify(responseData, null, 2));
      } else {
        console.log('✅ [DIAN] CUFE extraído exitosamente:', cufe);
      }
      
      // Determinar si fue exitoso basado en statusCode
      const isSuccess = statusCode === '00';
      const isError = statusCode === '99';
      
      console.log('\n📊 [DIAN] RESUMEN DE PROCESAMIENTO:');
      console.log('   - Éxito (statusCode === "00"):', isSuccess);
      console.log('   - Error (statusCode === "99"):', isError);
      console.log('   - CUFE obtenido:', cufe ? 'Sí' : 'No');
      console.log('   - Fecha timbrado:', new Date().toISOString());
      console.log('='.repeat(80) + '\n');
      
      return {
        success: isSuccess && !!cufe,
        status: isSuccess ? 'accepted' : (isError ? 'error' : 'rejected'),
        statusCode: statusCode,
        cufe: cufe,
        uuid: uuid,
        isValid: isValid,
        message: message,
        pdf_url: pdfUrl,
        xml_url: xmlUrl,
        qr_code: qrCode,
        response: responseData,
        dianResponse: dianResponse,
        fechaTimbrado: new Date()
      };
    } catch (error) {
      console.error('\n' + '='.repeat(80));
      console.error('❌ [DIAN] ERROR EN PROCESO DE ENVÍO A DIAN');
      console.error('='.repeat(80));
      console.error('❌ [DIAN] Error enviando factura a DIAN:', error.message);
      console.error('   - URL:', `${baseUrl}/api/ubl2.1/invoice/${testSetID}`);
      console.error('   - Error message:', error.message);
      console.error('   - Error stack:', error.stack);
      console.error('='.repeat(80) + '\n');
      throw error;
    }
  }
}

module.exports = DIANService;

