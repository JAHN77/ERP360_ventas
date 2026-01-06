require('dotenv').config({ path: 'app/back/.env' });
const { executeQueryWithParams } = require('./services/sqlServerClient.cjs');

async function checkOrquideaData() {
    try {
        console.log('Checking Orquidea Data...');
        const dbName = 'orquidea'; // The name used in connection config

        // 1. Check Clientes
        console.log('\n--- Clientes (con_terceros) ---');
        const clientes = await executeQueryWithParams('SELECT TOP 5 * FROM con_terceros', {}, dbName);
        console.log(`Total clientes found: ${clientes.length}`);
        if (clientes.length > 0) {
            console.log('Cliente columns:', Object.keys(clientes[0]));
            console.log('First 3 clientes:', clientes.slice(0, 3));
        }


        // 2. Check Facturas
        console.log('\n--- Facturas (ven_facturas) ---');
        const facturas = await executeQueryWithParams('SELECT TOP 5 * FROM ven_facturas ORDER BY numfact DESC', {}, dbName);
        console.log(`Total facturas found: ${facturas.length}`);
        if (facturas.length > 0) {
            console.log('Factura columns:', Object.keys(facturas[0]));
            console.log('First 3 facturas:', facturas.slice(0, 3));
        }
        // 3. Check Empresa
        console.log('\n--- Empresa (gen_empresa) ---');
        const empresa = await executeQueryWithParams('SELECT TOP 1 * FROM gen_empresa', {}, dbName);
        if (empresa.length > 0) {
            console.log('Empresa columns:', Object.keys(empresa[0]));
            console.log('Empresa data:', empresa[0]);
        }

    } catch (error) {
        console.error('Error checking data:', error);
    }
}

checkOrquideaData();
