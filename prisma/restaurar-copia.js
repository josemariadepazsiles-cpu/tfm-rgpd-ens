// Restaura una copia hecha con copia-seguridad.js. BORRA los datos actuales.
// Uso: npm run db:restaurar -- backups/copia-AAAAMMDD-HHMMSS.json --confirmar
require('dotenv').config({ quiet: true });
const fs = require('fs');
const { prisma, MODELOS, vaciarDatos, ajustarSecuencias, contarTodo } = require('./utilidades-datos');

const archivo = process.argv.find((a) => a.endsWith('.json'));
if (!archivo || !process.argv.includes('--confirmar')) {
  console.error('Uso: npm run db:restaurar -- <copia.json> --confirmar   (borra los datos actuales)');
  process.exit(1);
}

(async () => {
  const { datos } = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  await vaciarDatos();
  for (const [modelo, tabla] of MODELOS) {
    const filas = datos[tabla] || [];
    if (filas.length) await prisma[modelo].createMany({ data: filas });
  }
  await ajustarSecuencias();
  console.log(`Restaurada ${archivo}:`, await contarTodo());
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
