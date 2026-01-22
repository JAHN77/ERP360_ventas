const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

const verifyToken = require('../middleware/authMiddleware');

// GET /api/productos/
router.get('/', verifyToken, productController.getAllProducts);

// GET /api/productos/services
router.get('/services', verifyToken, productController.getAllServices);

// GET /api/productos/search (Mapped from /api/buscar/productos logic if we want to consolidate, 
// OR keep legacy path in server.cjs and point to controller. 
// Plan: Using this for the MAIN search endpoint if we move 'buscar' here. 
// But wait, the frontend calls /api/buscar/productos and /api/productos separately.
// The /api/productos route is the main list.
// The /api/buscar/productos is for autocomplete.
// I will Expose autocomplete as /search here as well, but I might need to keep legacy route or redirect.
// For now, let's expose specific routes.


router.get('/:id/stock', verifyToken, productController.getProductStockDetails);

// PUT /api/productos/:id
router.put('/:id', verifyToken, productController.updateProduct);

module.exports = router;
