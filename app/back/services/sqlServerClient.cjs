const sql = require('mssql');
require('dotenv').config();

// Validar variables de entorno requeridas
const requiredEnvVars = ['DB_SERVER', 'DB_DATABASE', 'DB_USER', 'DB_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Error: Faltan variables de entorno requeridas:', missingVars.join(', '));
  console.error('💡 Por favor, crea un archivo .env con las variables necesarias.');
  console.error('💡 Puedes usar .env.example como referencia.');
  process.exit(1);
}

// Configuración de conexión SQL Server desde variables de entorno
const config = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.NODE_ENV !== 'production', // Solo en desarrollo
    enableArithAbort: true,
    requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT || '30000', 10),
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '30000', 10),
  },
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    min: parseInt(process.env.DB_POOL_MIN || '0', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
  },
};

// Pool de conexiones global
let pool = null;

// Función para obtener la conexión
const getConnection = async () => {
  try {
    if (!pool) {
      console.log('🔄 Conectando a SQL Server...');
      pool = new sql.ConnectionPool(config);
      await pool.connect();
      console.log('✅ Conectado exitosamente a SQL Server');
    }
    return pool;
  } catch (error) {
    console.error('❌ Error conectando a SQL Server:', error);
    throw error;
  }
};

// Función para ejecutar consultas (posicionales)
const executeQuery = async (query, params) => {
  const connection = await getConnection();
  
  try {
    const request = connection.request();
    
    // Agregar parámetros posicionales si existen
    if (Array.isArray(params)) {
      params.forEach((param, index) => {
        request.input(`param${index}`, param);
      });
    }
    
    const result = await request.query(query);
    return result.recordset || [];
  } catch (error) {
    console.error('❌ Error ejecutando consulta:', error);
    throw error;
  }
};

// Función para ejecutar consultas con parámetros nombrados
const executeQueryWithParams = async (query, params = {}) => {
  const connection = await getConnection();
  try {
    const request = connection.request();
    Object.entries(params).forEach(([key, value]) => request.input(key, value));
    const result = await request.query(query);
    return result.recordset || [];
  } catch (error) {
    console.error('❌ Error ejecutando consulta con parámetros:', error);
    throw error;
  }
};

// Función para ejecutar procedimientos almacenados
const executeProcedure = async (procedureName, params) => {
  const connection = await getConnection();
  
  try {
    const request = connection.request();
    
    // Agregar parámetros si existen
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });
    }
    
    const result = await request.execute(procedureName);
    return result.recordset || [];
  } catch (error) {
    console.error('❌ Error ejecutando procedimiento:', error);
    throw error;
  }
};

// Función para cerrar la conexión
const closeConnection = async () => {
  if (pool) {
    try {
      await pool.close();
      pool = null;
      console.log('🔌 Conexión SQL Server cerrada');
    } catch (error) {
      console.error('❌ Error cerrando conexión:', error);
    }
  }
};

// Función para probar la conexión
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

// Función para obtener información de la base de datos
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
  executeQuery,
  executeProcedure,
  executeQueryWithParams,
  closeConnection,
  testConnection,
  getDatabaseInfo
};
