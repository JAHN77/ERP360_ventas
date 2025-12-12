const express = require('express');
const router = express.Router();
const remissionController = require('../controllers/remissionController');

// GET /api/remisiones - Listar remisiones
router.get('/remisiones', remissionController.getAllRemissions);

// GET /api/remisiones-detalle - Detalles (usada por query param)
router.get('/remisiones-detalle', remissionController.getRemissionDetails);

// GET /api/remisiones/:id/detalle - Detalles por ID
router.get('/remisiones/:id/detalle', remissionController.getRemissionDetails);

// PUT /api/remisiones/:id
router.put('/remisiones/:id', remissionController.updateRemission);

// POST /api/remisiones
router.post('/remisiones', remissionController.createRemission);

module.exports = router;
