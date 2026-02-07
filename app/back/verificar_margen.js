const sql = require('mssql');

const config = {
    server: '179.33.214.87',
    port: 1537,
    database: 'cicleBike',
    user: 'sa',
    password: 'M0b1l$2026&yvK@',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function verificarProducto() {
    let pool;
    
    try {
        console.log('Conectando a la base de datos...\n');
        pool = await sql.connect(config);

        // Buscar el producto TRICICLO
        const query = `
            SELECT 
                i.codins,
                i.nomins,
                i.ultimo_costo,
                dp.Codtar,
                dp.valins as precio_tarifa,
                dp.margen as margen_tarifa,
                lp.nomtar,
                -- Calcular margen real
                CASE 
                    WHEN dp.valins > 0 THEN
                        CAST(((dp.valins - i.ultimo_costo) / dp.valins) * 100 AS DECIMAL(10,2))
                    ELSE 0
                END as margen_real_calculado
            FROM inv_insumos i
            INNER JOIN inv_detaprecios dp ON dp.codins = i.codins
            INNER JOIN inv_listaprecios lp ON lp.codtar = dp.Codtar
            WHERE i.nomins LIKE '%TRICICLO%'
            ORDER BY i.codins, dp.Codtar
        `;

        const result = await pool.request().query(query);

        console.log('═'.repeat(80));
        console.log('VERIFICACIÓN DE MÁRGENES');
        console.log('═'.repeat(80));
        console.log('');

        let currentProduct = null;
        result.recordset.forEach(p => {
            if (currentProduct !== p.codins) {
                if (currentProduct !== null) console.log('');
                console.log(`📦 ${p.nomins} (${p.codins})`);
                console.log(`   Costo: $${p.ultimo_costo}`);
                console.log('─'.repeat(80));
                currentProduct = p.codins;
            }
            console.log(`   Tarifa: ${p.nomtar.trim()} (${p.Codtar})`);
            console.log(`      Precio: $${p.precio_tarifa}`);
            console.log(`      ⭐ Margen Tarifa (inv_detaprecios): ${p.margen_tarifa}%  ← Este es el que quieres mostrar`);
            console.log(`      📊 Margen Real Calculado: ${p.margen_real_calculado}%`);
        });

        console.log('');
        console.log('═'.repeat(80));

        // Verificar qué retorna la función
        console.log('\n🔍 Verificando qué retorna fn_obtener_insumos_servicios:\n');
        
        const funcionQuery = `
            DECLARE @margen_minimo DECIMAL(10,2) = 0.10
            DECLARE @almacen CHAR(3) = '001'
            DECLARE @Tarifa CHAR(2) = '01'
            
            SELECT 
                codins,
                nomins,
                margen_venta,
                precio_lista,
                costo_producto
            FROM dbo.fn_obtener_insumos_servicios(@margen_minimo, @almacen, @Tarifa)
            WHERE nomins LIKE '%TRICICLO%'
        `;

        const funcionResult = await pool.request().query(funcionQuery);

        funcionResult.recordset.forEach(p => {
            console.log(`📦 ${p.nomins} (${p.codins})`);
            console.log(`   margen_venta (de la función): ${p.margen_venta}%`);
            console.log(`   precio_lista: $${p.precio_lista}`);
            console.log(`   costo_producto: $${p.costo_producto}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

verificarProducto()
    .then(() => {
        console.log('\n✨ Verificación completada\n');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
