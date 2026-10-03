// Middlewares de control de acceso que usan las rutas: exigir sesión, exigir rol de
// Administrador o exigir que NO haya sesión (página de login).

// Solo usuarios autenticados
/**
 * Sin sesión, redirige a /login.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Function} next
 */
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
};

// Solo usuarios con rol Administrador
/**
 * Sin sesión redirige a /login; con sesión pero sin rol ADMIN responde 403.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Function} next
 */
const ensureAdmin = (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  if (req.user.rol === 'ADMIN') return next();
  res.status(403).render('error', {
    title: 'Acceso denegado',
    mensaje: 'No tienes permisos para acceder a esta página.',
  });
};

// Solo usuarios sin sesión (p. ej. la página de login)
/**
 * Con sesión iniciada, redirige al panel.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Function} next
 */
const ensureGuest = (req, res, next) => {
  if (!req.isAuthenticated()) return next();
  res.redirect('/dashboard');
};

module.exports = { ensureAuthenticated, ensureAdmin, ensureGuest };
