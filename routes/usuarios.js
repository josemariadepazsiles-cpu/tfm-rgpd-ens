const express = require('express');
const usuarioController = require('../controllers/usuarioController');
const { ensureAdmin } = require('../middlewares/auth');

const router = express.Router();

// La gestión de usuarios es exclusiva de administradores
router.use(ensureAdmin);

router.get('/', usuarioController.list);
router.get('/nuevo', usuarioController.newForm);
router.post('/', usuarioController.create);
router.get('/:id/editar', usuarioController.editForm);
router.post('/:id', usuarioController.update);
router.post('/:id/estado', usuarioController.cambiarEstado);

module.exports = router;
