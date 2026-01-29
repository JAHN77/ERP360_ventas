const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const { executeQuery, executeQueryWithParams, getConnection } = require('../services/sqlServerClient.cjs');
const { TABLE_NAMES, QUERIES } = require('../services/dbConfig.cjs');





const getVendedores = async (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT 
        CAST(v.ideven AS VARCHAR(20)) as id,
        CAST(v.ideven AS VARCHAR(20)) as numeroDocumento,
        LTRIM(RTRIM(v.nomven)) as nombreCompleto,
        v.codven as codigoVendedor,
        CAST(v.ideven AS VARCHAR(20)) as codiEmple,
        '' as email,
        CAST(v.Activo AS INT) as activo,
        u.firma
      FROM ven_vendedor v
      LEFT JOIN gen_usuarios u ON CAST(v.ideven AS VARCHAR(20)) = u.codusu
      WHERE v.Activo = 1
    `;

    const params = {};
    if (search) {
      query += ` AND (v.codven LIKE @search OR v.nomven LIKE @search OR CAST(v.ideven AS VARCHAR) LIKE @search)`;
      params.search = `%${search}%`;
    }

    query += ` ORDER BY v.nomven`;

    const data = await executeQueryWithParams(query, params, req.db_name);

    const processedData = data.map((item) => {
      const nombreCompleto = item.nombreCompleto || '';
      const partes = nombreCompleto.trim().split(/\s+/);
      return {
        ...item,
        primerNombre: partes[0] || '',
        primerApellido: partes.length > 1 ? partes.slice(1).join(' ') : '',
        nombreCompleto: nombreCompleto.trim(),
        empresaId: 1,
        firma: item.firma // Include firma in result
      };
    });

    res.json({ success: true, data: processedData });
  } catch (error) {
    console.error('Error fetching vendedores:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo vendedores', error: error.message });
  }
};

const getEmpresa = async (req, res) => {
  try {
    const query = `
      SELECT TOP 1 
        LTRIM(RTRIM(razemp)) as razonSocial,
        LTRIM(RTRIM(nitemp)) as nit,
        LTRIM(RTRIM(diremp)) as direccion,
        LTRIM(RTRIM(telemp)) as telefono,
        LTRIM(RTRIM(email)) as email,
        LTRIM(RTRIM(Ciuemp)) as ciudad,
        LTRIM(RTRIM(DPTOEMP)) as departamento,
        LTRIM(RTRIM(Slogan)) as slogan,
        LTRIM(RTRIM(IMGLOGOEXT)) as logoExt,
        LTRIM(RTRIM(regimen_empresa)) as regimen
      FROM gen_empresa
    `;
    const result = await executeQueryWithParams(query, {}, req.db_name);
    const empresa = result[0] || null;

    // Si hay empresa, forzar la carga del logo solicitado por el usuario como base64
    if (empresa) {
      try {
        const logoPath = path.join(__dirname, '../public/assets/grupoNisa.jpg');

        if (fs.existsSync(logoPath)) {
          const bitmap = fs.readFileSync(logoPath);
          const extension = path.extname(logoPath).replace('.', '') || 'png';
          const base64Logo = `data:image/${extension};base64,${bitmap.toString('base64')}`;

          empresa.logoBase64 = base64Logo;
          empresa.logoExt = base64Logo;
          console.log('✅ Logo cargado exitosamente como Base64');
        } else {
          console.warn('⚠️ Logo no encontrado en:', logoPath);
        }
      } catch (err) {
        console.warn('⚠️ Error procesando el logo:', err.message);
      }
    }

    res.json({ success: true, data: empresa });
  } catch (error) {
    console.error('Error fetching empresa:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo datos de la empresa', error: error.message });
  }
};

const getBodegas = async (req, res) => {
  try {
    const bodegas = await executeQueryWithParams(`
      SELECT codalm, RTRIM(nomalm) as nomalm, RTRIM(COALESCE(diralm, '')) as diralm, RTRIM(COALESCE(ciualm, '')) as ciualm, CAST(activo AS INT) as activo
      FROM inv_almacen WHERE activo = 1 ORDER BY codalm
    `, {}, req.db_name);
    const bodegasMapeadas = bodegas.map(b => ({
      id: b.codalm,
      codigo: b.codalm,
      nombre: b.nomalm || 'Sin nombre',
      direccion: b.diralm || '',
      ciudad: b.ciualm || '',
      activo: b.activo === 1 || b.activo === true
    }));

    // Cache headers removed to prevent stale data when switching companies
    // res.set({
    //   'Cache-Control': 'public, max-age=300, must-revalidate',
    //   'ETag': `"${Date.now()}-${bodegasMapeadas.length}"`
    // });
    res.json({ success: true, data: bodegasMapeadas });
  } catch (error) {
    console.error('Error fetching bodegas:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo bodegas', error: error.message });
  }
};

const getCiudades = async (req, res) => {
  try {
    const ciudades = await executeQueryWithParams(`
      SELECT ID as id, nommun as nombre, coddane as codigo, coddep as departamentoId
      FROM gen_municipios ORDER BY nommun ASC
    `, {}, req.db_name);
    res.json({ success: true, data: ciudades });
  } catch (error) {
    console.error('Error obteniendo ciudades:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo ciudades', error: error.message });
  }
};

const getDepartamentos = async (req, res) => {
  try {
    const departamentos = await executeQueryWithParams(`
      SELECT coddep as codigo, RTRIM(nomdep) as nombre
      FROM gen_departamentos ORDER BY nomdep ASC
    `, {}, req.db_name);
    res.json({ success: true, data: departamentos });
  } catch (error) {
    console.error('Error obteniendo departamentos:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo departamentos', error: error.message });
  }
};

const executeCustomQuery = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') return res.status(400).json({ success: false, message: 'Query requerida' });
    const result = await executeQueryWithParams(query, {}, req.db_name);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error executing custom query:', error);
    res.status(500).json({ success: false, message: 'Error ejecutando consulta', error: error.message });
  }
};

const getHealth = (req, res) => {
  res.json({ success: true, message: 'Servidor funcionando correctamente', timestamp: new Date().toISOString() });
};

module.exports = {
  getVendedores,
  getBodegas,
  getCiudades,
  executeCustomQuery,
  getHealth,
  getEmpresa,
  getDepartamentos
};
