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
const { areaDeRuta } = require('../lib/areas');
const { diasNaturalesEntre } = require('../lib/formato');

const PRIORIDAD = { critico: 0, atencion: 1, info: 2 };
const DIA = 24 * 3600 * 1000;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const areaDeEnlace = (href = '') => areaDeRuta(href.split(/[?#]/)[0]);

// Recomendaciones del asistente que ya cubren, con más detalle, las alertas de cada módulo
const CUBIERTAS_POR_ALERTAS = {
  Incidentes: (href) => href.startsWith('/incidentes?alerta=aepd_'),
  Derechos: (href) => href.startsWith('/derechos?plazo=vencidas') || /^\/derechos\/\d+$/.test(href),
  'Políticas': (href) => href.startsWith('/politicas?filtro=revision'),
  Continuidad: (href) => href.startsWith('/bia?filtro=sin_prueba'),
};

// Acciones pendientes: alertas con plazo (una por registro) + recomendaciones del asistente
// (sin repetir lo que ya cubren las alertas) + seguimiento de incidentes abiertos y de la
// próxima solicitud de derechos. Ordenadas por urgencia: crítico > atención > informativo.
const construirAcciones = (vista, recs, m) => {
  const modulosConAlertas = new Set(vista.alertas.map((a) => a.modulo));
  const acciones = [
    ...vista.alertas.map((a) => ({ nivel: a.nivel, icono: a.icono, titulo: a.titulo, motivo: a.detalle, href: a.href, accion: 'Abrir', modulo: a.modulo })),
    ...recs.filter((r) => ![...modulosConAlertas].some((mod) => CUBIERTAS_POR_ALERTAS[mod] && CUBIERTAS_POR_ALERTAS[mod](r.href))),
  ];
  const sinAepd = (m.incidentes.activos || 0) - (m.incidentes.aepdPendientes || 0);
  if (sinAepd > 0) {
    acciones.push({ nivel: 'atencion', icono: 'siren', titulo: `${plural(sinAepd, 'incidente abierto', 'incidentes abiertos')} en gestión`,
      motivo: 'Sin notificación a la AEPD pendiente: completa la investigación y ciérralos cuando estén resueltos.', href: '/incidentes?alerta=activos', accion: 'Ver incidentes' });
  }
  const p = m.derechos.proxima;
  if (p && p.urgencia.nivel === 'verde') {
    acciones.push({ nivel: 'info', icono: 'calendar-clock', titulo: `La solicitud de ${p.nombre_solicitante} vence en ${plural(p.urgencia.dias, 'día', 'días')}`,
      motivo: 'Próxima solicitud de derechos en vencer (plazo de 1 mes, art. 12.3 RGPD).', href: `/derechos/${p.id}`, accion: 'Abrir solicitud' });
  }
  return acciones
    .map((a) => ({ ...a, area: areaDeEnlace(a.href) }))
    .sort((a, b) => PRIORIDAD[a.nivel] - PRIORIDAD[b.nivel]);
};

// Próximo plazo que vence (aún no vencido): alertas con fecha límite y próxima solicitud de derechos
const proximoVencimiento = (vista, m, TIPOS, ahora = new Date()) => {
  const candidatos = vista.alertas
    .filter((a) => a.vence && new Date(a.vence) > ahora)
    .map((a) => ({ fecha: new Date(a.vence), texto: a.titulo, href: a.href }));
  const p = m.derechos.proxima;
  if (p) candidatos.push({ fecha: new Date(p.fecha_limite), texto: `Solicitud de ${TIPOS[p.tipo_derecho].toLowerCase()}`, href: `/derechos/${p.id}` });
  const primero = candidatos.sort((a, b) => a.fecha - b.fecha)[0];
  if (!primero) return null;
  // Menos de un día: en horas; si no, en días naturales (misma cuenta que el módulo de derechos)
  const ms = primero.fecha - ahora;
  const plazo = ms < DIA ? plural(Math.max(1, Math.ceil(ms / 3600000)), 'hora', 'horas') : plural(diasNaturalesEntre(ahora, primero.fecha), 'día', 'días');
  return { ...primero, plazo, area: areaDeEnlace(primero.href) };
};

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
  const vista = sistema || panel.todos;
  const recs = recomendaciones(metricas).map((r) => ({ ...r, href: enlaceConSistema(r.href, sid) }));

  res.render('dashboard', {
    title: sistema ? `Panel · ${sistema.nombre}` : 'Panel de control',
    m: metricas,
    panel,
    sistema,
    // Datos de la selección: un sistema concreto o «Todos los sistemas»
    vista,
    // Con un sistema elegido, los enlaces a listados mantienen el filtro
    enlace: (href) => enlaceConSistema(href, sid),
    acciones: construirAcciones(vista, recs, metricas),
    proximo: proximoVencimiento(vista, metricas, TIPOS_DERECHO),
    areaDeEnlace,
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
