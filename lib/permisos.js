const esAdmin = (user) => user.rol === 'ADMIN';

// Filtro de Prisma sobre ActividadRat: un Usuario solo accede a las actividades de las que es responsable
const ambitoActividad = (user) => (esAdmin(user) ? {} : { usuario_id: user.id });

// Filtro de Prisma sobre Riesgo: un Usuario solo accede a los riesgos de sus actividades
const ambitoRiesgo = (user) => (esAdmin(user) ? {} : { actividad: ambitoActividad(user) });

module.exports = { esAdmin, ambitoActividad, ambitoRiesgo };
