// Declaraciones de Conformidad ENS: listado, ficha, PDF, generación desde una evaluación,
// observaciones, emisión y eliminación de borradores.
const prisma = require('../lib/prisma');
const { idValido } = require('../lib/permisos');
const { CATEGORIAS, ESTADOS } = require('../lib/ens');
const { cabeceraDisposicion } = require('../lib/subidas');
const { escribirPdf } = require('../lib/pdfDeclaracion');
const {
  CATEGORIAS_SISTEMA, ESTADOS_DECLARACION, ErrorDeclaracion, generarDeclaracion, emitirDeclaracion, formatoPorcentaje,
} = require('../lib/declaraciones');
const { LIMITES, excesos } = require('../lib/validacion');

// Cualquier usuario autenticado puede consultar las declaraciones y descargar su PDF.
// Generarlas, editar las observaciones del borrador y emitirlas es solo para el
// Administrador (las rutas usan ensureAdmin).

const opciones = { CATEGORIAS_SISTEMA, ESTADOS_DECLARACION, formatoPorcentaje };

/**
 * @param {import('express').Response} res
 */
const noEncontrada = (res) =>
  res.status(404).render('error', { title: 'Declaración no encontrada', mensaje: 'La declaración no existe.' });

/**
 * @param {import('express').Request} req
 * @param {object} [include] Relaciones de Prisma a incluir
 * @returns {Promise<object|null>|null}
 */
const buscar = (req, include = {}) => {
  const id = idValido(req.params.id);
  return id ? prisma.declaracionConformidad.findUnique({ where: { id }, include }) : null;
};

const conDetalles = {
  detalles: { orderBy: [{ control_categoria: 'asc' }, { control_nombre: 'asc' }] },
};

