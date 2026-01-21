const { executeQuery } = require('./services/sqlServerClient.cjs');

async function countInvoices() {
    const dbName = 'orquidea';
    console.log(`Counting invoices in ${dbName}...`);

    try {
        const query = "SELECT COUNT(*) as count FROM ven_facturas";
        const results = await executeQuery(query, {}, dbName);
        console.log('Invoice count:', results[0].count);

        if (results[0].count > 0) {
            const sampleQuery = "SELECT TOP 1 * FROM ven_facturas";
            const sample = await executeQuery(sampleQuery, {}, dbName);
            console.log('Sample invoice:', sample[0]);
        }

        process.exit(0);
    } catch (error) {
        console.error('Count failed:', error);
        process.exit(1);
    }
}

countInvoices();
