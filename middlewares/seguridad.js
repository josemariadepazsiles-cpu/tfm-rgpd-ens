const crypto = require('crypto');

// Medidas de seguridad transversales: cabeceras HTTP, protección CSRF y límite de intentos
// de inicio de sesión.

// ---------------------------------------------------------------------------------------
// Cabeceras de seguridad (equivalente reducido a helmet, sin dependencias)
// La CSP admite scripts en línea y 'unsafe-eval' porque Alpine.js evalúa sus expresiones
// (x-data, @click...) y los componentes se registran en línea en partials/head.ejs; Alpine se
// carga desde cdn.jsdelivr.net.
// ---------------------------------------------------------------------------------------
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const cabecerasSeguridad = (req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
};

// ---------------------------------------------------------------------------------------
// CSRF
// 1) Toda petición que modifica datos (POST...) debe venir del propio sitio: si el navegador
//    envía Origin o Referer, su host tiene que ser el de la aplicación.
// 2) Con sesión iniciada, además debe llevar el token de la sesión en el campo oculto _csrf.
//    El token se añade automáticamente a todos los <form method="POST"> al pintar las vistas.
//    En los formularios con archivo (multipart) el cuerpo aún no está leído: lo comprueba
//    lib/subidas.js después de que multer lo procese.
// ---------------------------------------------------------------------------------------
const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Únicas rutas que reciben archivos (multipart): POST …/documentos, …/versiones, …/adjuntos
const RUTA_SUBIDA = /^\/(derechos|proveedores|politicas)\/\d+\/(documentos|versiones|adjuntos)\/?$/;

const tokenDeSesion = (req) => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('base64url');
  return req.session.csrfToken;
};

const tokenValido = (req, recibido) => {
  const esperado = req.session && req.session.csrfToken;
  if (!esperado || typeof recibido !== 'string') return false;
  const a = Buffer.from(esperado);
  const b = Buffer.from(recibido);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const mismoOrigen = (req) => {
  const fuente = req.get('origin') || req.get('referer');
  if (!fuente) return true; // clientes sin cabecera (no navegadores): decide el token
  try {
    return new URL(fuente).host === req.get('host');
  } catch {
    return false;
  }
};

const rechazar = (res) =>
  res.status(403).render('error', {
    title: 'Formulario caducado',
    mensaje: 'No se ha podido verificar el formulario. Vuelve a la página anterior, recárgala y repite la acción.',
  });

// Inserta el token en cada <form method="POST"> del HTML generado
const FORM_POST = /<form\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
const insertarToken = (html, token) =>
  html.replace(FORM_POST, (etiqueta) =>
    /\bmethod\s*=\s*["']?post\b/i.test(etiqueta)
      ? `${etiqueta}<input type="hidden" name="_csrf" value="${token}">`
      : etiqueta
  );

const proteccionCsrf = (req, res, next) => {
  if (req.isAuthenticated()) {
    const token = tokenDeSesion(req);
    res.locals.csrfToken = token;
    const render = res.render.bind(res);
    res.render = (vista, opciones, callback) => {
      if (typeof opciones === 'function') [opciones, callback] = [{}, opciones];
      if (callback) return render(vista, opciones, callback);
      render(vista, opciones, (err, html) => (err ? req.next(err) : res.send(insertarToken(html, token))));
    };
  }

  if (METODOS_SEGUROS.has(req.method)) return next();
  if (!mismoOrigen(req)) return rechazar(res);
  if (!req.isAuthenticated()) return next();
  if (req.is('multipart/form-data')) {
    // Solo las rutas de subida leen un cuerpo multipart; en cualquier otra se rechaza
    if (!RUTA_SUBIDA.test(req.path)) return rechazar(res);
    req.csrfPendiente = true; // lo comprueba lib/subidas.js tras leer el cuerpo
    return next();
  }
  if (!tokenValido(req, req.body && req.body._csrf)) return rechazar(res);
  next();
};

// ---------------------------------------------------------------------------------------
// Límite de intentos de inicio de sesión (en memoria): 5 fallos por IP y email en 15 minutos
// bloquean ese par durante el resto de la ventana. Un inicio de sesión correcto lo reinicia.
// ---------------------------------------------------------------------------------------
const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;
const fallos = new Map(); // clave → { cuenta, desde }

const claveIntento = (req) => `${req.ip}|${String((req.body && req.body.email) || '').trim().toLowerCase()}`;

const vigente = (clave, ahora = Date.now()) => {
  const r = fallos.get(clave);
  if (r && ahora - r.desde > VENTANA_MS) {
    fallos.delete(clave);
    return null;
  }
  return r || null;
};

const intentosLogin = {
  bloqueado(req) {
    const r = vigente(claveIntento(req));
    if (!r || r.cuenta < MAX_FALLOS) return 0;
    return Math.ceil((r.desde + VENTANA_MS - Date.now()) / 60000); // minutos restantes
  },
  fallo(req) {
    const clave = claveIntento(req);
    const r = vigente(clave) || { cuenta: 0, desde: Date.now() };
    r.cuenta += 1;
    fallos.set(clave, r);
  },
  exito(req) {
    fallos.delete(claveIntento(req));
  },
};

// Limpieza periódica para que el mapa no crezca indefinidamente
setInterval(() => {
  const ahora = Date.now();
  for (const clave of fallos.keys()) vigente(clave, ahora);
}, VENTANA_MS).unref();

module.exports = { cabecerasSeguridad, proteccionCsrf, tokenValido, intentosLogin, MAX_FALLOS };
