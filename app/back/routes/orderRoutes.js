const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Mounted at /api (likely) or independent. 
// Assuming mounted at /api in server.cjs
router.get('/pedidos', orderController.getAllOrders);
router.get('/pedidos-detalle', orderController.getOrderDetails);
router.post('/pedidos', orderController.createOrder);
router.post('/pedidos/:id/send-email', orderController.sendOrderEmail);
router.put('/pedidos/:id', orderController.updateOrder);
router.get('/pedidos/next-number', orderController.getNextOrderNumber);

module.exports = router;
