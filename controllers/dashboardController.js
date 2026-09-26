const { obtenerMetricas } = require('../lib/dashboard');
const { CATEGORIAS } = require('../lib/ens');
const { GRAVEDADES } = require('../lib/incidentes');
const { TIPOS_DERECHO } = require('../lib/derechos');
const { TIPOS_POLITICA } = require('../lib/politicas');
const { CATEGORIAS_SISTEMA } = require('../lib/declaraciones');
const { CRITICIDADES } = require('../lib/bia');

// Panel de control ejecutivo: métricas clave de todos los módulos
const index = async (req, res) => {
  const m = await obtenerMetricas(req.user);
  res.render('dashboard', {
    title: 'Panel de control',
    m,
    categorias: CATEGORIAS,
    CATEGORIAS_SISTEMA,
    GRAVEDADES,
    TIPOS_DERECHO,
    TIPOS_POLITICA,
    CRITICIDADES,
  });
};

module.exports = { index };
