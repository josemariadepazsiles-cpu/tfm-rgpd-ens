require('dotenv').config();

const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

// Usuario administrador de prueba (solo para desarrollo)
const ADMIN = {
  nombre: 'Administrador',
  email: 'admin@test.com',
  password: 'admin1234',
  cargo: 'Administrador de la plataforma',
};

// Controles ENS iniciales, todos en estado Pendiente y sin responsable
const CONTROLES = {
  BAJA: [
    'Control de acceso físico',
    'Política de contraseñas',
    'Inventario de activos',
    'Formación y concienciación del personal',
    'Protección frente a código dañino',
  ],
  MEDIA: [
    'Cifrado de comunicaciones',
    'Copias de seguridad periódicas',
    'Registro de actividad de los usuarios',
    'Gestión de incidentes de seguridad',
  ],
  ALTA: [
    'Autenticación multifactor',
    'Cifrado de la información almacenada',
    'Plan de continuidad de la actividad',
  ],
};

async function seedAdmin() {
  const password_hash = await bcrypt.hash(ADMIN.password, 12);

  const admin = await prisma.usuario.upsert({
    where: { email: ADMIN.email },
    update: {},
    create: {
      nombre: ADMIN.nombre,
      email: ADMIN.email,
      password_hash,
      rol: 'ADMIN',
      cargo: ADMIN.cargo,
    },
  });

  console.log(`Usuario administrador listo: ${admin.email}`);
}

// Crea los controles que falten; los existentes no se tocan para no perder el progreso
async function seedControles() {
  const datos = Object.entries(CONTROLES).flatMap(([categoria, nombres]) =>
    nombres.map((nombre) => ({ nombre, categoria }))
  );

  const { count } = await prisma.controlEns.createMany({ data: datos, skipDuplicates: true });

  console.log(`Controles ENS: ${count} creados, ${datos.length - count} ya existían`);
}

async function main() {
  await seedAdmin();
  await seedControles();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
