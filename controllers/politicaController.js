const prisma = require('../lib/prisma');
const { esAdmin, idValido } = require('../lib/permisos');
const { desdeInputFecha } = require('../lib/formato');
const {
  TIPOS_POLITICA, ESTADOS_POLITICA, DIAS_AVISO_REVISION, VERSION_REGEX, TIPOS_ADJUNTO_POLITICA, alertaRevision, registrarVersion,
} = require('../lib/politicas');
const {
  TAMANO_MAXIMO, procesarSubida, validarPdf, guardarArchivo, rutaAbsoluta, borrarArchivo,
  cabeceraDisposicion, formatoTamano,
} = require('../lib/subidas');
const { listaSistemas, sistemaSelect, leerSistemaId, validarSistema } = require('../lib/sistemas');
const { afectaA, whereAfectados } = require('../lib/usuarios');

// El Administrador crea políticas, sube versiones y cambia su estado. El resto de usuarios
// solo ve las políticas Aprobadas (las vigentes), descarga sus documentos y registra su
// aceptación. Cada política puede aplicar a un sistema concreto o ser general (sin sistema).
// Lo habitual es marcar como Obsoleta la que deja de estar vigente; el Administrador también
// puede eliminarla.

const usuarioSelect = { select: { id: true, nombre: true } };
const opciones = { TIPOS_POLITICA, ESTADOS_POLITICA, DIAS_AVISO_REVISION };

const noEncontrada = (res) =>
  res.status(404).render('error', { title: 'Documento no encontrado', mensaje: 'La política o el documento no existen o no están vigentes.' });

// Un usuario que no es Administrador solo accede a las políticas aprobadas
const visible = (user, politica) => politica && (esAdmin(user) || politica.estado === 'APROBADA');

const buscar = (req, include = {}) => {
  const id = idValido(req.params.id);
  return id ? prisma.politica.findUnique({ where: { id }, include }) : null;
};

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const esOpcion = (mapa, valor) => Object.hasOwn(mapa, valor ?? '');
const volver = (req, res, id, tipo, mensaje) => {
  if (mensaje) req.session.flash = { tipo, mensaje };
  res.redirect(`/politicas/${id}`);
};

const leerFormulario = (body, actual) => {
  const errores = [];
  const datos = {
    titulo: texto(body.titulo),
    tipo_documento: body.tipo_documento,
    descripcion: texto(body.descripcion) || null,
    requiere_aceptacion: body.requiere_aceptacion === 'on',
    fecha_proxima_revision: null,
    sistema_id: leerSistemaId(body.sistema_id),
  };
  // La versión solo se fija a mano mientras no se haya subido ningún PDF
  if (!actual || !actual.tieneArchivos) datos.version = texto(body.version);

  if (!datos.titulo) errores.push('El título es obligatorio.');
  if (!esOpcion(TIPOS_POLITICA, datos.tipo_documento)) errores.push('El tipo de documento no es válido.');
  if (datos.version !== undefined && !VERSION_REGEX.test(datos.version)) {
    errores.push('La versión es obligatoria (p. ej. "1.0"): letras, números, puntos o guiones, hasta 20 caracteres.');
  }
  if (body.fecha_proxima_revision) {
    datos.fecha_proxima_revision = desdeInputFecha(body.fecha_proxima_revision);
    if (!datos.fecha_proxima_revision) errores.push('La fecha de próxima revisión no es válida.');
  }
  return { datos, errores };
};

const renderFormulario = async (res, { politica, errores = [], status = 200 }) =>
  res.status(status).render('politicas/form', {
    title: politica.id ? 'Editar documento' : 'Nuevo documento normativo',
    politica,
    errores,
    sistemas: await listaSistemas(),
    ...opciones,
  });

const list = async (req, res) => {
  const admin = esAdmin(req.user);
  const tipo = esOpcion(TIPOS_POLITICA, req.query.tipo) ? req.query.tipo : '';
  const estado = admin && esOpcion(ESTADOS_POLITICA, req.query.estado) ? req.query.estado : '';
  // Filtros rápidos (enlazados desde el panel de control)
  const FILTROS = { revision: 'Revisión vencida o en los próximos 30 días', pendientes: 'Pendientes de tu aceptación' };
  const filtro = esOpcion(FILTROS, req.query.filtro) ? req.query.filtro : '';

  const politicas = await prisma.politica.findMany({
    where: {
      ...(tipo && { tipo_documento: tipo }),
      ...(admin ? estado && { estado } : { estado: 'APROBADA' }),
    },
    include: { sistema: sistemaSelect, aceptaciones: { where: { usuario_id: req.user.id }, select: { version_aceptada: true } } },
    orderBy: [{ tipo_documento: 'asc' }, { titulo: 'asc' }],
  });
  const ahora = new Date();

  res.render('politicas/index', {
    title: 'Políticas y Documentación',
    politicas: politicas
      .map((p) => ({
        ...p,
        alerta: alertaRevision(p, ahora),
        afecta: afectaA(p, req.user),
        pendienteAceptar: p.estado === 'APROBADA' && p.requiere_aceptacion && afectaA(p, req.user) && !p.aceptaciones.some((a) => a.version_aceptada === p.version),
      }))
      .filter((p) => (filtro === 'revision' ? p.alerta : filtro === 'pendientes' ? p.pendienteAceptar : true)),
    tipo,
    estado,
    filtro,
    filtroAlerta: filtro ? { texto: FILTROS[filtro], quitar: '/politicas' } : null,
    ...opciones,
  });
};

