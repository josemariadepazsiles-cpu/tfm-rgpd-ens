const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const multer = require('multer');
const { tokenValido } = require('../middlewares/seguridad');

// Subida de documentos PDF. Los archivos se guardan en UPLOADS_DIR (por defecto uploads/,
// excluida del control de versiones) con un nombre aleatorio generado por el servidor;
// el nombre original solo se guarda en la base de datos.

const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads'));
const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB
const FIRMA_PDF = Buffer.from('%PDF-');

// El archivo se recibe en memoria para validar su contenido antes de escribirlo en disco
const recibirPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO, files: 1, fields: 10 },
  // Los navegadores envían el nombre del archivo en UTF-8 (por defecto multer usa latin1
  // y rompe acentos y eñes)
  defParamCharset: 'utf8',
}).single('archivo');

// Ejecuta multer y devuelve un mensaje de error legible (o null)
const procesarSubida = (req, res) =>
  new Promise((resolve) => {
    recibirPdf(req, res, (err) => {
      // Formulario con archivo: el token CSRF solo se puede comprobar una vez leído el cuerpo
      if (!err && req.csrfPendiente && !tokenValido(req, req.body && req.body._csrf)) {
        return resolve('No se ha podido verificar el formulario. Recarga la página y vuelve a intentarlo.');
      }
      if (!err) return resolve(null);
      if (err.code === 'LIMIT_FILE_SIZE') return resolve(`El archivo supera el tamaño máximo de ${TAMANO_MAXIMO / 1024 / 1024} MB.`);
      if (err instanceof multer.MulterError) return resolve('No se ha podido procesar el archivo enviado.');
      resolve('Error al recibir el archivo.');
    });
  });

// Comprueba extensión, tipo declarado y firma real del contenido (%PDF-)
const validarPdf = (archivo) => {
  if (!archivo) return 'Selecciona un archivo PDF.';
  if (path.extname(archivo.originalname).toLowerCase() !== '.pdf') return 'Solo se admiten archivos .pdf.';
  if (archivo.mimetype !== 'application/pdf') return 'El archivo no es un PDF.';
  if (archivo.size === 0 || !archivo.buffer.subarray(0, FIRMA_PDF.length).equals(FIRMA_PDF)) {
    return 'El contenido del archivo no es un PDF válido.';
  }
  return null;
};

// Guarda el PDF con un nombre único en <carpeta>/ y devuelve la ruta relativa
const guardarArchivo = async (carpeta, buffer) => {
  const relativa = path.posix.join(carpeta, `${crypto.randomUUID()}.pdf`);
  const destino = rutaAbsoluta(relativa);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, buffer, { flag: 'wx' }); // 'wx': nunca sobrescribe
  return relativa;
};

// Ruta absoluta de un archivo guardado, comprobando que queda dentro de UPLOADS_DIR
const rutaAbsoluta = (relativa) => {
  const absoluta = path.resolve(UPLOADS_DIR, relativa);
  if (!absoluta.startsWith(UPLOADS_DIR + path.sep)) throw new Error('Ruta de archivo no válida');
  return absoluta;
};

const borrarArchivo = async (relativa) => {
  try {
    await fs.unlink(rutaAbsoluta(relativa));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
};

// Nombre de archivo para la cabecera Content-Disposition (ASCII + versión UTF-8)
const cabeceraDisposicion = (tipo, nombre) => {
  const ascii = nombre.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'documento.pdf';
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
};

const formatoTamano = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

module.exports = {
  UPLOADS_DIR,
  TAMANO_MAXIMO,
  procesarSubida,
  validarPdf,
  guardarArchivo,
  rutaAbsoluta,
  borrarArchivo,
  cabeceraDisposicion,
  formatoTamano,
};
