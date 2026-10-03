// Ruta del panel de control (/dashboard), con ?sistema=ID para verlo limitado a un sistema.
const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { ensureAuthenticated } = require('../middlewares/auth');

const router = express.Router();

router.get('/dashboard', ensureAuthenticated, dashboardController.index);

module.exports = router;
