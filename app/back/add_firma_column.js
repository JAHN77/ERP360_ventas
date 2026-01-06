const { executeQuery } = require('./services/sqlServerClient.cjs');

async function addFirmaColumn() {
    const dbName = 'orquidea';
    console.log(`Adding firma column to ${dbName}...`);

    try {
        const alterQuery = `
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'gen_usuarios' AND COLUMN_NAME = 'firma')
      BEGIN
        ALTER TABLE gen_usuarios ADD firma VARCHAR(MAX);
        PRINT 'Column firma added.';
      END
      ELSE
      BEGIN
        PRINT 'Column firma already exists.';
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

addFirmaColumn();
