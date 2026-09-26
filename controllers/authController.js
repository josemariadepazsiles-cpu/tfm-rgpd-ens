const bcrypt = require('bcryptjs');
const passport = require('passport');
const prisma = require('../lib/prisma');
const { ROLES } = require('../config/roles');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const showLogin = (req, res) => {
  res.render('auth/login', { title: 'Iniciar sesión', error: null, email: '' });
};

const login = (req, res, next) => {
  passport.authenticate('local', (err, usuario, info) => {
    if (err) return next(err);
    if (!usuario) {
      return res.status(401).render('auth/login', {
        title: 'Iniciar sesión',
        error: info.message,
        email: req.body.email || '',
      });
    }
    req.login(usuario, (err) => {
      if (err) return next(err);
      res.redirect('/dashboard');
    });
  })(req, res, next);
};

const logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('sid');
      res.redirect('/login');
    });
  });
};

const renderRegistro = (res, { status = 200, errores = [], exito = null, datos = {} } = {}) => {
  res.status(status).render('auth/registro', {
    title: 'Registrar usuario',
    roles: ROLES,
    errores,
    exito,
    datos,
  });
};

const showRegistro = (req, res) => {
  renderRegistro(res);
};

const registro = async (req, res, next) => {
  const nombre = (req.body.nombre || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const rol = req.body.rol;
  const area = (req.body.area || '').trim();
  const datos = { nombre, email, rol, area };

  const errores = [];
  if (!nombre) errores.push('El nombre es obligatorio.');
  if (!EMAIL_REGEX.test(email)) errores.push('El email no es válido.');
  if (password.length < 8) errores.push('La contraseña debe tener al menos 8 caracteres.');
  if (!Object.keys(ROLES).includes(rol)) errores.push('El rol no es válido.');

  if (errores.length) return renderRegistro(res, { status: 400, errores, datos });

  try {
    const password_hash = await bcrypt.hash(password, 12);
    const usuario = await prisma.usuario.create({
      data: { nombre, email, password_hash, rol, area: area || null },
    });
    renderRegistro(res, {
      exito: `Usuario ${usuario.email} creado como ${ROLES[usuario.rol]}.`,
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return renderRegistro(res, {
        status: 409,
        errores: ['Ya existe un usuario con ese email.'],
        datos,
      });
    }
    next(err);
  }
};

module.exports = { showLogin, login, logout, showRegistro, registro };
