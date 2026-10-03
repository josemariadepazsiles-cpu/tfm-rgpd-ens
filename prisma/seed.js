// Carga inicial mínima (npm run prisma:seed): administrador inicial y un catálogo básico de
// controles ENS. No borra nada: solo crea lo que falta.
require('dotenv').config();

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

// Usuario administrador inicial. La contraseña se lee de SEED_ADMIN_PASSWORD (.env); si no
// está definida se genera una aleatoria y se muestra una sola vez por consola. Nunca se deja
// una contraseña conocida escrita en el código.
const passwordDefinida = process.env.SEED_ADMIN_PASSWORD;
if (passwordDefinida && passwordDefinida.length < 12) {
  throw new Error('SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres');
}
const ADMIN = {
  nombre: 'Administrador',
  email: process.env.SEED_ADMIN_EMAIL || 'admin@test.com',
  password: passwordDefinida || crypto.randomBytes(12).toString('base64url'),
  cargo: 'Administrador de la plataforma',
};

// FALLO DETECTADO (menor): estos 12 controles genéricos no siguen la nomenclatura del Anexo II
// que usa el catálogo de ejemplo (mp.com.1…): ejecutar este seed sobre los datos de ejemplo los
// mezcla en el catálogo.
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

// Si el administrador ya existe no se toca (ni su contraseña)
/**
 * @returns {Promise<void>}
 */
async function seedAdmin() {
  const existente = await prisma.usuario.findUnique({ where: { email: ADMIN.email } });
  if (existente) {
    console.log(`Usuario administrador ya existía: ${existente.email} (sin cambios)`);
    return;
  }

  const admin = await prisma.usuario.create({
    data: {
      nombre: ADMIN.nombre,
      email: ADMIN.email,
      password_hash: await bcrypt.hash(ADMIN.password, 12),
      rol: 'ADMIN',
      cargo: ADMIN.cargo,
    },
  });

  console.log(`Usuario administrador creado: ${admin.email}`);
  if (!passwordDefinida) console.log(`Contraseña inicial generada (cámbiala tras entrar): ${ADMIN.password}`);
}

// Crea los controles que falten; los existentes no se tocan para no perder el progreso
// FALLO DETECTADO (menor): los controles se crean con createMany, sin añadirlos a la evaluación
// vigente de cada sistema como hace la aplicación al crear un control (lib/evaluaciones.js).
/**
 * @returns {Promise<void>}
 */
async function seedControles() {
  const datos = Object.entries(CONTROLES).flatMap(([categoria, nombres]) =>
    nombres.map((nombre) => ({ nombre, categoria }))
  );

  const { count } = await prisma.controlEns.createMany({ data: datos, skipDuplicates: true });

  console.log(`Controles ENS: ${count} creados, ${datos.length - count} ya existían`);
}

/**
 * Ejecuta el seed y cierra la conexión al terminar (también si falla).
 * @returns {Promise<void>}
 */
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
