// Ejecuta la batería de pruebas funcionales (npm test) dejando los datos como estaban:
// 1) comprobaciones previas (no producción, servidor en marcha, datos de ejemplo cargados);
// 2) copia de seguridad de la base de datos (prisma/copia-seguridad.js);
// 3) batería de pruebas (tests/pruebas-funcionales.js), que crea, edita y borra registros;
// 4) SIEMPRE, aunque fallen las pruebas: restaura la copia y borra de uploads/ los archivos
//    que hayan creado las pruebas.
// Requisitos: la app arrancada (npm run dev) y los datos de ejemplo (npm run db:ejemplo).
// Úsalo contra una base de datos de desarrollo o de pruebas, nunca contra producción.
require('dotenv').config({ quiet: true });
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const URL_APP = process.env.TEST_URL || 'http://localhost:3000';
const UPLOADS = path.resolve(process.env.UPLOADS_DIR || path.join(RAIZ, 'uploads'));

/**
 * Ejecuta un script de Node del proyecto mostrando su salida.
 * @param {string[]} args Argumentos de node
 * @param {boolean} [capturar] true: devuelve la salida en lugar de mostrarla
 * @returns {{ status: number, salida: string }}
 */
const node = (args, capturar = false) => {
  const r = spawnSync(process.execPath, args, { cwd: RAIZ, encoding: 'utf8', stdio: capturar ? 'pipe' : 'inherit' });
  return { status: r.status ?? 1, salida: `${r.stdout || ''}${r.stderr || ''}` };
};

/**
 * @param {string} dir
 * @returns {Set<string>} Rutas de todos los archivos bajo dir (vacío si no existe)
 */
const archivos = (dir) => {
  const lista = new Set();
  if (!fs.existsSync(dir)) return lista;
  for (const e of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) lista.add(path.join(e.parentPath || e.path, e.name));
  }
  return lista;
};

/** @param {string} mensaje */
const abortar = (mensaje) => {
  console.error(`\n✗ ${mensaje}\n`);
  process.exit(1);
};

(async () => {
  if (process.env.NODE_ENV === 'production') abortar('Las pruebas no se ejecutan con NODE_ENV=production.');

  try {
    const r = await fetch(`${URL_APP}/login`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    abortar(`La aplicación no responde en ${URL_APP} (${e.message}). Arráncala antes con «npm run dev».`);
  }

  // La batería usa las cuentas y el sistema de los datos de ejemplo
  const prisma = require('../lib/prisma');
  const [admin, usuario, sistema] = await Promise.all([
    prisma.usuario.findUnique({ where: { email: 'admin@test.com' } }),
    prisma.usuario.findUnique({ where: { email: 'carmen.vidal@labfarmareunidos.example' } }),
    prisma.sistema.findFirst({ where: { nombre: 'Área de informática' } }),
  ]);
  await prisma.$disconnect();
  if (!admin || !usuario || !sistema) {
    abortar('Faltan los datos de ejemplo. Cárgalos con «npm run db:ejemplo -- --confirmar» (borra los datos actuales).');
  }

  console.log('1/3 · Copia de seguridad de la base de datos…');
  const copia = node(['prisma/copia-seguridad.js'], true);
  const archivoCopia = (copia.salida.match(/Copia guardada en (.+\.json)/) || [])[1];
  if (copia.status !== 0 || !archivoCopia) abortar(`No se ha podido hacer la copia:\n${copia.salida}`);
  console.log(`    ${path.relative(RAIZ, archivoCopia)}`);
  const antes = archivos(UPLOADS);

  let resultado = 1;
  try {
    console.log('2/3 · Batería de pruebas funcionales…');
    resultado = node(['tests/pruebas-funcionales.js']).status;
  } finally {
    console.log('3/3 · Restaurando los datos y los archivos…');
    const restaurar = node(['prisma/restaurar-copia.js', archivoCopia, '--confirmar'], true);
    if (restaurar.status !== 0) {
      console.error(`✗ No se ha podido restaurar. Hazlo a mano: npm run db:restaurar -- ${archivoCopia} --confirmar\n${restaurar.salida}`);
      resultado = 1;
    }
    let borrados = 0;
    for (const f of archivos(UPLOADS)) {
      if (!antes.has(f)) { fs.rmSync(f); borrados++; }
    }
    console.log(`    Datos restaurados; ${borrados} archivo(s) de prueba borrados de uploads/.`);
  }
  console.log(resultado === 0 ? '\n✓ Pruebas superadas.' : '\n✗ Hay pruebas fallidas: detalle en tests/resultados.json.');
  process.exit(resultado);
})();
