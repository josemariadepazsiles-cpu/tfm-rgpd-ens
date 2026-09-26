const index = (req, res) => {
  res.render('index', { title: 'Hola mundo' });
};

module.exports = { index };
