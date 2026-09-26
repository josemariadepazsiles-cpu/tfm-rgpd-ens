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

// Fecha y hora de España → Date, o null si no existe (p. ej. 30 de febrero o la hora
// que se salta el cambio al horario de verano)
const desdeHoraMadrid = (y, mo, d, h, mi, s = 0) => {
  const comoUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  // Dos pasadas para acertar el desfase en los cambios de horario
  let fecha = new Date(comoUtc - desfase(new Date(comoUtc)));
  fecha = new Date(comoUtc - desfase(fecha));
  const c = componentes(fecha);
  return c.year === y && c.month === mo && c.day === d && c.hour === h && c.minute === mi ? fecha : null;
};

// "2026-09-26T13:45" (hora de España) → Date, o null si no es válido
const desdeInputFechaHora = (valor) => {
  const m = typeof valor === 'string' && valor.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return desdeHoraMadrid(y, mo, d, h, mi);
};

// Fin de un plazo de N meses (Reglamento 1182/71): el mismo día del mes N posterior,
// a las 23:59:59 hora de España; si ese día no existe, el último día de ese mes
// (p. ej. 31 de enero + 1 mes → 28/29 de febrero)
const finPlazoMeses = (inicio, meses) => {
  const c = componentes(new Date(inicio));
  const total = c.month - 1 + meses;
  const y = c.year + Math.floor(total / 12);
  const mo = (total % 12) + 1;
  const ultimoDia = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return desdeHoraMadrid(y, mo, Math.min(c.day, ultimoDia), 23, 59, 59);
};

// Date → "2026-09-26T13:45" en hora de España (valor para el input)
const aInputFechaHora = (d) => {
  if (!d) return '';
  const c = componentes(new Date(d));
  const dos = (n) => String(n).padStart(2, '0');
  return `${c.year}-${dos(c.month)}-${dos(c.day)}T${dos(c.hour)}:${dos(c.minute)}`;
};

// Días naturales (según el calendario de España) entre dos instantes: hoy → mañana = 1
const diasNaturalesEntre = (desde, hasta) => {
  const a = componentes(new Date(desde));
  const b = componentes(new Date(hasta));
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000);
};

module.exports = {
  diasNaturalesEntre,
  fecha,
  fechaHora,
  nombreEvaluacionSugerido,
  desdeInputFechaHora,
  aInputFechaHora,
  finPlazoMeses,
};
