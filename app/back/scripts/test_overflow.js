const { executeQuery, getConnectionForDb } = require('../services/sqlServerClient.cjs');
const sql = require('mssql');

(async () => {
    try {
        console.log('Testing numeric(4,2) overflow...');
        const pool = await getConnectionForDb();
        const tx = new sql.Transaction(pool);
        await tx.begin();

        try {
            const req = new sql.Request(tx);
            // Try to simulate insertion of 100 into decimal(4,2)
            // In SQL: DECLARE @v decimal(4,2) = 100; raises error.

            // We can test this by running a simple query
            req.input('val', sql.Decimal(4, 2), 100);
            await req.query('SELECT @val as res');

            console.log('Success (unexpected)');
        } catch (e) {
            console.log('Caught expected error for 100:', e.message);
        }

        try {
            const req = new sql.Request(tx);
            req.input('val', sql.Decimal(4, 2), 99.99);
            await req.query('SELECT @val as res');
            console.log('Success for 99.99');
        } catch (e) {
            console.log('Error for 99.99:', e.message);
        }

        try {
            const req = new sql.Request(tx);
            // Test quantity overflow for numeric(9,2) -> max 9,999,999.99
            // Try 10,000,000
            req.input('val', sql.Decimal(9, 2), 10000000);
            await req.query('SELECT @val as res');
            console.log('Success for 10,000,000 (unexpected)');
        } catch (e) {
            console.log('Caught expected error for 10,000,000 into (9,2):', e.message);
        }

        await tx.rollback();

    } catch (e) {
        console.error('Script Error:', e);
    } finally {
        process.exit();
    }
})();
