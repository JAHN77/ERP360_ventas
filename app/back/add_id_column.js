const { executeQuery } = require('./services/sqlServerClient.cjs');

async function addIdColumn() {
    const dbName = 'orquidea';
    console.log(`Adding id column to ${dbName}...`);

    try {
        const alterQuery = `
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'gen_usuarios' AND COLUMN_NAME = 'id')
      BEGIN
        ALTER TABLE gen_usuarios ADD id INT IDENTITY(1,1);
        PRINT 'Column id added as IDENTITY.';
      END
      ELSE
      BEGIN
        PRINT 'Column id already exists.';
      END
    `;

        await executeQuery(alterQuery, {}, dbName);
        console.log('Operation completed successfully.');
        process.exit(0);

    } catch (error) {
        console.error('Operation failed:', error);
        process.exit(1);
    }
}

addIdColumn();
