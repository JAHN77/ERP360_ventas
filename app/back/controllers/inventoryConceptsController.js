const { executeQuery, executeQueryWithParams } = require('../services/sqlServerClient.cjs');

const inventoryConceptsController = {
  // Obtener todos los conceptos
  getAllConcepts: async (req, res) => {
    try {
      const query = `
        SELECT 
          codcon, 
          nomcon, 
          codcue, 
          nuecon, 
          tipcon, 
          consys, 
          contable, 
          inicializa_inventario
        FROM inv_conceptos
        ORDER BY codcon
      `;
      const result = await executeQuery(query);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Error fetching inventory concepts:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo conceptos de inventario', error: error.message });
    }
  },

  // Obtener un concepto por código
  getConceptByCode: async (req, res) => {
    try {
      const { codcon } = req.params;
      const query = `
        SELECT *
        FROM inv_conceptos
        WHERE codcon = @codcon
      `;
      const result = await executeQueryWithParams(query, { codcon });
      
      if (result.length === 0) {
        return res.status(404).json({ success: false, message: 'Concepto no encontrado' });
      }

      res.json({ success: true, data: result[0] });
    } catch (error) {
      console.error('Error fetching inventory concept:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo concepto', error: error.message });
    }
  },

  // Crear nuevo concepto
  createConcept: async (req, res) => {
    try {
      const {
        codcon,
        nomcon,
        codcue,
        tipcon,
        nuecon = 0,
        consys = 0,
        contable = 1, // Default to true if not specified
        inicializa_inventario = 0
      } = req.body;

      if (!codcon || !nomcon || !tipcon) {
        return res.status(400).json({ success: false, message: 'Código, nombre y tipo son obligatorios' });
      }

      const checkQuery = `SELECT codcon FROM inv_conceptos WHERE codcon = @codcon`;
      const existing = await executeQueryWithParams(checkQuery, { codcon });
      
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'El código de concepto ya existe' });
      }

      const query = `
        INSERT INTO inv_conceptos (
          codcon, nomcon, codcue, tipcon, nuecon, consys, contable, inicializa_inventario
        ) VALUES (
          @codcon, @nomcon, @codcue, @tipcon, @nuecon, @consys, @contable, @inicializa_inventario
        )
      `;

      const params = {
        codcon,
        nomcon,
        codcue: codcue || '', // Handle optional
        tipcon,
        nuecon: nuecon ? 1 : 0,
        consys: consys ? 1 : 0,
        contable: contable ? 1 : 0,
        inicializa_inventario: inicializa_inventario ? 1 : 0
      };

      await executeQueryWithParams(query, params);
      
      res.json({ success: true, message: 'Concepto creado exitosamente', data: params });
    } catch (error) {
      console.error('Error creating inventory concept:', error);
      res.status(500).json({ success: false, message: 'Error creando concepto', error: error.message });
    }
  },

  // Actualizar concepto
  updateConcept: async (req, res) => {
    try {
      const { codcon: oldCodcon } = req.params;
      const {
        codcon: newCodcon,
        nomcon,
        codcue,
        tipcon,
        nuecon,
        consys,
        contable,
        inicializa_inventario
      } = req.body;

      // Note: Updating PK (codcon) requires handling likely FK constraints elsewhere or assuming ON UPDATE CASCADE.
      const query = `
        UPDATE inv_conceptos
        SET
          codcon = @newCodcon,
          nomcon = @nomcon,
          codcue = @codcue,
          tipcon = @tipcon,
          nuecon = @nuecon,
          consys = @consys,
          contable = @contable,
          inicializa_inventario = @inicializa_inventario
        WHERE codcon = @oldCodcon
      `;

      const params = {
        oldCodcon,
        newCodcon: newCodcon || oldCodcon, // Fallback if not provided
        nomcon,
        codcue: codcue || '',
        tipcon,
        nuecon: nuecon ? 1 : 0,
        consys: consys ? 1 : 0,
        contable: contable ? 1 : 0,
        inicializa_inventario: inicializa_inventario ? 1 : 0
      };

      await executeQueryWithParams(query, params);

      res.json({ success: true, message: 'Concepto actualizado exitosamente' });
    } catch (error) {
      console.error('Error updating inventory concept:', error);
      res.status(500).json({ success: false, message: 'Error actualizando concepto', error: error.message });
    }
  },

  // Eliminar concepto
  deleteConcept: async (req, res) => {
    try {
      const { codcon } = req.params;
      
      // Check if system concept (consys)
      const checkQuery = `SELECT consys FROM inv_conceptos WHERE codcon = @codcon`;
      const concept = await executeQueryWithParams(checkQuery, { codcon });

      if (concept.length === 0) {
        return res.status(404).json({ success: false, message: 'Concepto no encontrado' });
      }

      // Optional: Prevent deletion if consys is true?
      // For now, allowing deletion as requested, but user can add logic here.
      
      const query = `DELETE FROM inv_conceptos WHERE codcon = @codcon`;
      await executeQueryWithParams(query, { codcon });

      res.json({ success: true, message: 'Concepto eliminado exitosamente' });
    } catch (error) {
      console.error('Error deleting inventory concept:', error);
      res.status(500).json({ success: false, message: 'Error eliminando concepto', error: error.message });
    }
  }
};

module.exports = inventoryConceptsController;
