const express = require('express');
const riesgoController = require('../controllers/riesgoController');
const { ensureAuthenticated, ensureAdmin } = require('../middlewares/auth');

const router = express.Router();

router.use(ensureAuthenticated);

router.get('/', riesgoController.list);
router.get('/nuevo', riesgoController.newForm);
router.post('/', riesgoController.create);
router.get('/:id', riesgoController.show);
router.get('/:id/editar', riesgoController.editForm);
router.post('/:id', riesgoController.update);
router.post('/:id/eliminar', ensureAdmin, riesgoController.remove);

module.exports = router;
