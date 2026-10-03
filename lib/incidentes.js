// Incidentes y brechas de seguridad: etiquetas, plazo de notificación a la AEPD y guardado
// con historial de estados.
const prisma = require('./prisma');
const { esAdminOResponsable } = require('./permisos');

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
  BAJA: 'bg-green-50 text-green-700 ring-green-600/20',
  MEDIA: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  ALTA: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  CRITICA: 'bg-red-50 text-red-700 ring-red-600/20',
};

const ESTADO_INCIDENTE_CLASES = {
  ABIERTO: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  EN_INVESTIGACION: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  CONTENIDO: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  NOTIFICADO: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  CERRADO: 'bg-slate-50 text-slate-600 ring-slate-500/20',
};

// Estados en los que el incidente sigue activo
const ESTADOS_ACTIVOS = ['ABIERTO', 'EN_INVESTIGACION', 'CONTENIDO', 'NOTIFICADO'];

// Plazo legal para notificar una brecha a la AEPD (art. 33.1 RGPD)
const PLAZO_AEPD_HORAS = 72;
const PLAZO_AEPD_MS = PLAZO_AEPD_HORAS * 60 * 60 * 1000;

// Situación de la notificación a la AEPD:
//   { tipo: 'no_requiere' } · { tipo: 'notificado', fecha } ·
//   { tipo: 'pendiente', horasRestantes } · { tipo: 'vencido', horasRetraso }
// Regla de negocio: el plazo de 72 h cuenta desde la detección (cuando se «tiene constancia»
// de la brecha). Las horas restantes se redondean hacia arriba y las de retraso hacia abajo, para
// no dar nunca por cumplido un plazo que no lo está.
/**
 * @param {{ requiere_notificacion_aepd: boolean, fecha_notificacion_aepd: Date|null, fecha_deteccion: Date }} incidente
 * @param {Date} [ahora]
 * @returns {{ tipo: string, fecha?: Date, horasRestantes?: number, horasRetraso?: number, limite?: Date }}
 */
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
/**
 * @param {Date} ahora
 * @param {boolean} soloVencidos true: solo los que ya superan las 72 h
 * @returns {object} Condición where de Prisma sobre Incidente
 */
const whereAepdPendiente = (ahora, soloVencidos) => ({
  requiere_notificacion_aepd: true,
  fecha_notificacion_aepd: null,
  ...(soloVencidos && { fecha_deteccion: { lte: new Date(ahora.getTime() - PLAZO_AEPD_MS) } }),
});

// Editar y cambiar el estado: el Administrador o el responsable asignado
const puedeGestionar = esAdminOResponsable;

// Guarda los cambios de un incidente. Si cambia el estado, registra primero el cambio
// en el historial y después lo aplica, todo en la misma transacción y con la fila
// bloqueada para que dos cambios simultáneos registren bien el estado anterior.
/**
 * @param {number} id
 * @param {object} datos Campos que se actualizan (pueden incluir estado)
 * @param {number} usuarioId Quién hace el cambio
 * @returns {Promise<{ estadoCambiado: boolean, anterior: string }|null>} null si no existe
 */
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
