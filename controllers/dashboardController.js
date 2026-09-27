const { obtenerMetricas } = require('../lib/dashboard');
const { recomendaciones, NIVEL_ESTILO } = require('../lib/asistente');
const { CATEGORIAS, ESTADOS } = require('../lib/ens');
const { GRAVEDADES, ESTADOS_INCIDENTE } = require('../lib/incidentes');
const { TIPOS_DERECHO, ESTADOS_SOLICITUD } = require('../lib/derechos');
const { TIPOS_POLITICA } = require('../lib/politicas');
const { CATEGORIAS_SISTEMA } = require('../lib/declaraciones');
const { CRITICIDADES, RESULTADOS_PRUEBA } = require('../lib/bia');

// "José María de Paz Siles" → "José María" (hasta la primera partícula, máximo dos palabras)
const nombrePila = (nombre = '') => {
  const partes = [];
  for (const p of nombre.split(/\s+/)) {
    if (!p || /^(de|del|la|las|los|y)$/i.test(p) || partes.length === 2) break;
    partes.push(p);
  }
  return partes.join(' ') || nombre;
};

// Panel de control ejecutivo: métricas clave de todos los módulos
const index = async (req, res) => {
  const m = await obtenerMetricas(req.user);
  res.render('dashboard', {
    title: 'Panel de control',
    m,
    recomendaciones: recomendaciones(m),
    nivelEstilo: NIVEL_ESTILO,
    nombrePila: nombrePila(req.user.nombre),
    categorias: CATEGORIAS,
    CATEGORIAS_SISTEMA,
    GRAVEDADES,
    TIPOS_DERECHO,
    TIPOS_POLITICA,
    CRITICIDADES,
    RESULTADOS_PRUEBA,
    etiquetasEstado: { ens: ESTADOS, incidente: ESTADOS_INCIDENTE, derecho: ESTADOS_SOLICITUD },
  });
};

module.exports = { index };
