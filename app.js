require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const passport = require('./config/passport');
const { cabecerasSeguridad, proteccionCsrf } = require('./middlewares/seguridad');
const { ROLES } = require('./config/roles');

const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const ratRoutes = require('./routes/rat');
const riesgoRoutes = require('./routes/riesgos');
const sistemaRoutes = require('./routes/sistemas');
const evaluacionRoutes = require('./routes/evaluaciones');
const controlRoutes = require('./routes/controles');
const incidenteRoutes = require('./routes/incidentes');
const derechoRoutes = require('./routes/derechos');
const proveedorRoutes = require('./routes/proveedores');
const declaracionRoutes = require('./routes/declaraciones');
const politicaRoutes = require('./routes/politicas');
const biaRoutes = require('./routes/bia');
const empresaRoutes = require('./routes/empresa');
const usuarioRoutes = require('./routes/usuarios');
const { obtenerOrganizacion } = require('./lib/organizacion');
const { CRITICIDAD_CLASES, ESTADO_REVISION_CLASES, RESULTADO_CLASES, ALERTA_BIA_CLASES } = require('./lib/bia');
const { ESTADO_POLITICA_CLASES, REVISION_CLASES } = require('./lib/politicas');
const { icono } = require('./lib/iconos');
const { AREAS, areaDeRuta } = require('./lib/areas');
const { ESTADO_DECLARACION_CLASES } = require('./lib/declaraciones');
const { fecha, fechaHora, aInputFechaHora, aInputFecha } = require('./lib/formato');
const { ESTADO_PROVEEDOR_CLASES, NIVEL_ENS_CLASES, ALERTA_CLASES } = require('./lib/proveedores');
const { NIVEL_CLASES } = require('./lib/riesgo');
const { CATEGORIA_CLASES, ESTADO_CLASES } = require('./lib/ens');
const { GRAVEDAD_CLASES, ESTADO_INCIDENTE_CLASES } = require('./lib/incidentes');
const { URGENCIA_CLASES, ESTADO_SOLICITUD_CLASES } = require('./lib/derechos');

if (!process.env.SESSION_SECRET) {
  throw new Error('Falta SESSION_SECRET en el .env');
}

const app = express();
// No anunciar la tecnología del servidor (cabecera X-Powered-By: Express)
app.disable('x-powered-by');
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.roles = ROLES;
app.locals.nivelClases = NIVEL_CLASES;
app.locals.categoriaClases = CATEGORIA_CLASES;
app.locals.estadoClases = ESTADO_CLASES;
app.locals.fecha = fecha;
app.locals.fechaHora = fechaHora;
app.locals.aInputFechaHora = aInputFechaHora;
app.locals.gravedadClases = GRAVEDAD_CLASES;
app.locals.estadoIncidenteClases = ESTADO_INCIDENTE_CLASES;
app.locals.urgenciaClases = URGENCIA_CLASES;
app.locals.estadoSolicitudClases = ESTADO_SOLICITUD_CLASES;
app.locals.aInputFecha = aInputFecha;
app.locals.estadoProveedorClases = ESTADO_PROVEEDOR_CLASES;
app.locals.nivelEnsClases = NIVEL_ENS_CLASES;
app.locals.alertaClases = ALERTA_CLASES;
app.locals.estadoDeclaracionClases = ESTADO_DECLARACION_CLASES;
app.locals.estadoPoliticaClases = ESTADO_POLITICA_CLASES;
app.locals.revisionClases = REVISION_CLASES;
app.locals.criticidadClases = CRITICIDAD_CLASES;
app.locals.estadoRevisionClases = ESTADO_REVISION_CLASES;
app.locals.resultadoClases = RESULTADO_CLASES;
app.locals.alertaBiaClases = ALERTA_BIA_CLASES;
app.locals.icono = icono;
// Valores por defecto del área (el middleware los fija en cada petición según la URL)
app.locals.areaNormativa = 'neutro';
app.locals.versionCss = '0';
const CSS_COMPILADO = path.join(__dirname, 'public', 'css', 'output.css');
app.locals.areasNormativas = AREAS;
app.locals.producto = { nombre: 'Compliance AI', lema: 'AI Compliance Platform' };
// Iniciales para el avatar: "José María de Paz" → "JM" (sin partículas como "de" o "la")
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'i', 'da', 'do', 'van', 'von']);
app.locals.iniciales = (nombre = '') =>
  nombre.split(/\s+/).filter((p) => p && !PARTICULAS.has(p.toLowerCase())).slice(0, 2)
    .map((p) => p[0].toUpperCase()).join('') || '?';

