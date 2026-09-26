const index = (req, res) => {
  res.redirect(req.isAuthenticated() ? '/dashboard' : '/login');
};

module.exports = { index };
