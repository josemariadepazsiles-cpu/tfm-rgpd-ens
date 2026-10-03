// Rutas de sesión: login, logout y la dirección antigua /registro (montadas en «/», ver app.js).
const express = require('express');
const authController = require('../controllers/authController');
const { ensureAuthenticated, ensureAdmin, ensureGuest } = require('../middlewares/auth');

const router = express.Router();

router.get('/login', ensureGuest, authController.showLogin);
router.post('/login', ensureGuest, authController.login);
router.post('/logout', ensureAuthenticated, authController.logout);

// El alta de usuarios está en la gestión de usuarios (/usuarios); se mantiene la dirección antigua
router.get('/registro', ensureAdmin, (req, res) => res.redirect('/usuarios/nuevo'));

module.exports = router;
