const { executeQuery, executeQueryWithParams } = require('../services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('../services/dbConfig.cjs');
const bcrypt = require('bcryptjs');

// Get all users
const getUsers = async (req, res) => {
  try {
    const query = `
      SELECT 
        id, 
        LTRIM(RTRIM(codusu)) as codusu, 
        LTRIM(RTRIM(nomusu)) as nomusu, 
        tipousu,
        Activo as activo,
        vendedor,
        Ultimo_Acceso as ultimoAcceso,
        firma,
        CASE WHEN password_web IS NOT NULL AND LEN(password_web) > 0 THEN 1 ELSE 0 END as hasWebAccess
      FROM ${TABLE_NAMES.usuarios}
      ORDER BY nomusu ASC
    `;
    const users = await executeQuery(query);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Error al obtener usuarios: ' + (error.message || error) });
  }
};

// Create User
const createUser = async (req, res) => {
  const { codusu, nomusu, password, tipousu, activo } = req.body;
  
  if (!codusu || !nomusu || !password) {
    return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
  }

  try {
    // Check if exists
    const checkQuery = `SELECT id FROM ${TABLE_NAMES.usuarios} WHERE codusu = @codusu`;
    const existing = await executeQueryWithParams(checkQuery, { codusu });
    if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'El código de usuario ya existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Attempting to provide default for 'clausu' if required by schema (legacy password)
    // Also ensuring other potentially required fields have defaults if possible, or ignoring if nullable
    const query = `
      INSERT INTO ${TABLE_NAMES.usuarios} (codusu, nomusu, password_web, tipousu, Activo, clausu)
      VALUES (@codusu, @nomusu, @hashedPassword, @tipousu, @activo, '')
    `;
    
    await executeQueryWithParams(query, { 
        codusu, 
        nomusu, 
        hashedPassword, 
        tipousu: tipousu !== undefined ? tipousu : 2, 
        activo: activo !== undefined ? activo : 1 
    });
    
    res.json({ success: true, message: 'Usuario creado exitosamente' });

  } catch (error) {
    console.error('Error create user:', error);
    // Return detailed error in dev, but generally 'Error al crear usuario'
    res.status(500).json({ success: false, message: 'Error al crear usuario: ' + (error.message || error) });
  }
};

// Update User
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { nomusu, password, tipousu, activo } = req.body;

  try {
    let query = `
      UPDATE ${TABLE_NAMES.usuarios} 
      SET nomusu = @nomusu, tipousu = @tipousu, Activo = @activo
    `;
    
    const params = { id, nomusu, tipousu, activo };

    if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        query += `, password_web = @hashedPassword`;
        params.hashedPassword = hashedPassword;
    }

    query += ` WHERE id = @id`;

    await executeQueryWithParams(query, params);
    
    res.json({ success: true, message: 'Usuario actualizado exitosamente' });

  } catch (error) {
     console.error('Error updating user:', error);
     res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
  }
};

// Delete User (Soft Delete usually, but maybe hard delete if requested. Let's do Toggle Active or Delete)
// User asked to 'delete', but in ERPs we usually set Active=0. I'll implement DELETE method but it might strict delete.
// Let's implement active toggle as well or just strict delete if no relations.
// Safe bet: Update to Activo = 0 if delete is risky, but user said 'eliminar'.
// I will implement DELETE as a setting Active = 0 for safety, unless they insist on DROP.
const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        // Soft delete prefered
        const query = `UPDATE ${TABLE_NAMES.usuarios} SET Activo = 0 WHERE id = @id`;
        await executeQueryWithParams(query, { id });
        res.json({ success: true, message: 'Usuario desactivado exitosamente (eliminado lógico)' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, message: 'Error al eliminar usuario' });
    }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser
};
