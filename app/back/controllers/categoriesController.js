const { executeQuery, executeQueryWithParams } = require('../services/sqlServerClient.cjs');

const categoriesController = {
  // GET /api/categorias/lineas-sublineas
  getLinesWithSublines: async (req, res) => {
    try {
      // Fetch Lines
      const linesQuery = `
        SELECT 
          codline, 
          RTRIM(nomline) as nomline, 
          controla_servicios, 
          tasamayor
        FROM inv_lineas 
        ORDER BY codline
      `;
      const lines = await executeQuery(linesQuery, req.db_name);

      // Fetch Sublines
      const sublinesQuery = `
        SELECT 
          codsub, 
          codline, 
          RTRIM(nomsub) as nomsub 
        FROM inv_sublinea 
        ORDER BY codline, codsub
      `;
      const sublines = await executeQuery(sublinesQuery, req.db_name);

      // Merge manually to create a nested structure
      const result = lines.map(line => {
        const lineSublines = sublines.filter(sub => sub.codline === line.codline);
        return {
          ...line,
          sublineas: lineSublines
        };
      });

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Error fetching lines and sublines:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo líneas', error: error.message });
    }
  },

  // GET /api/categorias/lineas
  getLines: async (req, res) => {
    try {
      const result = await executeQuery('SELECT * FROM inv_lineas ORDER BY codline', req.db_name);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error', error: error.message });
    }
  },

  // POST /api/categorias/lineas
  createLine: async (req, res) => {
    const { codline, nomline, controla_servicios, tasamayor, estado } = req.body;
    try {
      if (!codline || !nomline) {
        return res.status(400).json({ success: false, message: 'Código y nombre son requeridos' });
      }

      const query = `
        INSERT INTO inv_lineas (codline, nomline, controla_servicios, tasamayor, estado)
        VALUES (@codline, @nomline, @controla_servicios, @tasamayor, @estado)
      `;

      await executeQueryWithParams(query, {
        codline,
        nomline,
        controla_servicios: controla_servicios || 0,
        tasamayor: tasamayor || 0,
        estado: estado !== undefined ? estado : 1
      }, req.db_name);

      res.json({ success: true, message: 'Línea creada correctamente' });
    } catch (error) {
      console.error('Error creating line:', error);
      res.status(500).json({ success: false, message: 'Error creando línea', error: error.message });
    }
  },

  // PUT /api/categorias/lineas/:id
  updateLine: async (req, res) => {
    const { id } = req.params; // old codline
    const { codline, nomline, controla_servicios, tasamayor, estado } = req.body;

    try {
      const query = `
        UPDATE inv_lineas 
        SET nomline = @nomline, 
            controla_servicios = @controla_servicios,
            tasamayor = @tasamayor,
            estado = @estado
            ${codline !== id ? ', codline = @codline' : ''}
        WHERE codline = @id
      `;

      const params = {
        id,
        nomline,
        controla_servicios: controla_servicios || 0,
        tasamayor: tasamayor || 0,
        estado: estado !== undefined ? estado : 1
      };

      if (codline !== id) {
        params.codline = codline;
      }

      await executeQueryWithParams(query, params, req.db_name);

      res.json({ success: true, message: 'Línea actualizada correctamente' });
    } catch (error) {
      console.error('Error updating line:', error);
      res.status(500).json({ success: false, message: 'Error actualizando línea', error: error.message });
    }
  },

  // DELETE /api/categorias/lineas/:id
  deleteLine: async (req, res) => {
    const { id } = req.params;
    try {
      // Check for related products or sublines before deleting might be good, 
      // but for now we'll rely on DB constraints or basic delete
      const query = 'DELETE FROM inv_lineas WHERE codline = @id';
      await executeQueryWithParams(query, { id }, req.db_name);

      res.json({ success: true, message: 'Línea eliminada correctamente' });
    } catch (error) {
      console.error('Error deleting line:', error);
      res.status(500).json({ success: false, message: 'Error eliminando línea', error: error.message });
    }
  },

  // POST /api/categorias/sublineas
  createSubline: async (req, res) => {
    const { codsub, codline, nomsub } = req.body;
    try {
      if (!codsub || !codline || !nomsub) {
        return res.status(400).json({ success: false, message: 'Código, línea y nombre son requeridos' });
      }

      const query = `
        INSERT INTO inv_sublinea (codsub, codline, nomsub)
        VALUES (@codsub, @codline, @nomsub)
      `;

      await executeQueryWithParams(query, { codsub, codline, nomsub }, req.db_name);

      res.json({ success: true, message: 'Sublínea creada correctamente' });
    } catch (error) {
      console.error('Error creating subline:', error);
      res.status(500).json({ success: false, message: 'Error creando sublínea', error: error.message });
    }
  },

  // PUT /api/categorias/sublineas/:codline/:codsub
  updateSubline: async (req, res) => {
    const { codline, codsub } = req.params;
    const { nomsub, newCodsub } = req.body; // allow changing codsub if needed

    try {
      const query = `
        UPDATE inv_sublinea 
        SET nomsub = @nomsub
            ${newCodsub && newCodsub !== codsub ? ', codsub = @newCodsub' : ''}
        WHERE codline = @codline AND codsub = @codsub
      `;

      const params = {
        codline,
        codsub,
        nomsub
      };

      if (newCodsub && newCodsub !== codsub) {
        params.newCodsub = newCodsub;
      }

      await executeQueryWithParams(query, params, req.db_name);

      res.json({ success: true, message: 'Sublínea actualizada correctamente' });
    } catch (error) {
      console.error('Error updating subline:', error);
      res.status(500).json({ success: false, message: 'Error actualizando sublínea', error: error.message });
    }
  },

  // DELETE /api/categorias/sublineas/:codline/:codsub
  deleteSubline: async (req, res) => {
    const { codline, codsub } = req.params;
    try {
      const query = 'DELETE FROM inv_sublinea WHERE codline = @codline AND codsub = @codsub';
      await executeQueryWithParams(query, { codline, codsub }, req.db_name);

      res.json({ success: true, message: 'Sublínea eliminada correctamente' });
    } catch (error) {
      console.error('Error deleting subline:', error);
      res.status(500).json({ success: false, message: 'Error eliminando sublínea', error: error.message });
    }
  },

  getAllCategories: async (req, res) => {
    try {
      const result = await executeQuery(`
        SELECT 
          codline as [id],
          codline as [codigo],
          RTRIM(nomline) as [nombre]
        FROM inv_lineas
        ORDER BY nomline
      `, req.db_name);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo categorías', error: error.message });
    }
  }
};

module.exports = categoriesController;
