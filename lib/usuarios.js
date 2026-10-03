// Usuarios de la plataforma: sistemas en los que trabajan y a quién afecta cada política.
// Una política General afecta a todos los usuarios activos; una de sistema, solo a los
// usuarios activos asignados a ese sistema.
const prisma = require('./prisma');

// Ids de los sistemas asignados a un usuario
const sistemasDeUsuario = async (usuarioId) =>
  (await prisma.usuarioSistema.findMany({ where: { usuario_id: usuarioId }, select: { sistema_id: true } })).map((s) => s.sistema_id);

// ¿Debe este usuario aceptar la política? `usuario` lleva `activo` y `sistemaIds`
const afectaA = (politica, usuario) =>
  !!usuario && usuario.activo !== false &&
  (politica.sistema_id === null || politica.sistema_id === undefined || (usuario.sistemaIds || []).includes(politica.sistema_id));

// Filtro de Prisma de los usuarios afectados por una política
const whereAfectados = (politica) => ({
  activo: true,
  ...(politica.sistema_id ? { sistemas: { some: { sistema_id: politica.sistema_id } } } : {}),
});

// Filtro de Prisma de las políticas que afectan a un usuario (según sus sistemas)
const wherePoliticasDe = (sistemaIds) => ({ OR: [{ sistema_id: null }, { sistema_id: { in: sistemaIds } }] });

module.exports = { sistemasDeUsuario, afectaA, whereAfectados, wherePoliticasDe };
