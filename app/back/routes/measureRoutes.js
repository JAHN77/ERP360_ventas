const express = require('express');
const router = express.Router();
const measuresController = require('../controllers/measuresController');

const verifyToken = require('../middleware/authMiddleware');

router.get('/', verifyToken, measuresController.getAllMeasures);

module.exports = router;
