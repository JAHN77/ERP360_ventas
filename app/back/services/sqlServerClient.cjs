const sql = require('mssql');
require('dotenv').config();

// Validar variables de entorno requeridas (pero no hacer exit, solo advertir)
// El servidor puede iniciar sin conexión a BD y manejar errores en tiempo de ejecución
const requiredEnvVars = ['DB_SERVER', 'DB_DATABASE', 'DB_USER', 'DB_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn('⚠️  Advertencia: Faltan variables de entorno requeridas:', missingVars.join(', '));
  console.warn('💡 Por favor, crea un archivo .env con las variables necesarias.');
  console.warn('💡 Puedes usar .env.example como referencia.');
  console.warn('💡 El servidor iniciará, pero las operaciones de BD fallarán hasta que se configuren las variables.');
  // NO hacer process.exit(1) - permitir que el servidor inicie
}

// Configuración de conexión SQL Server desde variables de entorno
const config = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT !== 'false', // Default to true (secure by default for cloud)
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true' || process.env.NODE_ENV !== 'production',
    enableArithAbort: true,
    requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT || '30000', 10),
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '30000', 10),
  },
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '50', 10), // Aumentado de 10 a 50 para mayor concurrencia
    min: parseInt(process.env.DB_POOL_MIN || '5', 10), // Mantener al menos 5 conexiones activas
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '300000', 10), // 5 minutos
    acquireTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT || '60000', 10), // 1 minuto
  },
};

// Pool de conexiones global
let pool = null;

// Función para obtener la conexión
const getConnection = async () => {
  try {
    // Verificar que las variables de entorno estén configuradas
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Variables de entorno faltantes: ${missingVars.join(', ')}. Por favor, configura el archivo .env`);
    }
    
    if (!pool) {
      console.log('🔄 Conectando a SQL Server...');
      pool = new sql.ConnectionPool(config);
      await pool.connect();
      console.log('✅ Conectado exitosamente a SQL Server');
    }
    return pool;
  } catch (error) {
    console.error('❌ Error conectando a SQL Server:', error.message || error);
    // No hacer throw si es un error de configuración, solo loguear
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

// Función para cerrar la conexión con timeout
const closeConnection = async () => {
  if (!pool) {
    return;
  }
  
  const currentPool = pool;
  pool = null; // Limpiar la referencia inmediatamente para evitar nuevas conexiones
  
  try {
    // Crear una promesa con timeout para forzar el cierre si tarda demasiado
    const closePromise = currentPool.close();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout cerrando pool de conexiones')), 2000);
    });
    
    await Promise.race([closePromise, timeoutPromise]);
    console.log('🔌 Conexión SQL Server cerrada');
  } catch (error) {
    // Si hay un timeout o error, simplemente loguear y continuar
    // El pool ya se limpió de la referencia, así que no se pueden crear nuevas conexiones
    if (error.message && error.message.includes('Timeout')) {
      console.log('⚠️ Timeout cerrando pool de conexiones (forzando cierre)');
    } else {
      console.error('❌ Error cerrando conexión:', error.message || error);
    }
    
    // Intentar destruir el pool de forma forzada
    try {
      if (currentPool && typeof currentPool.close === 'function') {
        currentPool.close().catch(() => {}); // Ignorar errores al cerrar forzadamente
      }
    } catch (forceError) {
      // Ignorar errores al forzar cierre
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
