const { executeQuery } = require('./services/sqlServerClient.cjs');

async function getSchema() {
    const dbName = 'Prueba_ERP360';
    console.log(`Getting schema from ${dbName}...`);

    try {
        // Get columns for ven_remiciones_enc
        const queryEnc = `
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'ven_remiciones_enc'
    `;
        const encCols = await executeQuery(queryEnc, {}, dbName);
        console.log('--- ven_remiciones_enc ---');
        console.log(JSON.stringify(encCols, null, 2));

        // Get columns for ven_remiciones_det
        const queryDet = `
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'ven_remiciones_det'
    `;
        const detCols = await executeQuery(queryDet, {}, dbName);
        console.log('--- ven_remiciones_det ---');
        console.log(JSON.stringify(detCols, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

getSchema();
