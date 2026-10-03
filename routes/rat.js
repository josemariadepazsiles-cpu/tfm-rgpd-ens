// Rutas del Registro de Actividades de Tratamiento (/rat). Un Usuario solo ve y edita las
// actividades de las que es responsable (lo filtra el controlador); eliminar es del Administrador.
const express = require('express');
const ratController = require('../controllers/ratController');
const { ensureAuthenticated, ensureAdmin } = require('../middlewares/auth');

const router = express.Router();

router.use(ensureAuthenticated);

router.get('/', ratController.list);
router.get('/nueva', ratController.newForm);
router.post('/', ratController.create);
router.get('/:id', ratController.show);
router.get('/:id/editar', ratController.editForm);
router.post('/:id', ratController.update);
router.post('/:id/eliminar', ensureAdmin, ratController.remove);

module.exports = router;