/**
 * GET /declaraciones · cualquier usuario con sesión. Filtro ?sistema=ID.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const list = async (req, res) => {
  const sistemas = await prisma.sistema.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });
  const sistemaId = idValido(req.query.sistema);
  const filtro = sistemas.some((s) => s.id === sistemaId) ? sistemaId : null;

  const declaraciones = await prisma.declaracionConformidad.findMany({
    where: filtro ? { sistema_id: filtro } : {},
    orderBy: [{ sistema_nombre: 'asc' }, { version: 'desc' }],
  });

  res.render('declaraciones/index', {
    title: 'Declaraciones de Conformidad',
    declaraciones,
    sistemas,
    filtro,
    ...opciones,
  });
};

/**
 * GET /declaraciones/:id · cualquier usuario con sesión. Muestra la foto guardada, no el estado actual de los controles.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const show = async (req, res) => {
  const declaracion = await buscar(req, conDetalles);
  if (!declaracion) return noEncontrada(res);

  // Agrupa los controles congelados por categoría, igual que el checklist
  const grupos = Object.keys(CATEGORIAS).map((categoria) => {
    const controles = declaracion.detalles.filter((d) => d.control_categoria === categoria);
    return {
      categoria,
      controles,
      implementados: controles.filter((d) => d.estado_control === 'IMPLEMENTADO').length,
      aplicables: controles.filter((d) => d.estado_control !== 'NO_APLICA').length,
    };
  });
  const otrasVersiones = await prisma.declaracionConformidad.findMany({
    where: { sistema_id: declaracion.sistema_id },
    select: { id: true, version: true, estado: true },
    orderBy: { version: 'desc' },
  });

  res.render('declaraciones/show', {
    title: `Declaración v${declaracion.version} · ${declaracion.sistema_nombre}`,
    declaracion,
    grupos,
    otrasVersiones,
    categorias: CATEGORIAS,
    estados: ESTADOS,
    ...opciones,
  });
};

// Solo administradores: genera una declaración en Borrador a partir de una evaluación
/**
 * POST /evaluaciones/:id/declaracion · Administrador.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const generar = async (req, res) => {
  const evaluacionId = idValido(req.params.id);
  if (!evaluacionId) return noEncontrada(res);
  try {
    const { declaracion, superadas } = await generarDeclaracion(evaluacionId, req.user);
    req.session.flash = {
      tipo: 'exito',
      mensaje: `Declaración versión ${declaracion.version} generada en Borrador (${formatoPorcentaje(declaracion.porcentaje_implementacion)} de implementación).` +
        (superadas ? ` ${superadas} declaración(es) anterior(es) pasan a "Superada por nueva versión".` : ''),
    };
    res.redirect(`/declaraciones/${declaracion.id}`);
  } catch (err) {
    if (!(err instanceof ErrorDeclaracion)) throw err;
    req.session.flash = { tipo: 'error', mensaje: err.message };
    res.redirect(`/evaluaciones/${evaluacionId}`);
  }
};

// Solo administradores: observaciones del borrador (una declaración emitida no se modifica)
/**
 * POST /declaraciones/:id · Administrador. Solo en Borrador.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const actualizarObservaciones = async (req, res) => {
  const declaracion = await buscar(req);
  if (!declaracion) return noEncontrada(res);
  if (declaracion.estado !== 'BORRADOR') {
    req.session.flash = { tipo: 'error', mensaje: 'Solo se pueden modificar las observaciones de un borrador.' };
    return res.redirect(`/declaraciones/${declaracion.id}`);
  }
  const observaciones = typeof req.body.observaciones === 'string' ? req.body.observaciones.trim() : '';
  const largas = excesos(req.body, LIMITES.declaracion);
  if (largas.length) {
    req.session.flash = { tipo: 'error', mensaje: largas[0] };
    return res.redirect(`/declaraciones/${declaracion.id}`);
  }
  // updateMany con estado BORRADOR en el where: si otra petición la emite a la vez, no se toca
  const { count } = await prisma.declaracionConformidad.updateMany({
    where: { id: declaracion.id, estado: 'BORRADOR' },
    data: { observaciones: observaciones || null },
  });
  req.session.flash = count
    ? { tipo: 'exito', mensaje: 'Observaciones guardadas.' }
    : { tipo: 'error', mensaje: 'La declaración ya no está en Borrador.' };
  res.redirect(`/declaraciones/${declaracion.id}`);
};

// Solo administradores
/**
 * POST /declaraciones/:id/emitir · Administrador.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const emitir = async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return noEncontrada(res);
  try {
    const declaracion = await emitirDeclaracion(id, req.user);
    req.session.flash = { tipo: 'exito', mensaje: `Declaración versión ${declaracion.version} emitida. Ya no se puede modificar.` };
  } catch (err) {
    if (!(err instanceof ErrorDeclaracion)) throw err;
    req.session.flash = { tipo: 'error', mensaje: err.message };
  }
  res.redirect(`/declaraciones/${id}`);
};

/**
 * GET /declaraciones/:id/pdf · cualquier usuario con sesión. ?ver=1 lo abre en el navegador; sin él, se descarga.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const pdf = async (req, res) => {
  const declaracion = await buscar(req, conDetalles);
  if (!declaracion) return noEncontrada(res);

  const nombre = `Declaracion_Conformidad_ENS_${declaracion.sistema_nombre}_v${declaracion.version}.pdf`
    .replace(/[\\/:*?"<>|\s]+/g, '_');
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': cabeceraDisposicion(req.query.ver ? 'inline' : 'attachment', nombre),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  escribirPdf(declaracion, res);
};

// Solo administradores y solo borradores (las declaraciones emitidas son registros formales).
// Si el borrador era la última versión, la versión anterior que había superado recupera su
// estado (Emitida si tenía fecha de emisión; si no, Borrador).
/**
 * POST /declaraciones/:id/eliminar · Administrador. Solo borradores.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const remove = async (req, res) => {
  const declaracion = await buscar(req);
  if (!declaracion) return noEncontrada(res);
  if (declaracion.estado !== 'BORRADOR') {
    req.session.flash = { tipo: 'error', mensaje: 'Solo se pueden eliminar declaraciones en Borrador.' };
    return res.redirect(`/declaraciones/${declaracion.id}`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.declaracionConformidad.delete({ where: { id: declaracion.id } });
    const posterior = await tx.declaracionConformidad.findFirst({ where: { sistema_id: declaracion.sistema_id, version: { gt: declaracion.version } } });
    if (posterior) return;
    const anterior = await tx.declaracionConformidad.findFirst({
      where: { sistema_id: declaracion.sistema_id, version: { lt: declaracion.version } },
      orderBy: { version: 'desc' },
    });
    if (anterior && anterior.estado === 'SUPERADA') {
      await tx.declaracionConformidad.update({ where: { id: anterior.id }, data: { estado: anterior.fecha_emision ? 'EMITIDA' : 'BORRADOR' } });
    }
  });
  req.session.flash = { tipo: 'exito', mensaje: `Borrador v${declaracion.version} de ${declaracion.sistema_nombre} eliminado.` };
  res.redirect('/declaraciones');
};

module.exports = { list, show, generar, actualizarObservaciones, emitir, pdf, remove };
