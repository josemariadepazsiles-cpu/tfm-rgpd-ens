const prisma = require('./prisma');
const { resumenPorCategoria } = require('./ens');

// Guarda los cambios de un control dentro de una evaluación.
// `cambios` puede incluir estado, evidencia y responsable_id (undefined = no se toca).
// Si el estado cambia, actualiza fecha_revision y registra el cambio en el histórico,
// todo en la misma transacción.
const guardarControl = (evaluacionId, controlId, cambios, usuarioId) =>
  prisma.$transaction(async (tx) => {
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

// Totales del catálogo por categoría: { BAJA: n, MEDIA: n, ALTA: n }
const totalesCatalogo = async () => {
  const conteos = await prisma.controlEns.groupBy({ by: ['categoria'], _count: true });
  return Object.fromEntries(conteos.map((c) => [c.categoria, c._count]));
};

// Resumen por categoría de varias evaluaciones: Map(evaluacionId → resumen)
const resumenEvaluaciones = async (evaluacionIds) => {
  const [totales, filas] = await Promise.all([
    totalesCatalogo(),
    prisma.evaluacionControl.findMany({
      where: { evaluacion_id: { in: evaluacionIds } },
      select: { evaluacion_id: true, estado: true, control: { select: { categoria: true } } },
    }),
  ]);
  return new Map(
    evaluacionIds.map((id) => [
      id,
      resumenPorCategoria(
        totales,
        filas
          .filter((f) => f.evaluacion_id === id)
          .map((f) => ({ categoria: f.control.categoria, estado: f.estado }))
      ),
    ])
  );
};

module.exports = { guardarControl, totalesCatalogo, resumenEvaluaciones };
