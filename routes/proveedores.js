const express = require('express');
const proveedorController = require('../controllers/proveedorController');
const { ensureAuthenticated, ensureAdmin } = require('../middlewares/auth');

const router = express.Router();

router.use(ensureAuthenticated);

router.get('/', proveedorController.list);
router.get('/nuevo', ensureAdmin, proveedorController.newForm);
router.post('/', ensureAdmin, proveedorController.create);
router.get('/:id', proveedorController.show);
router.get('/:id/editar', ensureAdmin, proveedorController.editForm);
router.post('/:id', ensureAdmin, proveedorController.update);

// Documentos: subir y eliminar lo controla el propio controlador (Administrador o responsable)
router.post('/:id/documentos', proveedorController.subirDocumento);
router.get('/:id/documentos/:docId', proveedorController.verDocumento);
router.post('/:id/documentos/:docId/eliminar', proveedorController.eliminarDocumento);

module.exports = router;
