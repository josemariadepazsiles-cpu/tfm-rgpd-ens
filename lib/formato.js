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

module.exports = { fecha, fechaHora, nombreEvaluacionSugerido };
