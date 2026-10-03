// Rutas de los sistemas de información (/sistemas), eje de la aplicación: ficha con toda la
// información RGPD/ENS asociada, histórico y creación de evaluaciones ENS.
const express = require('express');
const sistemaController = require('../controllers/sistemaController');
const evaluacionController = require('../controllers/evaluacionController');
const { ensureAuthenticated, ensureAdmin } = require('../middlewares/auth');

const router = express.Router();

router.use(ensureAuthenticated);

router.get('/', sistemaController.list);
router.get('/nuevo', ensureAdmin, sistemaController.newForm);
router.post('/', ensureAdmin, sistemaController.create);
router.get('/:id', sistemaController.show);
router.get('/:id/historial', sistemaController.historial);
router.get('/:id/editar', ensureAdmin, sistemaController.editForm);
router.post('/:id', ensureAdmin, sistemaController.update);
router.post('/:id/eliminar', ensureAdmin, sistemaController.remove);
router.post('/:id/evaluaciones', ensureAdmin, evaluacionController.create);

module.exports = router;
