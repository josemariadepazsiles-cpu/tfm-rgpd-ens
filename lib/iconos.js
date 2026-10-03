// Helper de las vistas para pintar iconos SVG de la librería Lucide.
const fs = require('fs');
const path = require('path');

// Iconos Lucide (lucide-static) incrustados como SVG desde el servidor: una sola librería,
// trazo lineal y sin dependencias en el navegador.
// Uso en las vistas: <%- icono('shield-check', 'w-5 h-5 text-indigo-600') %>
// Con `etiqueta`, el icono se anuncia a lectores de pantalla; si no, es decorativo.

const DIR = path.join(path.dirname(require.resolve('lucide-static/package.json')), 'icons');
const cache = new Map();
const NOMBRE_VALIDO = /^[a-z0-9-]+$/;

/**
 * Lee el SVG del icono (una vez; luego sale de la caché) y lo limpia para incrustarlo.
 * @param {string} nombre Nombre del icono Lucide, p. ej. 'shield-check'
 * @returns {string} SVG, o '' si no existe o el nombre no es válido
 */
const cargar = (nombre) => {
  // El nombre se valida antes de construir la ruta: evita leer archivos fuera de la carpeta
  if (!cache.has(nombre)) {
    let svg = '';
    if (NOMBRE_VALIDO.test(nombre)) {
      try {
        svg = fs.readFileSync(path.join(DIR, `${nombre}.svg`), 'utf8')
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\s*\n\s*/g, ' ')
          // Solo en la etiqueta <svg>: las formas internas (rect) necesitan su width/height
          .replace(/<svg[^>]*>/, (etiqueta) => etiqueta.replace(/\s+(width|height|class)="[^"]*"/g, ''))
          .trim();
      } catch {
        svg = '';
      }
    }
    cache.set(nombre, svg);
  }
  return cache.get(nombre);
};

/**
 * @param {unknown} s
 * @returns {string} Texto seguro para un atributo HTML entre comillas dobles
 */
const escaparAtributo = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * @param {string} nombre Nombre del icono Lucide
 * @param {string} [clase] Clases CSS (Tailwind) del <svg>
 * @param {string} [etiqueta] Texto para lectores de pantalla; sin él, el icono es decorativo
 * @returns {string} HTML del <svg> (se pinta con <%- %>)
 */
const icono = (nombre, clase = 'w-4 h-4', etiqueta) => {
  const svg = cargar(nombre);
  if (!svg) return '';
  const accesible = etiqueta ? `role="img" aria-label="${escaparAtributo(etiqueta)}"` : 'aria-hidden="true" focusable="false"';
  return svg.replace('<svg', `<svg class="shrink-0 ${escaparAtributo(clase)}" stroke-width="1.75" ${accesible}`)
    .replace('stroke-width="2"', '');
};

module.exports = { icono };
