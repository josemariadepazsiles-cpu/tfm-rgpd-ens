const express = require('express');
const evaluacionController = require('../controllers/evaluacionController');
const { ensureAuthenticated, ensureAdmin } = require('../middlewares/auth');

const router = express.Router();

router.use(ensureAuthenticated);

router.get('/:id', evaluacionController.show);
router.post('/:id/eliminar', ensureAdmin, evaluacionController.remove);
router.get('/:id/controles/:controlId/editar', evaluacionController.editControlForm);
router.post('/:id/controles/:controlId', evaluacionController.updateControl);
router.post('/:id/controles/:controlId/estado', evaluacionController.cambiarEstado);
router.post('/:id/controles/:controlId/asignarme', evaluacionController.asignarme);

module.exports = router;
