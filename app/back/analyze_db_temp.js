const sql = require('mssql');
const fs = require('fs');
const path = require('path');

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

async function analyzeDatabase() {
    let pool;
    const results = [];
    
    try {
        // Conectar a la base de datos
        console.log('Conectando a la base de datos...');
        pool = await sql.connect(config);
        console.log('Conexión exitosa!\n');

        // 1. Obtener la definición de la función fn_obtener_insumos_servicios
        results.push('='.repeat(70));
        results.push('1. DEFINICIÓN DE LA FUNCIÓN fn_obtener_insumos_servicios');
        results.push('='.repeat(70));
        
        const functionDef = await pool.request().query(`
            SELECT 
                OBJECT_NAME(object_id) AS FunctionName,
                OBJECT_DEFINITION(object_id) AS FunctionDefinition
            FROM sys.objects
            WHERE name = 'fn_obtener_insumos_servicios'
            AND type IN ('FN', 'IF', 'TF')
        `);
        
        if (functionDef.recordset.length > 0) {
            results.push(functionDef.recordset[0].FunctionDefinition);
        } else {
            results.push('FUNCIÓN NO ENCONTRADA');
        }
        results.push('');

        // 2. Estructura de la tabla inv_insumos
        results.push('='.repeat(70));
        results.push('2. ESTRUCTURA DE LA TABLA inv_insumos');
        results.push('='.repeat(70));
        
        const insumosStructure = await pool.request().query(`
            SELECT 
                c.COLUMN_NAME,
                c.DATA_TYPE,
                c.CHARACTER_MAXIMUM_LENGTH,
                c.IS_NULLABLE,
                c.COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS c
            WHERE c.TABLE_NAME = 'inv_insumos'
            ORDER BY c.ORDINAL_POSITION
        `);
        
        insumosStructure.recordset.forEach(col => {
            const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
            const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            const defaultVal = col.COLUMN_DEFAULT ? ` DEFAULT ${col.COLUMN_DEFAULT}` : '';
            results.push(`${col.COLUMN_NAME.padEnd(30)} ${col.DATA_TYPE}${length.padEnd(15)} ${nullable}${defaultVal}`);
        });
        results.push('');

        // 3. Estructura de la tabla inv_listaprecios
        results.push('='.repeat(70));
        results.push('3. ESTRUCTURA DE LA TABLA inv_listaprecios');
        results.push('='.repeat(70));
        
        const listapreciosStructure = await pool.request().query(`
            SELECT 
                c.COLUMN_NAME,
                c.DATA_TYPE,
                c.CHARACTER_MAXIMUM_LENGTH,
                c.IS_NULLABLE,
                c.COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS c
            WHERE c.TABLE_NAME = 'inv_listaprecios'
            ORDER BY c.ORDINAL_POSITION
        `);
        
        listapreciosStructure.recordset.forEach(col => {
            const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
            const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            const defaultVal = col.COLUMN_DEFAULT ? ` DEFAULT ${col.COLUMN_DEFAULT}` : '';
            results.push(`${col.COLUMN_NAME.padEnd(30)} ${col.DATA_TYPE}${length.padEnd(15)} ${nullable}${defaultVal}`);
        });
        results.push('');

        // 4. Estructura de la tabla inv_detaprecios
        results.push('='.repeat(70));
        results.push('4. ESTRUCTURA DE LA TABLA inv_detaprecios');
        results.push('='.repeat(70));
        
        const detapreciosStructure = await pool.request().query(`
            SELECT 
                c.COLUMN_NAME,
                c.DATA_TYPE,
                c.CHARACTER_MAXIMUM_LENGTH,
                c.IS_NULLABLE,
                c.COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS c
            WHERE c.TABLE_NAME = 'inv_detaprecios'
            ORDER BY c.ORDINAL_POSITION
        `);
        
        detapreciosStructure.recordset.forEach(col => {
            const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
            const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            const defaultVal = col.COLUMN_DEFAULT ? ` DEFAULT ${col.COLUMN_DEFAULT}` : '';
            results.push(`${col.COLUMN_NAME.padEnd(30)} ${col.DATA_TYPE}${length.padEnd(15)} ${nullable}${defaultVal}`);
        });
        results.push('');

        // 5. Datos de inv_listaprecios
        results.push('='.repeat(70));
        results.push('5. DATOS DE inv_listaprecios');
        results.push('='.repeat(70));
        
        const listaprecios = await pool.request().query('SELECT * FROM inv_listaprecios');
        results.push(JSON.stringify(listaprecios.recordset, null, 2));
        results.push('');

        // 6. Parámetros del sistema
        results.push('='.repeat(70));
        results.push('6. PARÁMETROS DEL SISTEMA (ven_parametros)');
        results.push('='.repeat(70));
        
        const parametros = await pool.request().query('SELECT IvaIncluido FROM ven_parametros');
        results.push(JSON.stringify(parametros.recordset, null, 2));
        results.push('');

        // 7. Ejemplo de datos en inv_insumos
        results.push('='.repeat(70));
        results.push('7. EJEMPLO DE DATOS EN inv_insumos (primeros 5)');
        results.push('='.repeat(70));
        
        const insumosData = await pool.request().query(`
            SELECT TOP 5 * FROM inv_insumos WHERE activo = 1 ORDER BY codins
        `);
        results.push(JSON.stringify(insumosData.recordset, null, 2));
        results.push('');

        // 8. Ejemplo de datos en inv_detaprecios
        results.push('='.repeat(70));
        results.push('8. EJEMPLO DE DATOS EN inv_detaprecios (primeros 10)');
        results.push('='.repeat(70));
        
        const detapreciosData = await pool.request().query(`
            SELECT TOP 10 * FROM inv_detaprecios ORDER BY codins, Codtar
        `);
        results.push(JSON.stringify(detapreciosData.recordset, null, 2));
        results.push('');

        // 9. Productos sin precio en inv_detaprecios
        results.push('='.repeat(70));
        results.push('9. PRODUCTOS ACTIVOS SIN PRECIO EN inv_detaprecios para tarifa 01');
        results.push('='.repeat(70));
        
        const sinPrecios = await pool.request().query(`
            SELECT 
                i.codins,
                i.nomins,
                i.referencia,
                i.activo,
                i.precio_publico,
                i.ultimo_costo
            FROM inv_insumos i
            WHERE i.activo = 1
            AND NOT EXISTS (
                SELECT 1 FROM inv_detaprecios dp 
                WHERE dp.codins = i.codins AND dp.Codtar = '01'
            )
        `);
        results.push(`Total productos sin precio: ${sinPrecios.recordset.length}`);
        results.push(JSON.stringify(sinPrecios.recordset.slice(0, 10), null, 2));
        results.push('');

        // 10. Ejecutar la función con parámetros
        results.push('='.repeat(70));
        results.push('10. RESULTADO DE LA FUNCIÓN fn_obtener_insumos_servicios');
        results.push('='.repeat(70));
        
        const funcionResult = await pool.request().query(`
            declare @margen_minimo decimal (10,2)=0.10
            declare @tarifa_cliente char(2) = '01'

            declare @almacen char(3),@Tarifa char(2)=@tarifa_cliente,@controla_existencia integer=1	
            select @margen_minimo = lismargen,@almacen=codalm from inv_listaprecios where codtar=@Tarifa

            DECLARE @Incluir_Iva bit
            SELECT @Incluir_Iva = ISNULL(IvaIncluido,0) from ven_parametros

            select TOP 10 *,@Incluir_Iva as Precio_Iva from dbo.fn_obtener_insumos_servicios(@margen_minimo,@almacen,@Tarifa)
        `);
        
        // Obtener parámetros usados
        const params = await pool.request().query(`
            declare @margen_minimo decimal (10,2)=0.10
            declare @tarifa_cliente char(2) = '01'
            declare @almacen char(3),@Tarifa char(2)=@tarifa_cliente
            select @margen_minimo = lismargen,@almacen=codalm from inv_listaprecios where codtar=@Tarifa
            DECLARE @Incluir_Iva bit
            SELECT @Incluir_Iva = ISNULL(IvaIncluido,0) from ven_parametros
            
            SELECT @margen_minimo as margen_minimo, @almacen as almacen, @Tarifa as tarifa, @Incluir_Iva as incluir_iva
        `);
        
        results.push('Parámetros utilizados:');
        results.push(JSON.stringify(params.recordset[0], null, 2));
        results.push('');
        results.push('Resultados de la función (primeros 10):');
        results.push(JSON.stringify(funcionResult.recordset, null, 2));
        results.push('');

        // Guardar resultados
        const outputPath = path.join(__dirname, 'analyze_results.txt');
        fs.writeFileSync(outputPath, results.join('\n'), 'utf8');
        
        console.log('Análisis completado exitosamente!');
        console.log(`Resultados guardados en: ${outputPath}`);
        
        // También mostrar en consola
        console.log('\n' + results.join('\n'));

    } catch (error) {
        console.error('Error durante el análisis:', error);
        throw error;
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

// Ejecutar el análisis
analyzeDatabase()
    .then(() => {
        console.log('\nAnálisis finalizado correctamente');
        process.exit(0);
    })
    .catch(err => {
        console.error('\nError fatal:', err);
        process.exit(1);
    });
