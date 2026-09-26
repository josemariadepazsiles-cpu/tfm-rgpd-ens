const esAdmin = (user) => user.rol === 'ADMIN';

// Filtro de Prisma sobre ActividadRat: un Usuario solo accede a las actividades de las que es responsable
const ambitoActividad = (user) => (esAdmin(user) ? {} : { usuario_id: user.id });

// Filtro de Prisma sobre Riesgo: un Usuario solo accede a los riesgos de sus actividades
const ambitoRiesgo = (user) => (esAdmin(user) ? {} : { actividad: ambitoActividad(user) });

// Registros con responsable asignado (incidentes, solicitudes de derechos): los gestiona
// el Administrador o el responsable asignado
const esAdminOResponsable = (user, registro) => esAdmin(user) || registro.responsable_id === user.id;

// Convierte un parámetro de ruta en id numérico válido, o null
const idValido = (valor) => {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
};

module.exports = { esAdmin, ambitoActividad, ambitoRiesgo, esAdminOResponsable, idValido };
