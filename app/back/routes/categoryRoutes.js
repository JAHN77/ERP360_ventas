const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/categoriesController');

const verifyToken = require('../middleware/authMiddleware');

router.get('/', verifyToken, categoriesController.getAllCategories);
router.get('/lineas-sublineas', verifyToken, categoriesController.getLinesWithSublines);

// Basic CRUD for Lines
router.get('/lineas', verifyToken, categoriesController.getLines);
router.post('/lineas', verifyToken, categoriesController.createLine);
router.put('/lineas/:id', verifyToken, categoriesController.updateLine);
router.delete('/lineas/:id', verifyToken, categoriesController.deleteLine);

// Basic CRUD for Sublines
router.post('/sublineas', verifyToken, categoriesController.createSubline);
router.put('/sublineas/:codline/:codsub', verifyToken, categoriesController.updateSubline);
router.delete('/sublineas/:codline/:codsub', verifyToken, categoriesController.deleteSubline);

module.exports = router;
