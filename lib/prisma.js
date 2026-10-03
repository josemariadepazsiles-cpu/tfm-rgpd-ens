// Cliente único de Prisma (acceso a PostgreSQL) que comparte toda la aplicación.
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// Prisma 7 se conecta a PostgreSQL a través del driver adapter de `pg`
// Hasta 20 conexiones: el panel de control lanza en paralelo una consulta agregada por módulo
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 20 });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
