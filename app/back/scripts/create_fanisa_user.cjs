const { executeQuery, executeQueryWithParams } = require('../services/sqlServerClient.cjs');
const bcrypt = require('bcryptjs');

async function createFanisaUser() {
  try {
    const username = 'FANISA';
    const password = 'fanisa2026'; // Contraseña web
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log(`🔄 Procesando usuario ${username}...`);
    
    // Verificar si el usuario ya existe
    const users = await executeQueryWithParams("SELECT * FROM gen_usuarios WHERE codusu = @user", { user: username });
    
    if (users.length > 0) {
        // Actualizar usuario existente
        await executeQueryWithParams(`
            UPDATE gen_usuarios 
            SET password_web = @pass, 
                nomusu = 'ADMINISTRADOR FANISA',
                Activo = 1,
                tipousu = 1 
            WHERE codusu = @user
        `, { user: username, pass: hashedPassword });
        console.log(`✅ Usuario ${username} actualizado correctamente.`);
    } else {
        // Insertar nuevo usuario
        // clausu es obligatorio en el esquema legacy, usamos un valor placeholder
        await executeQueryWithParams(`
            INSERT INTO gen_usuarios (codusu, nomusu, clausu, password_web, Activo, tipousu)
            VALUES (@user, 'ADMINISTRADOR FANISA', 'LEGACY_PASS', @pass, 1, 1)
        `, { user: username, pass: hashedPassword });
        console.log(`✅ Usuario ${username} creado exitosamente.`);
    }

  } catch (err) {
    console.error('❌ Error creando usuario FANISA:', err);
  } finally {
    process.exit();
  }
}

createFanisaUser();
