// Rutas del catálogo de controles ENS (/controles). Todas exigen rol Administrador.
const express = require('express');
const controlController = require('../controllers/controlController');
const { ensureAdmin } = require('../middlewares/auth');

const router = express.Router();

// El catálogo de controles es exclusivo de administradores
router.use(ensureAdmin);

router.get('/', controlController.list);
router.get('/nuevo', controlController.newForm);
router.post('/', controlController.create);
router.get('/:id/editar', controlController.editForm);
router.post('/:id', controlController.update);
router.post('/:id/eliminar', controlController.remove);

module.exports = router;
