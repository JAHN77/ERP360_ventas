/**
 * Script de prueba para analizar la tabla gen_empresa
 * y obtener todos sus campos para hacer el mapeo correcto
 */

const { getConnection } = require('../services/sqlServerClient.cjs');

async function testGenEmpresa() {
  let pool;
  
  try {
    console.log('🔍 Conectando a la base de datos...');
    pool = await getConnection();
    console.log('✅ Conectado exitosamente\n');
    
    // 1. Obtener estructura de columnas de gen_empresa
    console.log('='.repeat(80));
    console.log('📊 ESTRUCTURA DE LA TABLA gen_empresa:');
    console.log('='.repeat(80));
    
    const columnsResult = await pool.request().query(`
      SELECT 
        COLUMN_NAME as column_name,
        DATA_TYPE as data_type,
        CHARACTER_MAXIMUM_LENGTH as max_length,
        IS_NULLABLE as is_nullable,
        COLUMN_DEFAULT as default_value
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'gen_empresa'
      ORDER BY ORDINAL_POSITION
    `);
    
    if (columnsResult.recordset.length === 0) {
      console.log('❌ La tabla gen_empresa no existe o no tiene columnas');
      return;
    }
    
    console.log(`\n📌 Total de columnas: ${columnsResult.recordset.length}\n`);
    
    const allColumns = [];
    for (const col of columnsResult.recordset) {
      const length = col.max_length ? `(${col.max_length})` : '';
      const nullable = col.is_nullable === 'YES' ? ' [NULL]' : ' [NOT NULL]';
      console.log(`  ${col.column_name.padEnd(30)} : ${col.data_type}${length}${nullable}`);
      allColumns.push(col.column_name);
    }
    
    // 2. Obtener un registro completo para ver los datos reales
    console.log('\n' + '='.repeat(80));
    console.log('📋 DATOS DE EJEMPLO (primer registro de gen_empresa):');
    console.log('='.repeat(80));
    
    const dataResult = await pool.request().query(`
      SELECT TOP 1 *
      FROM gen_empresa
    `);
    
    if (dataResult.recordset.length === 0) {
      console.log('❌ No se encontraron registros en gen_empresa');
      return;
    }
    
    const empresa = dataResult.recordset[0];
    
    console.log('\n📦 TODOS LOS CAMPOS Y VALORES ENCONTRADOS:\n');
    for (const [key, value] of Object.entries(empresa)) {
      let valorStr = 'NULL';
      if (value !== null && value !== undefined) {
        valorStr = String(value);
        if (valorStr.length > 60) {
          valorStr = valorStr.substring(0, 57) + '...';
        }
      }
      console.log(`  ${key.padEnd(30)} = "${valorStr}"`);
    }
    
    // 3. Buscar campos específicos que necesitamos
    console.log('\n' + '='.repeat(80));
    console.log('🔍 BÚSQUEDA DE CAMPOS ESPECÍFICOS NECESARIOS:');
    console.log('='.repeat(80));
    
    const camposNecesarios = {
      'NIT/Identificación': ['nitemp', 'nit', 'identificacion', 'numero_identificacion', 'codemp'],
      'Razón Social': ['razemp', 'razon_social', 'razonsocial', 'nombre_empresa', 'nombreempresa', 'nombre', 'nomemp'],
      'Dirección': ['diremp', 'direccion', 'dir', 'address', 'direccion_empresa'],
      'Teléfono': ['teleep', 'telefono', 'tel', 'phone', 'telefono_empresa', 'tel_empresa'],
      'Email': ['emailemp', 'email', 'correo', 'correo_electronico', 'email_empresa', 'correo_empresa'],
      'Municipio': ['codmunicipio', 'municipio', 'cod_municipio', 'id_municipio', 'codmunic', 'codmunic_empresa'],
      'Código DANE': ['Coddane', 'coddane', 'cod_dane', 'codigo_dane', 'coddaneemp', 'dane']
    };
    
    console.log('\n');
    for (const [descripcion, nombresPosibles] of Object.entries(camposNecesarios)) {
      let encontrado = null;
      for (const nombre in empresa) {
        if (nombresPosibles.some(p => nombre.toLowerCase() === p.toLowerCase())) {
          encontrado = { nombre: nombre, valor: empresa[nombre] };
          break;
        }
      }
      if (encontrado) {
        const valorStr = encontrado.valor === null || encontrado.valor === undefined 
          ? 'NULL' 
          : String(encontrado.valor).substring(0, 50);
        console.log(`  ✅ ${descripcion.padEnd(20)} → Campo: "${encontrado.nombre}" = "${valorStr}"`);
      } else {
        console.log(`  ❌ ${descripcion.padEnd(20)} → NO ENCONTRADO`);
        console.log(`     Buscó: ${nombresPosibles.join(', ')}`);
      }
    }
    
    // 4. Generar sugerencia de consulta SQL
    console.log('\n' + '='.repeat(80));
    console.log('💡 CONSULTA SQL RECOMENDADA:');
    console.log('='.repeat(80));
    
    const camposEncontrados = {};
    for (const [descripcion, nombresPosibles] of Object.entries(camposNecesarios)) {
      for (const nombre in empresa) {
        if (nombresPosibles.some(p => nombre.toLowerCase() === p.toLowerCase())) {
          camposEncontrados[descripcion] = nombre;
          break;
        }
      }
    }
    
    if (Object.keys(camposEncontrados).length > 0) {
      console.log('\nSELECT TOP 1');
      const campos = Object.values(camposEncontrados);
      campos.forEach((campo, index) => {
        const comma = index < campos.length - 1 ? ',' : '';
        console.log(`  ${campo}${comma}`);
      });
      console.log('FROM gen_empresa');
    } else {
      console.log('\n⚠️ No se encontraron campos específicos. Usar SELECT * para obtener todos los campos.');
    }
    
    // 5. Mapeo sugerido para el código
    console.log('\n' + '='.repeat(80));
    console.log('📝 MAPEO SUGERIDO PARA EL CÓDIGO:');
    console.log('='.repeat(80));
    console.log('\nconst empresa = result.recordset[0];');
    console.log('const empresaFinal = {');
    console.log('  nitemp: empresa.' + (camposEncontrados['NIT/Identificación'] || 'nitemp') + ' || null,');
    console.log('  razemp: empresa.' + (camposEncontrados['Razón Social'] || 'razemp') + ' || null,');
    console.log('  diremp: empresa.' + (camposEncontrados['Dirección'] || 'diremp') + ' || null,');
    console.log('  teleep: empresa.' + (camposEncontrados['Teléfono'] || 'teleep') + ' || null,');
    console.log('  emailemp: empresa.' + (camposEncontrados['Email'] || 'emailemp') + ' || null,');
    console.log('  codmunicipio: empresa.' + (camposEncontrados['Municipio'] || 'codmunicipio') + ' || null,');
    console.log('  Coddane: empresa.' + (camposEncontrados['Código DANE'] || 'Coddane') + ' || null');
    console.log('};');
    
  } catch (error) {
    console.error('\n❌ Error analizando gen_empresa:', error.message);
    console.error('   Stack:', error.stack);
  } finally {
    if (pool && pool.close) {
      await pool.close();
      console.log('\n✅ Conexión cerrada');
    }
  }
}

// Ejecutar análisis
testGenEmpresa().catch(console.error);

