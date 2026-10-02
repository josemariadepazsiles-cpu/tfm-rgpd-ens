const prisma = require('../lib/prisma');
const { esAdmin, esAdminOResponsable, idValido } = require('../lib/permisos');
const { desdeInputFecha } = require('../lib/formato');
const {
  MECANISMOS, NIVELES_ENS, ESTADOS_PROVEEDOR, TIPOS_DOCUMENTO, DIAS_AVISO_REVISION, alertas,
} = require('../lib/proveedores');
const {
  TAMANO_MAXIMO, procesarSubida, validarPdf, guardarArchivo, rutaAbsoluta, borrarArchivo,
  cabeceraDisposicion, formatoTamano,
} = require('../lib/subidas');

// Cualquier usuario autenticado puede consultar proveedores y sus documentos. Crear y
// editar proveedores es solo para el Administrador (estructura general); subir y eliminar
// documentos, para el Administrador o el responsable asignado. Lo habitual es dar de baja
// al proveedor (estado "Baja") para conservar el registro; el Administrador también puede
// eliminarlo definitivamente, junto con sus documentos.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usuarioSelect = { select: { id: true, nombre: true } };
const opciones = { MECANISMOS, NIVELES_ENS, ESTADOS_PROVEEDOR, TIPOS_DOCUMENTO, DIAS_AVISO_REVISION };

const noEncontrado = (res) =>
  res.status(404).render('error', { title: 'No encontrado', mensaje: 'El proveedor o el documento no existen.' });

const sinPermiso = (res) =>
  res.status(403).render('error', {
    title: 'Acceso denegado',
    mensaje: 'Solo el Administrador o el responsable asignado pueden gestionar los documentos de este proveedor.',
  });

const buscar = (req, include = {}) => {
  const id = idValido(req.params.id);
  return id ? prisma.proveedor.findUnique({ where: { id }, include }) : null;
};

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const esOpcion = (mapa, valor) => Object.hasOwn(mapa, valor ?? '');

const leerFormulario = async (body) => {
  const errores = [];
  const fechaCampo = (campo, etiqueta) => {
    if (!body[campo]) return null;
    const valor = desdeInputFecha(body[campo]);
    if (!valor) errores.push(`${etiqueta} no es válida.`);
    return valor;
  };

  const datos = {
    nombre_empresa: texto(body.nombre_empresa),
    cif: texto(body.cif).toUpperCase() || null,
    direccion: texto(body.direccion) || null,
    persona_contacto: texto(body.persona_contacto) || null,
    email_contacto: texto(body.email_contacto).toLowerCase() || null,
    telefono_contacto: texto(body.telefono_contacto) || null,
    servicio_prestado: texto(body.servicio_prestado),
    categorias_datos_tratados: texto(body.categorias_datos_tratados),
    pais_tratamiento: texto(body.pais_tratamiento),
    fuera_ue: body.fuera_ue === 'on',
    mecanismo_transferencia: body.mecanismo_transferencia,
    tiene_contrato_encargado: body.tiene_contrato_encargado === 'on',
    fecha_firma_contrato: fechaCampo('fecha_firma_contrato', 'La fecha de firma'),
    fecha_revision_contrato: fechaCampo('fecha_revision_contrato', 'La fecha de revisión'),
    nivel_cumplimiento_ens: body.nivel_cumplimiento_ens,
    estado: body.estado,
    responsable_id: body.responsable_id ? Number(body.responsable_id) : null,
  };
  // El mecanismo de transferencia solo tiene sentido si hay transferencia fuera del EEE
  if (!datos.fuera_ue) datos.mecanismo_transferencia = 'NO_APLICA';
  if (!datos.tiene_contrato_encargado) datos.fecha_firma_contrato = null;

  if (!datos.nombre_empresa) errores.push('El nombre de la empresa es obligatorio.');
  if (!datos.servicio_prestado) errores.push('El servicio prestado es obligatorio.');
  if (!datos.categorias_datos_tratados) errores.push('Las categorías de datos tratados son obligatorias.');
  if (!datos.pais_tratamiento) errores.push('El país del tratamiento es obligatorio.');
  if (datos.email_contacto && !EMAIL_REGEX.test(datos.email_contacto)) errores.push('El email de contacto no es válido.');
  if (!esOpcion(MECANISMOS, datos.mecanismo_transferencia)) errores.push('El mecanismo de transferencia no es válido.');
  if (!esOpcion(NIVELES_ENS, datos.nivel_cumplimiento_ens)) errores.push('El nivel ENS no es válido.');
  if (!esOpcion(ESTADOS_PROVEEDOR, datos.estado)) errores.push('El estado no es válido.');
  if (datos.fecha_firma_contrato && datos.fecha_firma_contrato > new Date()) {
    errores.push('La fecha de firma no puede ser futura.');
  }
  if (datos.responsable_id !== null) {
    const existe =
      Number.isInteger(datos.responsable_id) &&
      (await prisma.usuario.findUnique({ where: { id: datos.responsable_id } }));
    if (!existe) errores.push('El responsable no es válido.');
  }
  return { datos, errores };
};

