const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/categoriesController');

router.get('/', categoriesController.getAllCategories);
router.get('/lineas-sublineas', categoriesController.getLinesWithSublines);

// Basic CRUD for Lines
router.get('/lineas', categoriesController.getLines);
router.post('/lineas', categoriesController.createLine);
router.put('/lineas/:id', categoriesController.updateLine);
router.delete('/lineas/:id', categoriesController.deleteLine);

// Basic CRUD for Sublines
router.post('/sublineas', categoriesController.createSubline);
router.put('/sublineas/:codline/:codsub', categoriesController.updateSubline);
router.delete('/sublineas/:codline/:codsub', categoriesController.deleteSubline);

module.exports = router;
