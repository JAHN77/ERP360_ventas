/**
 * Script para analizar la estructura de la tabla gen_empresa
 * y obtener todos sus campos para hacer el mapeo correcto
 */

const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'Prueba_ERP360',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

async function analyzeGenEmpresa() {
  let pool;
  
  try {
    console.log('🔍 Conectando a la base de datos...');
    pool = await sql.connect(config);
    console.log('✅ Conectado a:', config.database);
    
    // 1. Obtener estructura de columnas de gen_empresa
    console.log('\n' + '='.repeat(80));
    console.log('📊 ESTRUCTURA DE LA TABLA gen_empresa:');
    console.log('='.repeat(80));
    
    const columnsResult = await pool.request().query(`
      SELECT 
        COLUMN_NAME as column_name,
        DATA_TYPE as data_type,
        CHARACTER_MAXIMUM_LENGTH as max_length,
        IS_NULLABLE as is_nullable,
        COLUMN_DEFAULT as default_value,
        COLUMNPROPERTY(OBJECT_ID(TABLE_SCHEMA + '.' + TABLE_NAME), COLUMN_NAME, 'IsIdentity') as is_identity
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'gen_empresa'
      ORDER BY ORDINAL_POSITION
    `);
    
    if (columnsResult.recordset.length === 0) {
      console.log('❌ La tabla gen_empresa no existe o no tiene columnas');
      return;
    }
    
    console.log(`\n📌 Total de columnas: ${columnsResult.recordset.length}\n`);
    
    const columns = {};
    for (const col of columnsResult.recordset) {
      const length = col.max_length ? `(${col.max_length})` : '';
      const identity = col.is_identity ? ' [IDENTITY]' : '';
      const nullable = col.is_nullable === 'YES' ? ' [NULL]' : ' [NOT NULL]';
      console.log(`  ${col.column_name}: ${col.data_type}${length}${identity}${nullable}`);
      
      columns[col.column_name] = {
        type: col.data_type,
        length: col.max_length,
        nullable: col.is_nullable === 'YES',
        default: col.default_value
      };
    }
    
    // 2. Obtener un registro de ejemplo para ver los datos reales
    console.log('\n' + '='.repeat(80));
    console.log('📋 DATOS DE EJEMPLO (primer registro de gen_empresa):');
    console.log('='.repeat(80));
    
    const dataResult = await pool.request().query(`
      SELECT TOP 1 *
      FROM gen_empresa
    `);
    
    if (dataResult.recordset.length > 0) {
      const empresa = dataResult.recordset[0];
      console.log('\nDatos encontrados:\n');
      
      // Buscar campos relacionados con los que necesitamos
      const camposNecesarios = {
        nit: ['nitemp', 'nit', 'identificacion', 'numero_identificacion'],
        razonSocial: ['razemp', 'razon_social', 'nombre', 'nombre_empresa'],
        direccion: ['diremp', 'direccion', 'dir', 'address'],
        telefono: ['teleep', 'telefono', 'tel', 'phone'],
        email: ['emailemp', 'email', 'correo', 'correo_electronico'],
        municipio: ['codmunicipio', 'municipio', 'cod_municipio', 'id_municipio'],
        dane: ['Coddane', 'coddane', 'cod_dane', 'codigo_dane']
      };
      
      console.log('Campos encontrados en el registro:\n');
      for (const [campo, posiblesNombres] of Object.entries(camposNecesarios)) {
        let encontrado = null;
        for (const nombre in empresa) {
          if (posiblesNombres.some(p => nombre.toLowerCase() === p.toLowerCase())) {
            encontrado = { nombre: nombre, valor: empresa[nombre] };
            break;
          }
        }
        if (encontrado) {
          console.log(`  ✅ ${campo.padEnd(15)} → ${encontrado.nombre.padEnd(20)} = "${encontrado.valor}"`);
        } else {
          console.log(`  ❌ ${campo.padEnd(15)} → NO ENCONTRADO`);
          console.log(`     Buscando: ${posiblesNombres.join(', ')}`);
        }
      }
      
      // Mostrar todos los campos disponibles
      console.log('\n' + '='.repeat(80));
      console.log('📦 TODOS LOS CAMPOS DISPONIBLES EN EL REGISTRO:');
      console.log('='.repeat(80));
      for (const [key, value] of Object.entries(empresa)) {
        const tipo = typeof value;
        const valorStr = value === null || value === undefined ? 'NULL' : String(value).substring(0, 50);
        console.log(`  ${key.padEnd(30)} : ${tipo.padEnd(10)} = ${valorStr}`);
      }
    } else {
      console.log('❌ No se encontraron registros en gen_empresa');
    }
    
    // 3. Sugerencias de mapeo
    console.log('\n' + '='.repeat(80));
    console.log('💡 SUGERENCIAS DE MAPEO:');
    console.log('='.repeat(80));
    console.log(`
Para obtener los datos de la empresa, usa estos campos de gen_empresa:

1. NIT/Identificación: Buscar campo que contenga números de identificación
2. Razón Social: Buscar campo con nombre de la empresa
3. Dirección: Buscar campo con dirección física
4. Teléfono: Buscar campo con número telefónico
5. Email: Buscar campo con correo electrónico
6. Código DANE/Municipio: Buscar campo con código de municipio o DANE
    `);
    
  } catch (error) {
    console.error('❌ Error analizando gen_empresa:', error.message);
    console.error('   Stack:', error.stack);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n✅ Conexión cerrada');
    }
  }
}

// Ejecutar análisis
analyzeGenEmpresa().catch(console.error);

