const sql = require('mssql');
require('dotenv').config({ path: '.env' });

const config = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

async function analyzeDatabase() {
  let pool;
  try {
    console.log('🔄 Conectando a la base de datos...');
    pool = await sql.connect(config);
    console.log('✅ Conectado exitosamente\n');

    // 1. Obtener todas las tablas
    console.log('📊 TABLAS EN LA BASE DE DATOS:');
    console.log('=' .repeat(80));
    const tablesResult = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA as schema_name,
        TABLE_NAME as table_name,
        TABLE_TYPE as table_type
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    
    const tables = {};
    for (const row of tablesResult.recordset) {
      const tableName = `${row.schema_name}.${row.table_name}`;
      if (!tables[row.schema_name]) {
        tables[row.schema_name] = [];
      }
      tables[row.schema_name].push(row.table_name);
      console.log(`  - ${tableName}`);
    }

    console.log(`\n📈 Total de tablas: ${tablesResult.recordset.length}\n`);

    // 2. Obtener columnas de cada tabla relevante
    console.log('\n📋 ESTRUCTURA DE TABLAS RELEVANTES:');
    console.log('=' .repeat(80));

    const relevantTables = [
      'con_terceros',
      'inv_insumos',
      'ven_facturas',
      'ven_detafact',
      'ven_cotizacion',
      'ven_detacotizacion',
      'ven_pedidos',
      'ven_detapedidos',
      'ven_recibos',
      'ven_detarecibo',
      'ven_notas',
      'archivos_adjuntos',
      'inv_medidas',
      'inv_categorias',
      'gen_departamentos',
      'gen_municipios',
      'Dian_tipodocumento',
      'tipos_persona',
      'Dian_Regimenes',
      'ven_vendedor',
      'transportadoras',
      'inv_invent'
    ];

    const tableStructures = {};

    for (const tableName of relevantTables) {
      try {
        const columnsResult = await pool.request().query(`
          SELECT 
            COLUMN_NAME as column_name,
            DATA_TYPE as data_type,
            CHARACTER_MAXIMUM_LENGTH as max_length,
            IS_NULLABLE as is_nullable,
            COLUMN_DEFAULT as default_value,
            COLUMNPROPERTY(OBJECT_ID(TABLE_SCHEMA + '.' + TABLE_NAME), COLUMN_NAME, 'IsIdentity') as is_identity
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${tableName}'
          ORDER BY ORDINAL_POSITION
        `);

        if (columnsResult.recordset.length > 0) {
          tableStructures[tableName] = columnsResult.recordset;
          console.log(`\n📌 ${tableName}:`);
          console.log('  ' + '-'.repeat(78));
          for (const col of columnsResult.recordset) {
            const length = col.max_length ? `(${col.max_length})` : '';
            const identity = col.is_identity ? ' [IDENTITY]' : '';
            const nullable = col.is_nullable === 'YES' ? ' [NULL]' : ' [NOT NULL]';
            console.log(`    - ${col.column_name}: ${col.data_type}${length}${identity}${nullable}`);
          }
        }
      } catch (error) {
        console.log(`\n⚠️  Tabla ${tableName} no encontrada o no accesible`);
      }
    }

    // 3. Obtener relaciones (Foreign Keys)
    console.log('\n\n🔗 RELACIONES ENTRE TABLAS (Foreign Keys):');
    console.log('=' .repeat(80));
    const fkResult = await pool.request().query(`
      SELECT 
        fk.name AS fk_name,
        OBJECT_NAME(fk.parent_object_id) AS parent_table,
        cp.name AS parent_column,
        OBJECT_NAME(fk.referenced_object_id) AS referenced_table,
        cr.name AS referenced_column
      FROM sys.foreign_keys AS fk
      INNER JOIN sys.foreign_key_columns AS fkc ON fk.object_id = fkc.constraint_object_id
      INNER JOIN sys.columns AS cp ON fkc.parent_column_id = cp.column_id AND fkc.parent_object_id = cp.object_id
      INNER JOIN sys.columns AS cr ON fkc.referenced_column_id = cr.column_id AND fkc.referenced_object_id = cr.object_id
      WHERE OBJECT_NAME(fk.parent_object_id) IN (${relevantTables.map(t => `'${t}'`).join(', ')})
        OR OBJECT_NAME(fk.referenced_object_id) IN (${relevantTables.map(t => `'${t}'`).join(', ')})
      ORDER BY parent_table, fk_name
    `);

    if (fkResult.recordset.length > 0) {
      for (const fk of fkResult.recordset) {
        console.log(`  ${fk.parent_table}.${fk.parent_column} -> ${fk.referenced_table}.${fk.referenced_column}`);
      }
    } else {
      console.log('  No se encontraron relaciones definidas');
    }

    // 4. Obtener índices
    console.log('\n\n📑 ÍNDICES PRINCIPALES:');
    console.log('=' .repeat(80));
    const indexesResult = await pool.request().query(`
      SELECT 
        OBJECT_NAME(i.object_id) AS table_name,
        i.name AS index_name,
        i.type_desc AS index_type,
        STRING_AGG(c.name, ', ') AS columns
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE OBJECT_NAME(i.object_id) IN (${relevantTables.map(t => `'${t}'`).join(', ')})
        AND i.type_desc != 'HEAP'
        AND i.is_primary_key = 0
        AND i.is_unique_constraint = 0
      GROUP BY OBJECT_NAME(i.object_id), i.name, i.type_desc
      ORDER BY table_name, index_name
    `);

    if (indexesResult.recordset.length > 0) {
      for (const idx of indexesResult.recordset) {
        console.log(`  ${idx.table_name}.${idx.index_name} (${idx.index_type}): ${idx.columns}`);
      }
    }

    // 5. Contar registros en cada tabla
    console.log('\n\n📊 REGISTROS POR TABLA:');
    console.log('=' .repeat(80));
    for (const tableName of relevantTables) {
      try {
        const countResult = await pool.request().query(`
          SELECT COUNT(*) as count FROM ${tableName}
        `);
        console.log(`  ${tableName}: ${countResult.recordset[0].count} registros`);
      } catch (error) {
        // Tabla no existe o no accesible
      }
    }

    // Guardar resultados en un archivo JSON
    const fs = require('fs');
    const results = {
      tables: tables,
      tableStructures: tableStructures,
      foreignKeys: fkResult.recordset,
      indexes: indexesResult.recordset,
      analyzedAt: new Date().toISOString()
    };

    fs.writeFileSync(
      'database_structure.json',
      JSON.stringify(results, null, 2),
      'utf8'
    );
    console.log('\n\n✅ Resultados guardados en database_structure.json');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

analyzeDatabase().catch(console.error);

