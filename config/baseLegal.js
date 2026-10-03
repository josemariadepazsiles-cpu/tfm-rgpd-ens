// Catálogo de bases de legitimación del RGPD usado por el Registro de Actividades (RAT):
// relaciona cada valor guardado en la base de datos con el texto que se muestra al usuario.

// Valores del enum BaseLegal de Prisma (art. 6.1 RGPD) y su etiqueta
const BASES_LEGALES = {
  CONSENTIMIENTO: 'Consentimiento del interesado (art. 6.1.a)',
  CONTRATO: 'Ejecución de un contrato (art. 6.1.b)',
  OBLIGACION_LEGAL: 'Cumplimiento de una obligación legal (art. 6.1.c)',
  INTERES_VITAL: 'Protección de intereses vitales (art. 6.1.d)',
  INTERES_PUBLICO: 'Misión de interés público o poderes públicos (art. 6.1.e)',
  INTERES_LEGITIMO: 'Interés legítimo (art. 6.1.f)',
};

module.exports = { BASES_LEGALES };
