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
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Usuario y contraseña son requeridos' });
      }

      // 1. Find user by codusu
      // We limit to active users
      console.log('Login attempt for:', username);
      
      const query = `
        SELECT 
          LTRIM(RTRIM(codusu)) as codusu, 
          LTRIM(RTRIM(nomusu)) as nomusu, 
          password_web,
          LTRIM(RTRIM(clausu)) as clausu_legacy,
          tipousu,
          firma
        FROM ${TABLE_NAMES.usuarios}
        WHERE LTRIM(RTRIM(codusu)) = @username AND Activo = 1
      `;
      
      const users = await executeQueryWithParams(query, { username });
      console.log('Login: Users found:', users.length);

      if (users.length === 0) {
        console.log('Login: User not found in DB');
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      }

      const user = users[0];
      console.log('Login: User found:', user.codusu, 'Has password_web:', !!user.password_web);

      // 2. Verify Password
      // Check password_web first (Primary for web access)
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

      console.log('Login: Password verification result:', isValid);

      // 3. Update Ultimo_Acceso if valid
      if (isValid) {
          try {
              const updateAccessQuery = `UPDATE ${TABLE_NAMES.usuarios} SET Ultimo_Acceso = GETDATE() WHERE codusu = @codusu`;
              await executeQueryWithParams(updateAccessQuery, { codusu: user.codusu });
          } catch (accessErr) {
              console.error('Error updating Last Access Date:', accessErr);
              // Non-blocking error
          }
      }

      // Generate JWT
      const token = jwt.sign(
        { 
          id: user.codusu, // Using codusu as ID since actual ID doesn't exist
          codusu: user.codusu, 
          role: user.tipousu === 1 ? 'admin' : 'vendedor' 
        },
        process.env.JWT_SECRET || 'erp360_secret_key_development_only',
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        data: {
            token,
            user: {
                id: user.codusu,
                codusu: user.codusu,
                nomusu: user.nomusu,
                role: user.tipousu === 1 ? 'admin' : 'vendedor',
                firma: user.firma
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
            SELECT LTRIM(RTRIM(codusu)) as codusu, LTRIM(RTRIM(nomusu)) as nomusu, tipousu, firma
            FROM ${TABLE_NAMES.usuarios}
            WHERE codusu = @id
        `;
        // req.user.id is actually codusu now
        const users = await executeQueryWithParams(query, { id: req.user.id });
        
        if (users.length === 0) {
             return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }
        
        const user = users[0];
        
        res.json({
            success: true,
            data: {
                user: {
                    id: user.codusu,
                    codusu: user.codusu,
                    nomusu: user.nomusu,
                    role: user.tipousu === 1 ? 'admin' : 'vendedor',
                    firma: user.firma || null
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
            WHERE codusu = @id
          `, { firma: firmaBase64, id: userId });
          
          res.json({ success: true, message: 'Firma actualizada exitosamente' });
          
      } catch (error) {
          console.error('Update signature error:', error);
          res.status(500).json({ success: false, message: 'Error actualizando firma' });
      }
  }
};

module.exports = authController;
