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
    
    console.log('📊 [DIAN] Datos de entrada:');
    console.log('   - Factura ID:', venFactura.id);
    console.log('   - Número Factura:', venFactura.numfact || venFactura.numero_factura);
    console.log('   - Total detalles:', detalles?.length || 0);
    console.log('   - Cliente:', cliente ? (cliente.nomter || cliente.nombreCompleto || cliente.codter) : 'No encontrado');
    console.log('   - Config:', JSON.stringify(config, null, 2));
    console.log('   - Invoice Data:', JSON.stringify(invoiceData, null, 2));
    
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
    
    // Calcular totales
    const totalAmount = venFactura.netfac || venFactura.valvta || venFactura.total || 0;
    const taxAmount = this.roundCOP(venFactura.valiva || venFactura.iva_valor || 0);
    const lineExtensionAmount = this.roundCOP(totalAmount - taxAmount);
    
    console.log('💰 [DIAN] Totales calculados:');
    console.log('   - Total Amount:', totalAmount);
    console.log('   - Tax Amount (IVA):', taxAmount);
    console.log('   - Line Extension Amount (Subtotal):', lineExtensionAmount);
    
    // Calcular porcentaje de IVA
    let ivaPercent = 19; // Por defecto 19%
    if (lineExtensionAmount > 0 && taxAmount > 0) {
      const calculatedPercent = (taxAmount / lineExtensionAmount) * 100;
      console.log('📊 [DIAN] Porcentaje IVA calculado:', calculatedPercent, '%');
      
      // Redondear a tarifas estándar de DIAN (19%, 5%, 0%)
      if (calculatedPercent >= 18.5 && calculatedPercent <= 19.5) {
        ivaPercent = 19;
        console.log('✅ [DIAN] IVA ajustado a 19% (estándar)');
      } else if (calculatedPercent >= 4.5 && calculatedPercent <= 5.5) {
        ivaPercent = 5;
        console.log('✅ [DIAN] IVA ajustado a 5% (reducido)');
      } else if (calculatedPercent < 0.5) {
        ivaPercent = 0;
        console.log('✅ [DIAN] IVA ajustado a 0% (exento)');
      } else {
        ivaPercent = Math.round(calculatedPercent * 100) / 100;
        console.log('✅ [DIAN] IVA usando porcentaje calculado:', ivaPercent, '%');
      }
    } else {
      console.log('⚠️ [DIAN] Usando IVA por defecto 19% (no se pudo calcular)');
    }
    
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
    
    // Construir líneas de factura
    let invoiceLines = [];
    
    if (detalles && detalles.length > 0) {
      // Si hay detalles, crear una línea por cada detalle
      invoiceLines = detalles.map((detalle, index) => {
        const detalleLineExtension = this.roundCOP(detalle.subtotal || (detalle.valins || 0) - (detalle.ivains || 0));
        const detalleTaxAmount = this.roundCOP(detalle.valorIva || detalle.ivains || 0);
        const detallePrice = this.roundCOP(detalle.precioUnitario || detalle.valins || 0);
        const detalleQuantity = parseFloat(detalle.cantidad || detalle.qtyins || 1);
        
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
            percent: ivaPercent
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
          percent: ivaPercent
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
    const dianJson = {
      number: invoiceNumber,
      type_document_id: 1, // Factura de Venta
      identification_number: this.COMPANY_NIT,
      resolution_id: resolution.id_api || resolution.id || 79,
      sync: config?.sync ?? false,
      issue_date: issueDate,
      due_date: dueDate,
      profile_id: config?.isPrueba ? "2" : "1", // 1 = Producción, 2 = Prueba
      profile_execution_id: config?.isPrueba ? "2" : "1",
      scheme_id: config?.isPrueba ? "2" : "1",
      document_currency_code: "COP",
      invoice_type_code: "1",
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
    
    console.log('✅ [DIAN] JSON DIAN generado exitosamente');
    console.log('📋 [DIAN] Resumen del JSON:');
    console.log('   - Número:', dianJson.number);
    console.log('   - Tipo Documento:', dianJson.type_document_id);
    console.log('   - Fecha Emisión:', dianJson.issue_date);
    console.log('   - Fecha Vencimiento:', dianJson.due_date);
    console.log('   - Cliente ID:', dianJson.customer.identification_number);
    console.log('   - Cliente Nombre:', dianJson.customer.name);
    console.log('   - Cliente Teléfono:', dianJson.customer.phone);
    console.log('   - Cliente Email:', dianJson.customer.email);
    console.log('   - Total Líneas:', dianJson.invoice_lines.length);
    console.log('   - Total a Pagar:', dianJson.legal_monetary_totals.payable_amount);
    console.log('   - IVA Total:', dianJson.tax_totals[0].tax_amount);
    console.log('   - Perfil:', dianJson.profile_id, '(1=Producción, 2=Prueba)');
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
      const url = `${baseUrl}/api/ubl2.1/invoice/${testSetID}`;
      
      console.log('📤 [DIAN] Preparando envío a DIAN:');
      console.log('   - URL:', url);
      console.log('   - Número Factura:', invoiceJson.number);
      console.log('   - Test Set ID:', testSetID);
      console.log('   - Tipo Documento:', invoiceJson.type_document_id);
      console.log('   - Total a Pagar:', invoiceJson.legal_monetary_totals?.payable_amount);
      console.log('   - Cliente:', invoiceJson.customer.name);
      console.log('   - Cliente ID:', invoiceJson.customer.identification_number);
      console.log('   - Cliente Teléfono:', invoiceJson.customer.phone);
      console.log('   - Perfil:', invoiceJson.profile_id, '(1=Producción, 2=Prueba)');
      console.log('📋 [DIAN] JSON completo a enviar:');
      console.log(JSON.stringify(invoiceJson, null, 2));
      
      console.log('🌐 [DIAN] Realizando petición HTTP POST...');
      const requestStartTime = Date.now();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(invoiceJson)
      });
      const requestDuration = Date.now() - requestStartTime;
      
      console.log('⏱️ [DIAN] Tiempo de respuesta:', requestDuration, 'ms');
      console.log('📊 [DIAN] Status HTTP:', response.status, response.statusText);
      console.log('📋 [DIAN] Headers de respuesta:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
      
      const responseText = await response.text();
      console.log('📄 [DIAN] Respuesta recibida (texto):', responseText.substring(0, 500), responseText.length > 500 ? '...' : '');
      
      if (!response.ok) {
        console.error('❌ [DIAN] Error en respuesta HTTP:');
        console.error('   - Status:', response.status);
        console.error('   - Status Text:', response.statusText);
        console.error('   - Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
        console.error('   - Body completo:', responseText);
        
        // Intentar parsear como JSON si es posible
        let errorData = null;
        try {
          errorData = JSON.parse(responseText);
          console.error('   - Error parseado (JSON):', JSON.stringify(errorData, null, 2));
        } catch (e) {
          // Si no es JSON, usar el texto directamente
          errorData = responseText;
          console.error('   - Error (texto plano):', errorData);
        }
        
        console.log('='.repeat(80) + '\n');
        throw new Error(`DIAN API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }
      
      // Intentar parsear respuesta como JSON
      console.log('🔍 [DIAN] Intentando parsear respuesta como JSON...');
      let responseData = null;
      try {
        responseData = JSON.parse(responseText);
        console.log('✅ [DIAN] Respuesta parseada exitosamente como JSON');
        console.log('📋 [DIAN] Estructura de respuesta:', Object.keys(responseData));
      } catch (parseError) {
        console.warn('⚠️ [DIAN] Respuesta de DIAN no es JSON válido');
        console.warn('   - Error de parseo:', parseError.message);
        console.warn('   - Respuesta recibida:', responseText.substring(0, 500));
        
        // Si no es JSON, intentar extraer CUFE del texto si es posible
        console.log('🔍 [DIAN] Intentando extraer CUFE del texto...');
        const cufeMatch = responseText.match(/CUFE[:\s]+([A-Z0-9-]+)/i) || 
                         responseText.match(/"cufe"\s*:\s*"([^"]+)"/i) ||
                         responseText.match(/"CUFE"\s*:\s*"([^"]+)"/i);
        
        if (cufeMatch) {
          console.log('✅ [DIAN] CUFE extraído del texto:', cufeMatch[1]);
          responseData = { cufe: cufeMatch[1] };
        } else {
          console.error('❌ [DIAN] No se pudo extraer CUFE del texto');
          throw new Error(`Respuesta de DIAN no es JSON válido: ${responseText.substring(0, 200)}`);
        }
      }
      
      // Log detallado de la respuesta completa de DIAN
      console.log('\n' + '='.repeat(80));
      console.log('📋 [DIAN] PASO 6: Procesando respuesta de DIAN');
      console.log('='.repeat(80));
      console.log('✅ [DIAN] RESPUESTA COMPLETA DE DIAN:');
      console.log('📋 [DIAN] Status HTTP:', response.status, response.statusText);
      console.log('📋 [DIAN] Headers de respuesta:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
      console.log('📋 [DIAN] Response Data (raw):', JSON.stringify(responseData, null, 2));
      console.log('📋 [DIAN] Todas las claves en response:', Object.keys(responseData || {}));
      
      // Verificar si la respuesta tiene estructura anidada (response.response)
      const dianResponse = responseData.response || responseData;
      console.log('📋 [DIAN] DianResponse (anidado o directo):', JSON.stringify(dianResponse, null, 2));
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

