// PDF de ejemplo para las políticas que aún no tienen su documento vigente.
// Sin PDF no se puede leer ni aceptar una política, así que este script permite probar
// el flujo de aceptación con los datos de ejemplo. No toca las políticas que ya tienen PDF.
//
// Uso: npm run db:pdfs-politicas      (también lo ejecuta npm run db:ejemplo)
require('dotenv').config({ quiet: true });
const PDFDocument = require('pdfkit');
const prisma = require('../lib/prisma');
const { guardarArchivo, borrarArchivo } = require('../lib/subidas');
const { TIPOS_POLITICA } = require('../lib/politicas');

// Genera en memoria un PDF sencillo con los datos de la política
const generarPdf = (politica, organizacion) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60, info: { Title: politica.titulo, Author: organizacion || 'Compliance AI' } });
    const partes = [];
    doc.on('data', (p) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    doc.fillColor('#64748b').fontSize(9).text(`${organizacion || ''}`.toUpperCase(), { characterSpacing: 1 });
    doc.moveDown(2);
    doc.fillColor('#4f46e5').fontSize(10).text(TIPOS_POLITICA[politica.tipo_documento] || 'Documento');
    doc.fillColor('#0f172a').fontSize(20).text(politica.titulo);
    doc.moveDown(0.3).fillColor('#475569').fontSize(10).text(`Versión ${politica.version}`);
    doc.moveDown(1.5).fillColor('#1e293b').fontSize(11);
    if (politica.descripcion) doc.text(politica.descripcion, { align: 'justify' }).moveDown();
    doc.text(
      'Este documento recoge los compromisos de la organización en la materia indicada y es de obligado ' +
        'conocimiento para todo el personal incluido en su alcance. Su contenido se revisará periódicamente ' +
        'y siempre que se produzcan cambios relevantes en la organización, en sus sistemas de información ' +
        'o en la normativa aplicable.',
      { align: 'justify' }
    );
    doc.moveDown(2).fillColor('#94a3b8').fontSize(8)
      .text('Documento de ejemplo generado automáticamente para la demostración de la plataforma.');
    doc.end();
  });

// Adjunta un PDF vigente a cada política que no lo tenga. Devuelve cuántos ha creado.
const adjuntarPdfsEjemplo = async (db = prisma) => {
  const organizacion = await db.organizacion.findFirst({ select: { nombre: true } });
  const politicas = await db.politica.findMany({
    where: { archivos: { none: { historico: false } } },
    select: { id: true, titulo: true, tipo_documento: true, version: true, descripcion: true, creado_por_id: true, fecha_aprobacion: true, created_at: true },
  });
  for (const p of politicas) {
    const buffer = await generarPdf(p, organizacion && organizacion.nombre);
    const ruta = await guardarArchivo(`politicas/${p.id}`, buffer);
    const nombre = `${p.titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)}-v${p.version}.pdf`;
    try {
      await db.archivoPolitica.create({
        data: {
          politica_id: p.id, version: p.version, historico: false, ruta_archivo: ruta, nombre_archivo_original: nombre,
          tamano_bytes: buffer.length, subido_por_id: p.creado_por_id, fecha_subida: p.fecha_aprobacion || p.created_at,
        },
      });
    } catch (err) {
      await borrarArchivo(ruta);
      throw err;
    }
  }
  return politicas.length;
};

module.exports = { adjuntarPdfsEjemplo };

if (require.main === module) {
  adjuntarPdfsEjemplo()
    .then(async (n) => {
      console.log(`PDF de ejemplo añadidos: ${n}`);
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
