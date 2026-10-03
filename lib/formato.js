// Formato y conversión de fechas: presentación en hora de España, lectura de los campos de
// fecha de los formularios y cálculo de plazos legales.

// Fechas en hora de España, independientemente de la zona horaria del servidor
const ZONA = 'Europe/Madrid';

const formatoFecha = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONA,
});
const formatoFechaHora = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: ZONA,
});

/**
 * @param {Date|string|null} d
 * @returns {string} «dd/mm/aaaa» en hora de España, o «—» si no hay fecha
 */
const fecha = (d) => (d ? formatoFecha.format(new Date(d)) : '—');
/**
 * @param {Date|string|null} d
 * @returns {string} «dd/mm/aaaa, hh:mm:ss» en hora de España, o «—»
 */
const fechaHora = (d) => (d ? formatoFechaHora.format(new Date(d)) : '—');

// Nombre por defecto de una evaluación nueva, p. ej. "Evaluación septiembre de 2026"
/** @returns {string} */
const nombreEvaluacionSugerido = () =>
  `Evaluación ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: ZONA })}`;

// --- Campos <input type="datetime-local"> (sin zona horaria: se interpretan en hora de España) ---

const partesMadrid = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: ZONA,
});

// Componentes de la fecha en hora de España
/**
 * @param {Date} d
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number }}
 */
const componentes = (d) =>
  Object.fromEntries(partesMadrid.formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));

// Desfase (ms) de Madrid respecto a UTC en un instante dado
/**
 * @param {Date} d
 * @returns {number} Milisegundos (3.600.000 en invierno, 7.200.000 en verano)
 */
const desfase = (d) => {
  const c = componentes(d);
  return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second) - Math.floor(d.getTime() / 1000) * 1000;
};

// Fecha y hora de España → Date, o null si no existe (p. ej. 30 de febrero o la hora
// que se salta el cambio al horario de verano)
/**
 * @param {number} y Año
 * @param {number} mo Mes (1-12)
 * @param {number} d Día
 * @param {number} h Hora
 * @param {number} mi Minuto
 * @param {number} [s] Segundo
 * @returns {Date|null}
 */
const desdeHoraMadrid = (y, mo, d, h, mi, s = 0) => {
  const comoUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  // Dos pasadas para acertar el desfase en los cambios de horario
  let fecha = new Date(comoUtc - desfase(new Date(comoUtc)));
  fecha = new Date(comoUtc - desfase(fecha));
  const c = componentes(fecha);
  // Si la fecha no existe, al convertirla «se desborda» a otra (30/02 → 02/03): se detecta así
  return c.year === y && c.month === mo && c.day === d && c.hour === h && c.minute === mi ? fecha : null;
};

// "2026-09-26T13:45" (hora de España) → Date, o null si no es válido
/**
 * @param {unknown} valor Valor de un <input type="datetime-local">
 * @returns {Date|null}
 */
const desdeInputFechaHora = (valor) => {
  const m = typeof valor === 'string' && valor.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return desdeHoraMadrid(y, mo, d, h, mi);
};

// --- Campos <input type="date">: se guardan a las 00:00 hora de España ---

// "2026-09-27" → Date, o null si no es válido
/**
 * @param {unknown} valor Valor de un <input type="date">
 * @returns {Date|null}
 */
const desdeInputFecha = (valor) => {
  const m = typeof valor === 'string' && valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? desdeHoraMadrid(Number(m[1]), Number(m[2]), Number(m[3]), 0, 0) : null;
};

// Date → "2026-09-27" en hora de España
/**
 * @param {Date|string|null} d
 * @returns {string} '' si no hay fecha
 */
const aInputFecha = (d) => aInputFechaHora(d).slice(0, 10);

// Fin de un plazo de N meses (Reglamento 1182/71): el mismo día del mes N posterior,
// a las 23:59:59 hora de España; si ese día no existe, el último día de ese mes
// (p. ej. 31 de enero + 1 mes → 28/29 de febrero)
// Regla de negocio: base del plazo de un mes para responder a los derechos (art. 12.3 RGPD),
// ampliable dos meses más.
// FALLO DETECTADO: el Reglamento 1182/71 (art. 3.4) también dice que, si el último día es
// sábado, domingo o festivo, el plazo termina al final del siguiente día hábil; eso no se aplica.
/**
 * @param {Date|string} inicio Fecha de recepción
 * @param {number} meses Meses del plazo
 * @returns {Date|null} Último instante del plazo
 */
const finPlazoMeses = (inicio, meses) => {
  const c = componentes(new Date(inicio));
  const total = c.month - 1 + meses;
  const y = c.year + Math.floor(total / 12);
  const mo = (total % 12) + 1;
  const ultimoDia = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return desdeHoraMadrid(y, mo, Math.min(c.day, ultimoDia), 23, 59, 59);
};

// Date → "2026-09-26T13:45" en hora de España (valor para el input)
/**
 * @param {Date|string|null} d
 * @returns {string} '' si no hay fecha
 */
const aInputFechaHora = (d) => {
  if (!d) return '';
  const c = componentes(new Date(d));
  const dos = (n) => String(n).padStart(2, '0');
  return `${c.year}-${dos(c.month)}-${dos(c.day)}T${dos(c.hour)}:${dos(c.minute)}`;
};

// Días naturales (según el calendario de España) entre dos instantes: hoy → mañana = 1
/**
 * Cuenta días de calendario, no periodos de 24 h: de las 23:00 a las 01:00 del día
 * siguiente ya es 1 día.
 * @param {Date|string} desde
 * @param {Date|string} hasta
 * @returns {number} Negativo si «hasta» es anterior
 */
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
  desdeInputFecha,
  aInputFecha,
  finPlazoMeses,
};
