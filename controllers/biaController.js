const prisma = require('../lib/prisma');
const { esAdmin, esAdminOResponsable, idValido } = require('../lib/permisos');
const { desdeInputFecha, desdeInputFechaHora } = require('../lib/formato');
const {
  CRITICIDADES, ESTADOS_REVISION_BIA, TIPOS_PRUEBA, RESULTADOS_PRUEBA, alertas, formatoHoras,
} = require('../lib/bia');

// Cualquier usuario autenticado puede consultar el BIA. Crear procesos es solo para el
// Administrador; editar la ficha y registrar pruebas, para el Administrador o el
// responsable asignado; asignar el responsable, solo para el Administrador.
// Procesos y pruebas no se eliminan (registro de auditoría).

const usuarioSelect = { select: { id: true, nombre: true } };
const opciones = { CRITICIDADES, ESTADOS_REVISION_BIA, TIPOS_PRUEBA, RESULTADOS_PRUEBA, formatoHoras };
const HORAS_MAXIMAS = 99999; // límite de Decimal(8, 2)

const noEncontrado = (res) =>
  res.status(404).render('error', { title: 'Proceso no encontrado', mensaje: 'El proceso de negocio no existe.' });

const sinPermiso = (res) =>
  res.status(403).render('error', {
    title: 'Acceso denegado',
    mensaje: 'Solo el Administrador o el responsable asignado pueden modificar este proceso.',
  });

const buscar = (req, include = {}) => {
  const id = idValido(req.params.id);
  return id ? prisma.procesoNegocio.findUnique({ where: { id }, include }) : null;
};

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const esOpcion = (mapa, valor) => Object.hasOwn(mapa, valor ?? '');

// "4", "0,5" o "72.25" → número de horas, o NaN
const leerHoras = (valor) => {
  const t = texto(valor).replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : NaN;
};

const leerFormulario = async (req, actual) => {
  const { body, user } = req;
  const errores = [];
  const datos = {
    nombre: texto(body.nombre),
    descripcion: texto(body.descripcion) || null,
    departamento_responsable: texto(body.departamento_responsable),
    criticidad: body.criticidad,
    rto_horas: leerHoras(body.rto_horas),
    rpo_horas: leerHoras(body.rpo_horas),
    impacto_economico: texto(body.impacto_economico) || null,
    impacto_legal_reputacional: texto(body.impacto_legal_reputacional) || null,
    recursos_minimos_necesarios: texto(body.recursos_minimos_necesarios) || null,
    estrategia_continuidad: texto(body.estrategia_continuidad) || null,
    estado_revision: body.estado_revision,
    sistema_id: body.sistema_id ? Number(body.sistema_id) : null,
    fecha_ultimo_analisis: null,
  };
  if (esAdmin(user)) datos.responsable_id = body.responsable_id ? Number(body.responsable_id) : null;

  if (!datos.nombre) errores.push('El nombre del proceso es obligatorio.');
  if (!datos.departamento_responsable) errores.push('El departamento responsable es obligatorio.');
  if (!esOpcion(CRITICIDADES, datos.criticidad)) errores.push('La criticidad no es válida.');
  if (!esOpcion(ESTADOS_REVISION_BIA, datos.estado_revision)) errores.push('El estado de revisión no es válido.');
  for (const [campo, etiqueta] of [['rto_horas', 'RTO'], ['rpo_horas', 'RPO']]) {
    if (Number.isNaN(datos[campo]) || datos[campo] > HORAS_MAXIMAS) {
      errores.push(`El ${etiqueta} debe ser un número de horas (p. ej. 4 o 0,5), con hasta 2 decimales.`);
    }
  }
  if (body.fecha_ultimo_analisis) {
    datos.fecha_ultimo_analisis = desdeInputFecha(body.fecha_ultimo_analisis);
    if (!datos.fecha_ultimo_analisis) errores.push('La fecha del último análisis no es válida.');
    else if (datos.fecha_ultimo_analisis > new Date()) errores.push('La fecha del último análisis no puede ser futura.');
  } else if (datos.estado_revision && datos.estado_revision !== 'PENDIENTE_ANALISIS' &&
             (!actual || actual.estado_revision === 'PENDIENTE_ANALISIS')) {
    // Al dejar de estar pendiente, se registra el análisis en ese momento
    datos.fecha_ultimo_analisis = new Date();
  } else if (actual) {
    datos.fecha_ultimo_analisis = actual.fecha_ultimo_analisis;
  }

  if (datos.sistema_id !== null) {
    const existe = Number.isInteger(datos.sistema_id) && (await prisma.sistema.findUnique({ where: { id: datos.sistema_id } }));
    if (!existe) errores.push('El sistema no es válido.');
  }
  if (datos.responsable_id !== undefined && datos.responsable_id !== null) {
    const existe = Number.isInteger(datos.responsable_id) && (await prisma.usuario.findUnique({ where: { id: datos.responsable_id } }));
    if (!existe) errores.push('El responsable no es válido.');
  }
  return { datos, errores };
};

const renderFormulario = async (req, res, { proceso, errores = [], status = 200 }) => {
  const [sistemas, usuarios] = await Promise.all([
    prisma.sistema.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    esAdmin(req.user)
      ? prisma.usuario.findMany({ select: { id: true, nombre: true, area: true }, orderBy: { nombre: 'asc' } })
      : [],
  ]);
  res.status(status).render('bia/form', {
    title: proceso.id ? 'Editar proceso' : 'Nuevo proceso de negocio',
    proceso,
    errores,
    sistemas,
    usuarios,
    ...opciones,
  });
};

