const sql = require('mssql');
require('dotenv').config();

// Validar variables de entorno requeridas
const requiredEnvVars = ['DB_SERVER', 'DB_DATABASE', 'DB_USER', 'DB_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn('⚠️  Advertencia: Faltan variables de entorno requeridas:', missingVars.join(', '));
}

// Configuración base
const baseConfig = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' || process.env.DB_TRUST_CERT === 'true' || process.env.NODE_ENV !== 'production',
    enableArithAbort: true,
    requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT || '30000', 10),
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '30000', 10),
  },
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '50', 10),
    min: parseInt(process.env.DB_POOL_MIN || '5', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '300000', 10),
    acquireTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT || '60000', 10),
  },
};

// Cache de pools de conexión: { 'NombreBD': ConnectionPool }
const connectionPools = {};

// Obtener conexión para una base de datos específica
const getConnectionForDb = async (dbName) => {
  const targetDb = dbName || process.env.DB_DATABASE; // Default a la maestra si no se especifica

  if (!connectionPools[targetDb]) {
    console.log(`🔄 Creando nuevo pool para BD: ${targetDb}...`);
    const dbConfig = {
      ...baseConfig,
      database: targetDb
    };

    try {
      const pool = new sql.ConnectionPool(dbConfig);
      await pool.connect();
      connectionPools[targetDb] = pool;
      console.log(`✅ Conectado exitosamente a ${targetDb}`);
    } catch (error) {
      console.error(`❌ Error conectando a ${targetDb}:`, error.message);
      throw error;
    }
  }

  return connectionPools[targetDb];
};

// Alias para compatibilidad (usa la BD por defecto/maestra)
const getConnection = () => getConnectionForDb(process.env.DB_DATABASE);

// Ejecutar query en una BD específica (o la default)
const executeQuery = async (query, params, dbName = null) => {
  const connection = await getConnectionForDb(dbName);
  try {
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(process.cwd(), 'debug.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ⚡ [SQL] Executing query on DB: ${dbName || 'DEFAULT'}\n`);
  } catch (e) { console.error('Log error:', e); }

  try {
    const request = connection.request();
    if (Array.isArray(params)) {
      params.forEach((param, index) => {
        request.input(`param${index}`, param);
      });
    }
    const result = await request.query(query);
    return result.recordset || [];
  } catch (error) {
    console.error(`❌ Error ejecutando consulta en ${dbName || 'Default'}:`, error);
    throw error;
  }
};

const executeQueryWithParams = async (query, params = {}, dbName = null) => {
  const connection = await getConnectionForDb(dbName);
  console.log(`⚡ [SQL] Executing query with params on DB: ${dbName || 'DEFAULT'}`);
  try {
    const request = connection.request();
    Object.entries(params).forEach(([key, value]) => request.input(key, value));
    const result = await request.query(query);
    return result.recordset || [];
  } catch (error) {
    console.error(`❌ ERROR SQL en BD ${dbName || 'Default'}:`, {
      message: error.message,
      code: error.code,
      number: error.number,
      state: error.state,
      query: query.substring(0, 100) + (query.length > 100 ? '...' : '')
    });
    throw error;
  }
};

const executeProcedure = async (procedureName, params, dbName = null) => {
  const connection = await getConnectionForDb(dbName);
  try {
    const request = connection.request();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });
    }
    const result = await request.execute(procedureName);
    return result.recordset || [];
  } catch (error) {
    console.error(`❌ Error ejecutando procedimiento en ${dbName || 'Default'}:`, error);
    throw error;
  }
};

const closeConnection = async () => {
  const pools = Object.values(connectionPools);
  await Promise.all(pools.map(p => p.close()));
  // Clear cache
  Object.keys(connectionPools).forEach(k => delete connectionPools[k]);
  console.log('🔌 Todas las conexiones cerradas');
};

const testConnection = async () => {
  try {
    const connection = await getConnection();
    const result = await connection.request().query('SELECT 1 as test');
    console.log('✅ Prueba de conexión exitosa:', result.recordset);
    return true;
  } catch (error) {
    console.error('❌ Error en prueba de conexión:', error);
    return false;
  }
};

const getDatabaseInfo = async () => {
  try {
    const connection = await getConnection();
    const result = await connection.request().query(`
      SELECT 
        DB_NAME() as database_name,
        @@VERSION as sql_version,
        GETDATE() as currentTime
    `);
    return result.recordset[0];
  } catch (error) {
    console.error('❌ Error obteniendo información de la base de datos:', error);
    throw error;
  }
};

module.exports = {
  getConnection,
  getConnectionForDb, // Exported for explicit usage
  executeQuery,
  executeProcedure,
  executeQueryWithParams,
  closeConnection,
  testConnection,
  getDatabaseInfo
};
