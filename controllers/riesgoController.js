// Evaluación de riesgos RGPD de las actividades del RAT: listado, ficha, alta, edición y baja.
const prisma = require('../lib/prisma');
const { ambitoActividad, ambitoRiesgo, idValido } = require('../lib/permisos');
const { PROBABILIDADES, IMPACTOS, NIVELES, MATRIZ, calcularNivel } = require('../lib/riesgo');
const { listaSistemas, sistemaSelect, leerSistemaId, validarSistema, filtroSistema } = require('../lib/sistemas');
const { LIMITES, excesos } = require('../lib/validacion');

const actividadSelect = { select: { id: true, nombre: true, usuario_id: true } };

/**
 * @param {import('express').Response} res
 */
const noEncontrado = (res) =>
  res.status(404).render('error', {
    title: 'Riesgo no encontrado',
    mensaje: 'El riesgo no existe o no tienes acceso a él.',
  });

// Devuelve el riesgo solo si el usuario puede verlo
/**
 * @param {import('express').Request} req
 * @returns {Promise<object|null>|null}
 */
const buscarVisible = (req) => {
  const id = idValido(req.params.id);
  if (!id) return null;
  return prisma.riesgo.findFirst({
    where: { id, ...ambitoRiesgo(req.user) },
    include: { actividad: actividadSelect, sistema: sistemaSelect },
  });
};

// Actividades que el usuario puede asociar a un riesgo
/**
 * @param {object} user
 * @returns {Promise<object[]>} Actividades a las que el usuario puede asociar riesgos
 */
const actividadesVisibles = (user) =>
  prisma.actividadRat.findMany({
    where: ambitoActividad(user),
    select: { id: true, nombre: true, sistema_id: true },
    orderBy: { nombre: 'asc' },
  });

/**
 * @param {unknown} valor
 * @returns {string} Texto sin espacios a los lados («» si no es texto)
 */
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

/**
 * @param {object} body
 * @returns {object}
 */
const leerFormulario = (body) => ({
  actividad_id: idValido(body.actividad_id) ?? NaN,
  amenaza: texto(body.amenaza),
  probabilidad: body.probabilidad,
  impacto: body.impacto,
  medidas_mitigadoras: texto(body.medidas_mitigadoras) || null,
  sistema_id: leerSistemaId(body.sistema_id),
});

/**
 * La actividad debe ser visible para el usuario: un Usuario no puede colgar riesgos de actividades ajenas.
 * @param {object} datos
 * @param {object} user
 * @returns {Promise<string[]>}
 */
const validar = async (datos, user) => {
  const errores = [...excesos(datos, LIMITES.riesgo)];
  const actividadValida =
    Number.isInteger(datos.actividad_id) &&
    (await prisma.actividadRat.findFirst({
      where: { id: datos.actividad_id, ...ambitoActividad(user) },
    }));
  if (!actividadValida) errores.push('Selecciona una actividad de tratamiento válida.');
  if (!datos.amenaza) errores.push('La amenaza es obligatoria.');
  if (!Object.hasOwn(PROBABILIDADES, datos.probabilidad)) errores.push('La probabilidad no es válida.');
  if (!Object.hasOwn(IMPACTOS, datos.impacto)) errores.push('El impacto no es válido.');
  const errorSistema = await validarSistema(datos.sistema_id);
  if (errorSistema) errores.push(errorSistema);
  return errores;
};

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {{ riesgo: object, errores?: string[], status?: number }} opciones
 */
const renderFormulario = async (req, res, { riesgo, errores = [], status = 200 }) => {
  res.status(status).render('riesgos/form', {
    title: riesgo.id ? 'Editar riesgo' : 'Nuevo riesgo',
    riesgo,
    errores,
    actividades: await actividadesVisibles(req.user),
    sistemas: await listaSistemas(),
    probabilidades: PROBABILIDADES,
    impactos: IMPACTOS,
    niveles: NIVELES,
    matriz: MATRIZ,
  });
};

