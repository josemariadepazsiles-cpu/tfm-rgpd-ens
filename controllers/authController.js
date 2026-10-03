const passport = require('passport');
const { intentosLogin } = require('../middlewares/seguridad');

const showLogin = (req, res) => {
  res.render('auth/login', { title: 'Iniciar sesión', error: null, email: '' });
};

// Tras varios fallos seguidos con la misma IP y email, se bloquean los intentos durante unos
// minutos (ver middlewares/seguridad.js)
const login = (req, res, next) => {
  const minutos = intentosLogin.bloqueado(req);
  if (minutos) {
    return res.status(429).render('auth/login', {
      title: 'Iniciar sesión',
      error: `Demasiados intentos fallidos. Espera ${minutos} minuto(s) antes de volver a intentarlo.`,
      email: req.body.email || '',
    });
  }
  passport.authenticate('local', (err, usuario, info) => {
    if (err) return next(err);
    if (!usuario) {
      intentosLogin.fallo(req);
      return res.status(401).render('auth/login', {
        title: 'Iniciar sesión',
        error: info.message,
        email: req.body.email || '',
      });
    }
    intentosLogin.exito(req);
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

module.exports = { showLogin, login, logout };
