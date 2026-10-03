// Análisis de impacto en el negocio (BIA) y continuidad: etiquetas, avisos de los procesos
// críticos y resumen para el panel.
const prisma = require('./prisma');

// BIA y continuidad: etiquetas, colores y alertas. Tailwind escanea este archivo (ver input.css).

const CRITICIDADES = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta', CRITICA: 'Crítica' };

const ESTADOS_REVISION_BIA = {
  PENDIENTE_ANALISIS: 'Pendiente de análisis',
  ANALIZADO: 'Analizado',
  REQUIERE_PLAN: 'Requiere plan de contingencia',
  PLAN_DEFINIDO: 'Plan de contingencia definido',
};

const TIPOS_PRUEBA = {
  SIMULACRO_DOCUMENTAL: 'Simulacro documental',
  PRUEBA_PARCIAL: 'Prueba parcial',
  PRUEBA_COMPLETA: 'Prueba completa',
};

const RESULTADOS_PRUEBA = { SATISFACTORIO: 'Satisfactorio', CON_INCIDENCIAS: 'Con incidencias', FALLIDO: 'Fallido' };

// Verde = Baja, amarillo = Media, naranja = Alta, rojo = Crítica
const CRITICIDAD_CLASES = {
  BAJA: 'bg-green-50 text-green-700 ring-green-600/20',
  MEDIA: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  ALTA: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  CRITICA: 'bg-red-50 text-red-700 ring-red-600/20',
};

const ESTADO_REVISION_CLASES = {
  PENDIENTE_ANALISIS: 'bg-slate-50 text-slate-600 ring-slate-500/20',
  ANALIZADO: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  REQUIERE_PLAN: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PLAN_DEFINIDO: 'bg-green-50 text-green-700 ring-green-600/20',
};

const RESULTADO_CLASES = {
  SATISFACTORIO: 'bg-green-50 text-green-700 ring-green-600/20',
  CON_INCIDENCIAS: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  FALLIDO: 'bg-red-50 text-red-700 ring-red-600/20',
};

const ALERTA_BIA_CLASES = {
  rojo: 'bg-red-50 text-red-700 ring-red-600/40 font-semibold',
  amarillo: 'bg-amber-50 text-amber-800 ring-amber-600/25',
};

// Procesos de criticidad Alta o Crítica, a los que se aplican las alertas
const CRITICIDADES_ALTAS = ['ALTA', 'CRITICA'];
/**
 * @param {{ criticidad: string }} p Proceso de negocio
 * @returns {boolean}
 */
const esCriticoOAlto = (p) => CRITICIDADES_ALTAS.includes(p.criticidad);
const MESES_PRUEBA = 12;

// Instante de hace 12 meses (mismo día y hora del año anterior)
// Regla de negocio: un proceso alto o crítico debe haberse probado en los últimos 12 meses.
// FALLO DETECTADO (menor): setMonth usa la hora local del servidor, no la de España, y en un
// 29 de febrero «hace 12 meses» se desborda al 1 de marzo del año anterior (un día de menos).
/**
 * @param {Date} [ahora]
 * @returns {Date}
 */
const inicioVentanaPruebas = (ahora = new Date()) => {
  const d = new Date(ahora);
  d.setMonth(d.getMonth() - MESES_PRUEBA);
  return d;
};

// `ultimaPrueba`: fecha de la prueba más reciente (o null)
/**
 * Avisos de un proceso (solo para criticidad Alta o Crítica): «Sin analizar» (rojo) y
 * «Sin prueba en 12 meses» (amarillo).
 * @param {{ criticidad: string, estado_revision: string }} p
 * @param {Date|null} ultimaPrueba
 * @param {Date} [ahora]
 * @returns {{ nivel: string, texto: string, detalle: string }[]}
 */
const alertas = (p, ultimaPrueba, ahora = new Date()) => {
  if (!esCriticoOAlto(p)) return [];
  const lista = [];
  if (p.estado_revision === 'PENDIENTE_ANALISIS') {
    lista.push({ nivel: 'rojo', texto: 'Sin analizar', detalle: `Proceso de criticidad ${CRITICIDADES[p.criticidad].toLowerCase()} pendiente de análisis` });
  }
  if (!ultimaPrueba || new Date(ultimaPrueba) < inicioVentanaPruebas(ahora)) {
    lista.push({ nivel: 'amarillo', texto: 'Sin prueba en 12 meses', detalle: 'No consta ninguna prueba de continuidad en los últimos 12 meses' });
  }
  return lista;
};

// Resumen para el Dashboard: procesos críticos/altos sin plan definido y sin prueba reciente
/**
 * @param {Date} [ahora]
 * @returns {Promise<{ sinPlan: number, sinPrueba: number }>} Procesos altos/críticos sin plan
 *   definido y sin prueba en 12 meses
 */
const resumenBia = async (ahora = new Date()) => {
  const altos = { criticidad: { in: CRITICIDADES_ALTAS } };
  const [sinPlan, sinPrueba] = await Promise.all([
    prisma.procesoNegocio.count({ where: { ...altos, estado_revision: { not: 'PLAN_DEFINIDO' } } }),
    prisma.procesoNegocio.count({ where: { ...altos, pruebas: { none: { fecha_prueba: { gte: inicioVentanaPruebas(ahora) } } } } }),
  ]);
  return { sinPlan, sinPrueba };
};

// 72 → "72 h (3 días)", 0.5 → "0,5 h"
/**
 * @param {number|string} valor Horas (RTO o RPO)
 * @returns {string}
 */
const formatoHoras = (valor) => {
  const h = Number(valor);
  const texto = `${h.toLocaleString('es-ES', { maximumFractionDigits: 2 })} h`;
  if (h < 24) return texto;
  const dias = h / 24;
  return `${texto} (${dias.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${dias === 1 ? 'día' : 'días'})`;
};

module.exports = {
  CRITICIDADES,
  ESTADOS_REVISION_BIA,
  TIPOS_PRUEBA,
  RESULTADOS_PRUEBA,
  CRITICIDAD_CLASES,
  ESTADO_REVISION_CLASES,
  RESULTADO_CLASES,
  ALERTA_BIA_CLASES,
  CRITICIDADES_ALTAS,
  inicioVentanaPruebas,
  alertas,
  resumenBia,
  formatoHoras,
};
