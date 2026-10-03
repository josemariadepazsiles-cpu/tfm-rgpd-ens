const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { idValido } = require('../lib/permisos');
const { ROLES } = require('../config/roles');
const { listaSistemas } = require('../lib/sistemas');
const { LIMITES, excesos } = require('../lib/validacion');

// Gestión de usuarios (solo administradores; las rutas usan ensureAdmin). Cada usuario tiene
// un rol, un cargo y los sistemas en los que trabaja, que determinan qué políticas de sistema
// debe aceptar. Los usuarios no se borran: se desactivan para conservar su historial.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

const noEncontrado = (res) =>
  res.status(404).render('error', { title: 'Usuario no encontrado', mensaje: 'El usuario no existe.' });

const buscar = (req) => {
  const id = idValido(req.params.id);
  return id ? prisma.usuario.findUnique({ where: { id }, include: { sistemas: { select: { sistema_id: true } } } }) : null;
};

// Sistemas marcados en el formulario (checkboxes «sistemas»)
const leerSistemas = (valor) => [].concat(valor || []).map(idValido).filter(Boolean);

const leerFormulario = (body) => ({
  nombre: texto(body.nombre),
  email: texto(body.email).toLowerCase(),
  cargo: texto(body.cargo).slice(0, 150) || null,
  rol: body.rol,
  password: typeof body.password === 'string' ? body.password : '',
  sistemaIds: [...new Set(leerSistemas(body.sistemas))],
});

// Comprueba los datos; `actual` es el usuario que se edita (null al crear)
const validar = async (datos, actual, yo) => {
  const errores = [...excesos(datos, LIMITES.usuario)];
  if (!datos.nombre) errores.push('El nombre es obligatorio.');
  if (!EMAIL_REGEX.test(datos.email)) errores.push('El email no es válido.');
  if (!Object.hasOwn(ROLES, datos.rol || '')) errores.push('El rol no es válido.');
  if (!actual && datos.password.length < 8) errores.push('La contraseña debe tener al menos 8 caracteres.');
  if (actual && datos.password && datos.password.length < 8) errores.push('La nueva contraseña debe tener al menos 8 caracteres.');
  if (datos.sistemaIds.length) {
    const existen = await prisma.sistema.count({ where: { id: { in: datos.sistemaIds } } });
    if (existen !== datos.sistemaIds.length) errores.push('Alguno de los sistemas no es válido.');
  }
  // Un administrador no puede quitarse a sí mismo el rol (evita quedarse sin acceso)
  if (actual && actual.id === yo.id && datos.rol !== 'ADMIN') errores.push('No puedes quitarte a ti mismo el rol de Administrador.');
  return errores;
};

const renderFormulario = async (res, { usuario, errores = [], status = 200 }) => {
  const [sistemas, cargos] = await Promise.all([
    listaSistemas(),
    prisma.usuario.findMany({ where: { cargo: { not: null } }, select: { cargo: true }, distinct: ['cargo'], orderBy: { cargo: 'asc' } }),
  ]);
  res.status(status).render('usuarios/form', {
    title: usuario.id ? 'Editar usuario' : 'Nuevo usuario',
    usuario,
    errores,
    roles: ROLES,
    sistemas,
    cargos: cargos.map((c) => c.cargo),
  });
};

// Listado con sus sistemas y cuántas políticas tiene pendientes de aceptar
const list = async (req, res) => {
  const estado = ['activos', 'inactivos'].includes(req.query.estado) ? req.query.estado : 'activos';
  const [usuarios, politicas] = await Promise.all([
    prisma.usuario.findMany({
      where: estado === 'activos' ? { activo: true } : { activo: false },
      include: { sistemas: { include: { sistema: { select: { id: true, nombre: true } } } } },
      orderBy: { nombre: 'asc' },
    }),
    prisma.politica.findMany({
      where: { estado: 'APROBADA', requiere_aceptacion: true },
      select: { id: true, version: true, sistema_id: true, aceptaciones: { select: { usuario_id: true, version_aceptada: true } } },
    }),
  ]);
  const conteo = { activos: await prisma.usuario.count({ where: { activo: true } }), inactivos: await prisma.usuario.count({ where: { activo: false } }) };
  const pendientes = (u) => {
    const ids = u.sistemas.map((s) => s.sistema_id);
    return politicas.filter((p) => (p.sistema_id === null || ids.includes(p.sistema_id))
      && !p.aceptaciones.some((a) => a.usuario_id === u.id && a.version_aceptada === p.version)).length;
  };
  res.render('usuarios/index', {
    title: 'Usuarios',
    usuarios: usuarios.map((u) => ({ ...u, pendientes: u.activo ? pendientes(u) : null })),
    estado,
    conteo,
    roles: ROLES,
  });
};

