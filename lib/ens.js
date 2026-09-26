// Checklist ENS: etiquetas, colores y cálculo del resumen por categoría.
// Tailwind escanea este archivo (ver input.css), por eso las clases van completas.

const CATEGORIAS = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta' };
const ESTADOS = { IMPLEMENTADO: 'Implementado', PENDIENTE: 'Pendiente', NO_APLICA: 'No aplicable' };

// Verde = Baja, ámbar = Media, rojo = Alta
const CATEGORIA_CLASES = {
  BAJA: {
    cabecera: 'bg-green-50 border-green-200 text-green-800',
    badge: 'bg-green-100 text-green-800 ring-green-600/30',
    barra: 'bg-green-500',
  },
  MEDIA: {
    cabecera: 'bg-amber-50 border-amber-200 text-amber-800',
    badge: 'bg-amber-100 text-amber-800 ring-amber-600/30',
    barra: 'bg-amber-500',
  },
  ALTA: {
    cabecera: 'bg-red-50 border-red-200 text-red-800',
    badge: 'bg-red-100 text-red-800 ring-red-600/30',
    barra: 'bg-red-500',
  },
};

const ESTADO_CLASES = {
  IMPLEMENTADO: 'border-green-300 bg-green-50 text-green-800',
  PENDIENTE: 'border-amber-300 bg-amber-50 text-amber-800',
  NO_APLICA: 'border-slate-300 bg-slate-50 text-slate-600',
};

// Resumen por categoría a partir de un groupBy [{ categoria, estado, _count }].
// Los controles "No aplicable" no cuentan en el total.
const resumenPorCategoria = (conteos) =>
  Object.keys(CATEGORIAS).map((categoria) => {
    const deCategoria = conteos.filter((c) => c.categoria === categoria);
    const cuenta = (estado) =>
      deCategoria.filter((c) => c.estado === estado).reduce((a, c) => a + c._count, 0);
    const implementados = cuenta('IMPLEMENTADO');
    const aplicables = implementados + cuenta('PENDIENTE');
    return {
      categoria,
      implementados,
      aplicables,
      noAplica: cuenta('NO_APLICA'),
      porcentaje: aplicables ? Math.round((implementados / aplicables) * 100) : 0,
    };
  });

module.exports = { CATEGORIAS, ESTADOS, CATEGORIA_CLASES, ESTADO_CLASES, resumenPorCategoria };
