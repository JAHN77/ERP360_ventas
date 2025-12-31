const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');

// IMPORTANT: Define specific routes BEFORE parameterized routes (like /:id)

// Search Providers for Purchase Orders (Suppliers with Email)
router.get('/ordenes-compra/buscar-proveedores', purchaseOrderController.searchProveedores);

// List Purchase Orders
router.get('/ordenes-compra', purchaseOrderController.getAllOrders);

// Create Purchase Order
router.post('/ordenes-compra', purchaseOrderController.createOrder);

// Get Order by Number
router.get('/ordenes-compra/numero/:number', purchaseOrderController.getOrderByNumber);

// Get Purchase Order Detail
router.get('/ordenes-compra/:id', purchaseOrderController.getOrderById);

module.exports = router;
