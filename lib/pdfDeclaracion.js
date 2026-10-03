// Maquetación en PDF de una Declaración de Conformidad ENS (cabecera, resumen, tabla de controles
// por categoría, observaciones, firma, marca de agua y pie de página).
const PDFDocument = require('pdfkit');
const { fechaHora } = require('./formato');
const { ESTADOS } = require('./ens');
const { CATEGORIAS_SISTEMA, ESTADOS_DECLARACION, formatoPorcentaje } = require('./declaraciones');

// Genera el PDF de una Declaración de Conformidad ENS y lo escribe en `destino` (stream).
// Usa las fuentes estándar de PDF (Helvetica), que cubren el alfabeto español.

const COLORES_CATEGORIA = {
  BAJA: { fondo: '#dcfce7', texto: '#166534' },
  MEDIA: { fondo: '#fef3c7', texto: '#92400e' },
  ALTA: { fondo: '#fee2e2', texto: '#991b1b' },
};
const COLORES_ESTADO = { IMPLEMENTADO: '#15803d', PENDIENTE: '#b45309', NO_APLICA: '#64748b' };
const GRIS = '#475569';
const BORDE = '#cbd5e1';

const MARGEN = 50;
const COLUMNAS = [
  { titulo: 'Control', ancho: 150, campo: 'control' },
  { titulo: 'Estado', ancho: 70, campo: 'estado' },
  { titulo: 'Responsable', ancho: 80, campo: 'responsable' },
  { titulo: 'Último cambio', ancho: 75, campo: 'fecha' },
  { titulo: 'Evidencia', ancho: 120, campo: 'evidencia' },
];
const RELLENO = 4;

/**
 * @param {object} d Declaración con sus detalles (controles), tal como está en la base de datos
 * @param {import('stream').Writable} destino Normalmente la respuesta HTTP
 */
