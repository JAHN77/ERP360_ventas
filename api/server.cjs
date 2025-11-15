/**
 * Wrapper para Vercel Serverless Functions
 * Este archivo adapta el servidor Express para funcionar en Vercel
 * 
 * Vercel requiere que las funciones serverless exporten un handler
 * que reciba (req, res) y maneje todas las rutas.
 */

// Establecer variable de entorno para indicar que estamos en Vercel
process.env.VERCEL = '1';

// Cargar el servidor Express
const app = require('../app/back/server.cjs');

// Exportar como función serverless de Vercel
// Vercel manejará automáticamente las rutas a través de rewrites
// El rewrite en vercel.json envía /api/* a /api/server, que ejecuta este archivo
module.exports = app;

