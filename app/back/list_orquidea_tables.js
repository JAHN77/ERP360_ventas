const { executeQuery } = require('./services/sqlServerClient.cjs');

async function listOrquideaTables() {
    const dbName = 'orquidea';
    console.log(`Listing tables in ${dbName}...`);

    try {
        const query = `
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE' 
      AND TABLE_NAME LIKE 'ven_%'
      ORDER BY TABLE_NAME
    `;

        const tables = await executeQuery(query, {}, dbName);
        console.log('Tables found:', tables.map(t => t.TABLE_NAME));
        process.exit(0);

    } catch (error) {
        console.error('List failed:', error);
        process.exit(1);
    }
}

listOrquideaTables();
