// Rutas de las páginas legales (montadas en «/», ver app.js). Son públicas: no exigen sesión.
const express = require('express');
const legalController = require('../controllers/legalController');

const router = express.Router();

router.get('/aviso-legal', legalController.avisoLegal);
router.get('/privacidad', legalController.privacidad);
router.get('/cookies', legalController.cookies);

module.exports = router;
