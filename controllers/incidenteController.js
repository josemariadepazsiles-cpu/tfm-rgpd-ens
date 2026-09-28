const prisma = require('../lib/prisma');
const { esAdmin, idValido } = require('../lib/permisos');
const { desdeInputFechaHora } = require('../lib/formato');
const {
  TIPOS, GRAVEDADES, ESTADOS_INCIDENTE, PLAZO_AEPD_HORAS, ESTADOS_ACTIVOS,
  plazoAepd, puedeGestionar, guardarIncidente, whereAepdPendiente,
} = require('../lib/incidentes');
const { listaSistemas, sistemaSelect, leerSistemaId, validarSistema, filtroSistema } = require('../lib/sistemas');

// Cualquier usuario autenticado puede ver y reportar incidentes. Editarlos y cambiar su
// estado es solo para el Administrador o el responsable asignado; asignar el responsable,
// solo para el Administrador. Los incidentes no se eliminan (trazabilidad, art. 33.5 RGPD).

const HISTORIAL_POR_PAGINA = 50;
const usuarioSelect = { select: { id: true, nombre: true } };

const noEncontrado = (res) =>
  res.status(404).render('error', { title: 'Incidente no encontrado', mensaje: 'El incidente no existe.' });

const sinPermiso = (res) =>
  res.status(403).render('error', {
    title: 'Acceso denegado',
    mensaje: 'Solo el Administrador o el responsable asignado pueden modificar este incidente.',
  });

const buscar = (req, include = {}) => {
  const id = idValido(req.params.id);
  return id ? prisma.incidente.findUnique({ where: { id }, include }) : null;
};

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const opciones = { TIPOS, GRAVEDADES, ESTADOS_INCIDENTE };
const esOpcion = (mapa, valor) => Object.hasOwn(mapa, valor ?? '');

// Lee y valida el formulario. `actual` es el incidente existente (null al crear)
const leerFormulario = async (req, actual) => {
  const { body, user } = req;
  const errores = [];
  const fechaCampo = (campo, etiqueta, obligatorio) => {
    if (!body[campo]) {
      if (obligatorio) errores.push(`${etiqueta} es obligatoria.`);
      return null;
    }
    const fecha = desdeInputFechaHora(body[campo]);
    if (!fecha) errores.push(`${etiqueta} no es válida.`);
    return fecha;
  };

  const numero = texto(body.numero_afectados_estimado);
  const datos = {
    titulo: texto(body.titulo),
    descripcion: texto(body.descripcion),
    fecha_deteccion: fechaCampo('fecha_deteccion', 'La fecha de detección', true),
    fecha_ocurrencia: fechaCampo('fecha_ocurrencia', 'La fecha de ocurrencia', false),
    tipo: body.tipo,
    categorias_datos_afectados: texto(body.categorias_datos_afectados),
    numero_afectados_estimado: numero === '' ? null : Number(numero),
    gravedad: body.gravedad,
    medidas_adoptadas: texto(body.medidas_adoptadas) || null,
    requiere_notificacion_aepd: body.requiere_notificacion_aepd === 'on',
    requiere_notificacion_afectados: body.requiere_notificacion_afectados === 'on',
    sistema_id: leerSistemaId(body.sistema_id),
  };
  datos.fecha_notificacion_aepd = datos.requiere_notificacion_aepd
    ? fechaCampo('fecha_notificacion_aepd', 'La fecha de notificación a la AEPD', false)
    : null;
  datos.fecha_notificacion_afectados = datos.requiere_notificacion_afectados
    ? fechaCampo('fecha_notificacion_afectados', 'La fecha de notificación a los afectados', false)
    : null;

  // El estado solo lo fija quien gestiona el incidente; al reportarlo empieza Abierto
  if (actual) datos.estado = body.estado;
  if (esAdmin(user)) datos.responsable_id = body.responsable_id ? Number(body.responsable_id) : null;

  if (!datos.titulo) errores.push('El título es obligatorio.');
  if (!datos.descripcion) errores.push('La descripción es obligatoria.');
  if (!datos.categorias_datos_afectados) errores.push('Las categorías de datos afectados son obligatorias.');
  if (!esOpcion(TIPOS, datos.tipo)) errores.push('El tipo no es válido.');
  if (!esOpcion(GRAVEDADES, datos.gravedad)) errores.push('La gravedad no es válida.');
  const errorSistema = await validarSistema(datos.sistema_id);
  if (errorSistema) errores.push(errorSistema);
  if (actual && !esOpcion(ESTADOS_INCIDENTE, datos.estado)) errores.push('El estado no es válido.');
  if (datos.numero_afectados_estimado !== null &&
      (!Number.isInteger(datos.numero_afectados_estimado) || datos.numero_afectados_estimado < 0)) {
    errores.push('El número de afectados debe ser un entero igual o mayor que 0.');
  }

  const ahora = Date.now() + 5 * 60 * 1000; // margen por diferencias de reloj
  if (datos.fecha_deteccion && datos.fecha_deteccion.getTime() > ahora) {
    errores.push('La fecha de detección no puede ser futura.');
  }
  if (datos.fecha_ocurrencia && datos.fecha_deteccion && datos.fecha_ocurrencia > datos.fecha_deteccion) {
    errores.push('La fecha de ocurrencia no puede ser posterior a la de detección.');
  }
  for (const [campo, etiqueta] of [['fecha_notificacion_aepd', 'AEPD'], ['fecha_notificacion_afectados', 'los afectados']]) {
    if (datos[campo] && datos.fecha_deteccion && datos[campo] < datos.fecha_deteccion) {
      errores.push(`La notificación a ${etiqueta} no puede ser anterior a la detección.`);
    }
    if (datos[campo] && datos[campo].getTime() > ahora) errores.push(`La notificación a ${etiqueta} no puede ser futura.`);
  }

  if (datos.responsable_id !== undefined && datos.responsable_id !== null) {
    const existe =
      Number.isInteger(datos.responsable_id) &&
      (await prisma.usuario.findUnique({ where: { id: datos.responsable_id } }));
    if (!existe) errores.push('El responsable no es válido.');
  }

  return { datos, errores };
};

