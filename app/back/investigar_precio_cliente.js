const sql = require('mssql');

const config = {
    user: 'sa',
    password: 'Colfon2023.',
    server: 'ServerHP\\CLIENTES',
    database: 'orquidea',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        connectionTimeout: 30000,
        requestTimeout: 30000
    }
};

async function investigar() {
    try {
        await sql.connect(config);
        console.log('✅ Conectado a la base de datos\n');

        // 1. Ver qué codtar tienen los clientes
        console.log('1. CODTAR DE LOS CLIENTES');
        console.log('═'.repeat(80));
        const clientes = await sql.query`
            SELECT 
                codter,
                nomter,
                codtar,
                (SELECT nomtar FROM inv_tarifas WHERE codtar = t.codtar) as nombre_tarifa
            FROM con_terceros t
            WHERE nomter LIKE '%CUANTIAS MENORES%' 
               OR nomter LIKE '%PACHECO BARCAS%'
        `;
        console.table(clientes.recordset);

        // 2. Ver precios del producto TRICICLO en diferentes tarifas
        console.log('\n2. PRECIOS DEL PRODUCTO "TRICICLO PROFIT SPEED" EN DIFERENTES TARIFAS');
        console.log('═'.repeat(80));
        const precios = await sql.query`
            SELECT 
                i.codins,
                i.nomins,
                dp.Codtar,
                (SELECT nomtar FROM inv_tarifas WHERE codtar = dp.Codtar) as nombre_tarifa,
                dp.valins as precio,
                dp.margen
            FROM inv_insumos i
            LEFT JOIN inv_detaprecios dp ON i.codins = dp.codins
            WHERE i.nomins LIKE '%TRICICLO PROFIT SPEED%'
            ORDER BY dp.Codtar
        `;
        console.table(precios.recordset);

        // 3. Ver si existe "CUANTIAS MENORES" como cliente
        console.log('\n3. BÚSQUEDA EXACTA DE CLIENTES');
        console.log('═'.repeat(80));
        const busqueda = await sql.query`
            SELECT TOP 5
                codter,
                nomter,
                codtar
            FROM con_terceros
            WHERE nomter LIKE '%MENORES%' OR nomter LIKE '%PACHECO%'
        `;
        console.table(busqueda.recordset);

        await sql.close();
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

investigar();