// Fecha de la prueba más reciente de cada proceso
const ultimasPruebas = async (ids) => {
  const filas = await prisma.pruebaContinuidad.groupBy({
    by: ['proceso_id'],
    where: { proceso_id: { in: ids } },
    _max: { fecha_prueba: true },
  });
  return new Map(filas.map((f) => [f.proceso_id, f._max.fecha_prueba]));
};

const list = async (req, res) => {
  const criticidad = esOpcion(CRITICIDADES, req.query.criticidad) ? req.query.criticidad : '';
  const estado = esOpcion(ESTADOS_REVISION_BIA, req.query.estado) ? req.query.estado : '';

  const procesos = await prisma.procesoNegocio.findMany({
    where: { ...(criticidad && { criticidad }), ...(estado && { estado_revision: estado }) },
    include: { responsable: usuarioSelect, sistema: { select: { id: true, nombre: true } } },
    orderBy: [{ criticidad: 'desc' }, { nombre: 'asc' }],
  });
  const ultimas = await ultimasPruebas(procesos.map((p) => p.id));
  const ahora = new Date();

  res.render('bia/index', {
    title: 'BIA y Continuidad',
    procesos: procesos.map((p) => ({
      ...p,
      ultimaPrueba: ultimas.get(p.id) || null,
      alertas: alertas(p, ultimas.get(p.id), ahora),
      editable: esAdminOResponsable(req.user, p),
    })),
    criticidad,
    estado,
    ...opciones,
  });
};

const show = async (req, res) => {
  const proceso = await buscar(req, {
    responsable: usuarioSelect,
    creado_por: usuarioSelect,
    sistema: { select: { id: true, nombre: true } },
    pruebas: { orderBy: [{ fecha_prueba: 'desc' }, { id: 'desc' }], include: { realizado_por: usuarioSelect } },
  });
  if (!proceso) return noEncontrado(res);

  const ultima = proceso.pruebas[0] || null;
  res.render('bia/show', {
    title: proceso.nombre,
    proceso,
    ultima,
    alertas: alertas(proceso, ultima && ultima.fecha_prueba),
    editable: esAdminOResponsable(req.user, proceso),
    ...opciones,
  });
};

const newForm = (req, res) =>
  renderFormulario(req, res, { proceso: { criticidad: 'MEDIA', estado_revision: 'PENDIENTE_ANALISIS' } });

const create = async (req, res) => {
  const { datos, errores } = await leerFormulario(req, null);
  if (errores.length) return renderFormulario(req, res, { proceso: datos, errores, status: 400 });

  const proceso = await prisma.procesoNegocio.create({ data: { ...datos, creado_por_id: req.user.id } });
  req.session.flash = { tipo: 'exito', mensaje: `Proceso "${proceso.nombre}" registrado.` };
  res.redirect(`/bia/${proceso.id}`);
};

const editForm = async (req, res) => {
  const proceso = await buscar(req, { responsable: usuarioSelect });
  if (!proceso) return noEncontrado(res);
  if (!esAdminOResponsable(req.user, proceso)) return sinPermiso(res);
  renderFormulario(req, res, { proceso });
};

const update = async (req, res) => {
  const actual = await buscar(req, { responsable: usuarioSelect });
  if (!actual) return noEncontrado(res);
  if (!esAdminOResponsable(req.user, actual)) return sinPermiso(res);

  const { datos, errores } = await leerFormulario(req, actual);
  if (errores.length) {
    return renderFormulario(req, res, { proceso: { ...actual, ...datos, id: actual.id }, errores, status: 400 });
  }
  await prisma.procesoNegocio.update({ where: { id: actual.id }, data: datos });
  req.session.flash = { tipo: 'exito', mensaje: 'Proceso actualizado.' };
  res.redirect(`/bia/${actual.id}`);
};

const registrarPrueba = async (req, res) => {
  const proceso = await buscar(req);
  if (!proceso) return noEncontrado(res);
  if (!esAdminOResponsable(req.user, proceso)) return sinPermiso(res);

  const error = (mensaje) => {
    req.session.flash = { tipo: 'error', mensaje };
    res.redirect(`/bia/${proceso.id}#pruebas`);
  };
  const fechaPrueba = desdeInputFechaHora(req.body.fecha_prueba);
  if (!fechaPrueba) return error('Indica una fecha y hora válidas para la prueba.');
  if (fechaPrueba.getTime() > Date.now() + 5 * 60 * 1000) return error('La fecha de la prueba no puede ser futura.');
  if (!esOpcion(TIPOS_PRUEBA, req.body.tipo_prueba)) return error('El tipo de prueba no es válido.');
  if (!esOpcion(RESULTADOS_PRUEBA, req.body.resultado)) return error('El resultado no es válido.');
  const observaciones = texto(req.body.observaciones) || null;
  if (req.body.resultado !== 'SATISFACTORIO' && !observaciones) {
    return error('Describe en las observaciones las incidencias o el fallo de la prueba.');
  }

  await prisma.pruebaContinuidad.create({
    data: {
      proceso_id: proceso.id,
      fecha_prueba: fechaPrueba,
      tipo_prueba: req.body.tipo_prueba,
      resultado: req.body.resultado,
      observaciones,
      realizado_por_id: req.user.id,
    },
  });
  req.session.flash = {
    tipo: 'exito',
    mensaje: `Prueba registrada: ${TIPOS_PRUEBA[req.body.tipo_prueba]} · ${RESULTADOS_PRUEBA[req.body.resultado]}.`,
  };
  res.redirect(`/bia/${proceso.id}#pruebas`);
};

module.exports = { list, show, newForm, create, editForm, update, registrarPrueba };
