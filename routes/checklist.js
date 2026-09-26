const express = require('express');
const checklistController = require('../controllers/checklistController');
const { ensureAuthenticated, ensureAdmin } = require('../middlewares/auth');

const router = express.Router();

router.use(ensureAuthenticated);

router.get('/', checklistController.list);
router.get('/nuevo', ensureAdmin, checklistController.newForm);
router.post('/', ensureAdmin, checklistController.create);
router.get('/:id/editar', checklistController.editForm);
router.post('/:id', checklistController.update);
router.post('/:id/estado', checklistController.cambiarEstado);
router.post('/:id/asignarme', checklistController.asignarme);
router.post('/:id/eliminar', ensureAdmin, checklistController.remove);

module.exports = router;
