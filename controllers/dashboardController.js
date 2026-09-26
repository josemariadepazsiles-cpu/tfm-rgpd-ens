const prisma = require('../lib/prisma');
const { CATEGORIAS, resumenPorCategoria } = require('../lib/ens');

const index = async (req, res) => {
  const conteos = await prisma.controlEns.groupBy({
    by: ['categoria', 'estado'],
    _count: true,
  });

  res.render('dashboard', {
    title: 'Dashboard',
    resumenEns: resumenPorCategoria(conteos),
    categorias: CATEGORIAS,
  });
};

module.exports = { index };