const show = async (req, res) => {
  const politica = await buscar(req, {
    creado_por: usuarioSelect,
    aprobado_por: usuarioSelect,
    archivos: { orderBy: { fecha_subida: 'desc' }, include: { subido_por: usuarioSelect } },
    documentos: { orderBy: { fecha_subida: 'desc' }, include: { subido_por: usuarioSelect } },
    sistema: sistemaSelect,
  });
  if (!visible(req.user, politica)) return noEncontrada(res);

  const vigente = politica.archivos.find((a) => !a.historico) || null;
  const historicos = politica.archivos.filter((a) => a.historico);
  const miAceptacion = await prisma.aceptacionPolitica.findUnique({
    where: { politica_id_version_aceptada_usuario_id: { politica_id: politica.id, version_aceptada: politica.version, usuario_id: req.user.id } },
  });

  // Para el Administrador: quién ha aceptado la versión vigente y quién falta
  let aceptaciones = null;
  if (esAdmin(req.user) && politica.requiere_aceptacion) {
    const [usuarios, registros] = await Promise.all([
      // Solo los usuarios a los que afecta: activos y, si es de un sistema, asignados a él
      prisma.usuario.findMany({ where: whereAfectados(politica), select: { id: true, nombre: true, email: true, area: true }, orderBy: { nombre: 'asc' } }),
      prisma.aceptacionPolitica.findMany({ where: { politica_id: politica.id, version_aceptada: politica.version } }),
    ]);
    const porUsuario = new Map(registros.map((r) => [r.usuario_id, r]));
    aceptaciones = {
      aceptado: usuarios.filter((u) => porUsuario.has(u.id)).map((u) => ({ ...u, fecha: porUsuario.get(u.id).fecha_aceptacion })),
      pendiente: usuarios.filter((u) => !porUsuario.has(u.id)),
    };
  }

  res.render('politicas/show', {
    title: politica.titulo,
    politica,
    vigente,
    historicos,
    miAceptacion,
    afecta: afectaA(politica, req.user),
    puedeAceptar: politica.estado === 'APROBADA' && politica.requiere_aceptacion && vigente && !miAceptacion && afectaA(politica, req.user),
    aceptaciones,
    alerta: alertaRevision(politica),
    tamanoMaximoMb: TAMANO_MAXIMO / 1024 / 1024,
    formatoTamano,
    TIPOS_ADJUNTO_POLITICA,
    ...opciones,
  });
};

const newForm = (req, res) => renderFormulario(res, { politica: { version: '1.0', tipo_documento: 'POLITICA', requiere_aceptacion: true } });

const create = async (req, res) => {
  const { datos, errores } = leerFormulario(req.body, null);
  const errorSistema = await validarSistema(datos.sistema_id);
  if (errorSistema) errores.push(errorSistema);
  if (errores.length) return renderFormulario(res, { politica: datos, errores, status: 400 });

  const politica = await prisma.politica.create({ data: { ...datos, estado: 'BORRADOR', creado_por_id: req.user.id } });
  volver(req, res, politica.id, 'exito', `"${politica.titulo}" creado en Borrador. Sube el PDF de la versión ${politica.version}.`);
};

const conArchivos = async (req) => {
  const politica = await buscar(req, { _count: { select: { archivos: true } } });
  return politica && { ...politica, tieneArchivos: politica._count.archivos > 0 };
};

const editForm = async (req, res) => {
  const politica = await conArchivos(req);
  if (!politica) return noEncontrada(res);
  renderFormulario(res, { politica });
};

const update = async (req, res) => {
  const actual = await conArchivos(req);
  if (!actual) return noEncontrada(res);

  const { datos, errores } = leerFormulario(req.body, actual);
  const errorSistema = await validarSistema(datos.sistema_id);
  if (errorSistema) errores.push(errorSistema);
  if (errores.length) {
    return renderFormulario(res, { politica: { ...actual, ...datos }, errores, status: 400 });
  }
  await prisma.politica.update({ where: { id: actual.id }, data: datos });
  volver(req, res, actual.id, 'exito', 'Documento actualizado.');
};

