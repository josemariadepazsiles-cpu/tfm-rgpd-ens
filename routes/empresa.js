// Rutas de los datos de la organización (/empresa): todos los consultan; solo el Administrador
// los guarda.
const express = require('express');
const empresaController = require('../controllers/empresaController');
const { ensureAuthenticated, ensureAdmin } = require('../middlewares/auth');

const router = express.Router();

router.use(ensureAuthenticated);

router.get('/', empresaController.show);
router.post('/', ensureAdmin, empresaController.update);

module.exports = router;
