const prisma = require('../lib/prisma');
const { BASES_LEGALES } = require('../config/baseLegal');
const { NIVELES } = require('../lib/riesgo');
const { esAdmin, ambitoActividad: ambito } = require('../lib/permisos');
const { listaSistemas, sistemaSelect, leerSistemaId, validarSistema, filtroSistema } = require('../lib/sistemas');

const responsableSelect = { select: { id: true, nombre: true, email: true, cargo: true } };

const noEncontrada = (res) =>
  res.status(404).render('error', {
    title: 'Actividad no encontrada',
    mensaje: 'La actividad no existe o no tienes acceso a ella.',
  });

// Devuelve la actividad solo si el usuario puede verla
const buscarVisible = (req, include = {}) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return prisma.actividadRat.findFirst({
    where: { id, ...ambito(req.user) },
    include: { responsable: responsableSelect, sistema: sistemaSelect, ...include },
  });
};

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

const leerFormulario = (body) => {
  const transferencia_intl = body.transferencia_intl === 'on';
  return {
    nombre: texto(body.nombre),
    finalidad: texto(body.finalidad),
    base_legal: body.base_legal,
    categorias_datos: texto(body.categorias_datos),
    categorias_interesados: texto(body.categorias_interesados),
    destinatarios: texto(body.destinatarios),
    transferencia_intl,
    pais_transferencia: transferencia_intl ? texto(body.pais_transferencia) || null : null,
    plazo_conservacion: texto(body.plazo_conservacion),
    medidas_seguridad: texto(body.medidas_seguridad),
    usuario_id: Number(body.usuario_id),
    sistema_id: leerSistemaId(body.sistema_id),
  };
};

const OBLIGATORIOS = {
  nombre: 'El nombre es obligatorio.',
  finalidad: 'La finalidad es obligatoria.',
  categorias_datos: 'Las categorías de datos son obligatorias.',
  categorias_interesados: 'Las categorías de interesados son obligatorias.',
  destinatarios: 'Los destinatarios son obligatorios.',
  plazo_conservacion: 'El plazo de conservación es obligatorio.',
  medidas_seguridad: 'Las medidas de seguridad son obligatorias.',
};

const validar = async (datos, user) => {
  const errores = Object.entries(OBLIGATORIOS)
    .filter(([campo]) => !datos[campo])
    .map(([, mensaje]) => mensaje);

  if (!Object.keys(BASES_LEGALES).includes(datos.base_legal)) {
    errores.push('La base legal no es válida.');
  }
  if (datos.transferencia_intl && !datos.pais_transferencia) {
    errores.push('Indica el país de destino de la transferencia internacional.');
  }
  const errorSistema = await validarSistema(datos.sistema_id);
  if (errorSistema) errores.push(errorSistema);
  if (esAdmin(user)) {
    const existe =
      Number.isInteger(datos.usuario_id) &&
      (await prisma.usuario.findUnique({ where: { id: datos.usuario_id } }));
    if (!existe) errores.push('El responsable no es válido.');
  }
  return errores;
};

const renderFormulario = async (req, res, { actividad, errores = [], status = 200 }) => {
  const sistemas = await listaSistemas();
  const responsables = esAdmin(req.user)
    ? await prisma.usuario.findMany({
        select: { id: true, nombre: true, cargo: true },
        orderBy: { nombre: 'asc' },
      })
    : [];
  res.status(status).render('rat/form', {
    title: actividad.id ? 'Editar actividad' : 'Nueva actividad',
    actividad,
    errores,
    responsables,
    sistemas,
    basesLegales: BASES_LEGALES,
  });
};

const list = async (req, res) => {
  const filtro = filtroSistema(req.query.sistema);
  const where = { ...ambito(req.user), ...filtro.where };
  const [actividades, sistemas] = await Promise.all([prisma.actividadRat.findMany({
    where,
    include: { responsable: responsableSelect, sistema: sistemaSelect },
    orderBy: { nombre: 'asc' },
  }), listaSistemas()]);

  res.render('rat/index', {
    title: 'Actividades RAT',
    actividades,
    sistemas,
    sistema: filtro.sistema,
    basesLegales: BASES_LEGALES,
  });
};

const show = async (req, res) => {
  const actividad = await buscarVisible(req, {
    riesgos: { orderBy: [{ nivel_riesgo: 'desc' }, { amenaza: 'asc' }] },
  });
  if (!actividad) return noEncontrada(res);
  res.render('rat/show', {
    title: actividad.nombre,
    actividad,
    basesLegales: BASES_LEGALES,
    niveles: NIVELES,
  });
};

const newForm = (req, res) =>
  renderFormulario(req, res, {
    // Admite ?sistema=ID para llegar desde la ficha de un sistema con él preseleccionado
    actividad: { transferencia_intl: false, usuario_id: req.user.id, sistema_id: leerSistemaId(req.query.sistema) || null },
  });

const create = async (req, res) => {
  const datos = leerFormulario(req.body);
  if (!esAdmin(req.user)) datos.usuario_id = req.user.id;

  const errores = await validar(datos, req.user);
  if (errores.length) {
    return renderFormulario(req, res, { actividad: datos, errores, status: 400 });
  }

  const actividad = await prisma.actividadRat.create({ data: datos });
  req.session.flash = { tipo: 'exito', mensaje: 'Actividad creada correctamente.' };
  res.redirect(`/rat/${actividad.id}`);
};

const editForm = async (req, res) => {
  const actividad = await buscarVisible(req);
  if (!actividad) return noEncontrada(res);
  renderFormulario(req, res, { actividad });
};

const update = async (req, res) => {
  const actual = await buscarVisible(req);
  if (!actual) return noEncontrada(res);

  const datos = leerFormulario(req.body);
  // Un Usuario no puede reasignar la actividad a otro responsable
  if (!esAdmin(req.user)) datos.usuario_id = actual.usuario_id;

  const errores = await validar(datos, req.user);
  if (errores.length) {
    return renderFormulario(req, res, {
      actividad: { ...datos, id: actual.id },
      errores,
      status: 400,
    });
  }

  await prisma.actividadRat.update({ where: { id: actual.id }, data: datos });
  req.session.flash = { tipo: 'exito', mensaje: 'Actividad actualizada correctamente.' };
  res.redirect(`/rat/${actual.id}`);
};

// Solo administradores (la ruta usa ensureAdmin)
const remove = async (req, res) => {
  const actividad = await buscarVisible(req);
  if (!actividad) return noEncontrada(res);

  await prisma.actividadRat.delete({ where: { id: actividad.id } });
  req.session.flash = { tipo: 'exito', mensaje: `Actividad "${actividad.nombre}" eliminada.` };
  res.redirect('/rat');
};

module.exports = { list, show, newForm, create, editForm, update, remove };