const renderFormulario = async (req, res, { incidente, errores = [], status = 200 }) => {
  const usuarios = esAdmin(req.user)
    ? await prisma.usuario.findMany({ select: { id: true, nombre: true, area: true }, orderBy: { nombre: 'asc' } })
    : [];
  const sistemas = await listaSistemas();
  res.status(status).render('incidentes/form', {
    title: incidente.id ? 'Editar incidente' : 'Reportar incidente',
    incidente,
    errores,
    usuarios,
    sistemas,
    plazoHoras: PLAZO_AEPD_HORAS,
    ...opciones,
  });
};

// Filtros rápidos (enlazados desde el panel de control)
const ALERTAS = {
  activos: { texto: 'Incidentes activos (no cerrados)', where: () => ({ estado: { in: ESTADOS_ACTIVOS } }) },
  aepd_pendiente: { texto: 'Notificación a la AEPD pendiente', where: (ahora) => whereAepdPendiente(ahora, false) },
  aepd_vencido: { texto: 'Notificación a la AEPD fuera de plazo (más de 72 h)', where: (ahora) => whereAepdPendiente(ahora, true) },
};

const list = async (req, res) => {
  const estado = esOpcion(ESTADOS_INCIDENTE, req.query.estado) ? req.query.estado : '';
  const gravedad = esOpcion(GRAVEDADES, req.query.gravedad) ? req.query.gravedad : '';
  const alerta = esOpcion(ALERTAS, req.query.alerta) ? req.query.alerta : '';
  const filtro = filtroSistema(req.query.sistema);
  const ahora = new Date();

  const [incidentes, sistemas] = await Promise.all([
    prisma.incidente.findMany({
      where: {
        ...(estado && { estado }), ...(gravedad && { gravedad }), ...(alerta && ALERTAS[alerta].where(ahora)), ...filtro.where,
      },
      include: { responsable: usuarioSelect, sistema: sistemaSelect },
      orderBy: [{ fecha_deteccion: 'desc' }, { id: 'desc' }],
    }),
    listaSistemas(),
  ]);

  res.render('incidentes/index', {
    title: 'Incidentes / Brechas',
    incidentes: incidentes.map((i) => ({ ...i, plazo: plazoAepd(i, ahora), gestionable: puedeGestionar(req.user, i) })),
    estado,
    gravedad,
    alerta,
    sistemas,
    sistema: filtro.sistema,
    filtroAlerta: alerta ? { texto: ALERTAS[alerta].texto, quitar: '/incidentes' + (filtro.sistema ? '?sistema=' + filtro.sistema : '') } : null,
    ...opciones,
  });
};

