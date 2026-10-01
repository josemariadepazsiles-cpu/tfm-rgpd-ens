// Rellena la descripción de los controles ENS del catálogo que aún no la tienen, según su
// código del Anexo II (org.1, op.acc.1, mp.info.6…). No sobrescribe descripciones existentes.
// Uso: npm run db:descripciones
require('dotenv').config({ quiet: true });
const prisma = require('../lib/prisma');
const { rellenarDescripciones } = require('./descripciones-ens');

rellenarDescripciones(prisma)
  .then(async ({ rellenados, yaTenian, sinDescripcion }) => {
    console.log(`Descripciones rellenadas: ${rellenados.length}`);
    console.log(`Ya tenían descripción (no se tocan): ${yaTenian.length}`);
    console.log(`Sin descripción (código no reconocido): ${sinDescripcion.length}`);
    sinDescripcion.forEach((n) => console.log(`  - ${n}`));
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
