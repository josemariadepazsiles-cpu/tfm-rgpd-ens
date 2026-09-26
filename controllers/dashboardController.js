const prisma = require('../lib/prisma');
const { CATEGORIAS, resumenGlobal } = require('../lib/ens');
const { resumenEvaluaciones } = require('../lib/evaluaciones');

const index = async (req, res) => {
  // Resumen de cumplimiento ENS de la última evaluación de cada sistema
  const sistemas = await prisma.sistema.findMany({
    orderBy: { nombre: 'asc' },
    include: { evaluaciones: { orderBy: { created_at: 'desc' }, take: 1 } },
  });
  const resumenes = await resumenEvaluaciones(sistemas.flatMap((s) => s.evaluaciones.map((e) => e.id)));

  res.render('dashboard', {
    title: 'Dashboard',
    sistemas: sistemas.map((s) => {
      const resumen = s.evaluaciones[0] ? resumenes.get(s.evaluaciones[0].id) : null;
      return { ...s, ultima: s.evaluaciones[0] || null, resumen, global: resumen ? resumenGlobal(resumen) : null };
    }),
    categorias: CATEGORIAS,
  });
};

module.exports = { index };
