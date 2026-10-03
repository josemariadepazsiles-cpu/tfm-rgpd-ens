const prisma = require('../lib/prisma');
const { esAdmin, esAdminOResponsable, idValido } = require('../lib/permisos');
const { desdeInputFechaHora, finPlazoMeses, fecha } = require('../lib/formato');
const {
  TIPOS_DOCUMENTO_SOLICITUD, TIPOS_DERECHO, ARTICULOS_DERECHO, CANALES, ESTADOS_SOLICITUD, DIAS_AVISO, MESES_AMPLIACION, estaResuelta, calcularFechaLimite, urgencia, guardarSolicitud,
} = require('../lib/derechos');
const {
  TAMANO_MAXIMO, procesarSubida, validarPdf, guardarArchivo, rutaAbsoluta, borrarArchivo, cabeceraDisposicion, formatoTamano,
} = require('../lib/subidas');
const { listaSistemas, sistemaSelect, leerSistemaId, validarSistema, filtroSistema } = require('../lib/sistemas');

// Cualquier usuario autenticado puede ver y registrar solicitudes. Tramitarlas (editar,
// cambiar el estado, ampliar el plazo, resolver) es solo para el Administrador o el
// responsable asignado; asignar el responsable, solo para el Administrador.

const HISTORIAL_POR_PAGINA = 50;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usuarioSelect = { select: { id: true, nombre: true } };
const opciones = { TIPOS_DERECHO, ARTICULOS_DERECHO, CANALES, ESTADOS_SOLICITUD, DIAS_AVISO, MESES_AMPLIACION };

const noEncontrada = (res) =>
  res.status(404).render('error', { title: 'Solicitud no encontrada', mensaje: 'La solicitud no existe.' });

const sinPermiso = (res) =>
  res.status(403).render('error', {
    title: 'Acceso denegado',
    mensaje: 'Solo el Administrador o el responsable asignado pueden tramitar esta solicitud.',
  });

const buscar = (req, include = {}) => {
  const id = idValido(req.params.id);
  return id ? prisma.solicitudDerecho.findUnique({ where: { id }, include }) : null;
};

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const esOpcion = (mapa, valor) => Object.hasOwn(mapa, valor ?? '');
const volver = (res, id) => res.redirect(`/derechos/${id}`);

