const { executeQuery, executeQueryWithParams } = require('../services/sqlServerClient.cjs');
const bcrypt = require('bcryptjs');

async function updateSchema() {
  try {
    console.log('🔄 Checking/Updating gen_usuarios schema...');

    // 1. Check/Add password_web
    try {
      await executeQuery(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'gen_usuarios' AND COLUMN_NAME = 'password_web')
        BEGIN
            ALTER TABLE gen_usuarios ADD password_web VARCHAR(255) NULL;
            PRINT '✅ Column password_web added.';
        END
        ELSE
        BEGIN
            PRINT 'ℹ️ Column password_web already exists.';
        END
      `);
    } catch (e) { console.error('Error adding password_web:', e.message); }

    // 2. Check/Add firma
    try {
      await executeQuery(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'gen_usuarios' AND COLUMN_NAME = 'firma')
        BEGIN
            ALTER TABLE gen_usuarios ADD firma VARCHAR(MAX) NULL;
            PRINT '✅ Column firma added.';
        END
        ELSE
        BEGIN
            PRINT 'ℹ️ Column firma already exists.';
        END
      `);
    } catch (e) { console.error('Error adding firma:', e.message); }

    // 3. Create/Update WEBADMIN user
    const username = 'WEBADMIN';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log(`🔄 Upserting user ${username}...`);
    
    // Check if exists
    const users = await executeQueryWithParams("SELECT * FROM gen_usuarios WHERE codusu = @user", { user: username });
    
    if (users.length > 0) {
        // Update
        await executeQueryWithParams(`
            UPDATE gen_usuarios 
            SET password_web = @pass, 
                nomusu = 'ADMINISTRADOR WEB',
                Activo = 1,
                tipousu = 1 
            WHERE codusu = @user
        `, { user: username, pass: hashedPassword });
        console.log('✅ User WEBADMIN updated with new password.');
    } else {
        // Insert - We need to fill required columns. 
        // Checking schema from previous step: codusu(char 8), nomusu, clausu(varchar 30 - required!), others nullable?
        // Let's assume defaults for others or create minimal.
        // clausu is required, we'll put a dummy legacy password.
        await executeQueryWithParams(`
            INSERT INTO gen_usuarios (codusu, nomusu, clausu, password_web, Activo, tipousu)
            VALUES (@user, 'ADMINISTRADOR WEB', 'LEGACY_IGNORE', @pass, 1, 1)
        `, { user: username, pass: hashedPassword }); // Note: fecha_creacion might not exist, let's remove it if unsafe or check schema again. 
        // Schema checks did not show fecha_creacion. Let's look at schema again quickly.
        // Columns: id, codusu, nomusu, idvendedor, clausu, codcen, tipousu, catusu, vendedor, online, onlinepc, Tecnico, Alias, Activo, IP, Ultimo_Acceso, Terminal, Codi_emple, Tipusu
        // removed fecha_creacion from Insert.
         console.log('✅ User WEBADMIN created.');
    }

  } catch (err) {
    console.error('❌ Error executing script:', err);
    if (err.originalError) console.error('Original Error:', err.originalError);
  } finally {
    process.exit();
  }
}

async function safeInsert() {
     const username = 'WEBADMIN';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Simplified Insert for consistency
    const query = `
        IF EXISTS (SELECT 1 FROM gen_usuarios WHERE codusu = '${username}')
        BEGIN
             UPDATE gen_usuarios SET password_web = '${hashedPassword}', Activo = 1 WHERE codusu = '${username}'
             PRINT 'User updated'
        END
        ELSE
        BEGIN
             INSERT INTO gen_usuarios (codusu, nomusu, clausu, password_web, Activo, tipousu)
             VALUES ('${username}', 'ADMINISTRADOR WEB', 'xxx', '${hashedPassword}', 1, 1)
             PRINT 'User inserted'
        END
    `;
    // We use direct query string for this specific setup script to avoid param issues if odd drivers, but params are safer. 
    // Reverting to params structure above in updateSchema function, but removing fecha_creacion.
}

// Redefining schema update with correct columns from exploration
async function run() {
    await updateSchema();
}

run();
