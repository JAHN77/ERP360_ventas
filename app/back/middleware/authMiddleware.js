const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.status(401).json({ success: false, message: 'Acceso denegado. Token no proporcionado.' });

    const JWT_SECRET = process.env.JWT_SECRET || 'erp360_secret_key_development_only';

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Token inválido o expirado.' });

        // Attach user info to request
        req.user = user;

        // IMPORTANT: Extract database name from token for multi-tenancy
        // If db_name is present in token, attach it to request for controllers to use
        if (user.db_name) {
            req.db_name = user.db_name;
            try {
                const fs = require('fs');
                const path = require('path');
                const logPath = path.join(process.cwd(), 'debug.log');
                fs.appendFileSync(logPath, `[${new Date().toISOString()}] 🔑 [AuthMiddleware] User: ${req.user.id}, DB: ${req.db_name}\n`);
            } catch (e) { console.error('Log error:', e); }
        }

        next();
    });
};

module.exports = verifyToken;


