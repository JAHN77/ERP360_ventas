const sql = require('mssql');
const { getConnection } = require('./sqlServerClient.cjs');

/**
 * Servicio para integración con DIAN Facturación Electrónica
 * Transforma facturas de la base de datos al formato JSON requerido por DIAN
 * y envía las facturas al endpoint de DIAN
 */
class DIANService {
  // NIT de la empresa (MULTIACABADOS S.A.S.)
  static COMPANY_NIT = 802024306;
  
  // Datos de la empresa (se obtendrán desde gen_empresa)
  static COMPANY_DATA = {
    identification_number: 802024306, // nitemp de gen_empresa
    name: "", // razemp de gen_empresa - se actualizará dinámicamente
    type_organization_id: 1, // 1 = Persona Jurídica
    type_document_id: "31", // NIT
    id_location: "11001", // Bogotá D.C.
    address: "",
    phone: "",
    email: ""
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
   * Obtiene la resolución DIAN activa desde la base de datos (Base de datos: Prueba_ERP360)
   * @returns {Promise<Object>} Resolución DIAN activa
   */
  static async getDIANResolution() {
    console.log('\n📊 Obteniendo resolución DIAN activa desde la base de datos...');
    console.log('   Base de datos: Prueba_ERP360');
    
    try {
      const pool = await getConnection();
      const request = pool.request();
      
      // Intentar obtener desde Dian_Resoluciones_electronica primero, luego Dian_Resoluciones
      console.log('🔍 Consultando Dian_Resoluciones_electronica...');
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
        console.log('   No encontrada en Dian_Resoluciones_electronica, consultando Dian_Resoluciones...');
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
        console.error('❌ [DIAN] No se encontró resolución DIAN activa en ninguna tabla');
        throw new Error('No se encontró resolución DIAN activa en la base de datos');
      }
      
      const resolution = result.recordset[0];
      console.log('✅ Resolución DIAN activa encontrada:');
      console.log('   - id:', resolution.id);
      console.log('   - consecutivo:', resolution.consecutivo);
      console.log('   - rango_inicial:', resolution.rango_inicial);
      console.log('   - rango_final:', resolution.rango_final);
      console.log('   - id_api:', resolution.id_api);
      console.log('   - activa:', resolution.activa);
      
      return resolution;
    } catch (error) {
      console.error('❌ [DIAN] Error obteniendo resolución DIAN:', error.message);
      console.error('   Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Obtiene los datos de la empresa desde gen_empresa (Base de datos: Prueba_ERP360)
   * @returns {Promise<Object>} Datos de la empresa
   */
  static async getCompanyData() {
    try {
      const pool = await getConnection();
      const request = pool.request();
      
      console.log('🔍 Consultando gen_empresa para obtener datos de la empresa...');
      const result = await request.query(`
        SELECT TOP 1 
          nitemp,
          razemp,
          diremp,
          teleep,
          emailemp,
          codmunicipio
        FROM gen_empresa
        ORDER BY id DESC
      `);
      
      if (result.recordset.length === 0) {
        console.warn('⚠️ [DIAN] No se encontraron datos de empresa en gen_empresa, usando valores por defecto');
        return this.COMPANY_DATA;
      }
      
      const empresa = result.recordset[0];
      console.log('✅ Datos obtenidos de gen_empresa:');
      console.log('   - nitemp:', empresa.nitemp);
      console.log('   - razemp:', empresa.razemp);
      console.log('   - diremp:', empresa.diremp);
      console.log('   - teleep:', empresa.teleep);
      console.log('   - emailemp:', empresa.emailemp);
      console.log('   - codmunicipio:', empresa.codmunicipio);
      
      const companyData = {
        identification_number: Number(empresa.nitemp) || this.COMPANY_NIT,
        name: (empresa.razemp || '').trim().toUpperCase() || 'MULTIACABADOS S.A.S.',
        type_organization_id: 1, // 1 = Persona Jurídica
        type_document_id: "31", // NIT
        id_location: empresa.codmunicipio || "11001", // Código DANE del municipio
        address: (empresa.diremp || '').trim() || '',
        phone: (empresa.teleep || '').replace(/[^\d]/g, '') || '',
        email: (empresa.emailemp || '').trim().toLowerCase() || ''
      };
      
      // Actualizar COMPANY_DATA estático
      this.COMPANY_DATA = companyData;
      this.COMPANY_NIT = companyData.identification_number;
      
      console.log('✅ Datos de empresa procesados y listos para usar');
      return companyData;
    } catch (error) {
      console.error('❌ [DIAN] Error obteniendo datos de empresa desde gen_empresa:', error.message);
      console.error('   Stack:', error.stack);
      return this.COMPANY_DATA;
    }
  }

  /**
   * Obtiene los parámetros DIAN desde dian_parametros_fe (Base de datos: Prueba_ERP360)
   * @returns {Promise<Object>} Parámetros DIAN (URL, testSetID, etc.)
   */
  static async getDIANParameters() {
    console.log('\n📊 Obteniendo parámetros DIAN desde dian_parametros_fe...');
    console.log('   Base de datos: Prueba_ERP360');
    
    try {
      const pool = await getConnection();
      const request = pool.request();
      
      console.log('🔍 Consultando dian_parametros_fe...');
      const result = await request.query(`
        SELECT TOP 1 *
        FROM dian_parametros_fe
        WHERE activo = 1
        ORDER BY id DESC
      `);
      
      if (result.recordset.length === 0) {
        console.warn('⚠️ [DIAN] No se encontraron parámetros en dian_parametros_fe, usando valores por defecto');
        return {
          url_base: 'https://facturacionelectronica.mobilsaas.com',
          testSetID: '1',
          isPrueba: false,
          sync: false
        };
      }
      
      const params = result.recordset[0];
      console.log('✅ Parámetros DIAN encontrados en dian_parametros_fe:');
      console.log('   - url_base:', params.url_base || 'N/A');
      console.log('   - testSetID:', params.testSetID || params.test_set_id || 'N/A');
      console.log('   - isPrueba:', params.isPrueba || params.is_prueba || 'N/A');
      console.log('   - sync:', params.sync || 'N/A');
      
      return {
        url_base: params.url_base || 'https://facturacionelectronica.mobilsaas.com',
        testSetID: params.testSetID || params.test_set_id || '1',
        isPrueba: params.isPrueba || params.is_prueba || false,
        sync: params.sync || false
      };
    } catch (error) {
      console.error('❌ [DIAN] Error obteniendo parámetros DIAN desde dian_parametros_fe:', error.message);
      console.error('   Stack:', error.stack);
      console.warn('   Usando valores por defecto');
      return {
        url_base: 'https://facturacionelectronica.mobilsaas.com',
        testSetID: '1',
        isPrueba: false,
        sync: false
      };
    }
  }

  /**
   * Obtiene los datos completos de una factura con sus detalles (Base de datos: Prueba_ERP360)
   * @param {number} facturaId - ID de la factura
   * @returns {Promise<Object>} Factura completa con detalles y cliente
   */
  static async getFacturaCompleta(facturaId) {
    console.log('\n📊 Obteniendo datos completos de la factura desde la base de datos...');
    console.log('   Base de datos: Prueba_ERP360');
    console.log('   Factura ID:', facturaId);
    
    try {
      const pool = await getConnection();
      
      // Obtener factura desde ven_facturas
      console.log('\n🔍 Consultando ven_facturas para obtener encabezado de factura...');
      const reqFactura = pool.request();
      reqFactura.input('facturaId', sql.Int, facturaId);
      const facturaResult = await reqFactura.query(`
        SELECT *
        FROM ven_facturas
        WHERE id = @facturaId
      `);
      
      if (facturaResult.recordset.length === 0) {
        console.error(`❌ [DIAN] Factura con ID ${facturaId} no encontrada en ven_facturas`);
        throw new Error(`Factura con ID ${facturaId} no encontrada`);
      }
      
      const factura = facturaResult.recordset[0];
      console.log('✅ Factura encontrada en ven_facturas:');
      console.log('   - ID:', factura.id);
      console.log('   - numfact:', factura.numfact || 'N/A');
      console.log('   - codter:', factura.codter || 'N/A');
      console.log('   - valvta:', factura.valvta || 'N/A');
      console.log('   - valiva:', factura.valiva || 'N/A');
      console.log('   - netfac:', factura.netfac || 'N/A');
      console.log('   - valdcto:', factura.valdcto || 'N/A');
      
      // Obtener detalles de factura desde ven_detafact
      console.log('\n🔍 Consultando ven_detafact para obtener detalles de factura...');
      const reqDetalles = pool.request();
      reqDetalles.input('facturaId', sql.Int, facturaId);
      
      // Intentar con id_factura primero, luego con campos legacy
      let detallesResult = await reqDetalles.query(`
        SELECT *
        FROM ven_detafact
        WHERE id_factura = @facturaId
      `);
      
      console.log(`   Detalles encontrados con id_factura: ${detallesResult.recordset.length}`);
      
      // Si no hay resultados, intentar con campos legacy (numfac, tipfact, codalm)
      if (detallesResult.recordset.length === 0 && factura.numero_factura) {
        console.log('   Intentando con campos legacy (numfac, tipfact, codalm)...');
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
        console.log(`   Detalles encontrados con campos legacy: ${detallesResult.recordset.length}`);
      }
      
      if (detallesResult.recordset.length > 0) {
        console.log('✅ Detalles de factura encontrados:');
        detallesResult.recordset.forEach((det, idx) => {
          console.log(`   Línea ${idx + 1}: codins=${det.codins || 'N/A'}, qtyins=${det.qtyins || 'N/A'}, valins=${det.valins || 'N/A'}, ivains=${det.ivains || 'N/A'}`);
        });
      }
      
      // Obtener datos del cliente desde con_terceros
      const codterCliente = factura.cliente_id || factura.codter;
      console.log(`\n🔍 Consultando con_terceros para obtener datos del cliente (codter: ${codterCliente})...`);
      const reqCliente = pool.request();
      reqCliente.input('codter', sql.VarChar(15), codterCliente);
      const clienteResult = await reqCliente.query(`
        SELECT *
        FROM con_terceros
        WHERE codter = @codter
      `);
      
      const cliente = clienteResult.recordset.length > 0 ? clienteResult.recordset[0] : null;
      
      if (cliente) {
        console.log('✅ Cliente encontrado en con_terceros:');
        console.log('   - codter:', cliente.codter);
        console.log('   - nomter:', cliente.nomter);
        console.log('   - tipter:', cliente.tipter);
        console.log('   - Tipo_documento:', cliente.Tipo_documento || cliente.tipo_documento);
        console.log('   - coddane:', cliente.coddane);
        console.log('   - dirter:', cliente.dirter);
        console.log('   - TELTER:', cliente.TELTER);
        console.log('   - EMAIL:', cliente.EMAIL);
      } else {
        console.warn(`⚠️ [DIAN] Cliente no encontrado en con_terceros con codter: ${codterCliente}`);
      }
      
      console.log('\n✅ Datos completos de factura obtenidos exitosamente');
      return {
        factura,
        detalles: detallesResult.recordset || [],
        cliente
      };
    } catch (error) {
      console.error('❌ [DIAN] Error obteniendo factura completa desde la base de datos:', error.message);
      console.error('   Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Imprime un resumen completo de todos los datos que se enviarán a facturar
   * @param {Object} datosFacturacion - Todos los datos de facturación
   */
  static imprimirResumenDatosFacturacion(datosFacturacion) {
    console.log('\n' + '='.repeat(100));
    console.log('📋 RESUMEN COMPLETO DE DATOS A FACTURAR');
    console.log('='.repeat(100));
    
    const {
      factura,
      cliente,
      empresa,
      detalles,
      numeroFactura,
      totales,
      impuestos,
      formasPago,
      configuracion
    } = datosFacturacion;
    
    console.log('\n🔢 INFORMACIÓN DE LA FACTURA:');
    console.log('   - ID Factura:', factura?.id || 'N/A');
    console.log('   - Número Factura (BD):', factura?.numfact || factura?.numeroFactura || 'N/A');
    console.log('   - Número Factura (DIAN):', numeroFactura || 'N/A');
    console.log('   - Fecha Factura:', factura?.fecfac || factura?.fechaFactura || 'N/A');
    console.log('   - Fecha Vencimiento:', factura?.venfac || factura?.fechaVencimiento || 'N/A');
    console.log('   - Tipo Factura:', factura?.tipfac || factura?.tipoFactura || 'N/A');
    console.log('   - Estado:', factura?.estfac || factura?.estado || 'N/A');
    
    console.log('\n💰 TOTALES DE LA FACTURA (desde ven_facturas):');
    console.log('   - Subtotal (valvta):', totales?.subtotal || 'N/A');
    console.log('   - IVA (valiva):', totales?.iva || 'N/A');
    console.log('   - Descuento (valdcto):', totales?.descuento || 'N/A');
    console.log('   - Total (netfac):', totales?.total || 'N/A');
    console.log('   - % IVA Calculado:', impuestos?.porcentaje || 'N/A', '%');
    console.log('   - Código Impuesto:', impuestos?.codigo || 'N/A');
    
    console.log('\n🏢 DATOS DE LA EMPRESA (desde gen_empresa):');
    console.log('   - NIT (nitemp):', empresa?.identification_number || 'N/A');
    console.log('   - Razón Social (razemp):', empresa?.name || 'N/A');
    console.log('   - Dirección (diremp):', empresa?.address || 'N/A');
    console.log('   - Teléfono (teleep):', empresa?.phone || 'N/A');
    console.log('   - Email (emailemp):', empresa?.email || 'N/A');
    console.log('   - Código DANE (codmunicipio):', empresa?.id_location || 'N/A');
    console.log('   - Tipo Organización:', empresa?.type_organization_id || 'N/A', '(1=Jurídica, 2=Natural)');
    console.log('   - Tipo Documento:', empresa?.type_document_id || 'N/A', '(31=NIT)');
    
    console.log('\n👤 DATOS DEL CLIENTE (desde con_terceros):');
    console.log('   - NIT/Documento (codter):', cliente?.codter || 'N/A');
    console.log('   - Nombre (nomter):', cliente?.nomter || 'N/A');
    console.log('   - Tipo Organización (tipter):', cliente?.tipter || 'N/A', '(1=Jurídica, 2=Natural)');
    console.log('   - Tipo Documento (Tipo_documento):', cliente?.Tipo_documento || cliente?.tipo_documento || 'N/A');
    console.log('   - Código DANE (coddane):', cliente?.coddane || 'N/A');
    console.log('   - Dirección (dirter):', cliente?.dirter || 'N/A');
    console.log('   - Teléfono (TELTER):', cliente?.TELTER || 'N/A');
    console.log('   - Celular (CELTER):', cliente?.CELTER || 'N/A');
    console.log('   - Email (EMAIL):', cliente?.EMAIL || 'N/A');
    
    console.log('\n📦 DETALLES DE LA FACTURA (desde ven_detafact):');
    if (detalles && detalles.length > 0) {
      detalles.forEach((det, index) => {
        console.log(`\n   Línea ${index + 1}:`);
        console.log('     - Código Producto (codins):', det.codins || 'N/A');
        console.log('     - Cantidad (qtyins):', det.qtyins || det.cantidad || 'N/A');
        console.log('     - Precio Unitario (valins):', det.valins || det.precioUnitario || 'N/A');
        console.log('     - IVA (ivains):', det.ivains || det.valorIva || 'N/A');
        console.log('     - Descuento (valdescuento):', det.valdescuento || 'N/A');
        console.log('     - Descripción (observa):', det.observa || det.descripcion || 'N/A');
      });
    } else {
      console.log('   ⚠️ No hay detalles de factura');
    }
    
    console.log('\n💳 FORMAS DE PAGO (desde ven_facturas):');
    console.log('   - Efectivo:', formasPago?.efectivo || 'N/A');
    console.log('   - Crédito:', formasPago?.credito || 'N/A');
    console.log('   - Tarjeta:', formasPago?.tarjeta || 'N/A');
    console.log('   - Transferencia:', formasPago?.transferencia || 'N/A');
    console.log('   - Payment Form ID:', formasPago?.formId || 'N/A');
    console.log('   - Payment Method ID:', formasPago?.methodId || 'N/A');
    console.log('   - Plazo (días):', formasPago?.plazo || 'N/A');
    
    console.log('\n⚙️ CONFIGURACIÓN DIAN:');
    console.log('   - Resolución ID:', configuracion?.resolutionId || 'N/A');
    console.log('   - Tipo Documento (Producción/Prueba):', configuracion?.typeDocumentId || 'N/A', '(1=Producción, 2=Prueba)');
    console.log('   - Sync:', configuracion?.sync || 'N/A');
    console.log('   - URL Base:', configuracion?.urlBase || 'N/A');
    console.log('   - Test Set ID:', configuracion?.testSetID || 'N/A');
    
    console.log('\n' + '='.repeat(100));
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
    console.log('\n' + '='.repeat(100));
    console.log('🔄 TRANSFORMANDO FACTURA PARA FACTURACIÓN ELECTRÓNICA DIAN');
    console.log('='.repeat(100));
    
    const { factura: venFactura, detalles, cliente } = facturaData;
    
    // VALIDAR invoiceData: Si tiene trackId, verificar que sea válido
    if (invoiceData && typeof invoiceData === 'object') {
      if ('trackId' in invoiceData) {
        const trackIdType = typeof invoiceData.trackId;
        const isArray = Array.isArray(invoiceData.trackId);
        const isObject = trackIdType === 'object' && invoiceData.trackId !== null;
        
        if (isArray || isObject) {
          console.error('❌ [DIAN] ERROR: trackId en invoiceData es array u objeto! Eliminando...');
          delete invoiceData.trackId;
        } else if (invoiceData.trackId !== null && invoiceData.trackId !== undefined) {
          invoiceData.trackId = String(invoiceData.trackId);
        }
      }
    }
    
    // Fechas
    const currentDate = new Date();
    const issueDate = currentDate.toISOString().split('T')[0];
    const dueDate = venFactura.fecha_vencimiento 
      ? new Date(venFactura.fecha_vencimiento).toISOString().split('T')[0]
      : issueDate;
    
    // Obtener datos de la empresa dinámicamente desde gen_empresa (Base de datos: Prueba_ERP360)
    console.log('\n📊 Obteniendo datos de la empresa desde gen_empresa...');
    const companyData = await this.getCompanyData();
    console.log('✅ Datos de empresa obtenidos:', {
      nitemp: companyData.identification_number,
      razemp: companyData.name,
      diremp: companyData.address,
      teleep: companyData.phone,
      emailemp: companyData.email,
      codmunicipio: companyData.id_location
    });
    
    // Obtener último número de factura desde ven_facturas (Base de datos: Prueba_ERP360)
    console.log('\n📊 Obteniendo último número de factura desde ven_facturas...');
    let invoiceNumber = 80604; // Último número conocido
    try {
      const pool = await getConnection();
      const request = pool.request();
      
      // Buscar el número más alto considerando diferentes formatos
      const maxNumResult = await request.query(`
        SELECT TOP 1 
          numfact,
          CASE 
            WHEN ISNUMERIC(numfact) = 1 THEN CAST(numfact AS INT)
            WHEN numfact LIKE 'FC-%' AND ISNUMERIC(SUBSTRING(numfact, 4, LEN(numfact))) = 1 
              THEN CAST(SUBSTRING(numfact, 4, LEN(numfact)) AS INT)
            ELSE 0
          END as maxNum
        FROM ven_facturas
        WHERE (
          ISNUMERIC(numfact) = 1 OR
          (numfact LIKE 'FC-%' AND ISNUMERIC(SUBSTRING(numfact, 4, LEN(numfact))) = 1)
        )
        ORDER BY 
          CASE 
            WHEN ISNUMERIC(numfact) = 1 THEN CAST(numfact AS INT)
            WHEN numfact LIKE 'FC-%' AND ISNUMERIC(SUBSTRING(numfact, 4, LEN(numfact))) = 1 
              THEN CAST(SUBSTRING(numfact, 4, LEN(numfact)) AS INT)
            ELSE 0
          END DESC
      `);
      
      if (maxNumResult.recordset.length > 0 && maxNumResult.recordset[0].maxNum) {
        const lastNumber = maxNumResult.recordset[0].maxNum;
        const lastNumFact = maxNumResult.recordset[0].numfact;
        console.log(`✅ Última factura encontrada: ${lastNumFact} (número: ${lastNumber})`);
        
        if (lastNumber >= 80604) {
          invoiceNumber = lastNumber + 1;
          console.log(`✅ Nuevo número de factura generado: ${invoiceNumber} (continuando desde ${lastNumber})`);
        } else {
          invoiceNumber = 80605;
          console.log(`⚠️ Último número (${lastNumber}) menor a 80604, usando: ${invoiceNumber}`);
        }
      } else {
        invoiceNumber = 80605;
        console.log(`⚠️ No se encontró número anterior, usando: ${invoiceNumber}`);
      }
    } catch (error) {
      console.warn('⚠️ [DIAN] Error obteniendo último número de factura, usando 80605:', error.message);
      invoiceNumber = 80605;
    }
    
    // Calcular totales usando valvta (sin IVA) y valiva (IVA) desde ven_facturas (Base de datos: Prueba_ERP360)
    console.log('\n💰 Calculando totales desde ven_facturas:');
    const lineExtensionAmount = this.roundCOP(venFactura.valvta || 0); // Total sin impuestos (valvta)
    const taxAmount = this.roundCOP(venFactura.valiva || 0); // Valor total del IVA (valiva)
    const totalAmount = this.roundCOP(lineExtensionAmount + taxAmount); // Total con IVA (valvta + valiva)
    const descuento = this.roundCOP(venFactura.valdcto || venFactura.descuento_valor || 0); // Descuento (valdcto)
    
    console.log('   - valvta (Total sin impuestos):', lineExtensionAmount);
    console.log('   - valiva (IVA):', taxAmount);
    console.log('   - valdcto (Descuento):', descuento);
    console.log('   - netfac (Total):', totalAmount);
    
    // Calcular porcentaje de IVA desde valvta y valiva (Base de datos: Prueba_ERP360)
    console.log('\n📊 Calculando porcentaje de IVA desde valvta y valiva...');
    let ivaPercent = 0; // Por defecto 0%
    if (lineExtensionAmount > 0 && taxAmount > 0) {
      const calculatedPercent = (taxAmount / lineExtensionAmount) * 100;
      console.log(`   Porcentaje calculado: ${calculatedPercent.toFixed(2)}%`);
      
      // Redondear a tarifas estándar de DIAN (19%, 5%, 8%, 0%)
      if (calculatedPercent >= 18.5 && calculatedPercent <= 19.5) {
        ivaPercent = 19;
        console.log('   ✅ IVA ajustado a 19% (estándar)');
      } else if (calculatedPercent >= 7.5 && calculatedPercent <= 8.5) {
        ivaPercent = 8;
        console.log('   ✅ IVA ajustado a 8% (especial)');
      } else if (calculatedPercent >= 4.5 && calculatedPercent <= 5.5) {
        ivaPercent = 5;
        console.log('   ✅ IVA ajustado a 5% (reducido)');
      } else if (calculatedPercent < 0.5) {
        ivaPercent = 0;
        console.log('   ✅ IVA ajustado a 0% (exento)');
      } else {
        ivaPercent = Math.round(calculatedPercent * 100) / 100;
        console.log(`   ✅ IVA usando porcentaje calculado: ${ivaPercent}%`);
      }
    } else {
      console.log('   ⚠️ No se pudo calcular IVA, usando 0%');
    }
    
    // Determinar código de impuesto según el tipo de IVA
    // 01 para IVA, 04 para INC, ZA para IVA e INC, ZZ para no aplica
    let taxCode = "01"; // Por defecto IVA
    if (ivaPercent === 0) {
      taxCode = "ZZ"; // No aplica
      console.log('   ✅ Código de impuesto: ZZ (no aplica)');
    } else if (taxAmount > 0) {
      taxCode = "01"; // IVA
      console.log('   ✅ Código de impuesto: 01 (IVA)');
    }
    
    // Determinar forma de pago desde ven_facturas (Base de datos: Prueba_ERP360)
    console.log('\n💳 Determinando forma de pago desde ven_facturas...');
    console.log('   - efectivo:', venFactura.efectivo || 0);
    console.log('   - credito:', venFactura.credito || 0);
    console.log('   - tarjetacr:', venFactura.tarjetacr || 0);
    console.log('   - Transferencia:', venFactura.Transferencia || venFactura.transferencia || 0);
    console.log('   - plazo:', venFactura.plazo || 0);
    
    let paymentFormId = 1; // 1 = Contado (hardcodeado temporalmente - se obtendrá desde MySQL electronica)
    let paymentMethodId = 10; // 10 = Efectivo (hardcodeado temporalmente - se obtendrá desde MySQL electronica)
    
    if ((venFactura.tarjetacr || 0) > 0) {
      paymentFormId = 2; // Tarjeta
      paymentMethodId = 48; // Tarjeta débito/crédito
      console.log('   ✅ Forma de pago: Tarjeta (Form ID: 2, Method ID: 48)');
    } else if ((venFactura.Transferencia || venFactura.transferencia || 0) > 0) {
      paymentFormId = 3; // Transferencia
      paymentMethodId = 42; // Transferencia bancaria
      console.log('   ✅ Forma de pago: Transferencia (Form ID: 3, Method ID: 42)');
    } else if ((venFactura.credito || 0) > 0) {
      paymentFormId = 4; // Crédito
      paymentMethodId = 1; // Crédito
      console.log(`   ✅ Forma de pago: Crédito (Form ID: 4, Method ID: 1, Plazo: ${venFactura.plazo || 0} días)`);
    } else {
      console.log('   ✅ Forma de pago: Efectivo (Form ID: 1, Method ID: 10)');
    }
    
    // Construir líneas de factura desde ven_detafact (Base de datos: Prueba_ERP360)
    console.log('\n📦 Construyendo líneas de factura desde ven_detafact...');
    console.log(`   Total de detalles encontrados: ${detalles?.length || 0}`);
    
    let invoiceLines = [];
    
    if (detalles && detalles.length > 0) {
      // Si hay detalles, crear una línea por cada detalle desde ven_detafact
      invoiceLines = detalles.map((detalle, index) => {
        console.log(`\n   Procesando línea ${index + 1} desde ven_detafact:`);
        console.log(`     - codins: ${detalle.codins || 'N/A'}`);
        console.log(`     - qtyins: ${detalle.qtyins || detalle.cantidad || 'N/A'}`);
        console.log(`     - valins: ${detalle.valins || detalle.precioUnitario || 'N/A'}`);
        console.log(`     - ivains: ${detalle.ivains || detalle.valorIva || 'N/A'}`);
        console.log(`     - valdescuento: ${detalle.valdescuento || 'N/A'}`);
        console.log(`     - observa: ${detalle.observa || detalle.descripcion || 'N/A'}`);
        
        // Calcular valores desde ven_detafact
        const detalleQuantity = parseFloat(detalle.qtyins || detalle.cantidad || 1);
        const detallePrice = this.roundCOP(detalle.valins || detalle.precioUnitario || 0);
        const detalleTaxAmount = this.roundCOP(detalle.ivains || detalle.valorIva || 0);
        const detalleLineExtension = this.roundCOP((detallePrice * detalleQuantity) - (detalle.valdescuento || 0)); // Precio * cantidad - descuento
        
        // Calcular porcentaje de IVA del detalle
        let detalleIvaPercent = ivaPercent;
        if (detalleLineExtension > 0 && detalleTaxAmount > 0) {
          const calcPercent = (detalleTaxAmount / detalleLineExtension) * 100;
          if (calcPercent >= 18.5 && calcPercent <= 19.5) {
            detalleIvaPercent = 19;
          } else if (calcPercent >= 7.5 && calcPercent <= 8.5) {
            detalleIvaPercent = 8;
          } else if (calcPercent >= 4.5 && calcPercent <= 5.5) {
            detalleIvaPercent = 5;
          } else if (calcPercent < 0.5) {
            detalleIvaPercent = 0;
          } else {
            detalleIvaPercent = Math.round(calcPercent * 100) / 100;
          }
        }
        
        // Determinar código de impuesto para esta línea
        let detalleTaxCode = taxCode;
        if (detalleIvaPercent === 0) {
          detalleTaxCode = "ZZ"; // No aplica
        } else if (detalleTaxAmount > 0) {
          detalleTaxCode = "01"; // IVA
        }
        
        const linea = {
          unit_measure_id: 70, // Hardcodeado temporalmente - se obtendrá desde MySQL electronica
          invoiced_quantity: detalleQuantity, // qtyins desde ven_detafact
          line_extension_amount: detalleLineExtension, // Total de la línea sin impuestos
          description: detalle.observa || detalle.descripcion || "VENTA DE PRODUCTOS Y SERVICIOS", // observa desde ven_detafact
          price_amount: detallePrice, // Precio unitario (valins)
          code: String(detalle.codins || detalle.codProducto || (index + 1)), // codins desde ven_detafact
          type_item_identification_id: 4, // 4 = Código estándar interno (DIAN)
          base_quantity: detalleQuantity, // Cantidad base (generalmente igual a invoiced_quantity)
          free_of_charge_indicator: false, // Si es una línea gratuita
          tax_totals: [{
            tax_id: detalleTaxCode, // 01 para IVA, 04 para INC, ZA para IVA e INC, ZZ para no aplica
            tax_amount: detalleTaxAmount, // ivains desde ven_detafact
            taxable_amount: detalleLineExtension, // Base de cálculo
            percent: detalleIvaPercent // Porcentaje del impuesto
          }]
        };
        
        console.log(`     ✅ Línea ${index + 1} procesada correctamente`);
        return linea;
      });
    } else {
      // Factura consolidada (una sola línea)
      console.log('\n   ⚠️ No se encontraron detalles en ven_detafact, creando línea consolidada');
      invoiceLines = [{
        unit_measure_id: 70, // Hardcodeado temporalmente - se obtendrá desde MySQL electronica
        invoiced_quantity: 1,
        line_extension_amount: this.roundCOP(lineExtensionAmount), // valvta
        description: "VENTA DE PRODUCTOS Y SERVICIOS",
        price_amount: this.roundCOP(lineExtensionAmount), // valvta
        code: "1",
        type_item_identification_id: 4,
        base_quantity: 1,
        free_of_charge_indicator: false,
        tax_totals: [{
          tax_id: taxCode, // 01 para IVA, 04 para INC, ZA para IVA e INC, ZZ para no aplica
          tax_amount: this.roundCOP(taxAmount), // valiva
          taxable_amount: this.roundCOP(lineExtensionAmount), // valvta
          percent: ivaPercent
        }]
      }];
    }
    
    // Datos del cliente desde con_terceros (Base de datos: Prueba_ERP360)
    console.log('\n👤 Procesando datos del cliente desde con_terceros...');
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
    
    // Obtener tipo de documento del cliente desde con_terceros
    const customerTypeDocument = cliente?.Tipo_documento || cliente?.tipo_documento || "13";
    const customerTypeOrganization = cliente?.tipter || 2; // 1 = Jurídica, 2 = Natural
    
    console.log('   ✅ Datos del cliente procesados:');
    console.log('     - identification_number (codter):', customerIdentification);
    console.log('     - name (nomter):', customerName);
    console.log('     - type_organization_id (tipter):', customerTypeOrganization);
    console.log('     - type_document_id (Tipo_documento):', customerTypeDocument);
    console.log('     - id_location (coddane):', cliente?.coddane || 'N/A');
    console.log('     - address (dirter):', cliente?.dirter || 'N/A');
    console.log('     - phone (TELTER):', cliente?.TELTER || 'N/A');
    console.log('     - email (EMAIL):', cliente?.EMAIL || 'N/A');
    
    // Normalizar teléfono del cliente
    const normalizePhone = (phone) => {
      if (!phone) return "3000000000";
      let cleanPhone = String(phone).replace(/[^\d]/g, "");
      if (cleanPhone.length < 10) {
        cleanPhone = cleanPhone.padStart(10, "0");
      }
      return cleanPhone.substring(0, 15);
    };
    
    // Construir JSON final
    // IMPORTANTE: Si sync es false, trackId NO debe incluirse en el JSON (no enviarlo)
    // Si sync es true, trackId debe ser un string válido
    // CRÍTICO: NO usar undefined, sino NO incluir el campo en absoluto
    const syncValue = config?.sync === true; // Asegurar que sea boolean explícito
    
    // Determinar si es producción o prueba
    const isPrueba = config?.isPrueba === true;
    const typeDocumentId = isPrueba ? 2 : 1; // 1 = Producción, 2 = Prueba
    
    // Construir el objeto base SIN trackId - según formato válido del body
    const dianJson = {
      number: invoiceNumber,
      type_document_id: typeDocumentId, // 1 = Producción, 2 = Prueba
      identification_number: companyData.identification_number || this.COMPANY_NIT,
      resolution_id: resolution.id_api || resolution.id || 4, // Temporalmente 4
      sync: syncValue, // Boolean explícito
      company: {
        identification_number: companyData.identification_number || this.COMPANY_NIT,
        name: companyData.name || "MULTIACABADOS S.A.S.",
        type_organization_id: companyData.type_organization_id || 1, // 1 = Persona Jurídica
        type_document_id: companyData.type_document_id || "31", // NIT
        id_location: companyData.id_location || "11001",
        address: companyData.address || "",
        phone: companyData.phone || "",
        email: companyData.email || ""
      },
      customer: {
        identification_number: customerIdentification,
        name: customerName,
        type_organization_id: customerTypeOrganization, // Desde con_terceros.tipter
        type_document_id: customerTypeDocument, // Desde con_terceros.Tipo_documento
        id_location: cliente?.coddane || "11001", // Desde con_terceros.coddane
        address: cliente?.dirter || "BOGOTA D.C.", // Desde con_terceros.dirter
        phone: normalizePhone(invoiceData?.customer_phone || cliente?.TELTER || cliente?.CELTER || ""), // Desde con_terceros.TELTER
        email: invoiceData?.customer_email || cliente?.EMAIL || cliente?.email || "cliente@ejemplo.com" // Desde con_terceros.EMAIL
      },
      tax_totals: [{
        tax_id: taxCode, // 01 para IVA, 04 para INC, ZA para IVA e INC, ZZ para no aplica
        tax_amount: this.roundCOP(taxAmount), // valiva desde ven_facturas
        taxable_amount: this.roundCOP(lineExtensionAmount), // valvta desde ven_facturas
        percent: ivaPercent // Porcentaje calculado desde valiva/valvta
      }],
      legal_monetary_totals: {
        line_extension_amount: this.roundCOP(lineExtensionAmount), // Total sin impuestos (valvta)
        tax_exclusive_amount: this.roundCOP(lineExtensionAmount), // Subtotal antes de IVA (valvta)
        tax_inclusive_amount: this.roundCOP(totalAmount), // Total + impuestos (valvta + valiva)
        payable_amount: this.roundCOP(totalAmount), // Valor final a pagar (valvta + valiva)
        allowance_total_amount: this.roundCOP(venFactura.valdcto || venFactura.descuento_valor || 0), // Descuentos globales
        charge_total_amount: 0 // Cargos globales
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
      console.error('❌ [DIAN] ERROR: trackId presente cuando sync es false en construcción del JSON!');
      delete dianJson.trackId;
    }
    
    // Preparar datos para el resumen
    const datosParaResumen = {
      factura: venFactura,
      cliente: cliente,
      empresa: companyData,
      detalles: detalles,
      numeroFactura: invoiceNumber,
      totales: {
        subtotal: lineExtensionAmount,
        iva: taxAmount,
        descuento: descuento,
        total: totalAmount
      },
      impuestos: {
        porcentaje: ivaPercent,
        codigo: taxCode
      },
      formasPago: {
        efectivo: venFactura.efectivo || 0,
        credito: venFactura.credito || 0,
        tarjeta: venFactura.tarjetacr || 0,
        transferencia: venFactura.Transferencia || venFactura.transferencia || 0,
        formId: paymentFormId,
        methodId: paymentMethodId,
        plazo: venFactura.plazo || 0
      },
      configuracion: {
        resolutionId: resolution.id_api || resolution.id || 4,
        typeDocumentId: typeDocumentId,
        sync: syncValue,
        urlBase: config?.url_base || 'https://facturacionelectronica.mobilsaas.com',
        testSetID: config?.testSetID || '1'
      }
    };
    
    // Imprimir resumen completo de datos a facturar
    this.imprimirResumenDatosFacturacion(datosParaResumen);
    
    // Mostrar JSON final que se enviará
    console.log('\n📤 JSON FINAL QUE SE ENVIARÁ A DIAN:');
    console.log(JSON.stringify(dianJson, null, 2));
    console.log('\n' + '='.repeat(100));
    
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
      // Asegurar que testSetID sea string y no array/objeto
      const testSetIDStr = String(testSetID || '1').trim();
      
      // Validar que invoiceJson.sync sea boolean explícito
      if (invoiceJson.sync !== undefined && typeof invoiceJson.sync !== 'boolean') {
        invoiceJson.sync = Boolean(invoiceJson.sync);
      }
      
      // VALIDACIÓN CRÍTICA: Asegurar que trackId esté correcto según sync
      // Si sync es false, trackId NO debe estar presente (no debe enviarse)
      // Si sync es true, trackId debe ser un string (no array ni objeto)
      if (invoiceJson.sync === false) {
        // Si sync es false, eliminar trackId completamente del JSON
        if (invoiceJson.trackId !== undefined) {
          delete invoiceJson.trackId;
        }
      } else if (invoiceJson.sync === true) {
        // Si sync es true, trackId debe existir y ser string
        if (invoiceJson.trackId === undefined || invoiceJson.trackId === null) {
          invoiceJson.trackId = `track-${invoiceJson.number || Date.now()}-${Date.now()}`;
        } else {
          // Asegurar que trackId sea string (no array ni objeto)
          if (Array.isArray(invoiceJson.trackId) || (typeof invoiceJson.trackId === 'object' && invoiceJson.trackId !== null)) {
            console.error('❌ [DIAN] ERROR: trackId es array u objeto! Generando nuevo...');
            invoiceJson.trackId = `track-${invoiceJson.number || Date.now()}-${Date.now()}`;
          } else {
            invoiceJson.trackId = String(invoiceJson.trackId);
          }
        }
      }
      
      // Construir URL completa del endpoint
      const url = `${baseUrl}/api/ubl2.1/invoice/${testSetIDStr}`;
      
      // Preparar headers
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      // Crear una copia limpia del JSON y eliminar trackId si sync es false
      let cleanJson = JSON.parse(JSON.stringify(invoiceJson));
      if (cleanJson.sync === false && 'trackId' in cleanJson) {
        delete cleanJson.trackId;
      }
      
      // Preparar body como JSON string
      let bodyString = JSON.stringify(cleanJson);
      
      // Verificación final: si sync es false, asegurar que trackId no esté en el string
      if (cleanJson.sync === false && bodyString.toLowerCase().includes('trackid')) {
        console.error('❌ [DIAN] ERROR: trackId encontrado en string JSON cuando sync es false! Eliminando...');
        const tempObj = JSON.parse(bodyString);
        delete tempObj.trackId;
        cleanJson = tempObj;
        bodyString = JSON.stringify(tempObj);
      }
      
      const requestStartTime = Date.now();
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: bodyString
      });
      
      const requestDuration = Date.now() - requestStartTime;
      console.log(`📤 [DIAN] Petición enviada a ${url} (${requestDuration}ms)`);
      
      // Obtener respuesta como texto primero
      const responseText = await response.text();
      
      if (!response.ok) {
        let errorData = null;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = responseText;
        }
        console.error(`❌ [DIAN] Error HTTP ${response.status}:`, errorData);
        throw new Error(`DIAN API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }
      
      // Intentar parsear respuesta como JSON
      let responseData = null;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        // Si no es JSON, intentar extraer CUFE del texto si es posible
        const cufeMatch = responseText.match(/CUFE[:\s]+([A-Z0-9-]+)/i) || 
                         responseText.match(/"cufe"\s*:\s*"([^"]+)"/i) ||
                         responseText.match(/"CUFE"\s*:\s*"([^"]+)"/i);
        
        if (cufeMatch) {
          responseData = { cufe: cufeMatch[1] };
        } else {
          console.error('❌ [DIAN] No se pudo parsear respuesta ni extraer CUFE');
          throw new Error(`Respuesta de DIAN no es JSON válido: ${responseText.substring(0, 200)}`);
        }
      }
      
      // Verificar si la respuesta tiene estructura anidada (response.response)
      const dianResponse = responseData.response || responseData;
      
      // Verificar statusCode de DIAN (CRÍTICO)
      const statusCode = dianResponse.statusCode || dianResponse.status_code || dianResponse.code || null;
      const isValid = dianResponse.isValid !== undefined ? dianResponse.isValid : null;
      
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
      
      if (!cufe) {
        console.warn('⚠️ [DIAN] CUFE no encontrado en la respuesta de DIAN');
      }
      
      // Determinar si fue exitoso basado en statusCode
      const isSuccess = statusCode === '00';
      const isError = statusCode === '99';
      
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
      console.error('❌ [DIAN] Error enviando factura a DIAN:', error.message);
      throw error;
    }
  }
}

module.exports = DIANService;

