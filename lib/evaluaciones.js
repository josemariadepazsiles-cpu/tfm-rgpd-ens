// Lógica de las evaluaciones ENS: guardado de los controles con su histórico, creación de la
// foto de controles de cada evaluación y cálculo del resumen de cumplimiento.
const prisma = require('./prisma');
const { resumenPorCategoria } = require('./ens');

// Guarda los cambios de un control dentro de una evaluación.
// `cambios` puede incluir estado, evidencia y responsable_id (undefined = no se toca).
// Si el estado cambia, actualiza fecha_revision y registra el cambio en el histórico,
// todo en la misma transacción.
/**
 * @param {number} evaluacionId
 * @param {number} controlId
 * @param {{ estado?: string, evidencia?: string|null, responsable_id?: number|null }} cambios
 * @param {number} usuarioId Quién hace el cambio (queda en el histórico)
 * @returns {Promise<{ estadoCambiado: boolean, anterior: string }>}
 */
const guardarControl = (evaluacionId, controlId, cambios, usuarioId) =>
  prisma.$transaction(async (tx) => {
    // NOTA: desde la foto de controles, las filas ya existen (buscarControl en el controlador
    // exige que exista), así que este INSERT no llega a crear nada; se mantiene como protección.
    // Crea la fila si no existe; ON CONFLICT evita el error si otra petición la crea a la vez
    await tx.$executeRaw`
      INSERT INTO "evaluacion_controles" ("evaluacion_id", "control_id")
      VALUES (${evaluacionId}, ${controlId})
      ON CONFLICT ("evaluacion_id", "control_id") DO NOTHING`;

    // Bloquea la fila para que dos cambios simultáneos registren bien el estado anterior
    const [fila] = await tx.$queryRaw`
      SELECT "id", "estado"::text AS "estado" FROM "evaluacion_controles"
      WHERE "evaluacion_id" = ${evaluacionId} AND "control_id" = ${controlId}
      FOR UPDATE`;
    const anterior = fila.estado;

    const data = {};
    if (cambios.evidencia !== undefined) data.evidencia = cambios.evidencia;
    if (cambios.responsable_id !== undefined) data.responsable_id = cambios.responsable_id;

    const estadoCambiado = cambios.estado !== undefined && cambios.estado !== anterior;
    if (estadoCambiado) {
      const ahora = new Date();
      data.estado = cambios.estado;
      data.fecha_revision = ahora;
      await tx.historialEstado.create({
        data: {
          evaluacion_control_id: fila.id,
          estado_anterior: anterior,
          estado_nuevo: cambios.estado,
          usuario_id: usuarioId,
          fecha: ahora,
        },
      });
    }

    if (Object.keys(data).length) {
      await tx.evaluacionControl.update({ where: { id: fila.id }, data });
    }
    return { estadoCambiado, anterior };
  });

// Cada evaluación es una foto de los controles del catálogo: al crearla se le añade una fila
// por control (Pendiente, o con el estado de la evaluación de la que se copia). Si después se
// añade un control al catálogo, solo se incorpora a la evaluación vigente (la última) de cada
// sistema; las evaluaciones anteriores no cambian y su porcentaje queda fijo.

// Crea las filas de una evaluación nueva; `anteriores`: filas de la evaluación que se copia
/**
 * @param {object} tx Cliente de Prisma dentro de una transacción
 * @param {number} evaluacionId
 * @param {object[]} [anteriores] Filas (EvaluacionControl) de la evaluación que se copia
 */
const crearFilasEvaluacion = async (tx, evaluacionId, anteriores = []) => {
  const controles = await tx.controlEns.findMany({ select: { id: true } });
  const previa = new Map(anteriores.map((f) => [f.control_id, f]));
  await tx.evaluacionControl.createMany({
    data: controles.map(({ id }) => {
      const f = previa.get(id);
      return f
        ? { evaluacion_id: evaluacionId, control_id: id, estado: f.estado, evidencia: f.evidencia, responsable_id: f.responsable_id, fecha_revision: f.fecha_revision }
        : { evaluacion_id: evaluacionId, control_id: id };
    }),
  });
};

// Añade un control nuevo del catálogo (Pendiente) a la última evaluación de cada sistema
/**
 * @param {object} tx Cliente de Prisma dentro de una transacción
 * @param {number} controlId Control recién creado
 * @returns {Promise<number>} Número de evaluaciones a las que se ha añadido
 */
const incorporarAEvaluacionesVigentes = async (tx, controlId) => {
  const sistemas = await tx.sistema.findMany({
    select: { evaluaciones: { orderBy: { created_at: 'desc' }, take: 1, select: { id: true } } },
  });
  const ids = sistemas.flatMap((s) => s.evaluaciones.map((e) => e.id));
  if (ids.length) {
    await tx.evaluacionControl.createMany({
      data: ids.map((evaluacion_id) => ({ evaluacion_id, control_id: controlId })),
      skipDuplicates: true,
    });
  }
  return ids.length;
};

// Resumen por categoría de varias evaluaciones: Map(evaluacionId → resumen). Los totales
// salen de los controles de cada evaluación, no del catálogo actual
/**
 * Una sola consulta para todas las evaluaciones pedidas.
 * @param {number[]} evaluacionIds
 * @returns {Promise<Map<number, ReturnType<import('./ens').resumenPorCategoria>>>}
 */
const resumenEvaluaciones = async (evaluacionIds) => {
  const filas = await prisma.evaluacionControl.findMany({
    where: { evaluacion_id: { in: evaluacionIds } },
    select: { evaluacion_id: true, estado: true, control: { select: { categoria: true } } },
  });
  return new Map(
    evaluacionIds.map((id) => {
      const propias = filas.filter((f) => f.evaluacion_id === id).map((f) => ({ categoria: f.control.categoria, estado: f.estado }));
      const totales = {};
      propias.forEach((f) => { totales[f.categoria] = (totales[f.categoria] || 0) + 1; });
      return [id, resumenPorCategoria(totales, propias)];
    })
  );
};

module.exports = { guardarControl, crearFilasEvaluacion, incorporarAEvaluacionesVigentes, resumenEvaluaciones };
