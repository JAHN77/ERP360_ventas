const fs = require('fs');
const path = require('path');
const { executeQuery } = require('./services/sqlServerClient.cjs');

async function applyFixes() {
    const dbs = ['orquidea', 'Prueba_ERP360'];
    const sqlPath = path.join(__dirname, 'db', 'fix_database_v2.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');

    // Split script by GO or just run as one block if no GO
    const commands = sqlScript.split(/\bGO\b/i).filter(cmd => cmd.trim().length > 0);

    for (const dbName of dbs) {
        console.log(`\n--- Applying fixes to ${dbName} ---`);
        for (const command of commands) {
            try {
                await executeQuery(command, {}, dbName);
                console.log(`✅ Command executed successfully in ${dbName}`);
            } catch (error) {
                console.error(`❌ Error executing command in ${dbName}:`, error.message);
                // Continue with next command
            }
        }
    }
    console.log('\nAll fixes applied.');
    process.exit(0);
}

applyFixes();
