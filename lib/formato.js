// Fechas en hora de España, independientemente de la zona horaria del servidor
const ZONA = 'Europe/Madrid';

const formatoFecha = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONA,
});
const formatoFechaHora = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: ZONA,
});

const fecha = (d) => (d ? formatoFecha.format(new Date(d)) : '—');
const fechaHora = (d) => (d ? formatoFechaHora.format(new Date(d)) : '—');

// Nombre por defecto de una evaluación nueva, p. ej. "Evaluación septiembre de 2026"
const nombreEvaluacionSugerido = () =>
  `Evaluación ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: ZONA })}`;

// --- Campos <input type="datetime-local"> (sin zona horaria: se interpretan en hora de España) ---

const partesMadrid = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: ZONA,
});

// Componentes de la fecha en hora de España
const componentes = (d) =>
  Object.fromEntries(partesMadrid.formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));

// Desfase (ms) de Madrid respecto a UTC en un instante dado
const desfase = (d) => {
  const c = componentes(d);
  return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second) - Math.floor(d.getTime() / 1000) * 1000;
};

// "2026-09-26T13:45" (hora de España) → Date, o null si no es válido
const desdeInputFechaHora = (valor) => {
  const m = typeof valor === 'string' && valor.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const comoUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Dos pasadas para acertar el desfase en los cambios de horario
  let fecha = new Date(comoUtc - desfase(new Date(comoUtc)));
  fecha = new Date(comoUtc - desfase(fecha));
  const c = componentes(fecha);
  return c.year === y && c.month === mo && c.day === d && c.hour === h && c.minute === mi ? fecha : null;
};

// Date → "2026-09-26T13:45" en hora de España (valor para el input)
const aInputFechaHora = (d) => {
  if (!d) return '';
  const c = componentes(new Date(d));
  const dos = (n) => String(n).padStart(2, '0');
  return `${c.year}-${dos(c.month)}-${dos(c.day)}T${dos(c.hour)}:${dos(c.minute)}`;
};

module.exports = { fecha, fechaHora, nombreEvaluacionSugerido, desdeInputFechaHora, aInputFechaHora };
