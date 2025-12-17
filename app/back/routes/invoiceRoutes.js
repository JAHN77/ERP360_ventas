const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

// GET /api/facturas - Listar facturas
router.get('/facturas', invoiceController.getAllInvoices);

// GET /api/facturas-detalle - Listar detalles de facturas
router.get('/facturas-detalle', invoiceController.getInvoiceDetails);

// POST /api/facturas - Crear factura
router.post('/facturas', invoiceController.createInvoice);

// PUT /api/facturas/:id - Actualizar factura
router.put('/facturas/:id', invoiceController.updateInvoice);

// POST /api/facturas/:id/timbrar - Timbrar factura existente
router.post('/facturas/:id/timbrar', invoiceController.stampInvoice);

module.exports = router;
