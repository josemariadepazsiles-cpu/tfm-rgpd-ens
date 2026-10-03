// Rutas de incidentes y brechas de seguridad (/incidentes): alta, edición, cambios de estado e
// historial.
const express = require('express');
const incidenteController = require('../controllers/incidenteController');
const { ensureAuthenticated } = require('../middlewares/auth');

const router = express.Router();

// Todos los usuarios autenticados pueden ver y reportar; la edición la controla el
// propio controlador (Administrador o responsable asignado)
router.use(ensureAuthenticated);

router.get('/', incidenteController.list);
router.get('/nuevo', incidenteController.newForm);
router.post('/', incidenteController.create);
router.get('/:id', incidenteController.show);
router.get('/:id/historial', incidenteController.historial);
router.get('/:id/editar', incidenteController.editForm);
router.post('/:id', incidenteController.update);
router.post('/:id/estado', incidenteController.cambiarEstado);

module.exports = router;