// Solo administradores: sube el PDF de una versión (la anterior pasa a histórica)
const subirVersion = async (req, res) => {
  const politica = await buscar(req, { archivos: { select: { version: true } } });
  if (!politica) return noEncontrada(res);
  const error = (mensaje) => volver(req, res, politica.id, 'error', mensaje);

  const errorSubida = await procesarSubida(req, res);
  if (errorSubida) return error(errorSubida);
  const errorPdf = validarPdf(req.file);
  if (errorPdf) return error(errorPdf);

  const version = texto(req.body.version);
  if (!VERSION_REGEX.test(version)) return error('Indica un número de versión válido (p. ej. "2.0").');
  if (politica.archivos.some((a) => a.version === version)) {
    return error(`Ya existe un documento con la versión "${version}". Indica un número de versión nuevo.`);
  }

  const ruta = await guardarArchivo(`politicas/${politica.id}`, req.file.buffer);
  const aprobar = req.body.aprobar === 'on';
  try {
    await registrarVersion(politica.id, {
      version,
      ruta_archivo: ruta,
      nombre_archivo_original: req.file.originalname.slice(0, 255),
      tamano_bytes: req.file.size,
    }, req.user.id, aprobar);
  } catch (err) {
    await borrarArchivo(ruta); // no dejar archivos huérfanos
    if (err.code === 'P2002') return error(`Ya existe un documento con la versión "${version}".`);
    throw err;
  }
  volver(req, res, politica.id, 'exito',
    `Versión ${version} subida (${formatoTamano(req.file.size)})` +
    (politica.archivos.length ? '; la anterior queda como histórica' : '') +
    (aprobar ? ' y aprobada.' : '. Queda pendiente de aprobación.'));
};

// Solo administradores
const cambiarEstado = async (req, res) => {
  const politica = await buscar(req, { archivos: { where: { historico: false }, select: { id: true } } });
  if (!politica) return noEncontrada(res);
  const nuevo = req.body.estado;
  if (!esOpcion(ESTADOS_POLITICA, nuevo)) return volver(req, res, politica.id, 'error', 'El estado no es válido.');
  if (nuevo === politica.estado) return volver(req, res, politica.id);
  if (nuevo === 'APROBADA' && !politica.archivos.length) {
    return volver(req, res, politica.id, 'error', 'Sube el PDF de la versión antes de aprobarla.');
  }

  const data = { estado: nuevo };
  if (nuevo === 'APROBADA') Object.assign(data, { fecha_aprobacion: new Date(), aprobado_por_id: req.user.id });
  if (nuevo === 'BORRADOR' || nuevo === 'PENDIENTE_APROBACION') Object.assign(data, { fecha_aprobacion: null, aprobado_por_id: null });
  await prisma.politica.update({ where: { id: politica.id }, data });
  volver(req, res, politica.id, 'exito', `Estado: ${ESTADOS_POLITICA[politica.estado]} → ${ESTADOS_POLITICA[nuevo]}.`);
};

// Cualquier usuario: registra que ha leído y acepta la versión vigente
const aceptar = async (req, res) => {
  const politica = await buscar(req);
  if (!visible(req.user, politica)) return noEncontrada(res);
  if (politica.estado !== 'APROBADA' || !politica.requiere_aceptacion) {
    return volver(req, res, politica.id, 'error', 'Este documento no requiere aceptación.');
  }
  if (!afectaA(politica, req.user)) {
    return volver(req, res, politica.id, 'error', 'Esta política se aplica a un sistema al que no estás asignado.');
  }
  // La versión que el usuario tenía delante debe seguir siendo la vigente
  if (req.body.version !== politica.version) {
    return volver(req, res, politica.id, 'error', `Se ha publicado una nueva versión (${politica.version}). Revísala antes de aceptarla.`);
  }
  try {
    await prisma.aceptacionPolitica.create({
      data: { politica_id: politica.id, version_aceptada: politica.version, usuario_id: req.user.id },
    });
  } catch (err) {
    if (err.code !== 'P2002') throw err; // ya estaba aceptada
  }
  volver(req, res, politica.id, 'exito', `Has aceptado la versión ${politica.version} de "${politica.titulo}".`);
};

