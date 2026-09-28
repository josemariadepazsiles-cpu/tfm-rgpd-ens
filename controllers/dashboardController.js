const prisma = require('../lib/prisma');
const { obtenerMetricas } = require('../lib/dashboard');
const { recomendaciones, NIVEL_ESTILO } = require('../lib/asistente');
const { CATEGORIAS, ESTADOS } = require('../lib/ens');
const { GRAVEDADES, ESTADOS_INCIDENTE } = require('../lib/incidentes');
const { TIPOS_DERECHO, ESTADOS_SOLICITUD } = require('../lib/derechos');
const { TIPOS_POLITICA } = require('../lib/politicas');
const { CATEGORIAS_SISTEMA } = require('../lib/declaraciones');
const { CRITICIDADES, RESULTADOS_PRUEBA } = require('../lib/bia');
const { idValido } = require('../lib/permisos');
const { listaSistemas, resumenRgpdPorSistema, enlaceConSistema } = require('../lib/sistemas');

// "José María de Paz Siles" → "José María" (hasta la primera partícula, máximo dos palabras)
const nombrePila = (nombre = '') => {
  const partes = [];
  for (const p of nombre.split(/\s+/)) {
    if (!p || /^(de|del|la|las|los|y)$/i.test(p) || partes.length === 2) break;
    partes.push(p);
  }
  return partes.join(' ') || nombre;
};

// Panel de control ejecutivo: métricas clave de todos los módulos, de toda la organización
// o, con ?sistema=ID, solo de ese sistema
const index = async (req, res) => {
  const id = idValido(req.query.sistema);
  const [sistemas, sistema] = await Promise.all([
    listaSistemas(),
    id ? prisma.sistema.findUnique({ where: { id }, select: { id: true, nombre: true, tipo_sistema: true, categoria_general: true } }) : null,
  ]);
  const sid = sistema ? sistema.id : null;

  const [m, rgpd] = await Promise.all([obtenerMetricas(req.user, sid), sid ? null : resumenRgpdPorSistema(req.user)]);

  // Desglose por sistema (solo en la vista de toda la organización)
  const desglose = rgpd
    ? {
        sistemas: m.ens.sistemas.map((s) => ({ id: s.id, nombre: s.nombre, global: s.global, rgpd: rgpd.de(s.id) })),
        transversal: rgpd.de(null),
      }
    : null;

  res.render('dashboard', {
    title: sistema ? `Panel · ${sistema.nombre}` : 'Panel de control',
    m,
    sistemas,
    sistema,
    desglose,
    // Con un sistema elegido, los enlaces a listados mantienen el filtro
    enlace: (href) => enlaceConSistema(href, sid),
    recomendaciones: recomendaciones(m).map((r) => ({ ...r, href: enlaceConSistema(r.href, sid) })),
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
