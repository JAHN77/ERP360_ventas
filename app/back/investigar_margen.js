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

async function investigarProductosEspecificos() {
    let pool;
    
    try {
        console.log('Conectando a la base de datos...\n');
        pool = await sql.connect(config);

        // Consulta específica para los productos 09010016 y 09010017
        const query = `
            SELECT 
                i.codins,
                i.nomins,
                i.referencia,
                i.ultimo_costo,
                i.precio_publico,
                i.margen_venta,
                i.precio_mayorista,
                i.precio_minorista,
                i.tasa_iva,
                i.costo_promedio,
                i.activo,
                -- Calcular margen correcto
                CASE 
                    WHEN i.precio_publico > 0 THEN 
                        CAST(((i.precio_publico - i.ultimo_costo) / i.precio_publico) * 100 AS DECIMAL(10,2))
                    ELSE 0 
                END as margen_calculado_correcto
            FROM inv_insumos i
            WHERE i.codins IN ('09010016', '09010017')
        `;

        const result = await pool.request().query(query);

        console.log('═'.repeat(80));
        console.log('ANÁLISIS DETALLADO DE PRODUCTOS 09010016 y 09010017');
        console.log('═'.repeat(80));
        console.log('');

        result.recordset.forEach(prod => {
            console.log(`📦 Producto: ${prod.nomins} (Código: ${prod.codins})`);
            console.log('─'.repeat(80));
            console.log(`   Referencia:           ${prod.referencia}`);
            console.log(`   Estado:               ${prod.activo ? 'Activo' : 'Inactivo'}`);
            console.log('');
            console.log('   💰 PRECIOS Y COSTOS:');
            console.log(`   ├─ Último Costo:      $${prod.ultimo_costo}`);
            console.log(`   ├─ Costo Promedio:    $${prod.costo_promedio}`);
            console.log(`   ├─ Precio Público:    $${prod.precio_publico}`);
            console.log(`   ├─ Precio Mayorista:  $${prod.precio_mayorista}`);
            console.log(`   └─ Precio Minorista:  $${prod.precio_minorista}`);
            console.log('');
            console.log('   📊 MÁRGENES:');
            console.log(`   ├─ margen_venta (BD): ${prod.margen_venta}%  ← Este es el que muestra el frontend`);
            console.log(`   └─ Margen Calculado:  ${prod.margen_calculado_correcto}%  ← Este debería ser el correcto`);
            console.log('');
            console.log(`   🔧 IVA:                ${prod.tasa_iva}%`);
            console.log('');
            
            // Verificar si el margen es 4.80
            if (Math.abs(prod.margen_venta - 4.80) < 0.1) {
                console.log('   ✅ ESTE PRODUCTO TIENE margen_venta = 4.80%');
            } else if (Math.abs(prod.margen_calculado_correcto - 4.80) < 0.1) {
                console.log('   ✅ Este producto tiene margen CALCULADO = 4.80%');
            } else {
                console.log(`   ⚠️  margen_venta (${prod.margen_venta}%) NO coincide con 4.80%`);
            }
            
            console.log('');
            console.log('═'.repeat(80));
            console.log('');
        });

        // Ahora verificar qué retorna la función fn_obtener_insumos_servicios
        console.log('\n🔍 VERIFICANDO QUÉ RETORNA fn_obtener_insumos_servicios:\n');
        
        const funcionQuery = `
            DECLARE @margen_minimo DECIMAL(10,2) = 0.10
            DECLARE @almacen CHAR(3) = '001'
            DECLARE @Tarifa CHAR(2) = '01'
            
            SELECT 
                codins,
                nomins,
                referencia,
                Precio_Venta,
                precio_base,
                precio_lista,
                margen_venta,
                costo_producto,
                caninv as stock
            FROM dbo.fn_obtener_insumos_servicios(@margen_minimo, @almacen, @Tarifa)
            WHERE codins IN ('09010016', '09010017')
        `;

        const funcionResult = await pool.request().query(funcionQuery);

        funcionResult.recordset.forEach(prod => {
            console.log(`📦 ${prod.nomins} (${prod.codins})`);
            console.log(`   Precio Venta (función): $${prod.Precio_Venta}`);
            console.log(`   Precio Base (función):  $${prod.precio_base}`);
            console.log(`   Precio Lista (función): $${prod.precio_lista}`);
            console.log(`   🎯 margen_venta:        ${prod.margen_venta}%  ← ESTE ES EL QUE VE EL FRONTEND`);
            console.log(`   Costo:                  $${prod.costo_producto}`);
            console.log(`   Stock:                  ${prod.stock}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

investigarProductosEspecificos()
    .then(() => {
        console.log('✨ Investigación completada\n');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
