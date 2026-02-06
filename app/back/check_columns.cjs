const { executeQuery, getConnection } = require('./services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('./services/dbConfig.cjs');

async function checkColumns() {
  try {
    const query = `
      SELECT TABLE_NAME, COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME IN ('ven_remisiones', 'ven_detaremision')
      ORDER BY TABLE_NAME, COLUMN_NAME
    `;
    const result = await executeQuery(query, {}, 'CicleBike');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkColumns();
