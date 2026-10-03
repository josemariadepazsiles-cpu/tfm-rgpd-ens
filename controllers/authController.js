const passport = require('passport');


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

module.exports = { showLogin, login, logout };
