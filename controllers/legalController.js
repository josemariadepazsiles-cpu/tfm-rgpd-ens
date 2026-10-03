// Páginas legales públicas (accesibles sin iniciar sesión): aviso legal, política de privacidad
// y política de cookies. Los datos del titular están en config/legal.js.
const legal = require('../config/legal');
const { desdeInputFecha } = require('../lib/formato');

/**
 * Pinta una página legal con los datos comunes (titular, proyecto y fecha de actualización).
 * @param {import('express').Response} res
 * @param {string} vista Vista dentro de views/legal/
 * @param {string} title Título de la página
 */
const pagina = (res, vista, title) =>
  res.render(`legal/${vista}`, {
    title,
    legal,
    actualizado: desdeInputFecha(legal.FECHA_ACTUALIZACION),
  });

/**
 * GET /aviso-legal · público. Información del titular (art. 10 LSSI-CE) y condiciones de uso.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const avisoLegal = (req, res) => pagina(res, 'aviso-legal', 'Aviso legal');

/**
 * GET /privacidad · público. Información sobre el tratamiento de datos (arts. 13 y 14 RGPD).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const privacidad = (req, res) => pagina(res, 'privacidad', 'Política de privacidad');

/**
 * GET /cookies · público. Cookies y almacenamiento local que usa la aplicación (art. 22.2 LSSI-CE).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const cookies = (req, res) => pagina(res, 'cookies', 'Política de cookies');

module.exports = { avisoLegal, privacidad, cookies };
