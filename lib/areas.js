// Área normativa de cada pantalla, para el código de color de «en qué área estoy»:
// RGPD (índigo), ENS (violeta) o neutro (gris pizarra: panel, sistemas, usuarios…).
// Es un color de contexto: no sustituye a los colores de estado o gravedad.
// Los colores están en src/styles/input.css (--color-area-*).
// Además del color, cada área tiene icono y nombre propios: así se distinguen aunque
// el índigo y el violeta se parezcan (o para personas con dificultades con el color).
const AREAS = {
  rgpd: {
    etiqueta: 'RGPD',
    nombre: 'Reglamento General de Protección de Datos',
    icono: 'scale',
    rutas: ['/rat', '/riesgos', '/incidentes', '/derechos', '/proveedores'],
  },
  ens: {
    etiqueta: 'ENS',
    nombre: 'Esquema Nacional de Seguridad',
    icono: 'shield-check',
    rutas: ['/evaluaciones', '/controles', '/declaraciones', '/politicas', '/bia'],
  },
};

const coincide = (ruta, base) => ruta === base || ruta.startsWith(base + '/');

// '/incidentes/7/editar' → 'rgpd'; '/dashboard' → 'neutro'
const areaDeRuta = (ruta = '') => {
  for (const [area, { rutas }] of Object.entries(AREAS)) {
    if (rutas.some((base) => coincide(ruta, base))) return area;
  }
  return 'neutro';
};

module.exports = { AREAS, areaDeRuta };
