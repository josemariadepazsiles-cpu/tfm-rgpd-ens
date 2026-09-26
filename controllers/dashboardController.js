const prisma = require('../lib/prisma');
const { CATEGORIAS, resumenGlobal } = require('../lib/ens');
const { resumenEvaluaciones } = require('../lib/evaluaciones');
const {
  GRAVEDADES, ESTADOS_INCIDENTE, ESTADOS_ACTIVOS, whereAepdPendiente, plazoAepd,
} = require('../lib/incidentes');

// Resumen de incidentes: activos, notificaciones a la AEPD pendientes / fuera de plazo
// y el incidente activo más grave (a igual gravedad, el detectado hace más tiempo)
const resumenIncidentes = async () => {
  const ahora = new Date();
  const activos = { estado: { in: ESTADOS_ACTIVOS } };
  const [abiertos, aepdPendientes, aepdVencidos, masGrave] = await Promise.all([
    prisma.incidente.count({ where: activos }),
    prisma.incidente.count({ where: whereAepdPendiente(ahora, false) }),
    prisma.incidente.count({ where: whereAepdPendiente(ahora, true) }),
    prisma.incidente.findFirst({
      where: activos,
      orderBy: [{ gravedad: 'desc' }, { fecha_deteccion: 'asc' }],
    }),
  ]);
  return {
    abiertos,
    aepdPendientes,
    aepdVencidos,
    masGrave: masGrave ? { ...masGrave, plazo: plazoAepd(masGrave, ahora) } : null,
  };
};

const index = async (req, res) => {
  // Resumen de cumplimiento ENS de la última evaluación de cada sistema
  const [sistemas, incidentes] = await Promise.all([
    prisma.sistema.findMany({
      orderBy: { nombre: 'asc' },
      include: { evaluaciones: { orderBy: { created_at: 'desc' }, take: 1 } },
    }),
    resumenIncidentes(),
  ]);
  const resumenes = await resumenEvaluaciones(sistemas.flatMap((s) => s.evaluaciones.map((e) => e.id)));

  res.render('dashboard', {
    title: 'Dashboard',
    sistemas: sistemas.map((s) => {
      const resumen = s.evaluaciones[0] ? resumenes.get(s.evaluaciones[0].id) : null;
      return { ...s, ultima: s.evaluaciones[0] || null, resumen, global: resumen ? resumenGlobal(resumen) : null };
    }),
    incidentes,
    categorias: CATEGORIAS,
    GRAVEDADES,
    ESTADOS_INCIDENTE,
  });
};

module.exports = { index };
