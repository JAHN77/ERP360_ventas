const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

router.get('/performance', analyticsController.getCommercialPerformance);
router.get('/leakage', analyticsController.getSalesLeakage);
router.get('/logistics', analyticsController.getLogisticsEfficiency);
router.get('/financial', analyticsController.getFinancialCycle);

module.exports = router;
