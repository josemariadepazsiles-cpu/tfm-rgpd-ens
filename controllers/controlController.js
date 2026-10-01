const prisma = require('../lib/prisma');
const { idValido } = require('../lib/permisos');
const { CATEGORIAS, esCategoria } = require('../lib/ens');

// Catálogo de controles ENS (solo administradores; las rutas usan ensureAdmin).
// Cada control del catálogo se evalúa en todas las evaluaciones de todos los sistemas.

const noEncontrado = (res) =>
  res.status(404).render('error', { title: 'Control no encontrado', mensaje: 'El control ENS no existe.' });

const buscar = (req) => {
  const id = idValido(req.params.id);
  return id ? prisma.controlEns.findUnique({ where: { id } }) : null;
};

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const MAX_DESCRIPCION = 2000;

// Datos del formulario. La descripción vacía se guarda como null; el escapado HTML lo hace la
// vista (<%= %>), por lo que el texto se guarda tal cual lo escribe el administrador.
const leerFormulario = (body) => ({
  nombre: texto(body.nombre),
  categoria: body.categoria,
  // Los saltos de línea del navegador (\r\n) se guardan como \n
  descripcion: texto(body.descripcion).replace(/\r\n/g, '\n') || null,
});

const renderFormulario = (res, { control, errores = [], status = 200 }) =>
  res.status(status).render('controles/form', {
    title: control.id ? 'Editar control' : 'Nuevo control',
    control,
    errores,
    categorias: CATEGORIAS,
    maxDescripcion: MAX_DESCRIPCION,
  });

const validar = (datos) => {
  const errores = [];
  if (!datos.nombre) errores.push('El nombre es obligatorio.');
  if (!esCategoria(datos.categoria)) errores.push('La categoría no es válida.');
  if (datos.descripcion && datos.descripcion.length > MAX_DESCRIPCION) {
    errores.push(`La descripción no puede superar los ${MAX_DESCRIPCION} caracteres (tiene ${datos.descripcion.length}).`);
  }
  return errores;
};

const guardar = async (res, control, operacion) => {
  const errores = validar(control);
  if (errores.length) {
    renderFormulario(res, { control, errores, status: 400 });
    return null;
  }
  try {
    return await operacion();
  } catch (err) {
    if (err.code !== 'P2002') throw err;
    renderFormulario(res, { control, errores: ['Ya existe un control con ese nombre.'], status: 409 });
    return null;
  }
};

const list = async (req, res) => {
  const controles = await prisma.controlEns.findMany({
    orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    include: { _count: { select: { evaluaciones: true } } },
  });
  res.render('controles/index', {
    title: 'Catálogo de controles ENS',
    grupos: Object.keys(CATEGORIAS).map((categoria) => ({
      categoria,
      controles: controles.filter((c) => c.categoria === categoria),
    })),
    categorias: CATEGORIAS,
  });
};

const newForm = (req, res) => renderFormulario(res, { control: { categoria: req.query.categoria } });

const create = async (req, res) => {
  const datos = leerFormulario(req.body);
  const control = await guardar(res, datos, () => prisma.controlEns.create({ data: datos }));
  if (!control) return;
  req.session.flash = { tipo: 'exito', mensaje: `Control "${control.nombre}" añadido al catálogo.` };
  res.redirect('/controles');
};

const editForm = async (req, res) => {
  const control = await buscar(req);
  if (!control) return noEncontrado(res);
  renderFormulario(res, { control });
};

const update = async (req, res) => {
  const actual = await buscar(req);
  if (!actual) return noEncontrado(res);

  const { nombre, categoria, descripcion } = leerFormulario(req.body);
  const datos = { id: actual.id, nombre, categoria, descripcion };
  const control = await guardar(res, datos, () =>
    prisma.controlEns.update({ where: { id: actual.id }, data: { nombre, categoria, descripcion } })
  );
  if (!control) return;
  req.session.flash = { tipo: 'exito', mensaje: `Control "${control.nombre}" actualizado.` };
  res.redirect('/controles');
};

// Un control ya evaluado no se puede borrar, para no perder el histórico de las evaluaciones
const remove = async (req, res) => {
  const control = await buscar(req);
  if (!control) return noEncontrado(res);

  const usos = await prisma.evaluacionControl.count({ where: { control_id: control.id } });
  if (usos > 0) {
    req.session.flash = {
      tipo: 'error',
      mensaje: `No se puede eliminar "${control.nombre}": ya tiene estado registrado en ${usos} evaluación(es) y se perdería su histórico.`,
    };
    return res.redirect('/controles');
  }

  await prisma.controlEns.delete({ where: { id: control.id } });
  req.session.flash = { tipo: 'exito', mensaje: `Control "${control.nombre}" eliminado del catálogo.` };
  res.redirect('/controles');
};

module.exports = { list, newForm, create, editForm, update, remove };