// Lee y valida el formulario. `actual` es la solicitud existente (null al registrarla)
const leerFormulario = async (req, actual) => {
  const { body, user } = req;
  const errores = [];
  const ahora = new Date();
  const margen = ahora.getTime() + 5 * 60 * 1000; // diferencias de reloj
  const fechaCampo = (campo, etiqueta, obligatorio) => {
    if (!body[campo]) {
      if (obligatorio) errores.push(`${etiqueta} es obligatoria.`);
      return null;
    }
    const valor = desdeInputFechaHora(body[campo]);
    if (!valor) errores.push(`${etiqueta} no es válida.`);
    else if (valor.getTime() > margen) errores.push(`${etiqueta} no puede ser futura.`);
    return valor;
  };

  const datos = {
    nombre_solicitante: texto(body.nombre_solicitante),
    email_solicitante: texto(body.email_solicitante).toLowerCase(),
    telefono_solicitante: texto(body.telefono_solicitante) || null,
    tipo_derecho: body.tipo_derecho,
    descripcion: texto(body.descripcion),
    canal_entrada: body.canal_entrada,
    fecha_recepcion: fechaCampo('fecha_recepcion', 'La fecha de recepción', true),
    sistema_id: leerSistemaId(body.sistema_id),
  };
  if (esAdmin(user)) datos.responsable_id = body.responsable_id ? Number(body.responsable_id) : null;

  if (!datos.nombre_solicitante) errores.push('El nombre del solicitante es obligatorio.');
  if (!EMAIL_REGEX.test(datos.email_solicitante)) errores.push('El email del solicitante no es válido.');
  if (!esOpcion(TIPOS_DERECHO, datos.tipo_derecho)) errores.push('El tipo de derecho no es válido.');
  if (!datos.descripcion) errores.push('La descripción de lo solicitado es obligatoria.');
  if (!esOpcion(CANALES, datos.canal_entrada)) errores.push('El canal de entrada no es válido.');
  const errorSistema = await validarSistema(datos.sistema_id);
  if (errorSistema) errores.push(errorSistema);

  if (!actual) {
    // Al registrarla: estado Recibida y plazo general de 1 mes
    datos.plazo_ampliado = false;
    if (datos.fecha_recepcion) datos.fecha_limite = calcularFechaLimite(datos.fecha_recepcion, false);
  } else {
    datos.estado = body.estado;
    datos.plazo_ampliado = body.plazo_ampliado === 'on';
    datos.motivo_ampliacion = datos.plazo_ampliado ? texto(body.motivo_ampliacion) || null : null;
    datos.motivo_denegacion = texto(body.motivo_denegacion) || null;
    datos.respuesta_enviada = texto(body.respuesta_enviada) || null;
    datos.fecha_respuesta = fechaCampo('fecha_respuesta', 'La fecha de respuesta', false);

    if (!esOpcion(ESTADOS_SOLICITUD, datos.estado)) errores.push('El estado no es válido.');
    const resuelta = estaResuelta(datos.estado);

    if (datos.plazo_ampliado && !actual.plazo_ampliado) {
      // Nueva ampliación: con motivo, antes de que venza el plazo inicial y sin resolver
      if (!datos.motivo_ampliacion) errores.push('Indica el motivo de la ampliación del plazo (art. 12.3).');
      if (resuelta) errores.push('No se puede ampliar el plazo de una solicitud resuelta.');
      if (datos.fecha_recepcion && ahora > finPlazoMeses(datos.fecha_recepcion, 1)) {
        errores.push('El plazo solo puede ampliarse dentro del primer mes desde la recepción (art. 12.3).');
      }
      if (!resuelta) datos.estado = 'AMPLIADA';
    } else if (!datos.plazo_ampliado && datos.estado === 'AMPLIADA') {
      if (actual.plazo_ampliado) datos.estado = 'EN_TRAMITACION'; // se anula la ampliación
      else errores.push('Para pasar a "Ampliada" marca la ampliación del plazo e indica el motivo.');
    }

    if (datos.estado === 'DENEGADA' && !datos.motivo_denegacion) {
      errores.push('Indica el motivo de la denegación (art. 12.4).');
    }
    if (datos.estado !== 'DENEGADA') datos.motivo_denegacion = null;
    if (resuelta && !datos.fecha_respuesta && !errores.length) datos.fecha_respuesta = ahora;
    if (datos.fecha_respuesta && datos.fecha_recepcion && datos.fecha_respuesta < datos.fecha_recepcion) {
      errores.push('La fecha de respuesta no puede ser anterior a la de recepción.');
    }
    if (datos.fecha_recepcion) datos.fecha_limite = calcularFechaLimite(datos.fecha_recepcion, datos.plazo_ampliado);
  }

  if (datos.responsable_id !== undefined && datos.responsable_id !== null) {
    const existe =
      Number.isInteger(datos.responsable_id) &&
      (await prisma.usuario.findUnique({ where: { id: datos.responsable_id } }));
    if (!existe) errores.push('El responsable no es válido.');
  }

  return { datos, errores };
};

const renderFormulario = async (req, res, { solicitud, errores = [], status = 200 }) => {
  const usuarios = esAdmin(req.user)
    ? await prisma.usuario.findMany({ select: { id: true, nombre: true, cargo: true }, orderBy: { nombre: 'asc' } })
    : [];
  const sistemas = await listaSistemas();
  const fechaLimiteInicial = solicitud.fecha_recepcion ? finPlazoMeses(solicitud.fecha_recepcion, 1) : null;
  // Tras un error, `plazo_ampliado` refleja lo enviado; `ampliadoGuardado`, lo que hay en la BD
  const ampliadoGuardado = solicitud.ampliadoGuardado ?? solicitud.plazo_ampliado;
  res.status(status).render('derechos/form', {
    title: solicitud.id ? 'Tramitar solicitud' : 'Nueva solicitud',
    solicitud,
    errores,
    usuarios,
    sistemas,
    ampliadoGuardado,
    puedeAmpliar: !ampliadoGuardado && fechaLimiteInicial && new Date() <= fechaLimiteInicial,
    fechaLimiteInicial,
    ...opciones,
  });
};

