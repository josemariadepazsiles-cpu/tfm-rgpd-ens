require('dotenv').config();

const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

// Usuario administrador de prueba (solo para desarrollo)
const ADMIN = {
  nombre: 'Administrador',
  email: 'admin@test.com',
  password: 'admin1234',
  area: 'Dirección',
};

async function main() {
  const password_hash = await bcrypt.hash(ADMIN.password, 12);

  const admin = await prisma.usuario.upsert({
    where: { email: ADMIN.email },
    update: {},
    create: {
      nombre: ADMIN.nombre,
      email: ADMIN.email,
      password_hash,
      rol: 'ADMIN',
      area: ADMIN.area,
    },
  });

  console.log(`Usuario administrador listo: ${admin.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
