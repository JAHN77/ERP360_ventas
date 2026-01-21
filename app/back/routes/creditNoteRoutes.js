const express = require('express');
const router = express.Router();
const creditNoteController = require('../controllers/creditNoteController');

const verifyToken = require('../middleware/authMiddleware');

router.get('/devoluciones/clientes-con-facturas-aceptadas', verifyToken, creditNoteController.getClientsWithAcceptedInvoices);
router.get('/notas-credito', verifyToken, creditNoteController.getAllCreditNotes);
router.post('/notas-credito', verifyToken, creditNoteController.createCreditNote);
router.put('/notas-credito/:id', verifyToken, creditNoteController.updateCreditNote);
router.get('/notas-credito/next-number', verifyToken, creditNoteController.getNextCreditNoteNumber);

// POST /api/notas-credito/:id/email - Enviar nota de crédito por correo
router.post('/:id/email', verifyToken, creditNoteController.sendCreditNoteEmail);

module.exports = router;
