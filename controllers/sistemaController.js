const prisma = require('../lib/prisma');
const { idValido } = require('../lib/permisos');
const { resumenEvaluaciones } = require('../lib/evaluaciones');
const { CATEGORIAS, ESTADOS, esCategoria, resumenGlobal } = require('../lib/ens');
const { nombreEvaluacionSugerido } = require('../lib/formato');

// Los sistemas y sus evaluaciones son compartidos por toda la organización:
// cualquier usuario los consulta; solo el Administrador los crea, edita o elimina.

const HISTORIAL_POR_PAGINA = 50;

const noEncontrado = (res) =>
  res.status(404).render('error', {
    title: 'Sistema no encontrado',
    mensaje: 'El sistema no existe.',
  });

const buscar = (req, include) => {
  const id = idValido(req.params.id);
  return id ? prisma.sistema.findUnique({ where: { id }, include }) : null;
};

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

const leerFormulario = (body) => ({
  nombre: texto(body.nombre),
  descripcion: texto(body.descripcion) || null,
  categoria_general: body.categoria_general || null,
});

const renderFormulario = (res, { sistema, errores = [], status = 200 }) =>
  res.status(status).render('sistemas/form', {
    title: sistema.id ? 'Editar sistema' : 'Nuevo sistema',
    sistema,
    errores,
    categorias: CATEGORIAS,
    nombreSugerido: nombreEvaluacionSugerido(),
  });

// Valida y guarda (crear o editar) controlando el nombre duplicado
const guardar = async (res, sistema, operacion) => {
  const errores = [];
  if (!sistema.nombre) errores.push('El nombre es obligatorio.');
  if (sistema.categoria_general !== null && !esCategoria(sistema.categoria_general)) {
    errores.push('La categoría general no es válida.');
  }
  if (errores.length) {
    renderFormulario(res, { sistema, errores, status: 400 });
    return null;
  }
  try {
    return await operacion();
  } catch (err) {
    if (err.code !== 'P2002') throw err;
    renderFormulario(res, { sistema, errores: ['Ya existe un sistema con ese nombre.'], status: 409 });
    return null;
  }
};

const list = async (req, res) => {
  const [sistemas, totalControles] = await Promise.all([
    prisma.sistema.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        evaluaciones: { orderBy: { created_at: 'desc' }, take: 1 },
        _count: { select: { evaluaciones: true } },
      },
    }),
    prisma.controlEns.count(),
  ]);
  const resumenes = await resumenEvaluaciones(sistemas.flatMap((s) => s.evaluaciones.map((e) => e.id)));

  res.render('sistemas/index', {
    title: 'Sistemas ENS',
    totalControles,
    sistemas: sistemas.map((s) => {
      const ultima = s.evaluaciones[0] || null;
      return { ...s, ultima, global: ultima ? resumenGlobal(resumenes.get(ultima.id)) : null };
    }),
    categorias: CATEGORIAS,
  });
};

const show = async (req, res) => {
  const sistema = await buscar(req, {
    creado_por: { select: { nombre: true } },
    evaluaciones: {
      orderBy: { created_at: 'desc' },
      include: { creado_por: { select: { nombre: true } } },
    },
  });
  if (!sistema) return noEncontrado(res);

  const resumenes = await resumenEvaluaciones(sistema.evaluaciones.map((e) => e.id));

  res.render('sistemas/show', {
    title: sistema.nombre,
    sistema,
    evaluaciones: sistema.evaluaciones.map((e) => {
      const resumen = resumenes.get(e.id);
      return { ...e, resumen, global: resumenGlobal(resumen) };
    }),
    nombreSugerido: nombreEvaluacionSugerido(),
    categorias: CATEGORIAS,
  });
};

const newForm = (req, res) => renderFormulario(res, { sistema: { crear_evaluacion: true } });

