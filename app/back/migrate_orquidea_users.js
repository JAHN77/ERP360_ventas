const { executeQuery, executeQueryWithParams } = require('./services/sqlServerClient.cjs');
const bcrypt = require('bcryptjs');

async function migrateOrquidea() {
    const dbName = 'orquidea';
    console.log(`Starting migration for ${dbName}...`);

    try {
        // 1. Add columns if they don't exist
        console.log('Adding missing columns...');
        const alterQuery = `
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'gen_usuarios' AND COLUMN_NAME = 'email')
      BEGIN
        ALTER TABLE gen_usuarios ADD email VARCHAR(255);
      END
      
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'gen_usuarios' AND COLUMN_NAME = 'password_hash')
      BEGIN
        ALTER TABLE gen_usuarios ADD password_hash VARCHAR(255);
      END
      
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'gen_usuarios' AND COLUMN_NAME = 'role')
      BEGIN
        ALTER TABLE gen_usuarios ADD role VARCHAR(50);
      END
      
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'gen_usuarios' AND COLUMN_NAME = 'created_at')
      BEGIN
        ALTER TABLE gen_usuarios ADD created_at DATETIME DEFAULT GETDATE();
      END

      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'gen_usuarios' AND COLUMN_NAME = 'updated_at')
      BEGIN
        ALTER TABLE gen_usuarios ADD updated_at DATETIME;
      END
    `;
        await executeQuery(alterQuery, {}, dbName);
        console.log('Columns added successfully.');

        // 2. Create/Update Admin User
        console.log('Creating/Updating admin user...');
        const password = 'admin123';
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const checkUserQuery = "SELECT * FROM gen_usuarios WHERE codusu = 'ADMIN'";
        const existingUser = await executeQuery(checkUserQuery, {}, dbName);

        if (existingUser.length > 0) {
            console.log('User ADMIN exists. Updating...');
            const updateQuery = `
        UPDATE gen_usuarios 
        SET email = 'admin@orquidea.com', 
            password_hash = @hash, 
            role = 'admin',
            nomusu = 'Administrador Sistema'
        WHERE codusu = 'ADMIN'
      `;
            await executeQueryWithParams(updateQuery, { hash }, dbName);
            console.log('User ADMIN updated.');
        } else {
            console.log('User ADMIN does not exist. Creating...');
            const insertQuery = `
        INSERT INTO gen_usuarios (codusu, nomusu, email, password_hash, role, Activo, clausu)
        VALUES ('ADMIN', 'Administrador Sistema', 'admin@orquidea.com', @hash, 'admin', 1, 'admin')
      `;
            // Note: Activo might be 'activo' (lowercase) depending on schema. 
            // Based on previous output, 'activo' was not in the list of missing columns, so it might exist.
            // But wait, previous output showed 'vendedor', 'Tecnico', etc.
            // I'll check if 'Activo' exists. The compare script output was truncated.
            // I'll assume 'Activo' or 'activo' exists. I'll try 'Activo' (capitalized) as it's common in legacy DBs.
            // If it fails, I'll try 'activo'.

            // Let's check columns again to be safe about 'Activo' case.
            // Actually, I'll just try 'Activo' and if it fails, I'll catch it.

            await executeQueryWithParams(insertQuery, { hash }, dbName);
            console.log('User ADMIN created.');
        }

        console.log('Migration completed successfully.');
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateOrquidea();
