// Límites de longitud de los textos de los formularios y su validación, comunes a todos los módulos.

// Longitud máxima de los campos de texto de los formularios (se valida en el servidor; los
// formularios llevan además el atributo maxlength). CORTO: nombres, títulos, emails...
// LARGO: descripciones y textos explicativos.
const CORTO = 200;
const LARGO = 5000;

// Mensajes de error de los campos que superan su máximo.
// `limites`: { campo: [etiqueta, máximo] }
/**
 * @param {object} valores Cuerpo del formulario o datos ya leídos
 * @param {Object<string, [string, number]>} limites
 * @returns {string[]} Un mensaje por campo demasiado largo (vacío si todo es correcto)
 */
const excesos = (valores, limites) =>
  Object.entries(limites)
    .filter(([campo, [, max]]) => typeof valores[campo] === 'string' && valores[campo].trim().length > max)
    .map(([, [etiqueta, max]]) => `${etiqueta}: máximo ${max.toLocaleString('es-ES')} caracteres.`);

const LIMITES = {
  rat: {
    nombre: ['Nombre', CORTO], finalidad: ['Finalidad', LARGO], categorias_datos: ['Categorías de datos', LARGO],
    categorias_interesados: ['Categorías de interesados', LARGO], destinatarios: ['Destinatarios', LARGO],
    plazo_conservacion: ['Plazo de conservación', 1000], medidas_seguridad: ['Medidas de seguridad', LARGO],
    pais_transferencia: ['País de la transferencia', CORTO],
  },
  riesgo: { amenaza: ['Amenaza', 1000], medidas_mitigadoras: ['Medidas mitigadoras', LARGO] },
  sistema: {
    nombre: ['Nombre', CORTO], tipo_sistema: ['Tipo de sistema', CORTO], descripcion: ['Descripción', LARGO],
    nombre_evaluacion: ['Nombre de la evaluación', CORTO],
  },
  incidente: {
    titulo: ['Título', CORTO], descripcion: ['Descripción', LARGO],
    categorias_datos_afectados: ['Categorías de datos afectados', LARGO], medidas_adoptadas: ['Medidas adoptadas', LARGO],
  },
  derecho: {
    nombre_solicitante: ['Nombre del solicitante', CORTO], email_solicitante: ['Email del solicitante', CORTO],
    telefono_solicitante: ['Teléfono', 50], descripcion: ['Descripción', LARGO], respuesta_enviada: ['Respuesta', LARGO],
    motivo_denegacion: ['Motivo de la denegación', LARGO], motivo_ampliacion: ['Motivo de la ampliación', LARGO],
  },
  proveedor: {
    nombre_empresa: ['Nombre de la empresa', CORTO], cif: ['CIF', 50], direccion: ['Dirección', 300],
    persona_contacto: ['Persona de contacto', CORTO], email_contacto: ['Email de contacto', CORTO],
    telefono_contacto: ['Teléfono de contacto', 50], servicio_prestado: ['Servicio prestado', LARGO],
    categorias_datos_tratados: ['Categorías de datos tratados', LARGO], pais_tratamiento: ['País del tratamiento', CORTO],
  },
  control: { nombre: ['Nombre', CORTO] },
  evidencia: { evidencia: ['Evidencia', LARGO] },
  declaracion: { observaciones: ['Observaciones', LARGO] },
  politica: { titulo: ['Título', CORTO], descripcion: ['Descripción', LARGO] },
  bia: {
    nombre: ['Nombre del proceso', CORTO], departamento_responsable: ['Departamento responsable', CORTO],
    descripcion: ['Descripción', LARGO], impacto_economico: ['Impacto económico', LARGO],
    impacto_legal_reputacional: ['Impacto legal y reputacional', LARGO], recursos_minimos_necesarios: ['Recursos mínimos', LARGO],
    estrategia_continuidad: ['Estrategia de continuidad', LARGO],
  },
  pruebaBia: { observaciones: ['Observaciones', LARGO] },
  usuario: { nombre: ['Nombre', CORTO], email: ['Email', CORTO] },
};

module.exports = { CORTO, LARGO, LIMITES, excesos };
