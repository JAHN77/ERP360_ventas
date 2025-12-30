const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.status(401).json({ success: false, message: 'Acceso denegado. Token no proporcionado.' });

    const JWT_SECRET = process.env.JWT_SECRET || 'erp360_secret_key_development_only';
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Token inválido o expirado.' });
        req.user = user;
        next();
    });
};

router.post('/login', authController.login);
router.get('/me', verifyToken, authController.me);
router.post('/firma', verifyToken, authController.updateSignature);

module.exports = router;
