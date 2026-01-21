const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

const verifyToken = require('../middleware/authMiddleware');

console.log('Inventory Controller Keys:', Object.keys(inventoryController));
console.log('Is getStock function?', typeof inventoryController.getStock);

// GET /api/inventario/movimientos - Obtener todos los movimientos (Global)
router.get('/movimientos', verifyToken, inventoryController.getInventoryMovements);

// GET /api/inventario/kardex/:productoId - Obtener historial de movimientos
router.get('/kardex/:productoId', verifyToken, inventoryController.getKardex);

// POST /api/inventario/entradas - Registrar entrada de inventario
router.post('/entradas', verifyToken, inventoryController.createInventoryEntry);

// GET /api/inventario/stock/:productoId - Obtener stock actual por bodega
router.get('/stock/:productoId', verifyToken, inventoryController.getStock);

module.exports = router;
