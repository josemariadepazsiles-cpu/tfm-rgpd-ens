// Checklist ENS: etiquetas, colores y cálculo del resumen por categoría.
// Tailwind escanea este archivo (ver input.css), por eso las clases van completas.

const CATEGORIAS = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta' };
const ESTADOS = { IMPLEMENTADO: 'Implementado', PENDIENTE: 'Pendiente', NO_APLICA: 'No aplicable' };

// Verde = Baja, ámbar = Media, rojo = Alta (el color solo en el punto, la barra y el badge)
const CATEGORIA_CLASES = {
  BAJA: {
    cabecera: 'bg-white border-slate-100 text-slate-900',
    punto: 'bg-green-500',
    badge: 'bg-green-50 text-green-700 ring-green-600/20',
    barra: 'bg-green-500',
  },
  MEDIA: {
    cabecera: 'bg-white border-slate-100 text-slate-900',
    punto: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    barra: 'bg-amber-500',
  },
  ALTA: {
    cabecera: 'bg-white border-slate-100 text-slate-900',
    punto: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 ring-red-600/20',
    barra: 'bg-red-500',
  },
};

const ESTADO_CLASES = {
  IMPLEMENTADO: 'border-green-300 bg-green-50 text-green-700 ring-green-600/20',
  PENDIENTE: 'border-amber-300 bg-amber-50 text-amber-800 ring-amber-600/20',
  NO_APLICA: 'border-slate-300 bg-slate-50 text-slate-600 ring-slate-500/20',
};

const esEstado = (valor) => Object.hasOwn(ESTADOS, valor ?? '');
const esCategoria = (valor) => Object.hasOwn(CATEGORIAS, valor ?? '');

// Resumen por categoría de una evaluación.
// - totales: { BAJA: n, MEDIA: n, ALTA: n } controles del catálogo
// - filas: [{ categoria, estado }] controles con estado guardado (el resto están Pendientes)
// Los controles "No aplicable" no cuentan en el total.
const resumenPorCategoria = (totales, filas) =>
  Object.keys(CATEGORIAS).map((categoria) => {
    const deCategoria = filas.filter((f) => f.categoria === categoria);
    const implementados = deCategoria.filter((f) => f.estado === 'IMPLEMENTADO').length;
    const noAplica = deCategoria.filter((f) => f.estado === 'NO_APLICA').length;
    const aplicables = (totales[categoria] || 0) - noAplica;
    return {
      categoria,
      implementados,
      aplicables,
      noAplica,
      porcentaje: aplicables ? Math.round((implementados / aplicables) * 100) : 0,
    };
  });

// Suma de todas las categorías de un resumen: % de implementación global de la evaluación
const resumenGlobal = (resumen) => {
  const suma = (campo) => resumen.reduce((a, r) => a + r[campo], 0);
  const implementados = suma('implementados');
  const aplicables = suma('aplicables');
  const noAplica = suma('noAplica');
  return {
    implementados,
    aplicables,
    noAplica,
    total: aplicables + noAplica,
    porcentaje: aplicables ? Math.round((implementados / aplicables) * 100) : 0,
  };
};

module.exports = {
  resumenGlobal,
  CATEGORIAS,
  ESTADOS,
  CATEGORIA_CLASES,
  ESTADO_CLASES,
  esEstado,
  esCategoria,
  resumenPorCategoria,
};
