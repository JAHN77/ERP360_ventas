const express = require('express');
const router = express.Router();
const measuresController = require('../controllers/measuresController');

router.get('/', measuresController.getAllMeasures);

module.exports = router;
