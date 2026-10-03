// Catálogo de controles ENS: alta, edición y baja de los controles que se evalúan en los sistemas.
const prisma = require('../lib/prisma');
const { idValido } = require('../lib/permisos');
const { CATEGORIAS, esCategoria } = require('../lib/ens');
const { incorporarAEvaluacionesVigentes } = require('../lib/evaluaciones');
const { LIMITES, excesos } = require('../lib/validacion');

// Catálogo de controles ENS (solo administradores; las rutas usan ensureAdmin).
// Cada evaluación guarda la foto de los controles que existían al crearla; un control nuevo
// se incorpora solo a la evaluación vigente (la última) de cada sistema.

/**
 * @param {import('express').Response} res
 */
const noEncontrado = (res) =>
  res.status(404).render('error', { title: 'Control no encontrado', mensaje: 'El control ENS no existe.' });

/**
 * @param {import('express').Request} req
 * @returns {Promise<object|null>|null} Control de :id, o null
 */
const buscar = (req) => {
  const id = idValido(req.params.id);
  return id ? prisma.controlEns.findUnique({ where: { id } }) : null;
};

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const MAX_DESCRIPCION = 2000;

// Datos del formulario. La descripción vacía se guarda como null; el escapado HTML lo hace la
// vista (<%= %>), por lo que el texto se guarda tal cual lo escribe el administrador.
/**
 * @param {object} body
 * @returns {{ nombre: string, categoria: string, descripcion: string|null }}
 */
const leerFormulario = (body) => ({
  nombre: texto(body.nombre),
  categoria: body.categoria,
  // Los saltos de línea del navegador (\r\n) se guardan como \n
  descripcion: texto(body.descripcion).replace(/\r\n/g, '\n') || null,
});

/**
 * @param {import('express').Response} res
 * @param {{ control: object, errores?: string[], status?: number }} opciones
 */
const renderFormulario = (res, { control, errores = [], status = 200 }) =>
  res.status(status).render('controles/form', {
    title: control.id ? 'Editar control' : 'Nuevo control',
    control,
    errores,
    categorias: CATEGORIAS,
    maxDescripcion: MAX_DESCRIPCION,
  });

/**
 * @param {object} datos
 * @returns {string[]}
 */
const validar = (datos) => {
  const errores = [...excesos(datos, LIMITES.control)];
  if (!datos.nombre) errores.push('El nombre es obligatorio.');
  if (!esCategoria(datos.categoria)) errores.push('La categoría no es válida.');
  if (datos.descripcion && datos.descripcion.length > MAX_DESCRIPCION) {
    errores.push(`La descripción no puede superar los ${MAX_DESCRIPCION} caracteres (tiene ${datos.descripcion.length}).`);
  }
  return errores;
};

/**
 * Valida y ejecuta la operación; si el nombre ya existe (P2002) vuelve al formulario con 409.
 * @param {import('express').Response} res
 * @param {object} control Datos del formulario
 * @param {() => Promise<object>} operacion
 * @returns {Promise<object|null>} El control guardado, o null si ya se ha respondido con el formulario
 */
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

/**
 * GET /controles · Administrador. Catálogo agrupado por categoría.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
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

/**
 * GET /controles/nuevo · Administrador. Admite ?categoria= para preseleccionarla.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const newForm = (req, res) => renderFormulario(res, { control: { categoria: req.query.categoria } });

/**
 * POST /controles · Administrador. Crea el control y lo añade, Pendiente, a la evaluación vigente de cada sistema.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const create = async (req, res) => {
  const datos = leerFormulario(req.body);
  let vigentes = 0;
  const control = await guardar(res, datos, () =>
    prisma.$transaction(async (tx) => {
      const nuevo = await tx.controlEns.create({ data: datos });
      vigentes = await incorporarAEvaluacionesVigentes(tx, nuevo.id);
      return nuevo;
    })
  );
  if (!control) return;
  req.session.flash = {
    tipo: 'exito',
    mensaje: `Control "${control.nombre}" añadido al catálogo${vigentes ? ` y, como Pendiente, a la evaluación vigente de ${vigentes} sistema(s)` : ''}. Las evaluaciones anteriores no cambian.`,
  };
  res.redirect('/controles');
};

/**
 * GET /controles/:id/editar · Administrador.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const editForm = async (req, res) => {
  const control = await buscar(req);
  if (!control) return noEncontrado(res);
  renderFormulario(res, { control });
};

/**
 * POST /controles/:id · Administrador. Cambiar nombre o categoría afecta también a las evaluaciones pasadas (no guardan copia del nombre); las declaraciones sí la guardan.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
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
/**
 * POST /controles/:id/eliminar · Administrador. Solo si nadie lo ha trabajado en ninguna evaluación.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const remove = async (req, res) => {
  const control = await buscar(req);
  if (!control) return noEncontrado(res);

  // Se puede quitar mientras nadie lo haya trabajado: filas Pendientes, sin evidencia, sin
  // responsable y sin histórico (p. ej. recién añadido por error)
  const usos = await prisma.evaluacionControl.count({
    where: {
      control_id: control.id,
      OR: [{ estado: { not: 'PENDIENTE' } }, { evidencia: { not: null } }, { responsable_id: { not: null } }, { historial: { some: {} } }],
    },
  });
  if (usos > 0) {
    req.session.flash = {
      tipo: 'error',
      mensaje: `No se puede eliminar "${control.nombre}": ya tiene estado registrado en ${usos} evaluación(es) y se perdería su histórico.`,
    };
    return res.redirect('/controles');
  }

  await prisma.$transaction([
    prisma.evaluacionControl.deleteMany({ where: { control_id: control.id } }),
    prisma.controlEns.delete({ where: { id: control.id } }),
  ]);
  req.session.flash = { tipo: 'exito', mensaje: `Control "${control.nombre}" eliminado del catálogo.` };
  res.redirect('/controles');
};

module.exports = { list, newForm, create, editForm, update, remove };
