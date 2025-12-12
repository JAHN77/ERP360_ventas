const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Mounted at /api (likely) or independent. 
// Assuming mounted at /api in server.cjs
router.get('/pedidos', orderController.getAllOrders);
router.get('/pedidos-detalle', orderController.getOrderDetails);
router.post('/pedidos', orderController.createOrder);
router.put('/pedidos/:id', orderController.updateOrder);

module.exports = router;
