const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');

// POST /api/email/send
router.post('/send', emailController.sendEmail);

// POST /api/email/credit-note
router.post('/credit-note', emailController.sendCreditNoteEmail);

module.exports = router;
