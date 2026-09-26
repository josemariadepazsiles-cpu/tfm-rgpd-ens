const prisma = require('../lib/prisma');
const { esAdmin, idValido } = require('../lib/permisos');
const { desdeInputFecha } = require('../lib/formato');
const {
  TIPOS_POLITICA, ESTADOS_POLITICA, DIAS_AVISO_REVISION, VERSION_REGEX, alertaRevision, registrarVersion,
} = require('../lib/politicas');
const {
  TAMANO_MAXIMO, procesarSubida, validarPdf, guardarArchivo, rutaAbsoluta, borrarArchivo,
  cabeceraDisposicion, formatoTamano,
} = require('../lib/subidas');

// El Administrador crea políticas, sube versiones y cambia su estado. El resto de usuarios
// solo ve las políticas Aprobadas (las vigentes), descarga sus documentos y registra su
// aceptación. Las políticas no se eliminan: se marcan como Obsoletas.

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

const renderFormulario = (res, { politica, errores = [], status = 200 }) =>
  res.status(status).render('politicas/form', {
    title: politica.id ? 'Editar documento' : 'Nuevo documento normativo',
    politica,
    errores,
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
    include: { aceptaciones: { where: { usuario_id: req.user.id }, select: { version_aceptada: true } } },
    orderBy: [{ tipo_documento: 'asc' }, { titulo: 'asc' }],
  });
  const ahora = new Date();

  res.render('politicas/index', {
    title: 'Políticas y Documentación',
    politicas: politicas
      .map((p) => ({
        ...p,
        alerta: alertaRevision(p, ahora),
        pendienteAceptar: p.estado === 'APROBADA' && p.requiere_aceptacion && !p.aceptaciones.some((a) => a.version_aceptada === p.version),
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
      prisma.usuario.findMany({ select: { id: true, nombre: true, email: true, area: true }, orderBy: { nombre: 'asc' } }),
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
    puedeAceptar: politica.estado === 'APROBADA' && politica.requiere_aceptacion && vigente && !miAceptacion,
    aceptaciones,
    alerta: alertaRevision(politica),
    tamanoMaximoMb: TAMANO_MAXIMO / 1024 / 1024,
    formatoTamano,
    ...opciones,
  });
};

const newForm = (req, res) => renderFormulario(res, { politica: { version: '1.0', tipo_documento: 'POLITICA', requiere_aceptacion: true } });

const create = async (req, res) => {
  const { datos, errores } = leerFormulario(req.body, null);
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

module.exports = { list, show, newForm, create, editForm, update, subirVersion, cambiarEstado, aceptar, verArchivo };
