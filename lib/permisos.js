const esAdmin = (user) => user.rol === 'ADMIN';

// Filtro de Prisma sobre ActividadRat: un Usuario solo accede a las actividades de las que es responsable
const ambitoActividad = (user) => (esAdmin(user) ? {} : { usuario_id: user.id });

// Filtro de Prisma sobre Riesgo: un Usuario solo accede a los riesgos de sus actividades
const ambitoRiesgo = (user) => (esAdmin(user) ? {} : { actividad: ambitoActividad(user) });

// Registros con responsable asignado (incidentes, solicitudes de derechos): los gestiona
// el Administrador o el responsable asignado
const esAdminOResponsable = (user, registro) => esAdmin(user) || registro.responsable_id === user.id;

// Mayor valor de una columna INTEGER de PostgreSQL: un id mayor no puede existir y Prisma
// fallaría al consultarlo (error P2020)
const ID_MAXIMO = 2147483647;

// Convierte un parámetro de ruta en id numérico válido, o null
const idValido = (valor) => {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 && id <= ID_MAXIMO ? id : null;
};

// Id de un campo de formulario: vacío → null; no válido → NaN (la validación lo rechaza)
const idDeFormulario = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null;
  return idValido(valor) ?? NaN;
};

module.exports = { esAdmin, ambitoActividad, ambitoRiesgo, esAdminOResponsable, idValido, idDeFormulario, ID_MAXIMO };