const list = async (req, res) => {
  const tipo = esOpcion(TIPOS_DERECHO, req.query.tipo) ? req.query.tipo : '';
  const estado = esOpcion(ESTADOS_SOLICITUD, req.query.estado) ? req.query.estado : '';
  const plazo = ['abiertas', 'vencidas', 'proximas'].includes(req.query.plazo) ? req.query.plazo : '';

  const filtro = filtroSistema(req.query.sistema);

  const [solicitudes, sistemas] = await Promise.all([
    prisma.solicitudDerecho.findMany({
      where: { ...(tipo && { tipo_derecho: tipo }), ...(estado && { estado }), ...filtro.where },
      include: { responsable: usuarioSelect, sistema: sistemaSelect },
    }),
    listaSistemas(),
  ]);
  const ahora = new Date();
  const conUrgencia = solicitudes
    .map((s) => ({ ...s, urgencia: urgencia(s, ahora), gestionable: esAdminOResponsable(req.user, s) }))
    .filter((s) => {
      if (plazo === 'abiertas') return !estaResuelta(s.estado);
      if (plazo === 'vencidas') return s.urgencia.nivel === 'rojo';
      if (plazo === 'proximas') return s.urgencia.nivel === 'amarillo';
      return true;
    });

  // Abiertas primero, por fecha límite más próxima; después las resueltas, las más recientes primero
  conUrgencia.sort((a, b) => {
    const ra = estaResuelta(a.estado), rb = estaResuelta(b.estado);
    if (ra !== rb) return ra ? 1 : -1;
    return ra ? b.fecha_respuesta - a.fecha_respuesta : a.fecha_limite - b.fecha_limite;
  });

  res.render('derechos/index', {
    title: 'Derechos de los interesados',
    solicitudes: conUrgencia,
    tipo,
    estado,
    plazo,
    sistemas,
    sistema: filtro.sistema,
    ...opciones,
  });
};

const show = async (req, res) => {
  const solicitud = await buscar(req, {
    responsable: usuarioSelect,
    creado_por: usuarioSelect,
    sistema: sistemaSelect,
    documentos: { orderBy: { fecha_subida: 'desc' }, include: { subido_por: usuarioSelect } },
    _count: { select: { historial: true } },
  });
  if (!solicitud) return noEncontrada(res);

  res.render('derechos/show', {
    TIPOS_DOCUMENTO_SOLICITUD,
    tamanoMaximoMb: TAMANO_MAXIMO / 1024 / 1024,
    formatoTamano,
    title: `Solicitud de ${solicitud.nombre_solicitante}`,
    solicitud,
    urgencia: urgencia(solicitud),
    gestionable: esAdminOResponsable(req.user, solicitud),
    // El cambio rápido no ofrece "Ampliada": ampliar requiere motivo (formulario de tramitación)
    estadosRapidos: Object.fromEntries(Object.entries(ESTADOS_SOLICITUD).filter(([e]) => e !== 'AMPLIADA' || solicitud.estado === 'AMPLIADA')),
    ...opciones,
  });
};

const newForm = (req, res) =>
  // Admite ?sistema=ID para llegar desde la ficha de un sistema con él preseleccionado
  renderFormulario(req, res, { solicitud: { fecha_recepcion: new Date(), canal_entrada: 'EMAIL', sistema_id: leerSistemaId(req.query.sistema) || null } });

