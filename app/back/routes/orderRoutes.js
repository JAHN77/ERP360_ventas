const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

const verifyToken = require('../middleware/authMiddleware');

// Mounted at /api (likely) or independent. 
// Assuming mounted at /api in server.cjs
router.get('/pedidos', verifyToken, orderController.getAllOrders);
router.get('/pedidos-detalle', verifyToken, orderController.getOrderDetails);
router.post('/pedidos', verifyToken, orderController.createOrder);
router.post('/pedidos/:id/send-email', verifyToken, orderController.sendOrderEmail);
router.put('/pedidos/:id', verifyToken, orderController.updateOrder);
router.get('/pedidos/next-number', verifyToken, orderController.getNextOrderNumber);

module.exports = router;
