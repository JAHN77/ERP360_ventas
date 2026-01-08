const { executeQuery } = require('./services/sqlServerClient.cjs');
const { TABLE_NAMES } = require('./services/dbConfig.cjs');
require('dotenv').config();

async function listOrders() {
    try {
        const targetDb = 'Prueba_ERP360';
        console.log(`Listing orders in ${targetDb}...`);
        const orders = await executeQuery(`SELECT TOP 5 id, numero_pedido FROM ${TABLE_NAMES.pedidos} ORDER BY id DESC`, [], targetDb);
        console.log('Orders found:', orders.length);
        orders.forEach(o => {
            console.log(`ID: ${o.id}, Number: ${o.numero_pedido}`);
        });
    } catch (error) {
        console.error('Error listing orders:', error);
    }
}

listOrders();
