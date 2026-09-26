require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('./config/passport');
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
const { fecha, fechaHora, aInputFechaHora } = require('./lib/formato');
const { NIVEL_CLASES } = require('./lib/riesgo');
const { CATEGORIA_CLASES, ESTADO_CLASES } = require('./lib/ens');
const { GRAVEDAD_CLASES, ESTADO_INCIDENTE_CLASES } = require('./lib/incidentes');
const { URGENCIA_CLASES, ESTADO_SOLICITUD_CLASES } = require('./lib/derechos');

if (!process.env.SESSION_SECRET) {
  throw new Error('Falta SESSION_SECRET en el .env');
}

const app = express();
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

// Middlewares
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// Datos comunes a todas las vistas: usuario, ruta actual y mensaje flash (se muestra una vez)
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
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
  console.error(err);
  res.status(500).render('error', {
    title: 'Error del servidor',
    mensaje: 'Ha ocurrido un error inesperado.',
  });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
