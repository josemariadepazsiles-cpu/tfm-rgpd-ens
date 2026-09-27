const fs = require('fs');
const path = require('path');

// Iconos Lucide (lucide-static) incrustados como SVG desde el servidor: una sola librería,
// trazo lineal y sin dependencias en el navegador.
// Uso en las vistas: <%- icono('shield-check', 'w-5 h-5 text-indigo-600') %>
// Con `etiqueta`, el icono se anuncia a lectores de pantalla; si no, es decorativo.

const DIR = path.join(path.dirname(require.resolve('lucide-static/package.json')), 'icons');
const cache = new Map();
const NOMBRE_VALIDO = /^[a-z0-9-]+$/;

const cargar = (nombre) => {
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

const escaparAtributo = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const icono = (nombre, clase = 'w-4 h-4', etiqueta) => {
  const svg = cargar(nombre);
  if (!svg) return '';
  const accesible = etiqueta ? `role="img" aria-label="${escaparAtributo(etiqueta)}"` : 'aria-hidden="true" focusable="false"';
  return svg.replace('<svg', `<svg class="shrink-0 ${escaparAtributo(clase)}" stroke-width="1.75" ${accesible}`)
    .replace('stroke-width="2"', '');
};

module.exports = { icono };
