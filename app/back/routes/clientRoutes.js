const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// GET /api/clientes
router.get('/', clientController.getAllClients);

// GET /api/clientes/search (Mapped from legacy /api/buscar/clientes if redirected, or new usage)
router.get('/search', clientController.searchClients);

// GET /api/clientes/:id
router.get('/:id', clientController.getClientById);

// PUT /api/clientes/:id
router.put('/:id', clientController.updateClient);

// POST /api/clientes/:id/lista-precios
router.post('/:id/lista-precios', clientController.assignPriceList);

module.exports = router;