// Ver (por defecto) o descargar (?descargar=1) el PDF de una versión
const verArchivo = async (req, res, next) => {
  const politicaId = idValido(req.params.id);
  const archivoId = idValido(req.params.archivoId);
  if (!politicaId || !archivoId) return noEncontrada(res);
  const archivo = await prisma.archivoPolitica.findUnique({ where: { id: archivoId }, include: { politica: true } });
  if (!archivo || archivo.politica_id !== politicaId || !visible(req.user, archivo.politica)) return noEncontrada(res);

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': cabeceraDisposicion(req.query.descargar ? 'attachment' : 'inline', archivo.nombre_archivo_original),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  res.sendFile(rutaAbsoluta(archivo.ruta_archivo), (err) => {
    if (!err) return;
    if (err.code === 'ENOENT' && !res.headersSent) {
      res.removeHeader('Content-Disposition');
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).render('error', { title: 'Archivo no disponible', mensaje: 'El archivo no se encuentra en el servidor.' });
    }
    next(err);
  });
};

// Solo administradores (la ruta usa ensureAdmin). Borra la política, sus versiones y
// aceptaciones (en cascada) y los PDF del servidor
const remove = async (req, res) => {
  const politica = await buscar(req, { archivos: { select: { ruta_archivo: true } }, documentos: { select: { ruta_archivo: true } } });
  if (!politica) return noEncontrada(res);
  await prisma.politica.delete({ where: { id: politica.id } });
  await Promise.all([...politica.archivos, ...politica.documentos].map((a) => borrarArchivo(a.ruta_archivo)));
  req.session.flash = { tipo: 'exito', mensaje: `Documento "${politica.titulo}" eliminado.` };
  res.redirect('/politicas');
};

// --- Documentos adjuntos (anexos, plantillas, registros…). Los ve quien puede ver la política;
// los sube y elimina el Administrador.
const buscarAdjunto = async (req) => {
  const politicaId = idValido(req.params.id);
  const docId = idValido(req.params.docId);
  if (!politicaId || !docId) return null;
  const documento = await prisma.documentoPolitica.findUnique({ where: { id: docId }, include: { politica: true } });
  return documento && documento.politica_id === politicaId ? documento : null;
};

// Solo administradores (la ruta usa ensureAdmin)
const subirAdjunto = async (req, res) => {
  const politica = await buscar(req);
  if (!politica) return noEncontrada(res);
  const volverA = (tipo, mensaje) => {
    req.session.flash = { tipo, mensaje };
    res.redirect(`/politicas/${politica.id}#adjuntos`);
  };
  const errorSubida = await procesarSubida(req, res);
  if (errorSubida) return volverA('error', errorSubida);
  const nombre = texto(req.body.nombre_documento);
  const tipo = req.body.tipo_documento;
  const errorPdf = validarPdf(req.file);
  if (errorPdf) return volverA('error', errorPdf);
  if (!nombre) return volverA('error', 'Indica un nombre para el documento.');
  if (!esOpcion(TIPOS_ADJUNTO_POLITICA, tipo)) return volverA('error', 'El tipo de documento no es válido.');

  const ruta = await guardarArchivo(`politicas/${politica.id}/adjuntos`, req.file.buffer);
  try {
    await prisma.documentoPolitica.create({
      data: {
        politica_id: politica.id, nombre_documento: nombre.slice(0, 200), tipo_documento: tipo, ruta_archivo: ruta,
        nombre_archivo_original: req.file.originalname.slice(0, 255), tamano_bytes: req.file.size, subido_por_id: req.user.id,
      },
    });
  } catch (err) {
    await borrarArchivo(ruta); // no dejar archivos huérfanos
    throw err;
  }
  volverA('exito', `Documento "${nombre}" adjuntado (${formatoTamano(req.file.size)}).`);
};

const verAdjunto = async (req, res, next) => {
  const documento = await buscarAdjunto(req);
  if (!documento || !visible(req.user, documento.politica)) return noEncontrada(res);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': cabeceraDisposicion(req.query.descargar ? 'attachment' : 'inline', documento.nombre_archivo_original),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  res.sendFile(rutaAbsoluta(documento.ruta_archivo), (err) => {
    if (!err) return;
    if (err.code === 'ENOENT' && !res.headersSent) {
      res.removeHeader('Content-Disposition');
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).render('error', { title: 'Archivo no disponible', mensaje: 'El documento está registrado pero su archivo no se encuentra en el servidor.' });
    }
    next(err);
  });
};

// Solo administradores (la ruta usa ensureAdmin)
const eliminarAdjunto = async (req, res) => {
  const documento = await buscarAdjunto(req);
  if (!documento) return noEncontrada(res);
  await prisma.documentoPolitica.delete({ where: { id: documento.id } });
  await borrarArchivo(documento.ruta_archivo);
  req.session.flash = { tipo: 'exito', mensaje: `Documento "${documento.nombre_documento}" eliminado.` };
  res.redirect(`/politicas/${documento.politica_id}#adjuntos`);
};

module.exports = {
  list, show, newForm, create, editForm, update, remove, subirVersion, cambiarEstado, aceptar, verArchivo,
  subirAdjunto, verAdjunto, eliminarAdjunto,
};
