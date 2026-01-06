const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { executeQueryWithParams } = require('../services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('../services/dbConfig.cjs');

// Secret Key for JWT - Should be in .env but fallback for dev
const JWT_SECRET = process.env.JWT_SECRET || 'erp360_secret_key_development_only';

const authController = {
  /**
   * Login user
   */
  login: async (req, res) => {
    try {
      const { username, password, companyId } = req.body;

      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Usuario y contraseña son requeridos' });
      }

      console.log('Login attempt for:', username, 'Company ID:', companyId);

      let targetDbName = process.env.DB_DATABASE; // Default to master/env DB if no companyId

      // 1. Si hay companyId, buscar la configuración de la empresa en la BD Maestra
      if (companyId) {
        try {
          const tenantQuery = `SELECT db_name FROM config_empresas WHERE id = @id AND activo = 1`;
          // Usar executeQueryWithParams sin tercer argumento usa la BD por defecto (Maestra)
          const tenants = await executeQueryWithParams(tenantQuery, { id: companyId });

          if (tenants.length > 0) {
            targetDbName = tenants[0].db_name;
            console.log(`🏢 Empresa encontrada. Conectando a BD: ${targetDbName}`);
          } else {
            console.warn(`⚠️ Empresa con ID ${companyId} no encontrada o inactiva.`);
            return res.status(400).json({ success: false, message: 'Empresa no válida o inactiva' });
          }
        } catch (err) {
          console.error('❌ Error consultando config_empresas:', err);
          // Fallback o error crítico dependiendo de la política
          return res.status(500).json({ success: false, message: 'Error verificando empresa' });
        }
      }

      // 2. Autenticar usuario en la base de datos objetivo (Tenant DB)
      const query = `
        SELECT 
          id, 
          LTRIM(RTRIM(codusu)) as codusu, 
          LTRIM(RTRIM(nomusu)) as nomusu, 
          password_web,
          LTRIM(RTRIM(clausu)) as clausu_legacy,
          tipousu,
          firma
        FROM ${TABLE_NAMES.usuarios}
        WHERE LTRIM(RTRIM(codusu)) = @username AND Activo = 1
      `;

      // Pasar targetDbName como tercer argumento para usar la conexión correcta
      const users = await executeQueryWithParams(query, { username }, targetDbName);
      console.log('Login: Users found:', users.length);

      if (users.length === 0) {
        console.log('Login: User not found in DB');
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      }

      const user = users[0];
      console.log('Login: User found:', user.codusu, 'Has password_web:', !!user.password_web);

      // 3. Verify Password
      let isValid = false;
      if (user.password_web) {
        isValid = await bcrypt.compare(password, user.password_web);
        console.log('Login: Password verification result:', isValid);
      } else {
        console.log('Login: No password_web set');
        isValid = false;
      }

      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      }

      // 4. Update Ultimo_Acceso if valid (en la BD del tenant)
      if (isValid) {
        try {
          const updateAccessQuery = `UPDATE ${TABLE_NAMES.usuarios} SET Ultimo_Acceso = GETDATE() WHERE id = @id`;
          await executeQueryWithParams(updateAccessQuery, { id: user.id }, targetDbName);
        } catch (accessErr) {
          console.error('Error updating Last Access Date:', accessErr);
        }
      }

      // 5. Generate JWT including db_name
      const token = jwt.sign(
        {
          id: user.id,
          codusu: user.codusu,
          role: user.tipousu === 1 ? 'admin' : 'vendedor',
          db_name: targetDbName // IMPORTANT: Include DB name in token for subsequent requests
        },
        process.env.JWT_SECRET || 'erp360_secret_key_development_only',
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            codusu: user.codusu,
            nomusu: user.nomusu,
            role: user.tipousu === 1 ? 'admin' : 'vendedor',
            firma: user.firma,
            empresaDb: targetDbName
          }
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, message: 'Error en el servidor al iniciar sesión' });
    }
  },

  /**
   * Get current user (Verify Token)
   */
  me: async (req, res) => {
    try {
      // Middleware should have already attached user to req
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'No autenticado' });
      }

      // Fetch fresh data incl signature
      const query = `
            SELECT id, LTRIM(RTRIM(codusu)) as codusu, LTRIM(RTRIM(nomusu)) as nomusu, tipousu, firma
            FROM ${TABLE_NAMES.usuarios}
            WHERE id = @id
        `;
      // Use the database from the token (req.db_name)
      const users = await executeQueryWithParams(query, { id: req.user.id }, req.db_name);

      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }

      const user = users[0];

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            codusu: user.codusu,
            nomusu: user.nomusu,
            role: user.tipousu === 1 ? 'admin' : 'vendedor',
            firma: user.firma || null,
            empresaDb: req.db_name // CRITICAL: Return current DB context
          }
        }
      });

    } catch (error) {
      console.error('Me error:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo datos del usuario' });
    }
  },

  /**
   * Update signature
   */
  updateSignature: async (req, res) => {
    try {
      let { firmaBase64 } = req.body;
      const userId = req.user.id; // From middleware

      // Allow null or empty string to delete signature
      if (firmaBase64 === undefined) {
        return res.status(400).json({ success: false, message: 'Firma requerida' });
      }

      // Convert empty string to null for DB
      if (firmaBase64 === '') {
        firmaBase64 = null;
      }

      await executeQueryWithParams(`
            UPDATE ${TABLE_NAMES.usuarios}
            SET firma = @firma
            WHERE id = @id
          `, { firma: firmaBase64, id: userId }, req.db_name);

      res.json({ success: true, message: 'Firma actualizada exitosamente' });

    } catch (error) {
      console.error('Update signature error:', error);
      res.status(500).json({ success: false, message: 'Error actualizando firma' });
    }
  },
  /**
   * Switch Company (Generate new token for target DB)
   */
  switchCompany: async (req, res) => {
    try {
      const { companyId } = req.body;
      const userId = req.user.id;

      if (!companyId) {
        return res.status(400).json({ success: false, message: 'Company ID is required' });
      }

      console.log(`🔄 Switching company for user ${req.user.codusu} to Company ID: ${companyId}`);

      // 1. Get target DB name from Master DB
      const tenantQuery = `SELECT db_name FROM config_empresas WHERE id = @id AND activo = 1`;
      const tenants = await executeQueryWithParams(tenantQuery, { id: companyId });

      if (tenants.length === 0) {
        return res.status(404).json({ success: false, message: 'Empresa no encontrada o inactiva' });
      }

      const targetDbName = tenants[0].db_name;
      console.log(`🏢 New Target DB: ${targetDbName}`);

      // 2. Generate new token with new db_name
      const token = jwt.sign(
        {
          id: userId,
          codusu: req.user.codusu,
          role: req.user.role,
          db_name: targetDbName
        },
        process.env.JWT_SECRET || 'erp360_secret_key_development_only',
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: userId,
            codusu: req.user.codusu,
            role: req.user.role,
            empresaDb: targetDbName
          }
        }
      });

    } catch (error) {
      console.error('Switch company error:', error);
      res.status(500).json({ success: false, message: 'Error al cambiar de empresa' });
    }
  },

  /**
   * Get available companies for the user
   */
  getCompanies: async (req, res) => {
    try {
      // For now, return all active companies. 
      // In a real multi-tenant system, we should filter by user access if there's a mapping table.
      // Assuming 'admin' has access to all, or we just list all active tenants.

      const query = `SELECT id, razon_social as razonSocial, nit, direccion, ciudad, telefono, db_name FROM config_empresas WHERE activo = 1`;
      const companies = await executeQueryWithParams(query, {}); // Uses master DB

      res.json({
        success: true,
        data: companies
      });
    } catch (error) {
      console.error('Get companies error:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo empresas' });
    }
  }
};

module.exports = authController;
