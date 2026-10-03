// Solicitudes de derechos de los interesados (acceso, rectificación, supresión…): etiquetas,
// cálculo del plazo de respuesta, urgencia y guardado con historial.
const prisma = require('./prisma');
const { fecha, finPlazoMeses, diasNaturalesEntre } = require('./formato');

// Derechos de los interesados: etiquetas, colores, plazos y guardado con historial.
// Tailwind escanea este archivo (ver input.css).

const TIPOS_DERECHO = {
  ACCESO: 'Acceso',
  RECTIFICACION: 'Rectificación',
  SUPRESION: 'Supresión',
  OPOSICION: 'Oposición',
  LIMITACION: 'Limitación',
  PORTABILIDAD: 'Portabilidad',
};

const ARTICULOS_DERECHO = {
  ACCESO: 'art. 15', RECTIFICACION: 'art. 16', SUPRESION: 'art. 17',
  OPOSICION: 'art. 21', LIMITACION: 'art. 18', PORTABILIDAD: 'art. 20',
};

const CANALES = {
  EMAIL: 'Email',
  FORMULARIO_WEB: 'Formulario web',
  CORREO_POSTAL: 'Correo postal',
  PRESENCIAL: 'Presencial',
  OTRO: 'Otro',
};

// Tipos de documentos que se pueden adjuntar a una solicitud
const TIPOS_DOCUMENTO_SOLICITUD = {
  IDENTIFICACION: 'Acreditación de identidad',
  ESCRITO_SOLICITUD: 'Escrito de solicitud',
  RESPUESTA: 'Respuesta enviada',
  JUSTIFICANTE_ENVIO: 'Justificante de envío o entrega',
  OTRO: 'Otro',
};

const ESTADOS_SOLICITUD = {
  RECIBIDA: 'Recibida',
  VERIFICACION_IDENTIDAD: 'En verificación de identidad',
  EN_TRAMITACION: 'En tramitación',
  AMPLIADA: 'Ampliada',
  ESTIMADA: 'Resuelta - Estimada',
  DENEGADA: 'Resuelta - Denegada',
};

const ESTADO_SOLICITUD_CLASES = {
  RECIBIDA: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  VERIFICACION_IDENTIDAD: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  EN_TRAMITACION: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  AMPLIADA: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  ESTIMADA: 'bg-green-50 text-green-700 ring-green-600/20',
  DENEGADA: 'bg-slate-100 text-slate-700 ring-slate-500/20',
};

const ESTADOS_RESUELTOS = ['ESTIMADA', 'DENEGADA'];
const ESTADOS_ABIERTOS = Object.keys(ESTADOS_SOLICITUD).filter((e) => !ESTADOS_RESUELTOS.includes(e));
/**
 * @param {string} estado
 * @returns {boolean} true si la solicitud está Estimada o Denegada
 */
const estaResuelta = (estado) => ESTADOS_RESUELTOS.includes(estado);

// Plazo general de 1 mes desde la recepción, ampliable 2 meses más (art. 12.3 RGPD)
const MESES_PLAZO = 1;
const MESES_AMPLIACION = 2;
// Con 10 días o menos para el vencimiento, la solicitud pasa a amarillo
const DIAS_AVISO = 10;

/**
 * Regla de negocio: 1 mes desde la recepción, o 3 meses si se ha ampliado (art. 12.3 RGPD).
 * @param {Date} fechaRecepcion
 * @param {boolean} ampliado
 * @returns {Date|null}
 */
const calcularFechaLimite = (fechaRecepcion, ampliado) =>
  finPlazoMeses(fechaRecepcion, MESES_PLAZO + (ampliado ? MESES_AMPLIACION : 0));

// Urgencia respecto a la fecha límite, en días naturales (calendario de España):
//   abierta → 'verde' (quedan más de 10 días), 'amarillo' (10 días o menos, incluido
//   el último día), 'rojo' (vencida sin resolver)
//   resuelta → 'en_plazo' o 'fuera_plazo' según la fecha de respuesta
/**
 * @param {{ estado: string, fecha_limite: Date, fecha_respuesta?: Date|null }} solicitud
 * @param {Date} [ahora]
 * @returns {{ nivel: string, dias?: number, diasVencida?: number }}
 */
