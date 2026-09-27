const prisma = require('./prisma');
const { diasNaturalesEntre } = require('./formato');

// Políticas y documentación normativa: etiquetas, colores, alertas y versiones.
// Tailwind escanea este archivo (ver input.css).

const TIPOS_POLITICA = {
  POLITICA: 'Política',
  PROCEDIMIENTO: 'Procedimiento',
  INSTRUCCION_TECNICA: 'Instrucción técnica',
  NORMATIVA_INTERNA: 'Normativa interna',
  OTRO: 'Otro',
};

const ESTADOS_POLITICA = {
  BORRADOR: 'Borrador',
  PENDIENTE_APROBACION: 'Pendiente de aprobación',
  APROBADA: 'Aprobada',
  OBSOLETA: 'Obsoleta',
};

const ESTADO_POLITICA_CLASES = {
  BORRADOR: 'bg-slate-50 text-slate-600 ring-slate-500/20',
  PENDIENTE_APROBACION: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  APROBADA: 'bg-green-50 text-green-700 ring-green-600/20',
  OBSOLETA: 'bg-slate-200 text-slate-500 ring-slate-400/30 line-through',
};

const REVISION_CLASES = {
  vencida: 'bg-red-50 text-red-700 ring-red-600/40 font-semibold',
  proxima: 'bg-amber-50 text-amber-800 ring-amber-600/25',
};

const DIAS_AVISO_REVISION = 30;
// Número de versión: dígitos, letras, puntos y guiones (p. ej. "1.0", "2.1", "2026-01")
const VERSION_REGEX = /^[0-9A-Za-z][0-9A-Za-z.\-]{0,19}$/;

// Alerta de revisión periódica (el ENS exige revisar la documentación de seguridad)
const alertaRevision = (politica, ahora = new Date()) => {
  if (!politica.fecha_proxima_revision || politica.estado === 'OBSOLETA') return null;
  const dias = diasNaturalesEntre(ahora, politica.fecha_proxima_revision);
  if (dias < 0) return { nivel: 'vencida', texto: `Revisión vencida hace ${-dias} día(s)` };
  if (dias <= DIAS_AVISO_REVISION) return { nivel: 'proxima', texto: dias === 0 ? 'Revisión hoy' : `Revisión en ${dias} días` };
  return null;
};

// Políticas con la revisión vencida o en los próximos 30 días (misma regla que las alertas)
const pendientesDeRevision = async (ahora = new Date()) => {
  const politicas = await prisma.politica.findMany({
    where: { estado: { not: 'OBSOLETA' }, fecha_proxima_revision: { not: null } },
    select: { id: true, titulo: true, estado: true, fecha_proxima_revision: true },
    orderBy: { fecha_proxima_revision: 'asc' },
  });
  return politicas
    .map((p) => ({ ...p, alerta: alertaRevision(p, ahora) }))
    .filter((p) => p.alerta);
};

// Políticas aprobadas que requieren aceptación y el usuario aún no ha aceptado en su versión vigente
const pendientesDeAceptar = async (usuarioId) => {
  const politicas = await prisma.politica.findMany({
    where: { estado: 'APROBADA', requiere_aceptacion: true },
    select: { id: true, titulo: true, version: true, tipo_documento: true, aceptaciones: { where: { usuario_id: usuarioId }, select: { version_aceptada: true } } },
    orderBy: { titulo: 'asc' },
  });
  return politicas.filter((p) => !p.aceptaciones.some((a) => a.version_aceptada === p.version));
};

// Registra un nuevo PDF como versión vigente: la anterior pasa a histórica y la política
// adopta la nueva versión, pendiente de aprobación (o aprobada si así se indica).
// La política se bloquea para que dos subidas simultáneas no se pisen.
const registrarVersion = (politicaId, archivo, usuarioId, aprobar) =>
  prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "politicas" WHERE "id" = ${politicaId} FOR UPDATE`;
    await tx.archivoPolitica.updateMany({ where: { politica_id: politicaId, historico: false }, data: { historico: true } });
    const nuevo = await tx.archivoPolitica.create({ data: { ...archivo, politica_id: politicaId, subido_por_id: usuarioId } });
    await tx.politica.update({
      where: { id: politicaId },
      data: {
        version: archivo.version,
        ...(aprobar
          ? { estado: 'APROBADA', fecha_aprobacion: new Date(), aprobado_por_id: usuarioId }
          : { estado: 'PENDIENTE_APROBACION', fecha_aprobacion: null, aprobado_por_id: null }),
      },
    });
    return nuevo;
  });

module.exports = {
  TIPOS_POLITICA,
  ESTADOS_POLITICA,
  ESTADO_POLITICA_CLASES,
  REVISION_CLASES,
  DIAS_AVISO_REVISION,
  VERSION_REGEX,
  alertaRevision,
  pendientesDeRevision,
  pendientesDeAceptar,
  registrarVersion,
};
