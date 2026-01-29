const express = require('express');
const router = express.Router();
const commonController = require('../controllers/commonController');

const verifyToken = require('../middleware/authMiddleware');

router.get('/vendedores', verifyToken, commonController.getVendedores);
router.get('/bodegas', verifyToken, commonController.getBodegas);
router.get('/ciudades', verifyToken, commonController.getCiudades);
router.get('/departamentos', verifyToken, commonController.getDepartamentos);
// Duplicate removed
router.post('/query', verifyToken, commonController.executeCustomQuery);
router.get('/health', commonController.getHealth); // Health check usually public
router.get('/empresa', verifyToken, commonController.getEmpresa);


module.exports = router;
