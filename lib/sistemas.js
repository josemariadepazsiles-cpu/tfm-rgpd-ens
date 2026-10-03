// El sistema de información como eje de RGPD y ENS: la información de cumplimiento
// (actividades RAT, riesgos, incidentes, solicitudes de derechos…) puede asociarse a un
// sistema. La asociación es opcional: sin sistema, el registro es transversal a la organización.
const prisma = require('./prisma');
const { ambitoActividad, ambitoRiesgo, idValido, idDeFormulario } = require('./permisos');
const { ESTADOS_ACTIVOS } = require('./incidentes');
const { estaResuelta } = require('./derechos');

// Valor del filtro de listados para los registros sin sistema
const SIN_SISTEMA = 'ninguno';

// Sistemas para desplegables de formularios y filtros
/** @returns {Promise<{ id: number, nombre: string, tipo_sistema: string|null }[]>} */
const listaSistemas = () =>
  prisma.sistema.findMany({ select: { id: true, nombre: true, tipo_sistema: true }, orderBy: { nombre: 'asc' } });

const sistemaSelect = { select: { id: true, nombre: true } };

// Campo «Sistema asociado» de un formulario: '' (ninguno / transversal) → null
const leerSistemaId = idDeFormulario;

// Devuelve el mensaje de error si el sistema indicado no existe
/**
 * @param {number|null} sistemaId Resultado de leerSistemaId (null = sin sistema; NaN = no válido)
 * @returns {Promise<string|null>} Mensaje de error, o null si es correcto
 */
const validarSistema = async (sistemaId) => {
  if (sistemaId === null) return null;
  const existe = Number.isInteger(sistemaId) && (await prisma.sistema.findUnique({ where: { id: sistemaId }, select: { id: true } }));
  return existe ? null : 'El sistema asociado no es válido.';
};

// Filtro «?sistema=» de los listados: '' todos · 'ninguno' transversales · id un sistema concreto.
// Devuelve el valor normalizado (para repintar el desplegable) y el where de Prisma.
/**
 * @param {unknown} valor Parámetro ?sistema= de la URL
 * @returns {{ sistema: string, where: object }}
 */
const filtroSistema = (valor) => {
  if (valor === SIN_SISTEMA) return { sistema: SIN_SISTEMA, where: { sistema_id: null } };
  const id = idValido(valor);
  if (id) return { sistema: String(id), where: { sistema_id: id } };
  return { sistema: '', where: {} };
};

// Resumen RGPD de cada sistema (y de lo transversal, clave SIN_SISTEMA): actividades, riesgos
// (por nivel), incidentes activos y solicitudes de derechos abiertas. Actividades y riesgos
// respetan la visibilidad del módulo (un Usuario solo cuenta los suyos).
const RESUMEN_VACIO = () => ({
  actividades: 0, riesgos: 0, riesgosAltos: 0, riesgosMedios: 0, riesgosBajos: 0,
  incidentes: 0, incidentesActivos: 0, solicitudes: 0, solicitudesAbiertas: 0,
});
/**
 * Hace cuatro consultas agrupadas en paralelo (en lugar de una por sistema).
 * @param {object} user Usuario de la sesión
 * @returns {Promise<{ de: (sistemaId: number|null) => object }>} Función que da el resumen de un
 *   sistema (null = transversal)
 */
const resumenRgpdPorSistema = async (user) => {
  const [actividades, riesgos, incidentes, solicitudes] = await Promise.all([
    prisma.actividadRat.groupBy({ by: ['sistema_id'], where: ambitoActividad(user), _count: { _all: true } }),
    prisma.riesgo.groupBy({ by: ['sistema_id', 'nivel_riesgo'], where: ambitoRiesgo(user), _count: { _all: true } }),
    prisma.incidente.groupBy({ by: ['sistema_id', 'estado'], _count: { _all: true } }),
    prisma.solicitudDerecho.groupBy({ by: ['sistema_id', 'estado'], _count: { _all: true } }),
  ]);
  const mapa = new Map();
  const de = (sistemaId) => {
    const clave = sistemaId ?? SIN_SISTEMA;
    if (!mapa.has(clave)) mapa.set(clave, RESUMEN_VACIO());
    return mapa.get(clave);
  };
  const NIVEL = { ALTO: 'riesgosAltos', MEDIO: 'riesgosMedios', BAJO: 'riesgosBajos' };
  actividades.forEach((f) => { de(f.sistema_id).actividades += f._count._all; });
  riesgos.forEach((f) => {
    const r = de(f.sistema_id);
    r.riesgos += f._count._all;
    r[NIVEL[f.nivel_riesgo]] += f._count._all;
  });
  incidentes.forEach((f) => {
    const r = de(f.sistema_id);
    r.incidentes += f._count._all;
    if (ESTADOS_ACTIVOS.includes(f.estado)) r.incidentesActivos += f._count._all;
  });
  solicitudes.forEach((f) => {
    const r = de(f.sistema_id);
    r.solicitudes += f._count._all;
    if (!estaResuelta(f.estado)) r.solicitudesAbiertas += f._count._all;
  });
  return { de: (sistemaId) => mapa.get(sistemaId ?? SIN_SISTEMA) || RESUMEN_VACIO() };
};

// Listados que admiten el filtro «?sistema=»
const LISTADOS_CON_SISTEMA = ['/rat', '/riesgos', '/incidentes', '/derechos', '/declaraciones', '/bia'];

// Añade «sistema=ID» a un enlace a uno de esos listados (p. ej. desde el panel filtrado por sistema)
/**
 * @param {string} href Enlace original
 * @param {number|null} sistemaId Sistema elegido en el panel
 * @returns {string} El enlace con ?sistema=ID si es un listado que admite el filtro
 */
const enlaceConSistema = (href, sistemaId) => {
  if (!sistemaId || typeof href !== 'string') return href;
  const [ruta, query = ''] = href.split('?');
  if (!LISTADOS_CON_SISTEMA.includes(ruta)) return href;
  const params = new URLSearchParams(query);
  params.set('sistema', String(sistemaId));
  return `${ruta}?${params}`;
};

module.exports = {
  SIN_SISTEMA, listaSistemas, sistemaSelect, leerSistemaId, validarSistema, filtroSistema, resumenRgpdPorSistema,
  enlaceConSistema,
};
