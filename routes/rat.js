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
