const express = require('express');
const biaController = require('../controllers/biaController');
const { ensureAuthenticated, ensureAdmin } = require('../middlewares/auth');

const router = express.Router();

// Editar y registrar pruebas lo controla el propio controlador (Administrador o responsable)
router.use(ensureAuthenticated);

router.get('/', biaController.list);
router.get('/nuevo', ensureAdmin, biaController.newForm);
router.post('/', ensureAdmin, biaController.create);
router.get('/:id', biaController.show);
router.get('/:id/editar', biaController.editForm);
router.post('/:id', biaController.update);
router.post('/:id/pruebas', biaController.registrarPrueba);

module.exports = router;
