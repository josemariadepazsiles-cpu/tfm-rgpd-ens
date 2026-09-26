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
