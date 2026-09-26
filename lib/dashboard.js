const prisma = require('./prisma');
const { esAdmin } = require('./permisos');
const { resumenEvaluaciones } = require('./evaluaciones');
const { resumenGlobal } = require('./ens');
const { PLAZO_AEPD_HORAS } = require('./incidentes');
const { urgencia } = require('./derechos');
const { pendientesDeRevision, pendientesDeAceptar } = require('./politicas');

// Métricas del panel de control. Cada módulo se resuelve con una única consulta agregada
// (count(*) FILTER (WHERE ...)) y todas se lanzan en paralelo. Los listados de "pendientes
// urgentes" son consultas pequeñas (LIMIT 3). Los valores de enum van como literales SQL.

const int = (v) => Number(v || 0);
const ahoraMenos = (ms) => new Date(Date.now() - ms);
const haceMeses = (meses) => {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  return d;
};
const LIMITE_URGENTES = 3;

// RAT y riesgos respetan la visibilidad del módulo: un Usuario solo cuenta lo suyo
const rgpdActividades = async (user) => {
  const todos = esAdmin(user);
  const [fila] = await prisma.$queryRaw`
    SELECT
      (SELECT count(*) FROM "actividades_rat" a WHERE ${todos} OR a."usuario_id" = ${user.id}) AS actividades,
      count(*) FILTER (WHERE r."nivel_riesgo" = 'ALTO') AS riesgos_altos,
      count(*) AS riesgos
    FROM "riesgos" r JOIN "actividades_rat" a ON a."id" = r."actividad_id"
    WHERE ${todos} OR a."usuario_id" = ${user.id}`;
  return { actividades: int(fila.actividades), riesgosAltos: int(fila.riesgos_altos), riesgos: int(fila.riesgos) };
};

const incidentes = async () => {
  const limite72h = ahoraMenos(PLAZO_AEPD_HORAS * 3600 * 1000);
  const hace12 = haceMeses(12);
  const [[fila], urgentes] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        count(*) FILTER (WHERE "estado" <> 'CERRADO') AS activos,
        count(*) FILTER (WHERE "requiere_notificacion_aepd" AND "fecha_notificacion_aepd" IS NULL) AS aepd_pendientes,
        count(*) FILTER (WHERE "requiere_notificacion_aepd" AND "fecha_notificacion_aepd" IS NULL
                           AND "fecha_deteccion" <= ${limite72h}) AS aepd_vencidos,
        count(*) FILTER (WHERE "fecha_deteccion" >= ${hace12} AND "estado" <> 'CERRADO') AS abiertos_12m,
        count(*) FILTER (WHERE "fecha_deteccion" >= ${hace12} AND "estado" = 'CERRADO') AS cerrados_12m
      FROM "incidentes"`,
    prisma.incidente.findMany({
      where: { requiere_notificacion_aepd: true, fecha_notificacion_aepd: null, fecha_deteccion: { lte: limite72h } },
      select: { id: true, titulo: true, gravedad: true, fecha_deteccion: true },
      orderBy: { fecha_deteccion: 'asc' },
      take: LIMITE_URGENTES,
    }),
  ]);
  return {
    activos: int(fila.activos),
    aepdPendientes: int(fila.aepd_pendientes),
    aepdVencidos: int(fila.aepd_vencidos),
    abiertos12m: int(fila.abiertos_12m),
    cerrados12m: int(fila.cerrados_12m),
    urgentes,
  };
};

const derechos = async () => {
  const ahora = new Date();
  const [[fila], urgentes, proxima] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        count(*) FILTER (WHERE "estado" NOT IN ('ESTIMADA', 'DENEGADA')) AS abiertas,
        count(*) FILTER (WHERE "estado" NOT IN ('ESTIMADA', 'DENEGADA') AND "fecha_limite" < ${ahora}) AS vencidas
      FROM "solicitudes_derechos"`,
    prisma.solicitudDerecho.findMany({
      where: { estado: { notIn: ['ESTIMADA', 'DENEGADA'] }, fecha_limite: { lt: ahora } },
      select: { id: true, nombre_solicitante: true, tipo_derecho: true, fecha_limite: true, estado: true },
      orderBy: { fecha_limite: 'asc' },
      take: LIMITE_URGENTES,
    }),
    prisma.solicitudDerecho.findFirst({
      where: { estado: { notIn: ['ESTIMADA', 'DENEGADA'] }, fecha_limite: { gte: ahora } },
      select: { id: true, nombre_solicitante: true, tipo_derecho: true, fecha_limite: true, estado: true },
      orderBy: { fecha_limite: 'asc' },
    }),
  ]);
  return {
    abiertas: int(fila.abiertas),
    vencidas: int(fila.vencidas),
    urgentes: urgentes.map((s) => ({ ...s, urgencia: urgencia(s, ahora) })),
    proxima: proxima ? { ...proxima, urgencia: urgencia(proxima, ahora) } : null,
  };
};

