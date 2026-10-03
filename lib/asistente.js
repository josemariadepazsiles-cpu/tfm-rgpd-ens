// Asistente de cumplimiento: recomendaciones priorizadas generadas a partir de los datos
// reales de la plataforma (reglas explícitas, sin modelos de IA). Cada recomendación indica
// el motivo normativo y enlaza al listado ya filtrado para actuar.
// Tailwind escanea este archivo (ver input.css).

const PRIORIDAD = { critico: 0, atencion: 1, info: 2 };

const NIVEL_ESTILO = {
  critico: { punto: 'bg-red-500', texto: 'text-red-700', etiqueta: 'Crítico' },
  atencion: { punto: 'bg-amber-500', texto: 'text-amber-700', etiqueta: 'Atención' },
  info: { punto: 'bg-sky-500', texto: 'text-sky-700', etiqueta: 'Sugerencia' },
};

/**
 * @param {number} n
 * @param {string} uno Texto en singular
 * @param {string} varios Texto en plural
 * @returns {string} p. ej. «1 riesgo» o «3 riesgos»
 */
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// `m` = métricas de lib/dashboard.js
/**
 * @param {object} m Métricas de obtenerMetricas (lib/dashboard.js)
 * @returns {{ nivel: string, icono: string, titulo: string, motivo: string, href: string, accion: string }[]}
 *   Ordenadas: crítico, atención, sugerencia
 */
