const prisma = require('../lib/prisma');
const { idValido, esAdmin, ambitoActividad, ambitoRiesgo, esAdminOResponsable } = require('../lib/permisos');
const { resumenRgpdPorSistema } = require('../lib/sistemas');
const { NIVELES, PROBABILIDADES, IMPACTOS } = require('../lib/riesgo');
const { TIPOS, GRAVEDADES, ESTADOS_INCIDENTE, ESTADOS_ACTIVOS, plazoAepd } = require('../lib/incidentes');
const { TIPOS_DERECHO, ESTADOS_SOLICITUD, estaResuelta, urgencia } = require('../lib/derechos');
const { CRITICIDADES, ESTADOS_REVISION_BIA } = require('../lib/bia');
const { BASES_LEGALES } = require('../config/baseLegal');
const { resumenEvaluaciones, crearFilasEvaluacion } = require('../lib/evaluaciones');
const { CATEGORIAS, ESTADOS, esCategoria, resumenGlobal } = require('../lib/ens');
const { nombreEvaluacionSugerido } = require('../lib/formato');
const { ESTADOS_DECLARACION } = require('../lib/declaraciones');
const { LIMITES, excesos } = require('../lib/validacion');

// Los sistemas y sus evaluaciones son compartidos por toda la organización:
// cualquier usuario los consulta; solo el Administrador los crea, edita o elimina.
// El sistema es el eje de RGPD y ENS: su ficha reúne toda la información asociada a él.

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
  tipo_sistema: texto(body.tipo_sistema) || null,
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
  const errores = [...excesos(sistema, LIMITES.sistema)];
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
  const [sistemas, totalControles, rgpd] = await Promise.all([
    prisma.sistema.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        evaluaciones: { orderBy: { created_at: 'desc' }, take: 1 },
        _count: { select: { evaluaciones: true } },
      },
    }),
    prisma.controlEns.count(),
    resumenRgpdPorSistema(req.user),
  ]);
  const resumenes = await resumenEvaluaciones(sistemas.flatMap((s) => s.evaluaciones.map((e) => e.id)));

  res.render('sistemas/index', {
    title: 'Sistemas de información',
    totalControles,
    sistemas: sistemas.map((s) => {
      const ultima = s.evaluaciones[0] || null;
      return { ...s, ultima, global: ultima ? resumenGlobal(resumenes.get(ultima.id)) : null, rgpd: rgpd.de(s.id) };
    }),
    transversal: rgpd.de(null),
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

  // Información RGPD y de continuidad asociada al sistema. RAT y riesgos respetan la
  // visibilidad del módulo (un Usuario solo ve los suyos); el resto es visible para todos.
  const sid = sistema.id;
  const usuario = { select: { id: true, nombre: true } };
  const [resumenes, actividades, riesgos, incidentes, solicitudes, procesos, declaraciones] = await Promise.all([
    resumenEvaluaciones(sistema.evaluaciones.map((e) => e.id)),
    prisma.actividadRat.findMany({
      where: { sistema_id: sid, ...ambitoActividad(req.user) },
      include: { responsable: usuario, _count: { select: { riesgos: true } } },
      orderBy: { nombre: 'asc' },
    }),
    prisma.riesgo.findMany({
      where: { sistema_id: sid, ...ambitoRiesgo(req.user) },
      include: { actividad: { select: { id: true, nombre: true } } },
      orderBy: [{ nivel_riesgo: 'desc' }, { amenaza: 'asc' }],
    }),
    prisma.incidente.findMany({
      where: { sistema_id: sid },
      include: { responsable: usuario },
      orderBy: [{ fecha_deteccion: 'desc' }, { id: 'desc' }],
    }),
    prisma.solicitudDerecho.findMany({
      where: { sistema_id: sid },
      include: { responsable: usuario },
      orderBy: [{ fecha_limite: 'asc' }],
    }),
    prisma.procesoNegocio.findMany({
      where: { sistema_id: sid },
      select: { id: true, nombre: true, criticidad: true, estado_revision: true, rto_horas: true },
      orderBy: [{ criticidad: 'desc' }, { nombre: 'asc' }],
    }),
    prisma.declaracionConformidad.findMany({
      where: { sistema_id: sid },
      select: { id: true, version: true, estado: true, evaluacion_id: true },
      orderBy: { version: 'desc' },
    }),
  ]);

  const ahora = new Date();
  const evaluaciones = sistema.evaluaciones.map((e) => {
    const resumen = resumenes.get(e.id);
    // Declaraciones generadas a partir de esta evaluación (la más reciente primero)
    return { ...e, resumen, global: resumenGlobal(resumen), declaraciones: declaraciones.filter((d) => d.evaluacion_id === e.id) };
  });
  const conUrgencia = solicitudes.map((s) => ({ ...s, urgencia: urgencia(s, ahora) }));
  // Abiertas primero (por fecha límite), después las resueltas
  conUrgencia.sort((a, b) => estaResuelta(a.estado) - estaResuelta(b.estado));
  const incidentesPlazo = incidentes.map((i) => ({ ...i, plazo: plazoAepd(i, ahora) }));
  const resumen = {
    ens: evaluaciones.length ? evaluaciones[0].global : null,
    actividades: actividades.length,
    riesgosAltos: riesgos.filter((r) => r.nivel_riesgo === 'ALTO').length,
    riesgosMedios: riesgos.filter((r) => r.nivel_riesgo === 'MEDIO').length,
    riesgosBajos: riesgos.filter((r) => r.nivel_riesgo === 'BAJO').length,
    incidentesActivos: incidentes.filter((i) => ESTADOS_ACTIVOS.includes(i.estado)).length,
    aepdVencidos: incidentesPlazo.filter((i) => i.plazo.tipo === 'vencido').length,
    solicitudesAbiertas: conUrgencia.filter((s) => !estaResuelta(s.estado)).length,
    solicitudesVencidas: conUrgencia.filter((s) => s.urgencia.nivel === 'rojo').length,
    procesosCriticos: procesos.filter((p) => p.criticidad === 'ALTA' || p.criticidad === 'CRITICA').length,
  };

  res.render('sistemas/show', {
    title: sistema.nombre,
    sistema,
    evaluaciones,
    actividades,
    riesgos,
    incidentes: incidentesPlazo,
    solicitudes: conUrgencia,
    procesos,
    ESTADOS_DECLARACION,
    // Declaraciones cuya evaluación se borró: no tienen tarjeta en la que mostrarse
    declaracionesSueltas: declaraciones.filter((d) => !sistema.evaluaciones.some((e) => e.id === d.evaluacion_id)),
    resumen,
    // Un Usuario solo ve sus propias actividades y riesgos
    ambitoRestringido: !esAdmin(req.user),
    niveles: NIVELES,
    probabilidades: PROBABILIDADES,
    impactos: IMPACTOS,
    basesLegales: BASES_LEGALES,
    TIPOS,
    GRAVEDADES,
    ESTADOS_INCIDENTE,
    TIPOS_DERECHO,
    ESTADOS_SOLICITUD,
    CRITICIDADES,
    ESTADOS_REVISION_BIA,
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
      if (evaluacion) await crearFilasEvaluacion(tx, evaluacion.id);
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

  // Las declaraciones de conformidad son registros formales: impiden borrar el sistema
  const declaraciones = await prisma.declaracionConformidad.count({ where: { sistema_id: sistema.id } });
  if (declaraciones) {
    req.session.flash = {
      tipo: 'error',
      mensaje: `No se puede eliminar "${sistema.nombre}": tiene ${declaraciones} declaración(es) de conformidad registradas.`,
    };
    return res.redirect(`/sistemas/${sistema.id}`);
  }

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
