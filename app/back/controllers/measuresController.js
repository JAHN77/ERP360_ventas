const { executeQuery } = require('../services/sqlServerClient.cjs');

const measuresController = {
  getAllMeasures: async (req, res) => {
    try {
      // Fetch Measures from inv_medidas
      // Correct columns for inv_medidas (based on schema mentioned in previous sessions)
      // nommed -> nombre, codmed -> codigo
      const query = `
        SELECT 
          LTRIM(RTRIM(codmed)) as [id],
          LTRIM(RTRIM(codmed)) as [codigo],
          LTRIM(RTRIM(nommed)) as [nombre],
          LTRIM(RTRIM(nommed)) as [abreviatura]
        FROM inv_medidas
        ORDER BY nommed
      `;
      const result = await executeQuery(query);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Error fetching measures:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo medidas', error: error.message });
    }
  }
};

module.exports = measuresController;
