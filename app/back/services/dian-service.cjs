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
    try {
      const pool = await getConnection();
      const request = pool.request();
      
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
      
      if (result.recordset.length === 0) {
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
      }
      
      if (result.recordset.length === 0) {
        throw new Error('No se encontró resolución DIAN activa en la base de datos');
      }
      
      const resolution = result.recordset[0];
      console.log('✅ Resolución DIAN activa encontrada:', {
        id: resolution.id,
        consecutivo: resolution.consecutivo,
        rango_inicial: resolution.rango_inicial,
        rango_final: resolution.rango_final,
        id_api: resolution.id_api
      });
      
      return resolution;
    } catch (error) {
      console.error('❌ Error obteniendo resolución DIAN:', error);
      throw error;
    }
  }

  /**
   * Obtiene los parámetros DIAN desde dian_parametros_fe
   * @returns {Promise<Object>} Parámetros DIAN (URL, testSetID, etc.)
   */
  static async getDIANParameters() {
    try {
      const pool = await getConnection();
      const request = pool.request();
      
      const result = await request.query(`
        SELECT TOP 1 *
        FROM dian_parametros_fe
        WHERE activo = 1
        ORDER BY id DESC
      `);
      
      if (result.recordset.length === 0) {
        // Valores por defecto si no hay parámetros en BD
        return {
          url_base: 'https://facturacionelectronica.mobilsaas.com',
          testSetID: '1',
          isPrueba: false,
          sync: false
        };
      }
      
      const params = result.recordset[0];
      console.log('✅ Parámetros DIAN encontrados:', {
        url_base: params.url_base,
        testSetID: params.testSetID || params.test_set_id,
        isPrueba: params.isPrueba || params.is_prueba || false,
        sync: params.sync || false
      });
      
      return {
        url_base: params.url_base || 'https://facturacionelectronica.mobilsaas.com',
        testSetID: params.testSetID || params.test_set_id || '1',
        isPrueba: params.isPrueba || params.is_prueba || false,
        sync: params.sync || false
      };
    } catch (error) {
      console.error('❌ Error obteniendo parámetros DIAN:', error);
      // Retornar valores por defecto si hay error
      return {
        url_base: 'https://facturacionelectronica.mobilsaas.com',
        testSetID: '1',
        isPrueba: false,
        sync: false
      };
    }
  }

  /**
   * Obtiene los datos completos de una factura con sus detalles
   * @param {number} facturaId - ID de la factura
   * @returns {Promise<Object>} Factura completa con detalles y cliente
   */
  static async getFacturaCompleta(facturaId) {
    try {
      const pool = await getConnection();
      
      // Obtener factura
      const reqFactura = pool.request();
      reqFactura.input('facturaId', sql.Int, facturaId);
      const facturaResult = await reqFactura.query(`
        SELECT *
        FROM ven_facturas
        WHERE id = @facturaId
      `);
      
      if (facturaResult.recordset.length === 0) {
        throw new Error(`Factura con ID ${facturaId} no encontrada`);
      }
      
      const factura = facturaResult.recordset[0];
      
      // Obtener detalles de factura
      const reqDetalles = pool.request();
      reqDetalles.input('facturaId', sql.Int, facturaId);
      
      // Intentar con id_factura primero, luego con campos legacy
      let detallesResult = await reqDetalles.query(`
        SELECT *
        FROM ven_detafact
        WHERE id_factura = @facturaId
      `);
      
      // Si no hay resultados, intentar con campos legacy (numfac, tipfact, codalm)
      if (detallesResult.recordset.length === 0 && factura.numero_factura) {
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
      }
      
      // Si aún no hay resultados, verificar si la factura tiene items desde la tabla nueva
      // (ven_detafact con factura_id puede no existir si viene de tabla legacy)
      
      // Obtener datos del cliente
      const reqCliente = pool.request();
      reqCliente.input('codter', sql.VarChar(15), factura.cliente_id || factura.codter);
      const clienteResult = await reqCliente.query(`
        SELECT *
        FROM con_terceros
        WHERE codter = @codter
      `);
      
      const cliente = clienteResult.recordset.length > 0 ? clienteResult.recordset[0] : null;
      
      return {
        factura,
        detalles: detallesResult.recordset || [],
        cliente
      };
    } catch (error) {
      console.error('❌ Error obteniendo factura completa:', error);
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
    const { factura: venFactura, detalles, cliente } = facturaData;
    
    // Fechas
    const currentDate = new Date();
    const issueDate = currentDate.toISOString().split('T')[0];
    const dueDate = venFactura.fecha_vencimiento 
      ? new Date(venFactura.fecha_vencimiento).toISOString().split('T')[0]
      : issueDate;
    
    // Calcular número de factura (consecutivo + 1)
    let invoiceNumber = (resolution.consecutivo || 0) + 1;
    
    // Validar que esté en el rango autorizado
    if (resolution.rango_inicial && invoiceNumber < resolution.rango_inicial) {
      invoiceNumber = resolution.rango_inicial;
    } else if (resolution.rango_final && invoiceNumber > resolution.rango_final) {
      invoiceNumber = resolution.rango_inicial || 1; // Reinicia si se excede
    }
    
    // Calcular totales
    const totalAmount = venFactura.netfac || venFactura.valvta || venFactura.total || 0;
    const taxAmount = this.roundCOP(venFactura.valiva || venFactura.iva_valor || 0);
    const lineExtensionAmount = this.roundCOP(totalAmount - taxAmount);
    
    // Calcular porcentaje de IVA
    let ivaPercent = 19; // Por defecto 19%
    if (lineExtensionAmount > 0 && taxAmount > 0) {
      const calculatedPercent = (taxAmount / lineExtensionAmount) * 100;
      
      // Redondear a tarifas estándar de DIAN (19%, 5%, 0%)
      if (calculatedPercent >= 18.5 && calculatedPercent <= 19.5) {
        ivaPercent = 19;
      } else if (calculatedPercent >= 4.5 && calculatedPercent <= 5.5) {
        ivaPercent = 5;
      } else if (calculatedPercent < 0.5) {
        ivaPercent = 0;
      } else {
        ivaPercent = Math.round(calculatedPercent * 100) / 100;
      }
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
        phone: invoiceData?.customer_phone || cliente?.TELTER || cliente?.telefono || "3000000000",
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
    
    console.log('✅ JSON DIAN generado:', JSON.stringify(dianJson, null, 2));
    
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
    try {
      const url = `${baseUrl}/api/ubl2.1/invoice/${testSetID}`;
      
      console.log('📤 Enviando factura a DIAN:', {
        url,
        number: invoiceJson.number,
        testSetID,
        invoiceType: invoiceJson.type_document_id,
        total: invoiceJson.legal_monetary_totals?.payable_amount
      });
      
      console.log('📋 JSON completo a enviar:', JSON.stringify(invoiceJson, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(invoiceJson)
      });
      
      const responseText = await response.text();
      
      if (!response.ok) {
        console.error('❌ Error en respuesta DIAN:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseText
        });
        
        // Intentar parsear como JSON si es posible
        let errorData = null;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          // Si no es JSON, usar el texto directamente
          errorData = responseText;
        }
        
        throw new Error(`DIAN API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }
      
      // Intentar parsear respuesta como JSON
      let responseData = null;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.warn('⚠️ Respuesta de DIAN no es JSON válido:', responseText);
        // Si no es JSON, intentar extraer CUFE del texto si es posible
        const cufeMatch = responseText.match(/CUFE[:\s]+([A-Z0-9-]+)/i) || 
                         responseText.match(/"cufe"\s*:\s*"([^"]+)"/i) ||
                         responseText.match(/"CUFE"\s*:\s*"([^"]+)"/i);
        
        if (cufeMatch) {
          responseData = { cufe: cufeMatch[1] };
        } else {
          throw new Error(`Respuesta de DIAN no es JSON válido: ${responseText.substring(0, 200)}`);
        }
      }
      
      // Log detallado de la respuesta completa de DIAN
      console.log('\n' + '='.repeat(80));
      console.log('✅ RESPUESTA COMPLETA DE DIAN:');
      console.log('='.repeat(80));
      console.log('📋 Status HTTP:', response.status, response.statusText);
      console.log('📋 Headers de respuesta:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
      console.log('📋 Response Data (raw):', JSON.stringify(responseData, null, 2));
      console.log('📋 Todas las claves en response:', Object.keys(responseData || {}));
      
      // Verificar si la respuesta tiene estructura anidada (response.response)
      const dianResponse = responseData.response || responseData;
      console.log('📋 DianResponse (anidado o directo):', JSON.stringify(dianResponse, null, 2));
      console.log('📋 Claves en dianResponse:', dianResponse ? Object.keys(dianResponse) : 'null');
      
      // Verificar statusCode de DIAN (CRÍTICO)
      const statusCode = dianResponse.statusCode || dianResponse.status_code || dianResponse.code || null;
      const isValid = dianResponse.isValid !== undefined ? dianResponse.isValid : null;
      
      console.log('\n🔍 ANÁLISIS DE RESPUESTA DIAN:');
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
      
      console.log('\n📦 CAMPOS EXTRAÍDOS:');
      console.log('   - UUID:', uuid ? `${uuid.substring(0, 20)}... (${uuid.length} chars)` : 'null');
      console.log('   - CUFE:', cufe ? `${cufe.substring(0, 20)}... (${cufe.length} chars)` : 'null');
      console.log('   - Message:', message || 'null');
      console.log('   - PDF URL:', pdfUrl || 'null');
      console.log('   - XML URL:', xmlUrl || 'null');
      console.log('   - QR Code:', qrCode ? 'Presente' : 'null');
      
      // Log adicional si hay estructura response.response
      if (responseData.response && typeof responseData.response === 'object') {
        console.log('\n📋 Estructura response.response encontrada:');
        console.log('   - Claves:', Object.keys(responseData.response));
        console.log('   - Contenido:', JSON.stringify(responseData.response, null, 2));
      }
      
      // Log de toda la respuesta completa para debugging
      console.log('\n📋 RESPUESTA COMPLETA (para debugging):');
      console.log(JSON.stringify(responseData, null, 2));
      console.log('='.repeat(80) + '\n');
      
      if (!cufe) {
        console.warn('⚠️ CUFE no encontrado en la respuesta de DIAN');
        console.warn('   Estructura de respuesta completa:', JSON.stringify(responseData, null, 2));
      } else {
        console.log('✅ CUFE extraído exitosamente:', cufe);
      }
      
      // Determinar si fue exitoso basado en statusCode
      const isSuccess = statusCode === '00';
      const isError = statusCode === '99';
      
      console.log('\n📊 RESUMEN DE PROCESAMIENTO:');
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
      console.error('❌ Error enviando factura a DIAN:', error);
      console.error('   URL:', `${baseUrl}/api/ubl2.1/invoice/${testSetID}`);
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
      throw error;
    }
  }
}

module.exports = DIANService;

