const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

const verifyToken = require('../middleware/authMiddleware');

// GET /api/facturas - Listar facturas
router.get('/facturas', verifyToken, invoiceController.getAllInvoices);

// GET /api/facturas-detalle - Listar detalles de facturas
router.get('/facturas-detalle', verifyToken, invoiceController.getInvoiceDetails);

// POST /api/facturas - Crear factura
router.post('/facturas', verifyToken, invoiceController.createInvoice);

// PUT /api/facturas/:id - Actualizar factura
router.put('/facturas/:id', verifyToken, invoiceController.updateInvoice);

// POST /api/facturas/:id/timbrar - Timbrar factura existente
router.post('/facturas/:id/timbrar', verifyToken, invoiceController.stampInvoice);

// POST /api/facturas/:id/send-email
router.post('/facturas/:id/send-email', verifyToken, invoiceController.sendInvoiceEmail);

router.get('/facturas/next-number', verifyToken, invoiceController.getNextInvoiceNumber);

module.exports = router;
