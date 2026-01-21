const { executeQuery } = require('../services/sqlServerClient.cjs');

async function checkTables() {
  try {
    console.log('🕵️‍♀️ Verificando conexión y tablas...');

    // 1. Check current database
    const dbResult = await executeQuery("SELECT DB_NAME() AS CurrentDB;");
    const currentDb = dbResult[0]?.CurrentDB;
    console.log(`📂 Base de datos actual: ${currentDb}`);

    // 2. List web tables
    const tableResult = await executeQuery(`
      SELECT name, crdate 
      FROM sysobjects 
      WHERE name LIKE '%_web' AND xtype='U'
      ORDER BY name;
    `);

    if (tableResult.length > 0) {
      console.log('✅ Tablas encontradas:');
      tableResult.forEach(t => console.log(`   - ${t.name} (Creada: ${t.crdate})`));
    } else {
      console.log('⚠️ No se encontraron tablas terminadas en _web.');
    }

    // 3. List user FANISA
    const userResult = await executeQuery("SELECT codusu, nomusu FROM gen_usuarios WHERE codusu IN ('WEBADMIN', 'FANISA')");
    console.log('👤 Usuarios de prueba:');
    userResult.forEach(u => console.log(`   - ${u.codusu}: ${u.nomusu}`));

  } catch (err) {
    console.error('❌ Error verificando:', err);
  } finally {
    process.exit();
  }
}

checkTables();
