const sql = require('mssql');
const { executeQuery, executeQueryWithParams, getConnection } = require('../services/sqlServerClient.cjs');
const { TABLE_NAMES, QUERIES } = require('../services/dbConfig.cjs');
const PdfService = require('../services/pdf/PdfService');

const generatePdf = async (req, res) => {
  const { html, fileName } = req.body || {};
  if (!html || typeof html !== 'string' || !html.trim()) {
      return res.status(400).json({ success: false, message: 'El contenido HTML es requerido.' });
  }

  const pdfService = new PdfService();
  try {
      const pdfBuffer = await pdfService.generatePdf(html, {
          fileName,
          format: 'A4',
          margin: { top: '10mm', right: '12mm', bottom: '10mm', left: '12mm' },
          printBackground: true
      });

      res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName || 'documento.pdf'}"`,
          'Content-Length': pdfBuffer.length
      });
      res.send(pdfBuffer);

  } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({
          success: false,
          message: 'Error generando PDF',
          error: error.message
      });
  }
};


const getVendedores = async (req, res) => {
  try {
    const data = await executeQuery(`
      SELECT 
        CAST(ideven AS VARCHAR(20)) as id,
        CAST(ideven AS VARCHAR(20)) as numeroDocumento,
        LTRIM(RTRIM(nomven)) as nombreCompleto,
        codven as codigoVendedor,
        CAST(ideven AS VARCHAR(20)) as codiEmple,
        '' as email,
        CAST(Activo AS INT) as activo
      FROM ven_vendedor
      WHERE Activo = 1
      ORDER BY nomven`);

    const processedData = data.map((item) => {
      const nombreCompleto = item.nombreCompleto || '';
      const partes = nombreCompleto.trim().split(/\s+/);
      return {
        ...item,
        primerNombre: partes[0] || '',
        primerApellido: partes.length > 1 ? partes.slice(1).join(' ') : '',
        nombreCompleto: nombreCompleto.trim(),
        empresaId: 1
      };
    });

    res.json({ success: true, data: processedData });
  } catch (error) {
    console.error('Error fetching vendedores:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo vendedores', error: error.message });
  }
};

const getBodegas = async (req, res) => {
  try {
    const bodegas = await executeQuery(`
      SELECT codalm, RTRIM(nomalm) as nomalm, RTRIM(COALESCE(diralm, '')) as diralm, RTRIM(COALESCE(ciualm, '')) as ciualm, CAST(activo AS INT) as activo
      FROM inv_almacen WHERE activo = 1 ORDER BY codalm
    `);
    const bodegasMapeadas = bodegas.map(b => ({
      id: b.codalm,
      codigo: b.codalm,
      nombre: b.nomalm || 'Sin nombre',
      direccion: b.diralm || '',
      ciudad: b.ciualm || '',
      activo: b.activo === 1 || b.activo === true
    }));
    
    res.set({
      'Cache-Control': 'public, max-age=300, must-revalidate',
      'ETag': `"${Date.now()}-${bodegasMapeadas.length}"`
    });
    res.json({ success: true, data: bodegasMapeadas });
  } catch (error) {
    console.error('Error fetching bodegas:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo bodegas', error: error.message });
  }
};

const getCiudades = async (req, res) => {
  try {
    const ciudades = await executeQuery(`
      SELECT ID as id, nommun as nombre, coddane as codigo, coddep as departamentoId
      FROM gen_municipios ORDER BY nommun ASC
    `);
    res.json({ success: true, data: ciudades });
  } catch (error) {
    console.error('Error obteniendo ciudades:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo ciudades', error: error.message });
  }
};

const executeCustomQuery = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') return res.status(400).json({ success: false, message: 'Query requerida' });
    const result = await executeQuery(query);
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
  generatePdf
};
