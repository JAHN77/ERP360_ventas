const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/analytics/general
router.get('/general', verifyToken, analyticsController.getGeneralStats);

// GET /api/analytics/timeline/:orderId
router.get('/timeline/:orderId', verifyToken, analyticsController.getOrderTimeline);

// GET /api/analytics/order-items-comparison/:orderId
router.get('/comparison/:orderId', verifyToken, analyticsController.getOrderItemsComparison);

module.exports = router;
