// Copia de seguridad de todos los datos en un JSON (sin necesidad de pg_dump).
// Uso: npm run db:copia   →   backups/copia-AAAAMMDD-HHMMSS.json
// Contiene datos personales: la carpeta backups/ está excluida de git.
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { prisma, MODELOS } = require('./utilidades-datos');

(async () => {
  const datos = {};
  for (const [modelo, tabla] of MODELOS) {
    datos[tabla] = await prisma[modelo].findMany({ orderBy: { id: 'asc' } });
  }
  const sello = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const dir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `copia-${sello}.json`);
  fs.writeFileSync(archivo, JSON.stringify({ creado: new Date(), modelos: MODELOS, datos }, null, 2));
  console.log(`Copia guardada en ${archivo}`);
  Object.entries(datos).forEach(([tabla, filas]) => console.log(`  ${tabla.padEnd(32)} ${filas.length}`));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