const recomendaciones = (m) => {
  const r = [];
  const add = (nivel, icono, titulo, motivo, href, accion) => r.push({ nivel, icono, titulo, motivo, href, accion });
  const { incidentes: inc, derechos: der, proveedores: prov, ens, declaraciones: decl, politicas: pol, bia, actividades: act } = m;

  if (inc.aepdVencidos) {
    add('critico', 'siren', `Notifica a la AEPD ${plural(inc.aepdVencidos, 'brecha fuera de plazo', 'brechas fuera de plazo')}`,
      'Han superado las 72 h desde su detección (art. 33.1 RGPD). Si se notifica tarde, deben justificarse los motivos del retraso.',
      '/incidentes?alerta=aepd_vencido', 'Revisar incidentes');
  }
  if (der.vencidas) {
    add('critico', 'users', `Responde ${plural(der.vencidas, 'solicitud de derechos vencida', 'solicitudes de derechos vencidas')}`,
      'El plazo de respuesta al interesado ha vencido (art. 12.3 RGPD).', '/derechos?plazo=vencidas', 'Ver solicitudes');
  }
  if (prov.sinContrato) {
    add('critico', 'building-2', `Formaliza el contrato de encargado con ${plural(prov.sinContrato, 'proveedor', 'proveedores')}`,
      'Todo tratamiento por cuenta de terceros requiere un contrato de encargado (art. 28.3 RGPD).', '/proveedores?alerta=sin_contrato', 'Ver proveedores');
  }
  if (prov.sinGarantias) {
    add('critico', 'globe', `Señala las garantías de ${plural(prov.sinGarantias, 'transferencia internacional', 'transferencias internacionales')}`,
      'Las transferencias fuera del EEE necesitan un mecanismo válido (arts. 44 a 49 RGPD).', '/proveedores?alerta=sin_garantias', 'Revisar transferencias');
  }
  if (bia.sinPlan) {
    add('critico', 'life-buoy', `Define el plan de contingencia de ${plural(bia.sinPlan, 'proceso crítico o alto', 'procesos críticos o altos')}`,
      'Los procesos de mayor impacto deben contar con un plan de continuidad (ENS, op.cont).', '/bia?filtro=sin_plan', 'Ver procesos');
  }

  const pendientesAepd = inc.aepdPendientes - inc.aepdVencidos;
  if (pendientesAepd > 0) {
    add('atencion', 'clock', `${plural(pendientesAepd, 'brecha pendiente', 'brechas pendientes')} de notificar dentro de plazo`,
      'Aún están dentro de las 72 h: conviene completar la notificación a la AEPD cuanto antes.', '/incidentes?alerta=aepd_pendiente', 'Ver incidentes');
  }
  if (der.proxima && der.proxima.urgencia.nivel === 'amarillo') {
    const d = der.proxima.urgencia.dias;
    add('atencion', 'calendar-clock', `La solicitud de ${der.proxima.nombre_solicitante} vence ${d === 0 ? 'hoy' : `en ${plural(d, 'día', 'días')}`}`,
      'Quedan 10 días o menos para responder (art. 12.3 RGPD).', `/derechos/${der.proxima.id}`, 'Abrir solicitud');
  }
  if (act.altosSinMedidas) {
    add('atencion', 'gauge', `Define medidas para ${plural(act.altosSinMedidas, 'riesgo alto', 'riesgos altos')}`,
      'Hay riesgos de nivel alto sin medidas mitigadoras registradas.', '/riesgos?nivel=ALTO', 'Ver riesgos');
  }
  const sistemasBajos = ens.sistemas.filter((s) => s.global && s.global.porcentaje < 50).sort((a, b) => a.global.porcentaje - b.global.porcentaje);
  if (sistemasBajos.length) {
    const s = sistemasBajos[0];
    const pendientes = s.global.aplicables - s.global.implementados;
    add('atencion', 'shield-check', `Prioriza ${plural(pendientes, 'control pendiente', 'controles pendientes')} en ${s.nombre}`,
      `Su cumplimiento ENS es del ${s.global.porcentaje} %${sistemasBajos.length > 1 ? ` (hay ${sistemasBajos.length} sistemas por debajo del 50 %)` : ''}.`,
      `/evaluaciones/${s.ultima.id}`, 'Abrir checklist');
  }
  const declPendientes = decl.sinDeclaracion.length + decl.caducadas.length;
  if (declPendientes) {
    add('atencion', 'file-badge', `${plural(declPendientes, 'sistema necesita', 'sistemas necesitan')} una Declaración de Conformidad vigente`,
      'No tienen declaración emitida o la última tiene más de 12 meses.', '/declaraciones', 'Ver declaraciones');
  }
  if (pol.revisionVencidas) {
    add('atencion', 'book-open-check', `Revisa ${plural(pol.revisionVencidas, 'documento normativo', 'documentos normativos')} con la revisión vencida`,
      'El ENS exige revisar periódicamente la política y la normativa de seguridad.', '/politicas?filtro=revision', 'Ver documentos');
  }
  if (pol.misPendientes.length) {
    add('atencion', 'signature', `Tienes ${plural(pol.misPendientes.length, 'documento pendiente', 'documentos pendientes')} de leer y aceptar`,
      'Tu aceptación de la versión vigente queda registrada para auditoría.', '/politicas?filtro=pendientes', 'Leer y aceptar');
  }
  if (bia.sinPrueba) {
    add('atencion', 'activity', `Programa pruebas de continuidad para ${plural(bia.sinPrueba, 'proceso', 'procesos')}`,
      'Sin pruebas del plan de continuidad en los últimos 12 meses.', '/bia?filtro=sin_prueba', 'Ver procesos');
  }

  const sinEvaluar = ens.sistemas.filter((s) => !s.global);
  if (sinEvaluar.length) {
    add('info', 'layers', `Evalúa ${plural(sinEvaluar.length, 'sistema', 'sistemas')} sin evaluación ENS`,
      `${sinEvaluar.map((s) => s.nombre).slice(0, 2).join(', ')}${sinEvaluar.length > 2 ? '…' : ''} aún no tiene${sinEvaluar.length > 1 ? 'n' : ''} ninguna evaluación.`,
      '/sistemas', 'Ver sistemas');
  }
  if (pol.revisionProximas) {
    add('info', 'calendar-clock', `${plural(pol.revisionProximas, 'documento tiene', 'documentos tienen')} la revisión en los próximos 30 días`,
      'Planifica su revisión para no dejarla vencer.', '/politicas?filtro=revision', 'Ver documentos');
  }

  return r.sort((a, b) => PRIORIDAD[a.nivel] - PRIORIDAD[b.nivel]);
};

module.exports = { recomendaciones, NIVEL_ESTILO };