const show = async (req, res) => {
  const incidente = await buscar(req, {
    responsable: usuarioSelect,
    creado_por: usuarioSelect,
    sistema: sistemaSelect,
    _count: { select: { historial: true } },
  });
  if (!incidente) return noEncontrado(res);

  res.render('incidentes/show', {
    title: incidente.titulo,
    incidente,
    plazo: plazoAepd(incidente),
    gestionable: puedeGestionar(req.user, incidente),
    plazoHoras: PLAZO_AEPD_HORAS,
    ...opciones,
  });
};

// Admite ?sistema=ID para llegar desde la ficha de un sistema con él preseleccionado
const newForm = (req, res) =>
  renderFormulario(req, res, { incidente: { fecha_deteccion: new Date(), sistema_id: leerSistemaId(req.query.sistema) || null } });

const create = async (req, res) => {
  const { datos, errores } = await leerFormulario(req, null);
  if (errores.length) return renderFormulario(req, res, { incidente: datos, errores, status: 400 });

  const incidente = await prisma.incidente.create({ data: { ...datos, creado_por_id: req.user.id } });
  req.session.flash = { tipo: 'exito', mensaje: 'Incidente registrado correctamente.' };
  res.redirect(`/incidentes/${incidente.id}`);
};

const editForm = async (req, res) => {
  const incidente = await buscar(req, { responsable: usuarioSelect });
  if (!incidente) return noEncontrado(res);
  if (!puedeGestionar(req.user, incidente)) return sinPermiso(res);
  renderFormulario(req, res, { incidente });
};

const update = async (req, res) => {
  const actual = await buscar(req, { responsable: usuarioSelect });
  if (!actual) return noEncontrado(res);
  if (!puedeGestionar(req.user, actual)) return sinPermiso(res);

  const { datos, errores } = await leerFormulario(req, actual);
  if (errores.length) {
    return renderFormulario(req, res, {
      incidente: { ...actual, ...datos, id: actual.id },
      errores,
      status: 400,
    });
  }

  const { estadoCambiado, anterior } = await guardarIncidente(actual.id, datos, req.user.id);
  req.session.flash = {
    tipo: 'exito',
    mensaje: estadoCambiado
      ? `Incidente actualizado. Estado: ${ESTADOS_INCIDENTE[anterior]} → ${ESTADOS_INCIDENTE[datos.estado]}.`
      : 'Incidente actualizado.',
  };
  res.redirect(`/incidentes/${actual.id}`);
};

// Cambio rápido de estado desde el detalle
const cambiarEstado = async (req, res) => {
  const incidente = await buscar(req);
  if (!incidente) return noEncontrado(res);
  if (!puedeGestionar(req.user, incidente)) return sinPermiso(res);

  if (!esOpcion(ESTADOS_INCIDENTE, req.body.estado)) {
    req.session.flash = { tipo: 'error', mensaje: 'El estado no es válido.' };
    return res.redirect(`/incidentes/${incidente.id}`);
  }

  const { estadoCambiado, anterior } = await guardarIncidente(incidente.id, { estado: req.body.estado }, req.user.id);
  if (estadoCambiado) {
    req.session.flash = {
      tipo: 'exito',
      mensaje: `Estado: ${ESTADOS_INCIDENTE[anterior]} → ${ESTADOS_INCIDENTE[req.body.estado]}.`,
    };
  }
  res.redirect(`/incidentes/${incidente.id}`);
};

const historial = async (req, res) => {
  const incidente = await buscar(req, { creado_por: usuarioSelect });
  if (!incidente) return noEncontrado(res);

  const total = await prisma.historialIncidente.count({ where: { incidente_id: incidente.id } });
  const paginas = Math.max(1, Math.ceil(total / HISTORIAL_POR_PAGINA));
  const pagina = Math.min(idValido(req.query.pagina) || 1, paginas);
  const cambios = await prisma.historialIncidente.findMany({
    where: { incidente_id: incidente.id },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    skip: (pagina - 1) * HISTORIAL_POR_PAGINA,
    take: HISTORIAL_POR_PAGINA,
    include: { usuario: usuarioSelect },
  });

  res.render('incidentes/historial', {
    title: `Historial · ${incidente.titulo}`,
    incidente,
    cambios,
    total,
    pagina,
    paginas,
    ...opciones,
  });
};

module.exports = { list, show, newForm, create, editForm, update, cambiarEstado, historial };
