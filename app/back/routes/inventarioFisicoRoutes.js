const express = require('express');
const router = express.Router();
const inventarioFisicoController = require('../controllers/inventarioFisicoController');

const verifyToken = require('../middleware/authMiddleware');

// Obtener productos para conteo físico
router.get('/productos', verifyToken, inventarioFisicoController.getProductosParaConteo);

// Obtener lista de conteos registrados
router.get('/conteos', verifyToken, inventarioFisicoController.getConteos);

// Obtener siguiente número de conteo
router.get('/siguiente-numero', verifyToken, inventarioFisicoController.getSiguienteNumeroConteo);

// Crear nuevo conteo físico
router.post('/conteo', verifyToken, inventarioFisicoController.createConteo);

// Actualizar cantidad física de un producto en el conteo
router.put('/conteo/:id', verifyToken, inventarioFisicoController.updateConteoFisico);

// Aplicar ajustes del conteo al inventario
router.post('/aplicar/:idconteo', verifyToken, inventarioFisicoController.aplicarConteo);

module.exports = router;
