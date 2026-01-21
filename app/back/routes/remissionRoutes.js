const express = require('express');
const router = express.Router();
const remissionController = require('../controllers/remissionController');

const verifyToken = require('../middleware/authMiddleware');

// GET /api/remisiones - Listar remisiones
router.get('/remisiones', verifyToken, remissionController.getAllRemissions);

// GET /api/remisiones-detalle - Detalles (usada por query param)
router.get('/remisiones-detalle', verifyToken, remissionController.getRemissionDetails);

// GET /api/remisiones/:id/detalle - Detalles por ID
router.get('/remisiones/:id/detalle', verifyToken, remissionController.getRemissionDetails);

// PUT /api/remisiones/:id
router.put('/remisiones/:id', verifyToken, remissionController.updateRemission);

// POST /api/remisiones
router.post('/remisiones', verifyToken, remissionController.createRemission);

// POST /api/remisiones/:id/send-email
router.post('/remisiones/:id/send-email', verifyToken, remissionController.sendRemissionEmail);

module.exports = router;