const renderFormulario = async (res, { proveedor, errores = [], status = 200 }) => {
  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nombre: true, area: true },
    orderBy: { nombre: 'asc' },
  });
  res.status(status).render('proveedores/form', {
    title: proveedor.id ? 'Editar proveedor' : 'Nuevo proveedor',
    proveedor,
    errores,
    usuarios,
    ...opciones,
  });
};

// Filtros rápidos (enlazados desde el panel de control); no cuentan los dados de baja
const ALERTAS = {
  sin_contrato: {
    texto: 'Sin contrato de encargado firmado (sin contar las bajas)',
    where: { estado: { not: 'BAJA' }, tiene_contrato_encargado: false },
  },
  sin_garantias: {
    texto: 'Transferencia internacional sin mecanismo señalado (sin contar las bajas)',
    where: { estado: { not: 'BAJA' }, fuera_ue: true, mecanismo_transferencia: 'NO_APLICA' },
  },
};

const list = async (req, res) => {
  const estado = esOpcion(ESTADOS_PROVEEDOR, req.query.estado) ? req.query.estado : '';
  const contrato = ['si', 'no'].includes(req.query.contrato) ? req.query.contrato : '';
  const alerta = esOpcion(ALERTAS, req.query.alerta) ? req.query.alerta : '';

  const proveedores = await prisma.proveedor.findMany({
    where: {
      AND: [
        estado ? { estado } : {},
        contrato ? { tiene_contrato_encargado: contrato === 'si' } : {},
        alerta ? ALERTAS[alerta].where : {},
      ],
    },
    include: { responsable: usuarioSelect, _count: { select: { documentos: true } } },
    orderBy: [{ estado: 'asc' }, { nombre_empresa: 'asc' }],
  });
  const ahora = new Date();

  res.render('proveedores/index', {
    title: 'Proveedores',
    proveedores: proveedores.map((p) => ({ ...p, alertas: alertas(p, ahora) })),
    estado,
    contrato,
    alerta,
    filtroAlerta: alerta ? { texto: ALERTAS[alerta].texto, quitar: '/proveedores' } : null,
    ...opciones,
  });
};

const show = async (req, res) => {
  const proveedor = await buscar(req, {
    responsable: usuarioSelect,
    creado_por: usuarioSelect,
    documentos: { orderBy: { fecha_subida: 'desc' }, include: { subido_por: usuarioSelect } },
  });
  if (!proveedor) return noEncontrado(res);

  res.render('proveedores/show', {
    title: proveedor.nombre_empresa,
    proveedor,
    alertas: alertas(proveedor),
    gestionaDocumentos: esAdminOResponsable(req.user, proveedor),
    tamanoMaximoMb: TAMANO_MAXIMO / 1024 / 1024,
    formatoTamano,
    ...opciones,
  });
};

const newForm = (req, res) =>
  renderFormulario(res, {
    proveedor: { estado: 'ACTIVO', mecanismo_transferencia: 'NO_APLICA', nivel_cumplimiento_ens: 'NO_APLICA', pais_tratamiento: 'España' },
  });

