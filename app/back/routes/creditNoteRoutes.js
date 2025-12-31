const express = require('express');
const router = express.Router();
const creditNoteController = require('../controllers/creditNoteController');

router.get('/devoluciones/clientes-con-facturas-aceptadas', creditNoteController.getClientsWithAcceptedInvoices);
router.get('/notas-credito', creditNoteController.getAllCreditNotes);
router.post('/notas-credito', creditNoteController.createCreditNote);
router.put('/notas-credito/:id', creditNoteController.updateCreditNote);
router.get('/notas-credito/next-number', creditNoteController.getNextCreditNoteNumber);

// POST /api/notas-credito/:id/email - Enviar nota de crédito por correo
router.post('/:id/email', creditNoteController.sendCreditNoteEmail);

module.exports = router;
