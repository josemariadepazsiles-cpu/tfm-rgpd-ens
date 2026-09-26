const index = (req, res) => {
  res.render('dashboard', { title: 'Dashboard' });
};

module.exports = { index };
