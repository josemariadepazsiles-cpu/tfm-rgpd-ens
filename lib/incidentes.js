const prisma = require('./prisma');
const { esAdmin } = require('./permisos');

// Etiquetas y colores de incidentes. Tailwind escanea este archivo (ver input.css).

const TIPOS = {
  CONFIDENCIALIDAD: 'Confidencialidad',
  INTEGRIDAD: 'Integridad',
  DISPONIBILIDAD: 'Disponibilidad',
};

const GRAVEDADES = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta', CRITICA: 'Crítica' };

const ESTADOS_INCIDENTE = {
  ABIERTO: 'Abierto',
  EN_INVESTIGACION: 'En investigación',
  CONTENIDO: 'Contenido',
  NOTIFICADO: 'Notificado',
  CERRADO: 'Cerrado',
};

// Verde = Baja, amarillo = Media, naranja = Alta, rojo = Crítica
const GRAVEDAD_CLASES = {
  BAJA: 'bg-green-100 text-green-800 ring-green-600/30',
  MEDIA: 'bg-yellow-100 text-yellow-800 ring-yellow-600/30',
  ALTA: 'bg-orange-100 text-orange-800 ring-orange-600/30',
  CRITICA: 'bg-red-100 text-red-800 ring-red-600/30',
};

const ESTADO_INCIDENTE_CLASES = {
  ABIERTO: 'bg-sky-100 text-sky-800 ring-sky-600/30',
  EN_INVESTIGACION: 'bg-violet-100 text-violet-800 ring-violet-600/30',
  CONTENIDO: 'bg-amber-100 text-amber-800 ring-amber-600/30',
  NOTIFICADO: 'bg-indigo-100 text-indigo-800 ring-indigo-600/30',
  CERRADO: 'bg-slate-100 text-slate-700 ring-slate-500/30',
};

// Estados en los que el incidente sigue activo
const ESTADOS_ACTIVOS = ['ABIERTO', 'EN_INVESTIGACION', 'CONTENIDO', 'NOTIFICADO'];

// Plazo legal para notificar una brecha a la AEPD (art. 33.1 RGPD)
const PLAZO_AEPD_HORAS = 72;
const PLAZO_AEPD_MS = PLAZO_AEPD_HORAS * 60 * 60 * 1000;

// Situación de la notificación a la AEPD:
//   { tipo: 'no_requiere' } · { tipo: 'notificado', fecha } ·
//   { tipo: 'pendiente', horasRestantes } · { tipo: 'vencido', horasRetraso }
const plazoAepd = (incidente, ahora = new Date()) => {
  if (!incidente.requiere_notificacion_aepd) return { tipo: 'no_requiere' };
  if (incidente.fecha_notificacion_aepd) return { tipo: 'notificado', fecha: incidente.fecha_notificacion_aepd };
  const limite = new Date(incidente.fecha_deteccion).getTime() + PLAZO_AEPD_MS;
  const restante = limite - ahora.getTime();
  return restante > 0
    ? { tipo: 'pendiente', horasRestantes: Math.ceil(restante / 3600000), limite: new Date(limite) }
    : { tipo: 'vencido', horasRetraso: Math.floor(-restante / 3600000), limite: new Date(limite) };
};

// Filtro de Prisma: notificación a la AEPD requerida y aún no hecha (vencida o no)
const whereAepdPendiente = (ahora, soloVencidos) => ({
  requiere_notificacion_aepd: true,
  fecha_notificacion_aepd: null,
  ...(soloVencidos && { fecha_deteccion: { lte: new Date(ahora.getTime() - PLAZO_AEPD_MS) } }),
});

// Editar y cambiar el estado: el Administrador o el responsable asignado
const puedeGestionar = (user, incidente) => esAdmin(user) || incidente.responsable_id === user.id;

// Guarda los cambios de un incidente. Si cambia el estado, registra primero el cambio
// en el historial y después lo aplica, todo en la misma transacción y con la fila
// bloqueada para que dos cambios simultáneos registren bien el estado anterior.
const guardarIncidente = (id, datos, usuarioId) =>
  prisma.$transaction(async (tx) => {
    const [fila] = await tx.$queryRaw`
      SELECT "estado"::text AS "estado" FROM "incidentes" WHERE "id" = ${id} FOR UPDATE`;
    if (!fila) return null;

    const estadoCambiado = datos.estado !== undefined && datos.estado !== fila.estado;
    if (estadoCambiado) {
      await tx.historialIncidente.create({
        data: { incidente_id: id, estado_anterior: fila.estado, estado_nuevo: datos.estado, usuario_id: usuarioId },
      });
    }
    await tx.incidente.update({ where: { id }, data: datos });
    return { estadoCambiado, anterior: fila.estado };
  });

module.exports = {
  TIPOS,
  GRAVEDADES,
  ESTADOS_INCIDENTE,
  GRAVEDAD_CLASES,
  ESTADO_INCIDENTE_CLASES,
  ESTADOS_ACTIVOS,
  PLAZO_AEPD_HORAS,
  plazoAepd,
  whereAepdPendiente,
  puedeGestionar,
  guardarIncidente,
};
