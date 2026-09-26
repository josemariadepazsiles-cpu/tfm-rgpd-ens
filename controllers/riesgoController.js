const prisma = require('../lib/prisma');
const { ambitoActividad, ambitoRiesgo } = require('../lib/permisos');
const { PROBABILIDADES, IMPACTOS, NIVELES, MATRIZ, calcularNivel } = require('../lib/riesgo');

const actividadSelect = { select: { id: true, nombre: true, usuario_id: true } };

const noEncontrado = (res) =>
  res.status(404).render('error', {
    title: 'Riesgo no encontrado',
    mensaje: 'El riesgo no existe o no tienes acceso a él.',
  });

// Devuelve el riesgo solo si el usuario puede verlo
const buscarVisible = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return prisma.riesgo.findFirst({
    where: { id, ...ambitoRiesgo(req.user) },
    include: { actividad: actividadSelect },
  });
};

// Actividades que el usuario puede asociar a un riesgo
const actividadesVisibles = (user) =>
  prisma.actividadRat.findMany({
    where: ambitoActividad(user),
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

const leerFormulario = (body) => ({
  actividad_id: Number(body.actividad_id),
  amenaza: texto(body.amenaza),
  probabilidad: body.probabilidad,
  impacto: body.impacto,
  medidas_mitigadoras: texto(body.medidas_mitigadoras) || null,
});

const validar = async (datos, user) => {
  const errores = [];
  const actividadValida =
    Number.isInteger(datos.actividad_id) &&
    (await prisma.actividadRat.findFirst({
      where: { id: datos.actividad_id, ...ambitoActividad(user) },
    }));
  if (!actividadValida) errores.push('Selecciona una actividad de tratamiento válida.');
  if (!datos.amenaza) errores.push('La amenaza es obligatoria.');
  if (!Object.hasOwn(PROBABILIDADES, datos.probabilidad)) errores.push('La probabilidad no es válida.');
  if (!Object.hasOwn(IMPACTOS, datos.impacto)) errores.push('El impacto no es válido.');
  return errores;
};

const renderFormulario = async (req, res, { riesgo, errores = [], status = 200 }) => {
  res.status(status).render('riesgos/form', {
    title: riesgo.id ? 'Editar riesgo' : 'Nuevo riesgo',
    riesgo,
    errores,
    actividades: await actividadesVisibles(req.user),
    probabilidades: PROBABILIDADES,
    impactos: IMPACTOS,
    niveles: NIVELES,
    matriz: MATRIZ,
  });
};

const list = async (req, res) => {
  const scope = ambitoRiesgo(req.user);
  const nivel = Object.hasOwn(NIVELES, req.query.nivel ?? '') ? req.query.nivel : '';

  const [riesgos, conteos] = await Promise.all([
    prisma.riesgo.findMany({
      where: { ...scope, ...(nivel && { nivel_riesgo: nivel }) },
      include: {
        actividad: { select: { id: true, nombre: true, responsable: { select: { nombre: true } } } },
      },
      orderBy: [{ nivel_riesgo: 'desc' }, { amenaza: 'asc' }],
    }),
    prisma.riesgo.groupBy({ by: ['nivel_riesgo'], where: scope, _count: true }),
  ]);

  const totales = Object.fromEntries(Object.keys(NIVELES).map((n) => [n, 0]));
  conteos.forEach((c) => (totales[c.nivel_riesgo] = c._count));

  res.render('riesgos/index', {
    title: 'Riesgos',
    riesgos,
    nivel,
    totales,
    total: Object.values(totales).reduce((a, b) => a + b, 0),
    probabilidades: PROBABILIDADES,
    impactos: IMPACTOS,
    niveles: NIVELES,
  });
};

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
const newForm = (req, res) =>
  renderFormulario(req, res, { riesgo: { actividad_id: Number(req.query.actividad) || null } });

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

const editForm = async (req, res) => {
  const riesgo = await buscarVisible(req);
  if (!riesgo) return noEncontrado(res);
  renderFormulario(req, res, { riesgo });
};

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
const remove = async (req, res) => {
  const riesgo = await buscarVisible(req);
  if (!riesgo) return noEncontrado(res);

  await prisma.riesgo.delete({ where: { id: riesgo.id } });
  req.session.flash = { tipo: 'exito', mensaje: `Riesgo "${riesgo.amenaza}" eliminado.` };
  res.redirect('/riesgos');
};

module.exports = { list, show, newForm, create, editForm, update, remove };
