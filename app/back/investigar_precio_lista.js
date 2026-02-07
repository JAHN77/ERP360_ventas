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

async function investigarPrecioLista() {
    let pool;
    
    try {
        console.log('Conectando a la base de datos...\n');
        pool = await sql.connect(config);

        // Primero, obtener la definición de la función tarifas
        console.log('═'.repeat(80));
        console.log('1. OBTENIENDO DEFINICIÓN DE LA FUNCIÓN tarifas()');
        console.log('═'.repeat(80));
        console.log('');

        const defQuery = `
            SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.tarifas')) as definicion
        `;

        const defResult = await pool.request().query(defQuery);
        console.log(defResult.recordset[0].definicion);
        console.log('');
        console.log('═'.repeat(80));
        console.log('');

        // Ahora verificar los valores para los productos de prueba
        console.log('2. VALORES PARA PRODUCTOS 09010016 y 09010017');
        console.log('═'.repeat(80));
        console.log('');

        const valoresQuery = `
            DECLARE @margen_minimo DECIMAL(10,2) = 0.10
            DECLARE @almacen CHAR(3) = '001'
            DECLARE @Tarifa CHAR(2) = '01'
            
            SELECT 
                codins,
                nomins,
                referencia,
                costo_producto as Valinv,
                Precio_Venta,
                precio_base,
                precio_lista,
                margen_venta,
                tasa_descuento,
                -- Calcular margen según la fórmula correcta
                CASE 
                    WHEN Precio_Venta > 0 THEN
                        CAST(((Precio_Venta - costo_producto) / Precio_Venta) * 100 AS DECIMAL(10,2))
                    ELSE 0
                END as margen_calculado_correcto
            FROM dbo.fn_obtener_insumos_servicios(@margen_minimo, @almacen, @Tarifa)
            WHERE codins IN ('09010016', '09010017')
        `;

        const valoresResult = await pool.request().query(valoresQuery);

        valoresResult.recordset.forEach(prod => {
            console.log(`📦 ${prod.nomins} (${prod.codins})`);
            console.log('─'.repeat(80));
            console.log(`   Referencia:           ${prod.referencia}`);
            console.log('');
            console.log('   💰 PRECIOS:');
            console.log(`   ├─ Valinv (costo):    $${prod.Valinv}`);
            console.log(`   ├─ Precio_Venta:      $${prod.Precio_Venta}`);
            console.log(`   ├─ precio_base:       $${prod.precio_base}`);
            console.log(`   └─ precio_lista:      $${prod.precio_lista}  ← ESTE ES EL QUE SE MUESTRA`);
            console.log('');
            console.log('   📊 MARGEN:');
            console.log(`   ├─ margen_venta (función):    ${prod.margen_venta}%`);
            console.log(`   └─ Margen calculado correcto: ${prod.margen_calculado_correcto}%`);
            console.log(`       Fórmula: ((${prod.Precio_Venta} - ${prod.Valinv}) / ${prod.Precio_Venta}) × 100`);
            console.log('');
            console.log(`   🔧 tasa_descuento:    ${prod.tasa_descuento}%`);
            console.log('');
            console.log('═'.repeat(80));
            console.log('');
        });

        // Verificar precios en inv_detaprecios
        console.log('3. PRECIOS EN inv_detaprecios');
        console.log('═'.repeat(80));
        console.log('');

        const preciosQuery = `
            SELECT 
                dp.codins,
                i.nomins,
                dp.Codtar,
                lp.nomtar,
                dp.valins as precio_tarifa,
                dp.margen,
                dp.TASA_DESCUENTO,
                i.ultimo_costo,
                lp.lismargen as margen_lista
            FROM inv_detaprecios dp
            INNER JOIN inv_insumos i ON i.codins = dp.codins
            INNER JOIN inv_listaprecios lp ON lp.codtar = dp.Codtar
            WHERE dp.codins IN ('09010016', '09010017')
            ORDER BY dp.codins, dp.Codtar
        `;

        const preciosResult = await pool.request().query(preciosQuery);

        let currentProduct = null;
        preciosResult.recordset.forEach(p => {
            if (currentProduct !== p.codins) {
                if (currentProduct !== null) console.log('');
                console.log(`📦 ${p.nomins} (${p.codins}) - Costo: $${p.ultimo_costo}`);
                console.log('─'.repeat(80));
                currentProduct = p.codins;
            }
            console.log(`   ${p.nomtar.trim()} (${p.Codtar}):`);
            console.log(`      Precio: $${p.precio_tarifa} | Margen: ${p.margen}% | Desc: ${p.TASA_DESCUENTO}% | Margen Lista: ${p.margen_lista}%`);
        });

        console.log('');
        console.log('═'.repeat(80));

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

investigarPrecioLista()
    .then(() => {
        console.log('\n✨ Investigación completada\n');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
