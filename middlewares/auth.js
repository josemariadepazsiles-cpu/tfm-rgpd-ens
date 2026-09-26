// Solo usuarios autenticados
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
};

// Solo usuarios con rol Administrador
const ensureAdmin = (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  if (req.user.rol === 'ADMIN') return next();
  res.status(403).render('error', {
    title: 'Acceso denegado',
    mensaje: 'No tienes permisos para acceder a esta página.',
  });
};

// Solo usuarios sin sesión (p. ej. la página de login)
const ensureGuest = (req, res, next) => {
  if (!req.isAuthenticated()) return next();
  res.redirect('/dashboard');
};

module.exports = { ensureAuthenticated, ensureAdmin, ensureGuest };
