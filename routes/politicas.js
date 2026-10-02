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
router.post('/:id/eliminar', ensureAdmin, politicaController.remove);
router.post('/:id/versiones', ensureAdmin, politicaController.subirVersion);
router.post('/:id/estado', ensureAdmin, politicaController.cambiarEstado);
router.post('/:id/aceptar', politicaController.aceptar);
router.get('/:id/archivos/:archivoId', politicaController.verArchivo);

// Documentos adjuntos (anexos, plantillas, registros…)
router.post('/:id/adjuntos', ensureAdmin, politicaController.subirAdjunto);
router.get('/:id/adjuntos/:docId', politicaController.verAdjunto);
router.post('/:id/adjuntos/:docId/eliminar', ensureAdmin, politicaController.eliminarAdjunto);

module.exports = router;
