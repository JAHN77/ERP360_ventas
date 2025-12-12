const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');

// GET /api/cotizaciones
router.get('/', quoteController.getAllQuotes);

// GET /api/cotizaciones-detalle
// Note: This matches the legacy route /api/cotizaciones-detalle. 
// If mounting at /api/cotizaciones, this would be /detalle, but we keep legacy path compatibility if mounted at root or adjust in server.cjs
// Plan: Mount at /api/cotizaciones and use specific paths or mount global routes. 
// The legacy server had app.get('/api/cotizaciones-detalle').
// Let's assume we will mount this router at /api/cotizaciones.
// So we need to handle the detail route possibly separately or as a sub-route if structure changes.
// However, the legacy app has /api/cotizaciones AND /api/cotizaciones-detalle as distinct top-level paths.
// Strategy: 
// 1. Mount this router at /api/cotizaciones for CRUD.
// 2. Creating a separate endpoint for details inside this router might require changing frontend URLs or double mounting.
// Better approach: Define all quote-related routes here. In server.cjs we can mount it at /api and define paths here.
// OR mount at /api/cotizaciones and have subpaths. Use /detalle for details? No, frontend likely calls /api/cotizaciones-detalle.
// Decision: We will mount this router at /api and define full paths to be safe, OR mount at /api/cotizaciones and redirect/rewrite.
// Easiest: Mount at /api and define explicit paths.

// Define routes relative to the mount point. 
// If mounted at /api:
router.get('/cotizaciones', quoteController.getAllQuotes);
router.get('/cotizaciones-detalle', quoteController.getQuoteDetails);
router.post('/cotizaciones', quoteController.createQuote);
router.put('/cotizaciones/:id', quoteController.updateQuote);

module.exports = router;
