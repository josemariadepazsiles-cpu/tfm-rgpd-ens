// Autenticación con Passport: inicio de sesión con email y contraseña (estrategia local) y
// cómo se guarda y recupera el usuario en la sesión.
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

// Hash de relleno para que el tiempo de respuesta sea similar exista o no el email
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

/**
 * Estrategia local: comprueba email y contraseña (bcrypt) y que la cuenta esté activa.
 * Usuario inexistente y contraseña errónea dan el mismo mensaje para no revelar qué
 * emails existen.
 * @param {string} email
 * @param {string} password
 * @param {Function} done Callback de Passport: done(error, usuario | false, { message })
 */
// FALLO DETECTADO: si el formulario llega sin email o sin contraseña, passport-local no
// llama a esta función y devuelve su mensaje por defecto en inglés («Missing credentials»),
// que la página de login muestra tal cual.
passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        const usuario = await prisma.usuario.findUnique({
          where: { email: email.trim().toLowerCase() },
        });

        const passwordValida = await bcrypt.compare(
          password,
          usuario ? usuario.password_hash : DUMMY_HASH
        );

        if (!usuario || !passwordValida) {
          return done(null, false, { message: 'Email o contraseña incorrectos' });
        }
        if (!usuario.activo) {
          return done(null, false, { message: 'Tu cuenta está desactivada. Contacta con el administrador.' });
        }

        return done(null, usuario);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// En la sesión solo se guarda el id del usuario
/**
 * @param {object} usuario Usuario autenticado
 * @param {Function} done done(error, id)
 */
passport.serializeUser((usuario, done) => {
  done(null, usuario.id);
});

/**
 * Recupera en cada petición el usuario de la sesión (queda en req.user) con los ids de los
 * sistemas en los que trabaja (req.user.sistemaIds), que deciden qué políticas debe aceptar.
 * @param {number} id Id guardado en la sesión
 * @param {Function} done done(error, usuario | false)
 */
passport.deserializeUser(async (id, done) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: { id: true, nombre: true, email: true, rol: true, cargo: true, activo: true, sistemas: { select: { sistema_id: true } } },
    });
    // Si lo han desactivado, la sesión deja de ser válida
    if (!usuario || !usuario.activo) return done(null, false);
    const { sistemas, ...datos } = usuario;
    done(null, { ...datos, sistemaIds: sistemas.map((s) => s.sistema_id) });
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