// Crea el sistema y, si se marca, su primera evaluación (con todos los controles del catálogo)
const create = async (req, res) => {
  const datos = leerFormulario(req.body);
  const crearEvaluacion = req.body.crear_evaluacion === 'on';
  const nombreEvaluacion = texto(req.body.nombre_evaluacion) || nombreEvaluacionSugerido();

  const resultado = await guardar(res, { ...datos, crear_evaluacion: crearEvaluacion }, () =>
    prisma.$transaction(async (tx) => {
      const sistema = await tx.sistema.create({ data: { ...datos, creado_por_id: req.user.id } });
      const evaluacion = crearEvaluacion
        ? await tx.evaluacion.create({
            data: { sistema_id: sistema.id, nombre: nombreEvaluacion, creado_por_id: req.user.id },
          })
        : null;
      return { sistema, evaluacion };
    })
  );
  if (!resultado) return;

  const { sistema, evaluacion } = resultado;
  if (evaluacion) {
    req.session.flash = {
      tipo: 'exito',
      mensaje: `Sistema "${sistema.nombre}" creado con su primera evaluación. Ya puedes marcar el estado de los controles.`,
    };
    return res.redirect(`/evaluaciones/${evaluacion.id}`);
  }
  req.session.flash = { tipo: 'exito', mensaje: `Sistema "${sistema.nombre}" creado. Crea su primera evaluación.` };
  res.redirect(`/sistemas/${sistema.id}`);
};

const editForm = async (req, res) => {
  const sistema = await buscar(req);
  if (!sistema) return noEncontrado(res);
  renderFormulario(res, { sistema });
};

const update = async (req, res) => {
  const actual = await buscar(req);
  if (!actual) return noEncontrado(res);

  const datos = leerFormulario(req.body);
  const sistema = await guardar(res, { ...datos, id: actual.id }, () =>
    prisma.sistema.update({ where: { id: actual.id }, data: datos })
  );
  if (!sistema) return;
  req.session.flash = { tipo: 'exito', mensaje: 'Sistema actualizado.' };
  res.redirect(`/sistemas/${sistema.id}`);
};

// Solo administradores. Borra en cascada sus evaluaciones y su histórico
const remove = async (req, res) => {
  const sistema = await buscar(req);
  if (!sistema) return noEncontrado(res);

  await prisma.sistema.delete({ where: { id: sistema.id } });
  req.session.flash = { tipo: 'exito', mensaje: `Sistema "${sistema.nombre}" eliminado.` };
  res.redirect('/sistemas');
};

// Histórico de cambios de estado del sistema, filtrable por evaluación y por control
const historial = async (req, res) => {
  const sistema = await buscar(req, {
    evaluaciones: { orderBy: { created_at: 'desc' }, select: { id: true, nombre: true } },
  });
  if (!sistema) return noEncontrado(res);

  const controles = await prisma.controlEns.findMany({
    orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    select: { id: true, nombre: true, categoria: true },
  });

  const evaluacionId = idValido(req.query.evaluacion);
  const filtroEvaluacion = sistema.evaluaciones.some((e) => e.id === evaluacionId) ? evaluacionId : null;
  const controlId = idValido(req.query.control);
  const controlFiltrado = controles.find((c) => c.id === controlId) || null;

  const where = {
    evaluacionControl: {
      evaluacion: filtroEvaluacion ? { id: filtroEvaluacion } : { sistema_id: sistema.id },
      ...(controlFiltrado && { control_id: controlFiltrado.id }),
    },
  };

  const total = await prisma.historialEstado.count({ where });
  const paginas = Math.max(1, Math.ceil(total / HISTORIAL_POR_PAGINA));
  const pagina = Math.min(idValido(req.query.pagina) || 1, paginas);

  const cambios = await prisma.historialEstado.findMany({
    where,
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    skip: (pagina - 1) * HISTORIAL_POR_PAGINA,
    take: HISTORIAL_POR_PAGINA,
    include: {
      usuario: { select: { nombre: true } },
      evaluacionControl: {
        select: {
          evaluacion: { select: { id: true, nombre: true } },
          control: { select: { id: true, nombre: true, categoria: true } },
        },
      },
    },
  });

  res.render('sistemas/historial', {
    title: controlFiltrado ? `Historial · ${controlFiltrado.nombre}` : `Histórico · ${sistema.nombre}`,
    sistema,
    controles,
    cambios,
    filtroEvaluacion,
    controlFiltrado,
    pagina,
    paginas,
    total,
    categorias: CATEGORIAS,
    estados: ESTADOS,
  });
};

module.exports = { list, show, newForm, create, editForm, update, remove, historial };
