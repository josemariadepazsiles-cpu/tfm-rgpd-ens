const express = require('express');
const authController = require('../controllers/authController');
const { ensureAuthenticated, ensureAdmin, ensureGuest } = require('../middlewares/auth');

const router = express.Router();

router.get('/login', ensureGuest, authController.showLogin);
router.post('/login', ensureGuest, authController.login);
router.post('/logout', ensureAuthenticated, authController.logout);

// Solo un administrador puede dar de alta usuarios (y asignar roles)
router.get('/registro', ensureAdmin, authController.showRegistro);
router.post('/registro', ensureAdmin, authController.registro);

module.exports = router;
