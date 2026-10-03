// Ficha con los datos de la organización (la empresa que usa la aplicación).
const { CAMPOS, obtenerOrganizacion, guardarOrganizacion } = require('../lib/organizacion');
const { CATEGORIAS_SISTEMA } = require('../lib/declaraciones');
const { excesos, CORTO } = require('../lib/validacion');

// Datos de la empresa: cualquier usuario los consulta; solo el Administrador los modifica.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

/**
 * @param {object} body Cuerpo del formulario
 * @returns {object} Campos de texto (vacío → null) y categoría ENS
 */
const leerFormulario = (body) => {
  const datos = {};
  Object.keys(CAMPOS).forEach((campo) => { datos[campo] = texto(body[campo]) || null; });
  datos.categoria_ens = body.categoria_ens || null;
  return datos;
};

/**
 * @param {object} datos
 * @returns {string[]} Mensajes de error
 */
const validar = (datos) => {
  // Resto de campos de la ficha: textos cortos
  const errores = excesos(datos, Object.fromEntries(Object.entries(CAMPOS).filter(([c]) => c !== 'nombre').map(([c, etiqueta]) => [c, [etiqueta, CORTO]])));
  if (!datos.nombre) errores.push('El nombre de la empresa es obligatorio.');
  if (datos.nombre && datos.nombre.length > 150) errores.push('El nombre no puede superar los 150 caracteres.');
  if (datos.categoria_ens !== null && !Object.hasOwn(CATEGORIAS_SISTEMA, datos.categoria_ens)) errores.push('La categoría ENS no es válida.');
  for (const campo of ['email', 'dpd_email']) {
    if (datos[campo] && !EMAIL_REGEX.test(datos[campo])) errores.push(`${CAMPOS[campo]}: el email no es válido.`);
  }
  // Solo se admite el formato español de 5 dígitos
  if (datos.codigo_postal && !/^\d{5}$/.test(datos.codigo_postal)) errores.push('El código postal debe tener 5 dígitos.');
  return errores;
};

/**
 * @param {import('express').Response} res
 * @param {{ organizacion: object, errores?: string[], status?: number }} opciones
 */
const render = (res, { organizacion, errores = [], status = 200 }) =>
  res.status(status).render('empresa/index', {
    title: 'Datos de la empresa',
    // «empresa» y no «organizacion»: esta última es la de la cabecera (datos guardados)
    empresa: organizacion,
    errores,
    campos: CAMPOS,
    categorias: CATEGORIAS_SISTEMA,
  });

/**
 * GET /empresa · cualquier usuario con sesión. Muestra la ficha (editable solo para el Administrador).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const show = async (req, res) => render(res, { organizacion: (await obtenerOrganizacion()) || {} });

// Solo administradores (la ruta usa ensureAdmin)
/**
 * POST /empresa · Administrador. Valida y guarda; renueva la caché de la cabecera.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const update = async (req, res) => {
  const datos = leerFormulario(req.body);
  const errores = validar(datos);
  if (errores.length) return render(res, { organizacion: datos, errores, status: 400 });
  const organizacion = await guardarOrganizacion(datos);
  // No tiene efecto: la respuesta es una redirección y la página siguiente vuelve a leer la caché
  res.locals.organizacion = organizacion;
  req.session.flash = { tipo: 'exito', mensaje: 'Datos de la empresa guardados.' };
  res.redirect('/empresa');
};

module.exports = { show, update };
