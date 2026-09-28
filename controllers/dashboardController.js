const { obtenerMetricas } = require('../lib/dashboard');
const { recomendaciones, NIVEL_ESTILO } = require('../lib/asistente');
const { CATEGORIAS, ESTADOS } = require('../lib/ens');
const { GRAVEDADES, ESTADOS_INCIDENTE } = require('../lib/incidentes');
const { TIPOS_DERECHO, ESTADOS_SOLICITUD } = require('../lib/derechos');
const { TIPOS_POLITICA } = require('../lib/politicas');
const { CATEGORIAS_SISTEMA } = require('../lib/declaraciones');
const { CRITICIDADES, RESULTADOS_PRUEBA } = require('../lib/bia');
const { idValido } = require('../lib/permisos');
const { enlaceConSistema } = require('../lib/sistemas');
const { panelSistemas } = require('../lib/panel');

// "José María de Paz Siles" → "José María" (hasta la primera partícula, máximo dos palabras)
const nombrePila = (nombre = '') => {
  const partes = [];
  for (const p of nombre.split(/\s+/)) {
    if (!p || /^(de|del|la|las|los|y)$/i.test(p) || partes.length === 2) break;
    partes.push(p);
  }
  return partes.join(' ') || nombre;
};

// Panel de control ejecutivo. Arriba, la visión global de la organización; debajo, «Ver por
// sistema»: con ?sistema=ID todo el resto del panel se limita a ese sistema.
const index = async (req, res) => {
  const id = idValido(req.query.sistema);
  // El panel por sistema se calcula para todos los sistemas a la vez (consultas agregadas);
  // se lanza en paralelo con las métricas detalladas por módulo
  const [panel, m] = await Promise.all([
    panelSistemas(req.user),
    obtenerMetricas(req.user, id),
  ]);
  const sistema = id ? panel.sistemas.find((s) => s.id === id) || null : null;
  // Sistema inexistente: vista de todos los sistemas (las métricas se recalculan sin filtro)
  const metricas = id && !sistema ? await obtenerMetricas(req.user, null) : m;
  const sid = sistema ? sistema.id : null;

  res.render('dashboard', {
    title: sistema ? `Panel · ${sistema.nombre}` : 'Panel de control',
    m: metricas,
    panel,
    sistema,
    // Datos de la selección: un sistema concreto o «Todos los sistemas»
    vista: sistema || panel.todos,
    // Con un sistema elegido, los enlaces a listados mantienen el filtro
    enlace: (href) => enlaceConSistema(href, sid),
    recomendaciones: recomendaciones(metricas).map((r) => ({ ...r, href: enlaceConSistema(r.href, sid) })),
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