const newForm = (req, res) => renderFormulario(res, { usuario: { rol: 'USUARIO', sistemaIds: [] } });

const create = async (req, res) => {
  const datos = leerFormulario(req.body);
  const errores = await validar(datos, null, req.user);
  if (errores.length) return renderFormulario(res, { usuario: datos, errores, status: 400 });
  try {
    const usuario = await prisma.usuario.create({
      data: {
        nombre: datos.nombre, email: datos.email, cargo: datos.cargo, rol: datos.rol,
        password_hash: await bcrypt.hash(datos.password, 12),
        sistemas: { create: datos.sistemaIds.map((sistema_id) => ({ sistema_id })) },
      },
    });
    req.session.flash = { tipo: 'exito', mensaje: `Usuario ${usuario.email} creado como ${ROLES[usuario.rol]}.` };
    res.redirect('/usuarios');
  } catch (err) {
    if (err.code !== 'P2002') throw err;
    renderFormulario(res, { usuario: datos, errores: ['Ya existe un usuario con ese email.'], status: 409 });
  }
};

const editForm = async (req, res) => {
  const usuario = await buscar(req);
  if (!usuario) return noEncontrado(res);
  renderFormulario(res, { usuario: { ...usuario, sistemaIds: usuario.sistemas.map((s) => s.sistema_id) } });
};

const update = async (req, res) => {
  const actual = await buscar(req);
  if (!actual) return noEncontrado(res);
  const datos = leerFormulario(req.body);
  const errores = await validar(datos, actual, req.user);
  if (errores.length) return renderFormulario(res, { usuario: { ...datos, id: actual.id, activo: actual.activo }, errores, status: 400 });
  try {
    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: actual.id },
        data: {
          nombre: datos.nombre, email: datos.email, cargo: datos.cargo, rol: datos.rol,
          ...(datos.password && { password_hash: await bcrypt.hash(datos.password, 12) }),
        },
      }),
      prisma.usuarioSistema.deleteMany({ where: { usuario_id: actual.id } }),
      prisma.usuarioSistema.createMany({ data: datos.sistemaIds.map((sistema_id) => ({ usuario_id: actual.id, sistema_id })) }),
    ]);
  } catch (err) {
    if (err.code !== 'P2002') throw err;
    return renderFormulario(res, { usuario: { ...datos, id: actual.id, activo: actual.activo }, errores: ['Ya existe un usuario con ese email.'], status: 409 });
  }
  req.session.flash = { tipo: 'exito', mensaje: `Usuario ${datos.email} actualizado.` };
  res.redirect('/usuarios');
};

// Activar o desactivar. Un administrador no puede desactivarse a sí mismo ni dejar la
// plataforma sin ningún administrador activo.
const cambiarEstado = async (req, res) => {
  const usuario = await buscar(req);
  if (!usuario) return noEncontrado(res);
  const activar = req.body.activo === '1';
  const volver = (tipo, mensaje) => {
    req.session.flash = { tipo, mensaje };
    res.redirect(`/usuarios/${usuario.id}/editar`);
  };
  if (!activar && usuario.id === req.user.id) return volver('error', 'No puedes desactivar tu propia cuenta.');
  if (!activar && usuario.rol === 'ADMIN') {
    const otrosAdmins = await prisma.usuario.count({ where: { rol: 'ADMIN', activo: true, id: { not: usuario.id } } });
    if (!otrosAdmins) return volver('error', 'Debe quedar al menos un administrador activo.');
  }
  await prisma.usuario.update({ where: { id: usuario.id }, data: { activo: activar } });
  volver('exito', activar
    ? `${usuario.nombre} vuelve a estar activo.`
    : `${usuario.nombre} queda desactivado: no podrá entrar y deja de contar en las aceptaciones de políticas.`);
};

module.exports = { list, newForm, create, editForm, update, cambiarEstado };