const proveedores = async () => {
  const [fila] = await prisma.$queryRaw`
    SELECT
      count(*) FILTER (WHERE "estado" = 'ACTIVO') AS activos,
      count(*) FILTER (WHERE "estado" <> 'BAJA' AND NOT "tiene_contrato_encargado") AS sin_contrato,
      count(*) FILTER (WHERE "estado" <> 'BAJA' AND "fuera_ue" AND "mecanismo_transferencia" = 'NO_APLICA') AS sin_garantias
    FROM "proveedores"`;
  return { activos: int(fila.activos), sinContrato: int(fila.sin_contrato), sinGarantias: int(fila.sin_garantias) };
};

// Cumplimiento ENS: última evaluación de cada sistema y agregado global
const ensSistemas = async () => {
  const sistemas = await prisma.sistema.findMany({
    orderBy: { nombre: 'asc' },
    select: {
      id: true, nombre: true, categoria_general: true,
      evaluaciones: { orderBy: { created_at: 'desc' }, take: 1, select: { id: true, nombre: true } },
    },
  });
  const resumenes = await resumenEvaluaciones(sistemas.flatMap((s) => s.evaluaciones.map((e) => e.id)));
  const lista = sistemas.map((s) => {
    const ultima = s.evaluaciones[0] || null;
    return { ...s, ultima, global: ultima ? resumenGlobal(resumenes.get(ultima.id)) : null };
  });
  const evaluados = lista.filter((s) => s.global);
  const implementados = evaluados.reduce((a, s) => a + s.global.implementados, 0);
  const aplicables = evaluados.reduce((a, s) => a + s.global.aplicables, 0);
  return {
    sistemas: lista,
    global: {
      implementados,
      aplicables,
      porcentaje: aplicables ? Math.round((implementados / aplicables) * 100) : 0,
      evaluados: evaluados.length,
    },
  };
};

// Sistemas sin declaración emitida vigente o con la vigente emitida hace más de 12 meses
const declaraciones = async () => {
  const hace12 = haceMeses(12);
  const filas = await prisma.$queryRaw`
    SELECT s."id", s."nombre",
           max(d."fecha_emision") FILTER (WHERE d."estado" = 'EMITIDA') AS emitida
    FROM "sistemas" s
    LEFT JOIN "declaraciones_conformidad" d ON d."sistema_id" = s."id"
    GROUP BY s."id", s."nombre"
    ORDER BY s."nombre"`;
  const sinDeclaracion = filas.filter((f) => !f.emitida);
  const caducadas = filas.filter((f) => f.emitida && f.emitida < hace12);
  return {
    totalSistemas: filas.length,
    alDia: filas.length - sinDeclaracion.length - caducadas.length,
    sinDeclaracion: sinDeclaracion.map((f) => ({ id: f.id, nombre: f.nombre })),
    caducadas: caducadas.map((f) => ({ id: f.id, nombre: f.nombre, emitida: f.emitida })),
  };
};

// Un Usuario solo ve las políticas aprobadas: la revisión se cuenta sobre las que puede ver
const politicas = async (user) => {
  const [revision, misPendientes] = await Promise.all([pendientesDeRevision(), pendientesDeAceptar(user.id)]);
  const visibles = esAdmin(user) ? revision : revision.filter((p) => p.estado === 'APROBADA');
  return {
    revisionVencidas: visibles.filter((p) => p.alerta.nivel === 'vencida').length,
    revisionProximas: visibles.filter((p) => p.alerta.nivel === 'proxima').length,
    misPendientes,
  };
};

const bia = async () => {
  const hace12 = haceMeses(12);
  const [[fila], urgentes] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        count(*) AS altos,
        count(*) FILTER (WHERE p."estado_revision" <> 'PLAN_DEFINIDO') AS sin_plan,
        count(*) FILTER (WHERE NOT EXISTS (
          SELECT 1 FROM "pruebas_continuidad" t WHERE t."proceso_id" = p."id" AND t."fecha_prueba" >= ${hace12})) AS sin_prueba
      FROM "procesos_negocio" p
      WHERE p."criticidad" IN ('ALTA', 'CRITICA')`,
    prisma.procesoNegocio.findMany({
      where: { criticidad: { in: ['ALTA', 'CRITICA'] }, estado_revision: 'PENDIENTE_ANALISIS' },
      select: { id: true, nombre: true, criticidad: true },
      orderBy: [{ criticidad: 'desc' }, { nombre: 'asc' }],
      take: LIMITE_URGENTES,
    }),
  ]);
  return { altos: int(fila.altos), sinPlan: int(fila.sin_plan), sinPrueba: int(fila.sin_prueba), urgentes };
};

const obtenerMetricas = async (user) => {
  const [actividades, inc, der, prov, ens, decl, pol, b] = await Promise.all([
    rgpdActividades(user), incidentes(), derechos(), proveedores(), ensSistemas(), declaraciones(), politicas(user), bia(),
  ]);
  return {
    actividades, incidentes: inc, derechos: der, proveedores: prov, ens, declaraciones: decl, politicas: pol, bia: b,
  };
};

module.exports = { obtenerMetricas };
