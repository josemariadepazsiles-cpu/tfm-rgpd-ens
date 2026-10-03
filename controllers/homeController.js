// Página raíz de la aplicación.

/**
 * GET / · público. Redirige al panel si hay sesión y, si no, al login.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const index = (req, res) => {
  res.redirect(req.isAuthenticated() ? '/dashboard' : '/login');
};

module.exports = { index };