const create = async (req, res) => {
  const { datos, errores } = await leerFormulario(req, null);
  if (errores.length) return renderFormulario(req, res, { solicitud: datos, errores, status: 400 });

  const solicitud = await prisma.solicitudDerecho.create({ data: { ...datos, creado_por_id: req.user.id } });
  req.session.flash = {
    tipo: 'exito',
    mensaje: `Solicitud registrada. Fecha límite para responder: ${fecha(solicitud.fecha_limite)}.`,
  };
  volver(res, solicitud.id);
};

const editForm = async (req, res) => {
  const solicitud = await buscar(req, { responsable: usuarioSelect });
  if (!solicitud) return noEncontrada(res);
  if (!esAdminOResponsable(req.user, solicitud)) return sinPermiso(res);
  renderFormulario(req, res, { solicitud });
};

const update = async (req, res) => {
  const actual = await buscar(req, { responsable: usuarioSelect });
  if (!actual) return noEncontrada(res);
  if (!esAdminOResponsable(req.user, actual)) return sinPermiso(res);

  const { datos, errores } = await leerFormulario(req, actual);
  if (errores.length) {
    return renderFormulario(req, res, {
      solicitud: { ...actual, ...datos, id: actual.id, ampliadoGuardado: actual.plazo_ampliado },
      errores,
      status: 400,
    });
  }

  const { estadoCambiado, cambioPlazo, anterior } = await guardarSolicitud(actual.id, datos, req.user.id);
  const partes = ['Solicitud actualizada.'];
  if (estadoCambiado) partes.push(`Estado: ${ESTADOS_SOLICITUD[anterior]} → ${ESTADOS_SOLICITUD[datos.estado]}.`);
  if (cambioPlazo) partes.push(`Nueva fecha límite: ${fecha(datos.fecha_limite)}.`);
  req.session.flash = { tipo: 'exito', mensaje: partes.join(' ') };
  volver(res, actual.id);
};

// Cambio rápido de estado desde el detalle
const cambiarEstado = async (req, res) => {
  const solicitud = await buscar(req);
  if (!solicitud) return noEncontrada(res);
  if (!esAdminOResponsable(req.user, solicitud)) return sinPermiso(res);

  const nuevo = req.body.estado;
  const error = (mensaje) => {
    req.session.flash = { tipo: 'error', mensaje };
    return volver(res, solicitud.id);
  };
  if (!esOpcion(ESTADOS_SOLICITUD, nuevo)) return error('El estado no es válido.');
  if (nuevo === 'AMPLIADA' && solicitud.estado !== 'AMPLIADA') {
    return error('Para ampliar el plazo usa "Tramitar" e indica el motivo.');
  }
  if (nuevo === 'DENEGADA' && !solicitud.motivo_denegacion) {
    return error('Para denegar la solicitud usa "Tramitar" e indica el motivo de la denegación.');
  }

  const datos = { estado: nuevo };
  if (estaResuelta(nuevo) && !solicitud.fecha_respuesta) datos.fecha_respuesta = new Date();
  // La comparación con el estado actual la hace guardarSolicitud con la fila bloqueada
  const { estadoCambiado, anterior } = await guardarSolicitud(solicitud.id, datos, req.user.id);
  if (estadoCambiado) {
    req.session.flash = { tipo: 'exito', mensaje: `Estado: ${ESTADOS_SOLICITUD[anterior]} → ${ESTADOS_SOLICITUD[nuevo]}.` };
  }
  volver(res, solicitud.id);
};

const historial = async (req, res) => {
  const solicitud = await buscar(req, { creado_por: usuarioSelect });
  if (!solicitud) return noEncontrada(res);

  const total = await prisma.historialSolicitudDerecho.count({ where: { solicitud_id: solicitud.id } });
  const paginas = Math.max(1, Math.ceil(total / HISTORIAL_POR_PAGINA));
  const pagina = Math.min(idValido(req.query.pagina) || 1, paginas);
  const cambios = await prisma.historialSolicitudDerecho.findMany({
    where: { solicitud_id: solicitud.id },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    skip: (pagina - 1) * HISTORIAL_POR_PAGINA,
    take: HISTORIAL_POR_PAGINA,
    include: { usuario: usuarioSelect },
  });

  res.render('derechos/historial', {
    title: `Historial · Solicitud de ${solicitud.nombre_solicitante}`,
    solicitud,
    cambios,
    total,
    pagina,
    paginas,
    ...opciones,
  });
};

