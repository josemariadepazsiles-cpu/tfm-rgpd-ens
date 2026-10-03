// Reglas de permisos reutilizables: quién es administrador, qué registros puede ver un Usuario
// y validación de ids recibidos en URLs y formularios.

/**
 * @param {{ rol: string }} user Usuario de la sesión
 * @returns {boolean}
 */
const esAdmin = (user) => user.rol === 'ADMIN';

// Filtro de Prisma sobre ActividadRat: un Usuario solo accede a las actividades de las que es responsable
/**
 * @param {object} user Usuario de la sesión
 * @returns {object} Condición where de Prisma ({} para el Administrador)
 */
const ambitoActividad = (user) => (esAdmin(user) ? {} : { usuario_id: user.id });

// Filtro de Prisma sobre Riesgo: un Usuario solo accede a los riesgos de sus actividades
/**
 * @param {object} user Usuario de la sesión
 * @returns {object} Condición where de Prisma ({} para el Administrador)
 */
const ambitoRiesgo = (user) => (esAdmin(user) ? {} : { actividad: ambitoActividad(user) });

// Registros con responsable asignado (incidentes, solicitudes de derechos): los gestiona
// el Administrador o el responsable asignado
/**
 * @param {object} user Usuario de la sesión
 * @param {{ responsable_id: number|null }} registro
 * @returns {boolean}
 */
const esAdminOResponsable = (user, registro) => esAdmin(user) || registro.responsable_id === user.id;

// Mayor valor de una columna INTEGER de PostgreSQL: un id mayor no puede existir y Prisma
// fallaría al consultarlo (error P2020)
const ID_MAXIMO = 2147483647;

// Convierte un parámetro de ruta en id numérico válido, o null
/**
 * @param {unknown} valor Texto recibido (parámetro de ruta, query o formulario)
 * @returns {number|null} Entero entre 1 y ID_MAXIMO, o null
 */
const idValido = (valor) => {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 && id <= ID_MAXIMO ? id : null;
};

// Id de un campo de formulario: vacío → null; no válido → NaN (la validación lo rechaza)
/**
 * @param {unknown} valor Valor del campo
 * @returns {number|null} Id, null si viene vacío o NaN si no es válido
 */
const idDeFormulario = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null;
  return idValido(valor) ?? NaN;
};

module.exports = { esAdmin, ambitoActividad, ambitoRiesgo, esAdminOResponsable, idValido, idDeFormulario, ID_MAXIMO };
