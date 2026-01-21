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

// POST /api/facturas/manual-test - Enviar JSON manual a DIAN (Prueba)
router.post('/facturas/manual-test', verifyToken, invoiceController.manualDianTest);

router.get('/facturas/next-number', verifyToken, invoiceController.getNextInvoiceNumber);

// POST /api/facturas/preview-pdf
router.post('/facturas/preview-pdf', verifyToken, invoiceController.generatePreviewPdf);

module.exports = router;
