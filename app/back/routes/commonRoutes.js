const express = require('express');
const router = express.Router();
const commonController = require('../controllers/commonController');

router.get('/vendedores', commonController.getVendedores);
router.get('/bodegas', commonController.getBodegas);
router.get('/ciudades', commonController.getCiudades);
// Duplicate removed
router.post('/query', commonController.executeCustomQuery);
router.get('/health', commonController.getHealth);
router.get('/empresa', commonController.getEmpresa);
const traceabilityController = require('../controllers/traceabilityController');
router.get('/trazabilidad', traceabilityController.getTraceability);


module.exports = router;
