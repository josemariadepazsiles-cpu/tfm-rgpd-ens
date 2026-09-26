const prisma = require('../lib/prisma');
const { esAdmin } = require('../lib/permisos');
const { CATEGORIAS, ESTADOS, resumenPorCategoria } = require('../lib/ens');

// El checklist es compartido por toda la organización: cualquier usuario autenticado
// puede cambiar estado, evidencia y asignarse como responsable; crear, renombrar,
// recategorizar, asignar a otros y eliminar es solo para administradores.

const responsableSelect = { select: { id: true, nombre: true } };

const noEncontrado = (res) =>
  res.status(404).render('error', {
    title: 'Control no encontrado',
    mensaje: 'El control ENS no existe.',
  });

const buscar = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return prisma.controlEns.findUnique({ where: { id }, include: { responsable: responsableSelect } });
};

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const esEstado = (valor) => Object.hasOwn(ESTADOS, valor ?? '');
const esCategoria = (valor) => Object.hasOwn(CATEGORIAS, valor ?? '');

// Vuelve al listado, a la altura del control modificado
const volverAlListado = (res, id) => res.redirect(`/checklist#control-${id}`);

// La fecha de revisión se actualiza solo cuando cambia el estado
const conFechaRevision = (datos, estadoAnterior) =>
  datos.estado && datos.estado !== estadoAnterior ? { ...datos, fecha_revision: new Date() } : datos;

// Lee y valida el formulario según el rol. `actual` es el control existente (null al crear)
const leerFormulario = async (req, actual) => {
  const { body, user } = req;
  const errores = [];
  const datos = {
    estado: body.estado,
    evidencia: texto(body.evidencia) || null,
  };
  if (!esEstado(datos.estado)) errores.push('El estado no es válido.');

  if (esAdmin(user)) {
    datos.nombre = texto(body.nombre);
    datos.categoria = body.categoria;
    datos.responsable_id = body.responsable_id ? Number(body.responsable_id) : null;

    if (!datos.nombre) errores.push('El nombre es obligatorio.');
    if (!esCategoria(datos.categoria)) errores.push('La categoría no es válida.');
    if (datos.responsable_id !== null) {
      const existe =
        Number.isInteger(datos.responsable_id) &&
        (await prisma.usuario.findUnique({ where: { id: datos.responsable_id } }));
      if (!existe) errores.push('El responsable no es válido.');
    }
  } else if (body.asignarme === 'on') {
    datos.responsable_id = user.id;
  } else if (actual.responsable_id === user.id) {
    // Un usuario solo puede liberar la responsabilidad si era suya
    datos.responsable_id = null;
  }

  return { datos, errores };
};

const renderFormulario = async (req, res, { control, errores = [], status = 200 }) => {
  const usuarios = esAdmin(req.user)
    ? await prisma.usuario.findMany({ select: { id: true, nombre: true, area: true }, orderBy: { nombre: 'asc' } })
    : [];
  res.status(status).render('checklist/form', {
    title: control.id ? 'Editar control' : 'Nuevo control',
    control,
    errores,
    usuarios,
    categorias: CATEGORIAS,
    estados: ESTADOS,
  });
};

const list = async (req, res) => {
  const controles = await prisma.controlEns.findMany({
    include: { responsable: responsableSelect },
    orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
  });

  const resumen = resumenPorCategoria(
    controles.map(({ categoria, estado }) => ({ categoria, estado, _count: 1 }))
  );
  const grupos = resumen.map((r) => ({
    ...r,
    controles: controles.filter((c) => c.categoria === r.categoria),
  }));

  res.render('checklist/index', {
    title: 'Checklist ENS',
    grupos,
    categorias: CATEGORIAS,
    estados: ESTADOS,
  });
};

// Cambio de estado directo desde el listado
const cambiarEstado = async (req, res) => {
  const control = await buscar(req);
  if (!control) return noEncontrado(res);

  if (!esEstado(req.body.estado)) {
    req.session.flash = { tipo: 'error', mensaje: 'El estado no es válido.' };
    return volverAlListado(res, control.id);
  }

  if (req.body.estado !== control.estado) {
    await prisma.controlEns.update({
      where: { id: control.id },
      data: conFechaRevision({ estado: req.body.estado }, control.estado),
    });
    req.session.flash = {
      tipo: 'exito',
      mensaje: `"${control.nombre}" marcado como ${ESTADOS[req.body.estado].toLowerCase()}.`,
    };
  }
  volverAlListado(res, control.id);
};

const asignarme = async (req, res) => {
  const control = await buscar(req);
  if (!control) return noEncontrado(res);

  await prisma.controlEns.update({ where: { id: control.id }, data: { responsable_id: req.user.id } });
  req.session.flash = { tipo: 'exito', mensaje: `Ahora eres responsable de "${control.nombre}".` };
  volverAlListado(res, control.id);
};

const newForm = (req, res) =>
  renderFormulario(req, res, { control: { estado: 'PENDIENTE', categoria: req.query.categoria } });

const create = async (req, res) => {
  const { datos, errores } = await leerFormulario(req, null);
  if (errores.length) {
    return renderFormulario(req, res, { control: datos, errores, status: 400 });
  }

  try {
    const control = await prisma.controlEns.create({
      data: datos.estado === 'PENDIENTE' ? datos : { ...datos, fecha_revision: new Date() },
    });
    req.session.flash = { tipo: 'exito', mensaje: `Control "${control.nombre}" creado.` };
    volverAlListado(res, control.id);
  } catch (err) {
    if (err.code !== 'P2002') throw err;
    renderFormulario(req, res, {
      control: datos,
      errores: ['Ya existe un control con ese nombre.'],
      status: 409,
    });
  }
};

const editForm = async (req, res) => {
  const control = await buscar(req);
  if (!control) return noEncontrado(res);
  renderFormulario(req, res, { control });
};

const update = async (req, res) => {
  const actual = await buscar(req);
  if (!actual) return noEncontrado(res);

  const { datos, errores } = await leerFormulario(req, actual);
  if (errores.length) {
    return renderFormulario(req, res, {
      control: { ...actual, ...datos },
      errores,
      status: 400,
    });
  }

  try {
    await prisma.controlEns.update({
      where: { id: actual.id },
      data: conFechaRevision(datos, actual.estado),
    });
    req.session.flash = { tipo: 'exito', mensaje: `Control "${datos.nombre || actual.nombre}" actualizado.` };
    volverAlListado(res, actual.id);
  } catch (err) {
    if (err.code !== 'P2002') throw err;
    renderFormulario(req, res, {
      control: { ...actual, ...datos },
      errores: ['Ya existe un control con ese nombre.'],
      status: 409,
    });
  }
};

// Solo administradores (la ruta usa ensureAdmin)
const remove = async (req, res) => {
  const control = await buscar(req);
  if (!control) return noEncontrado(res);

  await prisma.controlEns.delete({ where: { id: control.id } });
  req.session.flash = { tipo: 'exito', mensaje: `Control "${control.nombre}" eliminado.` };
  res.redirect('/checklist');
};

module.exports = { list, cambiarEstado, asignarme, newForm, create, editForm, update, remove };
