const sql = require('mssql');
const { getConnectionForDb } = require('./sqlServerClient.cjs');

/**
 * Servicio para integración con DIAN Facturación Electrónica
 * Transforma facturas de la base de datos al formato JSON requerido por DIAN
 * y envía las facturas al endpoint de DIAN
 */
class DIANService {
  // NIT de la empresa (CICLOLIDER S.A.S.)
  static COMPANY_NIT = 901907454;

  // Datos de la empresa (se obtendrán desde gen_empresa)
  static COMPANY_DATA = {
    identification_number: 901907454, // nitemp de gen_empresa
    name: "", // razemp de gen_empresa - se actualizará dinámicamente
    type_organization_id: 1, // 1 = Persona Jurídica
    type_document_id: "31", // NIT
    id_location: "", // Bogotá D.C.
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
    // Redondear estrictamente a 2 decimales para cumplir requerimientos de DIAN
    // Evita errores like 143.04000000000002 y asegura que 22.8076 se convierta en 22.81
    return Number(parseFloat(amount).toFixed(2));
  }

  /**
   * Obtiene la resolución DIAN activa desde la base de datos
   * @param {string} dbName - Nombre de la base de datos del tenant
   * @returns {Promise<Object>} Resolución DIAN activa
   */
  static async getDIANResolution(dbName = null) {
    console.log(`\n📊 Obteniendo resolución DIAN activa desde la base de datos: ${dbName || 'DEFAULT'}...`);

    try {
      const pool = await getConnectionForDb(dbName);
      const request = pool.request();

      // Consultar desde Dian_Resoluciones_electronica (plural) - Tabla que existe en la BD
      console.log('🔍 Consultando Dian_Resoluciones_electronica...');
      let result;

      // Consultar la tabla plural que sabemos que existe
      try {
        result = await request.query(`
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

        if (result.recordset.length > 0) {
          const resolution = result.recordset[0];
          console.log("------------------reolucion----------------")
          console.log(result)
          console.log(result.recordset[0])

          // Intentar obtener el campo codigo si existe (puede no existir en todas las versiones)
          // Por defecto usar id_api como codigo
          resolution.codigo = resolution.id_api;

          try {
            const codigoResult = await request.query(`
              SELECT TOP 1 codigo
              FROM Dian_Resoluciones_electronica
              WHERE id = ${resolution.id}
            `);

            if (codigoResult.recordset.length > 0 && codigoResult.recordset[0].codigo != null) {
              resolution.codigo = codigoResult.recordset[0].codigo;
              console.log(`   ✅ Campo "codigo" encontrado: ${resolution.codigo}`);
            } else {
              console.log(`   ⚠️ Campo "codigo" es NULL, usando id_api (${resolution.id_api}) como codigo`);
            }
          } catch (codigoError) {
            // Si el campo codigo no existe en la tabla, ya tenemos id_api como valor por defecto
            console.log(`   ⚠️ Campo "codigo" no existe o no está disponible, usando id_api (${resolution.id_api}) como codigo`);
          }
        } else {
          console.log('   ⚠️ No se encontraron registros activos en Dian_Resoluciones_electronica');
        }
      } catch (error) {
        // Si la tabla no existe o hay otro error, intentar con Dian_Resoluciones
        console.log(`   ⚠️ Error consultando Dian_Resoluciones_electronica: ${error.message}`);
        console.log('   Intentando con Dian_Resoluciones como fallback...');
        try {
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

          // Si se encuentra, usar id_api como codigo
          if (result.recordset.length > 0) {
            result.recordset[0].codigo = result.recordset[0].id_api;
            console.log(`   ✅ Resolución encontrada en Dian_Resoluciones, usando id_api (${result.recordset[0].id_api}) como codigo`);
          }
        } catch (fallbackError) {
          console.error('   ❌ Error consultando Dian_Resoluciones:', fallbackError.message);
          throw new Error(`No se pudo consultar ninguna tabla de resoluciones DIAN. Error principal: ${error.message}`);
        }
      }

      if (result.recordset.length === 0) {
        console.error('❌ [DIAN] No se encontró resolución DIAN activa en ninguna tabla');
        throw new Error('No se encontró resolución DIAN activa en la base de datos');
      }

      const resolution = {
        id: 98,
        consecutivo: 'SETP',
        rango_inicial: 90000,
        rango_final: 99000,
        codigo: 98,
        id_api: 98,
        activa: true
      };

      console.log('✅ Resolución DIAN activa (HARDCODED 58):');
      console.log('   - id:', resolution.id);
      console.log('   - consecutivo:', resolution.consecutivo);
      console.log('   - rango_inicial:', resolution.rango_inicial);
      console.log('   - rango_final:', resolution.rango_final);
      console.log('   - codigo:', resolution.codigo);
      console.log('   - activa:', resolution.activa);

      return resolution;
    } catch (error) {
      console.error('❌ [DIAN] Error obteniendo resolución DIAN:', error.message);
      console.error('   Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Obtiene los datos de la empresa desde gen_empresa
   * @param {string} dbName - Nombre de la base de datos del tenant
   * @returns {Promise<Object>} Datos de la empresa
   */
  static async getCompanyData(dbName = null) {
    try {
      const pool = await getConnectionForDb(dbName);
      const request = pool.request();

      console.log('🔍 Consultando gen_empresa para obtener datos de la empresa...');

      // Consultar los campos específicos según la estructura real de la BD
      // Campos reales: nitemp, razemp, diremp, telemp, email, Coddane
      const result = await request.query(`
        SELECT TOP 1 
          nitemp,
          razemp,
          diremp,
          telemp,
          email,
          Coddane,
          Ciuemp
        FROM gen_empresa
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
      console.log('   - telemp:', empresa.telemp);
      console.log('   - email:', empresa.email);
      console.log('   - Coddane:', empresa.Coddane);
      console.log('   - Ciuemp:', empresa.Ciuemp);

      // Extraer solo la parte antes del guión del nitemp (ej: "802024306-1" → "802024306")
      let nitempLimpio = String(empresa.nitemp || '').trim();
      let dvEmpresa = null;
      if (nitempLimpio.includes('-')) {
        const parts = nitempLimpio.split('-');
        nitempLimpio = parts[0].trim();
        dvEmpresa = parseInt(parts[1], 10);
        console.log(`   - nitemp procesado: ${nitempLimpio}, DV explícito: ${dvEmpresa}`);
      }

      // Usar Coddane si existe, sino default
      const codDane = (empresa.Coddane || '').toString().trim() || "11001";

      // Limpiar teléfono: puede venir como "3116853113-3008538958", tomar solo el primero o concatenar
      let telefonoLimpio = String(empresa.telemp || '').trim();
      if (telefonoLimpio.includes('-')) {
        // Si tiene guión, tomar solo el primero o concatenar sin guión
        telefonoLimpio = telefonoLimpio.split('-')[0].trim();
      }
      telefonoLimpio = telefonoLimpio.replace(/[^\d]/g, ''); // Solo números

      const companyData = {
        identification_number: Number(nitempLimpio) || this.COMPANY_NIT,
        dv: dvEmpresa !== null ? dvEmpresa : this.calculateDV(Number(nitempLimpio) || this.COMPANY_NIT),
        name: (empresa.razemp || '').trim().toUpperCase() || 'MULTIACABADOS S.A.S.',
        type_organization_id: 1, // 1 = Persona Jurídica
        type_document_id: "31", // NIT
        id_location: codDane, // Código DANE del municipio
        address: (empresa.diremp || '').trim() || '',
        phone: telefonoLimpio || '',
        email: (empresa.email || '').trim().toLowerCase() || '' // Campo 'email' en BD
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
   * Obtiene los parámetros DIAN desde dian_parametros_fe
   * @param {string} dbName - Nombre de la base de datos del tenant
   * @returns {Promise<Object>} Parámetros DIAN (URL, testSetID, etc.)
   */
  static async getDIANParameters(dbName = null) {
    console.log(`\n📊 Obteniendo parámetros DIAN desde dian_parametros_fe en ${dbName || 'DEFAULT'}...`);

    try {
      const pool = await getConnectionForDb(dbName);
      const request = pool.request();

      console.log('🔍 Consultando dian_parametros_fe...');
      const result = await request.query(`
        SELECT TOP 1 *
        FROM dian_parametros_fe
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
      console.log('   - url_base:', params.urlApi || params.url_base || 'N/A');
      console.log('   - testSetID:', params.dianToken || params.testSetID || params.test_set_id || 'N/A');
      console.log('   - isPrueba:', params.isPrueba || params.is_prueba || 'N/A');
      console.log('   - sync:', params.sync || 'N/A');
      console.log('   - token:', params.token ? 'PRESENTE' : 'N/A');

      return {
        url_base: params.urlApi || params.url_base || 'https://facturacionelectronica.mobilsaas.com',
        testSetID: params.dianToken || params.testSetID || params.test_set_id || '1',
        isPrueba: params.isPrueba || params.is_prueba || false,
        sync: params.sync || false,
        token: params.token || null // Agregamos el token por si se necesita
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
   * Obtiene los datos completos de una factura con sus detalles
   * @param {number} facturaId - ID de la factura
   * @param {string} dbName - Nombre de la base de datos del tenant
   * @returns {Promise<Object>} Factura completa con detalles y cliente
   */
  static async getFacturaCompleta(facturaId, dbName = null) {
    console.log(`\n📊 Obteniendo datos completos de la factura desde la base de datos: ${dbName || 'DEFAULT'}`);
    console.log('   Factura ID:', facturaId);

    try {
      const pool = await getConnectionForDb(dbName);

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
          SELECT d.*, i.referencia, i.undins, i.nomins
          FROM ven_detafact d
          LEFT JOIN inv_insumos i ON LTRIM(RTRIM(i.codins)) = LTRIM(RTRIM(d.codins))
          WHERE d.id_factura = @facturaId
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
          SELECT d.*, i.referencia, i.undins, i.nomins
          FROM ven_detafact d
          LEFT JOIN inv_insumos i ON LTRIM(RTRIM(i.codins)) = LTRIM(RTRIM(d.codins))
          WHERE d.numfac = @numfac
            AND (d.tipfact = @tipfact OR d.tipfact IS NULL)
            AND d.codalm = @codalm
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
   * @param {string} dbName - Nombre de la base de datos del tenant
   * @returns {Promise<Object>} JSON en formato DIAN
   */
  static async transformVenFacturaForDIAN(facturaData, resolution, config = {}, invoiceData = {}, dbName = null) {
    console.log('\n' + '='.repeat(100));
    console.log('🔄 TRANSFORMANDO FACTURA PARA FACTURACIÓN ELECTRÓNICA DIAN');
    console.log('='.repeat(100));

    const { factura: venFactura, detalles, cliente } = facturaData;

    // NOTA: trackId NO se debe enviar - la API de DIAN lo maneja internamente

    // Fechas
    const currentDate = new Date();
    const issueDate = currentDate.toISOString().split('T')[0];
    const dueDate = venFactura.fecha_vencimiento
      ? new Date(venFactura.fecha_vencimiento).toISOString().split('T')[0]
      : issueDate;

    // Obtener datos de la empresa dinámicamente desde gen_empresa
    console.log('\n📊 Obteniendo datos de la empresa desde gen_empresa...');
    const companyData = await this.getCompanyData(dbName);
    console.log('✅ Datos de empresa obtenidos:', {
      nitemp: companyData.identification_number,
      razemp: companyData.name,
      diremp: companyData.address,
      teleep: companyData.phone,
      emailemp: companyData.email,
      codmunicipio: companyData.id_location
    });

    // Obtener número de factura
    // PRIORIDAD 1: Usar el número que YA está guardado en la base de datos (venFactura.numfact)
    // Esto asegura que lo que se envía a la DIAN es exactamente lo que está en el ERP
    console.log('\n📊 Obteniendo número de factura...');
    let invoiceNumber = parseInt(venFactura.numfact);

    if (!isNaN(invoiceNumber) && invoiceNumber > 0) {
      console.log(`✅ Usando número de factura de la BD: ${invoiceNumber}`);
    } else {
      console.warn(`⚠️ [DIAN] numfact en BD ("${venFactura.numfact}") no es válido, intentando calcular...`);

      // Fallback: Calcular basado en el último número (Lógica Descendente)
      try {
        const pool = await getConnectionForDb(dbName);
        const request = pool.request();

        // Buscar el número MÍNIMO existente
        const minNumResult = await request.query(`
          SELECT MIN(CAST(numfact AS BIGINT)) as minNum
          FROM ven_facturas
          WHERE ISNUMERIC(numfact) = 1 
            AND numfact NOT LIKE '%[A-Za-z]%'
            AND CAST(numfact AS BIGINT) > 0
        `);

        if (minNumResult.recordset.length > 0 && minNumResult.recordset[0].minNum) {
          const minNumber = parseInt(minNumResult.recordset[0].minNum);
          console.log(`✅ Factura más baja encontrada en BD: ${minNumber}`);

          // Si encontramos un número, el siguiente es ese menos 1
          invoiceNumber = minNumber - 1;
          console.log(`✅ Nuevo número de factura calculado: ${invoiceNumber} (descendiendo desde ${minNumber})`);
        } else {
          // Si no hay facturas, comenzamos en 89000
          invoiceNumber = 89000;
          console.log(`⚠️ No se encontraron facturas previas, iniciando en: ${invoiceNumber}`);
        }
      } catch (error) {
        console.warn('⚠️ [DIAN] Error calculando número de factura, usando default 89000:', error.message);
        invoiceNumber = 89000;
      }
    }

    // Calcular totales usando valvta (sin IVA) y valiva (IVA) desde ven_facturas (Base de datos: Prueba_ERP360)
    console.log('\n💰 Calculando totales desde ven_facturas:');
    const lineExtensionAmount = this.roundCOP(venFactura.valvta || 0); // Total sin impuestos (valvta)
    let taxAmount = this.roundCOP(venFactura.valiva || 0); // Valor total del IVA (valiva)
    let totalAmount = this.roundCOP(lineExtensionAmount + taxAmount); // Total con IVA (valvta + valiva)
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
    // tax_id debe ser número: 1 para IVA, 4 para INC, etc.
    let taxId = 1; // Por defecto IVA (1 = IVA según formato DIAN)
    if (ivaPercent === 0) {
      taxId = 1; // Mantener 1 incluso si no hay IVA (el percent será 0)
      console.log('   ✅ Código de impuesto: 1 (IVA con 0%)');
    } else if (taxAmount > 0) {
      taxId = 1; // IVA
      console.log('   ✅ Código de impuesto: 1 (IVA)');
    }

    // Determinar forma de pago desde ven_facturas (Base de datos: Prueba_ERP360)
    console.log('\n💳 Determinando forma de pago desde ven_facturas...');

    // Log raw values with types for debugging
    console.log('   📊 Valores RAW:');
    console.log(`     - efectivo: ${venFactura.efectivo} (type: ${typeof venFactura.efectivo})`);
    console.log(`     - credito: ${venFactura.credito} (type: ${typeof venFactura.credito})`);
    console.log(`     - tarjetacr: ${venFactura.tarjetacr} (type: ${typeof venFactura.tarjetacr})`);
    console.log(`     - Transferencia: ${venFactura.Transferencia} (type: ${typeof venFactura.Transferencia})`);
    console.log(`     - plazo: ${venFactura.plazo} (type: ${typeof venFactura.plazo})`);

    // Robust parsing of monetary fields
    const valEfectivo = Math.abs(parseFloat(String(venFactura.efectivo || 0).replace(',', '.'))) || 0;
    const valCredito = Math.abs(parseFloat(String(venFactura.credito || 0).replace(',', '.'))) || 0;
    const valTarjeta = Math.abs(parseFloat(String(venFactura.tarjetacr || 0).replace(',', '.'))) || 0;
    const valTransferencia = Math.abs(parseFloat(String(venFactura.Transferencia || venFactura.transferencia || 0).replace(',', '.'))) || 0;
    const valPlazo = parseInt(String(venFactura.plazo || 0).replace(/\D/g, ''), 10) || 0;

    console.log('   📊 Valores PARSEADOS:');
    console.log(`     - efectivo: ${valEfectivo}`);
    console.log(`     - credito: ${valCredito}`);
    console.log(`     - tarjetacr: ${valTarjeta}`);
    console.log(`     - Transferencia: ${valTransferencia}`);
    console.log(`     - plazo: ${valPlazo} días`);

    let paymentFormId = 1; // 1 = Contado (Defecto)
    let paymentMethodId = 9; // 9 = Efectivo (Actualizado)
    let detectionMethod = 'default';

    // Lógica para determinar el método principal con prioridad
    // 1. Si hay tarjeta > 0
    if (valTarjeta > 0) {
      paymentFormId = 1;
      paymentMethodId = 48; // Tarjeta crédito
      detectionMethod = 'tarjeta (campo tarjetacr > 0)';
      console.log('   ✅ Forma de pago: Tarjeta (Form ID: 1, Method ID: 48)');
    }
    // 2. Si hay transferencia > 0
    else if (valTransferencia > 0) {
      paymentFormId = 1;
      paymentMethodId = 30; // Transferencia Débito Bancaria (Actualizado)
      detectionMethod = 'transferencia (campo Transferencia > 0)';
      console.log('   ✅ Forma de pago: Transferencia (Form ID: 1, Method ID: 30)');
    }
    // 3. Si hay crédito > 0
    // IMPORTANTE: Solo marcar como crédito si valCredito > 0.
    // Si venFactura.credito venía como string "0" o similar, el parseFloat lo manejará.
    else if (valCredito > 0.01) {
      paymentFormId = 2; // Crédito (DIAN ID 2)
      paymentMethodId = 44; // Instrumento no definido (Actualizado)
      detectionMethod = 'credito (campo credito > 0)';
      console.log(`   ✅ Forma de pago: Crédito (Form ID: 2, Method ID: 44, Plazo: ${valPlazo} días)`);
    }
    // 4. HEURÍSTICA: Si tiene plazo > 0, asumir crédito (incluso si campo credito = 0)
    else if (valPlazo > 0) {
      paymentFormId = 2; // Crédito
      paymentMethodId = 44; // Instrumento no definido
      detectionMethod = 'heurística plazo (plazo > 0 indica crédito)';
      console.log(`   ✅ Forma de pago: Crédito (Form ID: 2, Method ID: 44) [Detectado por plazo: ${valPlazo} días]`);
      console.log(`   ⚠️ NOTA: Campo 'credito' era ${valCredito}, pero plazo > 0 indica que es factura a crédito`);
    } else {
      detectionMethod = 'efectivo (default, ningún otro método detectado)';
      console.log('   ✅ Forma de pago: Efectivo (Form ID: 1, Method ID: 9)');
    }

    console.log(`   🔍 Método de detección usado: ${detectionMethod}`);

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
        let detalleTaxAmount = this.roundCOP(detalle.ivains || detalle.valorIva || 0);
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

        // RECALCULO FORZADO DE IVA LÍNEA PARA PRECISIÓN (Evitar 23 vs 22.81)
        // Si tenemos un porcentaje válido, recalculamos el monto exacto
        if (detalleLineExtension > 0 && detalleIvaPercent > 0) {
          const recalculatedTax = this.roundCOP(detalleLineExtension * (detalleIvaPercent / 100));
          // Si la diferencia sugiere error de redondeo (ej. 23 vs 22.81), usamos el calculado
          if (Math.abs(recalculatedTax - detalleTaxAmount) < 1) {
            console.log(`     ⚠️ Ajustando IVA línea por precisión: ${detalleTaxAmount} -> ${recalculatedTax}`);
            detalleTaxAmount = recalculatedTax;
          }
        }

        // Determinar código de impuesto para esta línea (debe ser número)
        let detalleTaxId = 1; // Por defecto IVA (1 = IVA según formato DIAN)
        if (detalleTaxAmount > 0) {
          detalleTaxId = 1; // IVA
        }

        // Determinar unidad de medida DIAN
        const unitMeasure = this.resolveUnitMeasureId(detalle, index + 1);

        const linea = {
          unit_measure_id: Number(unitMeasure.id),
          unit_measure: String(unitMeasure.name),
          invoiced_quantity: Number(detalleQuantity), // qtyins desde ven_detafact (número)
          line_extension_amount: Number(detalleLineExtension), // Total de la línea sin impuestos (número)
          description: String(detalle.observa || detalle.nomins || detalle.descripcion || "VENTA DE PRODUCTOS Y SERVICIOS").trim(), // observa desde ven_detafact (string)
          price_amount: Number(detallePrice), // Precio unitario (valins) (número)
          // PRIORIDAD: referencia > codins > index
          code: String(detalle.referencia || detalle.codins || detalle.codProducto || (index + 1)).trim(),
          type_item_identification_id: Number(4), // 4 = Código estándar interno (DIAN) (número)
          base_quantity: Number(detalleQuantity), // Cantidad base (generalmente igual a invoiced_quantity) (número)
          free_of_charge_indicator: Boolean(false), // Si es una línea gratuita (boolean)
          tax_totals: [{
            tax_id: Number(detalleTaxId), // 1 para IVA (número, no string)
            tax_amount: Number(detalleTaxAmount), // ivains desde ven_detafact (número)
            taxable_amount: Number(detalleLineExtension), // Base de cálculo (número)
            percent: Number(detalleIvaPercent) // Porcentaje del impuesto (número)
          }]
        };

        console.log(`     ✅ Línea ${index + 1} procesada correctamente`);
        return linea;
      });

      // CRÍTICO: Validar y ajustar que la suma de IVAs de líneas coincida EXACTAMENTE con el IVA total
      console.log('\n🔍 VALIDANDO CONSISTENCIA DE TOTALES: Verificando que IVAs de líneas sumen exactamente el IVA total...');
      const sumaIvasLineas = invoiceLines.reduce((suma, linea) => {
        const ivaLinea = linea.tax_totals?.[0]?.tax_amount || 0;
        return this.roundCOP(suma + ivaLinea);
      }, 0);
      const sumaSubtotalesLineas = invoiceLines.reduce((suma, linea) => {
        return this.roundCOP(suma + (linea.line_extension_amount || 0));
      }, 0);

      // MODIFICACIÓN: En lugar de ajustar la línea para coincidir con la BD (que puede estar redondeada mal),
      // Ajustamos el TOTAL GLOBAL para coincidir con la suma precisa de las líneas.
      console.log(`   - IVA Total Original (BD): ${taxAmount}`);
      console.log(`   - Suma IVAs Líneas (Recalculado): ${sumaIvasLineas}`);

      if (Math.abs(taxAmount - sumaIvasLineas) > 0.001) {
        console.log(`   ⚠️ Diferencia en totales IVA detectada. Actualizando taxAmount global para coincidir con líneas precisas.`);
        taxAmount = sumaIvasLineas;
        // También actualizar el total con impuestos
        totalAmount = this.roundCOP(lineExtensionAmount + taxAmount);
        console.log(`   ✅ Nuevo taxAmount: ${taxAmount}`);
        console.log(`   ✅ Nuevo totalAmount: ${totalAmount}`);
      }

      console.log(`   - Diferencia IVA Final: ${this.roundCOP(Math.abs(taxAmount - sumaIvasLineas))}`);
      console.log(`   - Subtotal Total (ven_facturas.valvta): ${lineExtensionAmount}`);
      console.log(`   - Suma Subtotales Líneas: ${sumaSubtotalesLineas}`);
      console.log(`   - Diferencia Subtotal: ${this.roundCOP(Math.abs(lineExtensionAmount - sumaSubtotalesLineas))}`);

      // Ajustar IVAs si hay diferencia (CRÍTICO: La DIAN rechaza si no coinciden exactamente)
      const diferenciaIva = this.roundCOP(taxAmount - sumaIvasLineas);
      // Solo ajustamos si AÚN hay diferencia (no debería haber si hicimos la corrección arriba)
      if (Math.abs(diferenciaIva) > 0.001) {
        console.log(`   ⚠️ ADVERTENCIA: Diferencia detectada en IVAs (${diferenciaIva}). Ajustando última línea...`);
        // ... Logica de ajuste de línea si fuera necesario (backup) ...
        if (invoiceLines.length > 0) {
          const ultimaLinea = invoiceLines[invoiceLines.length - 1];
          const ivaAnterior = ultimaLinea.tax_totals[0].tax_amount || 0;
          const ivaAjustado = this.roundCOP(ivaAnterior + diferenciaIva);
          ultimaLinea.tax_totals[0].tax_amount = Number(ivaAjustado);
        }
      }

      // Ajustar subtotales si hay diferencia
      const diferenciaSubtotal = this.roundCOP(lineExtensionAmount - sumaSubtotalesLineas);
      if (Math.abs(diferenciaSubtotal) > 0.001) {
        console.log(`   ⚠️ ADVERTENCIA: Diferencia detectada en subtotales (${diferenciaSubtotal}). Ajustando última línea...`);

        if (invoiceLines.length > 0) {
          const ultimaLinea = invoiceLines[invoiceLines.length - 1];
          const subtotalAnterior = ultimaLinea.line_extension_amount || 0;
          const subtotalAjustado = this.roundCOP(subtotalAnterior + diferenciaSubtotal);

          console.log(`   - Subtotal anterior última línea: ${subtotalAnterior}`);
          console.log(`   - Subtotal ajustado última línea: ${subtotalAjustado}`);

          // Ajustar subtotal y valores relacionados
          ultimaLinea.line_extension_amount = Number(subtotalAjustado);
          ultimaLinea.tax_totals[0].taxable_amount = Number(subtotalAjustado);

          // Recalcular price_amount si es necesario
          if (ultimaLinea.invoiced_quantity > 0) {
            ultimaLinea.price_amount = Number(this.roundCOP(subtotalAjustado / ultimaLinea.invoiced_quantity));
          }

          console.log(`   ✅ Subtotal de última línea ajustado para que totales cuadren exactamente`);
        }
      }

      // Validación final
      const sumaFinalIvas = invoiceLines.reduce((suma, linea) => {
        return this.roundCOP(suma + (linea.tax_totals?.[0]?.tax_amount || 0));
      }, 0);
      const sumaFinalSubtotales = invoiceLines.reduce((suma, linea) => {
        return this.roundCOP(suma + (linea.line_extension_amount || 0));
      }, 0);

      if (Math.abs(taxAmount - sumaFinalIvas) <= 0.001 && Math.abs(lineExtensionAmount - sumaFinalSubtotales) <= 0.001) {
        console.log(`   ✅ VALIDACIÓN EXITOSA: Totales cuadran exactamente`);
        console.log(`     - IVA Total: ${taxAmount} = Suma Líneas: ${sumaFinalIvas}`);
        console.log(`     - Subtotal Total: ${lineExtensionAmount} = Suma Líneas: ${sumaFinalSubtotales}`);
      } else {
        console.error(`   ❌ ERROR CRÍTICO: Totales aún no cuadran después del ajuste`);
        console.error(`     - IVA: ${taxAmount} vs ${sumaFinalIvas} (diferencia: ${this.roundCOP(taxAmount - sumaFinalIvas)})`);
        console.error(`     - Subtotal: ${lineExtensionAmount} vs ${sumaFinalSubtotales} (diferencia: ${this.roundCOP(lineExtensionAmount - sumaFinalSubtotales)})`);
      }
    } else {
      // Factura consolidada (una sola línea)
      console.log('\n   ⚠️ No se encontraron detalles en ven_detafact, creando línea consolidada');
      invoiceLines = [{
        unit_measure_id: Number(70), // Hardcodeado temporalmente - se obtendrá desde MySQL electronica (número)
        invoiced_quantity: Number(1), // Número explícito
        line_extension_amount: Number(this.roundCOP(lineExtensionAmount)), // valvta (número)
        description: String("VENTA DE PRODUCTOS Y SERVICIOS").trim(), // String explícito
        price_amount: Number(this.roundCOP(lineExtensionAmount)), // valvta (número)
        code: String("1").trim(), // String explícito
        type_item_identification_id: Number(4), // Número explícito
        base_quantity: Number(1), // Número explícito
        free_of_charge_indicator: Boolean(false), // Boolean explícito
        tax_totals: [{
          tax_id: Number(taxId), // 1 para IVA (número, no string)
          tax_amount: Number(this.roundCOP(taxAmount)), // valiva (número)
          taxable_amount: Number(this.roundCOP(lineExtensionAmount)), // valvta (número)
          percent: Number(ivaPercent) // Porcentaje (número)
        }]
      }];

      // Para factura consolidada, los totales ya están correctos
      console.log('\n✅ Factura consolidada: Totales ya coinciden (una sola línea)');
    }

    // Datos del cliente desde con_terceros (Base de datos: Prueba_ERP360)
    console.log('\n👤 Procesando datos del cliente desde con_terceros...');

    // Extraer solo la parte numérica del codter (antes del guión si existe) y el DV
    const codterRaw = invoiceData?.customer_document || cliente?.codter || venFactura.codter || '222222222222';
    let codterLimpio = String(codterRaw || '').trim();
    let customerDv = null;

    if (codterLimpio.includes('-')) {
      const parts = codterLimpio.split('-');
      codterLimpio = parts[0].trim();
      // Intentar obtener DV explícito si es numérico
      if (parts[1] && !isNaN(parseInt(parts[1]))) {
        customerDv = parseInt(parts[1], 10);
        console.log(`   ✅ DV del cliente extraído explícitamente: ${customerDv}`);
      }
    }
    // Remover cualquier carácter no numérico que pueda quedar
    codterLimpio = codterLimpio.replace(/[^\d]/g, '');
    const customerIdentification = Number(codterLimpio) || 222222222222;

    // Obtener tipo de documento del cliente ANTES de calcular DV
    const customerTypeDocument = cliente?.Tipo_documento || cliente?.tipo_documento || "13";

    // Si no se extrajo DV explícito, calcularlo solo si es NIT (31)
    if (customerDv === null) {
      if (customerTypeDocument === "31" || customerTypeDocument === 31) {
        customerDv = this.calculateDV(customerIdentification);
        console.log(`   ✅ DV del cliente calculado (NIT): ${customerDv}`);
      } else {
        customerDv = 0; // Para no-NITs, DV es 0
        console.log(`   ℹ️ Tipo documento ${customerTypeDocument} no requiere DV, usando 0`);
      }
    }


    const customerName = (
      (invoiceData?.customer_name ||
        cliente?.nomter ||
        cliente?.nombreCompleto ||
        "CONSUMIDOR FINAL")
    ).toUpperCase().trim();

    // El customerTypeDocument ya está declarado arriba, solo necesitamos customerTypeOrganization
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
    // CRÍTICO: trackId NO debe incluirse en el JSON - la API de DIAN lo maneja internamente
    const syncValue = config?.sync === true; // Asegurar que sea boolean explícito

    // Determinar si es producción o prueba
    const isPrueba = config?.isPrueba === true;
    const typeDocumentId = isPrueba ? 2 : 1; // 1 = Producción, 2 = Prueba

    // CRÍTICO: Recalcular totales desde las líneas ajustadas para garantizar consistencia exacta
    console.log('\n📊 Recalculando totales finales desde las líneas ajustadas...');
    const taxAmountFinal = invoiceLines.reduce((suma, linea) => {
      return this.roundCOP(suma + (linea.tax_totals?.[0]?.tax_amount || 0));
    }, 0);
    const lineExtensionAmountFinal = invoiceLines.reduce((suma, linea) => {
      return this.roundCOP(suma + (linea.line_extension_amount || 0));
    }, 0);
    const totalAmountFinal = this.roundCOP(lineExtensionAmountFinal + taxAmountFinal);

    console.log(`   ✅ Totales finales recalculados desde líneas:`);
    console.log(`     - IVA Total: ${taxAmountFinal}`);
    console.log(`     - Subtotal Total: ${lineExtensionAmountFinal}`);
    console.log(`     - Total: ${totalAmountFinal}`);

    // Construir el objeto base SIN trackId - según formato válido del body
    // Asegurar tipos correctos: números como números, strings como strings
    const dianJson = {
      number: Number(invoiceNumber), // Número explícito
      exact_decimals: true, // Mantener precisión decimal exacta
      type_document_id: Number(typeDocumentId), // 1 = Producción, 2 = Prueba
      identification_number: Number(companyData.identification_number || this.COMPANY_NIT), // Número explícito
      resolution_id: 98, // Hardcoded to 98 as requested
      sync: Boolean(syncValue), // Boolean explícito
      company: {
        identification_number: Number(companyData.identification_number || this.COMPANY_NIT), // Número explícito
        name: String(companyData.name || "MULTIACABADOS S.A.S.").trim(), // String explícito
        type_organization_id: Number(companyData.type_organization_id || 1), // 1 = Persona Jurídica (número)
        type_document_id: String(companyData.type_document_id || "31").trim(), // NIT (string)
        id_location: String(companyData.id_location).trim(), // String explícito
        address: String(companyData.address || "").trim(), // String explícito
        phone: String(companyData.phone || "").trim(), // String explícito
        email: String(companyData.email || "").trim() // String explícito
      },
      customer: {
        identification_number: Number(customerIdentification), // Número explícito
        dv: Number(customerDv), // DV explícito (obligatorio para NIT)
        name: String(customerName).trim(), // String explícito
        type_organization_id: Number(customerTypeOrganization), // Desde con_terceros.tipter (número)
        type_document_id: String(customerTypeDocument).trim(), // Desde con_terceros.Tipo_documento (string)
        id_location: String(cliente?.coddane).trim(), // Desde con_terceros.coddane (string)
        address: String(cliente?.dirter).trim(), // Desde con_terceros.dirter (string)
        phone: String(normalizePhone(invoiceData?.customer_phone || cliente?.TELTER || cliente?.CELTER || "")).trim(), // Desde con_terceros.TELTER (string)
        email: String(invoiceData?.customer_email || cliente?.EMAIL || cliente?.email || "cliente@ejemplo.com").trim() // Desde con_terceros.EMAIL (string)
      },
      tax_totals: [{
        tax_id: Number(taxId), // 1 para IVA (número, no string)
        tax_amount: Number(taxAmountFinal), // IVA total calculado desde líneas ajustadas (garantiza consistencia)
        taxable_amount: Number(lineExtensionAmountFinal), // Subtotal total calculado desde líneas ajustadas (garantiza consistencia)
        percent: Number(ivaPercent) // Porcentaje calculado desde valiva/valvta (número)
      }],
      legal_monetary_totals: {
        line_extension_amount: Number(lineExtensionAmountFinal), // Total sin impuestos calculado desde líneas ajustadas (número)
        tax_exclusive_amount: Number(lineExtensionAmountFinal), // Subtotal antes de IVA calculado desde líneas ajustadas (número)
        tax_inclusive_amount: Number(totalAmountFinal), // Total + impuestos calculado desde líneas ajustadas (número)
        payable_amount: Number(totalAmountFinal), // Valor final a pagar calculado desde líneas ajustadas (número)
        allowance_total_amount: Number(this.roundCOP(venFactura.valdcto || venFactura.descuento_valor || 0)), // Descuentos globales (número)
        charge_total_amount: Number(0) // Cargos globales (número)
      },
      invoice_lines: invoiceLines,
      payment_forms: [{
        payment_form_id: Number(paymentFormId), // Número explícito
        payment_method_id: Number(paymentMethodId), // Número explícito
        payment_due_date: String(dueDate).trim(), // String en formato fecha (YYYY-MM-DD)
        duration_measure: Number(paymentFormId === 4 ? (venFactura.plazo || 0) : 0) // Días de crédito (número)
      }]
    };

    // NOTA: trackId NO se debe agregar al JSON - la API de DIAN lo maneja internamente
    // Si por alguna razón viene en invoiceData, se ignora completamente

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
        codigo: taxId
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
        resolutionId: resolution.codigo || resolution.id_api || resolution.id || 4,
        typeDocumentId: typeDocumentId,
        sync: syncValue,
        urlBase: config?.url_base || 'https://facturacionelectronica.mobilsaas.com',
        testSetID: config?.testSetID || '1'
      }
    };

    // Imprimir resumen completo de datos a facturar
    this.imprimirResumenDatosFacturacion(datosParaResumen);

    // El JSON completo se mostrará en sendInvoiceToDIAN (body exacto tal cual se envía)

    return dianJson;
  }

  /**
   * Obtiene la resolución DIAN activa para Notas de Crédito
   * @returns {Promise<Object>} Resolución DIAN para Notas de Crédito
   */
  static async getDIANCreditNoteResolution() {
    console.log('\n📊 Obteniendo resolución DIAN para Notas de Crédito...');

    // Por ahora hardcoded como se sugiere en la guía, pero idealmente vendría de BD
    // Se busca por id=99 o prefijo='NC'
    return {
      id: 67,
      consecutivo: '8',
      rango_inicial: 1,
      rango_final: 99999,
      codigo: 67,
      id_api: 67,
      activa: true,
      type_document_id: 5 // Nota Crédito
    };
  }

  /**
   * Transforma los datos de una nota de crédito al formato JSON requerido por DIAN
   * @param {Object} notaData - Datos completos de la nota (nota, detalles, facturaOriginal, cliente)
   * @param {Object} resolution - Resolución DIAN para notas crédito
   * @param {Object} config - Configuración
   * @returns {Promise<Object>} JSON en formato DIAN
   */
  static async transformNotaCreditoForDIAN(notaData, resolution, config = {}) {
    console.log('\n' + '='.repeat(100));
    console.log('🔄 TRANSFORMANDO NOTA DE CRÉDITO PARA DIAN');
    console.log('='.repeat(100));

    const { nota, detalles, facturaOriginal, cliente } = notaData;

    // Validaciones previas
    if (!facturaOriginal.cufe && !facturaOriginal.CUFE) {
      throw new Error('La factura original no tiene CUFE. No se puede generar Nota de Crédito.');
    }

    // Obtener datos de la empresa
    const companyData = await this.getCompanyData();

    // Fechas
    const currentDate = new Date();
    const issueDate = currentDate.toISOString().split('T')[0];
    const issueTime = currentDate.toTimeString().split(' ')[0];

    // Validar fecha (Regla 1: Fecha NC >= Fecha Factura)
    const facturaDate = new Date(facturaOriginal.fecfac || facturaOriginal.fechaFactura);
    if (currentDate < facturaDate) {
      console.warn('⚠️ La fecha actual es anterior a la fecha de la factura. Ajustando a fecha de factura.');
    }

    // Calcular totales
    const lineExtensionAmount = this.roundCOP(nota.subtotal || 0);
    const taxAmount = this.roundCOP(nota.iva || 0);
    const totalAmount = this.roundCOP(nota.total || 0);

    // Determinar concepto de corrección
    // 1 = Devolución parcial de los bienes y/o no aceptación parcial del servicio
    // 2 = Anulación de factura electrónica
    const isAnulacion = nota.tipo_nota === 'ANULACION';
    const correctionConceptId = isAnulacion ? 2 : 1;
    const correctionDescription = isAnulacion
      ? `ANULACIÓN TOTAL FACTURA ${facturaOriginal.numfact}`
      : `DEVOLUCIÓN PARCIAL FACTURA ${facturaOriginal.numfact}`;

    // Construir líneas de nota crédito
    const creditNoteLines = detalles.map((detalle, index) => {
      const cantidad = parseFloat(detalle.cantidad);
      const precio = parseFloat(detalle.precio_unitario || detalle.precioUnitario);
      const subtotal = parseFloat(detalle.subtotal);
      const iva = parseFloat(detalle.valor_iva || detalle.valorIva);
      const ivaPercent = parseFloat(detalle.iva_porcentaje || detalle.ivaPorcentaje);

      return {
        unit_measure_id: (() => {
          const undDb = String(detalle.undins || detalle.unidadMedida || 'UND').trim().toUpperCase();
          if (undDb === 'DIA' || undDb === 'DÍA') return 606;
          if (undDb === 'HORA') return 730;
          return 70;
        })(),
        invoiced_quantity: cantidad,
        line_extension_amount: subtotal,
        discount: 0,
        free_of_charge_indicator: false,
        description: detalle.descripcion || correctionDescription,
        code: String(detalle.referencia || detalle.producto_id || detalle.productoId),
        type_item_identification_id: 4,
        price_amount: precio,
        base_quantity: cantidad,
        tax_totals: [{
          tax_id: 1, // IVA
          tax_amount: iva,
          percent: ivaPercent,
          taxable_amount: subtotal
        }]
      };
    });

    // Calcular diferencia de días para correction_type
    const diffTime = currentDate.getTime() - facturaDate.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);
    const correctionType = diffDays > 5 ? 'substitution' : 'referenced';

    // Normalizar teléfono del cliente
    const normalizePhone = (phone) => {
      if (!phone) return "3000000000";
      let cleanPhone = String(phone).replace(/[^\d]/g, "");
      if (cleanPhone.length < 7) {
        cleanPhone = cleanPhone.padStart(7, "0");
      }
      return cleanPhone.substring(0, 15);
    };

    // Calcular DVs
    const companyNit = Number(companyData.identification_number || this.COMPANY_NIT);
    const companyDv = this.calculateDV(companyNit);

    // Lógica robusta para el NIT del cliente (copiada de Facturas)
    const codterRaw = cliente.codter || '222222222222';
    let codterLimpio = String(codterRaw || '').trim();
    let customerDv = null;

    if (codterLimpio.includes('-')) {
      const parts = codterLimpio.split('-');
      codterLimpio = parts[0].trim();
      // Intentar obtener DV explícito si es numérico
      if (parts[1] && !isNaN(parseInt(parts[1]))) {
        customerDv = parseInt(parts[1], 10);
      }
    }
    // Remover cualquier carácter no numérico que pueda quedar
    codterLimpio = codterLimpio.replace(/[^\d]/g, '');
    const customerNit = Number(codterLimpio) || 222222222222;

    // Obtener tipo de documento del cliente
    const customerTypeDocument = cliente.Tipo_documento || cliente.tipo_documento || "13";

    // Si no se extrajo DV explícito, calcularlo solo si es NIT (31)
    if (customerDv === null) {
      if (customerTypeDocument === "31" || customerTypeDocument === 31) {
        customerDv = this.calculateDV(customerNit);
        console.log(`   ✅ DV del cliente calculado (NIT) para NC: ${customerDv}`);
      } else {
        customerDv = 0; // Para no-NITs, DV es 0
        console.log(`   ℹ️ Tipo documento ${customerTypeDocument} no requiere DV en NC, usando 0`);
      }
    }

    // Construir JSON
    const creditNoteJson = {
      number: parseInt(nota.numero), // Consecutivo de la NC
      exact_decimals: true, // Mantener precisión decimal exacta
      type_document_id: 5, // Nota Crédito
      identification_number: companyNit,
      dv: companyDv,
      resolution_id: 67, // ID de resolución
      sync: true,

      date: issueDate,
      time: issueTime,

      invoice_period: {
        start_date: issueDate,
        start_time: "00:00:00",
        end_date: issueDate,
        end_time: "23:59:59",
        type_invoice_id: 1
      },

      billing_reference: {
        number: String(facturaOriginal.numfact || facturaOriginal.numeroFactura),
        uuid: String(facturaOriginal.cufe || facturaOriginal.CUFE),
        issue_date: new Date(facturaOriginal.fecfac || facturaOriginal.fechaFactura).toISOString().split('T')[0],
        type_document_id: 1 // Factura de Venta
      },

      discrepancy_response: {
        correction_concept_id: correctionConceptId,
        correction_type: correctionType
      },

      company: {
        identification_number: companyNit,
        dv: companyDv,
        name: String(companyData.name || "MULTIACABADOS S.A.S.").trim(),
        type_organization_id: Number(companyData.type_organization_id || 1),
        type_document_id: String(companyData.type_document_id || "31").trim(),
        id_location: String(companyData.id_location).trim(),
        address: String(companyData.address || "").trim(),
        phone: String(companyData.phone || "").trim(),
        email: String(companyData.email || "").trim(),
        merchant_registration: "0000000-00" // Default
      },

      customer: {
        identification_number: customerNit,
        dv: customerDv,
        name: (cliente.nomter || '').trim().toUpperCase(),
        type_organization_id: cliente.tipter === '1' ? 1 : 2,
        id_location: cliente.coddane,
        address: (cliente.dirter || '').trim(),
        phone: normalizePhone(cliente.TELTER || cliente.CELTER),
        email: (cliente.EMAIL || 'cliente@ejemplo.com').trim().toLowerCase() || 'cliente@ejemplo.com',
        type_document_id: cliente.Tipo_documento || "13",
        type_regime_id: 1, // Responsable de IVA (común)
        type_liability_id: 1, // Fiscal
        tax_detail_id: 1, // IVA
        merchant_registration: "No tiene",
        portal_zone_location: "080020" // Default zona
      },

      legal_monetary_totals: {
        line_extension_amount: lineExtensionAmount,
        tax_exclusive_amount: lineExtensionAmount,
        tax_inclusive_amount: totalAmount,
        allowance_total_amount: 0,
        charge_total_amount: 0,
        payable_amount: totalAmount
      },

      // Impuestos Totales (Calculados dinámicamente desde las líneas)
      tax_totals: creditNoteLines.reduce((acc, line) => {
        if (line.tax_totals) {
          line.tax_totals.forEach(tax => {
            const existing = acc.find(t => t.tax_id === tax.tax_id && t.percent === tax.percent);
            if (existing) {
              existing.tax_amount += tax.tax_amount;
              existing.taxable_amount += tax.taxable_amount;
            } else {
              acc.push({
                tax_id: tax.tax_id,
                tax_amount: tax.tax_amount,
                percent: tax.percent,
                taxable_amount: tax.taxable_amount
              });
            }
          });
        }
        return acc;
      }, []).map(t => ({
        tax_id: t.tax_id,
        tax_amount: this.roundCOP(t.tax_amount),
        percent: t.percent,
        taxable_amount: this.roundCOP(t.taxable_amount)
      })),

      credit_note_lines: creditNoteLines,

      payment_forms: (() => {
        console.log('\n💳 [CREDIT NOTE] Determinando forma de pago desde facturaOriginal...');

        // Log raw values with types for debugging
        console.log('   📊 Valores RAW de factura original:');
        console.log(`     - efectivo: ${facturaOriginal.efectivo} (type: ${typeof facturaOriginal.efectivo})`);
        console.log(`     - credito: ${facturaOriginal.credito} (type: ${typeof facturaOriginal.credito})`);
        console.log(`     - tarjetacr: ${facturaOriginal.tarjetacr} (type: ${typeof facturaOriginal.tarjetacr})`);
        console.log(`     - Transferencia: ${facturaOriginal.Transferencia} (type: ${typeof facturaOriginal.Transferencia})`);
        console.log(`     - plazo: ${facturaOriginal.plazo} (type: ${typeof facturaOriginal.plazo})`);

        // Robust parsing of monetary fields with better type handling
        const valEfectivo = Math.abs(parseFloat(String(facturaOriginal.efectivo || 0).replace(',', '.'))) || 0;
        const valCredito = Math.abs(parseFloat(String(facturaOriginal.credito || 0).replace(',', '.'))) || 0;
        const valTarjeta = Math.abs(parseFloat(String(facturaOriginal.tarjetacr || 0).replace(',', '.'))) || 0;
        const valTransferencia = Math.abs(parseFloat(String(facturaOriginal.Transferencia || facturaOriginal.transferencia || 0).replace(',', '.'))) || 0;
        const valPlazo = parseInt(String(facturaOriginal.plazo || 0).replace(/\D/g, ''), 10) || 0;

        console.log('   📊 Valores PARSEADOS:');
        console.log(`     - efectivo: ${valEfectivo}`);
        console.log(`     - credito: ${valCredito}`);
        console.log(`     - tarjetacr: ${valTarjeta}`);
        console.log(`     - Transferencia: ${valTransferencia}`);
        console.log(`     - plazo: ${valPlazo} días`);

        let paymentFormId = 1; // Default: Contado
        let paymentMethodId = 9; // Default: Efectivo
        let detectionMethod = 'default';

        // Lógica de detección con prioridad:
        // 1. Tarjeta
        if (valTarjeta > 0) {
          paymentFormId = 1;
          paymentMethodId = 48; // Tarjeta crédito
          detectionMethod = 'tarjeta (campo tarjetacr > 0)';
          console.log(`   ✅ Forma de pago: Tarjeta Crédito (Form ID: 1, Method ID: 48)`);
        }
        // 2. Transferencia
        else if (valTransferencia > 0) {
          paymentFormId = 1;
          paymentMethodId = 30; // Transferencia Débito Bancaria
          detectionMethod = 'transferencia (campo Transferencia > 0)';
          console.log(`   ✅ Forma de pago: Transferencia (Form ID: 1, Method ID: 30)`);
        }
        // 3. Crédito (campo credito > 0)
        else if (valCredito > 0.01) {
          paymentFormId = 2; // Crédito
          paymentMethodId = 44; // Instrumento no definido
          detectionMethod = 'credito (campo credito > 0)';
          console.log(`   ✅ Forma de pago: Crédito (Form ID: 2, Method ID: 44, Plazo: ${valPlazo} días)`);
        }
        // 4. HEURÍSTICA: Si tiene plazo > 0, asumir crédito (incluso si campo credito = 0)
        else if (valPlazo > 0) {
          paymentFormId = 2; // Crédito
          paymentMethodId = 44; // Instrumento no definido
          detectionMethod = 'heurística plazo (plazo > 0 indica crédito)';
          console.log(`   ✅ Forma de pago: Crédito (Form ID: 2, Method ID: 44) [Detectado por plazo: ${valPlazo} días]`);
          console.log(`   ⚠️ NOTA: Campo 'credito' era ${valCredito}, pero plazo > 0 indica que es factura a crédito`);
        }
        // 5. Efectivo (default si nada más aplica)
        else {
          detectionMethod = 'efectivo (default, ningún otro método detectado)';
          console.log(`   ✅ Forma de pago: Efectivo (Form ID: 1, Method ID: 9) [Default]`);
        }

        console.log(`   🔍 Método de detección usado: ${detectionMethod}`);

        // Calcular fecha vencimiento si es crédito
        let paymentDueDate = issueDate;
        if (paymentFormId === 2 && valPlazo > 0) {
          const dueDateObj = new Date(); // Fecha actual como base de emisión
          dueDateObj.setDate(dueDateObj.getDate() + valPlazo);
          paymentDueDate = dueDateObj.toISOString().split('T')[0];
          console.log(`   📅 Fecha vencimiento calculada: ${paymentDueDate} (${valPlazo} días desde hoy)`);
        }

        return [{
          payment_form_id: Number(paymentFormId),
          payment_method_id: Number(paymentMethodId),
          payment_due_date: String(paymentDueDate),
          duration_measure: Number(paymentFormId === 2 ? valPlazo : 0)
        }];
      })()
    };

    // Configuración adicional
    if (config.isPrueba) {
      creditNoteJson.type_document_id = "5"; // En pruebas a veces piden string
    }

    console.log('✅ JSON de Nota de Crédito construido exitosamente');
    return creditNoteJson;
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

      // CRÍTICO: trackId NO debe incluirse en el JSON - la API de DIAN lo maneja internamente
      // Eliminar trackId si existe en el JSON (no debe enviarse nunca)

      // Construir URL completa del endpoint
      // Si es Nota Crédito (type_document_id = 5), usar /credit-note, si no /invoice
      const endpointType = invoiceJson.type_document_id === 5 ? 'credit-note' : 'invoice';
      const url = `${baseUrl}/api/ubl2.1/${endpointType}/${testSetIDStr}`;

      // Preparar headers
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Crear una copia limpia del JSON y eliminar trackId completamente (si existe)
      let cleanJson = JSON.parse(JSON.stringify(invoiceJson));
      if ('trackId' in cleanJson || 'track_id' in cleanJson) {
        delete cleanJson.trackId;
        delete cleanJson.track_id;
        console.log('⚠️ [DIAN] trackId eliminado del JSON (la API lo maneja internamente)');
      }

      // Preparar body como JSON string
      const bodyString = JSON.stringify(cleanJson);

      // MOSTRAR EN TERMINAL: Body exacto tal cual como se envía a la API de DIAN (justo antes de enviar)
      console.log('\n' + '='.repeat(100));
      console.log('🚀 ========== ENVIANDO FACTURA A LA API DE DIAN ==========');
      console.log('='.repeat(100));
      console.log('📋 URL COMPLETA:', url);
      console.log('📋 HEADERS:');
      console.log(JSON.stringify(headers, null, 2));
      console.log('\n📦 BODY COMPLETO (JSON formateado que se enviará a DIAN):');
      console.log('─'.repeat(100));
      console.log(JSON.stringify(cleanJson, null, 2));
      console.log('─'.repeat(100));
      console.log(`📊 Tamaño del body: ${bodyString.length} caracteres`);
      console.log('\n💾 JSON COMPLETO EN UNA LÍNEA (para copiar fácilmente):');
      console.log('─'.repeat(100));
      console.log(JSON.stringify(cleanJson));
      console.log('─'.repeat(100));
      console.log('='.repeat(100));
      console.log('🚀 ========== INICIANDO ENVÍO A DIAN ==========\n');

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
          responseData = { cufe: cufeMatch[1], originalText: responseText };
        } else {
          console.error('❌ [DIAN] No se pudo parsear respuesta ni extraer CUFE');
          // Log raw text even on error
          console.log('\n📄 RESPUESTA TEXTO PLANO (RAW):');
          console.log('─'.repeat(100));
          console.log(responseText);
          console.log('─'.repeat(100));

          throw new Error(`Respuesta de DIAN no es JSON válido: ${responseText.substring(0, 200)}`);
        }
      }

      // MOSTRAR EN TERMINAL: Body COMPLETO de la respuesta de DIAN
      console.log('\n' + '='.repeat(100));
      console.log('📩 ========== RESPUESTA RECIBIDA DE LA API DE DIAN ==========');
      console.log('='.repeat(100));
      console.log('📋 STATUS HTTP:', response.status, response.statusText);
      console.log('\n📦 BODY RESPUESTA COMPLETO (JSON):');
      console.log('─'.repeat(100));
      console.log(JSON.stringify(responseData, null, 2));
      console.log('─'.repeat(100));
      console.log('='.repeat(100) + '\n');

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
  /**
   * Calcula el Dígito de Verificación (DV) para un NIT
   * @param {string|number} nit - Número de identificación tributaria
   * @returns {number} Dígito de verificación (0-9)
   */
  static calculateDV(nit) {
    if (!nit) return 0;

    const nitString = String(nit).replace(/\D/g, ''); // Solo números
    if (nitString.length === 0) return 0;

    const primes = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
    let sum = 0;

    // Recorrer el NIT de derecha a izquierda
    for (let i = 0; i < nitString.length; i++) {
      const digit = parseInt(nitString.charAt(nitString.length - 1 - i));
      sum += digit * primes[i];
    }

    const remainder = sum % 11;

    if (remainder <= 1) {
      return remainder;
    } else {
      return 11 - remainder;
    }
  }
  /**
   * Resuelve el ID y nombre de unidad de medida DIAN basado en los datos del detalle
   * @param {Object} detalle - Objeto con datos del producto/servicio
   * @param {number} index - Índice para logging
   * @returns {Object} { id: number, name: string }
   */
  static resolveUnitMeasureId(detalle, index = 0) {
    let unitMeasureId = 70; // Default: Unidad (70)
    let unitMeasureName = 'unidad';

    // Prioridad: UNDVTA/codmed (ven_detafact) > undins (inv_insumos) > Default
    const undVtaVal = String(detalle.UNDVTA || detalle.undvta || detalle.codmed || detalle.unidadMedidaCodigo || '').trim();
    const undVtaNum = parseInt(undVtaVal, 10);
    const undDb = String(detalle.undins || detalle.unidadMedida || '').trim().toUpperCase();

    // Lógica corregida para soportar "002", "2", "DIA"
    if (undVtaNum === 2 || undVtaVal === '002' || undDb === 'DIA' || undDb === 'DÍA') {
      unitMeasureId = 606; // DIA
      unitMeasureName = 'día';
    } else if (undVtaNum === 1 || undVtaVal === '001' || undDb === 'HORA') {
      unitMeasureId = 730; // HORA
      unitMeasureName = 'hora';
    } else if (undVtaNum === 3 || undVtaVal === '003' || undDb === 'UNIDAD' || undDb === 'UND') {
      unitMeasureId = 70; // UNIDAD
      unitMeasureName = 'unidad';
    } else {
      // Fallback: Si el id ya venía desde el frontend (como en preview manual)
      if (detalle.unit_measure_id === 606) { unitMeasureId = 606; unitMeasureName = 'día'; }
      else if (detalle.unit_measure_id === 730) { unitMeasureId = 730; unitMeasureName = 'hora'; }
      else { unitMeasureId = 70; unitMeasureName = 'unidad'; }
    }

    console.log(`🔍 [DEBUG UNIT] Item: ${index} | Cod: ${detalle.codins || detalle.code || 'N/A'}`);
    console.log(`   - Data: UNDVTA='${undVtaVal}'(num:${undVtaNum}) | undDb='${undDb}' | input_id=${detalle.unit_measure_id}`);
    console.log(`   ✅ Resultado: ID=${unitMeasureId} | Name='${unitMeasureName}'`);

    return { id: unitMeasureId, name: unitMeasureName };
  }
}

module.exports = DIANService;