/**
 * GET /riesgos · con sesión (un Usuario solo los de sus actividades). Filtros ?nivel=, ?sistema=, ?actividad=.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const list = async (req, res) => {
  const filtro = filtroSistema(req.query.sistema);
  // Los contadores por nivel respetan el sistema elegido
  const scope = { ...ambitoRiesgo(req.user), ...filtro.where };
  const nivel = Object.hasOwn(NIVELES, req.query.nivel ?? '') ? req.query.nivel : '';

  const [riesgos, conteos, sistemas] = await Promise.all([
    prisma.riesgo.findMany({
      where: { ...scope, ...(nivel && { nivel_riesgo: nivel }) },
      include: {
        actividad: { select: { id: true, nombre: true, responsable: { select: { nombre: true } } } },
        sistema: sistemaSelect,
      },
      orderBy: [{ nivel_riesgo: 'desc' }, { amenaza: 'asc' }],
    }),
    prisma.riesgo.groupBy({ by: ['nivel_riesgo'], where: scope, _count: true }),
    listaSistemas(),
  ]);

  const totales = Object.fromEntries(Object.keys(NIVELES).map((n) => [n, 0]));
  conteos.forEach((c) => (totales[c.nivel_riesgo] = c._count));

  res.render('riesgos/index', {
    title: 'Riesgos',
    riesgos,
    nivel,
    sistemas,
    sistema: filtro.sistema,
    totales,
    total: Object.values(totales).reduce((a, b) => a + b, 0),
    probabilidades: PROBABILIDADES,
    impactos: IMPACTOS,
    niveles: NIVELES,
  });
};

/**
 * GET /riesgos/:id · con sesión; 404 si no es visible para el usuario.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const show = async (req, res) => {
  const riesgo = await buscarVisible(req);
  if (!riesgo) return noEncontrado(res);
  res.render('riesgos/show', {
    title: riesgo.amenaza,
    riesgo,
    probabilidades: PROBABILIDADES,
    impactos: IMPACTOS,
    niveles: NIVELES,
  });
};

// Admite ?actividad=ID para llegar desde el detalle de una actividad con ella preseleccionada
// (y su sistema como sistema asociado por defecto) o ?sistema=ID desde la ficha de un sistema
/**
 * GET /riesgos/nuevo · con sesión. ?actividad=ID preselecciona la actividad (y su sistema).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const newForm = async (req, res) => {
  const actividadId = idValido(req.query.actividad);
  let sistemaId = leerSistemaId(req.query.sistema) || null;
  if (actividadId && !sistemaId) {
    const actividad = await prisma.actividadRat.findFirst({
      where: { id: actividadId, ...ambitoActividad(req.user) },
      select: { sistema_id: true },
    });
    sistemaId = actividad ? actividad.sistema_id : null;
  }
  return renderFormulario(req, res, { riesgo: { actividad_id: actividadId, sistema_id: sistemaId } });
};

/**
 * POST /riesgos · con sesión. Regla de negocio: nivel = probabilidad × impacto (ver lib/riesgo.js).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const create = async (req, res) => {
  const datos = leerFormulario(req.body);
  const errores = await validar(datos, req.user);
  if (errores.length) {
    return renderFormulario(req, res, { riesgo: datos, errores, status: 400 });
  }

  // El nivel siempre se calcula en el servidor, nunca se toma del formulario
  const riesgo = await prisma.riesgo.create({
    data: { ...datos, nivel_riesgo: calcularNivel(datos.probabilidad, datos.impacto) },
  });
  req.session.flash = { tipo: 'exito', mensaje: 'Riesgo creado correctamente.' };
  res.redirect(`/riesgos/${riesgo.id}`);
};

/**
 * GET /riesgos/:id/editar · con sesión; solo los visibles para el usuario.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const editForm = async (req, res) => {
  const riesgo = await buscarVisible(req);
  if (!riesgo) return noEncontrado(res);
  renderFormulario(req, res, { riesgo });
};

/**
 * POST /riesgos/:id · con sesión. El nivel se recalcula siempre.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const update = async (req, res) => {
  const actual = await buscarVisible(req);
  if (!actual) return noEncontrado(res);

  const datos = leerFormulario(req.body);
  const errores = await validar(datos, req.user);
  if (errores.length) {
    return renderFormulario(req, res, {
      riesgo: { ...datos, id: actual.id },
      errores,
      status: 400,
    });
  }

  await prisma.riesgo.update({
    where: { id: actual.id },
    data: { ...datos, nivel_riesgo: calcularNivel(datos.probabilidad, datos.impacto) },
  });
  req.session.flash = { tipo: 'exito', mensaje: 'Riesgo actualizado correctamente.' };
  res.redirect(`/riesgos/${actual.id}`);
};

// Solo administradores (la ruta usa ensureAdmin)
/**
 * POST /riesgos/:id/eliminar · Administrador.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const remove = async (req, res) => {
  const riesgo = await buscarVisible(req);
  if (!riesgo) return noEncontrado(res);

  await prisma.riesgo.delete({ where: { id: riesgo.id } });
  req.session.flash = { tipo: 'exito', mensaje: `Riesgo "${riesgo.amenaza}" eliminado.` };
  res.redirect('/riesgos');
};

module.exports = { list, show, newForm, create, editForm, update, remove };
