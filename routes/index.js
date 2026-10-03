// Ruta de la raíz «/»: redirige al panel o al login (ver homeController).
const express = require('express');
const homeController = require('../controllers/homeController');

const router = express.Router();

router.get('/', homeController.index);

module.exports = router;
