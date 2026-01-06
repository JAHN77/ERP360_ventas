const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');

const verifyToken = require('../middleware/authMiddleware');

// IMPORTANT: Define specific routes BEFORE parameterized routes (like /:id)

// Search Providers for Purchase Orders (Suppliers with Email)
router.get('/ordenes-compra/buscar-proveedores', verifyToken, purchaseOrderController.searchProveedores);

// List Purchase Orders
router.get('/ordenes-compra', verifyToken, purchaseOrderController.getAllOrders);

// Create Purchase Order
router.post('/ordenes-compra', verifyToken, purchaseOrderController.createOrder);

// Get Order by Number
router.get('/ordenes-compra/numero/:number', verifyToken, purchaseOrderController.getOrderByNumber);

// Get Purchase Order Detail
router.get('/ordenes-compra/:id', verifyToken, purchaseOrderController.getOrderById);

module.exports = router;
