const express = require('express');
const router = express.Router();
const commonController = require('../controllers/commonController');

router.get('/vendedores', commonController.getVendedores);
router.get('/bodegas', commonController.getBodegas);
router.get('/ciudades', commonController.getCiudades);
// Duplicate removed
router.post('/query', commonController.executeCustomQuery);
router.get('/health', commonController.getHealth);


module.exports = router;
