const { diasNaturalesEntre } = require('./formato');

// Encargados del tratamiento: etiquetas, colores y alertas.
// Tailwind escanea este archivo (ver input.css).

const MECANISMOS = {
  NO_APLICA: 'No aplica',
  CLAUSULAS_TIPO: 'Cláusulas contractuales tipo',
  DECISION_ADECUACION: 'Decisión de adecuación',
  NORMAS_CORPORATIVAS: 'Normas corporativas vinculantes',
  OTRO: 'Otro',
};

const NIVELES_ENS = {
  NO_APLICA: 'No aplica',
  BASICO: 'Básico',
  MEDIO: 'Medio',
  ALTO: 'Alto',
  NO_ACREDITADO: 'No acreditado',
};

const ESTADOS_PROVEEDOR = { ACTIVO: 'Activo', EN_REVISION: 'En revisión', BAJA: 'Baja' };

const TIPOS_DOCUMENTO = {
  CONTRATO: 'Contrato',
  ANEXO: 'Anexo',
  CERTIFICADO: 'Certificado',
  CLAUSULAS_TRANSFERENCIA: 'Cláusulas de transferencia',
  OTRO: 'Otro',
};

const ESTADO_PROVEEDOR_CLASES = {
  ACTIVO: 'bg-green-100 text-green-800 ring-green-600/30',
  EN_REVISION: 'bg-amber-100 text-amber-800 ring-amber-600/30',
  BAJA: 'bg-slate-100 text-slate-600 ring-slate-500/30',
};

const NIVEL_ENS_CLASES = {
  NO_APLICA: 'bg-slate-100 text-slate-600 ring-slate-400/30',
  BASICO: 'bg-green-100 text-green-800 ring-green-600/30',
  MEDIO: 'bg-amber-100 text-amber-800 ring-amber-600/30',
  ALTO: 'bg-red-100 text-red-800 ring-red-600/30',
  NO_ACREDITADO: 'bg-white text-slate-700 ring-slate-400',
};

// Alertas: rojo = sin contrato, amarillo = revisión del contrato en ≤ 30 días o vencida,
// naranja = transferencia internacional (más marcada si no hay mecanismo señalado)
const ALERTA_CLASES = {
  rojo: 'bg-red-600 text-white ring-red-700',
  amarillo: 'bg-yellow-100 text-yellow-800 ring-yellow-600/40',
  naranja: 'bg-orange-100 text-orange-800 ring-orange-600/40',
  naranjaFuerte: 'bg-orange-500 text-white ring-orange-600',
};

const DIAS_AVISO_REVISION = 30;

// Transferencia fuera del EEE sin mecanismo de garantía señalado (art. 44 y ss. RGPD)
const sinMecanismoValido = (p) => p.fuera_ue && p.mecanismo_transferencia === 'NO_APLICA';

const alertas = (p, ahora = new Date()) => {
  const lista = [];
  if (!p.tiene_contrato_encargado) {
    lista.push({ nivel: 'rojo', texto: 'Sin contrato', detalle: 'No consta contrato de encargado del tratamiento firmado (art. 28.3)' });
  }
  if (p.fecha_revision_contrato) {
    const dias = diasNaturalesEntre(ahora, p.fecha_revision_contrato);
    if (dias < 0) {
      lista.push({ nivel: 'amarillo', texto: 'Revisión vencida', detalle: `La revisión del contrato venció hace ${-dias} día(s)` });
    } else if (dias <= DIAS_AVISO_REVISION) {
      lista.push({ nivel: 'amarillo', texto: dias === 0 ? 'Revisión hoy' : `Revisión en ${dias} días`, detalle: 'Revisión o renovación del contrato próxima' });
    }
  }
  if (p.fuera_ue) {
    lista.push(sinMecanismoValido(p)
      ? { nivel: 'naranjaFuerte', texto: 'Transferencia internacional sin garantías', detalle: 'Fuera del EEE sin mecanismo de transferencia señalado (arts. 44-49)' }
      : { nivel: 'naranja', texto: 'Transferencia internacional', detalle: `Fuera del EEE · ${MECANISMOS[p.mecanismo_transferencia]}` });
  }
  return lista;
};

module.exports = {
  MECANISMOS,
  NIVELES_ENS,
  ESTADOS_PROVEEDOR,
  TIPOS_DOCUMENTO,
  ESTADO_PROVEEDOR_CLASES,
  NIVEL_ENS_CLASES,
  ALERTA_CLASES,
  DIAS_AVISO_REVISION,
  sinMecanismoValido,
  alertas,
};
