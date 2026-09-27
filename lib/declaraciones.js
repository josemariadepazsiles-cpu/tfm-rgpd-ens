const prisma = require('./prisma');

// Declaraciones de Conformidad ENS: etiquetas, colores, generación y emisión.
// Tailwind escanea este archivo (ver input.css).

// Categoría del sistema con la terminología del ENS (RD 311/2022): Básica, Media, Alta
const CATEGORIAS_SISTEMA = { BAJA: 'Básica', MEDIA: 'Media', ALTA: 'Alta' };

const ESTADOS_DECLARACION = { BORRADOR: 'Borrador', EMITIDA: 'Emitida', SUPERADA: 'Superada por nueva versión' };

const ESTADO_DECLARACION_CLASES = {
  BORRADOR: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  EMITIDA: 'bg-green-50 text-green-700 ring-green-600/20',
  SUPERADA: 'bg-slate-50 text-slate-600 ring-slate-500/20',
};

// Error de negocio con mensaje para el usuario
class ErrorDeclaracion extends Error {}

// Genera una nueva declaración (Borrador) con la foto fija de todos los controles del
// catálogo en la evaluación indicada. La versión es la siguiente del sistema y las
// declaraciones anteriores Emitidas o en Borrador pasan a "Superada por nueva versión".
// El sistema se bloquea para que dos generaciones simultáneas no choquen de versión.
const generarDeclaracion = (evaluacionId, usuario) =>
  prisma.$transaction(
    async (tx) => {
      const evaluacion = await tx.evaluacion.findUnique({ where: { id: evaluacionId } });
      if (!evaluacion) throw new ErrorDeclaracion('La evaluación no existe.');
      await tx.$queryRaw`SELECT "id" FROM "sistemas" WHERE "id" = ${evaluacion.sistema_id} FOR UPDATE`;
      const sistema = await tx.sistema.findUnique({ where: { id: evaluacion.sistema_id } });
      if (!sistema.categoria_general) {
        throw new ErrorDeclaracion(
          'El sistema no tiene definida su categoría ENS. Indícala en "Editar" del sistema antes de generar la declaración.'
        );
      }

      // Consultas secuenciales: en una transacción interactiva comparten la misma conexión
      const controles = await tx.controlEns.findMany({ orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }] });
      const filas = await tx.evaluacionControl.findMany({
        where: { evaluacion_id: evaluacion.id },
        include: { responsable: { select: { nombre: true } } },
      });
      const ultima = await tx.declaracionConformidad.findFirst({
        where: { sistema_id: sistema.id },
        orderBy: { version: 'desc' },
      });
      if (controles.length === 0) throw new ErrorDeclaracion('El catálogo de controles está vacío.');

      const porControl = new Map(filas.map((f) => [f.control_id, f]));
      const detalles = controles.map((c) => {
        const f = porControl.get(c.id);
        return {
          control_nombre: c.nombre,
          control_categoria: c.categoria,
          estado_control: f ? f.estado : 'PENDIENTE',
          responsable: f && f.responsable ? f.responsable.nombre : null,
          evidencia: f ? f.evidencia : null,
          fecha_revision: f ? f.fecha_revision : null,
        };
      });
      const cuenta = (estado) => detalles.filter((d) => d.estado_control === estado).length;
      const implementados = cuenta('IMPLEMENTADO');
      const noAplica = cuenta('NO_APLICA');
      const aplicables = detalles.length - noAplica;

      const superadas = await tx.declaracionConformidad.updateMany({
        where: { sistema_id: sistema.id, estado: { in: ['EMITIDA', 'BORRADOR'] } },
        data: { estado: 'SUPERADA' },
      });

      const declaracion = await tx.declaracionConformidad.create({
        data: {
          sistema_id: sistema.id,
          sistema_nombre: sistema.nombre,
          evaluacion_id: evaluacion.id,
          evaluacion_nombre: evaluacion.nombre,
          categoria_ens: sistema.categoria_general,
          porcentaje_implementacion: aplicables ? Math.round((implementados / aplicables) * 10000) / 100 : 0,
          numero_controles_total: detalles.length,
          numero_controles_implementados: implementados,
          numero_controles_pendientes: cuenta('PENDIENTE'),
          numero_controles_no_aplica: noAplica,
          version: (ultima ? ultima.version : 0) + 1,
          generado_por_id: usuario.id,
          generado_por_nombre: usuario.nombre,
          detalles: { createMany: { data: detalles } },
        },
      });
      return { declaracion, superadas: superadas.count };
    },
    { timeout: 20000 }
  );

// Emite una declaración en Borrador (queda definitiva: ya no se puede modificar)
const emitirDeclaracion = (id, usuario) =>
  prisma.$transaction(async (tx) => {
    const [fila] = await tx.$queryRaw`
      SELECT "estado"::text AS "estado" FROM "declaraciones_conformidad" WHERE "id" = ${id} FOR UPDATE`;
    if (!fila) throw new ErrorDeclaracion('La declaración no existe.');
    if (fila.estado !== 'BORRADOR') throw new ErrorDeclaracion('Solo se puede emitir una declaración en Borrador.');
    return tx.declaracionConformidad.update({
      where: { id },
      data: { estado: 'EMITIDA', fecha_emision: new Date(), emitido_por_id: usuario.id, emitido_por_nombre: usuario.nombre },
    });
  });

// Porcentaje con coma decimal: 66.67 → "66,67 %"
const formatoPorcentaje = (valor) =>
  `${Number(valor).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %`;

module.exports = {
  CATEGORIAS_SISTEMA,
  ESTADOS_DECLARACION,
  ESTADO_DECLARACION_CLASES,
  ErrorDeclaracion,
  generarDeclaracion,
  emitirDeclaracion,
  formatoPorcentaje,
};