// --- Documentos de la solicitud (copia del DNI, escrito, respuesta…) ---
// Cualquier usuario autenticado puede verlos; subirlos y eliminarlos, el Administrador o el
// responsable asignado (los mismos que tramitan la solicitud).

const buscarDocumento = async (req) => {
  const solicitudId = idValido(req.params.id);
  const docId = idValido(req.params.docId);
  if (!solicitudId || !docId) return null;
  const documento = await prisma.documentoSolicitudDerecho.findUnique({ where: { id: docId }, include: { solicitud: true } });
  return documento && documento.solicitud_id === solicitudId ? documento : null;
};

const subirDocumento = async (req, res) => {
  const solicitud = await buscar(req);
  if (!solicitud) return noEncontrada(res);
  if (!esAdminOResponsable(req.user, solicitud)) return sinPermiso(res);

  const volverA = (tipo, mensaje) => {
    req.session.flash = { tipo, mensaje };
    res.redirect(`/derechos/${solicitud.id}#documentos`);
  };

  const errorSubida = await procesarSubida(req, res);
  if (errorSubida) return volverA('error', errorSubida);

  const nombre = texto(req.body.nombre_documento);
  const tipo = req.body.tipo_documento;
  const errorPdf = validarPdf(req.file);
  if (errorPdf) return volverA('error', errorPdf);
  if (!nombre) return volverA('error', 'Indica un nombre para el documento.');
  if (!esOpcion(TIPOS_DOCUMENTO_SOLICITUD, tipo)) return volverA('error', 'El tipo de documento no es válido.');

  const ruta = await guardarArchivo(`derechos/${solicitud.id}`, req.file.buffer);
  try {
    await prisma.documentoSolicitudDerecho.create({
      data: {
        solicitud_id: solicitud.id,
        nombre_documento: nombre.slice(0, 200),
        tipo_documento: tipo,
        ruta_archivo: ruta,
        nombre_archivo_original: req.file.originalname.slice(0, 255),
        tamano_bytes: req.file.size,
        subido_por_id: req.user.id,
      },
    });
  } catch (err) {
    await borrarArchivo(ruta); // no dejar archivos huérfanos
    throw err;
  }
  volverA('exito', `Documento "${nombre}" subido (${formatoTamano(req.file.size)}).`);
};

const verDocumento = async (req, res, next) => {
  const documento = await buscarDocumento(req);
  if (!documento) return noEncontrada(res);

  const tipo = req.query.descargar ? 'attachment' : 'inline';
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': cabeceraDisposicion(tipo, documento.nombre_archivo_original),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  res.sendFile(rutaAbsoluta(documento.ruta_archivo), (err) => {
    if (!err) return;
    if (err.code === 'ENOENT' && !res.headersSent) {
      res.removeHeader('Content-Disposition');
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).render('error', {
        title: 'Archivo no disponible',
        mensaje: 'El documento está registrado pero su archivo no se encuentra en el servidor.',
      });
    }
    next(err);
  });
};

const eliminarDocumento = async (req, res) => {
  const documento = await buscarDocumento(req);
  if (!documento) return noEncontrada(res);
  if (!esAdminOResponsable(req.user, documento.solicitud)) return sinPermiso(res);

  await prisma.documentoSolicitudDerecho.delete({ where: { id: documento.id } });
  await borrarArchivo(documento.ruta_archivo);
  req.session.flash = { tipo: 'exito', mensaje: `Documento "${documento.nombre_documento}" eliminado.` };
  res.redirect(`/derechos/${documento.solicitud_id}#documentos`);
};

module.exports = {
  list, show, newForm, create, editForm, update, cambiarEstado, historial, subirDocumento, verDocumento, eliminarDocumento,
};
