const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const jwt = require('jsonwebtoken');

// Middleware moved to ../middleware/authMiddleware.js
const verifyToken = require('../middleware/authMiddleware');

router.post('/login', authController.login);
router.get('/me', verifyToken, authController.me);
router.post('/firma', verifyToken, authController.updateSignature);

module.exports = router;
