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
  BAJA: 'bg-green-100 text-green-800 ring-green-600/30',
  MEDIA: 'bg-yellow-100 text-yellow-800 ring-yellow-600/30',
  ALTA: 'bg-orange-100 text-orange-800 ring-orange-600/30',
  CRITICA: 'bg-red-100 text-red-800 ring-red-600/30',
};

const ESTADO_REVISION_CLASES = {
  PENDIENTE_ANALISIS: 'bg-slate-100 text-slate-700 ring-slate-500/30',
  ANALIZADO: 'bg-sky-100 text-sky-800 ring-sky-600/30',
  REQUIERE_PLAN: 'bg-amber-100 text-amber-800 ring-amber-600/30',
  PLAN_DEFINIDO: 'bg-green-100 text-green-800 ring-green-600/30',
};

const RESULTADO_CLASES = {
  SATISFACTORIO: 'bg-green-100 text-green-800 ring-green-600/30',
  CON_INCIDENCIAS: 'bg-amber-100 text-amber-800 ring-amber-600/30',
  FALLIDO: 'bg-red-100 text-red-800 ring-red-600/30',
};

const ALERTA_BIA_CLASES = {
  rojo: 'bg-red-600 text-white ring-red-700',
  amarillo: 'bg-yellow-100 text-yellow-800 ring-yellow-600/40',
};

// Procesos de criticidad Alta o Crítica, a los que se aplican las alertas
const CRITICIDADES_ALTAS = ['ALTA', 'CRITICA'];
const esCriticoOAlto = (p) => CRITICIDADES_ALTAS.includes(p.criticidad);
const MESES_PRUEBA = 12;

// Instante de hace 12 meses (mismo día y hora del año anterior)
const inicioVentanaPruebas = (ahora = new Date()) => {
  const d = new Date(ahora);
  d.setMonth(d.getMonth() - MESES_PRUEBA);
  return d;
};

// `ultimaPrueba`: fecha de la prueba más reciente (o null)
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
const resumenBia = async (ahora = new Date()) => {
  const altos = { criticidad: { in: CRITICIDADES_ALTAS } };
  const [sinPlan, sinPrueba] = await Promise.all([
    prisma.procesoNegocio.count({ where: { ...altos, estado_revision: { not: 'PLAN_DEFINIDO' } } }),
    prisma.procesoNegocio.count({ where: { ...altos, pruebas: { none: { fecha_prueba: { gte: inicioVentanaPruebas(ahora) } } } } }),
  ]);
  return { sinPlan, sinPrueba };
};

// 72 → "72 h (3 días)", 0.5 → "0,5 h"
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