const create = async (req, res) => {
  const { datos, errores } = await leerFormulario(req.body);
  if (errores.length) return renderFormulario(res, { proveedor: datos, errores, status: 400 });

  const proveedor = await prisma.proveedor.create({ data: { ...datos, creado_por_id: req.user.id } });
  req.session.flash = { tipo: 'exito', mensaje: `Proveedor "${proveedor.nombre_empresa}" registrado. Ya puedes adjuntar su contrato.` };
  res.redirect(`/proveedores/${proveedor.id}`);
};

const editForm = async (req, res) => {
  const proveedor = await buscar(req);
  if (!proveedor) return noEncontrado(res);
  renderFormulario(res, { proveedor });
};

const update = async (req, res) => {
  const actual = await buscar(req);
  if (!actual) return noEncontrado(res);

  const { datos, errores } = await leerFormulario(req.body);
  if (errores.length) return renderFormulario(res, { proveedor: { ...datos, id: actual.id }, errores, status: 400 });

  await prisma.proveedor.update({ where: { id: actual.id }, data: datos });
  req.session.flash = { tipo: 'exito', mensaje: 'Proveedor actualizado.' };
  res.redirect(`/proveedores/${actual.id}`);
};

// --- Documentos ---

const subirDocumento = async (req, res) => {
  const proveedor = await buscar(req);
  if (!proveedor) return noEncontrado(res);
  if (!esAdminOResponsable(req.user, proveedor)) return sinPermiso(res);

  const volver = (tipo, mensaje) => {
    req.session.flash = { tipo, mensaje };
    res.redirect(`/proveedores/${proveedor.id}#documentos`);
  };

  const errorSubida = await procesarSubida(req, res);
  if (errorSubida) return volver('error', errorSubida);

  const nombre = texto(req.body.nombre_documento);
  const tipo = req.body.tipo_documento;
  const errorPdf = validarPdf(req.file);
  if (errorPdf) return volver('error', errorPdf);
  if (!nombre) return volver('error', 'Indica un nombre para el documento.');
  if (!esOpcion(TIPOS_DOCUMENTO, tipo)) return volver('error', 'El tipo de documento no es válido.');

  const ruta = await guardarArchivo(`proveedores/${proveedor.id}`, req.file.buffer);
  try {
    await prisma.documentoProveedor.create({
      data: {
        proveedor_id: proveedor.id,
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
  volver('exito', `Documento "${nombre}" subido (${formatoTamano(req.file.size)}).`);
};

const buscarDocumento = async (req) => {
  const proveedorId = idValido(req.params.id);
  const docId = idValido(req.params.docId);
  if (!proveedorId || !docId) return null;
  const documento = await prisma.documentoProveedor.findUnique({ where: { id: docId }, include: { proveedor: true } });
  return documento && documento.proveedor_id === proveedorId ? documento : null;
};

// Ver en el navegador (por defecto) o descargar (?descargar=1)
const verDocumento = async (req, res, next) => {
  const documento = await buscarDocumento(req);
  if (!documento) return noEncontrado(res);

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
  if (!documento) return noEncontrado(res);
  if (!esAdminOResponsable(req.user, documento.proveedor)) return sinPermiso(res);

  await prisma.documentoProveedor.delete({ where: { id: documento.id } });
  await borrarArchivo(documento.ruta_archivo);
  req.session.flash = { tipo: 'exito', mensaje: `Documento "${documento.nombre_documento}" eliminado.` };
  res.redirect(`/proveedores/${documento.proveedor_id}#documentos`);
};

// Solo administradores (la ruta usa ensureAdmin). Borra el proveedor, sus documentos (en cascada)
// y los archivos del servidor
const remove = async (req, res) => {
  const proveedor = await buscar(req, { documentos: { select: { ruta_archivo: true } } });
  if (!proveedor) return noEncontrado(res);

  await prisma.proveedor.delete({ where: { id: proveedor.id } });
  await Promise.all(proveedor.documentos.map((d) => borrarArchivo(d.ruta_archivo)));
  req.session.flash = { tipo: 'exito', mensaje: `Proveedor "${proveedor.nombre_empresa}" eliminado.` };
  res.redirect('/proveedores');
};

module.exports = {
  list, show, newForm, create, editForm, update, remove, subirDocumento, verDocumento, eliminarDocumento,
};
