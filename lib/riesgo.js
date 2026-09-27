// Matriz de riesgo 3x3: nivel = probabilidad x impacto
//
//                 Impacto
//                 Bajo(1)    Medio(2)   Alto(3)
// Probabilidad
//   Baja(1)       1 Bajo     2 Bajo     3 Medio
//   Media(2)      2 Bajo     4 Medio    6 Alto
//   Alta(3)       3 Medio    6 Alto     9 Alto
//
// Puntuación 1-2 → Bajo · 3-4 → Medio · 6-9 → Alto

const PROBABILIDADES = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta' };
const IMPACTOS = { BAJO: 'Bajo', MEDIO: 'Medio', ALTO: 'Alto' };
const NIVELES = { BAJO: 'Bajo', MEDIO: 'Medio', ALTO: 'Alto' };

// Clases de Tailwind por nivel (verde / ámbar / rojo). Tailwind escanea este archivo (ver input.css)
const NIVEL_CLASES = {
  BAJO: 'bg-green-50 text-green-700 ring-green-600/20',
  MEDIO: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  ALTO: 'bg-red-50 text-red-700 ring-red-600/20',
};

const VALOR_PROBABILIDAD = { BAJA: 1, MEDIA: 2, ALTA: 3 };
const VALOR_IMPACTO = { BAJO: 1, MEDIO: 2, ALTO: 3 };

const nivelDesdePuntuacion = (puntuacion) => {
  if (puntuacion >= 6) return 'ALTO';
  if (puntuacion >= 3) return 'MEDIO';
  return 'BAJO';
};

// Devuelve el nivel (BAJO | MEDIO | ALTO) o null si los datos no son válidos
const calcularNivel = (probabilidad, impacto) => {
  if (!Object.hasOwn(VALOR_PROBABILIDAD, probabilidad) || !Object.hasOwn(VALOR_IMPACTO, impacto)) {
    return null;
  }
  return nivelDesdePuntuacion(VALOR_PROBABILIDAD[probabilidad] * VALOR_IMPACTO[impacto]);
};

// Matriz completa { probabilidad: { impacto: nivel } } para mostrarla en las vistas
const MATRIZ = Object.fromEntries(
  Object.keys(PROBABILIDADES).map((p) => [
    p,
    Object.fromEntries(Object.keys(IMPACTOS).map((i) => [i, calcularNivel(p, i)])),
  ])
);

module.exports = { PROBABILIDADES, IMPACTOS, NIVELES, NIVEL_CLASES, MATRIZ, calcularNivel };
