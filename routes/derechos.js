const express = require('express');
const derechoController = require('../controllers/derechoController');
const { ensureAuthenticated } = require('../middlewares/auth');

const router = express.Router();

// Todos los usuarios autenticados pueden ver y registrar solicitudes; la tramitación la
// controla el propio controlador (Administrador o responsable asignado)
router.use(ensureAuthenticated);

router.get('/', derechoController.list);
router.get('/nueva', derechoController.newForm);
router.post('/', derechoController.create);
router.get('/:id', derechoController.show);
router.get('/:id/historial', derechoController.historial);
router.get('/:id/editar', derechoController.editForm);
router.post('/:id', derechoController.update);
router.post('/:id/estado', derechoController.cambiarEstado);

module.exports = router;
