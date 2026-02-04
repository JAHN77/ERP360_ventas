const { getConnection, executeQueryWithParams } = require('../services/sqlServerClient.cjs');

async function debugInvoice() {
    try {
        console.log('Connecting...');
        const pool = await getConnection();

        // 1. Get the Invoice
        console.log('\n--- Factura #21 (or latest) ---');
        const invoices = await executeQueryWithParams(`
            SELECT TOP 1 * FROM ven_facturas ORDER BY ID DESC
        `);
        console.log(invoices[0]);
        const invoice = invoices[0];

        if (!invoice) return;

        // 2. Get the Details
        console.log('\n--- Detalles for ID ' + invoice.ID + ' ---');
        const details = await executeQueryWithParams(`
            SELECT * FROM ven_detafact WHERE id_factura = @id
        `, { id: invoice.ID });
        console.log(details);

        // 3. Check Client
        console.log('\n--- Cliente ' + invoice.codter + ' ---');
        const client = await executeQueryWithParams(`
            SELECT * FROM con_terceros WHERE LTRIM(RTRIM(codter)) = LTRIM(RTRIM(@codter))
        `, { codter: invoice.codter });
        console.log(client);

        // 4. Check Product
        const details2 = await executeQueryWithParams(`SELECT * FROM ven_detafact WHERE id_factura = @id`, { id: invoice.ID });
        if (details2.length > 0) {
            console.log('\n--- Producto ' + details2[0].codins + ' ---');
            const product = await executeQueryWithParams(`
                SELECT * FROM inv_insumos WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(@codins))
            `, { codins: details2[0].codins });
            console.log('Product Found:', product.length);
        }

        // 5. Simulate getAllInvoices for this specific invoice
        console.log('\n--- Simulating getAllInvoices Query ---');
        const simulated = await executeQueryWithParams(`
            SELECT 
                f.ID, f.codter, 
                CASE 
                    WHEN t.nomter IS NOT NULL AND LTRIM(RTRIM(t.nomter)) != '' THEN LTRIM(RTRIM(t.nomter))
                    ELSE NULL
                END as clienteNombre
            FROM ven_facturas f
            LEFT JOIN con_terceros t ON LTRIM(RTRIM(f.codter)) = LTRIM(RTRIM(t.codter))
            WHERE f.ID = @id
        `, { id: invoice.ID });
        console.log(simulated[0]);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugInvoice();
