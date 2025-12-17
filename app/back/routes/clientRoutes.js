const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// GET /api/clientes
router.get('/', clientController.getAllClients);

// GET /api/clientes/actividades-ciiu
router.get('/actividades-ciiu', clientController.searchActividadesCiiu);

// GET /api/clientes/search
router.get('/search', clientController.searchClients);

// GET /api/clientes/:id
router.get('/:id', clientController.getClientById);

// PUT /api/clientes/:id
router.put('/:id', clientController.updateClient);

// POST /api/clientes/:id/lista-precios
router.post('/:id/lista-precios', clientController.assignPriceList);

// POST /api/clientes
router.post('/', clientController.createClient);

module.exports = router;
