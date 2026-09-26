const prisma = require('../lib/prisma');
const { CATEGORIAS, resumenGlobal } = require('../lib/ens');
const { resumenEvaluaciones } = require('../lib/evaluaciones');
const {
  GRAVEDADES, ESTADOS_INCIDENTE, ESTADOS_ACTIVOS, whereAepdPendiente, plazoAepd,
} = require('../lib/incidentes');
const { TIPOS_DERECHO, ESTADOS_SOLICITUD, ESTADOS_ABIERTOS, urgencia } = require('../lib/derechos');
const { pendientesDeRevision, pendientesDeAceptar, TIPOS_POLITICA } = require('../lib/politicas');
const { resumenBia } = require('../lib/bia');

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

// Resumen de solicitudes de derechos: abiertas, vencidas sin resolver y la próxima en vencer
const resumenDerechos = async () => {
  const ahora = new Date();
  const abiertas = { estado: { in: ESTADOS_ABIERTOS } };
  const [total, vencidas, proxima] = await Promise.all([
    prisma.solicitudDerecho.count({ where: abiertas }),
    prisma.solicitudDerecho.count({ where: { ...abiertas, fecha_limite: { lt: ahora } } }),
    prisma.solicitudDerecho.findFirst({
      where: { ...abiertas, fecha_limite: { gte: ahora } },
      orderBy: { fecha_limite: 'asc' },
    }),
  ]);
  return { abiertas: total, vencidas, proxima: proxima ? { ...proxima, urgencia: urgencia(proxima, ahora) } : null };
};

// Resumen de proveedores (sin contar los dados de baja): activos, sin contrato de encargado
// y con transferencia internacional sin mecanismo señalado
const resumenProveedores = async () => {
  const vigentes = { estado: { not: 'BAJA' } };
  const [activos, sinContrato, sinMecanismo] = await Promise.all([
    prisma.proveedor.count({ where: { estado: 'ACTIVO' } }),
    prisma.proveedor.count({ where: { ...vigentes, tiene_contrato_encargado: false } }),
    prisma.proveedor.count({ where: { ...vigentes, fuera_ue: true, mecanismo_transferencia: 'NO_APLICA' } }),
  ]);
  return { activos, sinContrato, sinMecanismo };
};

const index = async (req, res) => {
  // Resumen de cumplimiento ENS de la última evaluación de cada sistema
  const [sistemas, incidentes, derechos, proveedores, politicasRevision, misPendientes, bia] = await Promise.all([
    prisma.sistema.findMany({
      orderBy: { nombre: 'asc' },
      include: { evaluaciones: { orderBy: { created_at: 'desc' }, take: 1 } },
    }),
    resumenIncidentes(),
    resumenDerechos(),
    resumenProveedores(),
    pendientesDeRevision(),
    pendientesDeAceptar(req.user.id),
    resumenBia(),
  ]);
  const resumenes = await resumenEvaluaciones(sistemas.flatMap((s) => s.evaluaciones.map((e) => e.id)));

  res.render('dashboard', {
    title: 'Dashboard',
    sistemas: sistemas.map((s) => {
      const resumen = s.evaluaciones[0] ? resumenes.get(s.evaluaciones[0].id) : null;
      return { ...s, ultima: s.evaluaciones[0] || null, resumen, global: resumen ? resumenGlobal(resumen) : null };
    }),
    incidentes,
    derechos,
    proveedores,
    politicas: {
      revisionVencidas: politicasRevision.filter((p) => p.alerta.nivel === 'vencida').length,
      revisionProximas: politicasRevision.filter((p) => p.alerta.nivel === 'proxima').length,
      misPendientes,
    },
    TIPOS_POLITICA,
    bia,
    categorias: CATEGORIAS,
    GRAVEDADES,
    ESTADOS_INCIDENTE,
    TIPOS_DERECHO,
    ESTADOS_SOLICITUD,
  });
};

module.exports = { index };
