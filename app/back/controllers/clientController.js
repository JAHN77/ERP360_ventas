const { executeQuery, executeQueryWithParams, getConnection } = require('../services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('../services/dbConfig.cjs');
const sql = require('mssql');

/**
 * Validates and sanitizes a value for DECIMAL(18,2)
 */
const validateDecimal18_2 = (value, fieldName = 'campo') => {
  let num = 0;
  if (value === null || value === undefined || value === '') return 0;

  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    let cleaned = String(value).trim().replace(/[$\s]/g, '');
    if (cleaned.includes(',') && cleaned.includes('.')) {
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      if (lastComma > lastDot) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',')) {
      const parts = cleaned.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        cleaned = cleaned.replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    }
    num = parseFloat(cleaned);
  } else {
    throw new Error(`${fieldName}: Tipo de dato inválido. Se esperaba número o string.`);
  }

  if (!isFinite(num) || isNaN(num)) {
    throw new Error(`${fieldName}: Valor no es un número válido.`);
  }

  const MAX = 9999999999999999.99;
  const MIN = -9999999999999999.99;
  if (num > MAX || num < MIN) {
    throw new Error(`${fieldName}: Valor fuera de rango.`);
  }
  return parseFloat(num.toFixed(2));
};

const clientController = {
  /**
   * Get all clients with pagination
   */
  getAllClients: async (req, res) => {
    try {
      const {
        page = '1',
        pageSize = '100',
        search,
        sortBy = 'razonSocial',
        sortOrder = 'asc',
        isProveedor,
        tipoPersonaId,
        diasCredito
      } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const pageSizeNum = Math.min(10000, Math.max(10, parseInt(String(pageSize), 10) || 100));
      const offset = (pageNum - 1) * pageSizeNum;

      // Validate Search
      let searchTerm = null;
      if (search && typeof search === 'string' && search.trim() && search !== '[object Object]') {
        searchTerm = String(search).trim();
      }

      // Base Conditon (Active Terceros + Email Required)
      let whereClause = "WHERE t.activo = 1 AND t.EMAIL IS NOT NULL AND LTRIM(RTRIM(t.EMAIL)) <> ''";

      console.log('🔍 [DEBUG] getAllClients - Params:', { page, pageSize, search, sortBy, sortOrder, isProveedor, tipoPersonaId, diasCredito });

      const params = { offset, pageSize: pageSizeNum };

      if (searchTerm) {
        whereClause += ` AND (
            t.nomter LIKE @search OR 
            t.codter LIKE @search OR 
            t.EMAIL LIKE @search OR 
            t.coddane LIKE @search
        )`;
        params.search = `%${searchTerm}%`;
      }

      // Filter by Provider Status (Critical for Tabs)
      if (isProveedor !== undefined && isProveedor !== null && isProveedor !== 'Todos') {
        const isProvBool = String(isProveedor) === 'true' || String(isProveedor) === '1';
        if (isProvBool) {
          whereClause += " AND (t.isproveedor = 1)";
        } else {
          whereClause += " AND (t.isproveedor = 0 OR t.isproveedor IS NULL)";
        }
      }

      // Filter by Type
      if (tipoPersonaId && tipoPersonaId !== 'Todos') {
        whereClause += " AND t.tipter = @tipoPersonaId";
        params.tipoPersonaId = tipoPersonaId;
      }

      // Filter by Payment Condition (diasCredito)
      if (diasCredito && diasCredito !== 'Todos') {
        whereClause += " AND t.plazo = @diasCredito";
        params.diasCredito = diasCredito;
      }

      // Mapeo de columnas para ordenamiento
      const sortMapping = {
        'razonSocial': 't.nomter',
        'nombreCompleto': 't.nomter',
        'numeroDocumento': 't.codter',
        'email': 't.EMAIL',
        'ciudad': 'ciudad', // Special handling
        'ciudadId': 'ciudad', // Special handling
        'direccion': 't.dirter',
        'telefono': 't.TELTER',
        'telter': 't.TELTER',
        'fechaIngreso': 't.FECING',
        'id': 't.id'
      };

      let orderByColumn = sortMapping[sortBy] || 't.nomter';
      const orderDirection = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

      let columnExpression = orderByColumn;

      // Special sort for 'ciudad': Resolve name from code if possible
      if (sortBy === 'ciudad' || sortBy === 'ciudadId') {
        columnExpression = `LTRIM(ISNULL(COALESCE(gm.nommun, t.ciudad), ''))`;
      } else {
        const stringColumns = ['t.nomter', 't.codter', 't.EMAIL', 't.dirter', 't.TELTER'];
        if (stringColumns.includes(orderByColumn)) {
          columnExpression = `LTRIM(ISNULL(${orderByColumn}, ''))`;
        }
      }

      let orderByClause = `ORDER BY ${columnExpression} ${orderDirection}`;
      if (orderByColumn !== 't.codter') {
        orderByClause += `, t.codter ASC`;
      }

      console.log('🔍 [DEBUG] Final Query Parts:', { whereClause, orderByClause });

      // Optimization: Select specific columns with aliases to avoid ambiguity
      const query = `
        SELECT 
          t.id,
          t.codter as numeroDocumento,
          t.nomter as razonSocial,
          t.apl1 as primerApellido,
          t.apl2 as segundoApellido,
          t.nom1 as primerNombre,
          t.nom2 as segundoNombre,
          t.dirter as direccion,
          t.TELTER as telefono,
          t.CELTER as celular,
          t.EMAIL as email,
          t.ciudad,
          t.ciudad as ciudadId,
          t.codven as vendedorId,
          COALESCE(t.cupo_credito, 0) as limiteCredito,
          COALESCE(t.plazo, 0) as diasCredito,
          COALESCE(t.tasa_descuento, 0) as tasaDescuento,
          t.Forma_pago as formaPago,
          t.regimen_tributario as regimenTributario,
          CAST(t.activo AS INT) as activo,
          t.contacto,
          t.codacteconomica,
          t.coddane as codigoPostal,
          t.Tipo_documento as tipoDocumento,
          t.tipter,
          t.isproveedor, 
          t.FECING as fechaIngreso
        FROM ${TABLE_NAMES.clientes} t
        LEFT JOIN gen_municipios gm ON LTRIM(RTRIM(t.ciudad)) = LTRIM(RTRIM(gm.coddane))
        ${whereClause}
        ${orderByClause}
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM ${TABLE_NAMES.clientes} t
        LEFT JOIN gen_municipios gm ON LTRIM(RTRIM(t.ciudad)) = LTRIM(RTRIM(gm.coddane))
        ${whereClause}
      `;

      const [clientes, countResult] = await Promise.all([
        executeQueryWithParams(query, params, req.db_name),
        executeQueryWithParams(countQuery, searchTerm ? { search: params.search } : {}, req.db_name)
      ]);



      const processedClientes = clientes.map(c => ({
        ...c,
        nombreCompleto: c.razonSocial || [c.primerNombre, c.segundoNombre, c.primerApellido, c.segundoApellido].filter(Boolean).join(' ').trim() || 'Sin Nombre'
      }));

      // DEBUG: Inspect actual data being returned
      if (processedClientes.length > 0) {
        console.log('🔍 [DEBUG] First 5 rows:', processedClientes.slice(0, 5).map(c => ({
          id: c.id,
          nombre: c.nombreCompleto,
          ciudadRaw: c.ciudad,
          ciudadId: c.ciudadId
        })));
      }

      const total = countResult[0]?.total || 0;
      console.log('🔍 [DEBUG] Total found:', total);
      const totalPages = Math.ceil(total / pageSizeNum);

      res.json({
        success: true,
        data: processedClientes,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total,
          totalPages
        }
      });
    } catch (error) {
      console.error('Error fetching clients:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo clientes', error: error.message });
    }
  },

  /**
   * Search clients (Autocomplete)
   */
  searchClients: async (req, res) => {
    try {
      const { search = '', limit = 20 } = req.query;
      if (String(search).trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Ingrese al menos 2 caracteres' });
      }

      const like = `%${search}%`;
      // Optimized search query
      const query = `
        SELECT TOP (@limit)
          id,
          codter as numeroDocumento,
          nomter as razonSocial,
          apl1 as primerApellido,
          apl2 as segundoApellido,
          nom1 as primerNombre,
          nom2 as segundoNombre,
          dirter as direccion,
          TELTER as telefono,
          CELTER as celular,
          EMAIL as email,
          ciudad,
          codven as vendedorId,
          tipter,
          isproveedor
        FROM con_terceros
        WHERE activo = 1 
          AND (nomter LIKE @like OR codter LIKE @like) -- Reduced fields for speed if needed, but keeping main ones
        ORDER BY nomter`;

      const data = await executeQueryWithParams(query, { like, limit: Number(limit) }, req.db_name);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error searching clients:', error);
      res.status(500).json({ success: false, message: 'Error buscando clientes', error: error.message });
    }
  },

  /**
   * Get client by ID
   */
  getClientById: async (req, res) => {
    try {
      const { id } = req.params;
      const idNum = parseInt(id, 10);
      const isNumeric = !isNaN(idNum) && String(idNum) === String(id).trim();

      let query, params;
      const baseQuery = `
        SELECT 
          id,
          codter as numeroDocumento,
          nomter as razonSocial,
          apl1 as primerApellido,
          apl2 as segundoApellido,
          nom1 as primerNombre,
          nom2 as segundoNombre,
          EMAIL as email,
          dirter as direccion,
          TELTER as telefono,
          CELTER as celular,
          ciudad,
          ciudad as ciudadId,
          ciudad as ciudadIdCodigo,
          codven as vendedorId,
          COALESCE(cupo_credito, 0) as limiteCredito,
          COALESCE(plazo, 0) as diasCredito,
          COALESCE(tasa_descuento, 0) as tasaDescuento,
          Forma_pago as formaPago,
          regimen_tributario as regimenTributario,
          CAST(activo AS INT) as activo,
          contacto,
          codacteconomica,
          coddane as codigoPostal,
          Tipo_documento as tipoDocumento,
          FECING as fechaIngreso
        FROM con_terceros
      `;

      if (isNumeric) {
        query = `${baseQuery} WHERE id = @id AND activo = 1`;
        params = { id: idNum };
      } else {
        query = `${baseQuery} WHERE codter = @codter AND activo = 1`;
        params = { codter: String(id).trim() };
      }

      const data = await executeQueryWithParams(query, params, req.db_name);
      if (!data || data.length === 0) {
        return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
      }

      const cliente = data[0];
      console.log("DB Result (Backend) for ID " + id + ":", cliente); // DEBUG
      // Normalize Full Name
      if (!cliente.nombreCompleto) {
        const parts = [cliente.primerNombre, cliente.segundoNombre, cliente.primerApellido, cliente.segundoApellido];
        const fullName = parts.filter(Boolean).join(' ').trim();
        cliente.nombreCompleto = fullName || cliente.razonSocial || 'Sin Nombre';
      }

      res.json({ success: true, data: cliente });
    } catch (error) {
      console.error('Error fetching client by id:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo cliente', error: error.message });
    }
  },

  /**
   * Update Client
   */
  updateClient: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        numeroDocumento, reasonSocial, primerApellido, segundoApellido, primerNombre, segundoNombre,
        direccion, ciudad, email, telefono, celular,
        limiteCredito, diasCredito, vendedorId,
        formaPago, regimenTributario, tipoDocumento,
        tipoPersonaId, // '1' or '2' -> maps to tipter
        codacteconomica, contacto, codigoPostal, coddane
      } = req.body;

      if (!id) return res.status(400).json({ success: false, message: 'ID de cliente requerido' });

      // Validation
      const creditLimitDecimal = validateDecimal18_2(limiteCredito, 'limiteCredito');

      let tipterVal = 2; // Default Cliente
      if (tipoPersonaId) tipterVal = parseInt(tipoPersonaId, 10) || 2;

      // Prepare Update Query
      const params = {
        id: parseInt(id, 10),
        codter: String(numeroDocumento).trim().substring(0, 15),
        razonSocial: (reasonSocial || '').trim().substring(0, 100),
        primerApellido: (primerApellido || '').trim().substring(0, 20),
        segundoApellido: (segundoApellido || '').trim().substring(0, 20),
        primerNombre: (primerNombre || '').trim().substring(0, 20),
        segundoNombre: (segundoNombre || '').trim().substring(0, 20),
        direccion: (direccion || '').trim().substring(0, 100),
        ciudad: (ciudad || '').trim().substring(0, 50),
        email: (email || '').trim().substring(0, 100),
        telefono: (telefono || '').trim().substring(0, 20),
        celular: (celular || '').trim().substring(0, 20),
        diasCredito: parseInt(diasCredito || 0, 10),
        vendedorId: String(vendedorId || '').trim().substring(0, 4),
        formaPago: String(formaPago || '0').trim().substring(0, 20),
        regimenTributario: String(regimenTributario || '0').trim().substring(0, 20),
        tipoDocumento: String(tipoDocumento || '13').trim().substring(0, 3),
        coddane: String(codigoPostal || coddane || '').trim().substring(0, 5), // DB Limit: char(5)
        codacteconomica: String(codacteconomica || '').trim().substring(0, 10),
        contacto: String(contacto || '').trim().substring(0, 100),
        tipter: tipterVal
      };

      // NOTE: `nomter` (Razon Social) logic:
      // In DB, `nomter` usually stores the full name or business name.
      // If `razonSocial` (input) is present, use it. Else validation of parts.
      let nomter = params.razonSocial;
      if (!nomter) {
        nomter = [params.primerNombre, params.segundoNombre, params.primerApellido, params.segundoApellido].filter(Boolean).join(' ');
      }
      params.nomter = nomter.substring(0, 100);

      const query = `
        UPDATE con_terceros
        SET 
          codter = @codter,
          nomter = @nomter,
          apl1 = @primerApellido,
          apl2 = @segundoApellido,
          nom1 = @primerNombre,
          nom2 = @segundoNombre,
          dirter = @direccion,
          ciudad = @ciudad,
          codven = @vendedorId,
          EMAIL = @email,
          TELTER = @telefono,
          CELTER = @celular,
          plazo = @diasCredito,
          cupo_credito = ${creditLimitDecimal}, -- Injected directly as number, safe due to validation
          Forma_pago = @formaPago,
          regimen_tributario = @regimenTributario,
          Tipo_documento = @tipoDocumento,
          coddane = @coddane,
          codacteconomica = @codacteconomica,
          contacto = @contacto,
          tipter = @tipter
        WHERE id = @id
      `;

      await executeQueryWithParams(query, params, req.db_name);

      // Return updated
      const updated = await executeQueryWithParams('SELECT * FROM con_terceros WHERE id = @id', { id: params.id }, req.db_name);
      res.json({ success: true, data: updated[0] });

    } catch (error) {
      console.error('Error updating client:', error);
      res.status(500).json({ success: false, message: 'Error actualizando cliente', error: error.message });
    }
  },

  /**
   * Assign Price List (Special Action)
   */
  assignPriceList: async (req, res) => {
    try {
      const { id } = req.params;
      const { listaPrecioId } = req.body || {};
      if (!listaPrecioId) return res.status(400).json({ success: false, message: 'listaPrecioId requerido' });

      await executeQueryWithParams(
        `UPDATE con_terceros SET lista_precios_id = @listaPrecioId WHERE id = @clienteId;`,
        { listaPrecioId, clienteId: id },
        req.db_name
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Error assigning price list:', error);
      res.status(500).json({ success: false, message: 'Error asignando lista de precios', error: error.message });
    }
  },

  /**
   * Search Economic Activities (CIIU)
   */
  searchActividadesCiiu: async (req, res) => {
    try {
      const { search = '', limit = 20 } = req.query;
      if (String(search).trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Ingrese al menos 2 caracteres' });
      }

      const like = `%${search}%`;
      const query = `
        SELECT TOP (@limit)
          codigo,
          nombre,
          tarifa
        FROM gen_actividades_ciiu
        WHERE nombre LIKE @like OR codigo LIKE @like
        ORDER BY nombre
      `;

      const data = await executeQueryWithParams(query, { like, limit: Number(limit) }, req.db_name);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error searching actividades:', error);
      res.status(500).json({ success: false, message: 'Error buscando actividades económicas', error: error.message });
    }
  },

  /**
   * Create Client
   */
  createClient: async (req, res) => {
    try {
      const {
        numeroDocumento, reasonSocial, primerApellido, segundoApellido, primerNombre, segundoNombre,
        direccion, ciudad, email, telefono, celular,
        limiteCredito, diasCredito, vendedorId,
        formaPago, regimenTributario, tipoDocumento,
        codacteconomica, isproveedor,
        contacto,
        tipoPersonaId // '1' or '2' -> maps to tipter
      } = req.body;

      // Basic Validation
      if (!numeroDocumento) return res.status(400).json({ success: false, message: 'Número de documento requerido' });

      const checkExists = await executeQueryWithParams(`SELECT id FROM con_terceros WHERE codter = @codter`, { codter: numeroDocumento }, req.db_name);
      if (checkExists.length > 0) {
        return res.status(400).json({ success: false, message: 'El cliente/tercero con este documento ya existe.' });
      }

      const creditLimitDecimal = validateDecimal18_2(limiteCredito, 'limiteCredito');

      let tipterVal = 2;
      if (tipoPersonaId) tipterVal = parseInt(tipoPersonaId, 10) || 2;

      const params = {
        codter: String(numeroDocumento).trim().substring(0, 15),
        razonSocial: (reasonSocial || '').trim().substring(0, 150),
        primerApellido: (primerApellido || '').trim().substring(0, 50),
        segundoApellido: (segundoApellido || '').trim().substring(0, 50),
        primerNombre: (primerNombre || '').trim().substring(0, 50),
        segundoNombre: (segundoNombre || '').trim().substring(0, 50),
        direccion: (direccion || '').trim().substring(0, 180),
        ciudad: (ciudad || '').trim().substring(0, 40),
        email: (email || '').trim().substring(0, 70),
        telefono: (telefono || '').trim().substring(0, 20),
        celular: (celular || '').trim().substring(0, 30),
        diasCredito: parseInt(diasCredito || 0, 10),
        vendedorId: String(vendedorId || '').trim().substring(0, 3), // char(3)
        formaPago: parseInt(formaPago || 0, 10),
        regimenTributario: parseInt(regimenTributario || 0, 10),
        tipoDocumento: String(tipoDocumento || '13').trim().substring(0, 2), // char(2)
        codacteconomica: String(codacteconomica || '').trim().substring(0, 6),
        isproveedor: isproveedor ? 1 : 0,
        contacto: String(contacto || '').trim().substring(0, 150),
        coddane: String(req.body.codigoPostal || '').trim().substring(0, 5), // DB Limit: char(5)
        tipter: tipterVal,
        FECING: new Date()
      };

      // Construct Name if razonSocial empty
      let nomter = params.razonSocial;
      if (!nomter) {
        nomter = [params.primerNombre, params.segundoNombre, params.primerApellido, params.segundoApellido].filter(Boolean).join(' ');
      }
      params.nomter = nomter.substring(0, 150);

      const query = `
        INSERT INTO con_terceros (
          codter, nomter, apl1, apl2, nom1, nom2,
          dirter, ciudad, codven, EMAIL, TELTER, CELTER,
          plazo, cupo_credito, Forma_pago, regimen_tributario,
          Tipo_documento, codacteconomica, isproveedor, contacto,
          coddane, tipter, FECING, activo
        ) VALUES (
          @codter, @nomter, @primerApellido, @segundoApellido, @primerNombre, @segundoNombre,
          @direccion, @ciudad, @vendedorId, @email, @telefono, @celular,
          @diasCredito, ${creditLimitDecimal}, @formaPago, @regimenTributario,
          @tipoDocumento, @codacteconomica, @isproveedor, @contacto,
          @coddane, @tipter, @FECING, 1
        );
        SELECT SCOPE_IDENTITY() as id;
      `;

      const result = await executeQueryWithParams(query, params, req.db_name);
      const newId = result[0].id;

      const newClient = await executeQueryWithParams('SELECT * FROM con_terceros WHERE id = @id', { id: newId }, req.db_name);
      res.json({ success: true, data: newClient[0] });

    } catch (error) {
      console.error('Error creating client:', error);
      res.status(500).json({ success: false, message: 'Error creando cliente', error: error.message });
    }
  }
};

module.exports = clientController;