const urgencia = (solicitud, ahora = new Date()) => {
  const limite = new Date(solicitud.fecha_limite);
  if (estaResuelta(solicitud.estado)) {
    const respuesta = solicitud.fecha_respuesta ? new Date(solicitud.fecha_respuesta) : null;
    return { nivel: respuesta && respuesta > limite ? 'fuera_plazo' : 'en_plazo' };
  }
  if (ahora > limite) return { nivel: 'rojo', diasVencida: Math.max(1, diasNaturalesEntre(limite, ahora)) };
  const dias = diasNaturalesEntre(ahora, limite);
  return { nivel: dias <= DIAS_AVISO ? 'amarillo' : 'verde', dias };
};

const URGENCIA_CLASES = {
  verde: 'bg-green-50 text-green-700 ring-green-600/20',
  amarillo: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  rojo: 'bg-red-50 text-red-700 ring-red-600/40 font-semibold',
  en_plazo: 'bg-slate-50 text-slate-600 ring-slate-500/20',
  fuera_plazo: 'bg-red-50 text-red-700 ring-red-600/20',
};

// Guarda los cambios de una solicitud. Si cambia el estado o el plazo se amplía (o se
// anula la ampliación), primero lo registra en el historial y después lo aplica, en la
// misma transacción y con la fila bloqueada.
/**
 * @param {number} id
 * @param {object} datos Campos que se actualizan (pueden incluir estado, plazo_ampliado, fecha_limite)
 * @param {number} usuarioId Quién hace el cambio
 * @returns {Promise<{ estadoCambiado: boolean, cambioPlazo: boolean, anterior: string }|null>}
 */
const guardarSolicitud = (id, datos, usuarioId) =>
  prisma.$transaction(async (tx) => {
    const [fila] = await tx.$queryRaw`
      SELECT "estado"::text AS "estado", "plazo_ampliado", "fecha_limite"
      FROM "solicitudes_derechos" WHERE "id" = ${id} FOR UPDATE`;
    if (!fila) return null;

    const estadoNuevo = datos.estado ?? fila.estado;
    const cambioPlazo =
      datos.plazo_ampliado !== undefined && datos.plazo_ampliado !== fila.plazo_ampliado;
    const estadoCambiado = estadoNuevo !== fila.estado;

    if (estadoCambiado || cambioPlazo) {
      let detalle = null;
      if (cambioPlazo) {
        detalle = datos.plazo_ampliado
          ? `Plazo ampliado ${MESES_AMPLIACION} meses (art. 12.3): fecha límite ${fecha(fila.fecha_limite)} → ${fecha(datos.fecha_limite)}`
          : `Ampliación de plazo anulada: fecha límite ${fecha(fila.fecha_limite)} → ${fecha(datos.fecha_limite)}`;
      }
      await tx.historialSolicitudDerecho.create({
        data: {
          solicitud_id: id,
          estado_anterior: fila.estado,
          estado_nuevo: estadoNuevo,
          detalle,
          usuario_id: usuarioId,
        },
      });
    }
    await tx.solicitudDerecho.update({ where: { id }, data: datos });
    return { estadoCambiado, cambioPlazo, anterior: fila.estado };
  });

module.exports = {
  TIPOS_DOCUMENTO_SOLICITUD,
  TIPOS_DERECHO,
  ARTICULOS_DERECHO,
  CANALES,
  ESTADOS_SOLICITUD,
  ESTADO_SOLICITUD_CLASES,
  URGENCIA_CLASES,
  ESTADOS_ABIERTOS,
  ESTADOS_RESUELTOS,
  DIAS_AVISO,
  MESES_AMPLIACION,
  estaResuelta,
  calcularFechaLimite,
  urgencia,
  guardarSolicitud,
};
