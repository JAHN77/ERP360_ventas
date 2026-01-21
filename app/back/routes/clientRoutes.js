const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

const verifyToken = require('../middleware/authMiddleware');

// GET /api/clientes
router.get('/', verifyToken, clientController.getAllClients);

// GET /api/clientes/actividades-ciiu
router.get('/actividades-ciiu', verifyToken, clientController.searchActividadesCiiu);

// GET /api/clientes/search
router.get('/search', verifyToken, clientController.searchClients);

// GET /api/clientes/:id
router.get('/:id', verifyToken, clientController.getClientById);

// PUT /api/clientes/:id
router.put('/:id', verifyToken, clientController.updateClient);

// POST /api/clientes/:id/lista-precios
router.post('/:id/lista-precios', verifyToken, clientController.assignPriceList);

// POST /api/clientes
router.post('/', verifyToken, clientController.createClient);

module.exports = router;
