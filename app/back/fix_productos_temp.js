const sql = require('mssql');

// Configuración de la base de datos
const config = {
    server: '179.33.214.87',
    port: 1537,
    database: 'cicleBike',
    user: 'sa',
    password: 'M0b1l$2026&yvK@',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        requestTimeout: 60000,
        connectTimeout: 30000
    }
};

async function fixProductosSinPrecio() {
    let pool;
    
    try {
        console.log('Conectando a la base de datos...');
        pool = await sql.connect(config);
        console.log('Conexión exitosa!\n');

        console.log('==========================================');
        console.log('CORRECCIÓN DE PRODUCTOS SIN PRECIO');
        console.log('==========================================\n');

        // 1. Encontrar productos sin precio
        const productosSinPrecio = await pool.request().query(`
            SELECT 
                i.codins,
                i.nomins,
                i.ultimo_costo,
                i.activo
            FROM inv_insumos i
            WHERE i.activo = 1
            AND NOT EXISTS (
                SELECT 1 FROM inv_detaprecios dp 
                WHERE dp.codins = i.codins AND dp.Codtar = '01'
            )
        `);

        console.log(`Productos sin precio encontrados: ${productosSinPrecio.recordset.length}`);
        console.log(JSON.stringify(productosSinPrecio.recordset, null, 2));
        console.log('');

        if (productosSinPrecio.recordset.length === 0) {
            console.log('✅ No hay productos sin precio. ¡Todo está correcto!');
            return;
        }

        // 2. Obtener tarifas activas
        const tarifas = await pool.request().query(`
            SELECT codtar, nomtar, lismargen FROM inv_listaprecios WHERE vigente = 1
        `);

        console.log(`Tarifas activas encontradas: ${tarifas.recordset.length}`);
        console.log(JSON.stringify(tarifas.recordset, null, 2));
        console.log('');

        // 3. Insertar precios para cada producto en cada tarifa
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            for (const producto of productosSinPrecio.recordset) {
                console.log(`Procesando producto: ${producto.codins} - ${producto.nomins}`);
                console.log(`  Costo: ${producto.ultimo_costo}`);

                for (const tarifa of tarifas.recordset) {
                    // Calcular precio: costo / (1 - margen/100)
                    const precioCalculado = producto.ultimo_costo / (1 - (tarifa.lismargen / 100));

                    const request = new sql.Request(transaction);
                    request.input('codins', sql.VarChar(8), producto.codins);
                    request.input('codtar', sql.VarChar(2), tarifa.codtar);
                    request.input('precio', sql.Decimal(18, 2), precioCalculado);
                    request.input('margen', sql.Decimal(10, 2), tarifa.lismargen);

                    await request.query(`
                        INSERT INTO inv_detaprecios (codins, Codtar, valins, margen, TASA_DESCUENTO)
                        VALUES (@codins, @codtar, @precio, @margen, 0)
                    `);

                    console.log(`  ✓ Tarifa ${tarifa.codtar} (${tarifa.nomtar.trim()}): Precio = ${precioCalculado.toFixed(2)} (margen: ${tarifa.lismargen}%)`);
                }

                console.log('');
            }

            await transaction.commit();
            console.log('✅ Transacción completada exitosamente!');

        } catch (err) {
            console.error('❌ Error durante la transacción:', err);
            await transaction.rollback();
            throw err;
        }

        // 4. Verificación post-corrección
        console.log('\n==========================================');
        console.log('VERIFICACIÓN POST-CORRECCIÓN');
        console.log('==========================================\n');

        const verificacion = await pool.request().query(`
            SELECT COUNT(*) as productos_sin_precio
            FROM inv_insumos i
            WHERE i.activo = 1
            AND NOT EXISTS (
                SELECT 1 FROM inv_detaprecios dp 
                WHERE dp.codins = i.codins AND dp.Codtar = '01'
            )
        `);

        console.log(`Productos sin precio restantes: ${verificacion.recordset[0].productos_sin_precio}`);

        if (verificacion.recordset[0].productos_sin_precio === 0) {
            console.log('✅ ¡Todos los productos tienen precios correctos!');
        } else {
            console.log('⚠️  Todavía hay productos sin precio. Revisar manualmente.');
        }

        console.log('\n✨ CORRECCIÓN COMPLETADA!\n');

    } catch (error) {
        console.error('❌ Error fatal:', error);
        throw error;
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

// Ejecutar la corrección
fixProductosSinPrecio()
    .then(() => {
        console.log('Proceso finalizado correctamente');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error en el proceso:', err);
        process.exit(1);
    });
