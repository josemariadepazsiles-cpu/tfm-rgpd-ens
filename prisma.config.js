require('dotenv').config();
const { defineConfig, env } = require('prisma/config');

// Las migraciones usan la conexión directa a PostgreSQL. A través del pooler de Neon
// (host con "-pooler") el bloqueo que toma Prisma Migrate puede quedarse retenido en una
// conexión del pool y bloquear las siguientes migraciones. La app sigue usando
// DATABASE_URL (con pooler) desde lib/prisma.js.
// Si DIRECT_URL no está definida, se deriva quitando "-pooler" del host de Neon.
const urlMigraciones = () =>
  process.env.DIRECT_URL || env('DATABASE_URL').replace(/-pooler(?=\.[^/@]*neon\.tech)/, '');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: urlMigraciones(),
  },
});