// Middlewares
app.use(cabecerasSeguridad);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Pestañas sin <link rel="icon"> (p. ej. el visor de PDF del navegador) piden /favicon.ico
app.get('/favicon.ico', (req, res) => res.type('image/svg+xml').sendFile(path.join(__dirname, 'public', 'img', 'logo.svg')));
// Tipografía Inter alojada en el propio servidor (sin Google Fonts: no se envían IPs a terceros)
app.use('/fuentes', express.static(
  path.join(path.dirname(require.resolve('@fontsource-variable/inter/package.json')), 'files'),
  { maxAge: '30d', immutable: true }
));

if (isProduction) app.set('trust proxy', 1);

app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8, // 8 horas
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());
// Protección CSRF (origen de la petición + token de sesión en los formularios)
app.use(proteccionCsrf);

// Datos comunes a todas las vistas: usuario, ruta actual, área (RGPD/ENS/neutro, para el
// código de color de contexto) y mensaje flash (se muestra una vez)
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  res.locals.areaNormativa = areaDeRuta(req.path);
  // Versión del CSS compilado (fecha de modificación): cambia la URL de la hoja de estilos al
  // recompilarla, para que el navegador no siga usando la versión antigua de su caché
  try {
    res.locals.versionCss = fs.statSync(CSS_COMPILADO).mtimeMs.toFixed(0);
  } catch {
    res.locals.versionCss = '0';
  }
  res.locals.areasNormativas = AREAS;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// Datos de la empresa para la cabecera de todas las pantallas (en caché, ver lib/organizacion.js)
app.use((req, res, next) => {
  obtenerOrganizacion()
    .then((organizacion) => {
      res.locals.organizacion = organizacion;
      next();
    })
    .catch(next);
});

// Rutas
app.use('/', indexRoutes);
app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/rat', ratRoutes);
app.use('/riesgos', riesgoRoutes);
app.use('/sistemas', sistemaRoutes);
app.use('/evaluaciones', evaluacionRoutes);
app.use('/controles', controlRoutes);
app.use('/incidentes', incidenteRoutes);
app.use('/derechos', derechoRoutes);
app.use('/proveedores', proveedorRoutes);
app.use('/declaraciones', declaracionRoutes);
app.use('/politicas', politicaRoutes);
app.use('/bia', biaRoutes);
app.use('/empresa', empresaRoutes);
app.use('/usuarios', usuarioRoutes);
// El checklist global se sustituyó por evaluaciones por sistema
app.get('/checklist', (req, res) => res.redirect(301, '/sistemas'));

// 404
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Página no encontrada',
    mensaje: 'La página que buscas no existe.',
  });
});

// Errores
app.use((err, req, res, next) => {
  // Red de seguridad: un valor fuera del rango de la columna (p. ej. un id enorme en la URL)
  // no es un fallo del servidor sino una petición que no corresponde a ningún registro
  if (err && err.code === 'P2020') {
    return res.status(404).render('error', {
      title: 'Página no encontrada',
      mensaje: 'La página que buscas no existe.',
    });
  }
  console.error(err);
  res.status(500).render('error', {
    title: 'Error del servidor',
    mensaje: 'Ha ocurrido un error inesperado.',
  });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
