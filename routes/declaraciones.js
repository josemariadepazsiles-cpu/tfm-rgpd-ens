// Rutas de las Declaraciones de Conformidad ENS (/declaraciones). Consultar y ver el PDF: cualquier
// usuario con sesión; observaciones, emitir y eliminar: Administrador. Se generan desde /evaluaciones.
const express = require('express');
const declaracionController = require('../controllers/declaracionController');
const { ensureAuthenticated, ensureAdmin } = require('../middlewares/auth');

const router = express.Router();

router.use(ensureAuthenticated);

router.get('/', declaracionController.list);
router.get('/:id', declaracionController.show);
router.get('/:id/pdf', declaracionController.pdf);
router.post('/:id', ensureAdmin, declaracionController.actualizarObservaciones);
router.post('/:id/emitir', ensureAdmin, declaracionController.emitir);
router.post('/:id/eliminar', ensureAdmin, declaracionController.remove);

module.exports = router;
