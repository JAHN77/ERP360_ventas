const { executeQuery } = require('./services/sqlServerClient.cjs');

async function findTable() {
    const databases = await executeQuery('SELECT name FROM sys.databases');

    for (const db of databases) {
        if (['master', 'tempdb', 'model', 'msdb'].includes(db.name)) continue;

        try {
            const result = await executeQuery(`SELECT COUNT(*) as count FROM sys.tables WHERE name = 'con_terceros'`, [], db.name);
            if (result[0].count > 0) {
                console.log(`✅ FOUND con_terceros in database: ${db.name}`);
            } else {
                // console.log(`❌ Not found in ${db.name}`);
            }
        } catch (err) {
            console.error(`Error checking ${db.name}: ${err.message}`);
        }
    }
    process.exit(0);
}

findTable();
