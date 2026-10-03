// Usuarios de la plataforma: sistemas en los que trabajan y a quién afecta cada política.
// Una política General afecta a todos los usuarios activos; una de sistema, solo a los
// usuarios activos asignados a ese sistema.
const prisma = require('./prisma');

/**
 * @param {number} usuarioId
 * @returns {Promise<number[]>}
 */
// FALLO DETECTADO (código muerto): sistemasDeUsuario no se usa en ninguna parte (passport.js
// carga los sistemas por su cuenta).
// Ids de los sistemas asignados a un usuario
const sistemasDeUsuario = async (usuarioId) =>
  (await prisma.usuarioSistema.findMany({ where: { usuario_id: usuarioId }, select: { sistema_id: true } })).map((s) => s.sistema_id);

/**
 * @param {{ sistema_id: number|null }} politica
 * @param {{ activo?: boolean, sistemaIds?: number[] }} usuario Normalmente req.user
 * @returns {boolean}
 */
// ¿Debe este usuario aceptar la política? `usuario` lleva `activo` y `sistemaIds`
const afectaA = (politica, usuario) =>
  !!usuario && usuario.activo !== false &&
  (politica.sistema_id === null || politica.sistema_id === undefined || (usuario.sistemaIds || []).includes(politica.sistema_id));

/**
 * @param {{ sistema_id: number|null }} politica
 * @returns {object} Condición where de Prisma sobre Usuario
 */
// Filtro de Prisma de los usuarios afectados por una política
const whereAfectados = (politica) => ({
  activo: true,
  ...(politica.sistema_id ? { sistemas: { some: { sistema_id: politica.sistema_id } } } : {}),
});

/**
 * @param {number[]} sistemaIds
 * @returns {object} Condición where de Prisma sobre Politica
 */
// FALLO DETECTADO (código muerto): wherePoliticasDe no se usa; lib/politicas.js repite el mismo
// filtro escrito a mano en pendientesDeAceptar.
// Filtro de Prisma de las políticas que afectan a un usuario (según sus sistemas)
const wherePoliticasDe = (sistemaIds) => ({ OR: [{ sistema_id: null }, { sistema_id: { in: sistemaIds } }] });

module.exports = { sistemasDeUsuario, afectaA, whereAfectados, wherePoliticasDe };
