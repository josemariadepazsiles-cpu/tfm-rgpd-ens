const express = require('express');
const politicaController = require('../controllers/politicaController');
const { ensureAuthenticated, ensureAdmin } = require('../middlewares/auth');

const router = express.Router();

router.use(ensureAuthenticated);

router.get('/', politicaController.list);
router.get('/nueva', ensureAdmin, politicaController.newForm);
router.post('/', ensureAdmin, politicaController.create);
router.get('/:id', politicaController.show);
router.get('/:id/editar', ensureAdmin, politicaController.editForm);
router.post('/:id', ensureAdmin, politicaController.update);
router.post('/:id/versiones', ensureAdmin, politicaController.subirVersion);
router.post('/:id/estado', ensureAdmin, politicaController.cambiarEstado);
router.post('/:id/aceptar', politicaController.aceptar);
router.get('/:id/archivos/:archivoId', politicaController.verArchivo);

module.exports = router;
