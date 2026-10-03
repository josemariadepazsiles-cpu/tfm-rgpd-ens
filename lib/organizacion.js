// Datos de la organización (una única fila). Se muestran en la cabecera de todas las pantallas,
// por lo que se guardan en memoria y solo se vuelven a leer cuando se modifican.
const prisma = require('./prisma');

// Campos de la ficha de la empresa y su etiqueta en el formulario
const CAMPOS = {
  nombre: 'Nombre o razón social',
  cif: 'CIF',
  sector: 'Sector de actividad',
  direccion: 'Dirección',
  codigo_postal: 'Código postal',
  localidad: 'Localidad',
  provincia: 'Provincia',
  telefono: 'Teléfono',
  email: 'Email de contacto',
  web: 'Sitio web',
  dpd_nombre: 'Delegado de Protección de Datos (DPD)',
  dpd_email: 'Email del DPD',
  responsable_informacion: 'Responsable de la Información',
  responsable_seguridad: 'Responsable de Seguridad',
  responsable_sistema: 'Responsable del Sistema',
};

// La caché caduca al minuto: así los cambios hechos fuera de la aplicación (seed, restauración
// de una copia) se ven sin reiniciar el servidor
const VIGENCIA_MS = 60 * 1000;
let cache; // undefined = sin leer; null = no hay organización registrada
let leido = 0;

/**
 * @returns {Promise<object|null>} Datos de la organización (de la caché si tiene menos de un minuto)
 */
const obtenerOrganizacion = async () => {
  if (cache === undefined || Date.now() - leido > VIGENCIA_MS) {
    cache = await prisma.organizacion.findFirst({ orderBy: { id: 'asc' } });
    leido = Date.now();
  }
  return cache;
};

// Crea o actualiza la única fila de la organización y renueva la caché
/**
 * @param {object} datos Campos de CAMPOS y categoria_ens
 * @returns {Promise<object>} Organización guardada
 */
const guardarOrganizacion = async (datos) => {
  const actual = await prisma.organizacion.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
  cache = actual
    ? await prisma.organizacion.update({ where: { id: actual.id }, data: datos })
    : await prisma.organizacion.create({ data: datos });
  leido = Date.now();
  return cache;
};

module.exports = { CAMPOS, obtenerOrganizacion, guardarOrganizacion };
