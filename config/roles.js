// Roles de usuario de la aplicación. ADMIN gestiona la estructura de todos los módulos;
// USUARIO trabaja sobre lo que tiene asignado.

// Valores del enum Rol de Prisma y su etiqueta para mostrar en las vistas
const ROLES = {
  ADMIN: 'Administrador',
  USUARIO: 'Usuario',
};

module.exports = { ROLES };
