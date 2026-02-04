const { executeQuery, executeQueryWithParams } = require('../services/sqlServerClient.cjs');
const bcrypt = require('bcryptjs');

async function migrate() {
    try {
        console.log('🚀 Iniciando ajuste de tabla gen_usuarios...');

        // 1. Agregar columnas necesarias
        const columnsToAdd = [
            { name: 'password_web', type: 'VARCHAR(255)' },
            { name: 'email', type: 'VARCHAR(100)' },
            { name: 'rol', type: 'VARCHAR(50)' },
            { name: 'last_login', type: 'DATETIME' }
        ];

        for (const col of columnsToAdd) {
            console.log(`Checking column ${col.name}...`);
            await executeQuery(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'gen_usuarios' AND COLUMN_NAME = '${col.name}')
        BEGIN
            ALTER TABLE gen_usuarios ADD ${col.name} ${col.type} NULL;
            PRINT '✅ Columna ${col.name} agregada.';
        END
        ELSE
        BEGIN
            PRINT 'ℹ️ Columna ${col.name} ya existe.';
        END
      `);
        }

        // 2. Crear usuario administrador para pruebas
        const adminUser = 'admin';
        const adminPass = 'admin123';
        const hashedPassword = await bcrypt.hash(adminPass, 10);

        console.log(`👤 Configurando usuario administrador: ${adminUser}`);

        const existingUser = await executeQueryWithParams(
            'SELECT * FROM gen_usuarios WHERE codusu = @user',
            { user: adminUser }
        );

        if (existingUser.length > 0) {
            console.log('Updating existing admin user...');
            await executeQueryWithParams(`
        UPDATE gen_usuarios 
        SET password_web = @pass, 
            nomusu = 'ADMINISTRADOR SISTEMA',
            email = 'admin@erp360.com',
            rol = 'ADMIN',
            Activo = 1
        WHERE codusu = @user
      `, { user: adminUser, pass: hashedPassword });
            console.log('✅ Usuario admin actualizado.');
        } else {
            console.log('Inserting new admin user...');
            // Usamos una clave legacy dummy para la columna clausu que es requerida por el sistema antiguo
            await executeQueryWithParams(`
        INSERT INTO gen_usuarios (codusu, nomusu, clausu, password_web, email, rol, Activo)
        VALUES (@user, 'ADMINISTRADOR SISTEMA', 'EXT_USR', @pass, 'admin@erp360.com', 'ADMIN', 1)
      `, { user: adminUser, pass: hashedPassword });
            console.log('✅ Usuario admin creado.');
        }

        console.log('\n✨ Proceso completado con éxito.');
    } catch (err) {
        console.error('❌ Error durante la migración:', err);
    } finally {
        process.exit();
    }
}

migrate();
