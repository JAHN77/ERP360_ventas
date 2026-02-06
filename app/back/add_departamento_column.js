const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { executeQuery } = require('./services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('./services/dbConfig.cjs');

async function addDepartamentoColumn() {
    const dbName = process.env.DB_DATABASE || 'ERP360_ventas'; // Default or from env
    console.log(`Checking for departamento column in ${TABLE_NAMES.clientes} (${dbName})...`);

    try {
        const alterQuery = `
      IF NOT EXISTS (
        SELECT * 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = '${TABLE_NAMES.clientes}' 
        AND COLUMN_NAME = 'departamento'
      )
      BEGIN
        ALTER TABLE ${TABLE_NAMES.clientes} ADD departamento VARCHAR(50) DEFAULT '';
        PRINT 'Column departamento added to ${TABLE_NAMES.clientes}.';
      END
      ELSE
      BEGIN
        PRINT 'Column departamento already exists in ${TABLE_NAMES.clientes}.';
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

addDepartamentoColumn();
