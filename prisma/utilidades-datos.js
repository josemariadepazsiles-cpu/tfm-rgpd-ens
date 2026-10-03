// Utilidades para copias de seguridad, restauración y carga de datos de ejemplo.
// Solo tocan DATOS: nunca el esquema ni las migraciones.
const prisma = require('../lib/prisma');

// Modelos en orden de dependencia (primero los que no dependen de otros), con su tabla real.
// Restaurar en este orden respeta las claves foráneas; vaciar se hace con TRUNCATE ... CASCADE.
const MODELOS = [
  ['organizacion', 'organizacion'],
  ['usuario', 'usuarios'],
  ['sistema', 'sistemas'],
  ['usuarioSistema', 'usuarios_sistemas'],
  ['controlEns', 'controles_ens'],
  ['actividadRat', 'actividades_rat'],
  ['riesgo', 'riesgos'],
  ['evaluacion', 'evaluaciones'],
  ['evaluacionControl', 'evaluacion_controles'],
  ['historialEstado', 'historial_estados'],
  ['incidente', 'incidentes'],
  ['historialIncidente', 'historial_incidentes'],
  ['solicitudDerecho', 'solicitudes_derechos'],
  ['historialSolicitudDerecho', 'historial_solicitudes_derechos'],
  ['documentoSolicitudDerecho', 'documentos_solicitudes_derechos'],
  ['proveedor', 'proveedores'],
  ['documentoProveedor', 'documentos_proveedores'],
  ['declaracionConformidad', 'declaraciones_conformidad'],
  ['detalleDeclaracionControl', 'detalles_declaracion_control'],
  ['politica', 'politicas'],
  ['archivoPolitica', 'archivos_politicas'],
  ['aceptacionPolitica', 'aceptaciones_politicas'],
  ['documentoPolitica', 'documentos_politicas'],
  ['procesoNegocio', 'procesos_negocio'],
  ['pruebaContinuidad', 'pruebas_continuidad'],
];

const listaTablas = () => MODELOS.map(([, tabla]) => `"${tabla}"`).join(', ');

// Borra todos los datos de la aplicación y reinicia los contadores de id. Las claves foráneas
// se respetan porque todas las tablas se vacían en una única sentencia (CASCADE).
const vaciarDatos = () => prisma.$executeRawUnsafe(`TRUNCATE TABLE ${listaTablas()} RESTART IDENTITY CASCADE`);

// Coloca cada secuencia de id justo después del mayor id existente (tras insertar ids explícitos)
const ajustarSecuencias = async () => {
  for (const [, tabla] of MODELOS) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${tabla}"', 'id'), COALESCE((SELECT MAX("id") FROM "${tabla}"), 0) + 1, false)`
    );
  }
};

const contarTodo = async () => {
  const filas = {};
  for (const [modelo, tabla] of MODELOS) filas[tabla] = await prisma[modelo].count();
  return filas;
};

module.exports = { prisma, MODELOS, vaciarDatos, ajustarSecuencias, contarTodo };