const escribirPdf = (d, destino) => {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGEN, bottom: MARGEN + 15, left: MARGEN, right: MARGEN },
    bufferPages: true,
    info: {
      Title: `Declaración de Conformidad ENS - ${d.sistema_nombre} - v${d.version}`,
      Author: d.generado_por_nombre,
      Subject: 'Declaración de Conformidad con el Esquema Nacional de Seguridad',
    },
  });
  doc.pipe(destino);

  const ancho = doc.page.width - MARGEN * 2;
  const limiteInferior = () => doc.page.height - doc.page.margins.bottom;
  /** @param {number} alto Alto que se va a dibujar @returns {boolean} true si ha añadido página */
  const saltoSiHaceFalta = (alto) => {
    if (doc.y + alto > limiteInferior()) {
      doc.addPage();
      return true;
    }
    return false;
  };

  // --- Cabecera ---
  doc.fillColor('#312e81').font('Helvetica-Bold').fontSize(16)
    .text('DECLARACIÓN DE CONFORMIDAD', { align: 'center' })
    .fontSize(12).text('con el Esquema Nacional de Seguridad', { align: 'center' });
  doc.moveDown(0.2).fillColor(GRIS).font('Helvetica').fontSize(9)
    .text('Real Decreto 311/2022, de 3 de mayo, por el que se regula el Esquema Nacional de Seguridad', { align: 'center' });
  doc.moveDown(1);

  // --- Datos del sistema y de la declaración ---
  /** @param {string} etiqueta @param {string} valor */
  const filaDato = (etiqueta, valor) => {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(GRIS).text(etiqueta, MARGEN, y, { width: 150 });
    doc.font('Helvetica').fillColor('#0f172a').text(valor, MARGEN + 155, y, { width: ancho - 155 });
    doc.moveDown(0.3);
  };
  filaDato('Sistema de información', d.sistema_nombre);
  filaDato('Categoría ENS', CATEGORIAS_SISTEMA[d.categoria_ens]);
  filaDato('Versión de la declaración', `${d.version} (${ESTADOS_DECLARACION[d.estado]})`);
  filaDato('Evaluación de origen', d.evaluacion_nombre);
  filaDato('Fecha de generación', fechaHora(d.fecha_generacion));
  filaDato('Generada por', d.generado_por_nombre);
  if (d.fecha_emision) filaDato('Fecha de emisión', `${fechaHora(d.fecha_emision)} · ${d.emitido_por_nombre}`);
  doc.moveDown(0.6);

  // --- Resumen ---
  const yResumen = doc.y;
  doc.roundedRect(MARGEN, yResumen, ancho, 58, 6).fillAndStroke('#eef2ff', '#c7d2fe');
  doc.fillColor('#312e81').font('Helvetica-Bold').fontSize(22)
    .text(formatoPorcentaje(d.porcentaje_implementacion), MARGEN + 12, yResumen + 10, { width: 150 });
  doc.font('Helvetica').fontSize(8).fillColor(GRIS).text('de implementación', MARGEN + 12, yResumen + 38, { width: 150 });
  const cifras = [
    ['Total', d.numero_controles_total],
    ['Implementados', d.numero_controles_implementados],
    ['Pendientes', d.numero_controles_pendientes],
    ['No aplicables', d.numero_controles_no_aplica],
  ];
  cifras.forEach(([etiqueta, valor], i) => {
    const x = MARGEN + 170 + i * 80;
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text(String(valor), x, yResumen + 12, { width: 75, align: 'center' });
    doc.font('Helvetica').fontSize(8).fillColor(GRIS).text(etiqueta, x, yResumen + 34, { width: 75, align: 'center' });
  });
  doc.y = yResumen + 66;
  doc.fontSize(8).fillColor(GRIS).text(
    'Porcentaje de implementación = controles implementados / controles aplicables (los «No aplicable» no computan).',
    MARGEN, doc.y, { width: ancho }
  );
  doc.moveDown(1);

  // --- Tabla de controles por categoría ---
  const celdas = (det) => ({
    control: det.control_nombre,
    estado: ESTADOS[det.estado_control],
    responsable: det.responsable || '-',
    fecha: det.fecha_revision ? fechaHora(det.fecha_revision) : '-',
    evidencia: det.evidencia || '-',
  });
  /** @param {object} valores Texto de cada columna @param {string} fuente @returns {number} Alto de la fila (la celda más alta) */
  const altoFila = (valores, fuente) => {
    doc.font(fuente).fontSize(8);
    return Math.max(...COLUMNAS.map((c) => doc.heightOfString(valores[c.campo], { width: c.ancho - RELLENO * 2 }))) + RELLENO * 2;
  };
  // FALLO POSIBLE (no comprobado): una fila más alta que una página (p. ej. una evidencia de
  // miles de caracteres) se dibuja igualmente y se sale del área de la página.
  /** @param {object} valores @param {{ cabecera?: boolean, colorEstado?: string }} [opciones] */
  const dibujarFila = (valores, { cabecera = false, colorEstado } = {}) => {
    const fuente = cabecera ? 'Helvetica-Bold' : 'Helvetica';
    const alto = altoFila(valores, fuente);
    const y = doc.y;
    let x = MARGEN;
    if (cabecera) doc.rect(MARGEN, y, ancho, alto).fill('#f1f5f9');
    COLUMNAS.forEach((c) => {
      doc.rect(x, y, c.ancho, alto).lineWidth(0.5).stroke(BORDE);
      const color = !cabecera && c.campo === 'estado' ? colorEstado : cabecera ? GRIS : '#0f172a';
      doc.font(!cabecera && c.campo === 'estado' ? 'Helvetica-Bold' : fuente).fontSize(8).fillColor(color)
        .text(valores[c.campo], x + RELLENO, y + RELLENO, { width: c.ancho - RELLENO * 2 });
      x += c.ancho;
    });
    doc.y = y + alto;
  };
  const cabeceraTabla = Object.fromEntries(COLUMNAS.map((c) => [c.campo, c.titulo]));

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Estado de los controles', MARGEN, doc.y);
  doc.moveDown(0.4);

  for (const categoria of Object.keys(CATEGORIAS_SISTEMA)) {
    const deCategoria = d.detalles.filter((det) => det.control_categoria === categoria);
    if (!deCategoria.length) continue;
    const colores = COLORES_CATEGORIA[categoria];
    const impl = deCategoria.filter((det) => det.estado_control === 'IMPLEMENTADO').length;
    const aplic = deCategoria.filter((det) => det.estado_control !== 'NO_APLICA').length;

    saltoSiHaceFalta(22 + 18 + altoFila(celdas(deCategoria[0]), 'Helvetica'));
    const y = doc.y;
    doc.rect(MARGEN, y, ancho, 18).fill(colores.fondo);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(colores.texto)
      .text(`Categoría ${CATEGORIAS_SISTEMA[categoria]}`, MARGEN + 6, y + 4, { continued: true })
      .font('Helvetica').text(`   ${impl}/${aplic} implementados`);
    doc.y = y + 18;
    dibujarFila(cabeceraTabla, { cabecera: true });

    for (const det of deCategoria) {
      const valores = celdas(det);
      // Al saltar de página se repite la cabecera de la tabla
      if (saltoSiHaceFalta(altoFila(valores, 'Helvetica'))) dibujarFila(cabeceraTabla, { cabecera: true });
      dibujarFila(valores, { colorEstado: COLORES_ESTADO[det.estado_control] });
    }
    doc.moveDown(0.8);
  }

  // --- Observaciones ---
  saltoSiHaceFalta(60);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Observaciones', MARGEN, doc.y);
  doc.moveDown(0.3).font('Helvetica').fontSize(9).fillColor(d.observaciones ? '#0f172a' : GRIS)
    .text(d.observaciones || 'Sin observaciones.', { width: ancho });
  doc.moveDown(1.5);

  // --- Firma ---
  saltoSiHaceFalta(110);
  const firmante = d.emitido_por_nombre || d.generado_por_nombre;
  const fechaFirma = d.fecha_emision || d.fecha_generacion;
  doc.font('Helvetica').fontSize(9).fillColor('#0f172a')
    .text(`Documento generado el ${fechaHora(d.fecha_generacion)} por ${d.generado_por_nombre} a partir de la evaluación «${d.evaluacion_nombre}».`, { width: ancho });
  if (d.fecha_emision) doc.text(`Emitido el ${fechaHora(d.fecha_emision)} por ${d.emitido_por_nombre}.`, { width: ancho });
  doc.moveDown(2.5);
  const yFirma = doc.y;
  doc.moveTo(MARGEN + ancho - 220, yFirma).lineTo(MARGEN + ancho, yFirma).lineWidth(0.8).stroke('#0f172a');
  doc.font('Helvetica-Bold').fontSize(9).text(firmante, MARGEN + ancho - 220, yFirma + 4, { width: 220, align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor(GRIS).text(`Fecha: ${fechaHora(fechaFirma)}`, MARGEN + ancho - 220, doc.y, { width: 220, align: 'center' });

  // --- Marca de agua y pie en todas las páginas ---
  const rango = doc.bufferedPageRange();
  // Los borradores y las superadas llevan marca de agua: solo la emitida vigente sale «limpia»
  const marca = d.estado === 'BORRADOR' ? 'BORRADOR' : d.estado === 'SUPERADA' ? 'SUPERADA' : null;
  for (let i = rango.start; i < rango.start + rango.count; i++) {
    doc.switchToPage(i);
    if (marca) {
      doc.save().rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] })
        .font('Helvetica-Bold').fontSize(90).fillColor('#94a3b8').fillOpacity(0.15)
        .text(marca, 0, doc.page.height / 2 - 45, { width: doc.page.width, align: 'center', lineBreak: false })
        .restore();
      doc.fillOpacity(1);
    }
    // El pie va dentro del margen inferior: se anula el margen para que pdfkit no añada página
    const margenInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const yPie = doc.page.height - MARGEN + 5;
    doc.font('Helvetica').fontSize(7).fillColor(GRIS).text(
      `Declaración de Conformidad ENS · ${d.sistema_nombre} · versión ${d.version} (${ESTADOS_DECLARACION[d.estado]}) · Página ${i - rango.start + 1} de ${rango.count}`,
      MARGEN, yPie, { width: ancho, align: 'center', lineBreak: false }
    );
    doc.page.margins.bottom = margenInferior;
  }
  doc.end();
};

module.exports = { escribirPdf };
